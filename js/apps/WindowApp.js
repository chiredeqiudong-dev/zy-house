class WindowApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._resolve = null;
        this._overlay = null;
        this._styleEl = null;
        this._api = 'https://t.alcy.cc/fj'; // fallback
    }

    // ---- Lifecycle ----

    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;

            this._styleEl = document.createElement('style');
            this._styleEl.textContent = WindowApp.CSS;
            document.head.appendChild(this._styleEl);

            this._loadConfig().then(() => {
                this._buildUI();

                if (this.scene.input && this.scene.input.keyboard) {
                    this.scene.input.keyboard.enabled = false;
                }
                document.addEventListener('keydown', this._onKeyDown);
            });
        });
    }

    close() {
        document.removeEventListener('keydown', this._onKeyDown);
        if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }

        if (this.scene.input && this.scene.input.keyboard) {
            this.scene.input.keyboard.enabled = true;
        }
        document.querySelectorAll('.key-cap.active').forEach(el => el.classList.remove('active'));

        if (this._resolve) { this._resolve(); this._resolve = null; }
    }

    _onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
        } else {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // ---- Config ----

    async _loadConfig() {
        try {
            const resp = await fetch('conf/window.json');
            if (!resp.ok) return;
            const cfg = await resp.json();
            if (cfg && cfg.api) this._api = cfg.api;
        } catch (e) {
            console.warn('Failed to load window.json, using default API');
        }
    }

    // ---- UI ----

    _buildUI() {
        const container = document.getElementById('game-container');

        this._overlay = document.createElement('div');
        this._overlay.className = 'wdw-root';

        // Window frame
        const frame = document.createElement('div');
        frame.className = 'wdw-frame';

        // Scene image
        const img = document.createElement('img');
        img.className = 'wdw-scene';
        img.src = this._api + '?' + Date.now();
        img.alt = '窗外风景';

        // Loading state
        const loader = document.createElement('div');
        loader.className = 'wdw-loader';
        loader.textContent = 'Loading...';

        img.onload = () => { loader.style.display = 'none'; };
        img.onerror = () => { loader.textContent = 'Failed to load'; };

        // Cross dividers (window panes)
        const hBar = document.createElement('div');
        hBar.className = 'wdw-bar wdw-bar-h';
        const vBar = document.createElement('div');
        vBar.className = 'wdw-bar wdw-bar-v';

        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'wdw-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.close());

        // Refresh button
        const refreshBtn = document.createElement('div');
        refreshBtn.className = 'wdw-refresh';
        refreshBtn.textContent = '↻';
        refreshBtn.title = '换一张';
        refreshBtn.addEventListener('click', () => {
            loader.style.display = 'flex';
            img.src = this._api + '?' + Date.now();
        });

        frame.appendChild(img);
        frame.appendChild(loader);
        frame.appendChild(hBar);
        frame.appendChild(vBar);

        this._overlay.appendChild(frame);
        this._overlay.appendChild(closeBtn);
        this._overlay.appendChild(refreshBtn);
        container.appendChild(this._overlay);
    }

    // ---- Static CSS ----

    static CSS = `
/* ========== Root ========== */
.wdw-root {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 100;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ========== Window Frame ========== */
.wdw-frame {
    position: relative;
    width: 672px;
    height: 576px;
    border: 12px solid #5C3A1E;
    border-radius: 4px;
    box-shadow:
        inset 0 0 0 2px #3E2418,
        0 0 0 2px #2A1A0A,
        0 8px 32px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    background: #1a1a2e;
}

/* Wood texture on frame */
.wdw-frame::before {
    content: '';
    position: absolute;
    top: -12px; left: -12px; right: -12px; bottom: -12px;
    border: 12px solid transparent;
    border-image: repeating-linear-gradient(
        87deg,
        #5C3A1E,
        #5C3A1E 3px,
        #6B4226 3px,
        #6B4226 6px
    ) 12;
    pointer-events: none;
    z-index: 3;
}

/* ========== Scene Image ========== */
.wdw-scene {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

/* ========== Window Pane Dividers ========== */
.wdw-bar {
    position: absolute;
    background: rgba(92, 58, 30, 0.65);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
    z-index: 2;
    pointer-events: none;
}

.wdw-bar-h {
    top: 50%;
    left: 0; right: 0;
    height: 8px;
    transform: translateY(-50%);
}

.wdw-bar-v {
    left: 50%;
    top: 0; bottom: 0;
    width: 8px;
    transform: translateX(-50%);
}

/* ========== Loading ========== */
.wdw-loader {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 220, 160, 0.6);
    font-family: 'Excalifont', sans-serif;
    font-size: 14px;
    background: #1a1a2e;
    z-index: 1;
}

/* ========== Close Button ========== */
.wdw-close {
    position: absolute;
    top: 12px;
    right: 16px;
    font-size: 20px;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 0.2s, background 0.2s;
    font-family: sans-serif;
    z-index: 20;
}

.wdw-close:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
}

/* ========== Refresh Button ========== */
.wdw-refresh {
    position: absolute;
    bottom: 16px;
    right: 16px;
    font-size: 22px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    transition: all 0.2s ease;
    font-family: sans-serif;
    z-index: 20;
    line-height: 1;
}

.wdw-refresh:hover {
    color: #fff;
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.3);
    transform: rotate(90deg);
}
`;
}
