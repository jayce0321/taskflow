# ⚡ TaskFlow

개인용 프로젝트·할 일 관리 웹 앱. 로컬(SQLite)과 클라우드(PostgreSQL via Railway) 양쪽에서 실시간 자동 저장되며, 모바일에서도 완전히 동작합니다.

**라이브 데모:** https://taskflow-production-462b.up.railway.app

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **자동 저장** | 할 일 추가·수정·삭제 즉시 localStorage + PostgreSQL 이중 저장 |
| **오프라인 지원** | 네트워크 끊김 시 로컬 저장, 재연결 시 자동 동기화 |
| **충돌 방지** | `updatedAt` 타임스탬프로 최신 데이터 자동 선택 |
| **PIN 잠금** | 4자리 PIN(SHA-256 해시), 앱 첫 진입 시 잠금 화면 |
| **프로젝트 분류** | 색상별 프로젝트 생성, 프로젝트 단위 필터링 |
| **캘린더 뷰** | 월간 달력에서 할 일 시각화, "+N개 더" 클릭 시 팝업 확인 |
| **일별 진행 기록** | 다일(多日) 태스크의 날짜별 체크·메모 |
| **데이터 백업** | JSON 내보내기/가져오기 |
| **모바일 반응형** | 햄버거 메뉴, 바텀시트 모달·드로어, 2×2 통계 그리드 |

---

## 기술 스택

```
Frontend  — Vanilla JS (no framework) · CSS Variables · Web Crypto API
Backend   — FastAPI (Python 3.11)
DB (로컬)  — SQLite
DB (클라우드) — PostgreSQL (Railway 플러그인)
배포       — Railway (Nixpacks 자동 빌드)
```

---

## 파일 구조

```
taskflow/
├── index.html        # 단일 페이지 앱 HTML
├── app.js            # 전체 프런트엔드 로직 (~1,400 lines)
├── style.css         # 스타일 (CSS Variables + 미디어 쿼리)
├── server.py         # FastAPI 백엔드 (API + 정적 파일 서빙)
├── requirements.txt  # Python 의존성
├── railway.toml      # Railway 빌드·배포 설정
├── Procfile          # 로컬 실행 명령
└── taskflow.db       # SQLite DB (로컬 전용, .gitignore)
```

---

## 로컬 실행

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. 서버 시작 (기본 포트 8001)
uvicorn server:app --reload --port 8001

# 3. 브라우저에서 접속
open http://localhost:8001
```

> `DATABASE_URL` 환경변수가 없으면 자동으로 SQLite(`taskflow.db`)를 사용합니다.

---

## Railway 배포

### 최초 배포

```bash
# Railway CLI 설치 (미설치 시)
npm install -g @railway/cli

# 로그인 및 프로젝트 연결
railway login
railway link

# PostgreSQL 플러그인 추가 (Railway 대시보드에서 한 번만)
# → 자동으로 DATABASE_URL 환경변수 주입됨

# 배포
railway up --detach
```

### 코드 변경 후 재배포

```bash
git add .
git commit -m "변경 내용 설명"
git push origin main          # GitHub 자동 배포 (활성화된 경우)
railway up --detach           # 또는 직접 업로드
```

### 배포 확인

```bash
curl https://taskflow-production-462b.up.railway.app/api/health
# {"status":"ok","db":"postgresql"}
```

---

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/sync` | 전체 데이터 조회 |
| `POST` | `/api/sync` | 전체 데이터 저장 (덮어쓰기) |
| `GET` | `/api/export` | JSON 파일 다운로드 |
| `GET` | `/api/health` | 헬스체크 (DB 타입 포함) |

### 데이터 형식 (`/api/sync` 페이로드)

```json
{
  "projects": [
    { "id": "p1", "name": "업무", "color": "#ff4757" }
  ],
  "tasks": [
    {
      "id": "t1",
      "title": "태스크 제목",
      "desc": "상세 설명",
      "projectId": "p1",
      "status": "todo",
      "priority": "high",
      "startDate": "2026-06-10T09:00",
      "deadline": "2026-06-10T18:00",
      "dailyDone": { "2026-06-10": true },
      "dailyNotes": { "2026-06-10": "진행 메모" },
      "createdAt": 1718000000000,
      "updatedAt": 1718000000000
    }
  ],
  "updatedAt": 1718000000000
}
```

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | Railway 배포 시 필수 | PostgreSQL 연결 문자열 (Railway가 자동 주입) |
| `PORT` | 선택 | 서버 포트 (기본값: `8001`) |
| `DB_PATH` | 선택 | SQLite 파일 경로 (기본: `./taskflow.db`) |

---

## 브레이크포인트

| 범위 | 레이아웃 |
|------|----------|
| `≤ 768px` | 모바일 — 사이드바 오버레이, 바텀시트 모달/드로어, 2×2 통계 |
| `769px ~ 1024px` | 태블릿 — 사이드바 200px, 여백 조정 |
| `≥ 1025px` | 데스크탑 — 사이드바 240px 고정 |

---

## 커밋 히스토리 요약

```
9a74886  fix: CSS 캐시 버스팅 쿼리 추가
c8e4d47  feat: 모바일 반응형 레이아웃 완성
f286605  feat: 캘린더 +N개 더 → 날짜 태스크 팝업
25fe86c  feat: 자동 저장 안정성 강화 + 드로어 상태 빠른 변경
8c35fd1  feat: PIN 잠금 — 첫 화면 표시, 키패드 확대
db106b5  feat: 4자리 PIN 잠금 기능 추가
0555059  feat: PostgreSQL 지원 — Railway 클라우드 동기화
ea1c361  feat: 태스크 상세 드로어 + 일별 진행 기록
447af30  feat: 할 일에 시작 시간 필드 추가
c25f171  feat: FastAPI + SQLite 클라우드 동기화 버전 전환
```
