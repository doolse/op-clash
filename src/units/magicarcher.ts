import { Entity, Position, Team, UnitStats } from '../types';
import { Unit, UnitType } from '../unit';
import { Projectile, ProjectileConfig } from '../projectile';

const MAGIC_ARCHER_STATS: UnitStats = {
  health: 250,      // Glass cannon - very low HP
  damage: 150,      // High damage per arrow
  attackSpeed: 1.1, // Fast attacks
  attackRange: 200, // Extreme range
  moveSpeed: 70,    // Medium speed
  cost: 3,
  size: 14,
};

const ARROW_CONFIG: ProjectileConfig = {
  damage: 150,
  speed: 400,
  piercing: true,      // Passes through enemies
  splash: true,        // Explodes on impact
  splashRadius: 60,    // Splash radius
  seeking: true,       // Curves toward enemies
  maxRange: 500,       // Travels far
};

export class MagicArcher extends Unit {
  readonly unitType: UnitType = 'magicarcher';
  public pendingProjectile: { start: Position; target: Position } | null = null;

  constructor(position: Position, team: Team) {
    super(position, team, MAGIC_ARCHER_STATS);
  }

  // Override attack to create projectile instead of instant damage
  protected attack(target: Entity): void {
    // Store projectile info for game to spawn
    this.pendingProjectile = {
      start: { ...this.position },
      target: { ...target.position },
    };
    this.attackCooldown = 1 / this.attackSpeed;
  }

  createProjectile(): Projectile | null {
    if (!this.pendingProjectile) return null;

    const projectile = new Projectile(
      this.pendingProjectile.start,
      this.pendingProjectile.target,
      this.team,
      { ...ARROW_CONFIG, damage: this.damage }
    );

    this.pendingProjectile = null;
    return projectile;
  }
}

export function getMagicArcherCost(): number {
  return MAGIC_ARCHER_STATS.cost;
}
