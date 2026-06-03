class BookshelfApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._resolve = null;
        this._overlay = null;
        this._books = [];
        this._categories = [];
        this._currentCat = 0;
        this._currentPage = 0;
        this._booksPerShelf = 5;
        this._shelvesPerPage = 2;
        this._closed = false;
        this._pageLabel = null;
        this._prevBtn = null;
        this._nextBtn = null;
        this._shelfArea = null;
    }

    // ---- Lifecycle ----

    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this._closed = false;

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
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }
        this._tabBar = null;
        this._pageLabel = null;
        this._prevBtn = null;
        this._nextBtn = null;
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

        this._prevBtn = document.createElement('div');
        this._prevBtn.className = 'bk-page-btn';
        this._prevBtn.textContent = '◀';
        this._prevBtn.addEventListener('click', () => this._switchPage(-1));

        this._pageLabel = document.createElement('span');
        this._pageLabel.className = 'bk-page-label';

        this._nextBtn = document.createElement('div');
        this._nextBtn.className = 'bk-page-btn';
        this._nextBtn.textContent = '▶';
        this._nextBtn.addEventListener('click', () => this._switchPage(1));

        pagination.appendChild(this._prevBtn);
        pagination.appendChild(this._pageLabel);
        pagination.appendChild(this._nextBtn);

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
        if (this._pageLabel) this._pageLabel.textContent = '0 / 0';
        if (this._prevBtn) this._prevBtn.classList.add('bk-page-disabled');
        if (this._nextBtn) this._nextBtn.classList.add('bk-page-disabled');
    }

    _buildTabs(activeIndex = 0) { // Fix #2: separated so tabs can be built after data loads
        this._tabBar.innerHTML = '';
        this._categories.forEach((cat, i) => {
            const tab = document.createElement('div');
            tab.className = 'bk-tab' + (i === activeIndex ? ' bk-tab-active' : '');
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
        if (this._tabBar.children.length === 0) this._buildTabs(this._currentCat);

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
        const singlePage = totalPages <= 1;
        if (this._pageLabel) {
            this._pageLabel.textContent = `${this._currentPage + 1} / ${totalPages}`;
        }
        if (this._prevBtn) this._prevBtn.classList.toggle('bk-page-disabled', singlePage);
        if (this._nextBtn) this._nextBtn.classList.toggle('bk-page-disabled', singlePage);
    }

    _switchCategory(index) {
        if (index < 0 || index >= this._categories.length) return;
        this._currentCat = index;
        this._currentPage = 0;

        // Update tab active state
        const tabs = this._tabBar.querySelectorAll('.bk-tab');
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

}
