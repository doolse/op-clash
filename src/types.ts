export interface Position {
  x: number;
  y: number;
}

export type Team = 'player' | 'enemy';

export interface Entity {
  id: number;
  position: Position;
  team: Team;
  health: number;
  maxHealth: number;
  isAlive: boolean;
}

export interface Combatant extends Entity {
  damage: number;
  attackSpeed: number; // attacks per second
  attackRange: number;
  attackCooldown: number;
  target: Entity | null;
}

export interface UnitStats {
  health: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  moveSpeed: number;
  cost: number;
  size: number;
}

export interface TowerStats {
  health: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  size: number;
}

export type TowerType = 'king' | 'princess';
