from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# Client to Server Messages
class ClientMessage(BaseModel):
    type: str
    username: Optional[str] = None
    room_code: Optional[str] = None
    move: Optional[str] = None          # e.g., "e2e4" or "e7e8q"
    square: Optional[str] = None        # e.g., "e2" for get_legal_moves
    reason: Optional[str] = None

# Server to Client Messages
class ServerMessage(BaseModel):
    type: str
    room_code: Optional[str] = None
    color: Optional[str] = None         # "white" | "black"
    white: Optional[str] = None
    black: Optional[str] = None
    opponent: Optional[str] = None
    fen: Optional[str] = None
    turn: Optional[str] = None          # "white" | "black"
    last_move: Optional[Dict[str, str]] = None  # {"from": "e2", "to": "e4", "san": "e4"}
    legal_moves: Optional[List[Dict[str, Any]]] = None  # [{"to": "e4", "is_capture": False}]
    history: Optional[List[str]] = None
    captured_white: Optional[List[str]] = None
    captured_black: Optional[List[str]] = None
    is_check: Optional[bool] = False
    result: Optional[str] = None        # "checkmate" | "stalemate" | "resignation" | "draw"
    winner: Optional[str] = None        # "white" | "black" | "draw"
    reason: Optional[str] = None
    message: Optional[str] = None
