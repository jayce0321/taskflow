/* ===== 데이터 ===== */
const COLORS = ['#6c63ff','#ff4757','#ffa502','#2ed573','#1e90ff','#ff6b81','#eccc68','#a29bfe','#fd79a8','#00b894'];
const API_BASE = '';  // 동일 서버 — 배포 후에도 변경 불필요

let state = {
  projects: [],
  tasks: [],
  currentView: 'all',      // 'all' | 'today' | 'overdue' | project id
  currentFilter: 'all',    // 'all' | 'todo' | 'doing' | 'done'
  currentSort: 'created',
  viewMode: 'list',        // 'list' | 'calendar'
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  editingTaskId: null,
  editingProjectId: null,
};

// ── 샘플 데이터 초기화 ──────────────────────────────────────────
function initSampleData() {
  state.projects = [
    { id: uid(), name: '개인', color: '#6c63ff' },
    { id: uid(), name: '업무', color: '#ff4757' },
  ];
  const td = dateStr(0), p1 = state.projects[0].id, p2 = state.projects[1].id;
  state.tasks = [
    { id: uid(), title: 'Claude Code 사용법 익히기', desc: '기본 명령어와 워크플로우 학습', projectId: p1, status: 'doing', priority: 'high', startDate: dateStr(-1), deadline: td, createdAt: Date.now() - 2000 },
    { id: uid(), title: 'GitHub 레포 만들기',        desc: '첫 번째 프로젝트 레포지토리 생성', projectId: p1, status: 'todo',  priority: 'medium', startDate: td, deadline: dateStr(2), createdAt: Date.now() - 1000 },
    { id: uid(), title: '주간 보고서 작성',           desc: '', projectId: p2, status: 'todo',  priority: 'high', startDate: '', deadline: dateStr(-1), createdAt: Date.now() },
    { id: uid(), title: '팀 미팅 자료 준비',          desc: '', projectId: p2, status: 'done',  priority: 'low',  startDate: '', deadline: '',          createdAt: Date.now() },
  ];
}

// ── 클라우드 동기화 로드 ─────────────────────────────────────────
async function loadData() {
  showSyncStatus('loading');
  try {
    const res = await fetch(API_BASE + '/api/sync');
    if (!res.ok) throw new Error('서버 응답 오류');
    const data = await res.json();
    if (data && Array.isArray(data.projects) && data.projects.length > 0) {
      state.projects = data.projects;
      state.tasks    = data.tasks || [];
      localStorage.setItem('taskflow_v2', JSON.stringify({ projects: state.projects, tasks: state.tasks }));
    } else {
      // 서버 데이터 없음 → localStorage 확인 → 샘플 데이터
      const saved = localStorage.getItem('taskflow_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.projects = parsed.projects || [];
        state.tasks    = parsed.tasks    || [];
        await save();  // 로컬 데이터를 서버에 업로드
      } else {
        initSampleData();
        await save();
      }
    }
    showSyncStatus('ok');
  } catch (e) {
    console.warn('클라우드 로드 실패, 로컬 캐시 사용:', e);
    const saved = localStorage.getItem('taskflow_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.projects = parsed.projects || [];
      state.tasks    = parsed.tasks    || [];
    } else {
      initSampleData();
    }
    showSyncStatus('offline');
  }
}

// ── 클라우드 동기화 저장 ─────────────────────────────────────────
async function save() {
  const data = { projects: state.projects, tasks: state.tasks };
  localStorage.setItem('taskflow_v2', JSON.stringify(data));   // 즉시 로컬 저장
  try {
    const res = await fetch(API_BASE + '/api/sync', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error('저장 실패');
    showSyncStatus('ok');
  } catch (e) {
    console.warn('클라우드 저장 실패 (로컬만 저장됨):', e);
    showSyncStatus('offline');
  }
}

// ── 동기화 상태 표시 ─────────────────────────────────────────────
function showSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const map = {
    loading: { text: '⏳ 동기화 중…', color: '#f59e0b' },
    ok:      { text: '☁️ 클라우드 저장됨', color: '#10b981' },
    offline: { text: '📴 오프라인 (로컬 저장)', color: '#6b7280' },
  };
  const s = map[status] || map.ok;
  el.textContent  = s.text;
  el.style.color  = s.color;
}

