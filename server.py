"""TaskFlow 백엔드 — FastAPI + SQLite(로컬) / PostgreSQL(Railway 클라우드)

DATABASE_URL 환경변수가 있으면 PostgreSQL, 없으면 SQLite로 동작한다.
Railway에서 PostgreSQL 플러그인을 추가하면 DATABASE_URL이 자동으로 주입된다.
"""
import os, json
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TaskFlow")
BASE = Path(__file__).parent

# ── CORS (다른 도메인에서 API 호출 허용) ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── 데이터베이스 추상화 ──────────────────────────────────────────────
_DATABASE_URL = os.environ.get("DATABASE_URL", "")

if _DATABASE_URL:
    # ── PostgreSQL (Railway 배포 환경) ──
    import psycopg2
    import psycopg2.pool

    # Railway는 "postgres://" 형식을 쓰기도 함 → "postgresql://"로 통일
    _pg_url = _DATABASE_URL.replace("postgres://", "postgresql://", 1)
    _pool = psycopg2.pool.SimpleConnectionPool(1, 5, _pg_url)

    def _pg_conn():
        return _pool.getconn()

    def _pg_ret(conn):
        _pool.putconn(conn)

    def init_db():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS store (
                        key TEXT PRIMARY KEY,
                        val TEXT NOT NULL
                    )
                """)
            conn.commit()
        finally:
            _pg_ret(conn)

    def db_get() -> dict:
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT val FROM store WHERE key='data'")
                row = cur.fetchone()
            return json.loads(row[0]) if row else {"projects": [], "tasks": []}
        finally:
            _pg_ret(conn)

    def db_set(data: dict):
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO store (key, val) VALUES ('data', %s)
                       ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val""",
                    [json.dumps(data, ensure_ascii=False)]
                )
            conn.commit()
        finally:
            _pg_ret(conn)

    DB_TYPE = "postgresql"

else:
    # ── SQLite (로컬 개발 환경) ──
    import sqlite3
    _DB = Path(os.environ.get("DB_PATH", str(BASE / "taskflow.db")))

    def _sqlite_conn():
        conn = sqlite3.connect(str(_DB))
        conn.row_factory = sqlite3.Row
        return conn

    def init_db():
        with _sqlite_conn() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS store (
                    key TEXT PRIMARY KEY,
                    val TEXT NOT NULL
                )
            """)
            c.commit()

    def db_get() -> dict:
        with _sqlite_conn() as c:
            row = c.execute("SELECT val FROM store WHERE key='data'").fetchone()
        return json.loads(row["val"]) if row else {"projects": [], "tasks": []}

    def db_set(data: dict):
        with _sqlite_conn() as c:
            c.execute(
                "INSERT OR REPLACE INTO store VALUES ('data', ?)",
                [json.dumps(data, ensure_ascii=False)]
            )
            c.commit()

    DB_TYPE = "sqlite"

init_db()


# ── API ─────────────────────────────────────────────────────────────
@app.get("/api/sync")
def api_get():
    """저장된 데이터 전체 반환"""
    return JSONResponse(db_get())


@app.post("/api/sync")
async def api_post(req: Request):
    """데이터 전체 저장 (덮어쓰기)"""
    body = await req.json()
    db_set(body)
    return {"ok": True}


@app.get("/api/export")
def api_export():
    """데이터 JSON 파일로 내보내기"""
    data = db_get()
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=taskflow_backup.json"}
    )


@app.get("/api/health")
def api_health():
    """헬스체크 — DB 타입 및 연결 상태 반환"""
    try:
        db_get()
        return {"status": "ok", "db": DB_TYPE}
    except Exception as e:
        return JSONResponse({"status": "error", "db": DB_TYPE, "detail": str(e)}, status_code=500)


# ── 정적 파일 서빙 ───────────────────────────────────────────────────
@app.get("/")
@app.get("/index.html")
def root():
    return FileResponse(BASE / "index.html")

@app.get("/style.css")
def css():
    return FileResponse(BASE / "style.css", media_type="text/css")

@app.get("/app.js")
def js():
    return FileResponse(BASE / "app.js", media_type="application/javascript")
