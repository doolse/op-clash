import { Entity, Position, Team } from '../types';
import { Unit } from '../unit';

const TESLA_STATS = {
  health: 600,
  damage: 200, // Damage per hit when running over enemies
  speed: 180, // Faster than units!
  cost: 5,
  lifetime: 30, // seconds
  size: 30,
  hitCooldown: 0.5, // Time between hitting same target
  turnSpeed: 3, // How fast it can turn (radians/sec)
  dropStartTime: 22.5, // Start dropping when lifetime reaches this
  dropInterval: 2.5, // Drop some every 2.5 seconds
  dropCount: 10, // How many to drop each time
};

export class Tesla {
  id: number;
  position: Position;
  team: Team;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  size: number;
  lifetime: number;
  angle: number = 0; // Direction the car is facing
  velocity: Position = { x: 0, y: 0 };
  target: Entity | null = null;
  hitCooldowns: Map<number, number> = new Map(); // Track cooldown per enemy
  skidMarks: Position[] = []; // Trail of skid marks
  driftAngle: number = 0; // For visual drift effect
  lastHitTime: number = 0;
  isHonking: boolean = false;
  carriedUnits: Unit[] = []; // Mini Pekkas riding in the car! (up to 100!)
  isFrozen: boolean = false;
  freezeTime: number = 0;
  dropTimer: number = 0; // Timer for gradual dropping
  droppedThisFrame: number = 0; // How many pekkas were dropped this frame

  private static nextId = 5000;

  constructor(position: Position, team: Team) {
    this.id = Tesla.nextId++;
    this.position = { ...position };
    this.team = team;
    this.health = TESLA_STATS.health;
    this.maxHealth = TESLA_STATS.health;
    this.damage = TESLA_STATS.damage;
    this.speed = TESLA_STATS.speed;
    this.size = TESLA_STATS.size;
    this.lifetime = TESLA_STATS.lifetime;
    // Start facing toward enemies
    this.angle = team === 'player' ? -Math.PI / 2 : Math.PI / 2;
  }

  get isAlive(): boolean {
    return this.health > 0 && this.lifetime > 0;
  }

  update(deltaTime: number, enemies: Entity[], friendlyUnits?: Unit[], allUnits?: Unit[]): Entity[] {
    if (!this.isAlive) return [];

    // Decrease lifetime
    this.lifetime -= deltaTime;
    this.lastHitTime = Math.max(0, this.lastHitTime - deltaTime);

    // Handle freeze
    if (this.freezeTime > 0) {
      this.freezeTime -= deltaTime;
      this.isFrozen = this.freezeTime > 0;
      if (this.isFrozen) return []; // Can't do anything while frozen!
    }

    // Reset drop counter
    this.droppedThisFrame = 0;

    // Gradual drop: start dropping when lifetime reaches dropStartTime
    if (this.carriedUnits.length > 0 && this.lifetime <= TESLA_STATS.dropStartTime) {
      this.dropTimer -= deltaTime;
      if (this.dropTimer <= 0) {
        this.droppedThisFrame = this.dropSomeUnits(TESLA_STATS.dropCount);
        this.dropTimer = TESLA_STATS.dropInterval;
      }
    }

    // Update carried units positions (stacked on top of car)
    for (let i = 0; i < this.carriedUnits.length; i++) {
      const unit = this.carriedUnits[i];
      // Stack them in a spiral pattern on top
      const angle = (i / 5) * Math.PI * 2;
      const radius = 5 + Math.floor(i / 5) * 8;
      unit.position.x = this.position.x + Math.cos(angle) * radius;
      unit.position.y = this.position.y - 20 - Math.floor(i / 10) * 5; // Stack upward
    }

    // Try to pick up ALL Mini Pekkas - friend or foe! (up to 100!)
    const unitsToCheck = allUnits || friendlyUnits || [];
    if (this.carriedUnits.length < 100) {
      this.tryPickupMiniPekkas(unitsToCheck);
    }

    // Check if there's a Mini Pekka nearby to chase instead of attacking
    const nearbyMiniPekka = this.findNearestMiniPekka(unitsToCheck);

    // Update hit cooldowns
    for (const [id, cooldown] of this.hitCooldowns.entries()) {
      const newCooldown = cooldown - deltaTime;
      if (newCooldown <= 0) {
        this.hitCooldowns.delete(id);
      } else {
        this.hitCooldowns.set(id, newCooldown);
      }
    }

    // PRIORITY: Chase Mini Pekkas to pick them up! Otherwise chase enemies
    if (nearbyMiniPekka && this.carriedUnits.length < 100) {
      this.target = nearbyMiniPekka;
    } else {
      this.target = this.findTarget(enemies);
    }

    const hitEntities: Entity[] = [];

    if (this.target) {
      // Calculate direction to target
      const dx = this.target.position.x - this.position.x;
      const dy = this.target.position.y - this.position.y;
      const targetAngle = Math.atan2(dy, dx);

      // Smoothly turn toward target
      let angleDiff = targetAngle - this.angle;
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Turn toward target
      const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), TESLA_STATS.turnSpeed * deltaTime);
      this.angle += turnAmount;