// ── 데이터 가져오기 (JSON 파일) ──────────────────────────────────
async function importData(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.projects) || !Array.isArray(data.tasks)) {
      alert('올바른 TaskFlow 백업 파일이 아닙니다.');
      return;
    }
    if (!confirm(`프로젝트 ${data.projects.length}개, 할 일 ${data.tasks.length}개를 불러옵니다.\n기존 데이터는 덮어씌워집니다. 계속할까요?`)) return;
    state.projects = data.projects;
    state.tasks    = data.tasks;
    await save();
    render();
    showSyncStatus('ok');
    alert('✅ 데이터를 성공적으로 가져왔습니다!');
  } catch (e) {
    alert('파일 읽기 오류: ' + e.message);
  }
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function today() { return dateStr(0); }

// ── 날짜+시간 포맷 표시 ─────────────────────────────────────────
// "2026-06-10T09:30" → "오늘 09:30" / "2026-06-10 09:30"
// "2026-06-10"       → "오늘" / "2026-06-10"  (레거시 date-only 호환)
function formatDateTime(dt) {
  if (!dt) return '';
  const datePart = dt.slice(0, 10);
  const timePart = dt.length >= 16 ? dt.slice(11, 16) : '';
  const todayStr = today();
  const label    = datePart === todayStr ? '오늘' : datePart;
  return timePart ? `${label} ${timePart}` : label;
}

// ── 기한 초과: 시간 포함 판정 ────────────────────────────────────
function isOverdue(task) {
  if (!task.deadline || task.status === 'done') return false;
  const dl = task.deadline;
  if (dl.includes('T')) return new Date(dl) < new Date();   // datetime 비교
  return dl < today();                                        // date-only (레거시)
}

// ── 오늘 마감: 날짜 부분만 비교 ─────────────────────────────────
function isToday(task) {
  if (!task.deadline || task.status === 'done') return false;
  return task.deadline.slice(0, 10) === today();
}

/* ===== 뷰 필터 ===== */
function getVisibleTasks() {
  let tasks = [...state.tasks];

  // 뷰 필터
  if (state.currentView === 'today') {
    tasks = tasks.filter(isToday);
  } else if (state.currentView === 'overdue') {
    tasks = tasks.filter(isOverdue);
  } else if (state.currentView !== 'all') {
    tasks = tasks.filter(t => t.projectId === state.currentView);
  }

  // 상태 필터
  if (state.currentFilter !== 'all') {
    tasks = tasks.filter(t => t.status === state.currentFilter);
  }

  // 정렬
  tasks.sort((a, b) => {
    if (state.currentSort === 'deadline') {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    }
    if (state.currentSort === 'priority') {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    }
    return b.createdAt - a.createdAt;
  });

  return tasks;
}

/* ===== 렌더링 ===== */
function render() {
  renderSidebar();
  renderStats();
  syncViewUI();
  if (state.viewMode === 'calendar') {
    document.getElementById('taskBoard').classList.add('hidden');
    document.getElementById('calendarView').classList.remove('hidden');
    document.getElementById('listFilterGroup').classList.add('hidden');
    document.getElementById('calInlineNav').classList.remove('hidden');
    document.getElementById('sortSelect').style.display = 'none';
    renderCalendar();
  } else {
    document.getElementById('taskBoard').classList.remove('hidden');
    document.getElementById('calendarView').classList.add('hidden');
    document.getElementById('listFilterGroup').classList.remove('hidden');
    document.getElementById('calInlineNav').classList.add('hidden');
    document.getElementById('sortSelect').style.display = '';
    renderBoard();
  }
}

// 뷰 탭 버튼 active 상태 동기화 (render 호출마다)
function syncViewUI() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viewMode === state.viewMode);
  });
}

function renderSidebar() {
  const list = document.getElementById('projectList');
  list.innerHTML = state.projects.map(p => {
    const count = state.tasks.filter(t => t.projectId === p.id && t.status !== 'done').length;
    const active = state.currentView === p.id ? 'active' : '';
    return `
      <li class="project-item ${active}" onclick="setView('${p.id}')">
        <span class="project-dot" style="background:${p.color}"></span>
        <span class="project-name">${p.name}</span>
        ${count > 0 ? `<span class="project-count">${count}</span>` : ''}
        <button class="project-del" onclick="deleteProject('${p.id}', event)" title="삭제">✕</button>
      </li>
    `;
  }).join('');

  // nav 활성화
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.currentView);
  });
}

