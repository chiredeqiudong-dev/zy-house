class MirrorApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._resolve = null;
        this._overlay = null;
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);

        // Smooth rotation state
        this._targetAngle = 270;
        this._currentAngle = 270;
        this._lerpTimer = null;

        // Pre-extracted frame data URLs (rendered once, never again)
        this._frames = null;  // { down: url, left: url, right: url, up: url }

        // Direction config: row in spritesheet, midAngle
        // Mirror flips horizontally: left row → shows right, right row → shows left
        this._directions = [
            { name: 'right', row: 1, midAngle: 0   },
            { name: 'down',  row: 0, midAngle: 90  },
            { name: 'left',  row: 2, midAngle: 180 },
            { name: 'up',    row: 3, midAngle: 270 },
        ];
        this._blendZone = 30;

        // DOM elements for frame display
        this._imgA = null;
        this._imgB = null;
        this._imgContainer = null;
        this._currentImgSlot = 'A'; // which img is "front"
    }

    // ---- Extract sprite frames as data URLs (once) ----

    _extractFrames() {
        if (this._frames) return;
        const tex = this.scene.textures.get('player');
        if (!tex) return;

        const src = tex.getSourceImage();
        const srcW = 16, srcH = 32;
        const scale = 6;
        const dstW = srcW * scale;
        const dstH = srcH * scale;

        // Offscreen canvas for extraction (used once, then discarded)
        const off = document.createElement('canvas');
        off.width = dstW;
        off.height = dstH;
        const offCtx = off.getContext('2d');
        offCtx.imageSmoothingEnabled = false;

        this._frames = {};

        for (const dir of this._directions) {
            const frameIdx = dir.row * 3 + 1; // middle column = idle
            const col = frameIdx % 3;
            const row = Math.floor(frameIdx / 3);

            offCtx.clearRect(0, 0, dstW, dstH);
            offCtx.save();
            // Flip horizontally for mirror reflection
            offCtx.translate(dstW, 0);
            offCtx.scale(-1, 1);
            offCtx.drawImage(src, col * srcW, row * srcH, srcW, srcH, 0, 0, dstW, dstH);
            offCtx.restore();

            this._frames[dir.name] = off.toDataURL();
        }
    }

    // ---- Lifecycle ----

    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;

            this._extractFrames();
            if (!this._frames) { this.close(); return; }

            // Blur Phaser canvas
            const gameCanvas = document.querySelector('#game-container canvas');
            if (gameCanvas) {
                gameCanvas.style.filter = 'blur(8px)';
                gameCanvas.style.transition = 'filter 0.3s ease';
            }

            // Overlay
            this._overlay = document.createElement('div');
            this._overlay.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 100;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.35);
                cursor: crosshair;
            `;

            // Mirror frame
            const frame = document.createElement('div');
            frame.style.cssText = `
                position: relative;
                border: 5px solid #A89070;
                border-radius: 3px;
                box-shadow:
                    0 0 40px rgba(0, 0, 0, 0.5),
                    inset 0 0 30px rgba(200, 210, 220, 0.12);
                background: linear-gradient(160deg, #d8dce6 0%, #b8bfc8 30%, #cdd2da 60%, #e0e4ec 100%);
                overflow: hidden;
            `;

            // Image container (holds two overlapping <img> for blending)
            this._imgContainer = document.createElement('div');
            this._imgContainer.style.cssText = `
                position: relative;
                width: 256px;
                height: 256px;
            `;

            this._imgA = document.createElement('img');
            this._imgA.style.cssText = `
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                image-rendering: pixelated;
                image-rendering: crisp-edges;
                opacity: 1;
                pointer-events: none;
            `;

            this._imgB = document.createElement('img');
            this._imgB.style.cssText = `
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                image-rendering: pixelated;
                image-rendering: crisp-edges;
                opacity: 0;
                pointer-events: none;
            `;

            // Set initial frame
            this._imgA.src = this._frames['up'];
            this._imgB.src = this._frames['up'];

            this._imgContainer.appendChild(this._imgA);
            this._imgContainer.appendChild(this._imgB);
            frame.appendChild(this._imgContainer);
            this._overlay.appendChild(frame);

            // Hints
            const hint = document.createElement('div');
            hint.style.cssText = `
                margin-top: 24px;
                text-align: center;
                pointer-events: none;
                line-height: 2;
            `;
            const hintLine1 = document.createElement('div');
            hintLine1.style.cssText = `
                font-family: 'PressStart2P', monospace;
                font-size: 10px;
                color: rgba(255, 255, 255, 0.55);
                letter-spacing: 1px;
            `;
            hintLine1.textContent = 'Move mouse to rotate';
            const hintLine2 = document.createElement('div');
            hintLine2.style.cssText = `
                font-family: 'Pixel32_CN', monospace;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.55);
            `;
            hintLine2.textContent = '愿你每天都能看到最好的自己';
            hint.appendChild(hintLine1);
            hint.appendChild(hintLine2);
            this._overlay.appendChild(hint);

            // Close button
            const closeBtn = document.createElement('div');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: 12px; right: 16px;
                font-size: 20px;
                color: rgba(255, 255, 255, 0.4);
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: color 0.2s, background 0.2s;
                font-family: sans-serif;
                z-index: 101;
            `;
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.color = '#fff';
                closeBtn.style.background = 'rgba(255,255,255,0.15)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.color = 'rgba(255,255,255,0.4)';
                closeBtn.style.background = 'none';
            });
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
            this._overlay.appendChild(closeBtn);

            const container = document.getElementById('game-container');
            if (container) container.appendChild(this._overlay);

            if (this.scene.input && this.scene.input.keyboard) {
                this.scene.input.keyboard.enabled = false;
            }

            this._overlay.addEventListener('mousemove', this._onMouseMove);
            document.addEventListener('keydown', this._onKeyDown);
        });
    }

    close() {
        if (this._lerpTimer) {
            cancelAnimationFrame(this._lerpTimer);
            this._lerpTimer = null;
        }
        if (this._overlay) {
            this._overlay.removeEventListener('mousemove', this._onMouseMove);
            this._overlay.remove();
            this._overlay = null;
        }
        document.removeEventListener('keydown', this._onKeyDown);

        const gameCanvas = document.querySelector('#game-container canvas');
        if (gameCanvas) gameCanvas.style.filter = '';

        if (this.scene.input && this.scene.input.keyboard) {
            this.scene.input.keyboard.enabled = true;
        }
        document.querySelectorAll('.key-cap.active').forEach(el => el.classList.remove('active'));

        this._imgA = null;
        this._imgB = null;
        this._imgContainer = null;
        if (this._resolve) this._resolve();
    }

    _onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.close();
        } else {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    _onMouseMove(e) {
        if (!this._imgContainer) return;

        const rect = this._imgContainer.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        this._targetAngle = angle;
        if (!this._lerpTimer) this._lerpStep();
    }

    // ---- Smooth interpolation ----

    _lerpStep() {
        if (!this._imgContainer) return;

        let diff = this._targetAngle - this._currentAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        if (Math.abs(diff) < 0.5) {
            this._currentAngle = this._targetAngle;
            this._lerpTimer = null;
            this._updateDisplay();
            return;
        }

        this._currentAngle += diff * 0.15;
        if (this._currentAngle < 0) this._currentAngle += 360;
        if (this._currentAngle >= 360) this._currentAngle -= 360;

        this._updateDisplay();
        this._lerpTimer = requestAnimationFrame(() => this._lerpStep());
    }

    // ---- Display update (no canvas, just img src + opacity) ----

    _updateDisplay() {
        if (!this._frames || !this._imgA || !this._imgB) return;

        const blendDirs = this._getDirectionBlend(this._currentAngle);

        if (blendDirs.length === 1) {
            // Single direction — no blending needed
            const src = this._frames[blendDirs[0].dir.name];
            const front = this._currentImgSlot === 'A' ? this._imgA : this._imgB;
            if (front.src !== src) front.src = src;
            front.style.opacity = '1';
            const back = this._currentImgSlot === 'A' ? this._imgB : this._imgA;
            back.style.opacity = '0';
        } else {
            // Two directions — crossfade
            const srcA = this._frames[blendDirs[0].dir.name];
            const srcB = this._frames[blendDirs[1].dir.name];
            const alphaA = blendDirs[0].alpha;
            const alphaB = blendDirs[1].alpha;

            // Decide which img slot gets which frame
            // Keep the "front" slot for the dominant frame to minimize src changes
            let front, back;
            if (alphaA >= alphaB) {
                front = this._currentImgSlot === 'A' ? this._imgA : this._imgB;
                back  = this._currentImgSlot === 'A' ? this._imgB : this._imgA;
            } else {
                front = this._currentImgSlot === 'A' ? this._imgB : this._imgA;
                back  = this._currentImgSlot === 'A' ? this._imgA : this._imgB;
                this._currentImgSlot = this._currentImgSlot === 'A' ? 'B' : 'A';
            }

            if (front.src !== srcA) front.src = srcA;
            if (back.src !== srcB) back.src = srcB;
            front.style.opacity = String(alphaA);
            back.style.opacity = String(alphaB);
        }
    }

    _getDirectionBlend(angle) {
        const dirs = this._directions;
        const blend = [];

        for (let i = 0; i < dirs.length; i++) {
            const curr = dirs[i];
            const next = dirs[(i + 1) % dirs.length];

            let boundary = (curr.midAngle + next.midAngle) / 2;
            if (curr.midAngle > next.midAngle) {
                boundary = (curr.midAngle + next.midAngle + 360) / 2;
                if (boundary >= 360) boundary -= 360;
            }

            let dist = Math.abs(angle - boundary);
            if (dist > 180) dist = 360 - dist;

            if (dist < this._blendZone) {
                blend.push({
                    dir: curr,
                    alpha: 1 - (dist / this._blendZone) * 0.5
                });
            }
        }

        if (blend.length === 0) {
            let closest = dirs[0];
            let minDist = 360;
            for (const d of dirs) {
                let dist = Math.abs(angle - d.midAngle);
                if (dist > 180) dist = 360 - dist;
                if (dist < minDist) { minDist = dist; closest = d; }
            }
            blend.push({ dir: closest, alpha: 1 });
        }

        return blend;
    }
}
