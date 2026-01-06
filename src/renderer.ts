import { ARENA } from './arena';
import { Tower } from './tower';
import { Unit } from './unit';
import { Team, Position } from './types';
import { Assets, drawSprite, drawTile } from './assets';
import { Projectile } from './projectile';
import { Spell, SpellType } from './spell';
import { Tesla } from './buildings/tesla';
import { Surge } from './units/surge';
import { Lily } from './units/lily';

const COLORS = {
  healthBarBg: '#333',
  healthBarPlayer: '#4caf50',
  healthBarEnemy: '#f44336',
  text: '#fff',
};

// Character sprite indices (16x16 sheet, 12 columns)
const CHAR_SPRITES = {
  // Knight (orange) - walking animations
  knightUp: [36, 37, 38, 37],
  knightDown: [0, 1, 2, 1],
  // Mini Pekka (blue character) - walking animations
  pekkaUp: [39, 40, 41, 40],
  pekkaDown: [3, 4, 5, 4],
  // Magic Archer (green/teal character) - walking animations
  archerUp: [42, 43, 44, 43],
  archerDown: [6, 7, 8, 7],
  // Gold Knight (uses knight sprites with gold tint)
  goldKnightUp: [36, 37, 38, 37],
  goldKnightDown: [0, 1, 2, 1],
  // Mega Knight (uses bigger knight sprites)
  megaKnightUp: [36, 37, 38, 37],
  megaKnightDown: [0, 1, 2, 1],
  // Skeleton/dark - enemy units
  enemyDown: [48, 49, 50, 49],
  enemyUp: [84, 85, 86, 85],
  // Enemy Mini Pekka (bat/demon sprites)
  enemyPekkaDown: [60, 61, 62, 61],
  enemyPekkaUp: [96, 97, 98, 97],
  // Enemy Magic Archer
  enemyArcherDown: [63, 64, 65, 64],
  enemyArcherUp: [99, 100, 101, 100],
  // Enemy Gold Knight
  enemyGoldKnightDown: [48, 49, 50, 49],
  enemyGoldKnightUp: [84, 85, 86, 85],
  // Enemy Mega Knight
  enemyMegaKnightDown: [48, 49, 50, 49],
  enemyMegaKnightUp: [84, 85, 86, 85],
};

// Tile indices for basictiles.png (8 columns)
const TILE_IDX = {
  grass1: 0,
  grass2: 1,
  grass3: 8,
  water1: 4,
  water2: 5,
  water3: 12,
  water4: 13,
  bridge: 17, // Wood plank
  stone: 2,
  stoneFloor: 24,
  castle: 2, // Stone brick for castle
  tower: 3,  // Stone variant for tower
};

interface SplashEffect {
  x: number;
  y: number;
  time: number;
  maxTime: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private assets: Assets | null = null;
  private animFrame: number = 0;
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private splashEffects: SplashEffect[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    this.ctx = ctx;
    // Disable image smoothing for pixel art
    ctx.imageSmoothingEnabled = false;
  }

  setAssets(assets: Assets): void {
    this.assets = assets;
    this.prerenderBackground();
  }

  updateAnimation(): void {
    this.animFrame = (this.animFrame + 1) % 4;
  }

  private prerenderBackground(): void {
    if (!this.assets) return;

    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCanvas.width = ARENA.width;
    this.backgroundCanvas.height = ARENA.height;
    const bgCtx = this.backgroundCanvas.getContext('2d')!;
    bgCtx.imageSmoothingEnabled = false;

    const tileSize = 32;
    const { tiles } = this.assets;

    // Draw grass tiles
    for (let y = 0; y < ARENA.height; y += tileSize) {
      for (let x = 0; x < ARENA.width; x += tileSize) {
        // Vary grass tiles slightly
        const grassTile = ((x + y) / tileSize) % 3 === 0 ? TILE_IDX.grass2 : TILE_IDX.grass1;

        // Color tint for each side
        drawTile(bgCtx, tiles, grassTile, x, y, tileSize, tileSize);
      }
    }

    // Apply color tints for each side
    bgCtx.fillStyle = 'rgba(100, 150, 255, 0.15)';
    bgCtx.fillRect(0, ARENA.midLine + 20, ARENA.width, ARENA.height - ARENA.midLine - 20);
    bgCtx.fillStyle = 'rgba(255, 100, 100, 0.15)';
    bgCtx.fillRect(0, 0, ARENA.width, ARENA.midLine - 20);

    // Draw river with water tiles
    for (let x = 0; x < ARENA.width; x += tileSize) {
      const waterTile = (x / tileSize) % 2 === 0 ? TILE_IDX.water1 : TILE_IDX.water2;
      drawTile(bgCtx, tiles, waterTile, x, ARENA.riverY, tileSize, tileSize);
      // Second row of water
      const waterTile2 = (x / tileSize) % 2 === 0 ? TILE_IDX.water3 : TILE_IDX.water4;
      drawTile(bgCtx, tiles, waterTile2, x, ARENA.riverY + tileSize / 2, tileSize, tileSize / 2);
    }

    // Draw bridges
    [ARENA.bridgeLeft, ARENA.bridgeRight].forEach((bridge) => {
      for (let x = bridge.x; x < bridge.x + bridge.width; x += tileSize) {
        drawTile(bgCtx, tiles, TILE_IDX.bridge, x, ARENA.riverY - 8, tileSize, ARENA.riverHeight + 16);
      }
    });
  }

