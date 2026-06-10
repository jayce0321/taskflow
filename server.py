"""TaskFlow 백엔드 — FastAPI + SQLite 클라우드 동기화"""
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pathlib import Path
import json, os, sqlite3

app  = FastAPI(title="TaskFlow")
BASE = Path(__file__).parent
DB   = Path(os.environ.get("DB_PATH", str(BASE / "taskflow.db")))


# ── DB 초기화 ────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS store (
                key TEXT PRIMARY KEY,
                val TEXT NOT NULL
            )
        """)
        c.commit()

init_db()


# ── API ─────────────────────────────────────────────────────────
@app.get("/api/sync")
def api_get():
    """저장된 데이터 전체 반환"""
    with get_db() as c:
        row = c.execute("SELECT val FROM store WHERE key='data'").fetchone()
    if row:
        return JSONResponse(json.loads(row["val"]))
    return JSONResponse({"projects": [], "tasks": []})


@app.post("/api/sync")
async def api_post(req: Request):
    """데이터 전체 저장 (덮어쓰기)"""
    body = await req.json()
    with get_db() as c:
        c.execute(
            "INSERT OR REPLACE INTO store VALUES ('data', ?)",
            [json.dumps(body, ensure_ascii=False)]
        )
        c.commit()
    return {"ok": True}


@app.get("/api/export")
def api_export():
    """데이터 JSON 파일로 내보내기"""
    with get_db() as c:
        row = c.execute("SELECT val FROM store WHERE key='data'").fetchone()
    data = json.loads(row["val"]) if row else {"projects": [], "tasks": []}
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=taskflow_backup.json"}
    )


# ── 정적 파일 서빙 ────────────────────────────────────────────────
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
