import { Entity, Position, Team } from './types';
import { Unit } from './unit';
import { Tower } from './tower';

export type SpellType = 'rage' | 'fireball' | 'freeze' | 'poison';

export interface SpellConfig {
  type: SpellType;
  cost: number;
  radius: number;
  duration: number;
  damage?: number;
  damagePerSecond?: number;
  speedBoost?: number;
  attackSpeedBoost?: number;
  slowAmount?: number;
}

export const SPELL_CONFIGS: Record<SpellType, SpellConfig> = {
  rage: {
    type: 'rage',
    cost: 1,
    radius: 100,
    duration: 5,
    speedBoost: 1.5,        // 50% faster movement
    attackSpeedBoost: 1.4,  // 40% faster attacks
  },
  fireball: {
    type: 'fireball',
    cost: 3,
    radius: 80,
    duration: 0.5, // Just for the visual effect
    damage: 500,
  },
  freeze: {
    type: 'freeze',
    cost: 3,
    radius: 80,
    duration: 4,
  },
  poison: {
    type: 'poison',
    cost: 3,
    radius: 100,
    duration: 8,
    damagePerSecond: 50,
    slowAmount: 0.7, // 30% slow
  },
};

export class Spell {
  position: Position;
  team: Team;
  config: SpellConfig;
  timeRemaining: number;
  isActive: boolean = true;
  hasAppliedInstantEffect: boolean = false;
  affectedEntities: Set<number> = new Set();
  // Track original stats for restoration
  private originalStats: Map<number, { moveSpeed: number; attackSpeed: number }> = new Map();

  constructor(position: Position, team: Team, spellType: SpellType) {
    this.position = { ...position };
    this.team = team;
    this.config = { ...SPELL_CONFIGS[spellType] };
    this.timeRemaining = this.config.duration;
  }

  update(
    deltaTime: number,
    friendlyUnits: Unit[],
    enemyUnits: Unit[],
    friendlyTowers: Tower[],
    enemyTowers: Tower[]
  ): void {
    if (!this.isActive) return;

    this.timeRemaining -= deltaTime;

    switch (this.config.type) {
      case 'rage':
        this.applyRage(friendlyUnits);
        break;
      case 'fireball':
        if (!this.hasAppliedInstantEffect) {
          this.applyFireball(enemyUnits, enemyTowers);
          this.hasAppliedInstantEffect = true;
        }
        break;
      case 'freeze':
        this.applyFreeze(enemyUnits, enemyTowers);
        break;
      case 'poison':
        this.applyPoison(deltaTime, enemyUnits, enemyTowers);
        break;
    }

    if (this.timeRemaining <= 0) {
      this.expire(friendlyUnits, enemyUnits);
      this.isActive = false;
    }
  }

  private isInRadius(entity: Entity): boolean {
    const dx = entity.position.x - this.position.x;
    const dy = entity.position.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.config.radius;
  }

  private applyRage(friendlyUnits: Unit[]): void {
    for (const unit of friendlyUnits) {
      if (!unit.isAlive) continue;
      if (unit.isBeingCarried) continue; // Can't buff units in the car!

      if (this.isInRadius(unit)) {
        if (!this.affectedEntities.has(unit.id)) {
          // Store original stats
          this.originalStats.set(unit.id, {
            moveSpeed: unit.moveSpeed,
            attackSpeed: unit.attackSpeed,
          });
          this.affectedEntities.add(unit.id);
        }
        // Apply boost
        const original = this.originalStats.get(unit.id)!;
        unit.moveSpeed = original.moveSpeed * (this.config.speedBoost || 1);
        unit.attackSpeed = original.attackSpeed * (this.config.attackSpeedBoost || 1);
      } else if (this.affectedEntities.has(unit.id)) {
        // Unit left the radius, restore stats
        const original = this.originalStats.get(unit.id);
        if (original) {
          unit.moveSpeed = original.moveSpeed;
          unit.attackSpeed = original.attackSpeed;
        }
        this.affectedEntities.delete(unit.id);
        this.originalStats.delete(unit.id);
      }
    }
  }

  private applyFireball(enemyUnits: Unit[], enemyTowers: Tower[]): void {
    const damage = this.config.damage || 0;

    for (const unit of enemyUnits) {
      if (!unit.isAlive) continue;
      if (unit.isBeingCarried) continue; // Can't hit units in the car!
      if (this.isInRadius(unit)) {
        unit.health -= damage;
      }
    }

    for (const tower of enemyTowers) {
      if (!tower.isAlive) continue;
      if (this.isInRadius(tower)) {
        tower.health -= damage;
      }
    }
  }

