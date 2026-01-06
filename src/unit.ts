import { Combatant, Entity, Position, Team, UnitStats } from './types';
import { ARENA, getNearestBridgeX, isOnBridge } from './arena';

let nextId = 1;

export type UnitType = 'knight' | 'minipekka' | 'magicarcher' | 'goldknight' | 'megaknight' | 'surge' | 'lily';

export type AttackCallback = (attacker: Unit, target: Entity) => void;

export abstract class Unit implements Combatant {
  id: number;
  position: Position;
  team: Team;
  health: number;
  maxHealth: number;
  damage: number;
  attackSpeed: number;
  attackRange: number;
  attackCooldown: number;
  moveSpeed: number;
  target: Entity | null;
  size: number;
  cost: number;
  abstract readonly unitType: UnitType;
  onAttack: AttackCallback | null = null;
  isBeingCarried: boolean = false; // When picked up by Tesla

  constructor(position: Position, team: Team, stats: UnitStats) {
    this.id = nextId++;
    this.position = { ...position };
    this.team = team;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.damage = stats.damage;
    this.attackSpeed = stats.attackSpeed;
    this.attackRange = stats.attackRange;
    this.attackCooldown = 0;
    this.moveSpeed = stats.moveSpeed;
    this.target = null;
    this.size = stats.size;
    this.cost = stats.cost;
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  // Can't take damage while being carried in a Tesla!
  takeDamage(amount: number): void {
    if (this.isBeingCarried) return; // Invincible in the car!
    this.health = Math.max(0, this.health - amount);
  }

  update(deltaTime: number, enemies: Entity[]): void {
    if (!this.isAlive) return;
    if (this.isBeingCarried) return; // Being carried by Tesla!

    // Update cooldown
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);

    // Find target
    this.target = this.findNearestEnemy(enemies);

    if (this.target) {
      const dist = this.distanceTo(this.target);

      if (dist <= this.attackRange) {
        // Attack
        if (this.attackCooldown <= 0) {
          this.attack(this.target);
        }
      } else {
        // Move toward target
        this.moveToward(this.target.position, deltaTime);
      }
    } else {
      // No target, move toward enemy side
      this.moveTowardEnemySide(deltaTime);
    }
  }

  private findNearestEnemy(enemies: Entity[]): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const dist = this.distanceTo(enemy);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  protected distanceTo(entity: Entity): number {
    const dx = entity.position.x - this.position.x;
    const dy = entity.position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private moveToward(target: Position, deltaTime: number): void {
    let targetX = target.x;
    let targetY = target.y;

    const riverTop = ARENA.riverY;
    const riverBottom = ARENA.riverY + ARENA.riverHeight;
    const riverCenter = ARENA.riverY + ARENA.riverHeight / 2;

    // Check if we need to use bridge to reach target
    const needsBridge = this.needsToCrossBridge(targetY);

    if (needsBridge) {
      const bridgeX = getNearestBridgeX(this.position.x);

      // Phase 1: Move horizontally toward bridge first
      if (Math.abs(this.position.x - bridgeX) > 10) {
        targetX = bridgeX;
        // Stay at current Y or move slightly toward river
        if (this.position.y > riverBottom) {
          targetY = Math.max(this.position.y - 20, riverBottom + 5);
        } else if (this.position.y < riverTop) {
          targetY = Math.min(this.position.y + 20, riverTop - 5);
        }
      }
      // Phase 2: On bridge X, now cross the river
      else if (this.position.y >= riverTop - 5 && this.position.y <= riverBottom + 5) {
        // We're at or near the river, go straight across on the bridge
        targetX = bridgeX;
        targetY = this.team === 'player' ? riverTop - 10 : riverBottom + 10;
      }
      // Phase 3: Approach the river before crossing
      else {
        targetX = bridgeX;
        targetY = this.team === 'player' ? riverCenter : riverCenter;
      }
    }

    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const moveAmount = this.moveSpeed * deltaTime;
      const ratio = Math.min(moveAmount / dist, 1);

      this.position.x += dx * ratio;
      this.position.y += dy * ratio;

      // Clamp to arena bounds
      this.position.x = Math.max(this.size, Math.min(ARENA.width - this.size, this.position.x));
      this.position.y = Math.max(this.size, Math.min(ARENA.height - this.size, this.position.y));
    }
  }

  private needsToCrossBridge(targetY: number): boolean {
    const myY = this.position.y;
    const riverTop = ARENA.riverY;
    const riverBottom = ARENA.riverY + ARENA.riverHeight;

    // Check if target is on other side of river
    if (myY > riverBottom && targetY < riverTop) return true;
    if (myY < riverTop && targetY > riverBottom) return true;

    // Also return true if we're currently in the river area but not on a bridge
    const inRiver = myY >= riverTop && myY <= riverBottom;
    if (inRiver && !isOnBridge(this.position.x, myY)) return true;

    return false;
  }

  private moveTowardEnemySide(deltaTime: number): void {
    const targetY = this.team === 'player' ? 80 : 520;
    const targetX = this.position.x; // Keep same X, just move forward

    this.moveToward({ x: targetX, y: targetY }, deltaTime);
  }

  protected attack(target: Entity): void {
    target.health -= this.damage;
    this.attackCooldown = 1 / this.attackSpeed;
    if (this.onAttack) {
      this.onAttack(this, target);
    }
  }
}
