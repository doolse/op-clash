import { Entity, Position, Team } from '../types';
import { Unit, UnitType, AttackCallback } from '../unit';
import { ARENA, isOnBridge, getNearestBridgeX } from '../arena';

// Lily Level 11 stats from Brawl Stars
const LILY_STATS = {
  health: 4200,
  damage: 1400,
  attackSpeed: 0.7, // Attacks per second
  attackRange: 180,
  moveSpeed: 150, // Fast assassin
  size: 16,
  cost: 1, // 1 elixir like Surge
  superChargePerHit: 0.2, // 5 hits to charge super
  dashDistance: 120,
  invisibilityDuration: 2.5,
};

export class Lily extends Unit {
  readonly unitType: UnitType = 'lily';
  readonly isLily: boolean = true;

  superCharge: number = 0;
  isInvisible: boolean = false;
  invisibilityTimer: number = 0;
  timeSinceLastAttack: number = 0;
  thornProjectiles: { x: number; y: number; angle: number; life: number }[] = [];
  dashCooldown: number = 0;
  onSuperUse: ((lily: Lily) => void) | null = null;

  constructor(position: Position, team: Team) {
    super(position, team, {
      health: LILY_STATS.health,
      damage: LILY_STATS.damage,
      attackSpeed: LILY_STATS.attackSpeed,
      attackRange: LILY_STATS.attackRange,
      moveSpeed: LILY_STATS.moveSpeed,
      size: LILY_STATS.size,
      cost: LILY_STATS.cost,
    });
  }

  update(deltaTime: number, enemies: Entity[]): void {
    if (!this.isAlive) return;
    if (this.isBeingCarried) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
    this.dashCooldown = Math.max(0, this.dashCooldown - deltaTime);
    this.timeSinceLastAttack += deltaTime;

    // Update invisibility
    if (this.isInvisible) {
      this.invisibilityTimer -= deltaTime;
      if (this.invisibilityTimer <= 0) {
        this.isInvisible = false;
      }
    }

    // Passive: Go invisible if not attacking for 3 seconds
    if (this.timeSinceLastAttack > 3 && !this.isInvisible) {
      this.isInvisible = true;
      this.invisibilityTimer = LILY_STATS.invisibilityDuration;
    }

    // Update thorn projectiles
    this.thornProjectiles = this.thornProjectiles.filter(p => {
      p.x += Math.cos(p.angle) * 350 * deltaTime;
      p.y += Math.sin(p.angle) * 350 * deltaTime;
      p.life -= deltaTime;

      // Check for hits
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        const dx = enemy.position.x - p.x;
        const dy = enemy.position.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) {
          enemy.health -= this.damage;
          this.superCharge = Math.min(1, this.superCharge + LILY_STATS.superChargePerHit);
          p.life = 0;
          break;
        }
      }

      return p.life > 0;
    });

    // Find target
    this.target = this.findNearestEnemy(enemies, LILY_STATS.attackRange * 2);

    // Auto-use super when charged and there's a nearby enemy
    if (this.superCharge >= 1 && this.target && this.dashCooldown <= 0) {
      this.useSuper();
    }

    if (this.target) {
      const dx = this.target.position.x - this.position.x;
      const dy = this.target.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= LILY_STATS.attackRange) {
        // Attack with thorns!
        if (this.attackCooldown <= 0) {
          this.attackWithThorns(dx, dy);
          this.timeSinceLastAttack = 0;
          this.isInvisible = false; // Attacking breaks invisibility
        }
      } else {
        // Move toward target - smart about river
        this.smartMove(dx, dy, dist, LILY_STATS.moveSpeed, deltaTime);
      }
    } else {
      // Move toward enemy base
      const targetY = this.team === 'player' ? 0 : 600;
      const dy = targetY - this.position.y;
      if (Math.abs(dy) > 10) {
        this.smartMove(0, dy, Math.abs(dy), LILY_STATS.moveSpeed, deltaTime);
      }
    }
  }

  private attackWithThorns(dx: number, dy: number): void {
    const baseAngle = Math.atan2(dy, dx);

    // Fire 3 thorns in a spread pattern
    for (let i = -1; i <= 1; i++) {
      const spreadAngle = baseAngle + i * 0.25;
      this.thornProjectiles.push({
        x: this.position.x,
        y: this.position.y,
        angle: spreadAngle,
        life: 0.6,
      });
    }

    this.attackCooldown = 1 / this.attackSpeed;

    if (this.onAttack) {
      this.onAttack(this, this.target!);
    }
  }

  private useSuper(): void {
    if (!this.target) return;

    // Dash toward enemy!
    const dx = this.target.position.x - this.position.x;
    const dy = this.target.position.y - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const dashDist = Math.min(LILY_STATS.dashDistance, dist);
    this.position.x += (dx / dist) * dashDist;
    this.position.y += (dy / dist) * dashDist;

    // Become invisible after dash!
    this.isInvisible = true;
    this.invisibilityTimer = LILY_STATS.invisibilityDuration;

    this.superCharge = 0;
    this.dashCooldown = 1.5;

    console.log('🌸 LILY DASHES AND VANISHES! 🌸');

    if (this.onSuperUse) {
      this.onSuperUse(this);
    }
  }

  // Smart movement that avoids the river (same as Surge)
  private smartMove(dx: number, dy: number, dist: number, speed: number, deltaTime: number): void {
    const riverTop = ARENA.riverY;
    const riverBottom = ARENA.riverY + ARENA.riverHeight;
    const currentY = this.position.y;

    const nextY = currentY + (dy / dist) * speed * deltaTime;

    const wouldEnterRiver = (currentY < riverTop && nextY >= riverTop) ||
                            (currentY > riverBottom && nextY <= riverBottom) ||
                            (nextY >= riverTop && nextY <= riverBottom);

    const inRiverZone = currentY >= riverTop - 20 && currentY <= riverBottom + 20;

    if (wouldEnterRiver || inRiverZone) {
      if (isOnBridge(this.position.x, this.position.y)) {
        this.position.x += (dx / dist) * speed * deltaTime;
        this.position.y += (dy / dist) * speed * deltaTime;
      } else {
        const bridgeX = getNearestBridgeX(this.position.x);
        const bridgeDx = bridgeX - this.position.x;

        if (Math.abs(bridgeDx) > 10) {
          this.position.x += Math.sign(bridgeDx) * speed * deltaTime;
        } else {
          this.position.y += (dy / dist) * speed * deltaTime;
        }
      }
    } else {
      this.position.x += (dx / dist) * speed * deltaTime;
      this.position.y += (dy / dist) * speed * deltaTime;
    }
  }

  private findNearestEnemy(enemies: Entity[], range: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      const dx = enemy.position.x - this.position.x;
      const dy = enemy.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  // Getters for renderer
  getIsInvisible(): boolean {
    return this.isInvisible;
  }

  getSuperCharge(): number {
    return this.superCharge;
  }

  getThornProjectiles(): { x: number; y: number; angle: number; life: number }[] {
    return this.thornProjectiles;
  }
}

export function getLilyCost(): number {
  return LILY_STATS.cost;
}
