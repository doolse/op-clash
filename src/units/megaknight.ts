import { Entity, Position, Team, UnitStats } from '../types';
import { Unit, UnitType } from '../unit';

const MEGA_KNIGHT_STATS: UnitStats = {
  health: 1200,     // THICC boy
  damage: 180,      // Base damage
  attackSpeed: 1.3, // Slow but powerful
  attackRange: 35,  // Melee range
  moveSpeed: 45,    // Slow, he's MEGA
  cost: 7,
  size: 24,         // Big boi
};

const JUMP_DAMAGE = 350;        // Damage on landing
const JUMP_SPLASH_RADIUS = 80;  // Splash radius on landing
const JUMP_RANGE_MIN = 100;     // Minimum distance to trigger jump
const JUMP_RANGE_MAX = 300;     // Maximum jump distance
const JUMP_COOLDOWN = 4;        // Seconds between jumps
const JUMP_DURATION = 0.5;      // Time in air

export interface JumpEvent {
  startPos: Position;
  endPos: Position;
  targets: number[];  // Entity IDs to damage
  damage: number;
}

export class MegaKnight extends Unit {
  readonly unitType: UnitType = 'megaknight';
  private jumpCooldown: number = 0;
  private isJumping: boolean = false;
  private jumpProgress: number = 0;
  private jumpStart: Position | null = null;
  private jumpEnd: Position | null = null;
  private pendingJump: JumpEvent | null = null;

  constructor(position: Position, team: Team) {
    super(position, team, MEGA_KNIGHT_STATS);
  }

  update(deltaTime: number, enemies: Entity[]): void {
    if (!this.isAlive) return;

    // Update jump cooldown
    this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);

    // Handle jumping animation
    if (this.isJumping) {
      this.jumpProgress += deltaTime / JUMP_DURATION;

      if (this.jumpProgress >= 1 && this.jumpStart && this.jumpEnd) {
        // Land!
        this.position.x = this.jumpEnd.x;
        this.position.y = this.jumpEnd.y;
        this.isJumping = false;
        this.jumpProgress = 0;
        this.jumpCooldown = JUMP_COOLDOWN;

        // Queue the jump damage event
        const targets: number[] = [];
        for (const enemy of enemies) {
          if (!enemy.isAlive) continue;
          const dx = enemy.position.x - this.position.x;
          const dy = enemy.position.y - this.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= JUMP_SPLASH_RADIUS) {
            targets.push(enemy.id);
          }
        }

        this.pendingJump = {
          startPos: { ...this.jumpStart },
          endPos: { ...this.jumpEnd },
          targets,
          damage: JUMP_DAMAGE,
        };

        this.jumpStart = null;
        this.jumpEnd = null;
      } else if (this.jumpStart && this.jumpEnd) {
        // Interpolate position with arc
        const t = this.jumpProgress;
        const arcHeight = 100; // How high the jump goes

        this.position.x = this.jumpStart.x + (this.jumpEnd.x - this.jumpStart.x) * t;
        this.position.y = this.jumpStart.y + (this.jumpEnd.y - this.jumpStart.y) * t - Math.sin(t * Math.PI) * arcHeight;
      }
      return; // Don't do normal update while jumping
    }

    // Check if we should jump to a target
    if (this.jumpCooldown <= 0) {
      const jumpTarget = this.findJumpTarget(enemies);
      if (jumpTarget) {
        this.startJump(jumpTarget.position);
        return;
      }
    }

    // Normal unit behavior
    super.update(deltaTime, enemies);
  }

  private findJumpTarget(enemies: Entity[]): Entity | null {
    let best: Entity | null = null;
    let bestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const dx = enemy.position.x - this.position.x;
      const dy = enemy.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only jump if target is in jump range
      if (dist >= JUMP_RANGE_MIN && dist <= JUMP_RANGE_MAX && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }

    return best;
  }

  private startJump(targetPos: Position): void {
    this.isJumping = true;
    this.jumpProgress = 0;
    this.jumpStart = { ...this.position };
    this.jumpEnd = { ...targetPos };
  }

  // Override attack to deal splash damage
  protected attack(target: Entity): void {
    // Mega Knight has splash melee attacks
    target.health -= this.damage;
    this.attackCooldown = 1 / this.attackSpeed;

    if (this.onAttack) {
      this.onAttack(this, target);
    }
  }

  // Called by game to get jump event
  getJumpEvent(): JumpEvent | null {
    const jump = this.pendingJump;
    this.pendingJump = null;
    return jump;
  }

  // For rendering - is the unit currently jumping?
  getJumpState(): { isJumping: boolean; progress: number; height: number } {
    const height = this.isJumping ? Math.sin(this.jumpProgress * Math.PI) * 100 : 0;
    return {
      isJumping: this.isJumping,
      progress: this.jumpProgress,
      height,
    };
  }
}

export function getMegaKnightCost(): number {
  return MEGA_KNIGHT_STATS.cost;
}
