# CloudChess — Application Specification

> **This file is the contract between the app builder (AI agent) and the infra engineer (Trush).**
> The AI agent builds the frontend and backend according to this spec.
> Trush handles everything from Docker onwards.

---

## App Concept

**Quick-play online chess.** No sign-ups, no accounts, no login.

1. Player opens the site
2. Enters a display username (anything, e.g. "trush")
3. Either **creates a new game** (gets a 4-6 character room code like "ABCD") or **joins an existing game** (enters a room code)
4. Two players in a room play chess in real time via WebSocket
5. Multiple games can run simultaneously (each room is independent)
6. When the game ends (checkmate, stalemate, draw, resignation), both players see the result
7. Players can start a new game after finishing

**No database.** Game state lives in server memory. When the server restarts, active games are lost. This is intentional — it's a quick-play platform, not a competitive ranking system.

---

## Tech Stack (MUST follow exactly)

### Frontend

| Item | Choice | Reason |
|------|--------|--------|
| Language | **Plain HTML + CSS + JavaScript** | No framework. Must be simple, static files. Easy to serve and deploy. |
| Chess board rendering | **Custom CSS grid or chessboard.js** | Lightweight, no heavy dependencies |
| Communication | **WebSocket (native browser API)** | `new WebSocket('ws://...')` — no Socket.IO |
| Build tools | **None** | No webpack, no npm build step. Just raw HTML/CSS/JS files. |

**Frontend files go in:** `frontend/`

```
frontend/
├── index.html          — main page (lobby + game)
├── css/
│   └── style.css       — all styles
├── js/
│   ├── app.js          — main app logic (lobby, room management)
│   ├── chess-game.js   — chess board rendering and interaction
│   └── websocket.js    — WebSocket connection handling
└── assets/
    └── pieces/         — chess piece images (SVG preferred)
```

### Backend

| Item | Choice | Reason |
|------|--------|--------|
| Language | **Python 3.11+** | Standard for cloud/DevOps environments |
| Framework | **FastAPI** | Built-in WebSocket support, async, modern |
| ASGI server | **uvicorn** | Production-ready, works with FastAPI |
| Chess logic | **python-chess** | Handles move validation, check/checkmate/stalemate detection |
| Database | **None initially** | Game state in-memory (Python dict). DB added later by infra engineer for RDS learning. |
| Static file serving | **FastAPI StaticFiles** | Backend serves frontend files too — single container deployment |

**Backend files go in:** `backend/`

```
backend/
├── main.py             — FastAPI app, routes, static file mount
├── game.py             — chess game logic (using python-chess)
├── room.py             — room manager (create, join, list active rooms)
├── websocket.py        — WebSocket connection handler
├── models.py           — data models (Pydantic)
├── requirements.txt    — Python dependencies
└── config.py           — configuration (port, host, etc.)
```

---

## Detailed Requirements

### Lobby Page

- Input field: "Enter your username"
- Button: "Create Game" → creates a room, shows room code
- Input field: "Enter Room Code"
- Button: "Join Game" → joins existing room
- Show the room code prominently so the host can share it
- Optionally show count of active games

### Chess Game Page

- 8x8 chess board with pieces
- Pieces are draggable or click-to-move (either approach is fine)
- Show whose turn it is
- Show player names (white / black) and their usernames
- Highlight legal moves when a piece is selected
- Show last move (highlight the from/to squares)
- Show game status: "Your turn", "Waiting for opponent", "Check!", "Checkmate — White wins", etc.
- Resign button
- "New Game" button (after game ends)

### Game Rules (enforced by backend)

- Standard chess rules
- White moves first
- Only legal moves are accepted (validated by python-chess on the backend)
- Game ends on: checkmate, stalemate, insufficient material, resignation
- Draw by agreement is NOT required (keep it simple)
- No timers/clock for now (can be added later)

### WebSocket Protocol

All messages are JSON.

**Client → Server:**