  private applyFreeze(enemyUnits: Unit[], enemyTowers: Tower[]): void {
    for (const unit of enemyUnits) {
      if (!unit.isAlive) continue;
      if (unit.isBeingCarried) continue; // Can't freeze units in the car!

      if (this.isInRadius(unit)) {
        if (!this.affectedEntities.has(unit.id)) {
          this.originalStats.set(unit.id, {
            moveSpeed: unit.moveSpeed,
            attackSpeed: unit.attackSpeed,
          });
          this.affectedEntities.add(unit.id);
        }
        // Freeze: stop all movement and attacks
        unit.moveSpeed = 0;
        unit.attackSpeed = 0.001; // Near zero to prevent division issues
      }
    }

    for (const tower of enemyTowers) {
      if (!tower.isAlive) continue;

      if (this.isInRadius(tower)) {
        if (!this.affectedEntities.has(tower.id)) {
          this.originalStats.set(tower.id, {
            moveSpeed: 0,
            attackSpeed: tower.attackSpeed,
          });
          this.affectedEntities.add(tower.id);
        }
        tower.attackSpeed = 0.001;
      }
    }
  }

  private applyPoison(deltaTime: number, enemyUnits: Unit[], enemyTowers: Tower[]): void {
    const dps = this.config.damagePerSecond || 0;
    const damage = dps * deltaTime;
    const slow = this.config.slowAmount || 1;

    for (const unit of enemyUnits) {
      if (!unit.isAlive) continue;
      if (unit.isBeingCarried) continue; // Can't poison units in the car!

      if (this.isInRadius(unit)) {
        // Apply damage
        unit.health -= damage;

        // Apply slow
        if (!this.affectedEntities.has(unit.id)) {
          this.originalStats.set(unit.id, {
            moveSpeed: unit.moveSpeed,
            attackSpeed: unit.attackSpeed,
          });
          this.affectedEntities.add(unit.id);
        }
        const original = this.originalStats.get(unit.id)!;
        unit.moveSpeed = original.moveSpeed * slow;
      } else if (this.affectedEntities.has(unit.id)) {
        // Unit left poison, restore speed
        const original = this.originalStats.get(unit.id);
        if (original) {
          unit.moveSpeed = original.moveSpeed;
        }
        this.affectedEntities.delete(unit.id);
        this.originalStats.delete(unit.id);
      }
    }

    for (const tower of enemyTowers) {
      if (!tower.isAlive) continue;
      if (this.isInRadius(tower)) {
        tower.health -= damage;
      }
    }
  }

  private expire(friendlyUnits: Unit[], enemyUnits: Unit[]): void {
    // Restore all affected entities to original stats
    const allUnits = [...friendlyUnits, ...enemyUnits];

    for (const unit of allUnits) {
      if (this.affectedEntities.has(unit.id)) {
        const original = this.originalStats.get(unit.id);
        if (original) {
          unit.moveSpeed = original.moveSpeed;
          unit.attackSpeed = original.attackSpeed;
        }
      }
    }

    this.affectedEntities.clear();
    this.originalStats.clear();
  }
}

export function getSpellCost(spellType: SpellType): number {
  return SPELL_CONFIGS[spellType].cost;
}

export function findBestSpellTarget(
  team: Team,
  spellType: SpellType,
  friendlyUnits: Unit[],
  enemyUnits: Unit[],
  enemyTowers: Tower[]
): Position | null {
  const config = SPELL_CONFIGS[spellType];

  // For rage, target friendly units
  if (spellType === 'rage') {
    if (friendlyUnits.length === 0) return null;

    // Find center of friendly units
    let sumX = 0, sumY = 0, count = 0;
    for (const unit of friendlyUnits) {
      if (unit.isAlive) {
        sumX += unit.position.x;
        sumY += unit.position.y;
        count++;
      }
    }
    if (count === 0) return null;
    return { x: sumX / count, y: sumY / count };
  }

  // For offensive spells, target enemies
  const targets = [...enemyUnits.filter(u => u.isAlive), ...enemyTowers.filter(t => t.isAlive)];
  if (targets.length === 0) return null;

  // Find position that hits the most enemies
  let bestPos: Position | null = null;
  let bestCount = 0;

  for (const target of targets) {
    let count = 0;
    for (const other of targets) {
      const dx = other.position.x - target.position.x;
      const dy = other.position.y - target.position.y;
      if (Math.sqrt(dx * dx + dy * dy) <= config.radius) {
        count++;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestPos = { ...target.position };
    }
  }

  return bestPos;
}
