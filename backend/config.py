import os

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info").lower()
ROOM_TIMEOUT_SECONDS = int(os.getenv("ROOM_TIMEOUT_SECONDS", "3600"))  # 1 hour
APP_VERSION = "1.0.0"
