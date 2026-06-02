class LoadingScene extends Phaser.Scene {
    constructor() {
        super('LoadingScene');
    }

    preload() {
        this.el = document.getElementById('loading-screen');
        if (!this.el) return;

        this.bar = document.getElementById('loading-bar-fill');
        this.percent = document.getElementById('loading-percent');
        this.status = document.getElementById('loading-status');

        this.el.classList.add('visible');
        this.statusIndex = 0;
        this.statusTexts = ['世界生成中.', '世界生成中..', '世界生成中...'];
        this.startTime = Date.now();
        this.minDuration = 2500;
        this.loadDone = false;
        this.timerDone = false;
        this.completed = false;

        // 状态文字循环
        this.statusTimer = this.time.addEvent({
            delay: 500,
            callback: () => {
                this.statusIndex = (this.statusIndex + 1) % this.statusTexts.length;
                if (this.status) this.status.textContent = this.statusTexts[this.statusIndex];
            },
            loop: true
        });

        // 加载资源列表（与 GameScene tilesetConfigs 保持同步）
        const tilesetFiles = [
            { key: 'Floor',                        file: 'Floor.png',                        fw: 16, fh: 16 },
            { key: 'Room_Builder_free_16x16',      file: 'Room_Builder_free_16x16.png',      fw: 16, fh: 16 },
            { key: 'Interiors_free_16x16',         file: 'Interiors_free_16x16.png',         fw: 16, fh: 16 },
            { key: 'Furniture',                    file: 'Furniture.png',                    fw: 16, fh: 16 },
            { key: '0-Tileset',                    file: '0-Tileset.png',                    fw: 16, fh: 16 },
            { key: 'Objects',                      file: 'Objects.png',                      fw: 16, fh: 16 },
            { key: 'Flatscreen_TV',                file: 'Flatscreen_TV.png',                fw: 16, fh: 16 }
        ];

        // 加权进度：小文件 20%，BGM 80%
        const TOTAL_FILES = tilesetFiles.length + 4;  // tilesets + map + interactables + player + bgm
        const BGM_INDEX = TOTAL_FILES - 1;
        const SMALL_RATIO = 0.20;
        let loadedCount = 0;
        this.realProgress = 0;

        const onFileDone = () => {
            loadedCount++;
            if (loadedCount <= BGM_INDEX) {
                this.realProgress = (loadedCount / BGM_INDEX) * SMALL_RATIO;
            } else {
                this.realProgress = 1;
            }
        };

        this.load.on('progress', onFileDone);
        this.load.on('loaderror', onFileDone);  // 加载失败也计入进度，防止卡死

        // 平滑动画
        this.displayProgress = 0;
        this.progressTimer = this.time.addEvent({
            delay: 16,
            callback: () => this.tick(),
            loop: true
        });

        // ---- 加载资源 ----
        this.load.tilemapTiledJSON('map', 'assets/map.json');

        for (const ts of tilesetFiles) {
            this.load.spritesheet(ts.key, `assets/${ts.file}`, {
                frameWidth: ts.fw,
                frameHeight: ts.fh
            });
        }

        this.load.json('interactables', 'conf/interactables.json');

        this.load.spritesheet('player', 'assets/player.png', {
            frameWidth: 16,
            frameHeight: 32
        });

        this.load.audio('bgm', 'assets/bursanchank-pixelated-game-vibe-music-450640.mp3');
    }

    create() {
        this.loadDone = true;
        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, this.minDuration - elapsed);
        this.time.delayedCall(remaining, () => {
            this.timerDone = true;
        });
    }

    tick() {
        if (this.completed) return;

        let target;
        if (!this.loadDone) {
            target = this.realProgress * 90;
        } else if (!this.timerDone) {
            target = 90;
        } else {
            target = 100;
        }

        this.displayProgress += (target - this.displayProgress) * 0.05;

        const pct = Math.min(Math.round(this.displayProgress), 100);
        if (this.bar) this.bar.style.width = pct + '%';
        if (this.percent) this.percent.textContent = pct + '%';

        if (pct >= 100 && !this.completed) {
            this.completed = true;
            this.onComplete();
        }
    }

    onComplete() {
        if (this.progressTimer) this.progressTimer.remove();
        if (this.statusTimer) this.statusTimer.remove();
        if (this.status) this.status.textContent = '加载完成';

        this.time.delayedCall(600, () => {
            this.el.classList.remove('visible');
            this.scene.start('GameScene');
        });
    }
}
