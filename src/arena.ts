import { Position, TowerType } from './types';

export const ARENA = {
  width: 800,
  height: 600,
  midLine: 300, // y position of the middle divider

  // Player spawnable area (bottom half)
  playerSpawnMinY: 350,
  playerSpawnMaxY: 580,

  // Bridge positions (gaps in the river)
  bridgeLeft: { x: 200, y: 300, width: 100 },
  bridgeRight: { x: 500, y: 300, width: 100 },

  // River
  riverY: 280,
  riverHeight: 40,
};

export interface TowerPosition {
  position: Position;
  type: TowerType;
}

export const TOWER_POSITIONS = {
  player: [
    { position: { x: 400, y: 520 }, type: 'king' as TowerType },
    { position: { x: 150, y: 450 }, type: 'princess' as TowerType },
    { position: { x: 650, y: 450 }, type: 'princess' as TowerType },
  ],
  enemy: [
    { position: { x: 400, y: 80 }, type: 'king' as TowerType },
    { position: { x: 150, y: 150 }, type: 'princess' as TowerType },
    { position: { x: 650, y: 150 }, type: 'princess' as TowerType },
  ],
};

export function isInPlayerZone(y: number): boolean {
  return y > ARENA.midLine;
}

export function isOnBridge(x: number, y: number): boolean {
  const onRiver = y >= ARENA.riverY && y <= ARENA.riverY + ARENA.riverHeight;
  if (!onRiver) return true; // Not on river, can pass

  const onLeftBridge = x >= ARENA.bridgeLeft.x && x <= ARENA.bridgeLeft.x + ARENA.bridgeLeft.width;
  const onRightBridge = x >= ARENA.bridgeRight.x && x <= ARENA.bridgeRight.x + ARENA.bridgeRight.width;

  return onLeftBridge || onRightBridge;
}

export function getNearestBridgeX(x: number): number {
  const leftBridgeCenter = ARENA.bridgeLeft.x + ARENA.bridgeLeft.width / 2;
  const rightBridgeCenter = ARENA.bridgeRight.x + ARENA.bridgeRight.width / 2;

  return Math.abs(x - leftBridgeCenter) < Math.abs(x - rightBridgeCenter)
    ? leftBridgeCenter
    : rightBridgeCenter;
}