  clear(): void {
    if (this.backgroundCanvas) {
      this.ctx.drawImage(this.backgroundCanvas, 0, 0);
    } else {
      // Fallback solid color
      this.ctx.fillStyle = '#3d5c3d';
      this.ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
  }

  drawArena(): void {
    // Arena is pre-rendered, but draw center line
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, ARENA.midLine);
    this.ctx.lineTo(ARENA.width, ARENA.midLine);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawTower(tower: Tower): void {
    if (!tower.isAlive) return;

    const { x, y } = tower.position;
    const size = tower.size;

    // Tower colors based on team
    const baseColor = tower.team === 'player' ? '#3a6fb5' : '#b53a3a';
    const lightColor = tower.team === 'player' ? '#5a9fd5' : '#d55a5a';
    const darkColor = tower.team === 'player' ? '#2a4f85' : '#852a2a';

    const towerWidth = tower.towerType === 'king' ? 70 : 50;
    const towerHeight = tower.towerType === 'king' ? 80 : 60;

    // Draw tower shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + 5, y + towerHeight / 2 - 5, towerWidth / 2, 15, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw tower base (wider)
    this.ctx.fillStyle = darkColor;
    this.ctx.fillRect(x - towerWidth / 2 - 5, y + towerHeight / 4, towerWidth + 10, towerHeight / 4);

    // Draw main tower body
    this.ctx.fillStyle = baseColor;
    this.ctx.fillRect(x - towerWidth / 2, y - towerHeight / 2, towerWidth, towerHeight);

    // Draw stone brick pattern
    this.ctx.strokeStyle = darkColor;
    this.ctx.lineWidth = 1;
    const brickHeight = 12;
    const brickWidth = 20;
    for (let by = y - towerHeight / 2; by < y + towerHeight / 2; by += brickHeight) {
      const offset = (Math.floor((by - y) / brickHeight) % 2) * (brickWidth / 2);
      for (let bx = x - towerWidth / 2 + offset; bx < x + towerWidth / 2; bx += brickWidth) {
        this.ctx.strokeRect(bx, by, brickWidth, brickHeight);
      }
    }

    // Draw battlements (top)
    const merlonWidth = 12;
    const merlonHeight = 15;
    this.ctx.fillStyle = baseColor;
    for (let mx = x - towerWidth / 2; mx < x + towerWidth / 2; mx += merlonWidth * 1.5) {
      this.ctx.fillRect(mx, y - towerHeight / 2 - merlonHeight, merlonWidth, merlonHeight);
    }

    // Draw tower highlight (left edge)
    this.ctx.fillStyle = lightColor;
    this.ctx.fillRect(x - towerWidth / 2, y - towerHeight / 2, 5, towerHeight);

    // Draw window/door
    this.ctx.fillStyle = '#1a1a2e';
    if (tower.towerType === 'king') {
      // King tower has a door
      this.ctx.fillRect(x - 12, y + 5, 24, 35);
      this.ctx.fillStyle = darkColor;
      this.ctx.fillRect(x - 12, y + 5, 24, 5);
      // Crown emblem
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = 'bold 20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('👑', x, y - 15);
    } else {
      // Princess tower has a window
      this.ctx.beginPath();
      this.ctx.arc(x, y - 5, 10, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw team banner
    this.ctx.fillStyle = tower.team === 'player' ? '#4a90d9' : '#d94a4a';
    this.ctx.fillRect(x + towerWidth / 2 - 5, y - towerHeight / 2 + 10, 15, 25);
    // Banner tip
    this.ctx.beginPath();
    this.ctx.moveTo(x + towerWidth / 2 - 5, y - towerHeight / 2 + 35);
    this.ctx.lineTo(x + towerWidth / 2 + 2, y - towerHeight / 2 + 42);
    this.ctx.lineTo(x + towerWidth / 2 + 10, y - towerHeight / 2 + 35);
    this.ctx.fill();

    // Draw attack indicator
    if (tower.target) {
      this.ctx.strokeStyle = tower.team === 'player' ? 'rgba(100, 149, 237, 0.6)' : 'rgba(237, 100, 100, 0.6)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
      this.ctx.stroke();

      // Draw projectile
      const progress = 1 - tower.attackCooldown * tower.attackSpeed;
      if (progress > 0 && progress < 0.3) {
        const px = x + (tower.target.position.x - x) * (progress / 0.3);
        const py = y + (tower.target.position.y - y) * (progress / 0.3);
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Draw health bar
    const barY = y - towerHeight / 2 - 25;
    this.drawHealthBar(x, barY, towerWidth, tower.health, tower.maxHealth, tower.team);
  }

  drawUnit(unit: Unit, gameTime: number): void {
    if (!unit.isAlive) return;

    let { x, y } = unit.position;
    const isMiniPekka = unit.unitType === 'minipekka';
    const isMagicArcher = unit.unitType === 'magicarcher';
    const isGoldKnight = unit.unitType === 'goldknight';
    const isMegaKnight = unit.unitType === 'megaknight';
    const isCharged = 'isCharged' in unit && (unit as any).isCharged;

    // Check for Mega Knight jump state
    let jumpHeight = 0;
    if (isMegaKnight && 'getJumpState' in unit) {
      const jumpState = (unit as any).getJumpState();
      jumpHeight = jumpState.height;
    }

    if (this.assets) {
      const scale = isMegaKnight ? 4 : isMiniPekka ? 3 : isMagicArcher ? 2.8 : isGoldKnight ? 3.2 : 2.5;
      const spriteSize = 16 * scale;

      // Determine sprite based on unit type and team
      let sprites: number[];
      if (unit.team === 'player') {
        if (isMiniPekka) {
          sprites = CHAR_SPRITES.pekkaUp;
        } else if (isMagicArcher) {
          sprites = CHAR_SPRITES.archerUp;
        } else if (isGoldKnight) {
          sprites = CHAR_SPRITES.goldKnightUp;
        } else if (isMegaKnight) {
          sprites = CHAR_SPRITES.megaKnightUp;
        } else {
          sprites = CHAR_SPRITES.knightUp;
        }
      } else {
        if (isMiniPekka) {
          sprites = CHAR_SPRITES.enemyPekkaDown;
        } else if (isMagicArcher) {
          sprites = CHAR_SPRITES.enemyArcherDown;
        } else if (isGoldKnight) {
          sprites = CHAR_SPRITES.enemyGoldKnightDown;
        } else if (isMegaKnight) {
          sprites = CHAR_SPRITES.enemyMegaKnightDown;
        } else {
          sprites = CHAR_SPRITES.enemyDown;
        }
      }

      // Animate walk cycle
      const frameIndex = Math.floor(gameTime * 6) % 4;
      const spriteIndex = sprites[frameIndex];

      // Draw charge glow for Mini Pekka
      if (isMiniPekka && isCharged) {
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = 15;
      }

      // Draw magic glow for Magic Archer
      if (isMagicArcher) {
        this.ctx.shadowColor = '#ff00ff';
        this.ctx.shadowBlur = 10;
      }

      // Draw golden glow for Gold Knight
      if (isGoldKnight) {
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 20;
      }

      // Draw MEGA glow for Mega Knight
      if (isMegaKnight) {
        this.ctx.shadowColor = '#8b00ff';
        this.ctx.shadowBlur = 30;

        // Draw shadow on ground when jumping
        if (jumpHeight > 0) {
          this.ctx.fillStyle = `rgba(0, 0, 0, ${0.3 + jumpHeight / 200})`;
          this.ctx.beginPath();
          this.ctx.ellipse(x, y + 10, spriteSize / 2, 15, 0, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Apply jump height offset for Mega Knight
      const drawY = y - jumpHeight;

      drawSprite(
        this.ctx,
        this.assets.characters,
        spriteIndex,
        x - spriteSize / 2,
        drawY - spriteSize / 2,
        scale
      );

      // Apply golden tint overlay for Gold Knight
      if (isGoldKnight) {
        this.ctx.globalCompositeOperation = 'source-atop';
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        this.ctx.fillRect(x - spriteSize / 2, drawY - spriteSize / 2, spriteSize, spriteSize);
        this.ctx.globalCompositeOperation = 'source-over';
      }

      // Apply purple tint for Mega Knight
      if (isMegaKnight) {
        this.ctx.globalCompositeOperation = 'source-atop';
        this.ctx.fillStyle = 'rgba(139, 0, 255, 0.25)';
        this.ctx.fillRect(x - spriteSize / 2, drawY - spriteSize / 2, spriteSize, spriteSize);
        this.ctx.globalCompositeOperation = 'source-over';
      }

      // Reset shadow
      this.ctx.shadowBlur = 0;

      // Draw team indicator ring (gold for Gold Knight)
      let ringColor: string;
      if (isGoldKnight) {
        ringColor = '#ffd700'; // Gold
      } else {
        ringColor = unit.team === 'player' ? '#4a90d9' : '#d94a4a';
      }
      this.ctx.strokeStyle = ringColor;
      this.ctx.lineWidth = isGoldKnight ? 3 : 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y + 5, spriteSize / 2 - 2, 0, Math.PI * 2);
      this.ctx.stroke();

      // Draw charge indicator for Mini Pekka
      if (isMiniPekka && isCharged) {
        this.ctx.fillStyle = '#00ffff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('⚡', x, y - spriteSize / 2 - 5);
      }

      // Draw bow indicator for Magic Archer
      if (isMagicArcher) {
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏹', x, y - spriteSize / 2 - 5);
      }

      // Draw crown indicator for Gold Knight
      if (isGoldKnight) {
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('👑', x, drawY - spriteSize / 2 - 8);
      }

      // Draw helmet indicator for Mega Knight
      if (isMegaKnight) {
        this.ctx.fillStyle = '#8b00ff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('⚔️', x, drawY - spriteSize / 2 - 10);
      }
    } else {
      // Fallback
      let color: string;
      if (unit.team === 'player') {
        color = isMegaKnight ? '#8b00ff' : isMiniPekka ? '#00bfff' : isMagicArcher ? '#ff00ff' : isGoldKnight ? '#ffd700' : '#6495ed';
      } else {
        color = isMegaKnight ? '#4b0082' : isMiniPekka ? '#ff6b6b' : isMagicArcher ? '#ff66aa' : isGoldKnight ? '#daa520' : '#ed6464';
      }
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y - jumpHeight, unit.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw attack effect (not for Magic Archer - they use projectiles)
    if (unit.target && unit.attackCooldown > 0.7 / unit.attackSpeed && !isMagicArcher) {
      // Mini Pekka has a stronger attack effect
      if (isMiniPekka) {
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
        this.ctx.lineWidth = 4;
      } else {
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        this.ctx.lineWidth = 3;
      }
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      const midX = (x + unit.target.position.x) / 2;
      const midY = (y + unit.target.position.y) / 2;
      this.ctx.lineTo(midX, midY);
      this.ctx.stroke();
    }

    // Draw health bar (smaller for units)
    this.drawHealthBar(x, y - 25, 30, unit.health, unit.maxHealth, unit.team);
  }

  private drawHealthBar(
    x: number,
    y: number,
    width: number,
    health: number,
    maxHealth: number,
    team: Team
  ): void {
    const height = 6;
    const healthPercent = health / maxHealth;

    // Background
    this.ctx.fillStyle = COLORS.healthBarBg;
    this.ctx.fillRect(x - width / 2, y, width, height);

    // Health fill
    this.ctx.fillStyle = team === 'player' ? COLORS.healthBarPlayer : COLORS.healthBarEnemy;
    this.ctx.fillRect(x - width / 2, y, width * healthPercent, height);

    // Border
    this.ctx.strokeStyle = '#111';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - width / 2, y, width, height);
  }

  drawGameOver(winner: Team): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    this.ctx.fillStyle = winner === 'player' ? '#4caf50' : '#f44336';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const text = winner === 'player' ? 'VICTORY!' : 'DEFEAT!';
    this.ctx.fillText(text, ARENA.width / 2, ARENA.height / 2);

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = '24px Arial';
    this.ctx.fillText('Click to restart', ARENA.width / 2, ARENA.height / 2 + 50);
  }

  drawPaused(): void {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, ARENA.width, ARENA.height);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 64px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('⏸️ PAUSED', ARENA.width / 2, ARENA.height / 2);

    this.ctx.font = '24px Arial';
    this.ctx.fillText('Press P to resume', ARENA.width / 2, ARENA.height / 2 + 50);
  }

  updateElixirBar(elixir: number, maxElixir: number): void {
    const fill = document.getElementById('elixir-fill');
    const text = document.getElementById('elixir-text');

    if (fill) {
      fill.style.width = `${(elixir / maxElixir) * 100}%`;
    }
    if (text) {
      text.textContent = `${Math.floor(elixir)} / ${maxElixir}`;
    }
  }

  addSplashEffect(x: number, y: number): void {
    this.splashEffects.push({
      x,
      y,
      time: 0,
      maxTime: 0.5, // Half second animation
    });
  }

  drawSplashEffects(deltaTime: number): void {
    this.splashEffects = this.splashEffects.filter((splash) => {
      splash.time += deltaTime;
      const progress = splash.time / splash.maxTime;

      if (progress >= 1) return false;

      // Draw expanding water splash
      const alpha = 1 - progress;
      const radius = 20 + progress * 40;

      // Water droplets
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist = radius * progress;
        const dropX = splash.x + Math.cos(angle) * dist;
        const dropY = splash.y + Math.sin(angle) * dist - progress * 30; // Arc upward

        this.ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(dropX, dropY, 5 * (1 - progress * 0.5), 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Central splash ring
      this.ctx.strokeStyle = `rgba(150, 220, 255, ${alpha})`;
      this.ctx.lineWidth = 3 * (1 - progress);
      this.ctx.beginPath();
      this.ctx.arc(splash.x, splash.y, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Inner ripple
      this.ctx.strokeStyle = `rgba(200, 240, 255, ${alpha * 0.7})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(splash.x, splash.y, radius * 0.5, 0, Math.PI * 2);
      this.ctx.stroke();

      return true;
    });
  }

  drawSpellPreview(position: Position, radius: number, spellType: SpellType): void {
    const { x, y } = position;

    // Get color based on spell type
    let color: string;
    let icon: string;
    switch (spellType) {
      case 'rage':
        color = 'rgba(255, 100, 100, 0.4)';
        icon = '😤';
        break;
      case 'fireball':
        color = 'rgba(255, 150, 0, 0.4)';
        icon = '🔥';
        break;
      case 'freeze':
        color = 'rgba(100, 200, 255, 0.4)';
        icon = '❄️';
        break;
      case 'poison':
        color = 'rgba(100, 255, 100, 0.4)';
        icon = '☠️';
        break;
      default:
        color = 'rgba(255, 255, 255, 0.4)';
        icon = '?';
    }

    // Draw targeting circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw edge
    this.ctx.strokeStyle = color.replace('0.4', '0.8');
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw icon in center
    this.ctx.font = '32px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(icon, x, y);
  }

  drawProjectile(projectile: Projectile): void {
    const { x, y } = projectile.position;
    const angle = projectile.getAngle();

    // Draw magic trail
    const trailLength = 30;
    const trailEndX = x - Math.cos(angle) * trailLength;
    const trailEndY = y - Math.sin(angle) * trailLength;

    // Create gradient for trail
    const gradient = this.ctx.createLinearGradient(trailEndX, trailEndY, x, y);
    gradient.addColorStop(0, 'rgba(255, 0, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 0, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 100, 255, 1)');

    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(trailEndX, trailEndY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    // Draw arrow head
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Glowing arrow
    this.ctx.shadowColor = '#ff00ff';
    this.ctx.shadowBlur = 15;

    // Arrow body
    this.ctx.fillStyle = '#ff66ff';
    this.ctx.beginPath();
    this.ctx.moveTo(10, 0);
    this.ctx.lineTo(-5, -5);
    this.ctx.lineTo(-5, 5);
    this.ctx.closePath();
    this.ctx.fill();

    // Arrow core (brighter)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(8, 0);
    this.ctx.lineTo(-2, -2);
    this.ctx.lineTo(-2, 2);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
    this.ctx.shadowBlur = 0;

    // Draw splash radius indicator if projectile has splash
    if (projectile.config.splash && projectile.hitEntities.size > 0) {
      this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, projectile.config.splashRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  drawSpell(spell: Spell): void {
    const { x, y } = spell.position;
    const radius = spell.config.radius;
    const progress = spell.timeRemaining / spell.config.duration;

    switch (spell.config.type) {
      case 'rage':
        this.drawRageSpell(x, y, radius, progress, spell.team);
        break;
      case 'fireball':
        this.drawFireballSpell(x, y, radius, progress);
        break;
      case 'freeze':
        this.drawFreezeSpell(x, y, radius, progress);
        break;
      case 'poison':
        this.drawPoisonSpell(x, y, radius, progress, spell.team);
        break;
    }
  }

  private drawRageSpell(x: number, y: number, radius: number, progress: number, team: Team): void {
    // Purple/red rage aura
    const alpha = 0.3 + progress * 0.2;
    const pulseScale = 1 + Math.sin(Date.now() / 100) * 0.1;

    // Outer glow
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * pulseScale);
    if (team === 'player') {
      gradient.addColorStop(0, `rgba(255, 100, 100, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(255, 50, 50, ${alpha * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    } else {
      gradient.addColorStop(0, `rgba(255, 100, 100, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(200, 50, 50, ${alpha * 0.5})`);
      gradient.addColorStop(1, 'rgba(150, 0, 0, 0)');
    }

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * pulseScale, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner rage symbol
    this.ctx.fillStyle = `rgba(255, 200, 0, ${alpha + 0.3})`;
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('😤', x, y);

    // Edge ring
    this.ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawFireballSpell(x: number, y: number, radius: number, progress: number): void {
    // Explosion effect
    const explosionProgress = 1 - progress;
    const currentRadius = radius * (0.5 + explosionProgress * 0.5);
    const alpha = progress;

    // Fire gradient
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
    gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
    gradient.addColorStop(0.3, `rgba(255, 200, 50, ${alpha})`);
    gradient.addColorStop(0.6, `rgba(255, 100, 0, ${alpha * 0.8})`);
    gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Fire particles
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Date.now() / 500;
      const dist = currentRadius * 0.6;
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;

      this.ctx.fillStyle = `rgba(255, 150, 0, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 8 * alpha, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Center flash
    if (progress > 0.7) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${(progress - 0.7) * 3})`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, currentRadius * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawFreezeSpell(x: number, y: number, radius: number, progress: number): void {
    const alpha = 0.2 + progress * 0.3;
    const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.05;

    // Ice gradient
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(200, 240, 255, ${alpha + 0.2})`);
    gradient.addColorStop(0.5, `rgba(100, 200, 255, ${alpha})`);
    gradient.addColorStop(1, `rgba(50, 150, 255, 0)`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * pulseScale, 0, Math.PI * 2);
    this.ctx.fill();

    // Ice crystals
    this.ctx.strokeStyle = `rgba(200, 240, 255, ${alpha + 0.3})`;
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const innerRadius = radius * 0.3;
      const outerRadius = radius * 0.8;

      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.cos(angle) * innerRadius, y + Math.sin(angle) * innerRadius);
      this.ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
      this.ctx.stroke();

      // Crystal branches
      const branchAngle1 = angle + 0.3;
      const branchAngle2 = angle - 0.3;
      const branchStart = radius * 0.5;
      const branchEnd = radius * 0.65;

      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.cos(angle) * branchStart, y + Math.sin(angle) * branchStart);
      this.ctx.lineTo(x + Math.cos(branchAngle1) * branchEnd, y + Math.sin(branchAngle1) * branchEnd);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(x + Math.cos(angle) * branchStart, y + Math.sin(angle) * branchStart);
      this.ctx.lineTo(x + Math.cos(branchAngle2) * branchEnd, y + Math.sin(branchAngle2) * branchEnd);
      this.ctx.stroke();
    }

    // Snowflake symbol
    this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.4})`;
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('❄️', x, y);

    // Edge ring
    this.ctx.strokeStyle = `rgba(150, 220, 255, ${alpha})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawPoisonSpell(x: number, y: number, radius: number, progress: number, team: Team): void {
    const alpha = 0.2 + progress * 0.2;
    const time = Date.now() / 1000;

    // Poison cloud gradient
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(100, 255, 100, ${alpha + 0.1})`);
    gradient.addColorStop(0.5, `rgba(50, 200, 50, ${alpha})`);
    gradient.addColorStop(1, `rgba(0, 150, 0, 0)`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Bubbling poison particles
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 + time;
      const dist = radius * (0.3 + Math.sin(time * 2 + i) * 0.3);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      const size = 5 + Math.sin(time * 3 + i * 0.5) * 3;

      this.ctx.fillStyle = `rgba(150, 255, 100, ${alpha + 0.2})`;
      this.ctx.beginPath();
      this.ctx.arc(px, py, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Skull symbol
    this.ctx.fillStyle = `rgba(200, 255, 150, ${alpha + 0.4})`;
    this.ctx.font = '22px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('☠️', x, y);

    // Edge ring (pulsing)
    const pulseAlpha = alpha + Math.sin(time * 4) * 0.1;
    this.ctx.strokeStyle = `rgba(100, 255, 100, ${pulseAlpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 5]);
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawTesla(tesla: Tesla): void {
    if (!tesla.isAlive) return;

    const { x, y } = tesla.position;
    const angle = tesla.angle + tesla.driftAngle;
    const size = tesla.size;

    // Draw skid marks (tire tracks)
    for (let i = 0; i < tesla.skidMarks.length; i++) {
      const mark = tesla.skidMarks[i];
      const alpha = (i / tesla.skidMarks.length) * 0.3;
      this.ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    // Car shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.ellipse(3, 3, size * 0.9, size * 0.5, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Car body - Tesla Model S style
    const carLength = size * 1.5;
    const carWidth = size * 0.7;

    // Main body
    const bodyColor = tesla.team === 'player' ? '#cc0000' : '#0066cc'; // Red for player, blue for enemy
    const lightColor = tesla.team === 'player' ? '#ff3333' : '#3399ff';

    // Draw car body (rounded rectangle)
    this.ctx.fillStyle = bodyColor;
    this.ctx.beginPath();
    this.ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, 8);
    this.ctx.fill();

    // Car roof/cabin (darker)
    this.ctx.fillStyle = '#333';
    this.ctx.beginPath();
    this.ctx.roundRect(-carLength / 4, -carWidth / 3, carLength / 2, carWidth * 0.65, 5);
    this.ctx.fill();

    // Windshield (glass)
    this.ctx.fillStyle = '#88ccff';
    this.ctx.beginPath();
    this.ctx.roundRect(-carLength / 4 + 2, -carWidth / 3 + 2, carLength / 4 - 2, carWidth * 0.65 - 4, 3);
    this.ctx.fill();

    // Rear window
    this.ctx.beginPath();
    this.ctx.roundRect(carLength / 8, -carWidth / 3 + 2, carLength / 6, carWidth * 0.65 - 4, 3);
    this.ctx.fill();

    // Headlights
    this.ctx.fillStyle = tesla.isHonking ? '#ffff00' : '#ffffff';
    this.ctx.beginPath();
    this.ctx.ellipse(carLength / 2 - 5, -carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(carLength / 2 - 5, carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Taillights
    this.ctx.fillStyle = '#ff0000';
    this.ctx.beginPath();
    this.ctx.ellipse(-carLength / 2 + 5, -carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(-carLength / 2 + 5, carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Tesla logo (T)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('T', 0, 0);

    // Hit flash effect
    if (tesla.lastHitTime > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 0, ${tesla.lastHitTime * 3})`;
      this.ctx.beginPath();
      this.ctx.roundRect(-carLength / 2 - 5, -carWidth / 2 - 5, carLength + 10, carWidth + 10, 10);
      this.ctx.fill();
    }

    this.ctx.restore();

    // Electric glow effect (or frozen effect!)
    if (tesla.isFrozen) {
      // Frozen - blue ice effect
      this.ctx.shadowColor = '#00aaff';
      this.ctx.shadowBlur = 25;
      this.ctx.strokeStyle = `rgba(150, 220, 255, 0.8)`;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size + 8, 0, Math.PI * 2);
      this.ctx.stroke();

      // Ice crystals
      this.ctx.fillStyle = 'rgba(200, 240, 255, 0.9)';
      this.ctx.font = '20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('❄️', x, y - size - 5);
    } else {
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 15;
      this.ctx.strokeStyle = `rgba(0, 255, 255, 0.5)`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size + 5, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    // Draw health bar
    const barY = y - size - 15;
    this.drawHealthBar(x, barY, 40, tesla.health, tesla.maxHealth, tesla.team);

    // Draw lifetime indicator
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.ceil(tesla.lifetime)}s`, x, y + size + 15);

    // Draw carried Mini Pekkas on the roof!
    if (tesla.carriedCount > 0) {
      // Draw stacked robots emoji
      this.ctx.fillStyle = '#00bfff';
      this.ctx.font = 'bold 16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🤖', x, y - 25);

      // Draw count badge
      this.ctx.fillStyle = '#ff0000';
      this.ctx.beginPath();
      this.ctx.arc(x + 15, y - 35, 12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 10px Arial';
      this.ctx.fillText(`${tesla.carriedCount}`, x + 15, y - 35);

      // Draw excited indicator for full car
      if (tesla.carriedCount >= 50) {
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('🔥', x - 15, y - 35);
      }
    }
  }

  drawSurge(surge: Surge): void {
    if (!surge.isAlive) return;

    const { x, y } = surge.position;
    const stage = surge.getStage();
    const superCharge = surge.getSuperCharge();

    // Draw split projectiles
    for (const proj of surge.getSplitProjectiles()) {
      this.ctx.fillStyle = '#00ffff';
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.shadowBlur = 0;

    // Stage colors
    const stageColors = ['#4444ff', '#44ff44', '#ffff44', '#ff44ff'];
    const color = stageColors[stage - 1];

    // Electric glow based on stage
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10 + stage * 5;

    // Draw Surge body
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 15 + stage * 2, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw inner circle
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw stage indicator
    this.ctx.fillStyle = '#000000';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${stage}`, x, y);

    this.ctx.shadowBlur = 0;

    // Draw electric bolts around Surge (more at higher stages)
    for (let i = 0; i < stage; i++) {
      const angle = (Date.now() / 200 + i * Math.PI * 2 / stage) % (Math.PI * 2);
      const boltX = x + Math.cos(angle) * (20 + stage * 3);
      const boltY = y + Math.sin(angle) * (20 + stage * 3);

      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(boltX, boltY);
      this.ctx.stroke();
    }

    // Draw super charge bar
    const barWidth = 30;
    const barHeight = 4;
    const barY = y - 30;
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);
    this.ctx.fillStyle = '#ffff00';
    this.ctx.fillRect(x - barWidth / 2, barY, barWidth * superCharge, barHeight);
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);

    // Draw "SURGE" label
    this.ctx.fillStyle = color;
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SURGE', x, y - 40);

    // Draw health bar
    this.drawHealthBar(x, y - 50, 35, surge.health, surge.maxHealth, surge.team);

    // Team ring
    this.ctx.strokeStyle = surge.team === 'player' ? '#4a90d9' : '#d94a4a';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y + 5, 20, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawLily(lily: Lily): void {
    if (!lily.isAlive) return;

    const { x, y } = lily.position;
    const isInvisible = lily.getIsInvisible();
    const superCharge = lily.getSuperCharge();

    this.ctx.save();

    // Invisible Lily is semi-transparent
    if (isInvisible) {
      this.ctx.globalAlpha = 0.3;
    }

    // Draw thorn projectiles
    for (const proj of lily.getThornProjectiles()) {
      this.ctx.fillStyle = '#8B008B'; // Dark magenta
      this.ctx.shadowColor = '#FF00FF';
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      // Draw thorn shape
      const thornSize = 6;
      this.ctx.save();
      this.ctx.translate(proj.x, proj.y);
      this.ctx.rotate(proj.angle);
      this.ctx.beginPath();
      this.ctx.moveTo(thornSize, 0);
      this.ctx.lineTo(-thornSize / 2, -thornSize / 2);
      this.ctx.lineTo(-thornSize / 2, thornSize / 2);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
    this.ctx.shadowBlur = 0;

    // Main body - flower/plant themed
    const baseColor = '#9932CC'; // Dark orchid
    const petalColor = '#FF69B4'; // Hot pink

    // Glow when invisible
    if (isInvisible) {
      this.ctx.shadowColor = '#FF00FF';
      this.ctx.shadowBlur = 15;
    }

    // Draw petals
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Date.now() / 1000;
      const petalX = x + Math.cos(angle) * 12;
      const petalY = y + Math.sin(angle) * 12;
      this.ctx.fillStyle = petalColor;
      this.ctx.beginPath();
      this.ctx.ellipse(petalX, petalY, 6, 4, angle, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw body
    this.ctx.fillStyle = baseColor;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 12, 0, Math.PI * 2);
    this.ctx.fill();

    // Inner circle
    this.ctx.fillStyle = '#FFD700'; // Gold center
    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Draw "LILY" label
    this.ctx.fillStyle = petalColor;
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('LILY', x, y - 35);

    // Draw super charge bar
    const barWidth = 30;
    const barHeight = 4;
    const barY = y - 28;
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);
    this.ctx.fillStyle = '#FF00FF'; // Magenta for Lily's super
    this.ctx.fillRect(x - barWidth / 2, barY, barWidth * superCharge, barHeight);
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);

    // Draw health bar
    this.ctx.globalAlpha = 1; // Reset alpha for health bar
    this.drawHealthBar(x, y - 45, 35, lily.health, lily.maxHealth, lily.team);

    // Team ring
    this.ctx.strokeStyle = lily.team === 'player' ? '#4a90d9' : '#d94a4a';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y + 5, 18, 0, Math.PI * 2);
    this.ctx.stroke();

    // Invisible indicator
    if (isInvisible) {
      this.ctx.fillStyle = '#FF00FF';
      this.ctx.font = 'bold 8px Arial';
      this.ctx.fillText('INVISIBLE', x, y + 30);
    }

    this.ctx.restore();
  }

  drawSpeechBubble(bubble: { x: number; y: number; text: string; life: number }): void {
    const { x, y, text, life } = bubble;
    const alpha = Math.min(1, life); // Fade out as life decreases

    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    // Measure text
    this.ctx.font = 'bold 12px Arial';
    const textWidth = this.ctx.measureText(text).width;
    const padding = 8;
    const bubbleWidth = textWidth + padding * 2;
    const bubbleHeight = 24;

    // Draw bubble background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;

    // Rounded rectangle
    const bx = x - bubbleWidth / 2;
    const by = y - bubbleHeight / 2;
    const radius = 8;

    this.ctx.beginPath();
    this.ctx.moveTo(bx + radius, by);
    this.ctx.lineTo(bx + bubbleWidth - radius, by);
    this.ctx.quadraticCurveTo(bx + bubbleWidth, by, bx + bubbleWidth, by + radius);
    this.ctx.lineTo(bx + bubbleWidth, by + bubbleHeight - radius);
    this.ctx.quadraticCurveTo(bx + bubbleWidth, by + bubbleHeight, bx + bubbleWidth - radius, by + bubbleHeight);
    this.ctx.lineTo(bx + radius, by + bubbleHeight);
    this.ctx.quadraticCurveTo(bx, by + bubbleHeight, bx, by + bubbleHeight - radius);
    this.ctx.lineTo(bx, by + radius);
    this.ctx.quadraticCurveTo(bx, by, bx + radius, by);
    this.ctx.closePath();

    this.ctx.fill();
    this.ctx.stroke();

    // Draw pointer triangle
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(x - 5, by + bubbleHeight);
    this.ctx.lineTo(x + 5, by + bubbleHeight);
    this.ctx.lineTo(x, by + bubbleHeight + 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // Draw text
    this.ctx.fillStyle = '#000000';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);

    this.ctx.restore();
  }
}
