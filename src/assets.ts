export interface SpriteSheet {
  image: HTMLImageElement;
  tileWidth: number;
  tileHeight: number;
  columns: number;
}

export interface Assets {
  characters: SpriteSheet;
  tiles: SpriteSheet;
  towerDefense: SpriteSheet;
}

export async function loadAssets(): Promise<Assets> {
  const [characters, tiles, towerDefense] = await Promise.all([
    loadSpriteSheet('assets/characters.png', 16, 16, 12),
    loadSpriteSheet('assets/basictiles.png', 16, 16, 8),
    loadSpriteSheet('assets/Tilesheet/towerDefense_tilesheet.png', 64, 64, 23),
  ]);

  return { characters, tiles, towerDefense };
}

async function loadSpriteSheet(
  src: string,
  tileWidth: number,
  tileHeight: number,
  columns: number
): Promise<SpriteSheet> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, tileWidth, tileHeight, columns });
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

// Sprite indices for characters.png (16x16, 12 columns)
export const SPRITES = {
  // Row 0-1: Knight (orange armor) - frames 0-3 down, 12-15 left, 24-27 right, 36-39 up
  knightDown: [0, 1, 2, 1],
  knightLeft: [12, 13, 14, 13],
  knightRight: [24, 25, 26, 25],
  knightUp: [36, 37, 38, 37],

  // Row 2-3: Blue character
  mageDown: [3, 4, 5, 4],
  mageLeft: [15, 16, 17, 16],
  mageRight: [27, 28, 29, 28],
  mageUp: [39, 40, 41, 40],

  // Skeletons/enemies (row ~4-5)
  skeletonDown: [48, 49, 50, 49],
  skeletonLeft: [60, 61, 62, 61],
  skeletonRight: [72, 73, 74, 73],
  skeletonUp: [84, 85, 86, 85],
};

// Tile indices for basictiles.png
export const TILES = {
  grass: 0,
  grassAlt: 1,
  dirt: 8,
  water: 32,
  waterAlt: 33,
  bridge: 16,
  stone: 24,
  stoneWall: 56,
  tower: 88, // Tower-like structure
  castle: 96,
};

// Tower defense tilesheet indices (64x64, 23 columns)
export const TD_TILES = {
  // Ground tiles (row 0-3)
  grass1: 0,
  grass2: 1,
  grass3: 2,
  sand1: 46,
  sand2: 47,

  // Towers (various rows)
  towerBase: 180,
  towerTop: 203,
  towerGun: 249,

  // Enemies
  enemy1: 245,
  enemy2: 268,
};

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  index: number,
  x: number,
  y: number,
  scale: number = 1,
  flipX: boolean = false
): void {
  const col = index % sheet.columns;
  const row = Math.floor(index / sheet.columns);
  const sx = col * sheet.tileWidth;
  const sy = row * sheet.tileHeight;
  const destWidth = sheet.tileWidth * scale;
  const destHeight = sheet.tileHeight * scale;

  ctx.save();
  if (flipX) {
    ctx.translate(x + destWidth / 2, y);
    ctx.scale(-1, 1);
    ctx.drawImage(
      sheet.image,
      sx,
      sy,
      sheet.tileWidth,
      sheet.tileHeight,
      -destWidth / 2,
      0,
      destWidth,
      destHeight
    );
  } else {
    ctx.drawImage(
      sheet.image,
      sx,
      sy,
      sheet.tileWidth,
      sheet.tileHeight,
      x,
      y,
      destWidth,
      destHeight
    );
  }
  ctx.restore();
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  index: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const col = index % sheet.columns;
  const row = Math.floor(index / sheet.columns);
  const sx = col * sheet.tileWidth;
  const sy = row * sheet.tileHeight;

  ctx.drawImage(sheet.image, sx, sy, sheet.tileWidth, sheet.tileHeight, x, y, width, height);
}