function renderStats() {
  const all = state.tasks;
  document.getElementById('statTotal').textContent = all.length;
  document.getElementById('statDone').textContent = all.filter(t => t.status === 'done').length;
  document.getElementById('statOverdue').textContent = all.filter(isOverdue).length;
  document.getElementById('statToday').textContent = all.filter(isToday).length;
}

function renderBoard() {
  const board = document.getElementById('taskBoard');
  const tasks = getVisibleTasks();

  if (tasks.length === 0) {
    board.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>할 일이 없습니다. 추가해보세요!</p>
      </div>`;
    return;
  }

  board.innerHTML = tasks.map(t => {
    const project = state.projects.find(p => p.id === t.projectId);
    const overdue   = isOverdue(t);
    const todayTask = isToday(t);
    const deadlineClass = overdue ? 'overdue' : todayTask ? 'today' : '';
    const deadlineLabel = overdue ? '⚠️ 기한 초과' : todayTask ? '📅 오늘 마감' : '';

    // 시작·마감 일시 표시 (시간이 있으면 함께 출력)
    const startDisplay    = (t.startDate && t.startDate !== t.deadline)
                              ? `<span class="task-date">▶ ${formatDateTime(t.startDate)}</span>` : '';
    const deadlineDisplay = t.deadline
                              ? `<span class="task-date ${deadlineClass}">🗓 ${formatDateTime(t.deadline)}${deadlineLabel ? ' · ' + deadlineLabel : ''}</span>` : '';

    return `
      <div class="task-card priority-${t.priority} status-${t.status}" onclick="openEditTask('${t.id}')">
        <div class="task-checkbox ${t.status === 'done' ? 'checked' : ''}"
             onclick="toggleDone('${t.id}', event)"></div>
        <div class="task-body">
          <div class="task-title">${t.title}</div>
          ${t.desc ? `<div class="task-desc">${t.desc}</div>` : ''}
          <div class="task-meta">
            ${project ? `<span class="badge badge-project" style="background:${project.color}22;color:${project.color}">● ${project.name}</span>` : ''}
            <span class="badge badge-status-${t.status}">${statusLabel(t.status)}</span>
            <span class="badge badge-priority-${t.priority}">${priorityLabel(t.priority)}</span>
            ${startDisplay}
            ${deadlineDisplay}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" onclick="openEditTask('${t.id}', event)" title="수정">✏️</button>
          <button class="icon-btn delete" onclick="deleteTask('${t.id}', event)" title="삭제">🗑</button>
        </div>
      </div>
    `;
  }).join('');
}

function statusLabel(s) { return { todo: '진행 전', doing: '진행 중', done: '완료' }[s]; }
function priorityLabel(p) { return { high: '높음', medium: '보통', low: '낮음' }[p]; }

/* ===== 뷰 전환 ===== */
function setView(view) {
  state.currentView = view;
  const titles = { all: '전체 보기', today: '오늘 마감', overdue: '기한 초과' };
  const project = state.projects.find(p => p.id === view);
  document.getElementById('viewTitle').textContent = project ? project.name : (titles[view] || view);
  document.getElementById('viewSubtitle').textContent = project ? `${state.tasks.filter(t=>t.projectId===view).length}개의 할 일` : '';
  render();
}

/* ===== 태스크 CRUD ===== */
function openAddTask() {
  state.editingTaskId = null;
  document.getElementById('modalTitle').textContent = '할 일 추가';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskStatus').value = 'todo';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskStartDate').value = '';
  document.getElementById('taskDeadline').value = '';
  refreshProjectSelect();
  if (state.currentView !== 'all' && state.currentView !== 'today' && state.currentView !== 'overdue') {
    document.getElementById('taskProject').value = state.currentView;
  }
  showModal('taskModal');
}

function openEditTask(id, e) {
  if (e) e.stopPropagation();
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  state.editingTaskId = id;
  document.getElementById('modalTitle').textContent = '할 일 수정';
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDesc').value = task.desc || '';
  document.getElementById('taskStatus').value = task.status;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskStartDate').value = task.startDate || '';
  document.getElementById('taskDeadline').value = task.deadline || '';
  refreshProjectSelect(task.projectId);
  showModal('taskModal');
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) { document.getElementById('taskTitle').focus(); return; }

  const data = {
    title,
    desc: document.getElementById('taskDesc').value.trim(),
    projectId: document.getElementById('taskProject').value,
    status: document.getElementById('taskStatus').value,
    priority: document.getElementById('taskPriority').value,
    startDate: document.getElementById('taskStartDate').value,
    deadline: document.getElementById('taskDeadline').value,
  };

  if (state.editingTaskId) {
    const idx = state.tasks.findIndex(t => t.id === state.editingTaskId);
    state.tasks[idx] = { ...state.tasks[idx], ...data };
  } else {
    state.tasks.push({ id: uid(), createdAt: Date.now(), ...data });
  }

  save();
  hideModal('taskModal');
  render();
}

function toggleDone(id, e) {
  e.stopPropagation();
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.status = task.status === 'done' ? 'todo' : 'done';
  save();
  render();
}

function deleteTask(id, e) {
  e.stopPropagation();
  if (!confirm('이 할 일을 삭제할까요?')) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  render();
}

/* ===== 프로젝트 CRUD ===== */
let selectedColor = COLORS[0];

function openAddProject() {
  document.getElementById('projectName').value = '';
  renderColorPicker();
  showModal('projectModal');
}

function renderColorPicker() {
  const el = document.getElementById('colorPicker');
  el.innerHTML = COLORS.map((c, i) => `
    <div class="color-option ${i === 0 ? 'selected' : ''}"
         style="background:${c}"
         onclick="selectColor('${c}', this)"></div>
  `).join('');
  selectedColor = COLORS[0];
}

function selectColor(color, el) {
  selectedColor = color;
  document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function saveProject() {
  const name = document.getElementById('projectName').value.trim();
  if (!name) { document.getElementById('projectName').focus(); return; }
  state.projects.push({ id: uid(), name, color: selectedColor });
  save();
  hideModal('projectModal');
  render();
}

function deleteProject(id, e) {
  e.stopPropagation();
  const proj = state.projects.find(p => p.id === id);
  const count = state.tasks.filter(t => t.projectId === id).length;
  const msg = count > 0
    ? `"${proj.name}" 프로젝트와 연결된 할 일 ${count}개가 있습니다.\n그래도 삭제할까요?`
    : `"${proj.name}" 프로젝트를 삭제할까요?`;
  if (!confirm(msg)) return;
  state.projects = state.projects.filter(p => p.id !== id);
  save();
  if (state.currentView === id) setView('all');
  else render();
}

function refreshProjectSelect(selectedId) {
  const sel = document.getElementById('taskProject');
  sel.innerHTML = `<option value="">-- 프로젝트 없음 --</option>` +
    state.projects.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name}</option>`).join('');
}