```json
{"type": "create_game", "username": "trush"}
{"type": "join_game", "username": "ravi", "room_code": "ABCD"}
{"type": "move", "from": "e2", "to": "e4"}
{"type": "resign"}
```

**Server → Client:**

```json
{"type": "game_created", "room_code": "ABCD", "color": "white"}
{"type": "game_joined", "room_code": "ABCD", "color": "black", "opponent": "trush"}
{"type": "opponent_joined", "opponent": "ravi"}
{"type": "game_start", "white": "trush", "black": "ravi"}
{"type": "move_made", "from": "e2", "to": "e4", "fen": "...", "turn": "black"}
{"type": "invalid_move", "reason": "Not your turn"}
{"type": "game_over", "result": "checkmate", "winner": "white"}
{"type": "opponent_disconnected"}
{"type": "opponent_reconnected"}
{"type": "error", "message": "Room not found"}
```

### Backend API Endpoints

```
GET  /                          → serves frontend (index.html)
GET  /static/...                → serves CSS/JS/assets
WS   /ws                        → WebSocket endpoint
GET  /api/health                → {"status": "ok"} (for health checks later)
GET  /api/active-games          → {"count": 5} (optional, for lobby display)
```

### In-Memory State Structure

```python
rooms = {
    "ABCD": {
        "white": {"username": "trush", "ws": <WebSocket>},
        "black": {"username": "ravi", "ws": <WebSocket>},
        "board": chess.Board(),
        "status": "playing",  # waiting, playing, finished
        "created_at": datetime
    }
}
```

- Room code: random 4-character uppercase string (e.g., "ABCD", "XK9F")
- Room is deleted from memory when both players disconnect after game ends
- Room in "waiting" status = host is waiting for opponent

---

## Configuration

The app must read these from **environment variables** (important for Docker/cloud deployment later):

```
HOST=0.0.0.0          — bind address
PORT=8000              — port to run on
LOG_LEVEL=info         — logging level
```

Default values should work without any .env file (so it runs out of the box).

---

## How to Run Locally

The app must be runnable with:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Then open `http://localhost:8000` in the browser.

**No npm install, no build step, no database setup needed.**

---

## requirements.txt

```
fastapi>=0.104.0
uvicorn>=0.24.0
python-chess>=1.999
websockets>=12.0
pydantic>=2.0
```

---

## Code Quality Rules

1. **Clean, readable code** — proper variable names, functions, docstrings
2. **Structured logging** — use Python `logging` module, not `print()`
3. **Error handling** — handle WebSocket disconnects, invalid moves, invalid room codes gracefully
4. **No hardcoded values** — use config.py / environment variables
5. **Separation of concerns** — game logic, room management, WebSocket handling, and API routes in separate files

---

## What the App Does NOT Need

- ❌ User registration / login / authentication
- ❌ Database (no PostgreSQL, no SQLite, nothing)
- ❌ Session management / cookies / JWT
- ❌ Password hashing
- ❌ Email verification
- ❌ Profile pages
- ❌ ELO rating system
- ❌ Game history (will be added later by infra engineer for RDS learning)
- ❌ Chat between players (keep it simple)
- ❌ Spectator mode
- ❌ AI opponent
- ❌ Timer/clock
- ❌ Any frontend build tools (webpack, vite, etc.)
- ❌ TypeScript
- ❌ Any CSS framework (Bootstrap, Tailwind) — write custom CSS
- ❌ Socket.IO — use native WebSocket only

---

## Success Criteria

The app is done when:

1. ✅ Open `http://localhost:8000` → see the lobby page
2. ✅ Enter username, click "Create Game" → get a room code
3. ✅ Open another tab, enter username and room code, click "Join" → both see the chess board
4. ✅ Play a complete game of chess with legal moves only
5. ✅ Checkmate/stalemate/resignation ends the game properly
6. ✅ Open 2 more tabs → create another game → both games run simultaneously
7. ✅ Close a tab → opponent sees "disconnected" message
8. ✅ `GET /api/health` returns `{"status": "ok"}`
9. ✅ All code is clean, well-structured, and documented
