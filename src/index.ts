import { Game } from './game';

function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (!canvas) {
    console.error('Could not find canvas element');
    return;
  }

  const game = new Game(canvas);
  game.start();
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
