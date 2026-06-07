/* ===== 데이터 ===== */
const COLORS = ['#6c63ff','#ff4757','#ffa502','#2ed573','#1e90ff','#ff6b81','#eccc68','#a29bfe','#fd79a8','#00b894'];

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

function load() {
  const saved = localStorage.getItem('taskflow_v2');
  if (saved) {
    const parsed = JSON.parse(saved);
    state.projects = parsed.projects || [];
    state.tasks = parsed.tasks || [];
  } else {
    // 샘플 데이터
    state.projects = [
      { id: uid(), name: '개인', color: '#6c63ff' },
      { id: uid(), name: '업무', color: '#ff4757' },
    ];
    const today = dateStr(0);
    const p1 = state.projects[0].id;
    const p2 = state.projects[1].id;
    state.tasks = [
      { id: uid(), title: 'Claude Code 사용법 익히기', desc: '기본 명령어와 워크플로우 학습', projectId: p1, status: 'doing', priority: 'high', startDate: dateStr(-1), deadline: today, createdAt: Date.now() - 2000 },
      { id: uid(), title: 'GitHub 레포 만들기', desc: '첫 번째 프로젝트 레포지토리 생성', projectId: p1, status: 'todo', priority: 'medium', startDate: today, deadline: dateStr(2), createdAt: Date.now() - 1000 },
      { id: uid(), title: '주간 보고서 작성', desc: '', projectId: p2, status: 'todo', priority: 'high', startDate: '', deadline: dateStr(-1), createdAt: Date.now() },
      { id: uid(), title: '팀 미팅 자료 준비', desc: '', projectId: p2, status: 'done', priority: 'low', startDate: '', deadline: '', createdAt: Date.now() },
    ];
  }
}

