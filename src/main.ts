import Phaser from 'phaser';
import './style.css';
import { NurseryScene } from './scenes/NurseryScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#9ccc53',
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
  scene: [NurseryScene],
};

new Phaser.Game(config);

const startScreen = document.querySelector<HTMLElement>('#start-screen');
const startButton = document.querySelector<HTMLButtonElement>('#start-game');

if (startScreen && startButton) {
  const enableStart = (): void => {
    if (!window.__DINOLAND__) {
      requestAnimationFrame(enableStart);
      return;
    }
    startButton.disabled = false;
    startScreen.classList.add('is-ready');
  };

  startButton.addEventListener('click', () => {
    if (startButton.disabled) return;
    window.__DINOLAND__?.start();
    startButton.disabled = true;
    startScreen.classList.add('is-leaving');
    startScreen.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => startScreen.remove(), 720);
  });

  enableStart();
}
