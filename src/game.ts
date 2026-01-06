import { ARENA, TOWER_POSITIONS, isInPlayerZone, isOnBridge } from './arena';
import { Renderer } from './renderer';
import { Tower } from './tower';
import { Unit, UnitType } from './unit';
import { Knight, getKnightCost } from './units/knight';
import { MiniPekka, getMiniPekkaCost } from './units/minipekka';
import { MagicArcher, getMagicArcherCost } from './units/magicarcher';
import { GoldKnight, getGoldKnightCost } from './units/goldknight';
import { MegaKnight, getMegaKnightCost } from './units/megaknight';
import { Surge, getSurgeCost } from './units/surge';
import { Lily, getLilyCost } from './units/lily';
import { Tesla, getTeslaCost } from './buildings/tesla';
import { Projectile } from './projectile';
import { Spell, SpellType, getSpellCost, findBestSpellTarget, SPELL_CONFIGS } from './spell';
import { Entity, Team, Position } from './types';
import { loadAssets } from './assets';
import * as Audio from './audio';

const MAX_ELIXIR = 10;
const ELIXIR_REGEN_RATE = 0.5;

type BuildingType = 'tesla';
type CardType = UnitType | SpellType | BuildingType;

const CARD_COSTS: Record<CardType, number> = {
  knight: getKnightCost(),
  minipekka: getMiniPekkaCost(),
  magicarcher: getMagicArcherCost(),
  goldknight: getGoldKnightCost(),
  megaknight: getMegaKnightCost(),
  surge: getSurgeCost(),
  lily: getLilyCost(),
  tesla: getTeslaCost(),
  // Spells are HALF PRICE because they hit both teams!
  rage: Math.floor(getSpellCost('rage') / 2) || 1,
  fireball: Math.floor(getSpellCost('fireball') / 2) || 1,
  freeze: Math.floor(getSpellCost('freeze') / 2) || 1,
  poison: Math.floor(getSpellCost('poison') / 2) || 1,
};

const SPELL_TYPES: SpellType[] = ['rage', 'fireball', 'freeze', 'poison'];
const BUILDING_TYPES: BuildingType[] = ['tesla'];

function isSpell(card: CardType): card is SpellType {
  return SPELL_TYPES.includes(card as SpellType);
}

