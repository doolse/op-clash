import { Entity, Position, Team } from '../types';
import { Unit, UnitType, AttackCallback } from '../unit';
import { ARENA, isOnBridge, getNearestBridgeX } from '../arena';

// Surge Level 11 stats from Brawl Stars
const SURGE_STATS = {
  health: 5600,
  damage: 1680,
  attackSpeed: 0.6, // Attacks per second
  attackRange: 200, // Stage 1 range
  moveSpeed: 120,
  size: 18,
  cost: 1, // Only 1 elixir!
  superChargePerHit: 0.25, // 4 hits to charge super
  teleportDistance: 100,
};

// Stage upgrades
const STAGE_BONUSES = {
  1: { speedBoost: 1, rangeBoost: 1, splitShots: 1 },
  2: { speedBoost: 1.5, rangeBoost: 1, splitShots: 1 }, // Faster movement
  3: { speedBoost: 1.5, rangeBoost: 1.5, splitShots: 3 }, // Longer range + 3 split shots
  4: { speedBoost: 1.5, rangeBoost: 1.5, splitShots: 6 }, // 6 split shots
};

export class Surge extends Unit {
  readonly unitType: UnitType = 'surge';
  readonly isSurge: boolean = true;

  stage: number = 1;
  superCharge: number = 0;
  teleportCooldown: number = 0;
  lastShotTime: number = 0;
  splitProjectiles: { x: number; y: number; angle: number; life: number }[] = [];
  onUpgrade: ((surge: Surge) => void) | null = null;

  constructor(position: Position, team: Team) {
    super(position, team, {
      health: SURGE_STATS.health,
      damage: SURGE_STATS.damage,
      attackSpeed: SURGE_STATS.attackSpeed,
      attackRange: SURGE_STATS.attackRange,
      moveSpeed: SURGE_STATS.moveSpeed,
      size: SURGE_STATS.size,
      cost: SURGE_STATS.cost,
    });
  }

  update(deltaTime: number, enemies: Entity[]): void {
    if (!this.isAlive) return;
    if (this.isBeingCarried) return;

    // Apply stage bonuses
    const bonus = STAGE_BONUSES[this.stage as keyof typeof STAGE_BONUSES];
    const effectiveSpeed = SURGE_STATS.moveSpeed * bonus.speedBoost;
    const effectiveRange = SURGE_STATS.attackRange * bonus.rangeBoost;

    this.teleportCooldown = Math.max(0, this.teleportCooldown - deltaTime);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    // Update split projectiles
    this.splitProjectiles = this.splitProjectiles.filter(p => {
      p.x += Math.cos(p.angle) * 300 * deltaTime;
      p.y += Math.sin(p.angle) * 300 * deltaTime;
      p.life -= deltaTime;

      // Check for hits
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        const dx = enemy.position.x - p.x;
        const dy = enemy.position.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 20) {
          enemy.health -= this.damage * 0.5; // Split shots do half damage
          p.life = 0;
          break;
        }
      }

      return p.life > 0;
    });

    // Find target
    this.target = this.findNearestEnemy(enemies, effectiveRange * 1.5);

    // Auto-use super when charged and there's an enemy nearby
    if (this.superCharge >= 1 && this.target && this.stage < 4) {
      this.useSuper();
    }

    if (this.target) {
      const dx = this.target.position.x - this.position.x;
      const dy = this.target.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= effectiveRange) {
        // Attack!
        if (this.attackCooldown <= 0) {
          this.attack(this.target);
          this.superCharge = Math.min(1, this.superCharge + SURGE_STATS.superChargePerHit);

          // Stage 3+: Split shots
          if (bonus.splitShots > 1) {
            const baseAngle = Math.atan2(dy, dx);
            for (let i = 0; i < bonus.splitShots; i++) {
              const spreadAngle = baseAngle + (i - bonus.splitShots / 2) * 0.3;
              this.splitProjectiles.push({
                x: this.position.x,
                y: this.position.y,
                angle: spreadAngle,
                life: 0.5,
              });
            }
          }
        }
      } else {
        // Move toward target - but be smart about the river!
        this.smartMove(dx, dy, dist, effectiveSpeed, deltaTime);
      }
    } else {
      // Move toward enemy base
      const targetY = this.team === 'player' ? 0 : 600;
      const dy = targetY - this.position.y;
      if (Math.abs(dy) > 10) {
        // Smart movement toward base
        this.smartMove(0, dy, Math.abs(dy), effectiveSpeed, deltaTime);
      }
    }
  }

  // Smart movement that avoids the river
  private smartMove(dx: number, dy: number, dist: number, speed: number, deltaTime: number): void {
    const riverTop = ARENA.riverY;
    const riverBottom = ARENA.riverY + ARENA.riverHeight;
    const currentY = this.position.y;

    // Calculate where we'd end up
    const nextY = currentY + (dy / dist) * speed * deltaTime;

    // Check if we're about to walk into the river
    const wouldEnterRiver = (currentY < riverTop && nextY >= riverTop) ||
                            (currentY > riverBottom && nextY <= riverBottom) ||
                            (nextY >= riverTop && nextY <= riverBottom);

    // Check if we're currently in the river zone (need to get to a bridge)
    const inRiverZone = currentY >= riverTop - 20 && currentY <= riverBottom + 20;

    if (wouldEnterRiver || inRiverZone) {
      // Are we on a bridge? If so, we can cross!
      if (isOnBridge(this.position.x, this.position.y)) {
        // On bridge, move normally
        this.position.x += (dx / dist) * speed * deltaTime;
        this.position.y += (dy / dist) * speed * deltaTime;
      } else {
        // Not on bridge - navigate to nearest bridge first!
        const bridgeX = getNearestBridgeX(this.position.x);
        const bridgeDx = bridgeX - this.position.x;

        if (Math.abs(bridgeDx) > 10) {
          // Move toward bridge horizontally
          this.position.x += Math.sign(bridgeDx) * speed * deltaTime;
        } else {
          // We're at the bridge X, now we can move vertically
          this.position.y += (dy / dist) * speed * deltaTime;
        }
      }
    } else {
      // Safe to move normally
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

  private useSuper(): void {
    // Teleport forward!
    const targetY = this.team === 'player' ? this.position.y - SURGE_STATS.teleportDistance : this.position.y + SURGE_STATS.teleportDistance;
    this.position.y = targetY;

    // Upgrade stage!
    this.stage = Math.min(4, this.stage + 1);
    this.superCharge = 0;
    this.teleportCooldown = 1;

    console.log(`⚡ SURGE UPGRADED TO STAGE ${this.stage}! ⚡`);
    if (this.onUpgrade) {
      this.onUpgrade(this);
    }
  }

  protected attack(target: Entity): void {
    target.health -= this.damage;
    this.attackCooldown = 1 / this.attackSpeed;
    if (this.onAttack) {
      this.onAttack(this, target);
    }
  }

  // Getters for renderer
  getStage(): number {
    return this.stage;
  }

  getSuperCharge(): number {
    return this.superCharge;
  }

  getSplitProjectiles(): { x: number; y: number; angle: number; life: number }[] {
    return this.splitProjectiles;
  }
}

export function getSurgeCost(): number {
  return SURGE_STATS.cost;
}