/* ===== 모달 ===== */
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById('overlay').classList.remove('hidden');
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById('overlay').classList.add('hidden');
}

/* ===== 캘린더 렌더링 (스팬 방식 v2) ===== */

// Date → 'YYYY-MM-DD' (로컬 기준)
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// 태스크 표시 범위: startDate~deadline (날짜 부분만 추출 — datetime 호환)
function getTaskRange(t) {
  const s = (t.startDate || t.deadline)?.slice(0, 10);
  const e = (t.deadline  || t.startDate)?.slice(0, 10);
  if (!s) return null;
  return { start: s <= e ? s : e, end: s <= e ? e : s };
}

// findLastIndex polyfill (Safari 호환)
function findLastIdx(arr, fn) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (fn(arr[i], i)) return i;
  }
  return -1;
}

// 레인 배치 (Greedy Interval Scheduling)
// 입력: [{cs, ce, ...}], 출력: 각 항목에 lane 추가
function assignLanes(items) {
  const laneEnds = []; // laneEnds[i] = i번 레인의 마지막 ce
  return items.map(item => {
    let lane = laneEnds.findIndex(end => end < item.cs);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.ce;
    return { ...item, lane };
  });
}

const MAX_VISIBLE_LANES = 3; // 이 이상은 "+N개 더" 처리
const LANE_H   = 36;   // 체크박스 포함 높이
const DAY_H    = 32;
const LANE_GAP = 3;

/* ===== 날별 완료 체크 ===== */

