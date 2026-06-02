class BrowserApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    async render(bodyEl) {
        // 搜索区
        const searchBar = document.createElement('div');
        searchBar.className = 'browser-search';

        const searchIcon = document.createElement('img');
        searchIcon.className = 'browser-search-icon';
        searchIcon.src = 'assets/browser.svg';

        const urlInput = document.createElement('input');
        urlInput.className = 'browser-url-input';
        urlInput.type = 'text';
        urlInput.placeholder = '输入网址，按 Enter 跳转...';
        this.urlInput = urlInput;

        searchBar.appendChild(searchIcon);
        searchBar.appendChild(urlInput);

        // 内容显示区
        this.contentEl = document.createElement('div');
        this.contentEl.className = 'browser-content';

        bodyEl.appendChild(searchBar);
        bodyEl.appendChild(this.contentEl);

        // 加载常用网站
        await this.loadWebsites();

        // Enter 跳转
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                this.handleNavigate(urlInput.value.trim());
            }
        });

        document.addEventListener('keydown', this._onKeyDown);
        urlInput.focus();
    }

    async loadWebsites() {
        let sites = [];
        try {
            const resp = await fetch('conf/websites.json');
            sites = await resp.json();
        } catch (e) {
            console.warn('Failed to load websites.json:', e);
        }

        if (sites.length === 0) return;

        const section = document.createElement('div');
        section.className = 'browser-sites';

        const label = document.createElement('div');
        label.className = 'browser-sites-label';
        label.textContent = '常用网站';
        section.appendChild(label);

        const list = document.createElement('div');
        list.className = 'browser-sites-list';
        sites.forEach(site => {
            const item = document.createElement('div');
            item.className = 'browser-site-item';
            item.textContent = site.name;
            item.title = site.url;
            item.addEventListener('click', () => {
                this.urlInput.value = site.url;
                this.showConfirm(site.url);
            });
            list.appendChild(item);
        });
        section.appendChild(list);
        this.contentEl.appendChild(section);
    }

    handleNavigate(raw) {
        this.clearMsg();

        if (!raw) return;

        // 判断是否为 http/https 开头
        if (/^https?:\/\//i.test(raw)) {
            this.showConfirm(raw);
        } else {
            this.showError('请输入 http 或 https 开头的网址');
        }
    }

    showConfirm(url) {
        this.clearMsg();

        const msg = document.createElement('div');
        msg.className = 'browser-msg confirm';

        const text = document.createElement('div');
        text.className = 'browser-msg-text';
        text.textContent = url;

        const btn = document.createElement('button');
        btn.className = 'browser-jump-btn';
        btn.textContent = '确认跳转';
        btn.addEventListener('click', () => {
            window.open(url, '_blank');
        });

        msg.appendChild(text);
        msg.appendChild(btn);
        this.contentEl.prepend(msg);
    }

    showError(text) {
        this.clearMsg();

        const msg = document.createElement('div');
        msg.className = 'browser-msg error';
        msg.textContent = text;
        this.contentEl.prepend(msg);

        // 3秒后自动关闭
        this._msgTimer = setTimeout(() => {
            if (msg.parentElement) msg.remove();
        }, 3000);
    }

    clearMsg() {
        if (this._msgTimer) {
            clearTimeout(this._msgTimer);
            this._msgTimer = null;
        }
        const old = this.contentEl.querySelector('.browser-msg');
        if (old) old.remove();
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') return;
        e.stopPropagation();
    }

    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
    }
}