function save() {
  localStorage.setItem('taskflow_v2', JSON.stringify({ projects: state.projects, tasks: state.tasks }));
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function today() { return dateStr(0); }

function isOverdue(task) {
  return task.deadline && task.deadline < today() && task.status !== 'done';
}

function isToday(task) {
  return task.deadline === today() && task.status !== 'done';
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
  if (state.viewMode === 'calendar') {
    document.getElementById('taskBoard').classList.add('hidden');
    document.getElementById('calendarView').classList.remove('hidden');
    document.getElementById('sortSelect').style.display = 'none';
    renderCalendar();
  } else {
    document.getElementById('taskBoard').classList.remove('hidden');
    document.getElementById('calendarView').classList.add('hidden');
    document.getElementById('sortSelect').style.display = '';
    renderBoard();
  }
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
    const overdue = isOverdue(t);
    const todayTask = isToday(t);
    const deadlineClass = overdue ? 'overdue' : todayTask ? 'today' : '';
    const deadlineLabel = overdue ? '⚠️ 기한 초과' : todayTask ? '📅 오늘 마감' : '';

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
            ${t.deadline ? `<span class="task-date ${deadlineClass}">🗓 ${t.deadline}${deadlineLabel ? ' · ' + deadlineLabel : ''}</span>` : ''}
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

/* ===== 캘린더 렌더링 (스팬 방식) ===== */

// 날짜 문자열 → Date 객체 (로컬 시간 기준)
function parseDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date → 'YYYY-MM-DD'
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function renderCalendar() {
  const year = state.calYear;
  const month = state.calMonth;
  const todayStr = today();

  document.getElementById('calTitle').textContent = `${year}년 ${month + 1}월`;

  // 달력 셀 배열 (42칸 = 6주)
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
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
    const d = new Date(year, month + 1, dates.length - startOffset - lastDay.getDate() + 1);
    dates.push({ ds: toDateStr(d), date: d, thisMonth: false });
  }

  // 달력 범위
  const calStart = dates[0].ds;
  const calEnd   = dates[41].ds;

  // 각 태스크의 표시 범위 계산
  // startDate 없으면 deadline 하루짜리, deadline 없으면 startDate 하루짜리
  function getTaskRange(t) {
    const s = t.startDate || t.deadline;
    const e = t.deadline || t.startDate;
    if (!s) return null;
    return { start: s, end: e };
  }

  // 달력에 표시할 태스크 (범위가 달력과 겹치는 것만)
  const visibleTasks = state.tasks.filter(t => {
    const r = getTaskRange(t);
    if (!r) return false;
    return r.end >= calStart && r.start <= calEnd;
  });

  // 주(row)별로 태스크 레이아웃 계산
  // rows[0..5] = 각 주의 태스크 배치 { task, colStart(0-6), colSpan(1-7), lane, isStart, isEnd }
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const rowDates = dates.slice(w * 7, w * 7 + 7);
    const rowStart = rowDates[0].ds;
    const rowEnd   = rowDates[6].ds;

    // 이 주에 걸치는 태스크
    const rowTasks = visibleTasks
      .filter(t => {
        const r = getTaskRange(t);
        return r && r.end >= rowStart && r.start <= rowEnd;
      })
      .sort((a, b) => {
        const ra = getTaskRange(a), rb = getTaskRange(b);
        if (ra.start !== rb.start) return ra.start.localeCompare(rb.start);
        return rb.end.localeCompare(ra.end); // 더 긴 것 먼저
      });

    // 레인 배치 (겹치지 않게)
    const lanes = []; // lanes[i] = 해당 레인의 마지막 colEnd
    const placements = rowTasks.map(t => {
      const r = getTaskRange(t);
      const colStart = Math.max(0, rowDates.findIndex(d => d.ds === r.start));
      const rawStart = rowDates.findIndex(d => d.ds >= r.start);
      const cs = rawStart < 0 ? 0 : rawStart;
      const rawEnd = rowDates.findLastIndex(d => d.ds <= r.end);
      const ce = rawEnd < 0 ? 6 : rawEnd;
      const colSpan = ce - cs + 1;

      // 레인 할당
      let lane = lanes.findIndex(laneEnd => laneEnd < cs);
      if (lane === -1) { lane = lanes.length; }
      lanes[lane] = ce;

      return {
        task: t,
        colStart: cs,
        colSpan,
        lane,
        isStart: r.start >= rowStart,
        isEnd: r.end <= rowEnd,
      };
    });

    weeks.push({ rowDates, placements });
  }

  // HTML 생성
  const grid = document.getElementById('calGrid');
  const LANE_H = 24; // px per lane
  const DAY_H  = 36; // px for day number area

  grid.innerHTML = weeks.map(({ rowDates, placements }) => {
    const maxLane = placements.length > 0 ? Math.max(...placements.map(p => p.lane)) : -1;
    const rowH = DAY_H + (maxLane + 1) * LANE_H + 8;

    // 날짜 셀들
    const dayCells = rowDates.map(({ ds, date, thisMonth }) => {
      const isToday_  = ds === todayStr;
      const dow = date.getDay();
      const classes = [
        'cal-day-cell',
        !thisMonth ? 'other-month' : '',
        isToday_  ? 'today-cell' : '',
        dow === 0 ? 'sunday' : '',
        dow === 6 ? 'saturday' : '',
      ].filter(Boolean).join(' ');

      return `<div class="${classes}" style="height:${rowH}px">
        <div class="cal-day-num">${date.getDate()}</div>
      </div>`;
    }).join('');

    // 태스크 스팬 바들
    const bars = placements.map(({ task: t, colStart, colSpan, lane, isStart, isEnd }) => {
      const proj  = state.projects.find(p => p.id === t.projectId);
      const color = proj ? proj.color : '#a29bfe';
      const overdue = isOverdue(t);
      const done    = t.status === 'done';

      const top  = DAY_H + lane * LANE_H;
      const left = `calc(${colStart} * (100% / 7))`;
      const width = `calc(${colSpan} * (100% / 7) - 4px)`;

      const borderR = isEnd   ? '6px' : '0';
      const borderL = isStart ? '6px' : '0';

      // 라벨: 시작칸이거나 첫 번째 칸에만 표시
      const label = `
        <span class="span-label">${t.title}</span>
        ${isStart && t.startDate ? `<span class="span-date-tag">▶ ${t.startDate.slice(5)}</span>` : ''}
        ${isEnd && t.deadline ? `<span class="span-date-tag end-tag">◀ ${t.deadline.slice(5)}</span>` : ''}
      `;

      return `
        <div class="cal-span-bar ${done ? 'bar-done' : ''} ${overdue ? 'bar-overdue' : ''}"
          style="
            top:${top}px;
            left:${left};
            width:${width};
            background:${color}${done ? '33' : '22'};
            border:1.5px solid ${color}${overdue ? ';outline:1.5px solid #ff4757' : ''};
            color:${color};
            border-radius:${borderL} ${borderR} ${borderR} ${borderL};
            ${!isStart ? 'border-left:none;' : ''}
            ${!isEnd   ? 'border-right:none;' : ''}
          "
          onclick="openEditTask('${t.id}')"
          title="${t.title}${t.startDate ? ' | 시작: ' + t.startDate : ''}${t.deadline ? ' | 마감: ' + t.deadline : ''}"
        >${isStart ? label : ''}</div>`;
    }).join('');

    return `
      <div class="cal-week-row" style="position:relative;height:${rowH}px">
        <div class="cal-day-row">${dayCells}</div>
        ${bars}
      </div>`;
  }).join('');

  // 범례
  const legend = document.getElementById('calLegend');
  legend.innerHTML = state.projects.map(p =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${p.color}"></div>
      <span>${p.name}</span>
    </div>`
  ).join('') + `
    <div class="legend-item">
      <div class="legend-dot" style="outline:2px solid #ff4757;background:#ff475722"></div>
      <span>기한 초과</span>
    </div>
    <div class="legend-item" style="gap:8px">
      <span style="font-size:11px">▶ 시작일 &nbsp; ◀ 마감일</span>
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

// 캘린더 이전/다음 월
document.getElementById('calPrev').addEventListener('click', () => {
  if (state.calMonth === 0) { state.calMonth = 11; state.calYear--; }
  else state.calMonth--;
  render();
});
document.getElementById('calNext').addEventListener('click', () => {
  if (state.calMonth === 11) { state.calMonth = 0; state.calYear++; }
  else state.calMonth++;
  render();
});

// Enter 키로 저장
document.getElementById('taskTitle').addEventListener('keydown', e => { if (e.key === 'Enter') saveTask(); });
document.getElementById('projectName').addEventListener('keydown', e => { if (e.key === 'Enter') saveProject(); });

/* ===== 초기화 ===== */
load();
render();
