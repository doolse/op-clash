import { Position, Team, UnitStats } from '../types';
import { Unit, UnitType } from '../unit';

const KNIGHT_STATS: UnitStats = {
  health: 660,
  damage: 75,
  attackSpeed: 1.2,
  attackRange: 25,
  moveSpeed: 60,
  cost: 3,
  size: 15,
};

export class Knight extends Unit {
  readonly unitType: UnitType = 'knight';

  constructor(position: Position, team: Team) {
    super(position, team, KNIGHT_STATS);
  }
}

export function getKnightCost(): number {
  return KNIGHT_STATS.cost;
}
