import time
import random
import string
from typing import Optional, Dict, Any, Tuple
from fastapi import WebSocket
from game import ChessGame

# Avoid visually ambiguous characters: O, 0, I, 1
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

class Player:
    def __init__(self, username: str, color: str, websocket: WebSocket):
        self.username = username
        self.color = color
        self.ws = websocket
        self.connected = True
        self.disconnected_at: Optional[float] = None

class Room:
    def __init__(self, code: str, host_username: str, host_ws: WebSocket):
        self.code = code
        self.game = ChessGame()
        self.white_player: Optional[Player] = Player(host_username, "white", host_ws)
        self.black_player: Optional[Player] = None
        self.status = "waiting"     # "waiting", "playing", "finished"
        self.created_at = time.time()
        self.last_activity = time.time()
        self.rematch_requests = set()   # colors requesting rematch: {"white", "black"}

    def join(self, username: str, ws: WebSocket) -> Tuple[bool, Optional[str]]:
        self.last_activity = time.time()
        if self.black_player is not None and self.black_player.connected:
            return False, "Room is full"
        
        # If black slot was empty or previous black disconnected and this is a new join
        self.black_player = Player(username, "black", ws)
        self.status = "playing"
        return True, None

    def reconnect(self, username: str, ws: WebSocket) -> Optional[str]:
        """Reconnect existing player by username if disconnected."""
        self.last_activity = time.time()
        if self.white_player and self.white_player.username == username:
            self.white_player.ws = ws
            self.white_player.connected = True
            self.white_player.disconnected_at = None
            return "white"
        if self.black_player and self.black_player.username == username:
            self.black_player.ws = ws
            self.black_player.connected = True
            self.black_player.disconnected_at = None
            return "black"
        return None

    def mark_disconnected(self, ws: WebSocket) -> Optional[str]:
        """Mark player disconnected by WebSocket reference. Returns player color."""
        self.last_activity = time.time()
        if self.white_player and self.white_player.ws == ws:
            self.white_player.connected = False
            self.white_player.disconnected_at = time.time()
            return "white"
        if self.black_player and self.black_player.ws == ws:
            self.black_player.connected = False
            self.black_player.disconnected_at = time.time()
            return "black"
        return None

    def get_player_by_ws(self, ws: WebSocket) -> Optional[Player]:
        if self.white_player and self.white_player.ws == ws:
            return self.white_player
        if self.black_player and self.black_player.ws == ws:
            return self.black_player
        return None

    def get_opponent(self, player_color: str) -> Optional[Player]:
        if player_color == "white":
            return self.black_player
        return self.white_player

    def request_rematch(self, player_color: str) -> bool:
        """Add rematch request. Returns True if both players agreed and game was reset."""
        self.rematch_requests.add(player_color)
        if len(self.rematch_requests) >= 2:
            # Swap colors for rematch
            white_user = self.white_player.username if self.white_player else "Player 1"
            white_ws = self.white_player.ws if self.white_player else None
            black_user = self.black_player.username if self.black_player else "Player 2"
            black_ws = self.black_player.ws if self.black_player else None

            # New game instance
            self.game = ChessGame()
            if black_ws:
                self.white_player = Player(black_user, "white", black_ws)
            if white_ws:
                self.black_player = Player(white_user, "black", white_ws)
            
            self.status = "playing"
            self.rematch_requests.clear()
            self.last_activity = time.time()
            return True
        return False

    def is_empty(self) -> bool:
        w_conn = self.white_player.connected if self.white_player else False
        b_conn = self.black_player.connected if self.black_player else False
        return not w_conn and not b_conn


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def generate_code(self) -> str:
        for _ in range(100):
            code = "".join(random.choices(CODE_ALPHABET, k=4))
            if code not in self.rooms:
                return code
        # Fallback to 5 chars if collision
        return "".join(random.choices(CODE_ALPHABET, k=5))

    def create_room(self, host_username: str, host_ws: WebSocket) -> Room:
        code = self.generate_code()
        room = Room(code, host_username, host_ws)
        self.rooms[code] = room
        return room

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code.upper().strip())

    def remove_room(self, code: str):
        self.rooms.pop(code.upper().strip(), None)

    def cleanup_stale_rooms(self, max_age_seconds: int = 3600):
        now = time.time()
        to_delete = []
        for code, room in self.rooms.items():
            # If room idle for longer than max_age or both disconnected for > 5 minutes
            if now - room.last_activity > max_age_seconds or (room.is_empty() and now - room.last_activity > 300):
                to_delete.append(code)
        for code in to_delete:
            self.remove_room(code)

    def count_active_games(self) -> int:
        return sum(1 for room in self.rooms.values() if room.status == "playing")

    def count_total_rooms(self) -> int:
        return len(self.rooms)
