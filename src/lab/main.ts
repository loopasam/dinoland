import './lab.css';

type Motion = 'idle' | 'walk' | 'happy' | 'eat' | 'impact';
type Facing = 'left' | 'right';

const captions: Record<Motion, string> = {
  idle: 'IDLE · BREATHING, HEAD DRIFT, BLINK',
  walk: 'WALK · OFFSET HEAD, BODY BOUNCE, FOUR FEET',
  happy: 'HAPPY · HOP, HEAD NOD, TAIL WAG',
  eat: 'EAT · HEAD DIP, CHEW, WEIGHT SHIFT',
  impact: 'IMPACT · WHOLE-BODY TUMBLE, LOOSE LIMBS',
};

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing lab element: ${selector}`);
  return element;
}

const stage = required<HTMLDivElement>('#stage');
const rigScale = required<SVGGElement>('#rig-scale');
const caption = required<HTMLParagraphElement>('#motion-caption');
const growthInput = required<HTMLInputElement>('#growth');
const growthValue = required<HTMLOutputElement>('#growth-value');
const speedInput = required<HTMLInputElement>('#speed');
const speedValue = required<HTMLOutputElement>('#speed-value');
const layerToggle = required<HTMLButtonElement>('#layers-toggle');
const motionButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-motion]')];
const directionButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-facing]')];

let motion: Motion = 'idle';
let facing: Facing = 'right';
let growth = Number(growthInput.value);
let speed = Number(speedInput.value) / 100;

function updateRange(input: HTMLInputElement): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const progress = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--range-progress', `${progress}%`);
}

function selectMotion(nextMotion: Motion): void {
  motion = nextMotion;
  stage.dataset.motion = nextMotion;
  caption.textContent = captions[nextMotion];
  for (const button of motionButtons) {
    button.classList.toggle('active', button.dataset.motion === nextMotion);
  }
}

function setGrowth(nextGrowth: number): void {
  growth = Math.max(42, Math.min(78, Math.round(nextGrowth)));
  growthInput.value = String(growth);
  growthValue.value = `${growth}%`;
  rigScale.setAttribute('transform', `scale(${growth / 100})`);
  updateRange(growthInput);
}

function setSpeed(nextSpeed: number): void {
  speed = Math.max(0.5, Math.min(1.6, nextSpeed));
  speedInput.value = String(Math.round(speed * 100));
  speedValue.value = `${speed.toFixed(1)}×`;
  stage.style.setProperty('--time-scale', String(1 / speed));
  updateRange(speedInput);
}

function setFacing(nextFacing: Facing): void {
  facing = nextFacing;
  stage.dataset.facing = facing;
  for (const button of directionButtons) {
    button.classList.toggle('active', button.dataset.facing === facing);
  }
}

for (const button of motionButtons) {
  button.addEventListener('click', () => selectMotion(button.dataset.motion as Motion));
}

for (const button of directionButtons) {
  button.addEventListener('click', () => setFacing(button.dataset.facing as Facing));
}

growthInput.addEventListener('input', () => setGrowth(Number(growthInput.value)));
speedInput.addEventListener('input', () => setSpeed(Number(speedInput.value) / 100));

layerToggle.addEventListener('click', () => {
  const showing = stage.classList.toggle('show-layers');
  layerToggle.setAttribute('aria-pressed', String(showing));
  layerToggle.textContent = showing ? 'Hide layers' : 'Show layers';
});

document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const shortcuts: Motion[] = ['idle', 'walk', 'happy', 'eat', 'impact'];
  const selected = shortcuts[Number(event.key) - 1];
  if (selected) selectMotion(selected);
});

setGrowth(growth);
setSpeed(speed);
selectMotion(motion);
setFacing(facing);

declare global {
  interface Window {
    __DINO_LAB__?: {
      getState: () => { motion: Motion; facing: Facing; growth: number; speed: number; layersVisible: boolean };
      selectMotion: (nextMotion: Motion) => void;
      setGrowth: (nextGrowth: number) => void;
      setSpeed: (nextSpeed: number) => void;
    };
  }
}

window.__DINO_LAB__ = {
  getState: () => ({ motion, facing, growth, speed, layersVisible: stage.classList.contains('show-layers') }),
  selectMotion,
  setGrowth,
  setSpeed,
};