      // Calculate drift effect (when turning sharply while moving fast)
      this.driftAngle = angleDiff * 0.3;

      // Accelerate in facing direction
      this.velocity.x = Math.cos(this.angle) * this.speed;
      this.velocity.y = Math.sin(this.angle) * this.speed;

      // Add skid marks when drifting
      if (Math.abs(angleDiff) > 0.3 && Math.random() < 0.3) {
        this.skidMarks.push({ ...this.position });
        if (this.skidMarks.length > 20) {
          this.skidMarks.shift();
        }
      }

      // Honk when close to enemy!
      this.isHonking = Math.sqrt(dx * dx + dy * dy) < 100;
    } else {
      // No target - slow down
      this.velocity.x *= 0.95;
      this.velocity.y *= 0.95;
      this.driftAngle *= 0.9;
      this.isHonking = false;
    }

    // Move the car
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Keep in bounds (with some margin)
    const margin = 40;
    this.position.x = Math.max(margin, Math.min(800 - margin, this.position.x));
    this.position.y = Math.max(margin, Math.min(600 - margin, this.position.y));

    // Check for collisions with enemies (RUN THEM OVER!)
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (this.hitCooldowns.has(enemy.id)) continue; // Already hit recently

      const dx = enemy.position.x - this.position.x;
      const dy = enemy.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = this.size + (enemy.size || 15);

      if (dist < hitRadius) {
        // SPLAT! Run them over!
        enemy.health -= this.damage;
        this.hitCooldowns.set(enemy.id, TESLA_STATS.hitCooldown);
        this.lastHitTime = 0.2;
        hitEntities.push(enemy);

        // Push enemy aside (but not towers - they're buildings!)
        const isTower = 'towerType' in enemy;
        if (!isTower && enemy.health > 0 && 'position' in enemy) {
          const pushStrength = 50;
          enemy.position.x += (dx / dist) * pushStrength;
          enemy.position.y += (dy / dist) * pushStrength;
        }
      }
    }

    return hitEntities;
  }

  private findTarget(enemies: Entity[]): Entity | null {
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

  takeDamage(amount: number): void {
    this.health -= amount;
  }

  private findNearestMiniPekka(units: Unit[]): Unit | null {
    let nearest: Unit | null = null;
    let nearestDist = Infinity;

    for (const unit of units) {
      if (!unit.isAlive) continue;
      if (unit.unitType !== 'minipekka') continue;
      if (unit.isBeingCarried) continue;

      const dx = unit.position.x - this.position.x;
      const dy = unit.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearest = unit;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  private tryPickupMiniPekkas(allUnits: Unit[]): void {
    for (const unit of allUnits) {
      if (this.carriedUnits.length >= 100) break; // Full!
      if (!unit.isAlive) continue;
      if (unit.unitType !== 'minipekka') continue;
      if (unit.isBeingCarried) continue; // Already in another car

      const dx = unit.position.x - this.position.x;
      const dy = unit.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.size + 30) {
        // Pick up the Mini Pekka!
        this.carriedUnits.push(unit);
        unit.isBeingCarried = true;
      }
    }
  }

  private dropSomeUnits(count: number): number {
    // Drop some units around the car
    const toDrop = Math.min(count, this.carriedUnits.length);
    for (let i = 0; i < toDrop; i++) {
      const unit = this.carriedUnits[i];
      const angle = (i / toDrop) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 40 + Math.random() * 30;
      unit.position.x = this.position.x + Math.cos(angle) * radius;
      unit.position.y = this.position.y + Math.sin(angle) * radius;
      unit.isBeingCarried = false;
    }
    // Remove dropped units from carried array
    this.carriedUnits = this.carriedUnits.slice(toDrop);
    return toDrop;
  }

  private dropAllUnits(): void {
    // Drop all units in a circle around the car
    for (let i = 0; i < this.carriedUnits.length; i++) {
      const unit = this.carriedUnits[i];
      const angle = (i / this.carriedUnits.length) * Math.PI * 2;
      const radius = 50 + Math.floor(i / 10) * 20;
      unit.position.x = this.position.x + Math.cos(angle) * radius;
      unit.position.y = this.position.y + Math.sin(angle) * radius;
      unit.isBeingCarried = false;
    }
    this.carriedUnits = [];
  }

  // Called when Tesla dies - drop all carried units
  dropOnDeath(): void {
    this.dropAllUnits();
  }

  // Get count for display
  get carriedCount(): number {
    return this.carriedUnits.length;
  }

  // Freeze the Tesla!
  freeze(duration: number): void {
    this.freezeTime = duration;
    this.isFrozen = true;
  }

  // Explode! Drop all Mini Pekkas immediately
  explode(): void {
    this.dropAllUnits();
    this.health = 0; // Destroy the Tesla
  }
}

export function getTeslaCost(): number {
  return TESLA_STATS.cost;
}
