import { Entity, Position, Team, UnitStats } from '../types';
import { Unit, UnitType } from '../unit';

const GOLD_KNIGHT_STATS: UnitStats = {
  health: 800,      // Tankier than regular knight
  damage: 120,      // Higher damage
  attackSpeed: 1.0, // Slightly slower
  attackRange: 30,  // Slightly more range for the knockback
  moveSpeed: 55,    // Slower, he's heavy
  cost: 4,
  size: 18,
};

const KNOCKBACK_STRENGTH = 200; // How far enemies get pushed - needs to be strong to reach river!

export interface KnockbackEvent {
  targetId: number;
  strength: number;
}

export class GoldKnight extends Unit {
  readonly unitType: UnitType = 'goldknight';
  private pendingKnockback: KnockbackEvent | null = null;

  constructor(position: Position, team: Team) {
    super(position, team, GOLD_KNIGHT_STATS);
  }

  // Override attack to add knockback
  protected attack(target: Entity): void {
    target.health -= this.damage;
    this.attackCooldown = 1 / this.attackSpeed;

    // Queue knockback for the game to process
    this.pendingKnockback = {
      targetId: target.id,
      strength: KNOCKBACK_STRENGTH,
    };

    // Call the attack callback for sound effects
    if (this.onAttack) {
      this.onAttack(this, target);
    }
  }

  // Called by game to get and clear pending knockback
  getKnockback(): KnockbackEvent | null {
    const knockback = this.pendingKnockback;
    this.pendingKnockback = null;
    return knockback;
  }
}

export function getGoldKnightCost(): number {
  return GOLD_KNIGHT_STATS.cost;
}
