const GAME_WIDTH  = 672;   // 21 tiles × 16px × 2
const GAME_HEIGHT = 576;   // 18 tiles × 16px × 2

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY
    },
    scene: [BootScene, StartScene, LoadingScene, GameScene]
};

const game = new Phaser.Game(config);
