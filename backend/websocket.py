import json
import logging
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from room import RoomManager, Room, Player

logger = logging.getLogger("cloudchess.websocket")

async def send_json(ws: WebSocket, payload: dict):
    try:
        await ws.send_text(json.dumps(payload))
    except Exception as e:
        logger.warning(f"Failed to send message to websocket: {e}")

async def broadcast_room(room: Room, payload: dict):
    if room.white_player and room.white_player.connected and room.white_player.ws:
        await send_json(room.white_player.ws, payload)
    if room.black_player and room.black_player.connected and room.black_player.ws:
        await send_json(room.black_player.ws, payload)

class WebSocketHandler:
    def __init__(self, room_manager: RoomManager):
        self.room_manager = room_manager

    async def handle_connection(self, websocket: WebSocket):
        await websocket.accept()
        current_room: Optional[Room] = None
        current_player: Optional[Player] = None

        try:
            while True:
                data_text = await websocket.receive_text()
                try:
                    data = json.loads(data_text)
                except json.JSONDecodeError:
                    await send_json(websocket, {"type": "error", "message": "Invalid JSON format"})
                    continue

                msg_type = data.get("type")
                if not msg_type:
                    continue

                # 1. CREATE GAME
                if msg_type == "create_game":
                    username = (data.get("username") or "Player 1").strip()[:20]
                    if not username:
                        username = "Player 1"
                    current_room = self.room_manager.create_room(username, websocket)
                    current_player = current_room.white_player
                    logger.info(f"Room {current_room.code} created by {username}")
                    await send_json(websocket, {
                        "type": "game_created",
                        "room_code": current_room.code,
                        "color": "white",
                        "username": username,
                        "fen": current_room.game.fen,
                        "turn": current_room.game.turn
                    })

                # 2. JOIN GAME
                elif msg_type == "join_game":
                    room_code = (data.get("room_code") or "").strip().upper()
                    username = (data.get("username") or "Player 2").strip()[:20]
                    if not username:
                        username = "Player 2"

                    room = self.room_manager.get_room(room_code)
                    if not room:
                        await send_json(websocket, {"type": "error", "message": f"Room '{room_code}' not found"})
                        continue

                    # Check if reconnecting
                    reconnected_color = room.reconnect(username, websocket)
                    if reconnected_color:
                        current_room = room
                        current_player = room.white_player if reconnected_color == "white" else room.black_player
                        opponent = room.get_opponent(reconnected_color)
                        opp_username = opponent.username if opponent else "Unknown"
                        
                        captured = room.game.get_captured_pieces()
                        await send_json(websocket, {
                            "type": "game_reconnected",
                            "room_code": room.code,
                            "color": reconnected_color,
                            "username": username,
                            "opponent": opp_username,
                            "white": room.white_player.username if room.white_player else "",
                            "black": room.black_player.username if room.black_player else "",
                            "fen": room.game.fen,
                            "turn": room.game.turn,
                            "last_move": room.game.last_move,
                            "history": room.game.move_history,
                            "is_check": room.game.is_check,
                            "captured_white": captured["white"],
                            "captured_black": captured["black"],
                            "game_over": room.game.game_over,
                            "result": room.game.result,
                            "winner": room.game.winner
                        })

                        if opponent and opponent.connected and opponent.ws:
                            await send_json(opponent.ws, {
                                "type": "opponent_reconnected",
                                "opponent": username
                            })
                        continue

                    # Fresh join as black
                    success, err = room.join(username, websocket)
                    if not success:
                        await send_json(websocket, {"type": "error", "message": err or "Cannot join room"})
                        continue

                    current_room = room
                    current_player = room.black_player
                    white_user = room.white_player.username if room.white_player else "Host"
                    logger.info(f"Player {username} joined room {room.code}")

                    # Notify Black
                    await send_json(websocket, {
                        "type": "game_joined",
                        "room_code": room.code,
                        "color": "black",
                        "username": username,
                        "opponent": white_user,
                        "white": white_user,
                        "black": username,
                        "fen": room.game.fen,
                        "turn": room.game.turn
                    })

                    # Notify White that opponent joined
                    if room.white_player and room.white_player.ws:
                        await send_json(room.white_player.ws, {
                            "type": "opponent_joined",
                            "opponent": username,
                            "white": white_user,
                            "black": username
                        })

                    # Broadcast game start to both
                    await broadcast_room(room, {
                        "type": "game_start",
                        "room_code": room.code,
                        "white": white_user,
                        "black": username,
                        "fen": room.game.fen,
                        "turn": room.game.turn
                    })

                # 3. GET LEGAL MOVES
                elif msg_type == "get_legal_moves":
                    if not current_room or not current_player:
                        continue
                    square = data.get("square")
                    if square:
                        moves = current_room.game.get_legal_moves_for_square(square)
                        await send_json(websocket, {
                            "type": "legal_moves",
                            "square": square,
                            "moves": moves
                        })

                # 4. MOVE
                elif msg_type == "move":
                    if not current_room or not current_player:
                        await send_json(websocket, {"type": "error", "message": "Not in an active room"})
                        continue

                    if current_room.status != "playing":
                        await send_json(websocket, {"type": "invalid_move", "reason": "Waiting for second player"})
                        continue

                    # Verify turn
                    if current_room.game.turn != current_player.color:
                        await send_json(websocket, {"type": "invalid_move", "reason": "Not your turn"})
                        continue

                    move_uci = data.get("move")
                    if not move_uci:
                        await send_json(websocket, {"type": "invalid_move", "reason": "Missing move string"})
                        continue

                    success, err = current_room.game.make_move(move_uci)
                    if not success:
                        await send_json(websocket, {"type": "invalid_move", "reason": err or "Illegal move"})
                        continue

                    current_room.last_activity = current_room.game.board.fullmove_number
                    captured = current_room.game.get_captured_pieces()

                    # Broadcast move made
                    move_payload = {
                        "type": "move_made",
                        "room_code": current_room.code,
                        "move": current_room.game.last_move,
                        "fen": current_room.game.fen,
                        "turn": current_room.game.turn,
                        "is_check": current_room.game.is_check,
                        "history": current_room.game.move_history,
                        "captured_white": captured["white"],
                        "captured_black": captured["black"]
                    }
                    await broadcast_room(current_room, move_payload)

                    # Check if game over
                    if current_room.game.game_over:
                        current_room.status = "finished"
                        over_payload = {
                            "type": "game_over",
                            "room_code": current_room.code,
                            "result": current_room.game.result,
                            "winner": current_room.game.winner,
                            "reason": current_room.game.termination_reason
                        }
                        await broadcast_room(current_room, over_payload)

                # 5. RESIGN
                elif msg_type == "resign":
                    if not current_room or not current_player:
                        continue
                    if current_room.game.game_over:
                        continue

                    current_room.game.resign(current_player.color)
                    current_room.status = "finished"
                    await broadcast_room(current_room, {
                        "type": "game_over",
                        "room_code": current_room.code,
                        "result": "resignation",
                        "winner": current_room.game.winner,
                        "reason": current_room.game.termination_reason
                    })

                # 6. REMATCH
                elif msg_type == "rematch":
                    if not current_room or not current_player:
                        continue

                    opponent = current_room.get_opponent(current_player.color)
                    both_ready = current_room.request_rematch(current_player.color)

                    if both_ready:
                        # Colors swapped, start new game
                        white_user = current_room.white_player.username if current_room.white_player else "White"
                        black_user = current_room.black_player.username if current_room.black_player else "Black"
                        await broadcast_room(current_room, {
                            "type": "game_start",
                            "room_code": current_room.code,
                            "white": white_user,
                            "black": black_user,
                            "fen": current_room.game.fen,
                            "turn": "white",
                            "is_rematch": True
                        })
                    else:
                        if opponent and opponent.connected and opponent.ws:
                            await send_json(opponent.ws, {
                                "type": "rematch_requested",
                                "by": current_player.username
                            })
                        await send_json(websocket, {
                            "type": "info",
                            "message": "Rematch request sent to opponent"
                        })

                # 7. PING / HEARTBEAT
                elif msg_type == "ping":
                    await send_json(websocket, {"type": "pong"})

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected")
        except Exception as e:
            logger.error(f"WebSocket error: {e}", exc_info=True)
        finally:
            if current_room:
                disconnected_color = current_room.mark_disconnected(websocket)
                if disconnected_color:
                    opponent = current_room.get_opponent(disconnected_color)
                    if opponent and opponent.connected and opponent.ws:
                        player_name = current_player.username if current_player else "Opponent"
                        await send_json(opponent.ws, {
                            "type": "opponent_disconnected",
                            "username": player_name
                        })
                # Periodic cleanup check
                self.room_manager.cleanup_stale_rooms()
