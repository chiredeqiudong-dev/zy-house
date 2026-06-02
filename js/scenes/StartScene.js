class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        const el = document.getElementById('start-screen');
        const btn = document.getElementById('start-btn');

        // 防止场景重入时重复绑定
        if (el && el.classList.contains('hidden')) {
            this.scene.start('LoadingScene');
            return;
        }

        const handler = () => {
            btn.removeEventListener('click', handler);
            el.classList.add('hidden');
            this.scene.start('LoadingScene');
        };
        btn.addEventListener('click', handler);
    }
}
