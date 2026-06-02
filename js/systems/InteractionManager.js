class InteractionManager {
    constructor(scene, map, player, config) {
        this.scene = scene;
        this.player = player;
        this.interactDistance = 40;
        this.interactables = [];
        this.nearest = null;
        this.config = config || {};

        // 应用状态
        this.appActive = false;
        this.computerApp = null;
        this.mirrorApp = null;
        this.televisionApp = null;
        this.bookshelfApp = null;
        this.windowApp = null;

        // 对话状态
        this.dialogueActive = false;
        this.currentLines = [];
        this.currentLine = 0;
        this.currentName = '';
        this.typewriterTimer = null;
        this.typewriterDone = false;
        this.fullText = '';

        this.promptEl = document.getElementById('interact-prompt');
        this.dialogueEl = document.getElementById('dialogue-box');
        this.dialogueNameEl = document.getElementById('dialogue-name');
        this.dialogueTextEl = document.getElementById('dialogue-text');
        this.dialogueHintEl = document.getElementById('dialogue-hint');

        this.loadInteractables(map);
    }

    loadInteractables(map) {
        const layer = map.getObjectLayer('collision_boxes');
        if (!layer) return;

        layer.objects.forEach(obj => {
            // 只处理有配置的对象
            const cfg = this.config[obj.id];
            if (!cfg) return;

            // 跳过退化对象
            if (obj.polygon && obj.polygon.every(p => p.x === 0 && p.y === 0)) return;

            let cx = obj.x;
            let cy = obj.y;

            if (obj.polygon && obj.polygon.length > 0) {
                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;
                obj.polygon.forEach(p => {
                    minX = Math.min(minX, p.x);
                    maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y);
                    maxY = Math.max(maxY, p.y);
                });
                cx = obj.x + (minX + maxX) / 2;
                cy = obj.y + (minY + maxY) / 2;
            } else {
                cx = obj.x + (obj.width || 0) / 2;
                cy = obj.y + (obj.height || 0) / 2;
            }

            this.interactables.push({
                x: cx * 2,
                y: cy * 2,
                id: obj.id,
                name: cfg.name || '',
                lines: cfg.lines || [],
                type: cfg.type || 'dialogue',
                appId: cfg.appId || null
            });
        });
    }

    update(cursors) {
        // 应用打开中：锁定，不处理输入
        if (this.appActive) return;

        // 对话中：Enter 推进，Esc 关闭
        if (this.dialogueActive) {
            if (Phaser.Input.Keyboard.JustDown(cursors.ENTER)) {
                this.advanceDialogue();
            } else if (Phaser.Input.Keyboard.JustDown(cursors.ESC)) {
                this.closeDialogue();
            }
            return;
        }

        this.findNearest();

        if (this.nearest) {
            this.showPrompt();
            if (Phaser.Input.Keyboard.JustDown(cursors.E)) {
                this.startDialogue();
            }
        } else {
            this.hidePrompt();
        }
    }

    findNearest() {
        this.nearest = null;
        let minDist = Infinity;

        // 玩家脚底位置（碰撞框在下半身）
        const px = this.player.x;
        const py = this.player.y + 16;

        this.interactables.forEach(obj => {
            const dx = px - obj.x;
            const dy = py - obj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.interactDistance && dist < minDist) {
                minDist = dist;
                this.nearest = obj;
            }
        });
    }

    showPrompt() {
        if (this.promptEl) this.promptEl.classList.add('visible');
    }

    hidePrompt() {
        if (this.promptEl) this.promptEl.classList.remove('visible');
    }

    startDialogue() {
        if (!this.nearest) return;
        const obj = this.nearest;

        // 应用类型交互
        if (obj.type === 'app') {
            this.launchApp(obj.appId);
            return;
        }

        if (!obj.lines || obj.lines.length === 0) return;

        this.currentName = obj.name;
        this.currentLines = obj.lines;
        this.currentLine = 0;
        this.dialogueActive = true;

        this.hidePrompt();
        this.showDialogue();
    }

    launchApp(appId) {
        this.appActive = true;
        this.hidePrompt();

        const resetActive = () => { this.appActive = false; };

        if (appId === 'computer') {
            if (!this.computerApp) {
                this.computerApp = new ComputerApp(this.scene);
            }
            this.computerApp.open().then(resetActive).catch(resetActive);
        } else if (appId === 'mirror') {
            if (!this.mirrorApp) {
                this.mirrorApp = new MirrorApp(this.scene);
            }
            this.mirrorApp.open().then(resetActive).catch(resetActive);
        } else if (appId === 'television') {
            if (!this.televisionApp) {
                this.televisionApp = new TelevisionApp(this.scene);
            }
            this.televisionApp.open().then(resetActive).catch(resetActive);
        } else if (appId === 'bookshelf') {
            if (!this.bookshelfApp) {
                this.bookshelfApp = new BookshelfApp(this.scene);
            }
            this.bookshelfApp.open().then(resetActive).catch(resetActive);
        } else if (appId === 'window') {
            if (!this.windowApp) {
                this.windowApp = new WindowApp(this.scene);
            }
            this.windowApp.open().then(resetActive).catch(resetActive);
        } else {
            // Unknown appId — don't leave appActive stuck
            this.appActive = false;
        }
    }

    showDialogue() {
        if (!this.dialogueEl || !this.dialogueNameEl || !this.dialogueTextEl || !this.dialogueHintEl) return;
        this.dialogueNameEl.textContent = this.currentName;
        this.fullText = this.currentLines[this.currentLine];
        this.dialogueTextEl.textContent = '';
        this.typewriterDone = false;
        this.dialogueHintEl.innerHTML = 'Enter <span class="arrow">▶</span>';

        this.dialogueEl.classList.add('visible');
        this.startTypewriter();
    }

    startTypewriter() {
        if (this.typewriterTimer) clearInterval(this.typewriterTimer);
        let i = 0;
        this.typewriterTimer = setInterval(() => {
            i++;
            this.dialogueTextEl.textContent = this.fullText.substring(0, i);
            if (i >= this.fullText.length) {
                clearInterval(this.typewriterTimer);
                this.typewriterTimer = null;
                this.typewriterDone = true;
            }
        }, 35);
    }

    advanceDialogue() {
        // 打字未完成 → 立即显示全文
        if (!this.typewriterDone) {
            if (this.typewriterTimer) clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
            this.dialogueTextEl.textContent = this.fullText;
            this.typewriterDone = true;
            return;
        }

        // 下一句或关闭
        this.currentLine++;
        if (this.currentLine >= this.currentLines.length) {
            this.closeDialogue();
        } else {
            this.showDialogue();
        }
    }

    closeDialogue() {
        if (this.typewriterTimer) {
            clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
        }
        if (this.dialogueEl) this.dialogueEl.classList.remove('visible');
        this.dialogueActive = false;
        this.currentLines = [];
        this.currentLine = 0;
        this.currentName = '';
        this.fullText = '';
        this.typewriterDone = false;
    }
}