// 시작~종료 사이의 모든 날짜 배열 반환
function getDatesBetween(start, end) {
  const result = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end   + 'T00:00:00');
  while (cur <= last) {
    result.push(toDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// 태스크의 전체 기간 날 수
function getTotalDays(t) {
  const r = getTaskRange(t);
  if (!r) return 0;
  return getDatesBetween(r.start, r.end).length;
}

// 완료된 날 수
function getDoneDays(t) {
  if (!t.dailyDone) return 0;
  return Object.values(t.dailyDone).filter(Boolean).length;
}

// 날별 완료 토글
function toggleDailyDone(taskId, ds, e) {
  e.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!task.dailyDone) task.dailyDone = {};
  task.dailyDone[ds] = !task.dailyDone[ds];

  // 전체 기간 날 수와 완료 날 수 비교 → 자동 상태 전환
  const total = getTotalDays(task);
  const done  = getDoneDays(task);
  if (total > 0 && done >= total) {
    task.status = 'done';
  } else if (task.status === 'done' && done < total) {
    task.status = 'doing';
  }

  save();
  render();
}

function renderCalendar() {
  const year     = state.calYear;
  const month    = state.calMonth;
  const todayStr = today();

  const titleText = `${year}년 ${month + 1}월`;
  // 인라인 nav 타이틀 업데이트
  const t2 = document.getElementById('calTitle2');
  if (t2) t2.textContent = titleText;

  /* ── 1. 42칸 날짜 배열 생성 ── */
  const firstDay    = new Date(year, month, 1);
  const lastDay     = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=일
  const dates = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    dates.push({ ds: toDateStr(d), date: d, thisMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    dates.push({ ds: toDateStr(dt), date: dt, thisMonth: true });
  }
  while (dates.length < 42) {
    const extra = dates.length - startOffset - lastDay.getDate() + 1;
    const d = new Date(year, month + 1, extra);
    dates.push({ ds: toDateStr(d), date: d, thisMonth: false });
  }

  const calStart = dates[0].ds;
  const calEnd   = dates[41].ds;

  /* ── 2. 달력 범위에 걸치는 태스크 필터 & 정렬 ── */
  const visibleTasks = state.tasks
    .filter(t => {
      const r = getTaskRange(t);
      if (!r) return false;
      return r.end >= calStart && r.start <= calEnd;
    })
    .sort((a, b) => {
      const ra = getTaskRange(a), rb = getTaskRange(b);
      if (ra.start !== rb.start) return ra.start.localeCompare(rb.start);
      return rb.end.localeCompare(ra.end); // 긴 것 먼저 (레인 효율)
    });

  /* ── 3. 주(row)별 레이아웃 계산 ── */
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const rowDates = dates.slice(w * 7, w * 7 + 7);
    const rowStart = rowDates[0].ds;
    const rowEnd   = rowDates[6].ds;

    // 이 주와 겹치는 태스크
    const rowTasks = visibleTasks.filter(t => {
      const r = getTaskRange(t);
      return r && r.end >= rowStart && r.start <= rowEnd;
    });

    // 칼럼 위치 계산
    const items = rowTasks.map(t => {
      const r  = getTaskRange(t);
      const cs = rowDates.findIndex(d => d.ds >= r.start);
      const ce = findLastIdx(rowDates, d => d.ds <= r.end);
      return {
        task:    t,
        cs:      cs < 0 ? 0 : cs,
        ce:      ce < 0 ? 6 : ce,
        isStart: r.start >= rowStart,
        isEnd:   r.end   <= rowEnd,
      };
    });

    // 레인 배치
    const placed = assignLanes(items);

    // 최대 레인 수
    const maxLane = placed.length > 0 ? Math.max(...placed.map(p => p.lane)) : -1;

    // MAX_VISIBLE_LANES 초과분 분리
    const visible = placed.filter(p => p.lane < MAX_VISIBLE_LANES);
    const hidden  = placed.filter(p => p.lane >= MAX_VISIBLE_LANES);

    // 날짜별 hidden 카운트 ("+N개 더" 표시용)
    const hiddenByCol = Array(7).fill(0);
    hidden.forEach(p => {
      for (let c = p.cs; c <= p.ce; c++) hiddenByCol[c]++;
    });

    weeks.push({ rowDates, visible, hiddenByCol, maxLane });
  }

  /* ── 4. HTML 생성 ── */
  const grid = document.getElementById('calGrid');
  grid.innerHTML = weeks.map(({ rowDates, visible, hiddenByCol, maxLane }) => {
    const displayedLanes = Math.min(maxLane + 1, MAX_VISIBLE_LANES);
    const hasMore = hiddenByCol.some(n => n > 0);
    const moreRowH = hasMore ? 18 : 0;
    const rowH = DAY_H + displayedLanes * (LANE_H + LANE_GAP) + moreRowH + 8;

    /* 날짜 셀 */
    const dayCells = rowDates.map(({ ds, date, thisMonth }) => {
      const dow = date.getDay();
      const cls = [
        'cal-day-cell',
        !thisMonth   ? 'other-month' : '',
        ds === todayStr ? 'today-cell'  : '',
        dow === 0    ? 'sunday'      : '',
        dow === 6    ? 'saturday'    : '',
      ].filter(Boolean).join(' ');
      return `<div class="${cls}"><div class="cal-day-num">${date.getDate()}</div></div>`;
    }).join('');

    /* 스팬 바 + 날별 체크박스 */
    const bars = visible.map(({ task: t, cs, ce, lane, isStart, isEnd }) => {
      const proj      = state.projects.find(p => p.id === t.projectId);
      const color     = proj ? proj.color : '#a29bfe';
      const overdue   = isOverdue(t);
      const done      = t.status === 'done';
      const colSpan   = ce - cs + 1;
      const isMulti   = colSpan > 1 || (!isStart || !isEnd); // 다중 날 태스크

      const top    = DAY_H + lane * (LANE_H + LANE_GAP);
      const leftP  = (cs / 7 * 100).toFixed(3);
      const wP     = (colSpan / 7 * 100).toFixed(3);
      const barTop = top;
      const cbkTop = top + 18; // 체크박스는 바 아래쪽

      const rL = isStart ? '5px' : '0';
      const rR = isEnd   ? '5px' : '0';
      const bL = isStart ? '' : 'border-left:none;';
      const bR = isEnd   ? '' : 'border-right:none;';

      const r         = getTaskRange(t);
      const totalDays = getTotalDays(t);
      const doneDays  = getDoneDays(t);
      // 시작·마감 태그: 날짜(MM-DD) + 시간(HH:mm) 표시
      const startShort = t.startDate
        ? t.startDate.slice(5, 10) + (t.startDate.length >= 16 ? ' ' + t.startDate.slice(11, 16) : '')
        : '';
      const endShort = t.deadline
        ? t.deadline.slice(5, 10) + (t.deadline.length >= 16 ? ' ' + t.deadline.slice(11, 16) : '')
        : '';
      const startTag  = isStart && t.startDate ? `<span class="span-tag">▶${startShort}</span>` : '';
      const endTag    = isEnd   && t.deadline  ? `<span class="span-tag end-tag">◀${endShort}</span>` : '';

      // 진행률 배지 (다중 날 태스크만)
      const progressBadge = (isMulti && totalDays > 1 && isStart)
        ? `<span class="span-progress" style="color:${color}">${doneDays}/${totalDays}</span>`
        : '';

      // 스팬 바 (제목 라인)
      const bar = `<div class="cal-span-bar${done ? ' bar-done' : ''}${overdue ? ' bar-overdue' : ''}"
        style="top:${barTop}px;left:${leftP}%;width:calc(${wP}% - 3px);height:16px;
               background:${color}${done ? '30' : '1e'};
               border:1.5px solid ${color}88;color:${color};
               border-radius:${rL} ${rR} ${rR} ${rL};${bL}${bR}
               ${overdue ? 'box-shadow:0 0 0 1.5px #ff4757 inset;' : ''}"
        onclick="openEditTask('${t.id}')"
        title="${t.title}${t.startDate ? ' | 시작:'+formatDateTime(t.startDate) : ''}${t.deadline ? ' | 마감:'+formatDateTime(t.deadline) : ''}"
      >${isStart ? `<span class="span-label">${t.title}</span>${startTag}${endTag}${progressBadge}` : ''}</div>`;

      // 날별 체크박스 (다중 날 태스크만)
      let checkboxes = '';
      if (isMulti) {
        // 이 주(row)에 표시할 날짜들 (cs~ce에 해당하는 rowDates)
        const rowSlice = rowDates.slice(cs, ce + 1);
        checkboxes = rowSlice.map((rd, i) => {
          // 실제 태스크 범위 안에 있는 날짜인지 확인
          const inRange = rd.ds >= r.start && rd.ds <= r.end;
          if (!inRange) return '';
          const isDayDone = t.dailyDone && t.dailyDone[rd.ds];
          const colIdx    = cs + i;
          const cbLeft    = ((colIdx / 7) * 100 + (1 / 7 * 100) / 2).toFixed(3);

          return `<button class="daily-cbk${isDayDone ? ' cbk-done' : ''}"
            style="top:${cbkTop}px;left:${cbLeft}%;
                   border-color:${color};
                   background:${isDayDone ? color : 'white'};
                   color:${isDayDone ? 'white' : color};"
            onclick="toggleDailyDone('${t.id}','${rd.ds}',event)"
            title="${rd.ds} 완료 체크"
          >${isDayDone ? '✓' : ''}</button>`;
        }).join('');
      }

      return bar + checkboxes;
    }).join('');

    /* "+N개 더" 셀 */
    const moreRow = hasMore ? `<div class="cal-more-row">` +
      rowDates.map((_, i) => hiddenByCol[i] > 0
        ? `<div class="cal-more-cell">+${hiddenByCol[i]}개 더</div>`
        : `<div class="cal-more-cell"></div>`
      ).join('') + `</div>` : '';

    return `<div class="cal-week-row" style="height:${rowH}px" data-week="${weeks.indexOf ? '' : ''}">
      <div class="cal-day-row">${dayCells}</div>
      ${bars}
      ${moreRow}
    </div>`;
  }).join('');

  /* ── 5. 범례 ── */
  const legend = document.getElementById('calLegend');
  legend.innerHTML = state.projects.map(p =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${p.color}"></div>
       <span>${p.name}</span>
     </div>`
  ).join('') + `
    <div class="legend-item">
      <div class="legend-dot" style="background:#ff475720;border:1.5px solid #ff4757"></div>
      <span>기한 초과</span>
    </div>
    <div class="legend-item">
      <span style="font-size:11px;color:#888">▶ 시작일 &nbsp;◀ 마감일</span>
    </div>`;
}

/* ===== 이벤트 연결 ===== */
document.getElementById('openTaskModal').addEventListener('click', openAddTask);
document.getElementById('closeTaskModal').addEventListener('click', () => hideModal('taskModal'));
document.getElementById('cancelTaskBtn').addEventListener('click', () => hideModal('taskModal'));
document.getElementById('saveTaskBtn').addEventListener('click', saveTask);

document.getElementById('addProjectBtn').addEventListener('click', openAddProject);
document.getElementById('closeProjectModal').addEventListener('click', () => hideModal('projectModal'));
document.getElementById('cancelProjectBtn').addEventListener('click', () => hideModal('projectModal'));
document.getElementById('saveProjectBtn').addEventListener('click', saveProject);

document.getElementById('overlay').addEventListener('click', () => {
  hideModal('taskModal');
  hideModal('projectModal');
});

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.currentFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

document.getElementById('sortSelect').addEventListener('change', e => {
  state.currentSort = e.target.value;
  render();
});

// 뷰 모드 전환
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.viewMode = btn.dataset.viewMode;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

// 캘린더 이전/다음 월 (인라인 nav)
function calPrevMonth() {
  if (state.calMonth === 0) { state.calMonth = 11; state.calYear--; }
  else state.calMonth--;
  render();
}
function calNextMonth() {
  if (state.calMonth === 11) { state.calMonth = 0; state.calYear++; }
  else state.calMonth++;
  render();
}
document.getElementById('calPrev2').addEventListener('click', calPrevMonth);
document.getElementById('calNext2').addEventListener('click', calNextMonth);
document.getElementById('calTodayBtn').addEventListener('click', () => {
  const now = new Date();
  state.calYear  = now.getFullYear();
  state.calMonth = now.getMonth();
  render();
});

// Enter 키로 저장
document.getElementById('taskTitle').addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });
document.getElementById('projectName').addEventListener('keydown', e => { if (e.key === 'Enter') saveProject(); });

/* ===== 초기화 ===== */
// 파일 가져오기 이벤트
const importFileEl = document.getElementById('importFile');
if (importFileEl) {
  importFileEl.addEventListener('change', e => {
    importData(e.target.files[0]);
    e.target.value = '';   // 같은 파일 재선택 허용
  });
}

// 앱 시작: 클라우드에서 데이터 로드 후 렌더링
loadData().then(() => render());
