class BookshelfApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._resolve = null;
        this._overlay = null;
        this._styleEl = null;
        this._books = [];
        this._categories = [];
        this._currentCat = 0;
        this._currentPage = 0;
        this._booksPerShelf = 6;
        this._shelvesPerPage = 3;
        this._closed = false;
        this._pageLabel = null;
        this._shelfArea = null;
    }

    // ---- Lifecycle ----

    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this._closed = false;

            // Inject styles
            this._styleEl = document.createElement('style');
            this._styleEl.textContent = BookshelfApp.CSS;
            document.head.appendChild(this._styleEl);

            // Build UI immediately with loading state (Fix #2)
            this._buildUI();
            this._showLoading();

            // Disable keyboard & bind Escape early so user can cancel during load
            if (this.scene.input && this.scene.input.keyboard) {
                this.scene.input.keyboard.enabled = false;
            }
            document.addEventListener('keydown', this._onKeyDown);

            // Then load data async
            this._loadBooks().then(() => {
                if (this._closed) return; // Fix #2: don't build if already closed
                if (this._categories.length === 0) {
                    this._showEmpty();
                } else {
                    this._renderShelf();
                }
            }).catch(() => {
                if (this._closed) return;
                this._showEmpty();
            });
        });
    }

    close() {
        this._closed = true;
        document.removeEventListener('keydown', this._onKeyDown);
        if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }
        this._pageLabel = null;   // Fix #8: clear stale refs
        this._shelfArea = null;

        if (this.scene.input && this.scene.input.keyboard) {
            this.scene.input.keyboard.enabled = true;
        }
        document.querySelectorAll('.key-cap.active').forEach(el => el.classList.remove('active'));

        if (this._resolve) { this._resolve(); this._resolve = null; } // Fix #4
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

    // ---- Data ----

    async _loadBooks() {
        let raw = [];
        try {
            const resp = await fetch('conf/books.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`); // Fix #3
            raw = await resp.json();
        } catch (e) {
            console.warn('Failed to load books.json:', e);
            this._books = [];
            this._categories = [];
            return;
        }
        // Fix #3: validate + group inside try-safe context
        if (!Array.isArray(raw)) {
            console.warn('books.json is not an array');
            this._books = [];
            this._categories = [];
            return;
        }
        this._books = raw;
        const catMap = {};
        this._books.forEach(b => {
            if (!b || typeof b.category !== 'string') return; // Fix #3: skip invalid entries
            if (!catMap[b.category]) catMap[b.category] = [];
            catMap[b.category].push(b);
        });
        this._categories = Object.keys(catMap).map(name => ({
            name,
            books: catMap[name]
        }));
    }

    // ---- UI Construction ----

    _buildUI() {
        const container = document.getElementById('game-container');

        this._overlay = document.createElement('div');
        this._overlay.className = 'bk-root';

        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'bk-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.close());

        // Main panel
        const panel = document.createElement('div');
        panel.className = 'bk-panel';

        // Category tabs
        this._tabBar = document.createElement('div');
        this._tabBar.className = 'bk-tabs';

        // Shelf area
        this._shelfArea = document.createElement('div');
        this._shelfArea.className = 'bk-shelf-area';

        // Pagination
        const pagination = document.createElement('div');
        pagination.className = 'bk-pagination';

        const prevBtn = document.createElement('div');
        prevBtn.className = 'bk-page-btn';
        prevBtn.textContent = '◀';
        prevBtn.addEventListener('click', () => this._switchPage(-1));

        this._pageLabel = document.createElement('span');
        this._pageLabel.className = 'bk-page-label';

        const nextBtn = document.createElement('div');
        nextBtn.className = 'bk-page-btn';
        nextBtn.textContent = '▶';
        nextBtn.addEventListener('click', () => this._switchPage(1));

        pagination.appendChild(prevBtn);
        pagination.appendChild(this._pageLabel);
        pagination.appendChild(nextBtn);

        panel.appendChild(this._tabBar);
        panel.appendChild(this._shelfArea);
        panel.appendChild(pagination);

        this._overlay.appendChild(panel);
        this._overlay.appendChild(closeBtn);
        container.appendChild(this._overlay);
    }

    _showLoading() {
        if (!this._shelfArea) return;
        this._shelfArea.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'bk-empty';
        msg.textContent = 'Loading...';
        this._shelfArea.appendChild(msg);
    }

    _showEmpty() { // Fix #5
        if (!this._shelfArea) return;
        this._shelfArea.innerHTML = '';
        const msg = document.createElement('div');
        msg.className = 'bk-empty';
        msg.textContent = 'No books found';
        this._shelfArea.appendChild(msg);
        if (this._pageLabel) this._pageLabel.textContent = '';
    }

    _buildTabs() { // Fix #2: separated so tabs can be built after data loads
        this._tabBar.innerHTML = '';
        this._categories.forEach((cat, i) => {
            const tab = document.createElement('div');
            tab.className = 'bk-tab' + (i === 0 ? ' bk-tab-active' : '');
            tab.textContent = cat.name;
            tab.addEventListener('click', () => this._switchCategory(i));
            this._tabBar.appendChild(tab);
        });
    }

    // ---- Rendering ----

    _renderShelf() {
        const cat = this._categories[this._currentCat];
        if (!cat) return;

        // Build tabs on first render
        if (this._tabBar.children.length === 0) this._buildTabs();

        const booksPerPage = this._booksPerShelf * this._shelvesPerPage;
        const totalPages = Math.max(1, Math.ceil(cat.books.length / booksPerPage));

        if (this._currentPage >= totalPages) this._currentPage = totalPages - 1;

        const start = this._currentPage * booksPerPage;
        const pageBooks = cat.books.slice(start, start + booksPerPage);

        // Clear shelf area
        this._shelfArea.innerHTML = '';

        // Build shelves
        for (let s = 0; s < this._shelvesPerPage; s++) {
            const shelfBooks = pageBooks.slice(s * this._booksPerShelf, (s + 1) * this._booksPerShelf);
            if (shelfBooks.length === 0) break;

            const shelf = document.createElement('div');
            shelf.className = 'bk-shelf';

            // Book row
            const bookRow = document.createElement('div');
            bookRow.className = 'bk-book-row';

            shelfBooks.forEach((book, bi) => {
                const bookEl = document.createElement('div');
                bookEl.className = 'bk-book';

                const cover = document.createElement('img');
                cover.className = 'bk-cover';
                cover.src = book.url;
                cover.alt = book.title;
                cover.loading = 'lazy';

                const tooltip = document.createElement('div');
                tooltip.className = 'bk-tooltip';
                tooltip.textContent = book.title;

                bookEl.appendChild(cover);
                bookEl.appendChild(tooltip);
                bookRow.appendChild(bookEl);
            });

            // Shelf board (the wooden plank under books)
            const board = document.createElement('div');
            board.className = 'bk-board';

            shelf.appendChild(bookRow);
            shelf.appendChild(board);
            this._shelfArea.appendChild(shelf);
        }

        // Update pagination
        if (this._pageLabel) {
            this._pageLabel.textContent = `${this._currentPage + 1} / ${totalPages}`;
        }
    }

    _switchCategory(index) {
        this._currentCat = index;
        this._currentPage = 0;

        // Update tab active state
        const tabs = this._overlay.querySelectorAll('.bk-tab');
        tabs.forEach((t, i) => {
            t.classList.toggle('bk-tab-active', i === index);
        });

        this._renderShelf();
    }

    _switchPage(delta) {
        const cat = this._categories[this._currentCat];
        if (!cat) return;

        const booksPerPage = this._booksPerShelf * this._shelvesPerPage;
        const totalPages = Math.max(1, Math.ceil(cat.books.length / booksPerPage));

        this._currentPage += delta;
        if (this._currentPage < 0) this._currentPage = totalPages - 1;
        if (this._currentPage >= totalPages) this._currentPage = 0;

        this._renderShelf();
    }

    // ---- Static CSS ----

    static CSS = `
/* ========== Root ========== */
.bk-root {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 100;
    overflow: hidden; /* clips to game container */
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Excalifont', sans-serif;
}

/* ========== Main Panel ========== */
.bk-panel {
    width: 640px;
    height: 510px;
    background: linear-gradient(180deg, #4A2E15 0%, #3E2418 100%);
    border-radius: 10px;
    border: 4px solid #2A1A0A;
    box-shadow:
        0 0 0 1px rgba(255, 200, 100, 0.08),
        0 12px 40px rgba(0, 0, 0, 0.7),
        inset 0 1px 0 rgba(255, 200, 100, 0.06);
    display: flex;
    flex-direction: column;
    overflow: visible; /* Fix #6: allow tooltips to extend outside panel */
    position: relative;
}

/* Wood grain texture */
.bk-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background:
        repeating-linear-gradient(
            87deg,
            transparent,
            transparent 6px,
            rgba(0, 0, 0, 0.04) 6px,
            rgba(0, 0, 0, 0.04) 7px
        ),
        repeating-linear-gradient(
            93deg,
            transparent,
            transparent 11px,
            rgba(255, 200, 100, 0.02) 11px,
            rgba(255, 200, 100, 0.02) 12px
        );
    pointer-events: none;
    z-index: 0;
}

/* ========== Category Tabs ========== */
.bk-tabs {
    display: flex;
    gap: 2px;
    padding: 10px 16px 0;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 3px solid #2A1A0A;
    position: relative;
    z-index: 1;
    flex-wrap: wrap;
    max-height: 68px; /* Fix #9: cap at ~2 rows to prevent crushing shelf area */
    overflow: hidden;
}

.bk-tab {
    padding: 6px 16px;
    font-size: 13px;
    color: rgba(255, 220, 160, 0.5);
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    border: 1px solid transparent;
    border-bottom: none;
    transition: all 0.2s ease;
    user-select: none;
    font-family: 'Pixel32_CN', 'Excalifont', sans-serif;
    position: relative;
    top: 3px;
    white-space: nowrap;
}

.bk-tab:hover {
    color: rgba(255, 220, 160, 0.85);
    background: rgba(255, 200, 100, 0.06);
}

.bk-tab-active {
    color: #FFD88A;
    background: linear-gradient(180deg, rgba(255, 200, 100, 0.12), transparent);
    border-color: rgba(255, 200, 100, 0.15);
    text-shadow: 0 0 10px rgba(255, 200, 100, 0.3);
}

/* ========== Shelf Area ========== */
.bk-shelf-area {
    flex: 1;
    padding: 40px 20px 30px; /* Fix #6: extra bottom padding for tooltip space */
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    z-index: 1;
    overflow: visible;
}

/* Side panels (left & right wooden edges) */
.bk-shelf-area::before,
.bk-shelf-area::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    width: 12px;
    background: linear-gradient(90deg, #3E2418, #5C3A1E 50%, #3E2418);
    z-index: 5;
    pointer-events: none;
}
.bk-shelf-area::before { left: 4px; }
.bk-shelf-area::after  { right: 4px; }

/* ========== Single Shelf ========== */
.bk-shelf {
    display: flex;
    flex-direction: column;
}

.bk-book-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    padding: 0 20px;
    min-height: 120px;
}

/* ========== Individual Book ========== */
.bk-book {
    position: relative;
    cursor: pointer;
    transition: transform 0.2s ease;
    flex-shrink: 0;
}

.bk-book:hover {
    transform: translateY(-10px) rotate(-2deg);
    z-index: 10;
}

.bk-cover {
    width: 78px;
    height: 110px;
    object-fit: cover;
    border-radius: 2px 5px 5px 2px;
    display: block;
    box-shadow:
        3px 3px 8px rgba(0, 0, 0, 0.6),
        -1px 0 3px rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 0, 0, 0.5);
}

/* Spine highlight */
.bk-book::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg,
        rgba(255, 255, 255, 0.2),
        rgba(255, 255, 255, 0.05) 50%,
        rgba(0, 0, 0, 0.15));
    border-radius: 2px 0 0 2px;
    pointer-events: none;
    z-index: 1;
}

/* ========== Tooltip (below book) ========== */
.bk-tooltip {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 8, 3, 0.95);
    color: #FFD88A;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    border: 1px solid rgba(255, 200, 100, 0.25);
    font-family: 'Pixel32_CN', 'Excalifont', sans-serif;
    z-index: 30;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* Arrow pointing up */
.bk-tooltip::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-bottom-color: rgba(15, 8, 3, 0.95);
}

.bk-book:hover .bk-tooltip {
    opacity: 1;
}

/* ========== Shelf Board (wooden plank) ========== */
.bk-board {
    height: 14px;
    background: linear-gradient(180deg,
        #7A5233 0%,
        #6B4226 20%,
        #5C3A1E 60%,
        #4A2E15 100%);
    border-radius: 0 0 3px 3px;
    box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 200, 100, 0.12),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
    position: relative;
    margin: 0 12px;
}

/* Front lip of shelf */
.bk-board::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 0; right: 0;
    height: 6px;
    background: linear-gradient(180deg, #4A2E15, #3A2210);
    border-radius: 0 0 3px 3px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* ========== Pagination ========== */
.bk-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px 0 16px;
    position: relative;
    z-index: 1;
}

.bk-page-btn {
    width: 36px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 200, 100, 0.08);
    border: 1px solid rgba(255, 200, 100, 0.2);
    border-radius: 4px;
    color: #FFD88A;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
}

.bk-page-btn:hover {
    background: rgba(255, 200, 100, 0.18);
    border-color: rgba(255, 200, 100, 0.4);
    transform: scale(1.05);
}

.bk-page-label {
    color: rgba(255, 220, 160, 0.7);
    min-width: 50px;
    text-align: center;
    font-family: 'PressStart2P', monospace;
    font-size: 10px;
}

/* ========== Empty / Loading state ========== */
.bk-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 220, 160, 0.4);
    font-size: 14px;
    padding: 40px;
}

/* ========== Close Button ========== */
.bk-close {
    position: absolute;
    top: 12px;
    right: 16px;
    font-size: 20px;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 0.2s, background 0.2s;
    font-family: sans-serif;
    z-index: 20;
}

.bk-close:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
}
`;
}
