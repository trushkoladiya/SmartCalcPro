from typing import Optional, List, Dict, Any, Tuple
import chess

class ChessGame:
    def __init__(self):
        self.board = chess.Board()
        self.move_history: List[str] = []       # SAN moves: ["e4", "e5", "Nf3", ...]
        self.uci_history: List[str] = []        # UCI moves: ["e2e4", "e7e5", ...]
        self.last_move: Optional[Dict[str, str]] = None
        self.game_over = False
        self.result: Optional[str] = None       # "checkmate", "stalemate", "resignation", "draw"
        self.winner: Optional[str] = None       # "white", "black", "draw"
        self.termination_reason: Optional[str] = None

    @property
    def turn(self) -> str:
        return "white" if self.board.turn == chess.WHITE else "black"

    @property
    def fen(self) -> str:
        return self.board.fen()

    @property
    def is_check(self) -> bool:
        return self.board.is_check()

    def get_legal_moves_for_square(self, square_name: str) -> List[Dict[str, Any]]:
        """Return legal moves starting from a square (e.g. 'e2')."""
        try:
            from_sq = chess.parse_square(square_name.lower())
        except ValueError:
            return []

        piece = self.board.piece_at(from_sq)
        if piece is None or piece.color != self.board.turn:
            return []

        legal_moves = []
        for move in self.board.legal_moves:
            if move.from_square == from_sq:
                to_sq_name = chess.square_name(move.to_square)
                is_capture = self.board.is_capture(move)
                is_promotion = move.promotion is not None
                
                legal_moves.append({
                    "from": square_name.lower(),
                    "to": to_sq_name,
                    "uci": move.uci(),
                    "is_capture": is_capture,
                    "is_promotion": is_promotion
                })
        return legal_moves

    def make_move(self, move_uci: str) -> Tuple[bool, Optional[str]]:
        """
        Attempt to make a move using UCI string (e.g. 'e2e4' or 'e7e8q').
        Returns (success, error_message).
        """
        if self.game_over:
            return False, "Game is already over"

        try:
            move = chess.Move.from_uci(move_uci.lower())
        except ValueError:
            return False, "Invalid move format"

        # Check if pawn promotion is needed without promotion piece specified
        from_piece = self.board.piece_at(move.from_square)
        if from_piece and from_piece.piece_type == chess.PAWN:
            to_rank = chess.square_rank(move.to_square)
            if (from_piece.color == chess.WHITE and to_rank == 7) or (from_piece.color == chess.BLACK and to_rank == 0):
                if move.promotion is None:
                    # Default promotion to queen if client forgot to specify
                    move = chess.Move(move.from_square, move.to_square, promotion=chess.QUEEN)

        if move not in self.board.legal_moves:
            return False, "Illegal move"

        # Record SAN before pushing move
        san = self.board.san(move)
        from_sq = chess.square_name(move.from_square)
        to_sq = chess.square_name(move.to_square)

        self.board.push(move)
        self.move_history.append(san)
        self.uci_history.append(move.uci())
        self.last_move = {
            "from": from_sq,
            "to": to_sq,
            "san": san,
            "uci": move.uci()
        }

        self._check_game_status()
        return True, None

    def resign(self, player_color: str) -> bool:
        if self.game_over:
            return False
        self.game_over = True
        self.result = "resignation"
        self.winner = "black" if player_color == "white" else "white"
        self.termination_reason = f"{player_color.capitalize()} resigned"
        return True

    def _check_game_status(self):
        if self.board.is_checkmate():
            self.game_over = True
            self.result = "checkmate"
            # Since board.turn is now the player who was mated, the winner is the opposite color
            self.winner = "black" if self.board.turn == chess.WHITE else "white"
            self.termination_reason = f"Checkmate! {self.winner.capitalize()} wins."
        elif self.board.is_stalemate():
            self.game_over = True
            self.result = "stalemate"
            self.winner = "draw"
            self.termination_reason = "Stalemate! Game is drawn."
        elif self.board.is_insufficient_material():
            self.game_over = True
            self.result = "draw"
            self.winner = "draw"
            self.termination_reason = "Draw due to insufficient material."
        elif self.board.can_claim_threefold_repetition():
            self.game_over = True
            self.result = "draw"
            self.winner = "draw"
            self.termination_reason = "Draw by threefold repetition."
        elif self.board.can_claim_fifty_moves():
            self.game_over = True
            self.result = "draw"
            self.winner = "draw"
            self.termination_reason = "Draw by fifty-move rule."

    def get_captured_pieces(self) -> Dict[str, List[str]]:
        """Return captured pieces for each color as list of symbols (p, n, b, r, q)."""
        initial_counts = {
            chess.PAWN: 8,
            chess.KNIGHT: 2,
            chess.BISHOP: 2,
            chess.ROOK: 2,
            chess.QUEEN: 1
        }
        
        captured = {"white": [], "black": []}
        
        # White captures Black pieces (and vice-versa)
        for piece_type, count in initial_counts.items():
            white_remaining = len(self.board.pieces(piece_type, chess.WHITE))
            black_remaining = len(self.board.pieces(piece_type, chess.BLACK))
            
            # Pieces white lost (captured by black)
            white_lost = max(0, count - white_remaining)
            # Pieces black lost (captured by white)
            black_lost = max(0, count - black_remaining)
            
            symbol = chess.piece_symbol(piece_type)
            captured["black"].extend([symbol.lower()] * white_lost)  # Black has captured these white pieces
            captured["white"].extend([symbol.upper()] * black_lost)  # White has captured these black pieces
            
        return captured
