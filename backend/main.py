import os
import logging
from pathlib import Path
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import config
from room import RoomManager
from websocket import WebSocketHandler

# Configure structured logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO),
    format="[%(asctime)s] %(levelname)s [%(name)s]: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("cloudchess.main")

app = FastAPI(
    title="CloudChess API",
    description="Real-time Multiplayer Chess Platform API",
    version=config.APP_VERSION
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

room_manager = RoomManager()
ws_handler = WebSocketHandler(room_manager)

# REST API endpoints
@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "version": config.APP_VERSION,
        "active_games": room_manager.count_active_games()
    }

@app.get("/api/active-games")
async def get_active_games():
    return {
        "active_games": room_manager.count_active_games(),
        "total_rooms": room_manager.count_total_rooms()
    }

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_handler.handle_connection(websocket)

# Frontend static files mounting
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "CloudChess Backend Running. Frontend index.html not found."}

    # Catch-all for assets if accessed directly
    @app.get("/{filename:path}")
    async def serve_frontend_assets(filename: str):
        target = FRONTEND_DIR / filename
        if target.exists() and target.is_file():
            return FileResponse(str(target))
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"error": "Not found"}
else:
    logger.warning(f"Frontend directory not found at {FRONTEND_DIR}")

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting CloudChess server on {config.HOST}:{config.PORT} (v{config.APP_VERSION})")
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, log_level=config.LOG_LEVEL, reload=False)
