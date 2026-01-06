# Clash Royale-like Game - Quick Prototype Plan

## Overview
A browser-based TypeScript game with HTML Canvas 2D rendering. Two sides with towers, spawn troops that auto-walk and fight.

## Project Structure
```
clash-game/
├── src/
│   ├── index.ts          # Entry point, game initialization
│   ├── game.ts           # Main game loop and state
│   ├── arena.ts          # Arena layout, lanes
│   ├── tower.ts          # Tower class
│   ├── unit.ts           # Base unit class
│   ├── units/            # Different unit types
│   │   └── knight.ts     # Basic melee unit
│   ├── renderer.ts       # Canvas rendering
│   └── types.ts          # TypeScript interfaces
├── index.html            # HTML entry
├── package.json
└── tsconfig.json
```

## Core Game Mechanics

### Arena
- 800x600 canvas
- Two sides: Player (bottom) and Enemy (top)
- Each side has 1 main tower (king tower) and 2 side towers (princess towers)
- Simple rectangular layout

### Towers
- Health points
- Attack range and damage
- Target nearest enemy unit

### Units
- Health, damage, attack speed, movement speed
- Auto-pathfind toward enemy (simple: walk up/down)
- Target nearest enemy (unit or tower)
- Start with one unit type: Knight (basic melee)

### Spawning
- Click on your side of the arena to spawn a unit
- Simple elixir system: regenerates over time, units cost elixir

### Game Loop
1. Update elixir
2. Update all units (movement, targeting, attacking)
3. Update towers (targeting, attacking)
4. Check win/lose conditions
5. Render everything

## Implementation Steps

1. **Project setup** - package.json, tsconfig.json, index.html, bundler (esbuild)
2. **Canvas and game loop** - Basic rendering loop at 60fps
3. **Arena and towers** - Draw arena, create tower class with health
4. **Unit system** - Base unit class, movement toward enemy side
5. **Combat** - Units attack each other and towers
6. **Spawning + Elixir** - Click to spawn, elixir bar
7. **Win/Lose** - Destroy king tower to win

## Tech Stack
- TypeScript
- HTML Canvas 2D
- esbuild (fast bundler, minimal config)
- No external game frameworks

## Files to Create
1. `package.json` - Dependencies: typescript, esbuild
2. `tsconfig.json` - TypeScript config
3. `index.html` - Canvas element
4. `src/types.ts` - Interfaces (Position, Entity, etc.)
5. `src/game.ts` - Game class with loop
6. `src/arena.ts` - Arena dimensions and layout
7. `src/tower.ts` - Tower class
8. `src/unit.ts` - Unit base class
9. `src/units/knight.ts` - Knight unit
10. `src/renderer.ts` - Canvas drawing functions
11. `src/index.ts` - Bootstrap game
