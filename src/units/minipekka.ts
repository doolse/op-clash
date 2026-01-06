import { Entity, Position, Team, UnitStats } from '../types';
import { Unit, UnitType } from '../unit';

const MINI_PEKKA_STATS: UnitStats = {
  health: 600,      // Lower than Knight (660)
  damage: 340,      // Much higher than Knight (75)
  attackSpeed: 1.8, // Slower attack speed (wind up)
  attackRange: 25,
  moveSpeed: 90,    // Faster than Knight (60)
  cost: 4,
  size: 18,
};

export class MiniPekka extends Unit {
  readonly unitType: UnitType = 'minipekka';
  public isCharged: boolean = true;
  private chargeMultiplier: number = 2;

  constructor(position: Position, team: Team) {
    super(position, team, MINI_PEKKA_STATS);
  }

  // Override the attack to implement charge mechanic
  protected attack(target: Entity): void {
    let damage = this.damage;

    if (this.isCharged) {
      damage *= this.chargeMultiplier;
      this.isCharged = false;
    }

    target.health -= damage;
    this.attackCooldown = 1 / this.attackSpeed;
  }
}

export function getMiniPekkaCost(): number {
  return MINI_PEKKA_STATS.cost;
}
