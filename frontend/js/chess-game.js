/**
 * CloudChess Board UI & Interactive Gameplay Engine
 * Implements board rendering, piece drag & drop, click-to-move,
 * smooth animation transitions, and Web Audio synthesized sound effects.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playMove() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);

            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.07);
        } catch (e) {
            console.debug('Audio playback error', e);
        }
    }

    playCapture() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            // Punchy bass + click
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(260, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.11);
        } catch (e) {
            console.debug('Audio playback error', e);
        }
    }

    playCheck() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [587.33, 880].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const start = now + i * 0.06;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, start);

                gain.gain.setValueAtTime(0.2, start);
                gain.gain.exponentialRampToValueAtTime(0.01, start + 0.18);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(start);
                osc.stop(start + 0.2);
            });
        } catch (e) {
            console.debug('Audio playback error', e);
        }
    }

    playGameOver() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            [440, 554.37, 659.25, 880].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const start = now + i * 0.09;

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);

                gain.gain.setValueAtTime(0.25, start);
                gain.gain.exponentialRampToValueAtTime(0.01, start + 0.25);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(start);
                osc.stop(start + 0.28);
            });
        } catch (e) {
            console.debug('Audio playback error', e);
        }
    }
}

class ChessBoardUI {
    constructor(boardElement, wsClient) {
        this.boardEl = boardElement;
        this.ws = wsClient;
        this.sounds = new SoundEngine();

        this.orientation = 'white';     // 'white' | 'black'
        this.myColor = 'white';         // 'white' | 'black'
        this.turn = 'white';
        this.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        this.isCheck = false;
        this.lastMove = null;
        this.selectedSquare = null;
        this.legalMoves = [];           // [{from, to, uci, is_capture, is_promotion}]
        this.pendingPromotion = null;   // {from, to}

        this.dragState = {
            active: false,
            fromSquare: null,
            pieceEl: null,
            cloneEl: null
        };

        this.initDOM();
        this.attachGlobalListeners();
    }

    setPlayerColor(color) {
        this.myColor = color;
        this.orientation = color;
        this.renderBoard();
    }

    initDOM() {
        this.boardEl.innerHTML = '';
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const square = document.createElement('div');
                square.className = 'square';
                this.boardEl.appendChild(square);
            }
        }
        this.renderBoard();
    }

    getSquareName(row, col) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        if (this.orientation === 'white') {
            return `${files[col]}${ranks[row]}`;
        } else {
            // Flipped for black
            return `${files[7 - col]}${ranks[7 - row]}`;
        }
    }

    parseFEN(fen) {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const [placement] = fen.split(' ');
        const rows = placement.split('/');

        for (let r = 0; r < 8; r++) {
            let c = 0;
            for (const ch of rows[r]) {
                if (/\d/.test(ch)) {
                    c += parseInt(ch, 10);
                } else {
                    board[r][c] = ch;
                    c++;
                }
            }
        }
        return board;
    }

    getPieceName(symbol) {
        const isWhite = symbol === symbol.toUpperCase();
        const color = isWhite ? 'w' : 'b';
        return `${color}${symbol.toUpperCase()}`;
    }

    isMyPiece(symbol) {
        if (!symbol) return false;
        const isWhite = symbol === symbol.toUpperCase();
        return (isWhite && this.myColor === 'white') || (!isWhite && this.myColor === 'black');
    }

    renderBoard() {
        const fenBoard = this.parseFEN(this.fen);
        const squares = this.boardEl.children;
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        let idx = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sqEl = squares[idx];
                const sqName = this.getSquareName(r, c);

                // Determine row/col in standard white-oriented coords
                const standardRow = this.orientation === 'white' ? r : 7 - r;
                const standardCol = this.orientation === 'white' ? c : 7 - c;
                const isLight = (standardRow + standardCol) % 2 === 0;

                sqEl.className = `square ${isLight ? 'light' : 'dark'}`;
                sqEl.dataset.square = sqName;
                sqEl.innerHTML = '';

                // Highlights
                if (this.selectedSquare === sqName) {
                    sqEl.classList.add('selected');
                }
                if (this.lastMove && (this.lastMove.from === sqName || this.lastMove.to === sqName)) {
                    sqEl.classList.add('last-move');
                }

                // King in check indicator
                const pieceSymbol = fenBoard[standardRow][standardCol];
                if (this.isCheck && pieceSymbol) {
                    const isWhiteTurn = this.turn === 'white';
                    if ((isWhiteTurn && pieceSymbol === 'K') || (!isWhiteTurn && pieceSymbol === 'k')) {
                        sqEl.classList.add('in-check');
                    }
                }

                // Coordinates label
                if (c === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'square-coord coord-rank';
                    rankLabel.textContent = this.orientation === 'white' ? ranks[r] : ranks[7 - r];
                    sqEl.appendChild(rankLabel);
                }
                if (r === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'square-coord coord-file';
                    fileLabel.textContent = this.orientation === 'white' ? files[c] : files[7 - c];
                    sqEl.appendChild(fileLabel);
                }

                // Render Piece
                if (pieceSymbol) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = 'piece';
                    const pieceKey = this.getPieceName(pieceSymbol);
                    pieceEl.style.backgroundImage = `url('/static/assets/pieces/${pieceKey}.svg')`;
                    pieceEl.dataset.piece = pieceKey;
                    pieceEl.dataset.square = sqName;
                    sqEl.appendChild(pieceEl);
                }

                // Legal move indicators
                const legalMove = this.legalMoves.find(m => m.to === sqName);
                if (legalMove) {
                    if (legalMove.is_capture) {
                        const ring = document.createElement('div');
                        ring.className = 'legal-capture-ring';
                        sqEl.appendChild(ring);
                    } else {
                        const dot = document.createElement('div');
                        dot.className = 'legal-dot';
                        sqEl.appendChild(dot);
                    }
                }

                idx++;
            }
        }
    }

    updateGameState(data) {
        const previousFen = this.fen;
        this.fen = data.fen || this.fen;
        this.turn = data.turn || this.turn;
        this.isCheck = !!data.is_check;
        this.lastMove = data.move || data.last_move || this.lastMove;
        this.selectedSquare = null;
        this.legalMoves = [];

        this.renderBoard();

        // Play sounds
        if (data.type === 'move_made') {
            if (this.isCheck) {
                this.sounds.playCheck();
            } else if (this.lastMove && this.lastMove.san && this.lastMove.san.includes('x')) {
                this.sounds.playCapture();
            } else {
                this.sounds.playMove();
            }
        } else if (data.type === 'game_over') {
            this.sounds.playGameOver();
        }
    }

    handleSquareClick(sqName) {
        if (this.turn !== this.myColor) {
            return;
        }

        // If a square is already selected, check if user clicked a legal target
        if (this.selectedSquare) {
            const moveCandidate = this.legalMoves.find(m => m.to === sqName);
            if (moveCandidate) {
                this.executeMove(this.selectedSquare, sqName, moveCandidate.is_promotion);
                return;
            }
        }

        // Otherwise, select piece on clicked square
        const fenBoard = this.parseFEN(this.fen);
        const { row, col } = this.getStandardCoords(sqName);
        const piece = fenBoard[row][col];

        if (piece && this.isMyPiece(piece)) {
            this.selectedSquare = sqName;
            this.renderBoard();
            // Request legal moves from backend
            this.ws.send({
                type: 'get_legal_moves',
                square: sqName
            });
        } else {
            this.selectedSquare = null;
            this.legalMoves = [];
            this.renderBoard();
        }
    }

    getStandardCoords(sqName) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        const file = sqName[0];
        const rank = sqName[1];
        return {
            row: ranks.indexOf(rank),
            col: files.indexOf(file)
        };
    }

    setLegalMoves(square, moves) {
        if (this.selectedSquare === square) {
            this.legalMoves = moves;
            this.renderBoard();
        }
    }

    executeMove(fromSq, toSq, isPromotion = false) {
        if (isPromotion) {
            this.pendingPromotion = { from: fromSq, to: toSq };
            this.showPromotionModal();
            return;
        }

        const uciMove = `${fromSq}${toSq}`;
        this.ws.send({
            type: 'move',
            move: uciMove
        });

        this.selectedSquare = null;
        this.legalMoves = [];
        this.renderBoard();
    }

    showPromotionModal() {
        const modal = document.getElementById('promotion-modal');
        const container = document.getElementById('promotion-pieces-container');
        if (!modal || !container) return;

        const colorPrefix = this.myColor === 'white' ? 'w' : 'b';
        const pieces = [
            { type: 'q', name: 'Queen', img: `${colorPrefix}Q.svg` },
            { type: 'r', name: 'Rook', img: `${colorPrefix}R.svg` },
            { type: 'b', name: 'Bishop', img: `${colorPrefix}B.svg` },
            { type: 'n', name: 'Knight', img: `${colorPrefix}N.svg` }
        ];

        container.innerHTML = '';
        pieces.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'promotion-btn';
            btn.innerHTML = `<img src="/static/assets/pieces/${p.img}" alt="${p.name}">`;
            btn.title = p.name;
            btn.onclick = () => {
                modal.classList.remove('active');
                if (this.pendingPromotion) {
                    const uciMove = `${this.pendingPromotion.from}${this.pendingPromotion.to}${p.type}`;
                    this.ws.send({ type: 'move', move: uciMove });
                    this.pendingPromotion = null;
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.renderBoard();
                }
            };
            container.appendChild(btn);
        });

        modal.classList.add('active');
    }

    attachGlobalListeners() {
        // Click & Drag Delegation
        this.boardEl.addEventListener('click', (e) => {
            const squareEl = e.target.closest('.square');
            if (squareEl && squareEl.dataset.square) {
                this.handleSquareClick(squareEl.dataset.square);
            }
        });

        // Pointer Drag & Drop for smooth interaction
        this.boardEl.addEventListener('pointerdown', (e) => {
            const pieceEl = e.target.closest('.piece');
            if (!pieceEl) return;

            const sqName = pieceEl.dataset.square;
            const fenBoard = this.parseFEN(this.fen);
            const { row, col } = this.getStandardCoords(sqName);
            const piece = fenBoard[row][col];

            if (this.turn !== this.myColor || !piece || !this.isMyPiece(piece)) {
                return;
            }

            e.preventDefault();
            this.dragState.active = true;
            this.dragState.fromSquare = sqName;
            this.dragState.pieceEl = pieceEl;

            pieceEl.classList.add('dragging');

            // Create floating clone
            const clone = pieceEl.cloneNode(true);
            clone.className = 'drag-clone';
            clone.style.backgroundImage = pieceEl.style.backgroundImage;
            clone.style.left = `${e.clientX}px`;
            clone.style.top = `${e.clientY}px`;
            document.body.appendChild(clone);
            this.dragState.cloneEl = clone;

            // Trigger legal moves query
            this.selectedSquare = sqName;
            this.ws.send({ type: 'get_legal_moves', square: sqName });
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.dragState.active || !this.dragState.cloneEl) return;
            this.dragState.cloneEl.style.left = `${e.clientX}px`;
            this.dragState.cloneEl.style.top = `${e.clientY}px`;
        });

        window.addEventListener('pointerup', (e) => {
            if (!this.dragState.active) return;

            const fromSq = this.dragState.fromSquare;
            if (this.dragState.pieceEl) {
                this.dragState.pieceEl.classList.remove('dragging');
            }
            if (this.dragState.cloneEl) {
                this.dragState.cloneEl.remove();
            }

            this.dragState.active = false;
            this.dragState.cloneEl = null;

            // Find square dropped onto
            const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
            const targetSquare = elemUnder ? elemUnder.closest('.square') : null;

            if (targetSquare && targetSquare.dataset.square) {
                const toSq = targetSquare.dataset.square;
                if (toSq !== fromSq) {
                    const candidate = this.legalMoves.find(m => m.to === toSq);
                    if (candidate) {
                        this.executeMove(fromSq, toSq, candidate.is_promotion);
                        return;
                    }
                }
            }

            // If not dropped on a valid target, keep selection for click-to-move
            this.renderBoard();
        });
    }
}
