class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        const map = this.make.tilemap({ key: 'map' });

        // 注意：此列表需与 LoadingScene.preload() 中的 tilesetFiles 保持同步
        const tilesetConfigs = [
            { name: 'Floor',                       spacing: 0 },
            { name: 'Room_Builder_free_16x16',     spacing: 0 },
            { name: 'Interiors_free_16x16',        spacing: 0 },
            { name: 'Furniture',                   spacing: 0 },
            { name: '0-Tileset',                   spacing: 0 },
            { name: 'Objects',                     spacing: 0 },
            { name: 'Flatscreen_TV',               spacing: 0 }
        ];

        const tilesets = tilesetConfigs.map(cfg =>
            map.addTilesetImage(cfg.name, cfg.name, 16, 16, 0, cfg.spacing)
        );

        // 创建图层（带空值检查）
        const layerNames = ['ground', 'on the ground', 'wall', 'on the object', 'roof'];
        const layers = layerNames.map(name => {
            const layer = map.createLayer(name, tilesets, 0, 0);
            if (!layer) console.warn(`Layer "${name}" not found`);
            return layer;
        });
        layers.forEach(l => { if (l) l.setScale(2); });

        const [groundLayer, onGroundLayer, wallLayer, onObjectLayer, roofLayer] = layers;

        // ---- 碰撞组 ----
        const collisionGroup = this.physics.add.staticGroup();

        // ---- 图块集 objectgroup 碰撞（按精确矩形，去重）----
        const tileCollisionMap = {};
        map.tilesets.forEach(ts => {
            const tileData = ts.tileData || {};
            for (const localId in tileData) {
                if (tileData[localId].objectgroup) {
                    const gid = ts.firstgid + parseInt(localId);
                    tileCollisionMap[gid] = tileData[localId].objectgroup.objects || [];
                }
            }
        });

        const collidedTiles = new Set();
        const allLayers = layers.filter(Boolean);
        allLayers.forEach(layer => {
            layer.forEachTile(tile => {
                if (tile.index <= 0) return;
                const key = `${tile.x},${tile.y}`;
                if (collidedTiles.has(key)) return;
                const shapes = tileCollisionMap[tile.index];
                if (!shapes) return;
                collidedTiles.add(key);

                shapes.forEach(shape => {
                    if (!shape.width || !shape.height) return;
                    const cx = (tile.x * 16 + shape.x + shape.width / 2) * 2;
                    const cy = (tile.y * 16 + shape.y + shape.height / 2) * 2;
                    const body = collisionGroup.create(cx, cy);
                    body.setVisible(false);
                    body.body.setSize(shape.width * 2, shape.height * 2);
                    body.body.setOffset(
                        (body.width - shape.width * 2) / 2,
                        (body.height - shape.height * 2) / 2
                    );
                });
            });
        });

        // ---- collision_boxes 对象层 ----
        const collisionLayer = map.getObjectLayer('collision_boxes');
        if (collisionLayer) {
            collisionLayer.objects.forEach(obj => {
                if (!obj.width || !obj.height) return;
                const cx = (obj.x + obj.width / 2) * 2;
                const cy = (obj.y + obj.height / 2) * 2;
                const w = obj.width * 2;
                const h = obj.height * 2;
                const body = collisionGroup.create(cx, cy);
                body.setVisible(false);
                body.body.setSize(w, h);
                body.body.setOffset(
                    (body.width - w) / 2,
                    (body.height - h) / 2
                );
            });
        }

        // ---- 主角动画 ----
        this.anims.create({
            key: 'walk-down',
            frames: this.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 1] }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-left',
            frames: this.anims.generateFrameNumbers('player', { frames: [3, 4, 5, 4] }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-right',
            frames: this.anims.generateFrameNumbers('player', { frames: [6, 7, 8, 7] }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-up',
            frames: this.anims.generateFrameNumbers('player', { frames: [9, 10, 11, 10] }),
            frameRate: 8,
            repeat: -1
        });

        // ---- 主角 ----
        this.player = this.physics.add.sprite(180, 120, 'player', 1);
        this.player.setScale(2);
        this.player.setDepth(10);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(16, 16);
        this.player.body.setOffset(0, 16);
        this.lastDirection = 'down';
        this.idleFrames = { down: 1, left: 4, right: 7, up: 10 };

        // 添加碰撞
        allLayers.forEach(layer => {
            this.physics.add.collider(this.player, layer);
        });
        this.physics.add.collider(this.player, collisionGroup);

        // 世界边界 & 摄像机
        this.physics.world.setBounds(0, 0, map.width * 16 * 2, map.height * 16 * 2);
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setBounds(0, 0, map.width * 16 * 2, map.height * 16 * 2);

        // ---- 键盘输入 ----
        this.cursors = {
            W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
            ESC: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
            ENTER: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
        };

        // UI 按键元素引用
        this.keyEls = {
            W: document.getElementById('key-w'),
            A: document.getElementById('key-a'),
            S: document.getElementById('key-s'),
            D: document.getElementById('key-d'),
            E: document.getElementById('key-e'),
            ESC: document.getElementById('key-esc'),
            ENTER: document.getElementById('key-enter')
        };
        this.prevKeyState = {};

        // ---- 交互系统 ----
        try {
            const interactConfig = this.cache.json.get('interactables');
            this.interaction = new InteractionManager(this, map, this.player, interactConfig);
        } catch (e) {
            console.warn('InteractionManager init failed:', e);
        }

        // ---- 背景音乐 ----
        const volumeSlider = document.getElementById('bgm-volume');
        const volumePercent = document.getElementById('volume-percent');
        const bgmIcon = document.getElementById('bgm-toggle');
        const initVol = volumeSlider ? (parseInt(volumeSlider.value, 10) || 70) : 70;
        this.userPaused = false;

        try {
            this.bgm = this.sound.add('bgm', { loop: true, volume: initVol / 100 });
            this.bgm.play();
        } catch (e) {
            console.warn('BGM play failed:', e);
        }

        if (volumeSlider) volumeSlider.disabled = false;

        // 图标点击切换播放/暂停
        const onBgmToggle = () => {
            if (!this.bgm) return;
            if (this.bgm.isPlaying) {
                this.bgm.pause();
                this.userPaused = true;
                if (bgmIcon) { bgmIcon.textContent = '▶'; bgmIcon.classList.add('paused'); }
            } else {
                this.bgm.play();
                this.userPaused = false;
                if (bgmIcon) { bgmIcon.textContent = '♪'; bgmIcon.classList.remove('paused'); }
            }
        };
        if (bgmIcon) bgmIcon.addEventListener('click', onBgmToggle);

        // 音量滑块
        const onVolumeInput = () => {
            if (!this.bgm) return;
            const val = parseInt(volumeSlider.value, 10);
            this.bgm.setVolume(val / 100);
            if (volumePercent) volumePercent.textContent = val + '%';
            if (val > 0 && !this.bgm.isPlaying && !this.userPaused) {
                this.bgm.play();
                if (bgmIcon) { bgmIcon.textContent = '♪'; bgmIcon.classList.remove('paused'); }
            } else if (val === 0 && this.bgm.isPlaying) {
                this.bgm.pause();
                if (bgmIcon) { bgmIcon.textContent = '▶'; bgmIcon.classList.add('paused'); }
            }
        };
        if (volumeSlider) volumeSlider.addEventListener('input', onVolumeInput);

        // 场景关闭时清理事件监听器
        this.events.on('shutdown', () => {
            if (bgmIcon) bgmIcon.removeEventListener('click', onBgmToggle);
            if (volumeSlider) volumeSlider.removeEventListener('input', onVolumeInput);
        });
    }

    update() {
        // 电脑界面打开时，跳过游戏按键高亮
        const appActive = this.interaction && this.interaction.appActive;
        if (!appActive) {
            for (const [key, el] of Object.entries(this.keyEls)) {
                if (!el) continue;
                const isDown = this.cursors[key] && this.cursors[key].isDown;
                if (this.prevKeyState[key] !== isDown) {
                    el.classList.toggle('active', isDown);
                    this.prevKeyState[key] = isDown;
                }
            }
        }

        // 交互系统更新
        if (this.interaction) {
            // 电脑界面打开时，跳过交互系统和游戏输入
            if (this.interaction.appActive) {
                this.player.setVelocity(0, 0);
                this.player.anims.stop();
                this.player.setFrame(this.idleFrames[this.lastDirection]);
                return;
            }

            this.interaction.update(this.cursors);

            if (this.interaction.dialogueActive) {
                this.player.setVelocity(0, 0);
                this.player.anims.stop();
                this.player.setFrame(this.idleFrames[this.lastDirection]);
                return;
            }
        }

        const speed = 100;
        let vx = 0;
        let vy = 0;

        if (this.cursors.W.isDown) {
            vy = -speed;
            this.lastDirection = 'up';
            this.player.anims.play('walk-up', true);
        } else if (this.cursors.S.isDown) {
            vy = speed;
            this.lastDirection = 'down';
            this.player.anims.play('walk-down', true);
        }

        if (this.cursors.A.isDown) {
            vx = -speed;
            if (vy === 0) {
                this.lastDirection = 'left';
                this.player.anims.play('walk-left', true);
            }
        } else if (this.cursors.D.isDown) {
            vx = speed;
            if (vy === 0) {
                this.lastDirection = 'right';
                this.player.anims.play('walk-right', true);
            }
        }

        this.player.setVelocity(vx, vy);

        if (vx === 0 && vy === 0) {
            this.player.anims.stop();
            this.player.setFrame(this.idleFrames[this.lastDirection]);
        }
    }
}
