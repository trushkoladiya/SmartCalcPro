/**
 * CloudChess WebSocket Client Wrapper
 * Handles auto-reconnect, keep-alive heartbeat, and message routing.
 */
class ChessWebSocket {
    constructor() {
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1500;
        this.heartbeatTimer = null;
        this.isConnected = false;
    }

    getWebSocketUrl() {
        if (window.location.protocol === 'file:') {
            return 'ws://localhost:8000/ws';
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    connect(onConnectedCallback = null) {
        const url = this.getWebSocketUrl();
        console.log(`[CloudChess] Connecting to WebSocket: ${url}`);

        try {
            this.ws = new WebSocket(url);
        } catch (err) {
            console.error('[CloudChess] WebSocket init error:', err);
            this.emit('connection_error', { error: err });
            return;
        }

        this.ws.onopen = () => {
            console.log('[CloudChess] WebSocket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.emit('connected', {});
            if (onConnectedCallback) onConnectedCallback();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'pong') return; // Heartbeat reply
                this.emit(data.type, data);
            } catch (err) {
                console.error('[CloudChess] Failed to parse server message:', event.data, err);
            }
        };

        this.ws.onclose = (event) => {
            console.warn(`[CloudChess] WebSocket closed (code: ${event.code})`);
            this.isConnected = false;
            this.stopHeartbeat();
            this.emit('disconnected', { code: event.code });

            // Auto-reconnect if not closed intentionally
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
                console.log(`[CloudChess] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
                setTimeout(() => this.connect(), delay);
            }
        };

        this.ws.onerror = (err) => {
            console.error('[CloudChess] WebSocket error:', err);
            this.emit('error', { error: err });
        };
    }

    send(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[CloudChess] Cannot send message, WebSocket not open. Retrying...');
            this.connect(() => {
                this.ws.send(JSON.stringify(data));
            });
            return;
        }
        this.ws.send(JSON.stringify(data));
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }

    emit(type, payload) {
        const callbacks = this.listeners.get(type) || [];
        callbacks.forEach(cb => {
            try {
                cb(payload);
            } catch (err) {
                console.error(`[CloudChess] Error in handler for '${type}':`, err);
            }
        });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 20000);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
