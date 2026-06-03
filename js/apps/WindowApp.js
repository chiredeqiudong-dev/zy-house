class WindowApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._resolve = null;
        this._overlay = null;
        this._closed = false;
        this._api = 'https://t.alcy.cc/fj'; // fallback
    }

    // ---- Lifecycle ----

    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this._closed = false;

            this._loadConfig().then(() => {
                if (this._closed) return;
                this._buildUI();

                if (this.scene.input && this.scene.input.keyboard) {
                    this.scene.input.keyboard.enabled = false;
                }
                document.addEventListener('keydown', this._onKeyDown);
            });
        });
    }

    close() {
        this._closed = true;
        document.removeEventListener('keydown', this._onKeyDown);
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

}
