import { Combatant, Entity, Position, Team, TowerStats, TowerType } from './types';

let nextId = 1000;

const TOWER_STATS: Record<TowerType, TowerStats> = {
  king: {
    health: 7200,      // Triple health (2400 * 3)
    damage: 25,        // Half damage (50 / 2)
    attackSpeed: 0.5,  // Half attack rate (1 / 2)
    attackRange: 120,
    size: 50,
  },
  princess: {
    health: 4200,      // Triple health (1400 * 3)
    damage: 20,        // Half damage (40 / 2)
    attackSpeed: 0.4,  // Half attack rate (0.8 / 2)
    attackRange: 140,
    size: 40,
  },
};

export type TowerAttackCallback = (tower: Tower, target: Entity) => void;

export class Tower implements Combatant {
  id: number;
  position: Position;
  team: Team;
  health: number;
  maxHealth: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  attackCooldown: number;
  target: Entity | null;
  towerType: TowerType;
  size: number;
  onAttack: TowerAttackCallback | null = null;

  constructor(position: Position, team: Team, towerType: TowerType) {
    const stats = TOWER_STATS[towerType];

    this.id = nextId++;
    this.position = { ...position };
    this.team = team;
    this.towerType = towerType;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.damage = stats.damage;
    this.attackSpeed = stats.attackSpeed;
    this.attackRange = stats.attackRange;
    this.attackCooldown = 0;
    this.target = null;
    this.size = stats.size;
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  update(deltaTime: number, enemies: Entity[]): void {
    if (!this.isAlive) return;

    // Update cooldown
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    // Find target
    this.target = this.findNearestEnemy(enemies);

    // Attack if we have a target and cooldown is ready
    if (this.target && this.attackCooldown <= 0) {
      this.attack(this.target);
    }
  }

  private findNearestEnemy(enemies: Entity[]): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const dist = this.distanceTo(enemy);
      if (dist <= this.attackRange && dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private distanceTo(entity: Entity): number {
    const dx = entity.position.x - this.position.x;
    const dy = entity.position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private attack(target: Entity): void {
    target.health -= this.damage;
    this.attackCooldown = 1 / this.attackSpeed;
    if (this.onAttack) {
      this.onAttack(this, target);
    }
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }
}
