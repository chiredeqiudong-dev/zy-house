class TelevisionApp {
    constructor(gameScene) {
        this.scene = gameScene;
        this._resolve = null;
        this._overlay = null;
        this._closed = false;
        this._posters = [];
        this._bgTimer = null;
        this._bgIndex = 0;
        this._bgLayerA = null;
        this._bgLayerB = null;
        this._bgActive = 'A';
        this._paused = false;
        this._marqueeEl = null;
        this._playBtn = null;
        this._infoEl = null;
        this._volImg = null;
        this._volume = 70;  // 0-100, 0 = muted = paused
    }

    // ---- Lifecycle ----

    open() {
        return new Promise((resolve) => {
            this._resolve = resolve;
            this._closed = false;

            this._loadPosters().then(() => {
                if (this._closed) return;
                this._buildUI();
                this._bindEvents();
                this._startBgCycle();

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
        if (this._bgTimer) { clearInterval(this._bgTimer); this._bgTimer = null; }
        if (this._volHideTimer) { clearTimeout(this._volHideTimer); this._volHideTimer = null; }
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }

        if (this.scene.input && this.scene.input.keyboard) {
            this.scene.input.keyboard.enabled = true;
        }
        document.querySelectorAll('.key-cap.active').forEach(el => el.classList.remove('active'));

        if (this._resolve) { this._resolve(); this._resolve = null; }
    }

    _onKeyDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') this.close();
    }

    // ---- Data ----

    async _loadPosters() {
        try {
            const resp = await fetch('conf/posters.json');
            this._posters = await resp.json();
        } catch (e) {
            console.warn('Failed to load posters.json:', e);
        }
        if (!this._posters.length) {
            this._posters = [{ title: 'No Posters', url: '' }];
        }
        this._urlIndex = new Map(this._posters.map((p, i) => [p.url, i]));
    }

    // ---- UI Construction ----

    _buildUI() {
        const container = document.getElementById('game-container');

        this._overlay = document.createElement('div');
        this._overlay.className = 'tv-root';

        // Layer 1: Blurred background
        const bg = document.createElement('div');
        bg.className = 'tv-bg';

        this._bgLayerA = document.createElement('div');
        this._bgLayerA.className = 'tv-bg-img';
        this._bgLayerA.style.opacity = '1';
        this._bgLayerA.style.zIndex = '1';

        this._bgLayerB = document.createElement('div');
        this._bgLayerB.className = 'tv-bg-img';
        this._bgLayerB.style.opacity = '0';
        this._bgLayerB.style.zIndex = '2';

        bg.appendChild(this._bgLayerA);
        bg.appendChild(this._bgLayerB);

        // Layer 2: Atmosphere overlay
        const mask = document.createElement('div');
        mask.className = 'tv-mask';

        // Layer 3: Marquee (2 tracks)
        this._marqueeEl = document.createElement('div');
        this._marqueeEl.className = 'tv-marquee';

        const directions = ['left', 'right'];
        const trackDurations = ['80s', '100s'];

        for (let t = 0; t < 2; t++) {
            const track = document.createElement('div');
            track.className = 'tv-track';
            track.style.animationDuration = trackDurations[t];
            if (directions[t] === 'right') track.classList.add('tv-track-reverse');

            const shuffled = this._shuffleForTrack(t);
            const setA = this._createPosterSet(shuffled);
            const setB = this._createPosterSet(shuffled);

            track.appendChild(setA);
            track.appendChild(setB);
            this._marqueeEl.appendChild(track);
        }

        // Control bar
        const ctrlBar = this._createControlBar();

        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'tv-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => this.close());

        this._overlay.appendChild(bg);
        this._overlay.appendChild(mask);
        this._overlay.appendChild(this._marqueeEl);
        this._overlay.appendChild(ctrlBar);
        this._overlay.appendChild(closeBtn);
        container.appendChild(this._overlay);
    }

    _createControlBar() {
        const bar = document.createElement('div');
        bar.className = 'tv-ctrl';

        // Play/Pause button
        this._playBtn = document.createElement('div');
        this._playBtn.className = 'tv-ctrl-btn';
        const playImg = document.createElement('img');
        playImg.src = 'assets/pause.svg';
        playImg.className = 'tv-ctrl-icon';
        this._playBtn.appendChild(playImg);
        this._playBtn.addEventListener('click', () => this._togglePause(playImg));

        // Info text
        this._infoEl = document.createElement('div');
        this._infoEl.className = 'tv-ctrl-info';
        this._infoEl.textContent = '正在放映中';

        // Volume control
        const volWrap = document.createElement('div');
        volWrap.className = 'tv-vol-wrap';

        const volBtn = document.createElement('div');
        volBtn.className = 'tv-ctrl-btn';
        this._volImg = document.createElement('img');
        this._volImg.src = this._volume > 0 ? 'assets/volume.svg' : 'assets/mute-L.svg';
        this._volImg.className = 'tv-ctrl-icon';
        volBtn.appendChild(this._volImg);
        volBtn.addEventListener('click', () => this._toggleMute());

        // Popup: rotated slider + number
        const popup = document.createElement('div');
        popup.className = 'tv-vol-popup';

        this._volNum = document.createElement('div');
        this._volNum.className = 'tv-vol-num';
        this._volNum.textContent = this._volume;

        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'tv-vol-slider-wrap';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = String(this._volume);
        slider.className = 'tv-vol-slider';
        slider.addEventListener('input', () => this._onVolumeChange(parseInt(slider.value)));
        sliderWrap.appendChild(slider);

        popup.appendChild(sliderWrap);
        popup.appendChild(this._volNum);

        // Hover delay logic — keep popup visible while interacting
        this._volHideTimer = null;
        const showPopup = () => {
            if (this._volHideTimer) { clearTimeout(this._volHideTimer); this._volHideTimer = null; }
            popup.classList.add('visible');
        };
        const hidePopup = () => {
            this._volHideTimer = setTimeout(() => popup.classList.remove('visible'), 300);
        };
        volWrap.addEventListener('mouseenter', showPopup);
        volWrap.addEventListener('mouseleave', hidePopup);
        popup.addEventListener('mouseenter', showPopup);
        popup.addEventListener('mouseleave', hidePopup);

        volWrap.appendChild(popup);
        volWrap.appendChild(volBtn);

        bar.appendChild(this._playBtn);
        bar.appendChild(this._infoEl);
        bar.appendChild(volWrap);

        return bar;
    }

    _togglePause(iconEl) {
        this._paused = !this._paused;
        this._applyPlayState();
        iconEl.src = this._paused ? 'assets/continue.svg' : 'assets/pause.svg';
        this._infoEl.textContent = this._paused ? '已暂停' : '正在放映中';
    }

    _toggleMute() {
        if (this._volume > 0) {
            this._prevVolume = this._volume;
            this._volume = 0;
        } else {
            this._volume = this._prevVolume || 70;
        }
        this._volImg.src = this._volume > 0 ? 'assets/volume.svg' : 'assets/mute-L.svg';
        this._updateSpeed();
        // Sync slider and number
        const slider = this._overlay.querySelector('.tv-vol-slider');
        if (slider) slider.value = this._volume;
        if (this._volNum) this._volNum.textContent = this._volume;
    }

    _onVolumeChange(val) {
        this._volume = val;
        this._volImg.src = val > 0 ? 'assets/volume.svg' : 'assets/mute-L.svg';
        if (this._volNum) this._volNum.textContent = val;
        this._updateSpeed();
    }

    _updateSpeed() {
        // Volume 0 = paused, 1-30 = slow, 31-60 = normal, 61-100 = fast
        const isPaused = this._paused || this._volume === 0;
        if (this._volume === 0) {
            this._infoEl.textContent = '已静音';
        } else if (this._paused) {
            this._infoEl.textContent = '已暂停';
        } else {
            this._infoEl.textContent = '正在放映中';
        }

        const tracks = this._marqueeEl.querySelectorAll('.tv-track');
        tracks.forEach(t => {
            t.style.animationPlayState = isPaused ? 'paused' : 'running';
            if (this._volume > 0 && !this._paused) {
                let dur;
                if (this._volume <= 30) dur = 160;
                else if (this._volume <= 60) dur = 100;
                else dur = 50;
                t.style.animationDuration = dur + 's';
            }
        });
    }

    _applyPlayState() {
        const isPaused = this._paused || this._volume === 0;
        const tracks = this._marqueeEl.querySelectorAll('.tv-track');
        tracks.forEach(t => {
            t.style.animationPlayState = isPaused ? 'paused' : 'running';
        });
    }

    _shuffleForTrack(seed) {
        const arr = this._posters.slice();
        for (let i = arr.length - 1; i > 0; i--) {
            const j = ((i * (seed + 7) * 13) % (i + 1) + (i + 1)) % (i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    _createPosterSet(posters) {
        const set = document.createElement('div');
        set.className = 'tv-poster-set';

        posters.forEach((p, i) => {
            const item = document.createElement('div');
            item.className = 'tv-poster';
            item.dataset.url = p.url;

            const img = document.createElement('img');
            img.className = 'tv-poster-img';
            img.src = p.url;
            img.alt = p.title;
            img.loading = 'lazy';
            img.decoding = 'async';

            const label = document.createElement('div');
            label.className = 'tv-poster-label';
            label.textContent = p.title;

            item.appendChild(img);
            item.appendChild(label);
            set.appendChild(item);
        });

        return set;
    }

    // ---- Events ----

    _bindEvents() {
        const marquee = this._overlay.querySelector('.tv-marquee');
        if (!marquee) return;

        marquee.addEventListener('click', (e) => {
            const poster = e.target.closest('.tv-poster');
            if (!poster) return;
            const url = poster.dataset.url;
            if (url) {
                this._setBackground(url);
                this._bgIndex = this._urlIndex.get(url) ?? 0;
                if (this._bgTimer) { clearInterval(this._bgTimer); }
                this._bgTimer = setInterval(() => {
                    this._bgIndex = (this._bgIndex + 1) % this._posters.length;
                    this._setBackground(this._posters[this._bgIndex].url);
                }, 60000);
            }
        });
    }

    _startBgCycle() {
        if (this._posters.length <= 1) return;
        this._bgIndex = Math.floor(Math.random() * this._posters.length);
        // Set initial background directly (no crossfade) to avoid wasted download
        this._bgLayerA.style.backgroundImage = `url(${this._posters[this._bgIndex].url})`;

        this._bgTimer = setInterval(() => {
            this._bgIndex = (this._bgIndex + 1) % this._posters.length;
            this._setBackground(this._posters[this._bgIndex].url);
        }, 60000);
    }

    _setBackground(url) {
        const active = this._bgActive === 'A' ? this._bgLayerA : this._bgLayerB;
        const inactive = this._bgActive === 'A' ? this._bgLayerB : this._bgLayerA;

        inactive.style.backgroundImage = `url(${url})`;
        inactive.offsetHeight;
        inactive.style.opacity = '1';
        active.style.opacity = '0';
        this._bgActive = this._bgActive === 'A' ? 'B' : 'A';
    }

}
