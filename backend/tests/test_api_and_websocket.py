import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_http_endpoints():
    # Health check
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "version" in data

    # Active games
    res = client.get("/api/active-games")
    assert res.status_code == 200
    data = res.json()
    assert "active_games" in data
    assert "total_rooms" in data

    # Serve index.html
    res = client.get("/")
    assert res.status_code == 200
    assert "<title>CloudChess" in res.text

    # Serve CSS
    res = client.get("/static/css/style.css")
    assert res.status_code == 200
    assert "chess-board" in res.text

    # Serve SVG piece
    res = client.get("/static/assets/pieces/wK.svg")
    assert res.status_code == 200
    assert "<svg" in res.text

def test_websocket_e2e_gameplay():
    with client.websocket_connect("/ws") as ws1:
        # Player 1 creates game
        ws1.send_json({"type": "create_game", "username": "Alice"})
        created_msg = ws1.receive_json()
        assert created_msg["type"] == "game_created"
        room_code = created_msg["room_code"]
        assert len(room_code) >= 4
        assert created_msg["color"] == "white"

        # Player 2 joins game
        with client.websocket_connect("/ws") as ws2:
            ws2.send_json({"type": "join_game", "username": "Bob", "room_code": room_code})
            joined_msg = ws2.receive_json()
            assert joined_msg["type"] == "game_joined"
            assert joined_msg["color"] == "black"
            assert joined_msg["opponent"] == "Alice"

            # Player 1 receives opponent_joined and game_start
            opp_joined = ws1.receive_json()
            assert opp_joined["type"] == "opponent_joined"
            assert opp_joined["opponent"] == "Bob"

            start_msg1 = ws1.receive_json()
            assert start_msg1["type"] == "game_start"

            start_msg2 = ws2.receive_json()
            assert start_msg2["type"] == "game_start"

            # Player 1 requests legal moves for square "e2"
            ws1.send_json({"type": "get_legal_moves", "square": "e2"})
            hints = ws1.receive_json()
            assert hints["type"] == "legal_moves"
            assert hints["square"] == "e2"
            assert len(hints["moves"]) == 2

            # Player 1 executes move "e2e4"
            ws1.send_json({"type": "move", "move": "e2e4"})
            move1_for_p1 = ws1.receive_json()
            assert move1_for_p1["type"] == "move_made"
            assert move1_for_p1["turn"] == "black"
            assert move1_for_p1["move"]["san"] == "e4"

            move1_for_p2 = ws2.receive_json()
            assert move1_for_p2["type"] == "move_made"
            assert move1_for_p2["turn"] == "black"

            # Player 2 executes move "e7e5"
            ws2.send_json({"type": "move", "move": "e7e5"})
            move2_for_p1 = ws1.receive_json()
            assert move2_for_p1["type"] == "move_made"
            assert move2_for_p1["turn"] == "white"

            move2_for_p2 = ws2.receive_json()
            assert move2_for_p2["type"] == "move_made"

            # Player 2 resigns
            ws2.send_json({"type": "resign"})
            over_for_p1 = ws1.receive_json()
            assert over_for_p1["type"] == "game_over"
            assert over_for_p1["winner"] == "white"
            assert over_for_p1["result"] == "resignation"

            over_for_p2 = ws2.receive_json()
            assert over_for_p2["type"] == "game_over"
            assert over_for_p2["winner"] == "white"
