class ComputerApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this.screenEl = document.getElementById('computer-screen');
        this.desktopEl = document.getElementById('desktop-icons');
        this.windowsEl = document.getElementById('desktop-windows');
        this.dockEl = document.getElementById('app-dock');
        this.clockEl = document.getElementById('desktop-clock');
        this.desktopAreaEl = document.getElementById('computer-desktop');

        this.activeWindows = [];
        this.focusedWindowId = null;
        this.clockTimer = null;
        this.shiftActive = false;
        this.dragState = null;
        this._resolve = null;

        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
    }

    // ---- 入口 ----
    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this.screenEl.classList.add('visible');
            this.renderDesktop();
            this.renderDock();
            this.startClock();

            // 清除游戏界面残留的按键高亮
            document.querySelectorAll('.key-cap.active').forEach(el => el.classList.remove('active'));

            // 禁用 Phaser 键盘，防止游戏按键穿透
            if (this.scene.input && this.scene.input.keyboard) {
                this.scene.input.keyboard.enabled = false;
            }

            // 点击桌面空白处取消选中图标和 dock 高亮
            this.desktopAreaEl.addEventListener('click', (e) => {
                if (e.target === this.desktopAreaEl || e.target === this.desktopEl) {
                    this.desktopEl.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
                    this.focusedWindowId = null;
                    this.updateWindowFocus();
                    this.renderDock();
                }
            });

            document.addEventListener('keydown', this._onKeyDown);
            document.addEventListener('keyup', this._onKeyUp);
            document.addEventListener('mousemove', this._onMouseMove);
            document.addEventListener('mouseup', this._onMouseUp);
        });
    }

    // ---- 出口 ----
    close() {
        this.screenEl.classList.remove('visible');
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);

        // 恢复 Phaser 键盘（不调用 reset，避免清空按键状态导致无法移动）
        if (this.scene.input && this.scene.input.keyboard) {
            this.scene.input.keyboard.enabled = true;
        }
        if (this.clockTimer) clearInterval(this.clockTimer);
        if (this.batteryTimer) clearInterval(this.batteryTimer);
        const topbar = document.getElementById('desktop-topbar');
        if (topbar) topbar.remove();
        this.activeWindows = [];
        this.focusedWindowId = null;
        this.windowsEl.innerHTML = '';
        this.dockEl.innerHTML = '';
        this.shiftActive = false;
        this.screenEl.classList.remove('maximized-mode');
        this._clearAllPressed();

        // 清除外部操作指南按键残留高亮
        document.querySelectorAll('.key-cap.active').forEach(el => el.classList.remove('active'));

        if (this._resolve) this._resolve();
    }

    // ---- 物理键盘 ----
    _onKeyDown(e) {
        if (e.key === 'Escape') { this.close(); return; }

        const active = document.activeElement;
        const isInput = active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT');

        if (isInput) {
            // 输入框内：阻止冒泡到 Phaser 键盘监听器，让浏览器正常处理输入
            e.stopPropagation();
            return;
        }

        this._highlightPhysicalKey(e);
        e.preventDefault();
        e.stopPropagation();
    }

    _onKeyUp(e) {
        const keyMap = {
            'w': 'key-w', 'a': 'key-a', 's': 'key-s', 'd': 'key-d',
            'e': 'key-e', 'Escape': 'key-esc', 'Enter': 'key-enter'
        };
        const id = keyMap[e.key];
        if (id) {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        }
    }

    _highlightPhysicalKey(e) {
        const keyMap = {
            'w': 'key-w', 'a': 'key-a', 's': 'key-s', 'd': 'key-d',
            'e': 'key-e', 'Escape': 'key-esc', 'Enter': 'key-enter'
        };
        const id = keyMap[e.key];
        if (id) {
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        }
    }

    _clearAllPressed() {
        // 高亮清除逻辑已在 close() 中通过 DOM querySelectorAll 处理
    }

    // ---- 顶栏（时钟 + 状态图标）----
    startClock() {
        // 移除旧时钟和旧顶栏
        if (this.clockEl) this.clockEl.remove();
        const old = document.getElementById('desktop-topbar');
        if (old) old.remove();

        // 创建顶栏
        const topbar = document.createElement('div');
        topbar.id = 'desktop-topbar';

        // 左侧占位
        const left = document.createElement('div');
        left.className = 'topbar-left';

        // 中间时钟
        const center = document.createElement('div');
        center.className = 'topbar-center';
        this.clockEl = document.createElement('span');
        center.appendChild(this.clockEl);

        // 右侧状态图标
        const right = document.createElement('div');
        right.className = 'topbar-right';

        // 蓝牙
        const bt = document.createElement('img');
        bt.className = 'status-icon status-bt';
        bt.src = 'assets/bluetooth.svg';
        bt.alt = 'Bluetooth';

        // WiFi
        const wifi = document.createElement('img');
        wifi.className = 'status-icon status-wifi';
        wifi.src = 'assets/wifi.svg';
        wifi.alt = 'WiFi';

        // 电池（图标 + 百分比）
        this.batteryLevel = 22;
        this.batteryCharging = true;
        this.batteryEl = document.createElement('span');
        this.batteryEl.className = 'status-icon status-battery';
        this.batteryIcon = document.createElement('img');
        this.batteryIcon.src = 'assets/battery.svg';
        this.batteryIcon.alt = 'Battery';
        this.batteryText = document.createElement('span');
        this.batteryText.className = 'battery-percent';
        this.batteryEl.appendChild(this.batteryIcon);
        this.batteryEl.appendChild(this.batteryText);
        this._updateBattery();

        right.appendChild(bt);
        right.appendChild(wifi);
        right.appendChild(this.batteryEl);

        topbar.appendChild(left);
        topbar.appendChild(center);
        topbar.appendChild(right);

        // 插入到桌面最前面
        const desktop = document.getElementById('computer-desktop');
        desktop.insertBefore(topbar, desktop.firstChild);

        // 时钟更新
        const update = () => {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            if (this.clockEl) this.clockEl.textContent = h + ':' + m;
        };
        update();
        this.clockTimer = setInterval(update, 1000);

        // 电池充电（每30秒+1%，到100%停止充电）
        this.batteryTimer = setInterval(() => {
            if (!this.batteryCharging) return;
            this.batteryLevel++;
            if (this.batteryLevel >= 100) {
                this.batteryLevel = 100;
                this.batteryCharging = false;
            }
            this._updateBattery();
        }, 30000);
    }

    _updateBattery() {
        this.batteryIcon.src = this.batteryCharging ? 'assets/battery.svg' : 'assets/battery_100.svg';
        this.batteryText.textContent = this.batteryLevel + '%';
    }

    // ---- 桌面图标 ----
    renderDesktop() {
        this.desktopEl.innerHTML = '';
        const icons = [
            { id: 'terminal', label: 'Terminal', icon: 'assets/terminal.svg' },
            { id: 'browser', label: 'Browser', icon: 'assets/browser.svg' },
            { id: 'readme', label: 'README', icon: 'assets/MarkdownLogo.svg' }
        ];

        icons.forEach(icon => {
            const el = document.createElement('div');
            el.className = 'desktop-icon';
            const img = document.createElement('img');
            img.className = 'desktop-icon-img';
            img.src = icon.icon;
            img.alt = icon.label;
            const label = document.createElement('div');
            label.className = 'desktop-icon-label';
            label.textContent = icon.label;
            el.appendChild(img);
            el.appendChild(label);
            el.addEventListener('dblclick', () => this.openWindow(icon.id));
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.desktopEl.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
            });
            this.desktopEl.appendChild(el);
        });
    }

    // ---- 右侧浮动 Dock ----
    renderDock() {
        this.dockEl.innerHTML = '';
        if (this.activeWindows.length === 0) return;

        const dockIcons = { terminal: 'assets/terminal.svg', browser: 'assets/browser.svg', readme: 'assets/MarkdownLogo.svg' };

        this.activeWindows.forEach(w => {
            const item = document.createElement('div');
            item.className = 'dock-item' + (w.id === this.focusedWindowId ? ' active' : '');
            if (w.minimized) item.classList.add('minimized-item');
            item.title = this.getAppTitle(w.id);

            if (dockIcons[w.id]) {
                const img = document.createElement('img');
                img.src = dockIcons[w.id];
                img.style.width = '20px';
                img.style.height = '20px';
                img.style.imageRendering = 'pixelated';
                item.appendChild(img);
            } else {
                item.textContent = this.getAppSymbol(w.id);
            }

            const dot = document.createElement('div');
            dot.className = 'dock-dot';
            item.appendChild(dot);

            item.addEventListener('click', () => {
                if (w.minimized) {
                    this.restoreWindow(w.id);
                } else if (this.focusedWindowId === w.id) {
                    this.minimizeWindow(w.id);
                } else {
                    this.focusWindow(w.id);
                }
            });
            this.dockEl.appendChild(item);
        });
    }

    getAppSymbol(appId) {
        const symbols = { terminal: '>_', browser: '🌐', readme: '📄' };
        return symbols[appId] || '?';
    }

    // ---- 窗口管理 ----
    openWindow(appId) {
        const existing = this.activeWindows.find(w => w.id === appId);
        if (existing) {
            if (existing.minimized) this.restoreWindow(appId);
            else this.focusWindow(appId);
            return;
        }

        const win = document.createElement('div');
        let extraClass = '';
        if (appId === 'browser') extraClass = ' browser-window';
        else if (appId === 'readme') extraClass = ' readme-window';
        win.className = 'computer-window' + extraClass;
        win.dataset.appId = appId;

        // 标题栏
        const titlebar = document.createElement('div');
        titlebar.className = 'computer-window-titlebar';
        const title = document.createElement('span');
        title.className = 'computer-window-title';
        title.textContent = this.getAppTitle(appId);

        const controls = document.createElement('div');
        controls.className = 'computer-window-controls';

        const minBtn = document.createElement('span');
        minBtn.className = 'win-btn win-btn-min';
        minBtn.textContent = '–';
        minBtn.addEventListener('click', (e) => { e.stopPropagation(); this.minimizeWindow(appId); });

        const maxBtn = document.createElement('span');
        maxBtn.className = 'win-btn win-btn-max';
        maxBtn.textContent = '□';
        maxBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(appId); });

        const closeBtn = document.createElement('span');
        closeBtn.className = 'win-btn win-btn-close';
        closeBtn.textContent = 'X';
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closeWindow(appId); });

        controls.appendChild(minBtn);
        controls.appendChild(maxBtn);
        controls.appendChild(closeBtn);
        titlebar.appendChild(title);
        titlebar.appendChild(controls);

        // 拖动
        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.win-btn')) return;
            const winState = this.activeWindows.find(w => w.id === appId);
            if (winState && winState.maximized) return;
            this.dragState = {
                appId: appId,
                startX: e.clientX - win.offsetLeft,
                startY: e.clientY - win.offsetTop
            };
            this.focusWindow(appId);
        });

        const body = document.createElement('div');
        body.className = 'computer-window-body';

        win.appendChild(titlebar);
        win.appendChild(body);
        this.windowsEl.appendChild(win);

        // 居中偏下
        const desktopRect = this.desktopEl.parentElement.getBoundingClientRect();
        const w = 420, h = 240;
        win.style.width = w + 'px';
        win.style.height = h + 'px';
        win.style.left = Math.max(0, (desktopRect.width - w) / 2) + 'px';
        win.style.top = Math.max(26, (desktopRect.height - h) / 2 + 20) + 'px';

        this.activeWindows.push({ id: appId, el: win, bodyEl: body, minimized: false, maximized: false });
        this.focusWindow(appId);
        this.renderDock();
        this.loadAppContent(appId, body);
    }

    closeWindow(appId) {
        const idx = this.activeWindows.findIndex(w => w.id === appId);
        if (idx === -1) return;
        // 清理 BrowserApp
        if (appId === 'browser' && this.browserApp) {
            this.browserApp.destroy();
            this.browserApp = null;
        }
        this.activeWindows[idx].el.remove();
        this.activeWindows.splice(idx, 1);
        if (this.focusedWindowId === appId) {
            this.focusedWindowId = this.activeWindows.length > 0 ? this.activeWindows[this.activeWindows.length - 1].id : null;
        }
        const anyMaximized = this.activeWindows.some(x => x.maximized);
        this.screenEl.classList.toggle('maximized-mode', anyMaximized);
        this.updateWindowFocus();
        this.renderDock();
    }

    minimizeWindow(appId) {
        const w = this.activeWindows.find(w => w.id === appId);
        if (!w) return;
        w.minimized = true;
        w.el.classList.add('minimized');
        if (this.focusedWindowId === appId) {
            const visible = this.activeWindows.filter(x => !x.minimized && x.id !== appId);
            this.focusedWindowId = visible.length > 0 ? visible[visible.length - 1].id : null;
        }
        this.updateWindowFocus();
        this.renderDock();
    }

    restoreWindow(appId) {
        const w = this.activeWindows.find(w => w.id === appId);
        if (!w) return;
        w.minimized = false;
        w.el.classList.remove('minimized');
        this.focusWindow(appId);
        this.renderDock();
    }

    toggleMaximize(appId) {
        const w = this.activeWindows.find(w => w.id === appId);
        if (!w) return;
        w.maximized = !w.maximized;
        w.el.classList.toggle('maximized', w.maximized);
        // 最大化时隐藏 dock 和键盘
        const anyMaximized = this.activeWindows.some(x => x.maximized);
        this.screenEl.classList.toggle('maximized-mode', anyMaximized);
        this.focusWindow(appId);
    }

    focusWindow(appId) {
        this.focusedWindowId = appId;
        this.updateWindowFocus();
        this.renderDock();
    }

    updateWindowFocus() {
        this.activeWindows.forEach(w => {
            w.el.classList.toggle('focused', w.id === this.focusedWindowId);
            if (w.id === this.focusedWindowId) {
                this.windowsEl.appendChild(w.el);
            }
        });
    }

    _onMouseMove(e) {
        if (!this.dragState) return;
        const win = this.activeWindows.find(w => w.id === this.dragState.appId);
        if (!win) return;

        const rect = this.windowsEl.getBoundingClientRect();
        const winW = win.el.offsetWidth;
        const winH = win.el.offsetHeight;

        let x = e.clientX - this.dragState.startX;
        let y = e.clientY - this.dragState.startY;

        // 限制窗口不超出桌面区域，顶部不遮挡顶栏（26px）
        x = Math.max(0, Math.min(x, rect.width - winW));
        y = Math.max(26, Math.min(y, rect.height - winH));

        win.el.style.left = x + 'px';
        win.el.style.top = y + 'px';
    }

    _onMouseUp() { this.dragState = null; }

    getAppTitle(appId) {
        const titles = { terminal: 'Terminal', browser: 'Browser', readme: 'README' };
        return titles[appId] || appId;
    }

    loadAppContent(appId, bodyEl) {
        switch (appId) {
            case 'terminal': this.renderTerminal(bodyEl); break;
            case 'browser':
                if (!this.browserApp) this.browserApp = new BrowserApp(this.scene);
                this.browserApp.render(bodyEl);
                break;
            case 'readme': this.renderReadme(bodyEl); break;
        }
    }

    // ---- Terminal ----
    async renderTerminal(bodyEl) {
        // 加载命令配置
        let commands = {};
        let promptText = 'turingzy@zy-house:~$';
        try {
            const resp = await fetch('conf/linux-commands.json');
            commands = await resp.json();
            if (commands.prompt) promptText = commands.prompt;
        } catch (e) {
            console.warn('Failed to load linux-commands.json:', e);
        }

        const output = document.createElement('div');
        output.className = 'terminal-output';

        const inputLine = document.createElement('div');
        inputLine.className = 'terminal-input-line';
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = promptText;
        const input = document.createElement('input');
        input.className = 'terminal-input';
        input.type = 'text';
        input.spellcheck = false;
        inputLine.appendChild(prompt);
        inputLine.appendChild(input);
        bodyEl.appendChild(output);
        bodyEl.appendChild(inputLine);

        const getOutput = (cmd, raw) => {
            const val = commands[cmd];
            if (val === '__CLEAR__') return null;
            if (val === '__DATE__') return new Date().toLocaleString('zh-CN');
            if (val === '__ECHO__') return raw;
            return val || null;
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const raw = input.value.trim();
                if (raw) {
                    const line = document.createElement('div');
                    line.textContent = promptText + ' ' + raw;
                    output.appendChild(line);

                    const parts = raw.split(/\s+/);
                    const cmd = parts[0].toLowerCase();
                    const arg = parts.slice(1).join(' ');

                    if (cmd === 'clear') {
                        output.innerHTML = '';
                    } else if (cmd === 'echo') {
                        const echo = document.createElement('div');
                        echo.textContent = arg;
                        output.appendChild(echo);
                    } else if (cmd === 'cat') {
                        const result = document.createElement('div');
                        result.textContent = getOutput('cat', arg) || 'cat: ' + (arg || '') + ': No such file or directory';
                        result.style.color = '#aaa';
                        output.appendChild(result);
                    } else {
                        const result = document.createElement('div');
                        const out = getOutput(cmd, raw);
                        result.textContent = out || 'command not found: ' + cmd;
                        result.style.color = out ? '' : '#aaa';
                        output.appendChild(result);
                    }
                    bodyEl.scrollTop = bodyEl.scrollHeight;
                }
                input.value = '';
            }
        });
        // 点击终端任意区域聚焦输入框
        const focusInput = () => input.focus();
        bodyEl.addEventListener('click', focusInput);
        output.addEventListener('click', focusInput);
        focusInput();
    }

    // ---- README ----
    async renderReadme(bodyEl) {
        bodyEl.classList.add('readme-body');

        let content = '# README\n内容加载失败';
        try {
            const resp = await fetch('conf/readme.md');
            content = await resp.text();
        } catch (e) {
            console.warn('Failed to load readme.md:', e);
        }

        // 简单 Markdown 转 HTML
        const html = this.mdToHtml(content);
        const container = document.createElement('div');
        container.className = 'readme-content';
        container.innerHTML = html;
        bodyEl.appendChild(container);
    }

    mdToHtml(md) {
        let html = md
            // 标题
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // 粗体
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // 表格行
            .replace(/^\|(.+)\|$/gm, (match, content) => {
                const cells = content.split('|').map(c => c.trim());
                if (cells.every(c => /^-+$/.test(c))) return '';
                const tag = 'td';
                return '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
            })
            // 列表项
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            // 段落（非标签行）
            .replace(/^(?!<)(.+)$/gm, '<p>$1</p>')
            // 空行
            .replace(/\n\n/g, '\n');

        // 包裹表格行
        html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>');
        // 包裹列表项
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        return html;
    }
}