function isBuilding(card: CardType): card is BuildingType {
  return BUILDING_TYPES.includes(card as BuildingType);
}

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private lastTime: number = 0;
  private gameTime: number = 0;

  private playerTowers: Tower[] = [];
  private enemyTowers: Tower[] = [];
  private playerUnits: Unit[] = [];
  private enemyUnits: Unit[] = [];
  private projectiles: Projectile[] = [];
  private spells: Spell[] = [];
  private playerTeslas: Tesla[] = [];
  private enemyTeslas: Tesla[] = [];
  private speechBubbles: { x: number; y: number; text: string; life: number }[] = [];

  private elixir: number = 5;
  private enemyElixir: number = 5;

  private gameOver: boolean = false;
  private winner: Team | null = null;
  private paused: boolean = false;

  private enemySpawnTimer: number = 0;
  private enemySpellTimer: number = 5;
  private selectedCard: CardType = 'minipekka';
  private elixirMultiplier: number = 1;

  // Drag targeting for spells
  private isDragging: boolean = false;
  private dragStart: Position | null = null;
  private dragCurrent: Position | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.setupTowers();
    this.setupEventListeners();
    this.setupCardSelection();
  }

  private setupTowers(): void {
    for (const towerPos of TOWER_POSITIONS.player) {
      const tower = new Tower(towerPos.position, 'player', towerPos.type);
      tower.onAttack = () => Audio.playTowerShoot();
      this.playerTowers.push(tower);
    }
    for (const towerPos of TOWER_POSITIONS.enemy) {
      const tower = new Tower(towerPos.position, 'enemy', towerPos.type);
      tower.onAttack = () => Audio.playTowerShoot();
      this.enemyTowers.push(tower);
    }
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.cancelDrag());

    document.addEventListener('keydown', (e) => {
      const keyMap: Record<string, CardType> = {
        '2': 'minipekka',
        '3': 'magicarcher',
        '4': 'goldknight',
        '5': 'megaknight',
        '6': 'rage',
        '7': 'fireball',
        '8': 'freeze',
        '9': 'poison',
        '0': 'tesla',
        '-': 'surge',
        '=': 'lily',
      };
      if (keyMap[e.key]) {
        this.selectCard(keyMap[e.key]);
      }
      // WIN BUTTON - Press W to unleash chaos!
      if (e.key.toLowerCase() === 'w') {
        this.unleashChaos();
      }
      // CHALLENGE MODE - Press L to spawn 100 enemy knights!
      if (e.key.toLowerCase() === 'l') {
        this.unleashHorde();
      }
      // MEGA KNIGHT ASSAULT - Press K to teleport all Mega Knights to enemy king!
      if (e.key.toLowerCase() === 'k') {
        this.megaKnightAssault();
      }
      // ELIXIR BOOST - Shift+2/3/5 for 2x/3x/5x elixir regen
      if (e.shiftKey) {
        if (e.key === '!' || e.key === '1') this.setElixirMultiplier(0.5);
        if (e.key === '@' || e.key === '2') this.setElixirMultiplier(2);
        if (e.key === '#' || e.key === '3') this.setElixirMultiplier(3);
        if (e.key === '%' || e.key === '5') this.setElixirMultiplier(5);
      }
      // SUDDEN DEATH - Press S to set all towers to 1 HP!
      if (e.key.toLowerCase() === 's') {
        this.suddenDeath();
      }
      // PAUSE - Press P to pause/unpause
      if (e.key.toLowerCase() === 'p') {
        this.togglePause();
      }
      // MINI PEKKA SWARM - Press M to spawn 12 Mini Pekkas!
      if (e.key.toLowerCase() === 'm') {
        this.spawnMiniPekkaSwarm();
      }
      // LOADED TESLA - Press T to spawn a Tesla with 75 Mini Pekkas inside!
      if (e.key.toLowerCase() === 't') {
        this.spawnLoadedTesla();
      }
      // ENEMY MINI PEKKAS - Press N to spawn 25 enemy Mini Pekkas!
      if (e.key.toLowerCase() === 'n') {
        this.spawnEnemyMiniPekkas();
      }
      // SURGE - Press C to summon Surge from Brawl Stars!
      if (e.key.toLowerCase() === 'c') {
        this.spawnSurge();
      }
    });
  }

  private setupCardSelection(): void {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardType = card.getAttribute('data-card') as CardType;
        if (cardType) {
          this.selectCard(cardType);
        }
      });
    });
  }

  private selectCard(cardType: CardType): void {
    this.selectedCard = cardType;
    this.cancelDrag();

    const cards = document.querySelectorAll('.card');
    cards.forEach((card) => {
      card.classList.remove('selected');
      if (card.getAttribute('data-card') === cardType) {
        card.classList.add('selected');
      }
    });
  }

  private getMousePos(event: MouseEvent): Position {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private handleMouseDown(event: MouseEvent): void {
    if (this.gameOver) {
      this.restart();
      return;
    }

    const pos = this.getMousePos(event);

    if (isSpell(this.selectedCard)) {
      // Start drag for spell targeting
      this.isDragging = true;
      this.dragStart = pos;
      this.dragCurrent = pos;
    } else if (isBuilding(this.selectedCard)) {
      // Place building (Tesla car can be placed anywhere in player zone)
      if (isInPlayerZone(pos.y)) {
        this.trySpawnBuilding(pos.x, pos.y, this.selectedCard);
      }
    } else {
      // Instant place for units
      if (isInPlayerZone(pos.y) && pos.y >= ARENA.playerSpawnMinY && pos.y <= ARENA.playerSpawnMaxY) {
        this.trySpawnUnit(pos.x, pos.y, this.selectedCard as UnitType);
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      this.dragCurrent = this.getMousePos(event);
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.isDragging && this.dragCurrent) {
      this.tryCastSpell(this.selectedCard as SpellType, this.dragCurrent);
    }
    this.cancelDrag();
  }

  private cancelDrag(): void {
    this.isDragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
  }

  private setupUnitAttackSound(unit: Unit): void {
    unit.onAttack = (attacker) => {
      // Magic archer uses projectiles, handled separately
      if (attacker.unitType === 'magicarcher') return;

      // Heavy hitters get a bigger sound
      if (attacker.unitType === 'minipekka' || attacker.unitType === 'goldknight') {
        Audio.playHeavyHit();
      } else {
        Audio.playSwordHit();
      }
    };
  }

  private countSurges(team: 'player' | 'enemy'): number {
    const units = team === 'player' ? this.playerUnits : this.enemyUnits;
    return units.filter(u => (u as any).isSurge && u.isAlive).length;
  }

  private countLilys(team: 'player' | 'enemy'): number {
    const units = team === 'player' ? this.playerUnits : this.enemyUnits;
    return units.filter(u => (u as any).isLily && u.isAlive).length;
  }

  private trySpawnUnit(x: number, y: number, unitType: UnitType): void {
    // Surge limit: max 2 per team
    if (unitType === 'surge' && this.countSurges('player') >= 2) {
      console.log('Max 2 Surges per team!');
      return;
    }
    // Lily limit: max 2 per team
    if (unitType === 'lily' && this.countLilys('player') >= 2) {
      console.log('Max 2 Lilys per team!');
      return;
    }

    const cost = CARD_COSTS[unitType];
    if (this.elixir >= cost) {
      this.elixir -= cost;

      let unit: Unit;
      switch (unitType) {
        case 'minipekka':
          unit = new MiniPekka({ x, y }, 'player');
          break;
        case 'magicarcher':
          unit = new MagicArcher({ x, y }, 'player');
          break;
        case 'goldknight':
          unit = new GoldKnight({ x, y }, 'player');
          break;
        case 'megaknight':
          unit = new MegaKnight({ x, y }, 'player');
          break;
        case 'surge':
          const surge = new Surge({ x, y }, 'player');
          surge.onAttack = () => Audio.playSurgeShot();
          surge.onUpgrade = () => Audio.playSurgeUpgrade();
          unit = surge;
          Audio.playSurgeVoice(); // "Did somebody call for SURGE?"
          this.speechBubbles.push({ x, y: y - 50, text: 'Did somebody call for SURGE?', life: 2.5 });
          break;
        case 'lily':
          const lily = new Lily({ x, y }, 'player');
          lily.onAttack = () => Audio.playLilyShot();
          lily.onSuperUse = () => Audio.playLilyDash();
          unit = lily;
          Audio.playLilyVoice(); // "Thorn in your side!"
          this.speechBubbles.push({ x, y: y - 50, text: 'Thorn in your side!', life: 2.5 });
          break;
        case 'knight':
        default:
          unit = new Knight({ x, y }, 'player');
          break;
      }
      this.setupUnitAttackSound(unit);
      this.playerUnits.push(unit);
      if (unitType !== 'surge' && unitType !== 'lily') {
        Audio.playSpawnSound();
      }
    }
  }

  private trySpawnBuilding(x: number, y: number, buildingType: BuildingType): void {
    const cost = CARD_COSTS[buildingType];
    if (this.elixir >= cost) {
      this.elixir -= cost;

      switch (buildingType) {
        case 'tesla':
          const tesla = new Tesla({ x, y }, 'player');
          this.playerTeslas.push(tesla);
          Audio.playTeslaSpawn();
          break;
      }
    }
  }

  // THE WIN BUTTON - Spawns 50 Gold Knights!
  private unleashChaos(): void {
    console.log('UNLEASHING CHAOS!!! 🔥👑🔥');
    Audio.playVictory();

    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const x = 100 + Math.random() * (ARENA.width - 200);
        const y = ARENA.playerSpawnMinY + Math.random() * (ARENA.playerSpawnMaxY - ARENA.playerSpawnMinY);
        const unit = new GoldKnight({ x, y }, 'player');
        this.setupUnitAttackSound(unit);
        this.playerUnits.push(unit);
        if (i % 10 === 0) Audio.playSpawnSound();
      }, i * 50); // Stagger spawns for dramatic effect
    }
  }

  // THE HORDE - Spawns 100 enemy knights! Good luck!
  private unleashHorde(): void {
    console.log('THE HORDE IS COMING!!! ⚔️💀⚔️');
    Audio.playDefeat();

    for (let i = 0; i < 100; i++) {
      setTimeout(() => {
        const x = 100 + Math.random() * (ARENA.width - 200);
        const y = 30 + Math.random() * 100;
        const unit = new Knight({ x, y }, 'enemy');
        this.setupUnitAttackSound(unit);
        this.enemyUnits.push(unit);
        if (i % 15 === 0) Audio.playSpawnSound();
      }, i * 30); // Faster spawns for overwhelming effect
    }
  }

  // MEGA KNIGHT ASSAULT - Teleport to enemy king + bridge chaos!
  private megaKnightAssault(): void {
    console.log('MEGA KNIGHT ASSAULT!!! ⚔️💥⚔️');
    Audio.playMegaKnightJump();

    // Get enemy king tower position
    const enemyKing = this.enemyTowers[0];
    const kingX = enemyKing.position.x;
    const kingY = enemyKing.position.y + 60; // Just below the king

    // Teleport all friendly Mega Knights to enemy king
    for (const unit of this.playerUnits) {
      if (unit.unitType === 'megaknight') {
        unit.position.x = kingX + (Math.random() - 0.5) * 80;
        unit.position.y = kingY + (Math.random() - 0.5) * 40;
      }
    }

    // Spawn 5 Mega Knights on the bridges
    const bridgeY = ARENA.riverY + ARENA.riverHeight / 2;
    const bridges = [
      ARENA.bridgeLeft.x + ARENA.bridgeLeft.width / 2,
      ARENA.bridgeRight.x + ARENA.bridgeRight.width / 2,
    ];

    for (let i = 0; i < 5; i++) {
      const bridgeX = bridges[i % 2];
      const unit = new MegaKnight(
        { x: bridgeX + (Math.random() - 0.5) * 40, y: bridgeY + 50 },
        'player'
      );
      this.setupUnitAttackSound(unit);
      this.playerUnits.push(unit);
    }

    // Spawn 12 enemy knights at the bridges
    for (let i = 0; i < 12; i++) {
      const bridgeX = bridges[i % 2];
      const unit = new Knight(
        { x: bridgeX + (Math.random() - 0.5) * 60, y: bridgeY - 30 },
        'enemy'
      );
      this.setupUnitAttackSound(unit);
      this.enemyUnits.push(unit);
    }

    Audio.playSpawnSound();
  }

  // Set elixir regen multiplier
  private setElixirMultiplier(multiplier: number): void {
    this.elixirMultiplier = multiplier;
    console.log(`ELIXIR BOOST: ${multiplier}x! 💧⚡`);
    Audio.playRage();
  }

  // SUDDEN DEATH - All towers to 1 HP!
  private suddenDeath(): void {
    console.log('⚠️ SUDDEN DEATH! ⚠️');

    // Set all towers to 1 HP
    for (const tower of this.playerTowers) {
      if (tower.isAlive) tower.health = 1;
    }
    for (const tower of this.enemyTowers) {
      if (tower.isAlive) tower.health = 1;
    }

    // Dramatic sound
    Audio.playTowerDestroyed();
  }

  // PAUSE - Toggle pause
  private togglePause(): void {
    this.paused = !this.paused;
    console.log(this.paused ? '⏸️ PAUSED' : '▶️ RESUMED');
  }

  // MINI PEKKA SWARM - Spawn 12 Mini Pekkas!
  private spawnMiniPekkaSwarm(): void {
    console.log('🤖 MINI PEKKA SWARM! 🤖');
    Audio.playSpawnSound();

    for (let i = 0; i < 12; i++) {
      const x = 100 + Math.random() * (ARENA.width - 200);
      const y = ARENA.playerSpawnMinY + Math.random() * (ARENA.playerSpawnMaxY - ARENA.playerSpawnMinY);
      const unit = new MiniPekka({ x, y }, 'player');
      this.setupUnitAttackSound(unit);
      this.playerUnits.push(unit);
    }
  }

  // ENEMY MINI PEKKAS - Spawn 25 enemy Mini Pekkas!
  private spawnEnemyMiniPekkas(): void {
    console.log('🤖 ENEMY MINI PEKKA SWARM! 🤖');
    Audio.playSpawnSound();

    for (let i = 0; i < 25; i++) {
      const x = 100 + Math.random() * (ARENA.width - 200);
      const y = 30 + Math.random() * 100;
      const unit = new MiniPekka({ x, y }, 'enemy');
      this.setupUnitAttackSound(unit);
      this.enemyUnits.push(unit);
    }
  }

  // SURGE - Spawn Surge from Brawl Stars!
  private spawnSurge(): void {
    // Max 2 Surges per team
    if (this.countSurges('player') >= 2) {
      console.log('Max 2 Surges per team!');
      return;
    }

    console.log('⚡ SURGE HAS ENTERED THE ARENA! ⚡');
    Audio.playSurgeVoice(); // "Did somebody call for SURGE?"

    const x = ARENA.width / 2;
    const y = ARENA.playerSpawnMaxY;
    const surge = new Surge({ x, y }, 'player');
    surge.onAttack = () => Audio.playSurgeShot();
    surge.onUpgrade = () => Audio.playSurgeUpgrade();
    this.playerUnits.push(surge);

    // Speech bubble!
    this.speechBubbles.push({ x, y: y - 50, text: 'Did somebody call for SURGE?', life: 2.5 });
  }

  // LOADED TESLA - Teleport ALL Mini Pekkas into Tesla + spawn 75 more!
  private spawnLoadedTesla(): void {
    // Spawn Tesla in player zone
    const teslaX = ARENA.width / 2;
    const teslaY = ARENA.playerSpawnMaxY;
    const tesla = new Tesla({ x: teslaX, y: teslaY }, 'player');

    // Grab ALL existing Mini Pekkas from BOTH teams!
    const allUnits = [...this.playerUnits, ...this.enemyUnits];
    let kidnapped = 0;
    for (const unit of allUnits) {
      if (unit.unitType === 'minipekka' && unit.isAlive && !unit.isBeingCarried) {
        if (tesla.carriedUnits.length >= 100) break;
        unit.isBeingCarried = true;
        tesla.carriedUnits.push(unit);
        kidnapped++;
      }
    }

    // Spawn 75 additional Mini Pekkas
    const toSpawn = Math.min(75, 100 - tesla.carriedUnits.length);
    for (let i = 0; i < toSpawn; i++) {
      const unit = new MiniPekka({ x: teslaX, y: teslaY }, 'player');
      this.setupUnitAttackSound(unit);
      unit.isBeingCarried = true;
      tesla.carriedUnits.push(unit);
      this.playerUnits.push(unit);
    }

    console.log(`🚗🤖 LOADED TESLA! Kidnapped ${kidnapped} + spawned ${toSpawn} = ${tesla.carriedUnits.length} Mini Pekkas! 🚗`);
    Audio.playTeslaSpawn();

    this.playerTeslas.push(tesla);
  }

  private tryCastSpell(spellType: SpellType, position: Position): void {
    const cost = CARD_COSTS[spellType];
    if (this.elixir >= cost) {
      this.elixir -= cost;
      this.spells.push(new Spell(position, 'player', spellType));

      // Play spell sound
      switch (spellType) {
        case 'fireball':
          Audio.playFireball();
          break;
        case 'freeze':
          Audio.playFreeze();
          break;
        case 'poison':
          Audio.playPoison();
          break;
        case 'rage':
          Audio.playRage();
          break;
      }
    }
  }

  private spawnEnemyUnit(): void {
    const roll = Math.random();

    // 10% chance to spawn a Tesla instead of a unit!
    if (roll < 0.1) {
      const cost = CARD_COSTS['tesla'];
      if (this.enemyElixir >= cost) {
        this.enemyElixir -= cost;
        const x = 100 + Math.random() * (ARENA.width - 200);
        const y = 50 + Math.random() * 80;
        const tesla = new Tesla({ x, y }, 'enemy');
        this.enemyTeslas.push(tesla);
        Audio.playTeslaSpawn();
      }
      return;
    }

    let unitType: UnitType;
    if (roll < 0.30) {
      unitType = 'knight';
    } else if (roll < 0.45) {
      unitType = 'minipekka';
    } else if (roll < 0.55) {
      unitType = 'magicarcher';
    } else if (roll < 0.65) {
      unitType = 'goldknight';
    } else if (roll < 0.75) {
      unitType = 'megaknight'; // Rare but scary!
    } else if (roll < 0.875) {
      // Surge: 12.5% chance
      if (this.countSurges('enemy') >= 2) {
        unitType = 'knight'; // Max 2 Surges
      } else {
        unitType = 'surge';
      }
    } else {
      // Lily: 12.5% chance
      if (this.countLilys('enemy') >= 2) {
        unitType = 'knight'; // Max 2 Lilys
      } else {
        unitType = 'lily';
      }
    }

    const cost = CARD_COSTS[unitType];

    if (this.enemyElixir >= cost) {
      this.enemyElixir -= cost;
      const x = 100 + Math.random() * (ARENA.width - 200);
      const y = 50 + Math.random() * 80;

      let unit: Unit;
      switch (unitType) {
        case 'minipekka':
          unit = new MiniPekka({ x, y }, 'enemy');
          break;
        case 'magicarcher':
          unit = new MagicArcher({ x, y }, 'enemy');
          break;
        case 'goldknight':
          unit = new GoldKnight({ x, y }, 'enemy');
          break;
        case 'megaknight':
          unit = new MegaKnight({ x, y }, 'enemy');
          break;
        case 'surge':
          const surge = new Surge({ x, y }, 'enemy');
          surge.onAttack = () => Audio.playSurgeShot();
          surge.onUpgrade = () => Audio.playSurgeUpgrade();
          unit = surge;
          Audio.playSurgeVoice(); // "Did somebody call for SURGE?"
          this.speechBubbles.push({ x, y: y - 50, text: 'Did somebody call for SURGE?', life: 2.5 });
          break;
        case 'lily':
          const lily = new Lily({ x, y }, 'enemy');
          lily.onAttack = () => Audio.playLilyShot();
          lily.onSuperUse = () => Audio.playLilyDash();
          unit = lily;
          Audio.playLilyVoice(); // "Thorn in your side!"
          this.speechBubbles.push({ x, y: y - 50, text: 'Thorn in your side!', life: 2.5 });
          break;
        default:
          unit = new Knight({ x, y }, 'enemy');
          break;
      }
      this.setupUnitAttackSound(unit);
      this.enemyUnits.push(unit);
    }
  }

  private enemyCastSpell(): void {
    const spellTypes: SpellType[] = ['rage', 'fireball', 'freeze', 'poison'];
    const spellType = spellTypes[Math.floor(Math.random() * spellTypes.length)];
    const cost = CARD_COSTS[spellType];

    if (this.enemyElixir >= cost) {
      const target = findBestSpellTarget(
        'enemy',
        spellType,
        this.enemyUnits,
        this.playerUnits,
        this.playerTowers
      );

      if (target) {
        this.enemyElixir -= cost;
        this.spells.push(new Spell(target, 'enemy', spellType));

        // Play spell sound for enemy too
        switch (spellType) {
          case 'fireball':
            Audio.playFireball();
            break;
          case 'freeze':
            Audio.playFreeze();
            break;
          case 'poison':
            Audio.playPoison();
            break;
          case 'rage':
            Audio.playRage();
            break;
        }
      }
    }
  }

  async start(): Promise<void> {
    // Initialize audio system
    Audio.initAudio();

    try {
      const assets = await loadAssets();
      this.renderer.setAssets(assets);
      console.log('Assets loaded successfully!');
    } catch (e) {
      console.warn('Failed to load assets, using fallback graphics:', e);
    }

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    this.gameTime += deltaTime;

    this.update(deltaTime);
    this.render(deltaTime);

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private update(deltaTime: number): void {
    if (this.gameOver || this.paused) return;

    this.elixir = Math.min(MAX_ELIXIR, this.elixir + ELIXIR_REGEN_RATE * this.elixirMultiplier * deltaTime);
    this.enemyElixir = Math.min(MAX_ELIXIR, this.enemyElixir + ELIXIR_REGEN_RATE * deltaTime);

    this.updateCardUI();

    this.enemySpawnTimer -= deltaTime;
    if (this.enemySpawnTimer <= 0) {
      this.spawnEnemyUnit();
      this.enemySpawnTimer = 3 + Math.random() * 2;
    }

    this.enemySpellTimer -= deltaTime;
    if (this.enemySpellTimer <= 0) {
      this.enemyCastSpell();
      this.enemySpellTimer = 5 + Math.random() * 5;
    }

    const playerEnemies: Entity[] = [...this.enemyTowers, ...this.enemyUnits];
    const enemyEnemies: Entity[] = [...this.playerTowers, ...this.playerUnits];

    for (const tower of this.playerTowers) {
      tower.update(deltaTime, playerEnemies);
    }
    for (const tower of this.enemyTowers) {
      tower.update(deltaTime, enemyEnemies);
    }

    for (const unit of this.playerUnits) {
      unit.update(deltaTime, playerEnemies);
      this.checkForProjectiles(unit);
      this.checkForKnockback(unit, this.enemyUnits);
      this.checkForMegaKnightJump(unit, this.enemyUnits);
    }
    for (const unit of this.enemyUnits) {
      unit.update(deltaTime, enemyEnemies);
      this.checkForProjectiles(unit);
      this.checkForKnockback(unit, this.playerUnits);
      this.checkForMegaKnightJump(unit, this.playerUnits);
    }

    // Check for drowning units
    this.checkDrowning(this.playerUnits);
    this.checkDrowning(this.enemyUnits);

    // Update Tesla cars - they chase ALL Mini Pekkas (friend or foe!)
    const allUnits = [...this.playerUnits, ...this.enemyUnits];
    for (const tesla of this.playerTeslas) {
      const hits = tesla.update(deltaTime, [...this.enemyUnits, ...this.enemyTowers], this.playerUnits, allUnits);
      for (const hit of hits) {
        Audio.playTeslaHit();
      }
      if (tesla.droppedThisFrame > 0) {
        Audio.playPekkaDrop();
      }
    }
    for (const tesla of this.enemyTeslas) {
      const hits = tesla.update(deltaTime, [...this.playerUnits, ...this.playerTowers], this.enemyUnits, allUnits);
      for (const hit of hits) {
        Audio.playTeslaHit();
      }
      if (tesla.droppedThisFrame > 0) {
        Audio.playPekkaDrop();
      }
    }

    // Clean up dead Teslas (and drop any carried units)
    for (const tesla of this.playerTeslas) {
      if (!tesla.isAlive) {
        tesla.dropOnDeath();
      }
    }
    for (const tesla of this.enemyTeslas) {
      if (!tesla.isAlive) {
        tesla.dropOnDeath();
      }
    }
    this.playerTeslas = this.playerTeslas.filter((t) => t.isAlive);
    this.enemyTeslas = this.enemyTeslas.filter((t) => t.isAlive);

    for (const projectile of this.projectiles) {
      const enemies =
        projectile.team === 'player'
          ? [...this.enemyTowers, ...this.enemyUnits]
          : [...this.playerTowers, ...this.playerUnits];
      const hits = projectile.update(deltaTime, enemies);
      if (hits.length > 0) {
        Audio.playMagicHit();
      }
    }

    // Spells affect BOTH teams! (friendly fire enabled)
    const allUnitsForSpells = [...this.playerUnits, ...this.enemyUnits];
    const allTowers = [...this.playerTowers, ...this.enemyTowers];
    const allTeslas = [...this.playerTeslas, ...this.enemyTeslas];

    for (const spell of this.spells) {
      // Pass all units/towers to both friendly and enemy - spells hit everyone!
      spell.update(deltaTime, allUnitsForSpells, allUnitsForSpells, allTowers, allTowers);

      // Handle Tesla interactions with spells
      this.handleSpellOnTeslas(spell, allTeslas);
    }

    this.projectiles = this.projectiles.filter((p) => p.isAlive);
    this.spells = this.spells.filter((s) => s.isActive);
    this.playerUnits = this.playerUnits.filter((u) => u.isAlive);
    this.enemyUnits = this.enemyUnits.filter((u) => u.isAlive);

    // Update speech bubbles
    this.speechBubbles = this.speechBubbles.filter((b) => {
      b.life -= deltaTime;
      b.y -= 10 * deltaTime; // Float upward
      return b.life > 0;
    });

    this.checkGameOver();
  }

  private checkForProjectiles(unit: Unit): void {
    if (unit.unitType === 'magicarcher') {
      const archer = unit as MagicArcher;
      const projectile = archer.createProjectile();
      if (projectile) {
        this.projectiles.push(projectile);
        Audio.playArrowShoot();
      }
    }
  }

  private checkForKnockback(unit: Unit, enemies: Unit[]): void {
    if (unit.unitType === 'goldknight') {
      const goldKnight = unit as GoldKnight;
      const knockback = goldKnight.getKnockback();
      if (knockback) {
        // Apply knockback to the target
        for (const enemy of enemies) {
          if (enemy.id === knockback.targetId && enemy.isAlive) {
            // Calculate knockback direction (toward river)
            const riverY = ARENA.riverY + ARENA.riverHeight / 2;
            const knockbackStrength = knockback.strength;

            // Push toward the river
            const dirY = enemy.position.y < riverY ? 1 : -1;
            enemy.position.y += dirY * knockbackStrength;

            // Also push away from Gold Knight slightly
            const dx = enemy.position.x - unit.position.x;
            enemy.position.x += Math.sign(dx) * knockbackStrength * 0.3;

            // Clamp to arena bounds
            enemy.position.x = Math.max(20, Math.min(ARENA.width - 20, enemy.position.x));
            enemy.position.y = Math.max(20, Math.min(ARENA.height - 20, enemy.position.y));

            // Play knockback sound
            Audio.playKnockback();
          }
        }
      }
    }
  }

  private checkForMegaKnightJump(unit: Unit, enemies: Unit[]): void {
    if (unit.unitType === 'megaknight') {
      const megaKnight = unit as MegaKnight;
      const jumpEvent = megaKnight.getJumpEvent();
      if (jumpEvent) {
        // Apply splash damage to all targets
        for (const enemy of enemies) {
          if (jumpEvent.targets.includes(enemy.id) && enemy.isAlive) {
            enemy.health -= jumpEvent.damage;
          }
        }
        // Also damage towers in splash radius
        const towers = unit.team === 'player' ? this.enemyTowers : this.playerTowers;
        for (const tower of towers) {
          if (!tower.isAlive) continue;
          const dx = tower.position.x - jumpEvent.endPos.x;
          const dy = tower.position.y - jumpEvent.endPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 80) { // Splash radius
            tower.health -= jumpEvent.damage;
          }
        }
        // Play the SLAM sound
        Audio.playMegaKnightJump();
        // Add visual effect
        this.renderer.addSplashEffect(jumpEvent.endPos.x, jumpEvent.endPos.y);
      }
    }
  }

  private handleSpellOnTeslas(spell: Spell, teslas: Tesla[]): void {
    for (const tesla of teslas) {
      if (!tesla.isAlive) continue;

      // Check if Tesla is in spell radius
      const dx = tesla.position.x - spell.position.x;
      const dy = tesla.position.y - spell.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= spell.config.radius) {
        switch (spell.config.type) {
          case 'fireball':
            // BOOM! Tesla explodes, dropping all Mini Pekkas!
            if (!spell.hasAppliedInstantEffect || !spell.affectedEntities.has(tesla.id)) {
              tesla.explode();
              Audio.playFireball();
              this.renderer.addSplashEffect(tesla.position.x, tesla.position.y);
              spell.affectedEntities.add(tesla.id);
            }
            break;
          case 'freeze':
            // Freeze the Tesla!
            tesla.freeze(spell.config.duration);
            break;
          case 'poison':
            // Poison damages the Tesla
            if (spell.config.damagePerSecond) {
              tesla.takeDamage(spell.config.damagePerSecond * 0.016); // Per frame damage
            }
            break;
          case 'rage':
            // Rage speeds up the Tesla!
            // (handled by increasing speed temporarily - could add later)
            break;
        }
      }
    }
  }

  private checkDrowning(units: Unit[]): void {
    for (const unit of units) {
      // Units in a Tesla are safe from drowning!
      if (unit.isBeingCarried) continue;

      // Check if unit is in river but not on bridge
      const inRiver =
        unit.position.y >= ARENA.riverY &&
        unit.position.y <= ARENA.riverY + ARENA.riverHeight;

      if (inRiver && !isOnBridge(unit.position.x, unit.position.y)) {
        // DROWN! Instant death
        unit.health = 0;
        // Add splash effect and scream!
        this.renderer.addSplashEffect(unit.position.x, unit.position.y);
        Audio.playDrowningScream();
      }
    }
  }

  private updateCardUI(): void {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card) => {
      const cardType = card.getAttribute('data-card') as CardType;
      if (cardType && CARD_COSTS[cardType] !== undefined) {
        const canAfford = this.elixir >= CARD_COSTS[cardType];
        card.classList.toggle('disabled', !canAfford);
      }
    });
  }

  private checkGameOver(): void {
    const playerKing = this.playerTowers[0];
    const enemyKing = this.enemyTowers[0];

    if (!enemyKing.isAlive && !this.gameOver) {
      this.gameOver = true;
      this.winner = 'player';
      Audio.playTowerDestroyed();
      setTimeout(() => Audio.playVictory(), 500);
    } else if (!playerKing.isAlive && !this.gameOver) {
      this.gameOver = true;
      this.winner = 'enemy';
      Audio.playTowerDestroyed();
      setTimeout(() => Audio.playDefeat(), 500);
    }
  }

  private render(deltaTime: number): void {
    this.renderer.clear();
    this.renderer.drawArena();

    // Draw splash effects (drowning)
    this.renderer.drawSplashEffects(deltaTime);

    for (const spell of this.spells) {
      this.renderer.drawSpell(spell);
    }

    for (const tower of [...this.playerTowers, ...this.enemyTowers]) {
      this.renderer.drawTower(tower);
    }

    for (const unit of [...this.playerUnits, ...this.enemyUnits]) {
      if ((unit as any).isSurge) {
        this.renderer.drawSurge(unit as Surge);
      } else if ((unit as any).isLily) {
        this.renderer.drawLily(unit as Lily);
      } else {
        this.renderer.drawUnit(unit, this.gameTime);
      }
    }

    // Draw Tesla cars
    for (const tesla of [...this.playerTeslas, ...this.enemyTeslas]) {
      this.renderer.drawTesla(tesla);
    }

    for (const projectile of this.projectiles) {
      this.renderer.drawProjectile(projectile);
    }

    // Draw speech bubbles
    for (const bubble of this.speechBubbles) {
      this.renderer.drawSpeechBubble(bubble);
    }

    // Draw spell targeting preview
    if (this.isDragging && this.dragCurrent && isSpell(this.selectedCard)) {
      const radius = SPELL_CONFIGS[this.selectedCard].radius;
      this.renderer.drawSpellPreview(this.dragCurrent, radius, this.selectedCard);
    }

    this.renderer.updateElixirBar(this.elixir, MAX_ELIXIR);

    if (this.gameOver && this.winner) {
      this.renderer.drawGameOver(this.winner);
    }

    if (this.paused) {
      this.renderer.drawPaused();
    }
  }

  private restart(): void {
    this.playerTowers = [];
    this.enemyTowers = [];
    this.playerUnits = [];
    this.enemyUnits = [];
    this.projectiles = [];
    this.spells = [];
    this.playerTeslas = [];
    this.enemyTeslas = [];
    this.speechBubbles = [];
    this.elixir = 5;
    this.enemyElixir = 5;
    this.gameOver = false;
    this.winner = null;
    this.enemySpawnTimer = 2;
    this.enemySpellTimer = 5;
    this.cancelDrag();
    this.setupTowers();
  }
}
