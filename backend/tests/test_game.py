import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
import chess
from game import ChessGame
from room import RoomManager, Room

def test_initial_state():
    game = ChessGame()
    assert game.turn == "white"
    assert not game.game_over
    assert not game.is_check
    assert len(game.move_history) == 0
    # 16 pawn moves + 4 knight moves = 20 legal moves in starting position
    assert len(list(game.board.legal_moves)) == 20

def test_legal_moves_hints():
    game = ChessGame()
    # e2 pawn has e3 and e4
    e2_moves = game.get_legal_moves_for_square("e2")
    assert len(e2_moves) == 2
    targets = {m["to"] for m in e2_moves}
    assert targets == {"e3", "e4"}
    assert all(not m["is_capture"] for m in e2_moves)

    # e7 is black pawn, but it's white's turn -> should return empty
    e7_moves = game.get_legal_moves_for_square("e7")
    assert len(e7_moves) == 0

def test_make_valid_move():
    game = ChessGame()
    success, err = game.make_move("e2e4")
    assert success
    assert err is None
    assert game.turn == "black"
    assert game.move_history == ["e4"]
    assert game.last_move["from"] == "e2"
    assert game.last_move["to"] == "e4"

def test_illegal_move():
    game = ChessGame()
    # Invalid move format
    success, err = game.make_move("invalid")
    assert not success

    # Illegal chess move
    success, err = game.make_move("e2e5")
    assert not success
    assert "Illegal" in err

    # Black piece moving on white turn
    success, err = game.make_move("e7e5")
    assert not success

def test_scholars_mate():
    game = ChessGame()
    # Scholar's mate moves: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    moves = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"]
    for m in moves:
        ok, err = game.make_move(m)
        assert ok, f"Move {m} failed: {err}"

    assert game.game_over
    assert game.result == "checkmate"
    assert game.winner == "white"
    assert game.is_check
    assert "Qxf7#" in game.move_history[-1]

def test_pawn_promotion():
    game = ChessGame()
    # Setup custom FEN near promotion
    game.board = chess.Board("8/4P3/8/8/8/8/8/k1K5 w - - 0 1")
    ok, err = game.make_move("e7e8q")
    assert ok
    piece = game.board.piece_at(chess.E8)
    assert piece.piece_type == chess.QUEEN
    assert piece.color == chess.WHITE

def test_captured_pieces():
    game = ChessGame()
    # 1. e4 d5 2. exd5 (White captures black pawn)
    game.make_move("e2e4")
    game.make_move("d7d5")
    game.make_move("e4d5")

    captured = game.get_captured_pieces()
    assert "P" in captured["white"]  # Black pawn captured by White

def test_resignation():
    game = ChessGame()
    ok = game.resign("white")
    assert ok
    assert game.game_over
    assert game.result == "resignation"
    assert game.winner == "black"

def test_room_manager_lifecycle():
    manager = RoomManager()
    
    # Mock class for WebSocket
    class MockWS:
        pass

    ws1 = MockWS()
    room = manager.create_room("Alice", ws1)
    assert room.code in manager.rooms
    assert room.status == "waiting"
    assert room.white_player.username == "Alice"
    assert room.black_player is None

    # Join as Bob
    ws2 = MockWS()
    joined, err = room.join("Bob", ws2)
    assert joined
    assert room.status == "playing"
    assert room.black_player.username == "Bob"

    # Third player attempts to join
    ws3 = MockWS()
    joined3, err3 = room.join("Charlie", ws3)
    assert not joined3
    assert "full" in err3.lower()

    # Rematch flow
    assert not room.request_rematch("white")  # Only white requested
    assert room.request_rematch("black")       # Both requested -> should reset & swap
    assert room.white_player.username == "Bob"
    assert room.black_player.username == "Alice"
    assert room.game.turn == "white"
