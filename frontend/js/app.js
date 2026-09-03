/**
 * CloudChess Main Application Controller
 * Manages view switching, lobby form handlers, room state,
 * move history updates, modals, toasts, and rematch flow.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const lobbyView = document.getElementById('lobby-view');
    const gameView = document.getElementById('game-view');

    const usernameInput = document.getElementById('username-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const btnCreateGame = document.getElementById('btn-create-game');
    const btnJoinGame = document.getElementById('btn-join-game');

    const roomCodeDisplay = document.getElementById('room-code-display');
    const btnCopyRoom = document.getElementById('btn-copy-room');
    const statusBanner = document.getElementById('status-banner');
    const statusText = document.getElementById('status-text');

    const topPlayerName = document.getElementById('top-player-name');
    const bottomPlayerName = document.getElementById('bottom-player-name');
    const topPlayerAvatar = document.getElementById('top-player-avatar');
    const bottomPlayerAvatar = document.getElementById('bottom-player-avatar');
    const topPlayerStatus = document.getElementById('top-player-status');
    const bottomPlayerStatus = document.getElementById('bottom-player-status');
    const topCapturedTray = document.getElementById('top-captured-tray');
    const bottomCapturedTray = document.getElementById('bottom-captured-tray');

    const historyList = document.getElementById('history-list');
    const btnResign = document.getElementById('btn-resign');
    const btnSoundToggle = document.getElementById('btn-sound-toggle');

    // Modals
    const resignModal = document.getElementById('resign-modal');
    const btnConfirmResign = document.getElementById('btn-confirm-resign');
    const btnCancelResign = document.getElementById('btn-cancel-resign');

    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverTitle = document.getElementById('game-over-title');
    const gameOverReason = document.getElementById('game-over-reason');
    const btnRematch = document.getElementById('btn-rematch');
    const btnReturnLobby = document.getElementById('btn-return-lobby');

    // State
    const ws = new ChessWebSocket();
    let chessUI = null;
    let currentRoomCode = null;
    let myUsername = '';
    let myColor = 'white';
    let opponentUsername = 'Waiting...';

    // Init Chess Board
    const boardEl = document.getElementById('chess-board');
    chessUI = new ChessBoardUI(boardEl, ws);

    // Initial WebSocket Connection
    ws.connect();

    // Check URL query parameters for room code invite link (e.g. ?room=ABCD)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomCodeInput.value = roomParam.toUpperCase().trim();
    }

    // Refresh active game stats
    fetchActiveGames();
    setInterval(fetchActiveGames, 15000);

    // =========================================================================
    // Lobby Actions
    // =========================================================================
    btnCreateGame.addEventListener('click', () => {
        myUsername = usernameInput.value.trim() || 'Player 1';
        showToast('Creating new chess room...', 'info');
        ws.send({
            type: 'create_game',
            username: myUsername
        });
    });

    btnJoinGame.addEventListener('click', () => {
        myUsername = usernameInput.value.trim() || 'Player 2';
        const code = roomCodeInput.value.trim().toUpperCase();
        if (!code) {
            showToast('Please enter a 4-letter Room Code', 'warning');
            roomCodeInput.focus();
            return;
        }
        showToast(`Joining room ${code}...`, 'info');
        ws.send({
            type: 'join_game',
            username: myUsername,
            room_code: code
        });
    });

    // Auto-uppercase room code input
    roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    // Copy Room Code Button
    btnCopyRoom.addEventListener('click', () => {
        if (!currentRoomCode) return;
        const inviteUrl = `${window.location.origin}/?room=${currentRoomCode}`;
        navigator.clipboard.writeText(inviteUrl).then(() => {
            showToast(`Room invite link copied: ${currentRoomCode}`, 'success');
        }).catch(() => {
            // Fallback to text copy
            navigator.clipboard.writeText(currentRoomCode);
            showToast(`Room Code ${currentRoomCode} copied to clipboard!`, 'success');
        });
    });

    // Sound Toggle
    let soundMuted = false;
    btnSoundToggle.addEventListener('click', () => {
        soundMuted = !soundMuted;
        chessUI.sounds.enabled = !soundMuted;
        btnSoundToggle.textContent = soundMuted ? '🔇' : '🔊';
        showToast(soundMuted ? 'Sound muted' : 'Sound enabled', 'info');
    });

    // =========================================================================
    // WebSocket Event Handlers
    // =========================================================================
    ws.on('connected', () => {
        console.log('[App] WebSocket ready');
    });

    ws.on('game_created', (data) => {
        currentRoomCode = data.room_code;
        myColor = 'white';
        opponentUsername = 'Waiting for player...';
        roomCodeDisplay.textContent = currentRoomCode;

        chessUI.setPlayerColor('white');
        chessUI.updateGameState(data);

        setupGameView();
        updateHUD('white');
        showToast(`Room ${currentRoomCode} created! Share the code to play.`, 'success');
    });

    ws.on('game_joined', (data) => {
        currentRoomCode = data.room_code;
        myColor = 'black';
        opponentUsername = data.opponent || 'White';
        roomCodeDisplay.textContent = currentRoomCode;

        chessUI.setPlayerColor('black');
        chessUI.updateGameState(data);

        setupGameView();
        updateHUD(data.turn || 'white');
        showToast(`Joined game against ${opponentUsername}!`, 'success');
    });

    ws.on('opponent_joined', (data) => {
        opponentUsername = data.opponent;
        updateHUD('white');
        showToast(`${opponentUsername} has joined the game!`, 'success');
    });

    ws.on('game_start', (data) => {
        if (myColor === 'white') {
            opponentUsername = data.black;
        } else {
            opponentUsername = data.white;
        }
        chessUI.updateGameState(data);
        clearHistory();
        updateHUD('white');
        gameOverModal.classList.remove('active');
        showToast('Game Started! White to move.', 'success');
    });

    ws.on('game_reconnected', (data) => {
        currentRoomCode = data.room_code;
        myColor = data.color;
        opponentUsername = data.opponent;
        roomCodeDisplay.textContent = currentRoomCode;

        chessUI.setPlayerColor(myColor);
        chessUI.updateGameState(data);

        setupGameView();
        rebuildHistory(data.history || []);
        renderCapturedTrays(data.captured_white || [], data.captured_black || []);
        updateHUD(data.turn);

        if (data.game_over) {
            handleGameOver(data.result, data.winner, 'Game already completed');
        } else {
            showToast('Reconnected to your ongoing game!', 'success');
        }
    });

    ws.on('move_made', (data) => {
        chessUI.updateGameState(data);
        appendHistoryMove(data.move ? data.move.san : '');
        renderCapturedTrays(data.captured_white || [], data.captured_black || []);
        updateHUD(data.turn);
    });

    ws.on('legal_moves', (data) => {
        chessUI.setLegalMoves(data.square, data.moves);
    });

    ws.on('invalid_move', (data) => {
        showToast(data.reason || 'Invalid move!', 'error');
        chessUI.renderBoard();
    });

    ws.on('game_over', (data) => {
        chessUI.updateGameState(data);
        handleGameOver(data.result, data.winner, data.reason);
    });

    ws.on('opponent_disconnected', (data) => {
        showToast(`Opponent ${data.username || ''} disconnected. Waiting for reconnect...`, 'warning');
        if (myColor === 'white') {
            topPlayerStatus.textContent = 'Disconnected';
            topPlayerStatus.className = 'player-status-pill pill-waiting';
        } else {
            topPlayerStatus.textContent = 'Disconnected';
            topPlayerStatus.className = 'player-status-pill pill-waiting';
        }
    });

    ws.on('opponent_reconnected', (data) => {
        showToast(`Opponent ${data.opponent || ''} reconnected!`, 'success');
        updateHUD(chessUI.turn);
    });

    ws.on('rematch_requested', (data) => {
        showToast(`${data.by || 'Opponent'} requested a rematch! Click Rematch to accept.`, 'info');
        btnRematch.classList.add('pulse');
    });

    ws.on('error', (data) => {
        showToast(data.message || 'An error occurred', 'error');
    });

    ws.on('info', (data) => {
        showToast(data.message, 'info');
    });

    // =========================================================================
    // Resignation Flow
    // =========================================================================
    btnResign.addEventListener('click', () => {
        resignModal.classList.add('active');
    });

    btnCancelResign.addEventListener('click', () => {
        resignModal.classList.remove('active');
    });

    btnConfirmResign.addEventListener('click', () => {
        resignModal.classList.remove('active');
        ws.send({ type: 'resign' });
    });

    // =========================================================================
    // Rematch & Return to Lobby
    // =========================================================================
    btnRematch.addEventListener('click', () => {
        btnRematch.classList.remove('pulse');
        ws.send({ type: 'rematch' });
        showToast('Rematch request sent. Waiting for opponent...', 'info');
    });

    btnReturnLobby.addEventListener('click', () => {
        gameOverModal.classList.remove('active');
        gameView.style.display = 'none';
        lobbyView.style.display = 'flex';
        currentRoomCode = null;
        // Update URL to remove query param
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchActiveGames();
    });

    // =========================================================================
    // UI Helpers
    // =========================================================================
    function setupGameView() {
        lobbyView.style.display = 'none';
        gameView.style.display = 'flex';
        clearHistory();
    }

    function updateHUD(currentTurn) {
        const isMyTurn = currentTurn === myColor;

        if (myColor === 'white') {
            bottomPlayerName.textContent = `${myUsername} (You)`;
            bottomPlayerAvatar.textContent = 'W';
            bottomPlayerAvatar.className = 'player-avatar white';

            topPlayerName.textContent = opponentUsername;
            topPlayerAvatar.textContent = 'B';
            topPlayerAvatar.className = 'player-avatar black';
        } else {
            bottomPlayerName.textContent = `${myUsername} (You)`;
            bottomPlayerAvatar.textContent = 'B';
            bottomPlayerAvatar.className = 'player-avatar black';

            topPlayerName.textContent = opponentUsername;
            topPlayerAvatar.textContent = 'W';
            topPlayerAvatar.className = 'player-avatar white';
        }

        // Turn Status Pills
        if (isMyTurn) {
            bottomPlayerStatus.textContent = 'Your turn';
            bottomPlayerStatus.className = 'player-status-pill pill-active';
            topPlayerStatus.textContent = 'Waiting';
            topPlayerStatus.className = 'player-status-pill pill-waiting';

            statusBanner.className = 'status-banner your-turn';
            statusText.textContent = chessUI.isCheck ? '⚠️ Check! Your Turn' : '🟢 Your Turn';
        } else {
            bottomPlayerStatus.textContent = 'Waiting';
            bottomPlayerStatus.className = 'player-status-pill pill-waiting';
            topPlayerStatus.textContent = 'Thinking...';
            topPlayerStatus.className = 'player-status-pill pill-active';

            statusBanner.className = 'status-banner';
            statusText.textContent = chessUI.isCheck ? "⚠️ Opponent is in Check" : `⏳ Waiting for ${opponentUsername}...`;
        }
    }

    function handleGameOver(result, winner, reason) {
        gameOverModal.classList.add('active');

        if (winner === myColor) {
            gameOverTitle.textContent = '🏆 Victory!';
            gameOverTitle.style.color = '#10b981';
        } else if (winner === 'draw') {
            gameOverTitle.textContent = '🤝 Game Drawn';
            gameOverTitle.style.color = '#f59e0b';
        } else {
            gameOverTitle.textContent = 'Defeat';
            gameOverTitle.style.color = '#ef4444';
        }

        gameOverReason.textContent = reason || `Game ended by ${result}`;
        statusText.textContent = `Game Over: ${reason || result}`;
        statusBanner.className = 'status-banner';
    }

    function clearHistory() {
        historyList.innerHTML = '';
    }

    function appendHistoryMove(san) {
        if (!san) return;
        let rows = historyList.querySelectorAll('.history-row');
        let lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

        if (!lastRow || lastRow.children.length === 3 && lastRow.children[2].textContent.trim() !== '') {
            // Start new move row
            const moveNum = rows.length + 1;
            const newRow = document.createElement('div');
            newRow.className = 'history-row';
            newRow.innerHTML = `
                <span class="history-num">${moveNum}.</span>
                <span class="history-move white-move active">${san}</span>
                <span class="history-move black-move"></span>
            `;
            // Remove previous active highlights
            document.querySelectorAll('.history-move.active').forEach(el => el.classList.remove('active'));
            newRow.querySelector('.white-move').classList.add('active');
            historyList.appendChild(newRow);
        } else {
            // Fill black move in current row
            document.querySelectorAll('.history-move.active').forEach(el => el.classList.remove('active'));
            const blackMoveSpan = lastRow.querySelector('.black-move');
            blackMoveSpan.textContent = san;
            blackMoveSpan.classList.add('active');
        }

        // Auto scroll to bottom
        historyList.parentElement.scrollTop = historyList.parentElement.scrollHeight;
    }

    function rebuildHistory(history) {
        clearHistory();
        history.forEach(san => appendHistoryMove(san));
    }

    function renderCapturedTrays(capturedWhite, capturedBlack) {
        // capturedWhite = black pieces captured by white
        // capturedBlack = white pieces captured by black
        const myCaptured = myColor === 'white' ? capturedWhite : capturedBlack;
        const oppCaptured = myColor === 'white' ? capturedBlack : capturedWhite;

        const pieceToImg = (symbol, isEnemy) => {
            const prefix = isEnemy ? (myColor === 'white' ? 'b' : 'w') : (myColor === 'white' ? 'w' : 'b');
            return `/static/assets/pieces/${prefix}${symbol.toUpperCase()}.svg`;
        };

        // Render in trays
        bottomCapturedTray.innerHTML = myCaptured.map(sym => 
            `<img class="captured-icon" src="${pieceToImg(sym, true)}" alt="${sym}">`
        ).join('');

        topCapturedTray.innerHTML = oppCaptured.map(sym => 
            `<img class="captured-icon" src="${pieceToImg(sym, false)}" alt="${sym}">`
        ).join('');
    }

    function fetchActiveGames() {
        fetch('/api/active-games')
            .then(res => res.json())
            .then(data => {
                const statActive = document.getElementById('stat-active-games');
                if (statActive) {
                    statActive.textContent = `${data.active_games || 0} active game${data.active_games === 1 ? '' : 's'}`;
                }
            })
            .catch(() => {});
    }

    // Toast Notification Utility
    window.showToast = function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'warning') icon = '⚠️';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        // Slide in
        setTimeout(() => toast.classList.add('show'), 10);

        // Slide out and remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };
});
