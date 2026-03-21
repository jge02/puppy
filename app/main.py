from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.realtime import chat_manager, notification_manager
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.growth import router as growth_router
from app.routes.match import router as match_router
from app.routes.relationships import router as relationships_router
from app.routes.shop import router as shop_router
from app.routes.social import router as social_router
from app.routes.task_requests import router as task_requests_router
from app.routes.tasks import router as tasks_router

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    chat_manager.bind_loop(asyncio.get_running_loop())
    notification_manager.bind_loop(asyncio.get_running_loop())
    (UPLOADS_DIR / "task-submissions").mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / "match-posts").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Puppy MVP API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://18.219.24.174",
        "http://xiaogou.ink",
        "https://xiaogou.ink",
        "http://www.xiaogou.ink",
        "https://www.xiaogou.ink",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(relationships_router)
app.include_router(task_requests_router)
app.include_router(tasks_router)
app.include_router(chat_router)
app.include_router(match_router)
app.include_router(growth_router)
app.include_router(shop_router)
app.include_router(social_router)
