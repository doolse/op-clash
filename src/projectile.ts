import { Entity, Position, Team } from './types';

export interface ProjectileConfig {
  damage: number;
  speed: number;
  piercing: boolean;      // Pass through enemies
  splash: boolean;        // Damage nearby enemies on hit
  splashRadius: number;   // Splash damage radius
  seeking: boolean;       // Curve toward enemies
  maxRange: number;       // Maximum travel distance
}

export class Projectile {
  position: Position;
  velocity: Position;
  team: Team;
  config: ProjectileConfig;
  hitEntities: Set<number> = new Set();
  distanceTraveled: number = 0;
  isAlive: boolean = true;
  startPosition: Position;

  constructor(
    start: Position,
    target: Position,
    team: Team,
    config: ProjectileConfig
  ) {
    this.position = { ...start };
    this.startPosition = { ...start };
    this.team = team;
    this.config = config;

    // Calculate initial velocity toward target
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.velocity = {
        x: (dx / dist) * config.speed,
        y: (dy / dist) * config.speed,
      };
    } else {
      this.velocity = { x: 0, y: -config.speed }; // Default upward
    }
  }

  update(deltaTime: number, enemies: Entity[]): Entity[] {
    if (!this.isAlive) return [];

    const hitThisFrame: Entity[] = [];

    // Seeking behavior - curve toward nearest enemy
    if (this.config.seeking) {
      const nearestEnemy = this.findNearestEnemy(enemies);
      if (nearestEnemy) {
        const dx = nearestEnemy.position.x - this.position.x;
        const dy = nearestEnemy.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          // Blend current velocity with direction to enemy
          const seekStrength = 0.1; // How much to curve
          const targetVelX = (dx / dist) * this.config.speed;
          const targetVelY = (dy / dist) * this.config.speed;

          this.velocity.x += (targetVelX - this.velocity.x) * seekStrength;
          this.velocity.y += (targetVelY - this.velocity.y) * seekStrength;

          // Normalize to maintain speed
          const velMag = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
          if (velMag > 0) {
            this.velocity.x = (this.velocity.x / velMag) * this.config.speed;
            this.velocity.y = (this.velocity.y / velMag) * this.config.speed;
          }
        }
      }
    }

    // Move projectile
    const moveX = this.velocity.x * deltaTime;
    const moveY = this.velocity.y * deltaTime;
    this.position.x += moveX;
    this.position.y += moveY;
    this.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);

    // Check for hits
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (this.hitEntities.has(enemy.id)) continue; // Already hit this enemy

      const dist = this.distanceTo(enemy.position);
      const hitRadius = 20; // Hit detection radius

      if (dist < hitRadius) {
        // Hit this enemy
        this.hitEntities.add(enemy.id);
        hitThisFrame.push(enemy);

        // Apply damage
        enemy.health -= this.config.damage;

        // Splash damage
        if (this.config.splash) {
          for (const other of enemies) {
            if (other.id === enemy.id) continue;
            if (!other.isAlive) continue;
            if (this.hitEntities.has(other.id)) continue;

            const splashDist = this.distanceTo(other.position);
            if (splashDist < this.config.splashRadius) {
              // Splash damage falls off with distance
              const falloff = 1 - splashDist / this.config.splashRadius;
              const splashDamage = this.config.damage * 0.5 * falloff;
              other.health -= splashDamage;
              this.hitEntities.add(other.id);
              hitThisFrame.push(other);
            }
          }
        }

        // If not piercing, destroy on first hit
        if (!this.config.piercing) {
          this.isAlive = false;
          break;
        }
      }
    }

    // Check if projectile has traveled too far or left arena
    if (
      this.distanceTraveled > this.config.maxRange ||
      this.position.x < -50 ||
      this.position.x > 850 ||
      this.position.y < -50 ||
      this.position.y > 650
    ) {
      this.isAlive = false;
    }

    return hitThisFrame;
  }

  private findNearestEnemy(enemies: Entity[]): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (this.hitEntities.has(enemy.id)) continue;

      const dist = this.distanceTo(enemy.position);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private distanceTo(pos: Position): number {
    const dx = pos.x - this.position.x;
    const dy = pos.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getAngle(): number {
    return Math.atan2(this.velocity.y, this.velocity.x);
  }
}
