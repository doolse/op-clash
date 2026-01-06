"use strict";
(() => {
  // src/arena.ts
  var ARENA = {
    width: 800,
    height: 600,
    midLine: 300,
    // y position of the middle divider
    // Player spawnable area (bottom half)
    playerSpawnMinY: 350,
    playerSpawnMaxY: 580,
    // Bridge positions (gaps in the river)
    bridgeLeft: { x: 200, y: 300, width: 100 },
    bridgeRight: { x: 500, y: 300, width: 100 },
    // River
    riverY: 280,
    riverHeight: 40
  };
  var TOWER_POSITIONS = {
    player: [
      { position: { x: 400, y: 520 }, type: "king" },
      { position: { x: 150, y: 450 }, type: "princess" },
      { position: { x: 650, y: 450 }, type: "princess" }
    ],
    enemy: [
      { position: { x: 400, y: 80 }, type: "king" },
      { position: { x: 150, y: 150 }, type: "princess" },
      { position: { x: 650, y: 150 }, type: "princess" }
    ]
  };
  function isInPlayerZone(y) {
    return y > ARENA.midLine;
  }
  function isOnBridge(x, y) {
    const onRiver = y >= ARENA.riverY && y <= ARENA.riverY + ARENA.riverHeight;
    if (!onRiver)
      return true;
    const onLeftBridge = x >= ARENA.bridgeLeft.x && x <= ARENA.bridgeLeft.x + ARENA.bridgeLeft.width;
    const onRightBridge = x >= ARENA.bridgeRight.x && x <= ARENA.bridgeRight.x + ARENA.bridgeRight.width;
    return onLeftBridge || onRightBridge;
  }
  function getNearestBridgeX(x) {
    const leftBridgeCenter = ARENA.bridgeLeft.x + ARENA.bridgeLeft.width / 2;
    const rightBridgeCenter = ARENA.bridgeRight.x + ARENA.bridgeRight.width / 2;
    return Math.abs(x - leftBridgeCenter) < Math.abs(x - rightBridgeCenter) ? leftBridgeCenter : rightBridgeCenter;
  }

  // src/assets.ts
  async function loadAssets() {
    const [characters, tiles, towerDefense] = await Promise.all([
      loadSpriteSheet("assets/characters.png", 16, 16, 12),
      loadSpriteSheet("assets/basictiles.png", 16, 16, 8),
      loadSpriteSheet("assets/Tilesheet/towerDefense_tilesheet.png", 64, 64, 23)
    ]);
    return { characters, tiles, towerDefense };
  }
  async function loadSpriteSheet(src, tileWidth, tileHeight, columns) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ image, tileWidth, tileHeight, columns });
      image.onerror = () => reject(new Error(`Failed to load ${src}`));
      image.src = src;
    });
  }
  function drawSprite(ctx, sheet, index, x, y, scale = 1, flipX = false) {
    const col = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    const sx = col * sheet.tileWidth;
    const sy = row * sheet.tileHeight;
    const destWidth = sheet.tileWidth * scale;
    const destHeight = sheet.tileHeight * scale;
    ctx.save();
    if (flipX) {
      ctx.translate(x + destWidth / 2, y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        sheet.image,
        sx,
        sy,
        sheet.tileWidth,
        sheet.tileHeight,
        -destWidth / 2,
        0,
        destWidth,
        destHeight
      );
    } else {
      ctx.drawImage(
        sheet.image,
        sx,
        sy,
        sheet.tileWidth,
        sheet.tileHeight,
        x,
        y,
        destWidth,
        destHeight
      );
    }
    ctx.restore();
  }
  function drawTile(ctx, sheet, index, x, y, width, height) {
    const col = index % sheet.columns;
    const row = Math.floor(index / sheet.columns);
    const sx = col * sheet.tileWidth;
    const sy = row * sheet.tileHeight;
    ctx.drawImage(sheet.image, sx, sy, sheet.tileWidth, sheet.tileHeight, x, y, width, height);
  }

  // src/renderer.ts
  var COLORS = {
    healthBarBg: "#333",
    healthBarPlayer: "#4caf50",
    healthBarEnemy: "#f44336",
    text: "#fff"
  };
  var CHAR_SPRITES = {
    // Knight (orange) - walking animations
    knightUp: [36, 37, 38, 37],
    knightDown: [0, 1, 2, 1],
    // Mini Pekka (blue character) - walking animations
    pekkaUp: [39, 40, 41, 40],
    pekkaDown: [3, 4, 5, 4],
    // Magic Archer (green/teal character) - walking animations
    archerUp: [42, 43, 44, 43],
    archerDown: [6, 7, 8, 7],
    // Gold Knight (uses knight sprites with gold tint)
    goldKnightUp: [36, 37, 38, 37],
    goldKnightDown: [0, 1, 2, 1],
    // Mega Knight (uses bigger knight sprites)
    megaKnightUp: [36, 37, 38, 37],
    megaKnightDown: [0, 1, 2, 1],
    // Skeleton/dark - enemy units
    enemyDown: [48, 49, 50, 49],
    enemyUp: [84, 85, 86, 85],
    // Enemy Mini Pekka (bat/demon sprites)
    enemyPekkaDown: [60, 61, 62, 61],
    enemyPekkaUp: [96, 97, 98, 97],
    // Enemy Magic Archer
    enemyArcherDown: [63, 64, 65, 64],
    enemyArcherUp: [99, 100, 101, 100],
    // Enemy Gold Knight
    enemyGoldKnightDown: [48, 49, 50, 49],
    enemyGoldKnightUp: [84, 85, 86, 85],
    // Enemy Mega Knight
    enemyMegaKnightDown: [48, 49, 50, 49],
    enemyMegaKnightUp: [84, 85, 86, 85]
  };
  var TILE_IDX = {
    grass1: 0,
    grass2: 1,
    grass3: 8,
    water1: 4,
    water2: 5,
    water3: 12,
    water4: 13,
    bridge: 17,
    // Wood plank
    stone: 2,
    stoneFloor: 24,
    castle: 2,
    // Stone brick for castle
    tower: 3
    // Stone variant for tower
  };
  var Renderer = class {
    constructor(canvas) {
      this.assets = null;
      this.animFrame = 0;
      this.backgroundCanvas = null;
      this.splashEffects = [];
      this.canvas = canvas;
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("Could not get 2d context");
      this.ctx = ctx;
      ctx.imageSmoothingEnabled = false;
    }
    setAssets(assets) {
      this.assets = assets;
      this.prerenderBackground();
    }
    updateAnimation() {
      this.animFrame = (this.animFrame + 1) % 4;
    }
    prerenderBackground() {
      if (!this.assets)
        return;
      this.backgroundCanvas = document.createElement("canvas");
      this.backgroundCanvas.width = ARENA.width;
      this.backgroundCanvas.height = ARENA.height;
      const bgCtx = this.backgroundCanvas.getContext("2d");
      bgCtx.imageSmoothingEnabled = false;
      const tileSize = 32;
      const { tiles } = this.assets;
      for (let y = 0; y < ARENA.height; y += tileSize) {
        for (let x = 0; x < ARENA.width; x += tileSize) {
          const grassTile = (x + y) / tileSize % 3 === 0 ? TILE_IDX.grass2 : TILE_IDX.grass1;
          drawTile(bgCtx, tiles, grassTile, x, y, tileSize, tileSize);
        }
      }
      bgCtx.fillStyle = "rgba(100, 150, 255, 0.15)";
      bgCtx.fillRect(0, ARENA.midLine + 20, ARENA.width, ARENA.height - ARENA.midLine - 20);
      bgCtx.fillStyle = "rgba(255, 100, 100, 0.15)";
      bgCtx.fillRect(0, 0, ARENA.width, ARENA.midLine - 20);
      for (let x = 0; x < ARENA.width; x += tileSize) {
        const waterTile = x / tileSize % 2 === 0 ? TILE_IDX.water1 : TILE_IDX.water2;
        drawTile(bgCtx, tiles, waterTile, x, ARENA.riverY, tileSize, tileSize);
        const waterTile2 = x / tileSize % 2 === 0 ? TILE_IDX.water3 : TILE_IDX.water4;
        drawTile(bgCtx, tiles, waterTile2, x, ARENA.riverY + tileSize / 2, tileSize, tileSize / 2);
      }
      [ARENA.bridgeLeft, ARENA.bridgeRight].forEach((bridge) => {
        for (let x = bridge.x; x < bridge.x + bridge.width; x += tileSize) {
          drawTile(bgCtx, tiles, TILE_IDX.bridge, x, ARENA.riverY - 8, tileSize, ARENA.riverHeight + 16);
        }
      });
    }
    clear() {
      if (this.backgroundCanvas) {
        this.ctx.drawImage(this.backgroundCanvas, 0, 0);
      } else {
        this.ctx.fillStyle = "#3d5c3d";
        this.ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      }
    }
    drawArena() {
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([10, 10]);
      this.ctx.beginPath();
      this.ctx.moveTo(0, ARENA.midLine);
      this.ctx.lineTo(ARENA.width, ARENA.midLine);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    drawTower(tower) {
      if (!tower.isAlive)
        return;
      const { x, y } = tower.position;
      const size = tower.size;
      const baseColor = tower.team === "player" ? "#3a6fb5" : "#b53a3a";
      const lightColor = tower.team === "player" ? "#5a9fd5" : "#d55a5a";
      const darkColor = tower.team === "player" ? "#2a4f85" : "#852a2a";
      const towerWidth = tower.towerType === "king" ? 70 : 50;
      const towerHeight = tower.towerType === "king" ? 80 : 60;
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      this.ctx.beginPath();
      this.ctx.ellipse(x + 5, y + towerHeight / 2 - 5, towerWidth / 2, 15, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = darkColor;
      this.ctx.fillRect(x - towerWidth / 2 - 5, y + towerHeight / 4, towerWidth + 10, towerHeight / 4);
      this.ctx.fillStyle = baseColor;
      this.ctx.fillRect(x - towerWidth / 2, y - towerHeight / 2, towerWidth, towerHeight);
      this.ctx.strokeStyle = darkColor;
      this.ctx.lineWidth = 1;
      const brickHeight = 12;
      const brickWidth = 20;
      for (let by = y - towerHeight / 2; by < y + towerHeight / 2; by += brickHeight) {
        const offset = Math.floor((by - y) / brickHeight) % 2 * (brickWidth / 2);
        for (let bx = x - towerWidth / 2 + offset; bx < x + towerWidth / 2; bx += brickWidth) {
          this.ctx.strokeRect(bx, by, brickWidth, brickHeight);
        }
      }
      const merlonWidth = 12;
      const merlonHeight = 15;
      this.ctx.fillStyle = baseColor;
      for (let mx = x - towerWidth / 2; mx < x + towerWidth / 2; mx += merlonWidth * 1.5) {
        this.ctx.fillRect(mx, y - towerHeight / 2 - merlonHeight, merlonWidth, merlonHeight);
      }
      this.ctx.fillStyle = lightColor;
      this.ctx.fillRect(x - towerWidth / 2, y - towerHeight / 2, 5, towerHeight);
      this.ctx.fillStyle = "#1a1a2e";
      if (tower.towerType === "king") {
        this.ctx.fillRect(x - 12, y + 5, 24, 35);
        this.ctx.fillStyle = darkColor;
        this.ctx.fillRect(x - 12, y + 5, 24, 5);
        this.ctx.fillStyle = "#ffd700";
        this.ctx.font = "bold 20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("\u{1F451}", x, y - 15);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(x, y - 5, 10, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.fillStyle = tower.team === "player" ? "#4a90d9" : "#d94a4a";
      this.ctx.fillRect(x + towerWidth / 2 - 5, y - towerHeight / 2 + 10, 15, 25);
      this.ctx.beginPath();
      this.ctx.moveTo(x + towerWidth / 2 - 5, y - towerHeight / 2 + 35);
      this.ctx.lineTo(x + towerWidth / 2 + 2, y - towerHeight / 2 + 42);
      this.ctx.lineTo(x + towerWidth / 2 + 10, y - towerHeight / 2 + 35);
      this.ctx.fill();
      if (tower.target) {
        this.ctx.strokeStyle = tower.team === "player" ? "rgba(100, 149, 237, 0.6)" : "rgba(237, 100, 100, 0.6)";
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(tower.target.position.x, tower.target.position.y);
        this.ctx.stroke();
        const progress = 1 - tower.attackCooldown * tower.attackSpeed;
        if (progress > 0 && progress < 0.3) {
          const px = x + (tower.target.position.x - x) * (progress / 0.3);
          const py = y + (tower.target.position.y - y) * (progress / 0.3);
          this.ctx.fillStyle = "#ffff00";
          this.ctx.beginPath();
          this.ctx.arc(px, py, 5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      const barY = y - towerHeight / 2 - 25;
      this.drawHealthBar(x, barY, towerWidth, tower.health, tower.maxHealth, tower.team);
    }
    drawUnit(unit, gameTime) {
      if (!unit.isAlive)
        return;
      let { x, y } = unit.position;
      const isMiniPekka = unit.unitType === "minipekka";
      const isMagicArcher = unit.unitType === "magicarcher";
      const isGoldKnight = unit.unitType === "goldknight";
      const isMegaKnight = unit.unitType === "megaknight";
      const isCharged = "isCharged" in unit && unit.isCharged;
      let jumpHeight = 0;
      if (isMegaKnight && "getJumpState" in unit) {
        const jumpState = unit.getJumpState();
        jumpHeight = jumpState.height;
      }
      if (this.assets) {
        const scale = isMegaKnight ? 4 : isMiniPekka ? 3 : isMagicArcher ? 2.8 : isGoldKnight ? 3.2 : 2.5;
        const spriteSize = 16 * scale;
        let sprites;
        if (unit.team === "player") {
          if (isMiniPekka) {
            sprites = CHAR_SPRITES.pekkaUp;
          } else if (isMagicArcher) {
            sprites = CHAR_SPRITES.archerUp;
          } else if (isGoldKnight) {
            sprites = CHAR_SPRITES.goldKnightUp;
          } else if (isMegaKnight) {
            sprites = CHAR_SPRITES.megaKnightUp;
          } else {
            sprites = CHAR_SPRITES.knightUp;
          }
        } else {
          if (isMiniPekka) {
            sprites = CHAR_SPRITES.enemyPekkaDown;
          } else if (isMagicArcher) {
            sprites = CHAR_SPRITES.enemyArcherDown;
          } else if (isGoldKnight) {
            sprites = CHAR_SPRITES.enemyGoldKnightDown;
          } else if (isMegaKnight) {
            sprites = CHAR_SPRITES.enemyMegaKnightDown;
          } else {
            sprites = CHAR_SPRITES.enemyDown;
          }
        }
        const frameIndex = Math.floor(gameTime * 6) % 4;
        const spriteIndex = sprites[frameIndex];
        if (isMiniPekka && isCharged) {
          this.ctx.shadowColor = "#00ffff";
          this.ctx.shadowBlur = 15;
        }
        if (isMagicArcher) {
          this.ctx.shadowColor = "#ff00ff";
          this.ctx.shadowBlur = 10;
        }
        if (isGoldKnight) {
          this.ctx.shadowColor = "#ffd700";
          this.ctx.shadowBlur = 20;
        }
        if (isMegaKnight) {
          this.ctx.shadowColor = "#8b00ff";
          this.ctx.shadowBlur = 30;
          if (jumpHeight > 0) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${0.3 + jumpHeight / 200})`;
            this.ctx.beginPath();
            this.ctx.ellipse(x, y + 10, spriteSize / 2, 15, 0, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
        const drawY = y - jumpHeight;
        drawSprite(
          this.ctx,
          this.assets.characters,
          spriteIndex,
          x - spriteSize / 2,
          drawY - spriteSize / 2,
          scale
        );
        if (isGoldKnight) {
          this.ctx.globalCompositeOperation = "source-atop";
          this.ctx.fillStyle = "rgba(255, 215, 0, 0.3)";
          this.ctx.fillRect(x - spriteSize / 2, drawY - spriteSize / 2, spriteSize, spriteSize);
          this.ctx.globalCompositeOperation = "source-over";
        }
        if (isMegaKnight) {
          this.ctx.globalCompositeOperation = "source-atop";
          this.ctx.fillStyle = "rgba(139, 0, 255, 0.25)";
          this.ctx.fillRect(x - spriteSize / 2, drawY - spriteSize / 2, spriteSize, spriteSize);
          this.ctx.globalCompositeOperation = "source-over";
        }
        this.ctx.shadowBlur = 0;
        let ringColor;
        if (isGoldKnight) {
          ringColor = "#ffd700";
        } else {
          ringColor = unit.team === "player" ? "#4a90d9" : "#d94a4a";
        }
        this.ctx.strokeStyle = ringColor;
        this.ctx.lineWidth = isGoldKnight ? 3 : 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y + 5, spriteSize / 2 - 2, 0, Math.PI * 2);
        this.ctx.stroke();
        if (isMiniPekka && isCharged) {
          this.ctx.fillStyle = "#00ffff";
          this.ctx.font = "bold 14px Arial";
          this.ctx.textAlign = "center";
          this.ctx.fillText("\u26A1", x, y - spriteSize / 2 - 5);
        }
        if (isMagicArcher) {
          this.ctx.fillStyle = "#ff00ff";
          this.ctx.font = "bold 12px Arial";
          this.ctx.textAlign = "center";
          this.ctx.fillText("\u{1F3F9}", x, y - spriteSize / 2 - 5);
        }
        if (isGoldKnight) {
          this.ctx.fillStyle = "#ffd700";
          this.ctx.font = "bold 16px Arial";
          this.ctx.textAlign = "center";
          this.ctx.fillText("\u{1F451}", x, drawY - spriteSize / 2 - 8);
        }
        if (isMegaKnight) {
          this.ctx.fillStyle = "#8b00ff";
          this.ctx.font = "bold 20px Arial";
          this.ctx.textAlign = "center";
          this.ctx.fillText("\u2694\uFE0F", x, drawY - spriteSize / 2 - 10);
        }
      } else {
        let color;
        if (unit.team === "player") {
          color = isMegaKnight ? "#8b00ff" : isMiniPekka ? "#00bfff" : isMagicArcher ? "#ff00ff" : isGoldKnight ? "#ffd700" : "#6495ed";
        } else {
          color = isMegaKnight ? "#4b0082" : isMiniPekka ? "#ff6b6b" : isMagicArcher ? "#ff66aa" : isGoldKnight ? "#daa520" : "#ed6464";
        }
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y - jumpHeight, unit.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      if (unit.target && unit.attackCooldown > 0.7 / unit.attackSpeed && !isMagicArcher) {
        if (isMiniPekka) {
          this.ctx.strokeStyle = "rgba(0, 255, 255, 0.9)";
          this.ctx.lineWidth = 4;
        } else {
          this.ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
          this.ctx.lineWidth = 3;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        const midX = (x + unit.target.position.x) / 2;
        const midY = (y + unit.target.position.y) / 2;
        this.ctx.lineTo(midX, midY);
        this.ctx.stroke();
      }
      this.drawHealthBar(x, y - 25, 30, unit.health, unit.maxHealth, unit.team);
    }
    drawHealthBar(x, y, width, health, maxHealth, team) {
      const height = 6;
      const healthPercent = health / maxHealth;
      this.ctx.fillStyle = COLORS.healthBarBg;
      this.ctx.fillRect(x - width / 2, y, width, height);
      this.ctx.fillStyle = team === "player" ? COLORS.healthBarPlayer : COLORS.healthBarEnemy;
      this.ctx.fillRect(x - width / 2, y, width * healthPercent, height);
      this.ctx.strokeStyle = "#111";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x - width / 2, y, width, height);
    }
    drawGameOver(winner) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      this.ctx.fillStyle = winner === "player" ? "#4caf50" : "#f44336";
      this.ctx.font = "bold 48px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      const text = winner === "player" ? "VICTORY!" : "DEFEAT!";
      this.ctx.fillText(text, ARENA.width / 2, ARENA.height / 2);
      this.ctx.fillStyle = COLORS.text;
      this.ctx.font = "24px Arial";
      this.ctx.fillText("Click to restart", ARENA.width / 2, ARENA.height / 2 + 50);
    }
    drawPaused() {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      this.ctx.fillRect(0, 0, ARENA.width, ARENA.height);
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 64px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("\u23F8\uFE0F PAUSED", ARENA.width / 2, ARENA.height / 2);
      this.ctx.font = "24px Arial";
      this.ctx.fillText("Press P to resume", ARENA.width / 2, ARENA.height / 2 + 50);
    }
    updateElixirBar(elixir, maxElixir) {
      const fill = document.getElementById("elixir-fill");
      const text = document.getElementById("elixir-text");
      if (fill) {
        fill.style.width = `${elixir / maxElixir * 100}%`;
      }
      if (text) {
        text.textContent = `${Math.floor(elixir)} / ${maxElixir}`;
      }
    }
    addSplashEffect(x, y) {
      this.splashEffects.push({
        x,
        y,
        time: 0,
        maxTime: 0.5
        // Half second animation
      });
    }
    drawSplashEffects(deltaTime) {
      this.splashEffects = this.splashEffects.filter((splash) => {
        splash.time += deltaTime;
        const progress = splash.time / splash.maxTime;
        if (progress >= 1)
          return false;
        const alpha = 1 - progress;
        const radius = 20 + progress * 40;
        for (let i = 0; i < 8; i++) {
          const angle = i / 8 * Math.PI * 2;
          const dist = radius * progress;
          const dropX = splash.x + Math.cos(angle) * dist;
          const dropY = splash.y + Math.sin(angle) * dist - progress * 30;
          this.ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
          this.ctx.beginPath();
          this.ctx.arc(dropX, dropY, 5 * (1 - progress * 0.5), 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.strokeStyle = `rgba(150, 220, 255, ${alpha})`;
        this.ctx.lineWidth = 3 * (1 - progress);
        this.ctx.beginPath();
        this.ctx.arc(splash.x, splash.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.strokeStyle = `rgba(200, 240, 255, ${alpha * 0.7})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(splash.x, splash.y, radius * 0.5, 0, Math.PI * 2);
        this.ctx.stroke();
        return true;
      });
    }
    drawSpellPreview(position, radius, spellType) {
      const { x, y } = position;
      let color;
      let icon;
      switch (spellType) {
        case "rage":
          color = "rgba(255, 100, 100, 0.4)";
          icon = "\u{1F624}";
          break;
        case "fireball":
          color = "rgba(255, 150, 0, 0.4)";
          icon = "\u{1F525}";
          break;
        case "freeze":
          color = "rgba(100, 200, 255, 0.4)";
          icon = "\u2744\uFE0F";
          break;
        case "poison":
          color = "rgba(100, 255, 100, 0.4)";
          icon = "\u2620\uFE0F";
          break;
        default:
          color = "rgba(255, 255, 255, 0.4)";
          icon = "?";
      }
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = color.replace("0.4", "0.8");
      this.ctx.lineWidth = 3;
      this.ctx.setLineDash([10, 5]);
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      this.ctx.font = "32px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(icon, x, y);
    }
    drawProjectile(projectile) {
      const { x, y } = projectile.position;
      const angle = projectile.getAngle();
      const trailLength = 30;
      const trailEndX = x - Math.cos(angle) * trailLength;
      const trailEndY = y - Math.sin(angle) * trailLength;
      const gradient = this.ctx.createLinearGradient(trailEndX, trailEndY, x, y);
      gradient.addColorStop(0, "rgba(255, 0, 255, 0)");
      gradient.addColorStop(0.5, "rgba(255, 0, 255, 0.5)");
      gradient.addColorStop(1, "rgba(255, 100, 255, 1)");
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(trailEndX, trailEndY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);
      this.ctx.shadowColor = "#ff00ff";
      this.ctx.shadowBlur = 15;
      this.ctx.fillStyle = "#ff66ff";
      this.ctx.beginPath();
      this.ctx.moveTo(10, 0);
      this.ctx.lineTo(-5, -5);
      this.ctx.lineTo(-5, 5);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.moveTo(8, 0);
      this.ctx.lineTo(-2, -2);
      this.ctx.lineTo(-2, 2);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
      this.ctx.shadowBlur = 0;
      if (projectile.config.splash && projectile.hitEntities.size > 0) {
        this.ctx.strokeStyle = "rgba(255, 0, 255, 0.3)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, projectile.config.splashRadius, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }
    drawSpell(spell) {
      const { x, y } = spell.position;
      const radius = spell.config.radius;
      const progress = spell.timeRemaining / spell.config.duration;
      switch (spell.config.type) {
        case "rage":
          this.drawRageSpell(x, y, radius, progress, spell.team);
          break;
        case "fireball":
          this.drawFireballSpell(x, y, radius, progress);
          break;
        case "freeze":
          this.drawFreezeSpell(x, y, radius, progress);
          break;
        case "poison":
          this.drawPoisonSpell(x, y, radius, progress, spell.team);
          break;
      }
    }
    drawRageSpell(x, y, radius, progress, team) {
      const alpha = 0.3 + progress * 0.2;
      const pulseScale = 1 + Math.sin(Date.now() / 100) * 0.1;
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * pulseScale);
      if (team === "player") {
        gradient.addColorStop(0, `rgba(255, 100, 100, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 50, 50, ${alpha * 0.5})`);
        gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
      } else {
        gradient.addColorStop(0, `rgba(255, 100, 100, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(200, 50, 50, ${alpha * 0.5})`);
        gradient.addColorStop(1, "rgba(150, 0, 0, 0)");
      }
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * pulseScale, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = `rgba(255, 200, 0, ${alpha + 0.3})`;
      this.ctx.font = "bold 24px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("\u{1F624}", x, y);
      this.ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    drawFireballSpell(x, y, radius, progress) {
      const explosionProgress = 1 - progress;
      const currentRadius = radius * (0.5 + explosionProgress * 0.5);
      const alpha = progress;
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
      gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
      gradient.addColorStop(0.3, `rgba(255, 200, 50, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(255, 100, 0, ${alpha * 0.8})`);
      gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
      this.ctx.fill();
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2 + Date.now() / 500;
        const dist = currentRadius * 0.6;
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        this.ctx.fillStyle = `rgba(255, 150, 0, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 8 * alpha, 0, Math.PI * 2);
        this.ctx.fill();
      }
      if (progress > 0.7) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${(progress - 0.7) * 3})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, currentRadius * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    drawFreezeSpell(x, y, radius, progress) {
      const alpha = 0.2 + progress * 0.3;
      const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.05;
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(200, 240, 255, ${alpha + 0.2})`);
      gradient.addColorStop(0.5, `rgba(100, 200, 255, ${alpha})`);
      gradient.addColorStop(1, `rgba(50, 150, 255, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * pulseScale, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = `rgba(200, 240, 255, ${alpha + 0.3})`;
      this.ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const angle = i / 6 * Math.PI * 2;
        const innerRadius = radius * 0.3;
        const outerRadius = radius * 0.8;
        this.ctx.beginPath();
        this.ctx.moveTo(x + Math.cos(angle) * innerRadius, y + Math.sin(angle) * innerRadius);
        this.ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
        this.ctx.stroke();
        const branchAngle1 = angle + 0.3;
        const branchAngle2 = angle - 0.3;
        const branchStart = radius * 0.5;
        const branchEnd = radius * 0.65;
        this.ctx.beginPath();
        this.ctx.moveTo(x + Math.cos(angle) * branchStart, y + Math.sin(angle) * branchStart);
        this.ctx.lineTo(x + Math.cos(branchAngle1) * branchEnd, y + Math.sin(branchAngle1) * branchEnd);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x + Math.cos(angle) * branchStart, y + Math.sin(angle) * branchStart);
        this.ctx.lineTo(x + Math.cos(branchAngle2) * branchEnd, y + Math.sin(branchAngle2) * branchEnd);
        this.ctx.stroke();
      }
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha + 0.4})`;
      this.ctx.font = "20px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("\u2744\uFE0F", x, y);
      this.ctx.strokeStyle = `rgba(150, 220, 255, ${alpha})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    drawPoisonSpell(x, y, radius, progress, team) {
      const alpha = 0.2 + progress * 0.2;
      const time = Date.now() / 1e3;
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(100, 255, 100, ${alpha + 0.1})`);
      gradient.addColorStop(0.5, `rgba(50, 200, 50, ${alpha})`);
      gradient.addColorStop(1, `rgba(0, 150, 0, 0)`);
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      for (let i = 0; i < 12; i++) {
        const angle = i / 12 * Math.PI * 2 + time;
        const dist = radius * (0.3 + Math.sin(time * 2 + i) * 0.3);
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        const size = 5 + Math.sin(time * 3 + i * 0.5) * 3;
        this.ctx.fillStyle = `rgba(150, 255, 100, ${alpha + 0.2})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.fillStyle = `rgba(200, 255, 150, ${alpha + 0.4})`;
      this.ctx.font = "22px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("\u2620\uFE0F", x, y);
      const pulseAlpha = alpha + Math.sin(time * 4) * 0.1;
      this.ctx.strokeStyle = `rgba(100, 255, 100, ${pulseAlpha})`;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([10, 5]);
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    drawTesla(tesla) {
      if (!tesla.isAlive)
        return;
      const { x, y } = tesla.position;
      const angle = tesla.angle + tesla.driftAngle;
      const size = tesla.size;
      for (let i = 0; i < tesla.skidMarks.length; i++) {
        const mark = tesla.skidMarks[i];
        const alpha = i / tesla.skidMarks.length * 0.3;
        this.ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(angle);
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      this.ctx.beginPath();
      this.ctx.ellipse(3, 3, size * 0.9, size * 0.5, 0, 0, Math.PI * 2);
      this.ctx.fill();
      const carLength = size * 1.5;
      const carWidth = size * 0.7;
      const bodyColor = tesla.team === "player" ? "#cc0000" : "#0066cc";
      const lightColor = tesla.team === "player" ? "#ff3333" : "#3399ff";
      this.ctx.fillStyle = bodyColor;
      this.ctx.beginPath();
      this.ctx.roundRect(-carLength / 2, -carWidth / 2, carLength, carWidth, 8);
      this.ctx.fill();
      this.ctx.fillStyle = "#333";
      this.ctx.beginPath();
      this.ctx.roundRect(-carLength / 4, -carWidth / 3, carLength / 2, carWidth * 0.65, 5);
      this.ctx.fill();
      this.ctx.fillStyle = "#88ccff";
      this.ctx.beginPath();
      this.ctx.roundRect(-carLength / 4 + 2, -carWidth / 3 + 2, carLength / 4 - 2, carWidth * 0.65 - 4, 3);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.roundRect(carLength / 8, -carWidth / 3 + 2, carLength / 6, carWidth * 0.65 - 4, 3);
      this.ctx.fill();
      this.ctx.fillStyle = tesla.isHonking ? "#ffff00" : "#ffffff";
      this.ctx.beginPath();
      this.ctx.ellipse(carLength / 2 - 5, -carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.ellipse(carLength / 2 - 5, carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#ff0000";
      this.ctx.beginPath();
      this.ctx.ellipse(-carLength / 2 + 5, -carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.ellipse(-carLength / 2 + 5, carWidth / 3, 4, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 12px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("T", 0, 0);
      if (tesla.lastHitTime > 0) {
        this.ctx.fillStyle = `rgba(255, 255, 0, ${tesla.lastHitTime * 3})`;
        this.ctx.beginPath();
        this.ctx.roundRect(-carLength / 2 - 5, -carWidth / 2 - 5, carLength + 10, carWidth + 10, 10);
        this.ctx.fill();
      }
      this.ctx.restore();
      if (tesla.isFrozen) {
        this.ctx.shadowColor = "#00aaff";
        this.ctx.shadowBlur = 25;
        this.ctx.strokeStyle = `rgba(150, 220, 255, 0.8)`;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size + 8, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.fillStyle = "rgba(200, 240, 255, 0.9)";
        this.ctx.font = "20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("\u2744\uFE0F", x, y - size - 5);
      } else {
        this.ctx.shadowColor = "#00ffff";
        this.ctx.shadowBlur = 15;
        this.ctx.strokeStyle = `rgba(0, 255, 255, 0.5)`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size + 5, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.shadowBlur = 0;
      const barY = y - size - 15;
      this.drawHealthBar(x, barY, 40, tesla.health, tesla.maxHealth, tesla.team);
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      this.ctx.font = "10px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(`${Math.ceil(tesla.lifetime)}s`, x, y + size + 15);
      if (tesla.carriedCount > 0) {
        this.ctx.fillStyle = "#00bfff";
        this.ctx.font = "bold 16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("\u{1F916}", x, y - 25);
        this.ctx.fillStyle = "#ff0000";
        this.ctx.beginPath();
        this.ctx.arc(x + 15, y - 35, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 10px Arial";
        this.ctx.fillText(`${tesla.carriedCount}`, x + 15, y - 35);
        if (tesla.carriedCount >= 50) {
          this.ctx.fillStyle = "#ffff00";
          this.ctx.font = "14px Arial";
          this.ctx.fillText("\u{1F525}", x - 15, y - 35);
        }
      }
    }
    drawSurge(surge) {
      if (!surge.isAlive)
        return;
      const { x, y } = surge.position;
      const stage = surge.getStage();
      const superCharge = surge.getSuperCharge();
      for (const proj of surge.getSplitProjectiles()) {
        this.ctx.fillStyle = "#00ffff";
        this.ctx.shadowColor = "#00ffff";
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.shadowBlur = 0;
      const stageColors = ["#4444ff", "#44ff44", "#ffff44", "#ff44ff"];
      const color = stageColors[stage - 1];
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 10 + stage * 5;
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 15 + stage * 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.arc(x, y, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#000000";
      this.ctx.font = "bold 12px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(`${stage}`, x, y);
      this.ctx.shadowBlur = 0;
      for (let i = 0; i < stage; i++) {
        const angle = (Date.now() / 200 + i * Math.PI * 2 / stage) % (Math.PI * 2);
        const boltX = x + Math.cos(angle) * (20 + stage * 3);
        const boltY = y + Math.sin(angle) * (20 + stage * 3);
        this.ctx.strokeStyle = "#00ffff";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(boltX, boltY);
        this.ctx.stroke();
      }
      const barWidth = 30;
      const barHeight = 4;
      const barY = y - 30;
      this.ctx.fillStyle = "#333";
      this.ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);
      this.ctx.fillStyle = "#ffff00";
      this.ctx.fillRect(x - barWidth / 2, barY, barWidth * superCharge, barHeight);
      this.ctx.strokeStyle = "#000";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
      this.ctx.fillStyle = color;
      this.ctx.font = "bold 10px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText("SURGE", x, y - 40);
      this.drawHealthBar(x, y - 50, 35, surge.health, surge.maxHealth, surge.team);
      this.ctx.strokeStyle = surge.team === "player" ? "#4a90d9" : "#d94a4a";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y + 5, 20, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    drawLily(lily) {
      if (!lily.isAlive)
        return;
      const { x, y } = lily.position;
      const isInvisible = lily.getIsInvisible();
      const superCharge = lily.getSuperCharge();
      this.ctx.save();
      if (isInvisible) {
        this.ctx.globalAlpha = 0.3;
      }
      for (const proj of lily.getThornProjectiles()) {
        this.ctx.fillStyle = "#8B008B";
        this.ctx.shadowColor = "#FF00FF";
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        const thornSize = 6;
        this.ctx.save();
        this.ctx.translate(proj.x, proj.y);
        this.ctx.rotate(proj.angle);
        this.ctx.beginPath();
        this.ctx.moveTo(thornSize, 0);
        this.ctx.lineTo(-thornSize / 2, -thornSize / 2);
        this.ctx.lineTo(-thornSize / 2, thornSize / 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      }
      this.ctx.shadowBlur = 0;
      const baseColor = "#9932CC";
      const petalColor = "#FF69B4";
      if (isInvisible) {
        this.ctx.shadowColor = "#FF00FF";
        this.ctx.shadowBlur = 15;
      }
      for (let i = 0; i < 5; i++) {
        const angle = i / 5 * Math.PI * 2 + Date.now() / 1e3;
        const petalX = x + Math.cos(angle) * 12;
        const petalY = y + Math.sin(angle) * 12;
        this.ctx.fillStyle = petalColor;
        this.ctx.beginPath();
        this.ctx.ellipse(petalX, petalY, 6, 4, angle, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.fillStyle = baseColor;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#FFD700";
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = petalColor;
      this.ctx.font = "bold 10px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText("LILY", x, y - 35);
      const barWidth = 30;
      const barHeight = 4;
      const barY = y - 28;
      this.ctx.fillStyle = "#333";
      this.ctx.fillRect(x - barWidth / 2, barY, barWidth, barHeight);
      this.ctx.fillStyle = "#FF00FF";
      this.ctx.fillRect(x - barWidth / 2, barY, barWidth * superCharge, barHeight);
      this.ctx.strokeStyle = "#000";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
      this.ctx.globalAlpha = 1;
      this.drawHealthBar(x, y - 45, 35, lily.health, lily.maxHealth, lily.team);
      this.ctx.strokeStyle = lily.team === "player" ? "#4a90d9" : "#d94a4a";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y + 5, 18, 0, Math.PI * 2);
      this.ctx.stroke();
      if (isInvisible) {
        this.ctx.fillStyle = "#FF00FF";
        this.ctx.font = "bold 8px Arial";
        this.ctx.fillText("INVISIBLE", x, y + 30);
      }
      this.ctx.restore();
    }
    drawSpeechBubble(bubble) {
      const { x, y, text, life } = bubble;
      const alpha = Math.min(1, life);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = "bold 12px Arial";
      const textWidth = this.ctx.measureText(text).width;
      const padding = 8;
      const bubbleWidth = textWidth + padding * 2;
      const bubbleHeight = 24;
      this.ctx.fillStyle = "#ffffff";
      this.ctx.strokeStyle = "#000000";
      this.ctx.lineWidth = 2;
      const bx = x - bubbleWidth / 2;
      const by = y - bubbleHeight / 2;
      const radius = 8;
      this.ctx.beginPath();
      this.ctx.moveTo(bx + radius, by);
      this.ctx.lineTo(bx + bubbleWidth - radius, by);
      this.ctx.quadraticCurveTo(bx + bubbleWidth, by, bx + bubbleWidth, by + radius);
      this.ctx.lineTo(bx + bubbleWidth, by + bubbleHeight - radius);
      this.ctx.quadraticCurveTo(bx + bubbleWidth, by + bubbleHeight, bx + bubbleWidth - radius, by + bubbleHeight);
      this.ctx.lineTo(bx + radius, by + bubbleHeight);
      this.ctx.quadraticCurveTo(bx, by + bubbleHeight, bx, by + bubbleHeight - radius);
      this.ctx.lineTo(bx, by + radius);
      this.ctx.quadraticCurveTo(bx, by, bx + radius, by);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.moveTo(x - 5, by + bubbleHeight);
      this.ctx.lineTo(x + 5, by + bubbleHeight);
      this.ctx.lineTo(x, by + bubbleHeight + 8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = "#000000";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(text, x, y);
      this.ctx.restore();
    }
  };

  // src/tower.ts
  var nextId = 1e3;
  var TOWER_STATS = {
    king: {
      health: 7200,
      // Triple health (2400 * 3)
      damage: 25,
      // Half damage (50 / 2)
      attackSpeed: 0.5,
      // Half attack rate (1 / 2)
      attackRange: 120,
      size: 50
    },
    princess: {
      health: 4200,
      // Triple health (1400 * 3)
      damage: 20,
      // Half damage (40 / 2)
      attackSpeed: 0.4,
      // Half attack rate (0.8 / 2)
      attackRange: 140,
      size: 40
    }
  };
  var Tower = class {
    constructor(position, team, towerType) {
      this.onAttack = null;
      const stats = TOWER_STATS[towerType];
      this.id = nextId++;
      this.position = { ...position };
      this.team = team;
      this.towerType = towerType;
      this.health = stats.health;
      this.maxHealth = stats.health;
      this.damage = stats.damage;
      this.attackSpeed = stats.attackSpeed;
      this.attackRange = stats.attackRange;
      this.attackCooldown = 0;
      this.target = null;
      this.size = stats.size;
    }
    get isAlive() {
      return this.health > 0;
    }
    update(deltaTime, enemies) {
      if (!this.isAlive)
        return;
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
      this.target = this.findNearestEnemy(enemies);
      if (this.target && this.attackCooldown <= 0) {
        this.attack(this.target);
      }
    }
    findNearestEnemy(enemies) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
        const dist = this.distanceTo(enemy);
        if (dist <= this.attackRange && dist < nearestDist) {
          nearest = enemy;
          nearestDist = dist;
        }
      }
      return nearest;
    }
    distanceTo(entity) {
      const dx = entity.position.x - this.position.x;
      const dy = entity.position.y - this.position.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    attack(target) {
      target.health -= this.damage;
      this.attackCooldown = 1 / this.attackSpeed;
      if (this.onAttack) {
        this.onAttack(this, target);
      }
    }
    takeDamage(amount) {
      this.health = Math.max(0, this.health - amount);
    }
  };

  // src/unit.ts
  var nextId2 = 1;
  var Unit = class {
    // When picked up by Tesla
    constructor(position, team, stats) {
      this.onAttack = null;
      this.isBeingCarried = false;
      this.id = nextId2++;
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
    get isAlive() {
      return this.health > 0;
    }
    // Can't take damage while being carried in a Tesla!
    takeDamage(amount) {
      if (this.isBeingCarried)
        return;
      this.health = Math.max(0, this.health - amount);
    }
    update(deltaTime, enemies) {
      if (!this.isAlive)
        return;
      if (this.isBeingCarried)
        return;
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
      this.target = this.findNearestEnemy(enemies);
      if (this.target) {
        const dist = this.distanceTo(this.target);
        if (dist <= this.attackRange) {
          if (this.attackCooldown <= 0) {
            this.attack(this.target);
          }
        } else {
          this.moveToward(this.target.position, deltaTime);
        }
      } else {
        this.moveTowardEnemySide(deltaTime);
      }
    }
    findNearestEnemy(enemies) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
        const dist = this.distanceTo(enemy);
        if (dist < nearestDist) {
          nearest = enemy;
          nearestDist = dist;
        }
      }
      return nearest;
    }
    distanceTo(entity) {
      const dx = entity.position.x - this.position.x;
      const dy = entity.position.y - this.position.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    moveToward(target, deltaTime) {
      let targetX = target.x;
      let targetY = target.y;
      const riverTop = ARENA.riverY;
      const riverBottom = ARENA.riverY + ARENA.riverHeight;
      const riverCenter = ARENA.riverY + ARENA.riverHeight / 2;
      const needsBridge = this.needsToCrossBridge(targetY);
      if (needsBridge) {
        const bridgeX = getNearestBridgeX(this.position.x);
        if (Math.abs(this.position.x - bridgeX) > 10) {
          targetX = bridgeX;
          if (this.position.y > riverBottom) {
            targetY = Math.max(this.position.y - 20, riverBottom + 5);
          } else if (this.position.y < riverTop) {
            targetY = Math.min(this.position.y + 20, riverTop - 5);
          }
        } else if (this.position.y >= riverTop - 5 && this.position.y <= riverBottom + 5) {
          targetX = bridgeX;
          targetY = this.team === "player" ? riverTop - 10 : riverBottom + 10;
        } else {
          targetX = bridgeX;
          targetY = this.team === "player" ? riverCenter : riverCenter;
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
        this.position.x = Math.max(this.size, Math.min(ARENA.width - this.size, this.position.x));
        this.position.y = Math.max(this.size, Math.min(ARENA.height - this.size, this.position.y));
      }
    }
    needsToCrossBridge(targetY) {
      const myY = this.position.y;
      const riverTop = ARENA.riverY;
      const riverBottom = ARENA.riverY + ARENA.riverHeight;
      if (myY > riverBottom && targetY < riverTop)
        return true;
      if (myY < riverTop && targetY > riverBottom)
        return true;
      const inRiver = myY >= riverTop && myY <= riverBottom;
      if (inRiver && !isOnBridge(this.position.x, myY))
        return true;
      return false;
    }
    moveTowardEnemySide(deltaTime) {
      const targetY = this.team === "player" ? 80 : 520;
      const targetX = this.position.x;
      this.moveToward({ x: targetX, y: targetY }, deltaTime);
    }
    attack(target) {
      target.health -= this.damage;
      this.attackCooldown = 1 / this.attackSpeed;
      if (this.onAttack) {
        this.onAttack(this, target);
      }
    }
  };

  // src/units/knight.ts
  var KNIGHT_STATS = {
    health: 660,
    damage: 75,
    attackSpeed: 1.2,
    attackRange: 25,
    moveSpeed: 60,
    cost: 3,
    size: 15
  };
  var Knight = class extends Unit {
    constructor(position, team) {
      super(position, team, KNIGHT_STATS);
      this.unitType = "knight";
    }
  };
  function getKnightCost() {
    return KNIGHT_STATS.cost;
  }

  // src/units/minipekka.ts
  var MINI_PEKKA_STATS = {
    health: 600,
    // Lower than Knight (660)
    damage: 340,
    // Much higher than Knight (75)
    attackSpeed: 1.8,
    // Slower attack speed (wind up)
    attackRange: 25,
    moveSpeed: 90,
    // Faster than Knight (60)
    cost: 4,
    size: 18
  };
  var MiniPekka = class extends Unit {
    constructor(position, team) {
      super(position, team, MINI_PEKKA_STATS);
      this.unitType = "minipekka";
      this.isCharged = true;
      this.chargeMultiplier = 2;
    }
    // Override the attack to implement charge mechanic
    attack(target) {
      let damage = this.damage;
      if (this.isCharged) {
        damage *= this.chargeMultiplier;
        this.isCharged = false;
      }
      target.health -= damage;
      this.attackCooldown = 1 / this.attackSpeed;
    }
  };
  function getMiniPekkaCost() {
    return MINI_PEKKA_STATS.cost;
  }

  // src/projectile.ts
  var Projectile = class {
    constructor(start, target, team, config) {
      this.hitEntities = /* @__PURE__ */ new Set();
      this.distanceTraveled = 0;
      this.isAlive = true;
      this.position = { ...start };
      this.startPosition = { ...start };
      this.team = team;
      this.config = config;
      const dx = target.x - start.x;
      const dy = target.y - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        this.velocity = {
          x: dx / dist * config.speed,
          y: dy / dist * config.speed
        };
      } else {
        this.velocity = { x: 0, y: -config.speed };
      }
    }
    update(deltaTime, enemies) {
      if (!this.isAlive)
        return [];
      const hitThisFrame = [];
      if (this.config.seeking) {
        const nearestEnemy = this.findNearestEnemy(enemies);
        if (nearestEnemy) {
          const dx = nearestEnemy.position.x - this.position.x;
          const dy = nearestEnemy.position.y - this.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const seekStrength = 0.1;
            const targetVelX = dx / dist * this.config.speed;
            const targetVelY = dy / dist * this.config.speed;
            this.velocity.x += (targetVelX - this.velocity.x) * seekStrength;
            this.velocity.y += (targetVelY - this.velocity.y) * seekStrength;
            const velMag = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
            if (velMag > 0) {
              this.velocity.x = this.velocity.x / velMag * this.config.speed;
              this.velocity.y = this.velocity.y / velMag * this.config.speed;
            }
          }
        }
      }
      const moveX = this.velocity.x * deltaTime;
      const moveY = this.velocity.y * deltaTime;
      this.position.x += moveX;
      this.position.y += moveY;
      this.distanceTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
        if (this.hitEntities.has(enemy.id))
          continue;
        const dist = this.distanceTo(enemy.position);
        const hitRadius = 20;
        if (dist < hitRadius) {
          this.hitEntities.add(enemy.id);
          hitThisFrame.push(enemy);
          enemy.health -= this.config.damage;
          if (this.config.splash) {
            for (const other of enemies) {
              if (other.id === enemy.id)
                continue;
              if (!other.isAlive)
                continue;
              if (this.hitEntities.has(other.id))
                continue;
              const splashDist = this.distanceTo(other.position);
              if (splashDist < this.config.splashRadius) {
                const falloff = 1 - splashDist / this.config.splashRadius;
                const splashDamage = this.config.damage * 0.5 * falloff;
                other.health -= splashDamage;
                this.hitEntities.add(other.id);
                hitThisFrame.push(other);
              }
            }
          }
          if (!this.config.piercing) {
            this.isAlive = false;
            break;
          }
        }
      }
      if (this.distanceTraveled > this.config.maxRange || this.position.x < -50 || this.position.x > 850 || this.position.y < -50 || this.position.y > 650) {
        this.isAlive = false;
      }
      return hitThisFrame;
    }
    findNearestEnemy(enemies) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
        if (this.hitEntities.has(enemy.id))
          continue;
        const dist = this.distanceTo(enemy.position);
        if (dist < nearestDist) {
          nearest = enemy;
          nearestDist = dist;
        }
      }
      return nearest;
    }
    distanceTo(pos) {
      const dx = pos.x - this.position.x;
      const dy = pos.y - this.position.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    getAngle() {
      return Math.atan2(this.velocity.y, this.velocity.x);
    }
  };

  // src/units/magicarcher.ts
  var MAGIC_ARCHER_STATS = {
    health: 250,
    // Glass cannon - very low HP
    damage: 150,
    // High damage per arrow
    attackSpeed: 1.1,
    // Fast attacks
    attackRange: 200,
    // Extreme range
    moveSpeed: 70,
    // Medium speed
    cost: 3,
    size: 14
  };
  var ARROW_CONFIG = {
    damage: 150,
    speed: 400,
    piercing: true,
    // Passes through enemies
    splash: true,
    // Explodes on impact
    splashRadius: 60,
    // Splash radius
    seeking: true,
    // Curves toward enemies
    maxRange: 500
    // Travels far
  };
  var MagicArcher = class extends Unit {
    constructor(position, team) {
      super(position, team, MAGIC_ARCHER_STATS);
      this.unitType = "magicarcher";
      this.pendingProjectile = null;
    }
    // Override attack to create projectile instead of instant damage
    attack(target) {
      this.pendingProjectile = {
        start: { ...this.position },
        target: { ...target.position }
      };
      this.attackCooldown = 1 / this.attackSpeed;
    }
    createProjectile() {
      if (!this.pendingProjectile)
        return null;
      const projectile = new Projectile(
        this.pendingProjectile.start,
        this.pendingProjectile.target,
        this.team,
        { ...ARROW_CONFIG, damage: this.damage }
      );
      this.pendingProjectile = null;
      return projectile;
    }
  };
  function getMagicArcherCost() {
    return MAGIC_ARCHER_STATS.cost;
  }

  // src/units/goldknight.ts
  var GOLD_KNIGHT_STATS = {
    health: 800,
    // Tankier than regular knight
    damage: 120,
    // Higher damage
    attackSpeed: 1,
    // Slightly slower
    attackRange: 30,
    // Slightly more range for the knockback
    moveSpeed: 55,
    // Slower, he's heavy
    cost: 4,
    size: 18
  };
  var KNOCKBACK_STRENGTH = 200;
  var GoldKnight = class extends Unit {
    constructor(position, team) {
      super(position, team, GOLD_KNIGHT_STATS);
      this.unitType = "goldknight";
      this.pendingKnockback = null;
    }
    // Override attack to add knockback
    attack(target) {
      target.health -= this.damage;
      this.attackCooldown = 1 / this.attackSpeed;
      this.pendingKnockback = {
        targetId: target.id,
        strength: KNOCKBACK_STRENGTH
      };
      if (this.onAttack) {
        this.onAttack(this, target);
      }
    }
    // Called by game to get and clear pending knockback
    getKnockback() {
      const knockback = this.pendingKnockback;
      this.pendingKnockback = null;
      return knockback;
    }
  };
  function getGoldKnightCost() {
    return GOLD_KNIGHT_STATS.cost;
  }

  // src/units/megaknight.ts
  var MEGA_KNIGHT_STATS = {
    health: 1200,
    // THICC boy
    damage: 180,
    // Base damage
    attackSpeed: 1.3,
    // Slow but powerful
    attackRange: 35,
    // Melee range
    moveSpeed: 45,
    // Slow, he's MEGA
    cost: 7,
    size: 24
    // Big boi
  };
  var JUMP_DAMAGE = 350;
  var JUMP_SPLASH_RADIUS = 80;
  var JUMP_RANGE_MIN = 100;
  var JUMP_RANGE_MAX = 300;
  var JUMP_COOLDOWN = 4;
  var JUMP_DURATION = 0.5;
  var MegaKnight = class extends Unit {
    constructor(position, team) {
      super(position, team, MEGA_KNIGHT_STATS);
      this.unitType = "megaknight";
      this.jumpCooldown = 0;
      this.isJumping = false;
      this.jumpProgress = 0;
      this.jumpStart = null;
      this.jumpEnd = null;
      this.pendingJump = null;
    }
    update(deltaTime, enemies) {
      if (!this.isAlive)
        return;
      this.jumpCooldown = Math.max(0, this.jumpCooldown - deltaTime);
      if (this.isJumping) {
        this.jumpProgress += deltaTime / JUMP_DURATION;
        if (this.jumpProgress >= 1 && this.jumpStart && this.jumpEnd) {
          this.position.x = this.jumpEnd.x;
          this.position.y = this.jumpEnd.y;
          this.isJumping = false;
          this.jumpProgress = 0;
          this.jumpCooldown = JUMP_COOLDOWN;
          const targets = [];
          for (const enemy of enemies) {
            if (!enemy.isAlive)
              continue;
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
            damage: JUMP_DAMAGE
          };
          this.jumpStart = null;
          this.jumpEnd = null;
        } else if (this.jumpStart && this.jumpEnd) {
          const t = this.jumpProgress;
          const arcHeight = 100;
          this.position.x = this.jumpStart.x + (this.jumpEnd.x - this.jumpStart.x) * t;
          this.position.y = this.jumpStart.y + (this.jumpEnd.y - this.jumpStart.y) * t - Math.sin(t * Math.PI) * arcHeight;
        }
        return;
      }
      if (this.jumpCooldown <= 0) {
        const jumpTarget = this.findJumpTarget(enemies);
        if (jumpTarget) {
          this.startJump(jumpTarget.position);
          return;
        }
      }
      super.update(deltaTime, enemies);
    }
    findJumpTarget(enemies) {
      let best = null;
      let bestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
        const dx = enemy.position.x - this.position.x;
        const dy = enemy.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= JUMP_RANGE_MIN && dist <= JUMP_RANGE_MAX && dist < bestDist) {
          best = enemy;
          bestDist = dist;
        }
      }
      return best;
    }
    startJump(targetPos) {
      this.isJumping = true;
      this.jumpProgress = 0;
      this.jumpStart = { ...this.position };
      this.jumpEnd = { ...targetPos };
    }
    // Override attack to deal splash damage
    attack(target) {
      target.health -= this.damage;
      this.attackCooldown = 1 / this.attackSpeed;
      if (this.onAttack) {
        this.onAttack(this, target);
      }
    }
    // Called by game to get jump event
    getJumpEvent() {
      const jump = this.pendingJump;
      this.pendingJump = null;
      return jump;
    }
    // For rendering - is the unit currently jumping?
    getJumpState() {
      const height = this.isJumping ? Math.sin(this.jumpProgress * Math.PI) * 100 : 0;
      return {
        isJumping: this.isJumping,
        progress: this.jumpProgress,
        height
      };
    }
  };
  function getMegaKnightCost() {
    return MEGA_KNIGHT_STATS.cost;
  }

  // src/units/surge.ts
  var SURGE_STATS = {
    health: 5600,
    damage: 1680,
    attackSpeed: 0.6,
    // Attacks per second
    attackRange: 200,
    // Stage 1 range
    moveSpeed: 120,
    size: 18,
    cost: 1,
    // Only 1 elixir!
    superChargePerHit: 0.25,
    // 4 hits to charge super
    teleportDistance: 100
  };
  var STAGE_BONUSES = {
    1: { speedBoost: 1, rangeBoost: 1, splitShots: 1 },
    2: { speedBoost: 1.5, rangeBoost: 1, splitShots: 1 },
    // Faster movement
    3: { speedBoost: 1.5, rangeBoost: 1.5, splitShots: 3 },
    // Longer range + 3 split shots
    4: { speedBoost: 1.5, rangeBoost: 1.5, splitShots: 6 }
    // 6 split shots
  };
  var Surge = class extends Unit {
    constructor(position, team) {
      super(position, team, {
        health: SURGE_STATS.health,
        damage: SURGE_STATS.damage,
        attackSpeed: SURGE_STATS.attackSpeed,
        attackRange: SURGE_STATS.attackRange,
        moveSpeed: SURGE_STATS.moveSpeed,
        size: SURGE_STATS.size,
        cost: SURGE_STATS.cost
      });
      this.unitType = "surge";
      this.isSurge = true;
      this.stage = 1;
      this.superCharge = 0;
      this.teleportCooldown = 0;
      this.lastShotTime = 0;
      this.splitProjectiles = [];
      this.onUpgrade = null;
    }
    update(deltaTime, enemies) {
      if (!this.isAlive)
        return;
      if (this.isBeingCarried)
        return;
      const bonus = STAGE_BONUSES[this.stage];
      const effectiveSpeed = SURGE_STATS.moveSpeed * bonus.speedBoost;
      const effectiveRange = SURGE_STATS.attackRange * bonus.rangeBoost;
      this.teleportCooldown = Math.max(0, this.teleportCooldown - deltaTime);
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
      this.splitProjectiles = this.splitProjectiles.filter((p) => {
        p.x += Math.cos(p.angle) * 300 * deltaTime;
        p.y += Math.sin(p.angle) * 300 * deltaTime;
        p.life -= deltaTime;
        for (const enemy of enemies) {
          if (!enemy.isAlive)
            continue;
          const dx = enemy.position.x - p.x;
          const dy = enemy.position.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            enemy.health -= this.damage * 0.5;
            p.life = 0;
            break;
          }
        }
        return p.life > 0;
      });
      this.target = this.findNearestEnemy(enemies, effectiveRange * 1.5);
      if (this.superCharge >= 1 && this.target && this.stage < 4) {
        this.useSuper();
      }
      if (this.target) {
        const dx = this.target.position.x - this.position.x;
        const dy = this.target.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= effectiveRange) {
          if (this.attackCooldown <= 0) {
            this.attack(this.target);
            this.superCharge = Math.min(1, this.superCharge + SURGE_STATS.superChargePerHit);
            if (bonus.splitShots > 1) {
              const baseAngle = Math.atan2(dy, dx);
              for (let i = 0; i < bonus.splitShots; i++) {
                const spreadAngle = baseAngle + (i - bonus.splitShots / 2) * 0.3;
                this.splitProjectiles.push({
                  x: this.position.x,
                  y: this.position.y,
                  angle: spreadAngle,
                  life: 0.5
                });
              }
            }
          }
        } else {
          this.smartMove(dx, dy, dist, effectiveSpeed, deltaTime);
        }
      } else {
        const targetY = this.team === "player" ? 0 : 600;
        const dy = targetY - this.position.y;
        if (Math.abs(dy) > 10) {
          this.smartMove(0, dy, Math.abs(dy), effectiveSpeed, deltaTime);
        }
      }
    }
    // Smart movement that avoids the river
    smartMove(dx, dy, dist, speed, deltaTime) {
      const riverTop = ARENA.riverY;
      const riverBottom = ARENA.riverY + ARENA.riverHeight;
      const currentY = this.position.y;
      const nextY = currentY + dy / dist * speed * deltaTime;
      const wouldEnterRiver = currentY < riverTop && nextY >= riverTop || currentY > riverBottom && nextY <= riverBottom || nextY >= riverTop && nextY <= riverBottom;
      const inRiverZone = currentY >= riverTop - 20 && currentY <= riverBottom + 20;
      if (wouldEnterRiver || inRiverZone) {
        if (isOnBridge(this.position.x, this.position.y)) {
          this.position.x += dx / dist * speed * deltaTime;
          this.position.y += dy / dist * speed * deltaTime;
        } else {
          const bridgeX = getNearestBridgeX(this.position.x);
          const bridgeDx = bridgeX - this.position.x;
          if (Math.abs(bridgeDx) > 10) {
            this.position.x += Math.sign(bridgeDx) * speed * deltaTime;
          } else {
            this.position.y += dy / dist * speed * deltaTime;
          }
        }
      } else {
        this.position.x += dx / dist * speed * deltaTime;
        this.position.y += dy / dist * speed * deltaTime;
      }
    }
    findNearestEnemy(enemies, range) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
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
    useSuper() {
      const targetY = this.team === "player" ? this.position.y - SURGE_STATS.teleportDistance : this.position.y + SURGE_STATS.teleportDistance;
      this.position.y = targetY;
      this.stage = Math.min(4, this.stage + 1);
      this.superCharge = 0;
      this.teleportCooldown = 1;
      console.log(`\u26A1 SURGE UPGRADED TO STAGE ${this.stage}! \u26A1`);
      if (this.onUpgrade) {
        this.onUpgrade(this);
      }
    }
    attack(target) {
      target.health -= this.damage;
      this.attackCooldown = 1 / this.attackSpeed;
      if (this.onAttack) {
        this.onAttack(this, target);
      }
    }
    // Getters for renderer
    getStage() {
      return this.stage;
    }
    getSuperCharge() {
      return this.superCharge;
    }
    getSplitProjectiles() {
      return this.splitProjectiles;
    }
  };
  function getSurgeCost() {
    return SURGE_STATS.cost;
  }

  // src/units/lily.ts
  var LILY_STATS = {
    health: 4200,
    damage: 1400,
    attackSpeed: 0.7,
    // Attacks per second
    attackRange: 180,
    moveSpeed: 150,
    // Fast assassin
    size: 16,
    cost: 1,
    // 1 elixir like Surge
    superChargePerHit: 0.2,
    // 5 hits to charge super
    dashDistance: 120,
    invisibilityDuration: 2.5
  };
  var Lily = class extends Unit {
    constructor(position, team) {
      super(position, team, {
        health: LILY_STATS.health,
        damage: LILY_STATS.damage,
        attackSpeed: LILY_STATS.attackSpeed,
        attackRange: LILY_STATS.attackRange,
        moveSpeed: LILY_STATS.moveSpeed,
        size: LILY_STATS.size,
        cost: LILY_STATS.cost
      });
      this.unitType = "lily";
      this.isLily = true;
      this.superCharge = 0;
      this.isInvisible = false;
      this.invisibilityTimer = 0;
      this.timeSinceLastAttack = 0;
      this.thornProjectiles = [];
      this.dashCooldown = 0;
      this.onSuperUse = null;
    }
    update(deltaTime, enemies) {
      if (!this.isAlive)
        return;
      if (this.isBeingCarried)
        return;
      this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
      this.dashCooldown = Math.max(0, this.dashCooldown - deltaTime);
      this.timeSinceLastAttack += deltaTime;
      if (this.isInvisible) {
        this.invisibilityTimer -= deltaTime;
        if (this.invisibilityTimer <= 0) {
          this.isInvisible = false;
        }
      }
      if (this.timeSinceLastAttack > 3 && !this.isInvisible) {
        this.isInvisible = true;
        this.invisibilityTimer = LILY_STATS.invisibilityDuration;
      }
      this.thornProjectiles = this.thornProjectiles.filter((p) => {
        p.x += Math.cos(p.angle) * 350 * deltaTime;
        p.y += Math.sin(p.angle) * 350 * deltaTime;
        p.life -= deltaTime;
        for (const enemy of enemies) {
          if (!enemy.isAlive)
            continue;
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
      this.target = this.findNearestEnemy(enemies, LILY_STATS.attackRange * 2);
      if (this.superCharge >= 1 && this.target && this.dashCooldown <= 0) {
        this.useSuper();
      }
      if (this.target) {
        const dx = this.target.position.x - this.position.x;
        const dy = this.target.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= LILY_STATS.attackRange) {
          if (this.attackCooldown <= 0) {
            this.attackWithThorns(dx, dy);
            this.timeSinceLastAttack = 0;
            this.isInvisible = false;
          }
        } else {
          this.smartMove(dx, dy, dist, LILY_STATS.moveSpeed, deltaTime);
        }
      } else {
        const targetY = this.team === "player" ? 0 : 600;
        const dy = targetY - this.position.y;
        if (Math.abs(dy) > 10) {
          this.smartMove(0, dy, Math.abs(dy), LILY_STATS.moveSpeed, deltaTime);
        }
      }
    }
    attackWithThorns(dx, dy) {
      const baseAngle = Math.atan2(dy, dx);
      for (let i = -1; i <= 1; i++) {
        const spreadAngle = baseAngle + i * 0.25;
        this.thornProjectiles.push({
          x: this.position.x,
          y: this.position.y,
          angle: spreadAngle,
          life: 0.6
        });
      }
      this.attackCooldown = 1 / this.attackSpeed;
      if (this.onAttack) {
        this.onAttack(this, this.target);
      }
    }
    useSuper() {
      if (!this.target)
        return;
      const dx = this.target.position.x - this.position.x;
      const dy = this.target.position.y - this.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dashDist = Math.min(LILY_STATS.dashDistance, dist);
      this.position.x += dx / dist * dashDist;
      this.position.y += dy / dist * dashDist;
      this.isInvisible = true;
      this.invisibilityTimer = LILY_STATS.invisibilityDuration;
      this.superCharge = 0;
      this.dashCooldown = 1.5;
      console.log("\u{1F338} LILY DASHES AND VANISHES! \u{1F338}");
      if (this.onSuperUse) {
        this.onSuperUse(this);
      }
    }
    // Smart movement that avoids the river (same as Surge)
    smartMove(dx, dy, dist, speed, deltaTime) {
      const riverTop = ARENA.riverY;
      const riverBottom = ARENA.riverY + ARENA.riverHeight;
      const currentY = this.position.y;
      const nextY = currentY + dy / dist * speed * deltaTime;
      const wouldEnterRiver = currentY < riverTop && nextY >= riverTop || currentY > riverBottom && nextY <= riverBottom || nextY >= riverTop && nextY <= riverBottom;
      const inRiverZone = currentY >= riverTop - 20 && currentY <= riverBottom + 20;
      if (wouldEnterRiver || inRiverZone) {
        if (isOnBridge(this.position.x, this.position.y)) {
          this.position.x += dx / dist * speed * deltaTime;
          this.position.y += dy / dist * speed * deltaTime;
        } else {
          const bridgeX = getNearestBridgeX(this.position.x);
          const bridgeDx = bridgeX - this.position.x;
          if (Math.abs(bridgeDx) > 10) {
            this.position.x += Math.sign(bridgeDx) * speed * deltaTime;
          } else {
            this.position.y += dy / dist * speed * deltaTime;
          }
        }
      } else {
        this.position.x += dx / dist * speed * deltaTime;
        this.position.y += dy / dist * speed * deltaTime;
      }
    }
    findNearestEnemy(enemies, range) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
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
    getIsInvisible() {
      return this.isInvisible;
    }
    getSuperCharge() {
      return this.superCharge;
    }
    getThornProjectiles() {
      return this.thornProjectiles;
    }
  };
  function getLilyCost() {
    return LILY_STATS.cost;
  }

  // src/buildings/tesla.ts
  var TESLA_STATS = {
    health: 600,
    damage: 200,
    // Damage per hit when running over enemies
    speed: 180,
    // Faster than units!
    cost: 5,
    lifetime: 30,
    // seconds
    size: 30,
    hitCooldown: 0.5,
    // Time between hitting same target
    turnSpeed: 3,
    // How fast it can turn (radians/sec)
    dropStartTime: 22.5,
    // Start dropping when lifetime reaches this
    dropInterval: 2.5,
    // Drop some every 2.5 seconds
    dropCount: 10
    // How many to drop each time
  };
  var Tesla = class _Tesla {
    constructor(position, team) {
      this.angle = 0;
      // Direction the car is facing
      this.velocity = { x: 0, y: 0 };
      this.target = null;
      this.hitCooldowns = /* @__PURE__ */ new Map();
      // Track cooldown per enemy
      this.skidMarks = [];
      // Trail of skid marks
      this.driftAngle = 0;
      // For visual drift effect
      this.lastHitTime = 0;
      this.isHonking = false;
      this.carriedUnits = [];
      // Mini Pekkas riding in the car! (up to 100!)
      this.isFrozen = false;
      this.freezeTime = 0;
      this.dropTimer = 0;
      // Timer for gradual dropping
      this.droppedThisFrame = 0;
      this.id = _Tesla.nextId++;
      this.position = { ...position };
      this.team = team;
      this.health = TESLA_STATS.health;
      this.maxHealth = TESLA_STATS.health;
      this.damage = TESLA_STATS.damage;
      this.speed = TESLA_STATS.speed;
      this.size = TESLA_STATS.size;
      this.lifetime = TESLA_STATS.lifetime;
      this.angle = team === "player" ? -Math.PI / 2 : Math.PI / 2;
    }
    static {
      // How many pekkas were dropped this frame
      this.nextId = 5e3;
    }
    get isAlive() {
      return this.health > 0 && this.lifetime > 0;
    }
    update(deltaTime, enemies, friendlyUnits, allUnits) {
      if (!this.isAlive)
        return [];
      this.lifetime -= deltaTime;
      this.lastHitTime = Math.max(0, this.lastHitTime - deltaTime);
      if (this.freezeTime > 0) {
        this.freezeTime -= deltaTime;
        this.isFrozen = this.freezeTime > 0;
        if (this.isFrozen)
          return [];
      }
      this.droppedThisFrame = 0;
      if (this.carriedUnits.length > 0 && this.lifetime <= TESLA_STATS.dropStartTime) {
        this.dropTimer -= deltaTime;
        if (this.dropTimer <= 0) {
          this.droppedThisFrame = this.dropSomeUnits(TESLA_STATS.dropCount);
          this.dropTimer = TESLA_STATS.dropInterval;
        }
      }
      for (let i = 0; i < this.carriedUnits.length; i++) {
        const unit = this.carriedUnits[i];
        const angle = i / 5 * Math.PI * 2;
        const radius = 5 + Math.floor(i / 5) * 8;
        unit.position.x = this.position.x + Math.cos(angle) * radius;
        unit.position.y = this.position.y - 20 - Math.floor(i / 10) * 5;
      }
      const unitsToCheck = allUnits || friendlyUnits || [];
      if (this.carriedUnits.length < 100) {
        this.tryPickupMiniPekkas(unitsToCheck);
      }
      const nearbyMiniPekka = this.findNearestMiniPekka(unitsToCheck);
      for (const [id, cooldown] of this.hitCooldowns.entries()) {
        const newCooldown = cooldown - deltaTime;
        if (newCooldown <= 0) {
          this.hitCooldowns.delete(id);
        } else {
          this.hitCooldowns.set(id, newCooldown);
        }
      }
      if (nearbyMiniPekka && this.carriedUnits.length < 100) {
        this.target = nearbyMiniPekka;
      } else {
        this.target = this.findTarget(enemies);
      }
      const hitEntities = [];
      if (this.target) {
        const dx = this.target.position.x - this.position.x;
        const dy = this.target.position.y - this.position.y;
        const targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - this.angle;
        while (angleDiff > Math.PI)
          angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI)
          angleDiff += Math.PI * 2;
        const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), TESLA_STATS.turnSpeed * deltaTime);
        this.angle += turnAmount;
        this.driftAngle = angleDiff * 0.3;
        this.velocity.x = Math.cos(this.angle) * this.speed;
        this.velocity.y = Math.sin(this.angle) * this.speed;
        if (Math.abs(angleDiff) > 0.3 && Math.random() < 0.3) {
          this.skidMarks.push({ ...this.position });
          if (this.skidMarks.length > 20) {
            this.skidMarks.shift();
          }
        }
        this.isHonking = Math.sqrt(dx * dx + dy * dy) < 100;
      } else {
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
        this.driftAngle *= 0.9;
        this.isHonking = false;
      }
      this.position.x += this.velocity.x * deltaTime;
      this.position.y += this.velocity.y * deltaTime;
      const margin = 40;
      this.position.x = Math.max(margin, Math.min(800 - margin, this.position.x));
      this.position.y = Math.max(margin, Math.min(600 - margin, this.position.y));
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
        if (this.hitCooldowns.has(enemy.id))
          continue;
        const dx = enemy.position.x - this.position.x;
        const dy = enemy.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = this.size + (enemy.size || 15);
        if (dist < hitRadius) {
          enemy.health -= this.damage;
          this.hitCooldowns.set(enemy.id, TESLA_STATS.hitCooldown);
          this.lastHitTime = 0.2;
          hitEntities.push(enemy);
          const isTower = "towerType" in enemy;
          if (!isTower && enemy.health > 0 && "position" in enemy) {
            const pushStrength = 50;
            enemy.position.x += dx / dist * pushStrength;
            enemy.position.y += dy / dist * pushStrength;
          }
        }
      }
      return hitEntities;
    }
    findTarget(enemies) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        if (!enemy.isAlive)
          continue;
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
    takeDamage(amount) {
      this.health -= amount;
    }
    findNearestMiniPekka(units) {
      let nearest = null;
      let nearestDist = Infinity;
      for (const unit of units) {
        if (!unit.isAlive)
          continue;
        if (unit.unitType !== "minipekka")
          continue;
        if (unit.isBeingCarried)
          continue;
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
    tryPickupMiniPekkas(allUnits) {
      for (const unit of allUnits) {
        if (this.carriedUnits.length >= 100)
          break;
        if (!unit.isAlive)
          continue;
        if (unit.unitType !== "minipekka")
          continue;
        if (unit.isBeingCarried)
          continue;
        const dx = unit.position.x - this.position.x;
        const dy = unit.position.y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.size + 30) {
          this.carriedUnits.push(unit);
          unit.isBeingCarried = true;
        }
      }
    }
    dropSomeUnits(count) {
      const toDrop = Math.min(count, this.carriedUnits.length);
      for (let i = 0; i < toDrop; i++) {
        const unit = this.carriedUnits[i];
        const angle = i / toDrop * Math.PI * 2 + Math.random() * 0.5;
        const radius = 40 + Math.random() * 30;
        unit.position.x = this.position.x + Math.cos(angle) * radius;
        unit.position.y = this.position.y + Math.sin(angle) * radius;
        unit.isBeingCarried = false;
      }
      this.carriedUnits = this.carriedUnits.slice(toDrop);
      return toDrop;
    }
    dropAllUnits() {
      for (let i = 0; i < this.carriedUnits.length; i++) {
        const unit = this.carriedUnits[i];
        const angle = i / this.carriedUnits.length * Math.PI * 2;
        const radius = 50 + Math.floor(i / 10) * 20;
        unit.position.x = this.position.x + Math.cos(angle) * radius;
        unit.position.y = this.position.y + Math.sin(angle) * radius;
        unit.isBeingCarried = false;
      }
      this.carriedUnits = [];
    }
    // Called when Tesla dies - drop all carried units
    dropOnDeath() {
      this.dropAllUnits();
    }
    // Get count for display
    get carriedCount() {
      return this.carriedUnits.length;
    }
    // Freeze the Tesla!
    freeze(duration) {
      this.freezeTime = duration;
      this.isFrozen = true;
    }
    // Explode! Drop all Mini Pekkas immediately
    explode() {
      this.dropAllUnits();
      this.health = 0;
    }
  };
  function getTeslaCost() {
    return TESLA_STATS.cost;
  }

  // src/spell.ts
  var SPELL_CONFIGS = {
    rage: {
      type: "rage",
      cost: 1,
      radius: 100,
      duration: 5,
      speedBoost: 1.5,
      // 50% faster movement
      attackSpeedBoost: 1.4
      // 40% faster attacks
    },
    fireball: {
      type: "fireball",
      cost: 3,
      radius: 80,
      duration: 0.5,
      // Just for the visual effect
      damage: 500
    },
    freeze: {
      type: "freeze",
      cost: 3,
      radius: 80,
      duration: 4
    },
    poison: {
      type: "poison",
      cost: 3,
      radius: 100,
      duration: 8,
      damagePerSecond: 50,
      slowAmount: 0.7
      // 30% slow
    }
  };
  var Spell = class {
    constructor(position, team, spellType) {
      this.isActive = true;
      this.hasAppliedInstantEffect = false;
      this.affectedEntities = /* @__PURE__ */ new Set();
      // Track original stats for restoration
      this.originalStats = /* @__PURE__ */ new Map();
      this.position = { ...position };
      this.team = team;
      this.config = { ...SPELL_CONFIGS[spellType] };
      this.timeRemaining = this.config.duration;
    }
    update(deltaTime, friendlyUnits, enemyUnits, friendlyTowers, enemyTowers) {
      if (!this.isActive)
        return;
      this.timeRemaining -= deltaTime;
      switch (this.config.type) {
        case "rage":
          this.applyRage(friendlyUnits);
          break;
        case "fireball":
          if (!this.hasAppliedInstantEffect) {
            this.applyFireball(enemyUnits, enemyTowers);
            this.hasAppliedInstantEffect = true;
          }
          break;
        case "freeze":
          this.applyFreeze(enemyUnits, enemyTowers);
          break;
        case "poison":
          this.applyPoison(deltaTime, enemyUnits, enemyTowers);
          break;
      }
      if (this.timeRemaining <= 0) {
        this.expire(friendlyUnits, enemyUnits);
        this.isActive = false;
      }
    }
    isInRadius(entity) {
      const dx = entity.position.x - this.position.x;
      const dy = entity.position.y - this.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.config.radius;
    }
    applyRage(friendlyUnits) {
      for (const unit of friendlyUnits) {
        if (!unit.isAlive)
          continue;
        if (unit.isBeingCarried)
          continue;
        if (this.isInRadius(unit)) {
          if (!this.affectedEntities.has(unit.id)) {
            this.originalStats.set(unit.id, {
              moveSpeed: unit.moveSpeed,
              attackSpeed: unit.attackSpeed
            });
            this.affectedEntities.add(unit.id);
          }
          const original = this.originalStats.get(unit.id);
          unit.moveSpeed = original.moveSpeed * (this.config.speedBoost || 1);
          unit.attackSpeed = original.attackSpeed * (this.config.attackSpeedBoost || 1);
        } else if (this.affectedEntities.has(unit.id)) {
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
    applyFireball(enemyUnits, enemyTowers) {
      const damage = this.config.damage || 0;
      for (const unit of enemyUnits) {
        if (!unit.isAlive)
          continue;
        if (unit.isBeingCarried)
          continue;
        if (this.isInRadius(unit)) {
          unit.health -= damage;
        }
      }
      for (const tower of enemyTowers) {
        if (!tower.isAlive)
          continue;
        if (this.isInRadius(tower)) {
          tower.health -= damage;
        }
      }
    }
    applyFreeze(enemyUnits, enemyTowers) {
      for (const unit of enemyUnits) {
        if (!unit.isAlive)
          continue;
        if (unit.isBeingCarried)
          continue;
        if (this.isInRadius(unit)) {
          if (!this.affectedEntities.has(unit.id)) {
            this.originalStats.set(unit.id, {
              moveSpeed: unit.moveSpeed,
              attackSpeed: unit.attackSpeed
            });
            this.affectedEntities.add(unit.id);
          }
          unit.moveSpeed = 0;
          unit.attackSpeed = 1e-3;
        }
      }
      for (const tower of enemyTowers) {
        if (!tower.isAlive)
          continue;
        if (this.isInRadius(tower)) {
          if (!this.affectedEntities.has(tower.id)) {
            this.originalStats.set(tower.id, {
              moveSpeed: 0,
              attackSpeed: tower.attackSpeed
            });
            this.affectedEntities.add(tower.id);
          }
          tower.attackSpeed = 1e-3;
        }
      }
    }
    applyPoison(deltaTime, enemyUnits, enemyTowers) {
      const dps = this.config.damagePerSecond || 0;
      const damage = dps * deltaTime;
      const slow = this.config.slowAmount || 1;
      for (const unit of enemyUnits) {
        if (!unit.isAlive)
          continue;
        if (unit.isBeingCarried)
          continue;
        if (this.isInRadius(unit)) {
          unit.health -= damage;
          if (!this.affectedEntities.has(unit.id)) {
            this.originalStats.set(unit.id, {
              moveSpeed: unit.moveSpeed,
              attackSpeed: unit.attackSpeed
            });
            this.affectedEntities.add(unit.id);
          }
          const original = this.originalStats.get(unit.id);
          unit.moveSpeed = original.moveSpeed * slow;
        } else if (this.affectedEntities.has(unit.id)) {
          const original = this.originalStats.get(unit.id);
          if (original) {
            unit.moveSpeed = original.moveSpeed;
          }
          this.affectedEntities.delete(unit.id);
          this.originalStats.delete(unit.id);
        }
      }
      for (const tower of enemyTowers) {
        if (!tower.isAlive)
          continue;
        if (this.isInRadius(tower)) {
          tower.health -= damage;
        }
      }
    }
    expire(friendlyUnits, enemyUnits) {
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
  };
  function getSpellCost(spellType) {
    return SPELL_CONFIGS[spellType].cost;
  }
  function findBestSpellTarget(team, spellType, friendlyUnits, enemyUnits, enemyTowers) {
    const config = SPELL_CONFIGS[spellType];
    if (spellType === "rage") {
      if (friendlyUnits.length === 0)
        return null;
      let sumX = 0, sumY = 0, count = 0;
      for (const unit of friendlyUnits) {
        if (unit.isAlive) {
          sumX += unit.position.x;
          sumY += unit.position.y;
          count++;
        }
      }
      if (count === 0)
        return null;
      return { x: sumX / count, y: sumY / count };
    }
    const targets = [...enemyUnits.filter((u) => u.isAlive), ...enemyTowers.filter((t) => t.isAlive)];
    if (targets.length === 0)
      return null;
    let bestPos = null;
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

  // src/audio.ts
  var audioContext = null;
  var wilhelmAudio = null;
  var audioInitialized = false;
  function getAudioContext() {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  }
  function initAudio() {
    wilhelmAudio = new Audio();
    wilhelmAudio.src = "https://ia800208.us.archive.org/2/items/WilhelmScreamSample/WilhelmScream.mp3";
    wilhelmAudio.volume = 0.7;
    wilhelmAudio.load();
    const resumeAudio = () => {
      if (audioInitialized)
        return;
      audioInitialized = true;
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      console.log("Audio initialized, context state:", ctx.state);
    };
    document.addEventListener("click", resumeAudio);
    document.addEventListener("keydown", resumeAudio);
    document.addEventListener("mousedown", resumeAudio);
  }
  function playTone(frequency, duration, type = "sine", volume = 0.3, attack = 0.01, decay = 0.1) {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + attack + decay);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }
  function playNoise(duration, volume = 0.2, highpass = 0, lowpass = 22e3) {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    const highpassFilter = ctx.createBiquadFilter();
    highpassFilter.type = "highpass";
    highpassFilter.frequency.value = highpass;
    const lowpassFilter = ctx.createBiquadFilter();
    lowpassFilter.type = "lowpass";
    lowpassFilter.frequency.value = lowpass;
    source.connect(highpassFilter);
    highpassFilter.connect(lowpassFilter);
    lowpassFilter.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
  }
  function playSpawnSound() {
    playTone(200, 0.15, "sine", 0.2);
    setTimeout(() => playTone(400, 0.1, "sine", 0.15), 50);
  }
  function playSwordHit() {
    playTone(800, 0.08, "square", 0.15);
    playNoise(0.05, 0.1, 2e3, 8e3);
  }
  function playHeavyHit() {
    playTone(150, 0.15, "sawtooth", 0.25);
    playNoise(0.1, 0.15, 500, 4e3);
    setTimeout(() => playTone(100, 0.1, "sine", 0.2), 30);
  }
  function playArrowShoot() {
    playTone(600, 0.05, "triangle", 0.15);
    playTone(400, 0.08, "sine", 0.1);
  }
  function playMagicHit() {
    playTone(800, 0.1, "sine", 0.15);
    playTone(1200, 0.08, "sine", 0.1);
    playTone(600, 0.12, "triangle", 0.1);
  }
  function playTowerShoot() {
    playTone(120, 0.2, "sawtooth", 0.2);
    playNoise(0.08, 0.15, 100, 2e3);
  }
  function playDrowningScream() {
    if (wilhelmAudio && wilhelmAudio.readyState >= 2) {
      wilhelmAudio.currentTime = 0;
      wilhelmAudio.play().catch(() => {
        playProceduralScream();
      });
      setTimeout(() => playNoise(0.3, 0.3, 200, 4e3), 800);
      return;
    }
    playProceduralScream();
  }
  function playProceduralScream() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const now = ctx.currentTime;
    const duration = 1.1;
    const oscillators = [];
    const gains = [];
    const fundamentalFreqs = [1, 2, 3, 4];
    const fundamentalAmps = [1, 0.5, 0.25, 0.125];
    fundamentalFreqs.forEach((harmonic, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      const baseFreq = 180 * harmonic;
      osc.frequency.setValueAtTime(baseFreq * 4, now);
      osc.frequency.linearRampToValueAtTime(baseFreq * 6, now + 0.15);
      osc.frequency.linearRampToValueAtTime(baseFreq * 5.5, now + 0.4);
      osc.frequency.linearRampToValueAtTime(baseFreq * 3, now + 0.8);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + duration);
      const amp = fundamentalAmps[i] * 0.15;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.05);
      gain.gain.linearRampToValueAtTime(amp * 1.5, now + 0.15);
      gain.gain.linearRampToValueAtTime(amp, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      oscillators.push(osc);
      gains.push(gain);
    });
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 6;
    vibratoGain.gain.setValueAtTime(0, now);
    vibratoGain.gain.linearRampToValueAtTime(30, now + 0.3);
    vibratoGain.gain.linearRampToValueAtTime(50, now + duration);
    vibrato.connect(vibratoGain);
    oscillators.forEach((osc) => {
      vibratoGain.connect(osc.frequency);
    });
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.02, now);
    noiseGain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 2e3;
    noiseFilter.Q.value = 1;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    vibrato.start(now);
    noiseSource.start(now);
    oscillators.forEach((osc) => osc.start(now));
    vibrato.stop(now + duration);
    noiseSource.stop(now + duration);
    oscillators.forEach((osc) => osc.stop(now + duration));
    setTimeout(() => {
      playNoise(0.3, 0.3, 200, 4e3);
    }, 800);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const bubbleFreq = 200 + Math.random() * 300;
        playTone(bubbleFreq, 0.1, "sine", 0.15);
      }, 900 + i * 100);
    }
  }
  function playFireball() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    playNoise(0.3, 0.25, 200, 4e3);
  }
  function playFreeze() {
    playTone(2e3, 0.3, "sine", 0.15, 0.01, 0.05);
    playTone(2500, 0.25, "sine", 0.1, 0.05, 0.05);
    playTone(1800, 0.35, "triangle", 0.1, 0.1, 0.1);
    setTimeout(() => playNoise(0.15, 0.1, 4e3, 12e3), 100);
  }
  function playPoison() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const freq = 150 + Math.random() * 200;
        playTone(freq, 0.1, "sine", 0.15);
      }, i * 60);
    }
    playNoise(0.4, 0.1, 3e3, 8e3);
  }
  function playRage() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    playTone(80, 0.4, "sine", 0.2);
  }
  function playKnockback() {
    playTone(80, 0.15, "sine", 0.3);
    playTone(60, 0.2, "triangle", 0.2);
    playNoise(0.1, 0.15, 100, 1e3);
  }
  function playMegaKnightJump() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const whoosh = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    whoosh.type = "sawtooth";
    whoosh.frequency.setValueAtTime(100, ctx.currentTime);
    whoosh.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.2);
    whooshGain.gain.setValueAtTime(0.1, ctx.currentTime);
    whooshGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    whoosh.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whoosh.start();
    whoosh.stop(ctx.currentTime + 0.2);
    setTimeout(() => {
      playTone(40, 0.4, "sine", 0.5);
      playTone(60, 0.3, "triangle", 0.4);
      playTone(80, 0.2, "sawtooth", 0.3);
      playNoise(0.3, 0.4, 50, 2e3);
    }, 300);
  }
  function playTowerDestroyed() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    playNoise(0.5, 0.3, 100, 3e3);
    setTimeout(() => playNoise(0.3, 0.2, 200, 2e3), 200);
  }
  function playVictory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playTone(freq, 0.4, "triangle", 0.2);
      }, i * 150);
    });
  }
  function playDefeat() {
    const notes = [400, 380, 360, 300];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playTone(freq, 0.3, "sawtooth", 0.15);
      }, i * 200);
    });
  }
  function playTeslaSpawn() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    const hum = ctx.createOscillator();
    const humGain = ctx.createGain();
    hum.type = "sawtooth";
    hum.frequency.value = 60;
    humGain.gain.setValueAtTime(0.05, ctx.currentTime);
    humGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    hum.connect(humGain);
    humGain.connect(ctx.destination);
    hum.start();
    hum.stop(ctx.currentTime + 0.3);
  }
  function playTeslaHit() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    playNoise(0.1, 0.3, 200, 3e3);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1e3, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    playTone(80, 0.15, "sine", 0.25);
  }
  function playSurgeShot() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    playNoise(0.05, 0.1, 3e3, 6e3);
  }
  function playSurgeUpgrade() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const notes = [400, 600, 800, 1e3];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        playTone(freq, 0.15, "square", 0.2);
      }, i * 80);
    });
    setTimeout(() => {
      playNoise(0.15, 0.2, 2e3, 1e4);
    }, 250);
  }
  function playPekkaDrop() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => {
      playTone(80, 0.1, "sine", 0.15);
    }, 100);
  }
  function playSurgeVoice() {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance("Did somebody call for SURGE?");
      utterance.rate = 1.1;
      utterance.pitch = 0.8;
      utterance.volume = 1;
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("daniel") || v.name.toLowerCase().includes("alex") || v.name.toLowerCase().includes("google")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      speechSynthesis.speak(utterance);
    }
    setTimeout(() => {
      playTone(600, 0.1, "square", 0.15);
      playNoise(0.08, 0.12, 3e3, 8e3);
    }, 100);
  }
  function playLilyShot() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    playNoise(0.05, 0.08, 2e3, 5e3);
  }
  function playLilyDash() {
    const ctx = getAudioContext();
    if (ctx.state === "suspended")
      return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
    filter.type = "highpass";
    filter.frequency.value = 300;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    playNoise(0.1, 0.15, 4e3, 1e4);
  }
  function playLilyVoice() {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance("Thorn in your side!");
      utterance.rate = 1.2;
      utterance.pitch = 1.4;
      utterance.volume = 1;
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("victoria") || v.name.toLowerCase().includes("karen") || v.name.toLowerCase().includes("google") && v.name.toLowerCase().includes("female")
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      speechSynthesis.speak(utterance);
    }
    setTimeout(() => {
      playTone(500, 0.08, "triangle", 0.12);
      playTone(700, 0.08, "triangle", 0.1);
    }, 50);
  }

  // src/game.ts
  var MAX_ELIXIR = 10;
  var ELIXIR_REGEN_RATE = 0.5;
  var CARD_COSTS = {
    knight: getKnightCost(),
    minipekka: getMiniPekkaCost(),
    magicarcher: getMagicArcherCost(),
    goldknight: getGoldKnightCost(),
    megaknight: getMegaKnightCost(),
    surge: getSurgeCost(),
    lily: getLilyCost(),
    tesla: getTeslaCost(),
    // Spells are HALF PRICE because they hit both teams!
    rage: Math.floor(getSpellCost("rage") / 2) || 1,
    fireball: Math.floor(getSpellCost("fireball") / 2) || 1,
    freeze: Math.floor(getSpellCost("freeze") / 2) || 1,
    poison: Math.floor(getSpellCost("poison") / 2) || 1
  };
  var SPELL_TYPES = ["rage", "fireball", "freeze", "poison"];
  var BUILDING_TYPES = ["tesla"];
  function isSpell(card) {
    return SPELL_TYPES.includes(card);
  }
  function isBuilding(card) {
    return BUILDING_TYPES.includes(card);
  }
  var Game = class {
    constructor(canvas) {
      this.lastTime = 0;
      this.gameTime = 0;
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
      this.paused = false;
      this.enemySpawnTimer = 0;
      this.enemySpellTimer = 5;
      this.selectedCard = "minipekka";
      this.elixirMultiplier = 1;
      // Drag targeting for spells
      this.isDragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
      this.canvas = canvas;
      this.renderer = new Renderer(canvas);
      this.setupTowers();
      this.setupEventListeners();
      this.setupCardSelection();
    }
    setupTowers() {
      for (const towerPos of TOWER_POSITIONS.player) {
        const tower = new Tower(towerPos.position, "player", towerPos.type);
        tower.onAttack = () => playTowerShoot();
        this.playerTowers.push(tower);
      }
      for (const towerPos of TOWER_POSITIONS.enemy) {
        const tower = new Tower(towerPos.position, "enemy", towerPos.type);
        tower.onAttack = () => playTowerShoot();
        this.enemyTowers.push(tower);
      }
    }
    setupEventListeners() {
      this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
      this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
      this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
      this.canvas.addEventListener("mouseleave", () => this.cancelDrag());
      document.addEventListener("keydown", (e) => {
        const keyMap = {
          "2": "minipekka",
          "3": "magicarcher",
          "4": "goldknight",
          "5": "megaknight",
          "6": "rage",
          "7": "fireball",
          "8": "freeze",
          "9": "poison",
          "0": "tesla",
          "-": "surge",
          "=": "lily"
        };
        if (keyMap[e.key]) {
          this.selectCard(keyMap[e.key]);
        }
        if (e.key.toLowerCase() === "w") {
          this.unleashChaos();
        }
        if (e.key.toLowerCase() === "l") {
          this.unleashHorde();
        }
        if (e.key.toLowerCase() === "k") {
          this.megaKnightAssault();
        }
        if (e.shiftKey) {
          if (e.key === "!" || e.key === "1")
            this.setElixirMultiplier(0.5);
          if (e.key === "@" || e.key === "2")
            this.setElixirMultiplier(2);
          if (e.key === "#" || e.key === "3")
            this.setElixirMultiplier(3);
          if (e.key === "%" || e.key === "5")
            this.setElixirMultiplier(5);
        }
        if (e.key.toLowerCase() === "s") {
          this.suddenDeath();
        }
        if (e.key.toLowerCase() === "p") {
          this.togglePause();
        }
        if (e.key.toLowerCase() === "m") {
          this.spawnMiniPekkaSwarm();
        }
        if (e.key.toLowerCase() === "t") {
          this.spawnLoadedTesla();
        }
        if (e.key.toLowerCase() === "n") {
          this.spawnEnemyMiniPekkas();
        }
        if (e.key.toLowerCase() === "c") {
          this.spawnSurge();
        }
      });
    }
    setupCardSelection() {
      const cards = document.querySelectorAll(".card");
      cards.forEach((card) => {
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const cardType = card.getAttribute("data-card");
          if (cardType) {
            this.selectCard(cardType);
          }
        });
      });
    }
    selectCard(cardType) {
      this.selectedCard = cardType;
      this.cancelDrag();
      const cards = document.querySelectorAll(".card");
      cards.forEach((card) => {
        card.classList.remove("selected");
        if (card.getAttribute("data-card") === cardType) {
          card.classList.add("selected");
        }
      });
    }
    getMousePos(event) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
    handleMouseDown(event) {
      if (this.gameOver) {
        this.restart();
        return;
      }
      const pos = this.getMousePos(event);
      if (isSpell(this.selectedCard)) {
        this.isDragging = true;
        this.dragStart = pos;
        this.dragCurrent = pos;
      } else if (isBuilding(this.selectedCard)) {
        if (isInPlayerZone(pos.y)) {
          this.trySpawnBuilding(pos.x, pos.y, this.selectedCard);
        }
      } else {
        if (isInPlayerZone(pos.y) && pos.y >= ARENA.playerSpawnMinY && pos.y <= ARENA.playerSpawnMaxY) {
          this.trySpawnUnit(pos.x, pos.y, this.selectedCard);
        }
      }
    }
    handleMouseMove(event) {
      if (this.isDragging) {
        this.dragCurrent = this.getMousePos(event);
      }
    }
    handleMouseUp(event) {
      if (this.isDragging && this.dragCurrent) {
        this.tryCastSpell(this.selectedCard, this.dragCurrent);
      }
      this.cancelDrag();
    }
    cancelDrag() {
      this.isDragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
    }
    setupUnitAttackSound(unit) {
      unit.onAttack = (attacker) => {
        if (attacker.unitType === "magicarcher")
          return;
        if (attacker.unitType === "minipekka" || attacker.unitType === "goldknight") {
          playHeavyHit();
        } else {
          playSwordHit();
        }
      };
    }
    countSurges(team) {
      const units = team === "player" ? this.playerUnits : this.enemyUnits;
      return units.filter((u) => u.isSurge && u.isAlive).length;
    }
    countLilys(team) {
      const units = team === "player" ? this.playerUnits : this.enemyUnits;
      return units.filter((u) => u.isLily && u.isAlive).length;
    }
    trySpawnUnit(x, y, unitType) {
      if (unitType === "surge" && this.countSurges("player") >= 2) {
        console.log("Max 2 Surges per team!");
        return;
      }
      if (unitType === "lily" && this.countLilys("player") >= 2) {
        console.log("Max 2 Lilys per team!");
        return;
      }
      const cost = CARD_COSTS[unitType];
      if (this.elixir >= cost) {
        this.elixir -= cost;
        let unit;
        switch (unitType) {
          case "minipekka":
            unit = new MiniPekka({ x, y }, "player");
            break;
          case "magicarcher":
            unit = new MagicArcher({ x, y }, "player");
            break;
          case "goldknight":
            unit = new GoldKnight({ x, y }, "player");
            break;
          case "megaknight":
            unit = new MegaKnight({ x, y }, "player");
            break;
          case "surge":
            const surge = new Surge({ x, y }, "player");
            surge.onAttack = () => playSurgeShot();
            surge.onUpgrade = () => playSurgeUpgrade();
            unit = surge;
            playSurgeVoice();
            this.speechBubbles.push({ x, y: y - 50, text: "Did somebody call for SURGE?", life: 2.5 });
            break;
          case "lily":
            const lily = new Lily({ x, y }, "player");
            lily.onAttack = () => playLilyShot();
            lily.onSuperUse = () => playLilyDash();
            unit = lily;
            playLilyVoice();
            this.speechBubbles.push({ x, y: y - 50, text: "Thorn in your side!", life: 2.5 });
            break;
          case "knight":
          default:
            unit = new Knight({ x, y }, "player");
            break;
        }
        this.setupUnitAttackSound(unit);
        this.playerUnits.push(unit);
        if (unitType !== "surge" && unitType !== "lily") {
          playSpawnSound();
        }
      }
    }
    trySpawnBuilding(x, y, buildingType) {
      const cost = CARD_COSTS[buildingType];
      if (this.elixir >= cost) {
        this.elixir -= cost;
        switch (buildingType) {
          case "tesla":
            const tesla = new Tesla({ x, y }, "player");
            this.playerTeslas.push(tesla);
            playTeslaSpawn();
            break;
        }
      }
    }
    // THE WIN BUTTON - Spawns 50 Gold Knights!
    unleashChaos() {
      console.log("UNLEASHING CHAOS!!! \u{1F525}\u{1F451}\u{1F525}");
      playVictory();
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          const x = 100 + Math.random() * (ARENA.width - 200);
          const y = ARENA.playerSpawnMinY + Math.random() * (ARENA.playerSpawnMaxY - ARENA.playerSpawnMinY);
          const unit = new GoldKnight({ x, y }, "player");
          this.setupUnitAttackSound(unit);
          this.playerUnits.push(unit);
          if (i % 10 === 0)
            playSpawnSound();
        }, i * 50);
      }
    }
    // THE HORDE - Spawns 100 enemy knights! Good luck!
    unleashHorde() {
      console.log("THE HORDE IS COMING!!! \u2694\uFE0F\u{1F480}\u2694\uFE0F");
      playDefeat();
      for (let i = 0; i < 100; i++) {
        setTimeout(() => {
          const x = 100 + Math.random() * (ARENA.width - 200);
          const y = 30 + Math.random() * 100;
          const unit = new Knight({ x, y }, "enemy");
          this.setupUnitAttackSound(unit);
          this.enemyUnits.push(unit);
          if (i % 15 === 0)
            playSpawnSound();
        }, i * 30);
      }
    }
    // MEGA KNIGHT ASSAULT - Teleport to enemy king + bridge chaos!
    megaKnightAssault() {
      console.log("MEGA KNIGHT ASSAULT!!! \u2694\uFE0F\u{1F4A5}\u2694\uFE0F");
      playMegaKnightJump();
      const enemyKing = this.enemyTowers[0];
      const kingX = enemyKing.position.x;
      const kingY = enemyKing.position.y + 60;
      for (const unit of this.playerUnits) {
        if (unit.unitType === "megaknight") {
          unit.position.x = kingX + (Math.random() - 0.5) * 80;
          unit.position.y = kingY + (Math.random() - 0.5) * 40;
        }
      }
      const bridgeY = ARENA.riverY + ARENA.riverHeight / 2;
      const bridges = [
        ARENA.bridgeLeft.x + ARENA.bridgeLeft.width / 2,
        ARENA.bridgeRight.x + ARENA.bridgeRight.width / 2
      ];
      for (let i = 0; i < 5; i++) {
        const bridgeX = bridges[i % 2];
        const unit = new MegaKnight(
          { x: bridgeX + (Math.random() - 0.5) * 40, y: bridgeY + 50 },
          "player"
        );
        this.setupUnitAttackSound(unit);
        this.playerUnits.push(unit);
      }
      for (let i = 0; i < 12; i++) {
        const bridgeX = bridges[i % 2];
        const unit = new Knight(
          { x: bridgeX + (Math.random() - 0.5) * 60, y: bridgeY - 30 },
          "enemy"
        );
        this.setupUnitAttackSound(unit);
        this.enemyUnits.push(unit);
      }
      playSpawnSound();
    }
    // Set elixir regen multiplier
    setElixirMultiplier(multiplier) {
      this.elixirMultiplier = multiplier;
      console.log(`ELIXIR BOOST: ${multiplier}x! \u{1F4A7}\u26A1`);
      playRage();
    }
    // SUDDEN DEATH - All towers to 1 HP!
    suddenDeath() {
      console.log("\u26A0\uFE0F SUDDEN DEATH! \u26A0\uFE0F");
      for (const tower of this.playerTowers) {
        if (tower.isAlive)
          tower.health = 1;
      }
      for (const tower of this.enemyTowers) {
        if (tower.isAlive)
          tower.health = 1;
      }
      playTowerDestroyed();
    }
    // PAUSE - Toggle pause
    togglePause() {
      this.paused = !this.paused;
      console.log(this.paused ? "\u23F8\uFE0F PAUSED" : "\u25B6\uFE0F RESUMED");
    }
    // MINI PEKKA SWARM - Spawn 12 Mini Pekkas!
    spawnMiniPekkaSwarm() {
      console.log("\u{1F916} MINI PEKKA SWARM! \u{1F916}");
      playSpawnSound();
      for (let i = 0; i < 12; i++) {
        const x = 100 + Math.random() * (ARENA.width - 200);
        const y = ARENA.playerSpawnMinY + Math.random() * (ARENA.playerSpawnMaxY - ARENA.playerSpawnMinY);
        const unit = new MiniPekka({ x, y }, "player");
        this.setupUnitAttackSound(unit);
        this.playerUnits.push(unit);
      }
    }
    // ENEMY MINI PEKKAS - Spawn 25 enemy Mini Pekkas!
    spawnEnemyMiniPekkas() {
      console.log("\u{1F916} ENEMY MINI PEKKA SWARM! \u{1F916}");
      playSpawnSound();
      for (let i = 0; i < 25; i++) {
        const x = 100 + Math.random() * (ARENA.width - 200);
        const y = 30 + Math.random() * 100;
        const unit = new MiniPekka({ x, y }, "enemy");
        this.setupUnitAttackSound(unit);
        this.enemyUnits.push(unit);
      }
    }
    // SURGE - Spawn Surge from Brawl Stars!
    spawnSurge() {
      if (this.countSurges("player") >= 2) {
        console.log("Max 2 Surges per team!");
        return;
      }
      console.log("\u26A1 SURGE HAS ENTERED THE ARENA! \u26A1");
      playSurgeVoice();
      const x = ARENA.width / 2;
      const y = ARENA.playerSpawnMaxY;
      const surge = new Surge({ x, y }, "player");
      surge.onAttack = () => playSurgeShot();
      surge.onUpgrade = () => playSurgeUpgrade();
      this.playerUnits.push(surge);
      this.speechBubbles.push({ x, y: y - 50, text: "Did somebody call for SURGE?", life: 2.5 });
    }
    // LOADED TESLA - Teleport ALL Mini Pekkas into Tesla + spawn 75 more!
    spawnLoadedTesla() {
      const teslaX = ARENA.width / 2;
      const teslaY = ARENA.playerSpawnMaxY;
      const tesla = new Tesla({ x: teslaX, y: teslaY }, "player");
      const allUnits = [...this.playerUnits, ...this.enemyUnits];
      let kidnapped = 0;
      for (const unit of allUnits) {
        if (unit.unitType === "minipekka" && unit.isAlive && !unit.isBeingCarried) {
          if (tesla.carriedUnits.length >= 100)
            break;
          unit.isBeingCarried = true;
          tesla.carriedUnits.push(unit);
          kidnapped++;
        }
      }
      const toSpawn = Math.min(75, 100 - tesla.carriedUnits.length);
      for (let i = 0; i < toSpawn; i++) {
        const unit = new MiniPekka({ x: teslaX, y: teslaY }, "player");
        this.setupUnitAttackSound(unit);
        unit.isBeingCarried = true;
        tesla.carriedUnits.push(unit);
        this.playerUnits.push(unit);
      }
      console.log(`\u{1F697}\u{1F916} LOADED TESLA! Kidnapped ${kidnapped} + spawned ${toSpawn} = ${tesla.carriedUnits.length} Mini Pekkas! \u{1F697}`);
      playTeslaSpawn();
      this.playerTeslas.push(tesla);
    }
    tryCastSpell(spellType, position) {
      const cost = CARD_COSTS[spellType];
      if (this.elixir >= cost) {
        this.elixir -= cost;
        this.spells.push(new Spell(position, "player", spellType));
        switch (spellType) {
          case "fireball":
            playFireball();
            break;
          case "freeze":
            playFreeze();
            break;
          case "poison":
            playPoison();
            break;
          case "rage":
            playRage();
            break;
        }
      }
    }
    spawnEnemyUnit() {
      const roll = Math.random();
      if (roll < 0.1) {
        const cost2 = CARD_COSTS["tesla"];
        if (this.enemyElixir >= cost2) {
          this.enemyElixir -= cost2;
          const x = 100 + Math.random() * (ARENA.width - 200);
          const y = 50 + Math.random() * 80;
          const tesla = new Tesla({ x, y }, "enemy");
          this.enemyTeslas.push(tesla);
          playTeslaSpawn();
        }
        return;
      }
      let unitType;
      if (roll < 0.3) {
        unitType = "knight";
      } else if (roll < 0.45) {
        unitType = "minipekka";
      } else if (roll < 0.55) {
        unitType = "magicarcher";
      } else if (roll < 0.65) {
        unitType = "goldknight";
      } else if (roll < 0.75) {
        unitType = "megaknight";
      } else if (roll < 0.875) {
        if (this.countSurges("enemy") >= 2) {
          unitType = "knight";
        } else {
          unitType = "surge";
        }
      } else {
        if (this.countLilys("enemy") >= 2) {
          unitType = "knight";
        } else {
          unitType = "lily";
        }
      }
      const cost = CARD_COSTS[unitType];
      if (this.enemyElixir >= cost) {
        this.enemyElixir -= cost;
        const x = 100 + Math.random() * (ARENA.width - 200);
        const y = 50 + Math.random() * 80;
        let unit;
        switch (unitType) {
          case "minipekka":
            unit = new MiniPekka({ x, y }, "enemy");
            break;
          case "magicarcher":
            unit = new MagicArcher({ x, y }, "enemy");
            break;
          case "goldknight":
            unit = new GoldKnight({ x, y }, "enemy");
            break;
          case "megaknight":
            unit = new MegaKnight({ x, y }, "enemy");
            break;
          case "surge":
            const surge = new Surge({ x, y }, "enemy");
            surge.onAttack = () => playSurgeShot();
            surge.onUpgrade = () => playSurgeUpgrade();
            unit = surge;
            playSurgeVoice();
            this.speechBubbles.push({ x, y: y - 50, text: "Did somebody call for SURGE?", life: 2.5 });
            break;
          case "lily":
            const lily = new Lily({ x, y }, "enemy");
            lily.onAttack = () => playLilyShot();
            lily.onSuperUse = () => playLilyDash();
            unit = lily;
            playLilyVoice();
            this.speechBubbles.push({ x, y: y - 50, text: "Thorn in your side!", life: 2.5 });
            break;
          default:
            unit = new Knight({ x, y }, "enemy");
            break;
        }
        this.setupUnitAttackSound(unit);
        this.enemyUnits.push(unit);
      }
    }
    enemyCastSpell() {
      const spellTypes = ["rage", "fireball", "freeze", "poison"];
      const spellType = spellTypes[Math.floor(Math.random() * spellTypes.length)];
      const cost = CARD_COSTS[spellType];
      if (this.enemyElixir >= cost) {
        const target = findBestSpellTarget(
          "enemy",
          spellType,
          this.enemyUnits,
          this.playerUnits,
          this.playerTowers
        );
        if (target) {
          this.enemyElixir -= cost;
          this.spells.push(new Spell(target, "enemy", spellType));
          switch (spellType) {
            case "fireball":
              playFireball();
              break;
            case "freeze":
              playFreeze();
              break;
            case "poison":
              playPoison();
              break;
            case "rage":
              playRage();
              break;
          }
        }
      }
    }
    async start() {
      initAudio();
      try {
        const assets = await loadAssets();
        this.renderer.setAssets(assets);
        console.log("Assets loaded successfully!");
      } catch (e) {
        console.warn("Failed to load assets, using fallback graphics:", e);
      }
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.gameLoop(t));
    }
    gameLoop(currentTime) {
      const deltaTime = (currentTime - this.lastTime) / 1e3;
      this.lastTime = currentTime;
      this.gameTime += deltaTime;
      this.update(deltaTime);
      this.render(deltaTime);
      requestAnimationFrame((t) => this.gameLoop(t));
    }
    update(deltaTime) {
      if (this.gameOver || this.paused)
        return;
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
      const playerEnemies = [...this.enemyTowers, ...this.enemyUnits];
      const enemyEnemies = [...this.playerTowers, ...this.playerUnits];
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
      this.checkDrowning(this.playerUnits);
      this.checkDrowning(this.enemyUnits);
      const allUnits = [...this.playerUnits, ...this.enemyUnits];
      for (const tesla of this.playerTeslas) {
        const hits = tesla.update(deltaTime, [...this.enemyUnits, ...this.enemyTowers], this.playerUnits, allUnits);
        for (const hit of hits) {
          playTeslaHit();
        }
        if (tesla.droppedThisFrame > 0) {
          playPekkaDrop();
        }
      }
      for (const tesla of this.enemyTeslas) {
        const hits = tesla.update(deltaTime, [...this.playerUnits, ...this.playerTowers], this.enemyUnits, allUnits);
        for (const hit of hits) {
          playTeslaHit();
        }
        if (tesla.droppedThisFrame > 0) {
          playPekkaDrop();
        }
      }
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
        const enemies = projectile.team === "player" ? [...this.enemyTowers, ...this.enemyUnits] : [...this.playerTowers, ...this.playerUnits];
        const hits = projectile.update(deltaTime, enemies);
        if (hits.length > 0) {
          playMagicHit();
        }
      }
      const allUnitsForSpells = [...this.playerUnits, ...this.enemyUnits];
      const allTowers = [...this.playerTowers, ...this.enemyTowers];
      const allTeslas = [...this.playerTeslas, ...this.enemyTeslas];
      for (const spell of this.spells) {
        spell.update(deltaTime, allUnitsForSpells, allUnitsForSpells, allTowers, allTowers);
        this.handleSpellOnTeslas(spell, allTeslas);
      }
      this.projectiles = this.projectiles.filter((p) => p.isAlive);
      this.spells = this.spells.filter((s) => s.isActive);
      this.playerUnits = this.playerUnits.filter((u) => u.isAlive);
      this.enemyUnits = this.enemyUnits.filter((u) => u.isAlive);
      this.speechBubbles = this.speechBubbles.filter((b) => {
        b.life -= deltaTime;
        b.y -= 10 * deltaTime;
        return b.life > 0;
      });
      this.checkGameOver();
    }
    checkForProjectiles(unit) {
      if (unit.unitType === "magicarcher") {
        const archer = unit;
        const projectile = archer.createProjectile();
        if (projectile) {
          this.projectiles.push(projectile);
          playArrowShoot();
        }
      }
    }
    checkForKnockback(unit, enemies) {
      if (unit.unitType === "goldknight") {
        const goldKnight = unit;
        const knockback = goldKnight.getKnockback();
        if (knockback) {
          for (const enemy of enemies) {
            if (enemy.id === knockback.targetId && enemy.isAlive) {
              const riverY = ARENA.riverY + ARENA.riverHeight / 2;
              const knockbackStrength = knockback.strength;
              const dirY = enemy.position.y < riverY ? 1 : -1;
              enemy.position.y += dirY * knockbackStrength;
              const dx = enemy.position.x - unit.position.x;
              enemy.position.x += Math.sign(dx) * knockbackStrength * 0.3;
              enemy.position.x = Math.max(20, Math.min(ARENA.width - 20, enemy.position.x));
              enemy.position.y = Math.max(20, Math.min(ARENA.height - 20, enemy.position.y));
              playKnockback();
            }
          }
        }
      }
    }
    checkForMegaKnightJump(unit, enemies) {
      if (unit.unitType === "megaknight") {
        const megaKnight = unit;
        const jumpEvent = megaKnight.getJumpEvent();
        if (jumpEvent) {
          for (const enemy of enemies) {
            if (jumpEvent.targets.includes(enemy.id) && enemy.isAlive) {
              enemy.health -= jumpEvent.damage;
            }
          }
          const towers = unit.team === "player" ? this.enemyTowers : this.playerTowers;
          for (const tower of towers) {
            if (!tower.isAlive)
              continue;
            const dx = tower.position.x - jumpEvent.endPos.x;
            const dy = tower.position.y - jumpEvent.endPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= 80) {
              tower.health -= jumpEvent.damage;
            }
          }
          playMegaKnightJump();
          this.renderer.addSplashEffect(jumpEvent.endPos.x, jumpEvent.endPos.y);
        }
      }
    }
    handleSpellOnTeslas(spell, teslas) {
      for (const tesla of teslas) {
        if (!tesla.isAlive)
          continue;
        const dx = tesla.position.x - spell.position.x;
        const dy = tesla.position.y - spell.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= spell.config.radius) {
          switch (spell.config.type) {
            case "fireball":
              if (!spell.hasAppliedInstantEffect || !spell.affectedEntities.has(tesla.id)) {
                tesla.explode();
                playFireball();
                this.renderer.addSplashEffect(tesla.position.x, tesla.position.y);
                spell.affectedEntities.add(tesla.id);
              }
              break;
            case "freeze":
              tesla.freeze(spell.config.duration);
              break;
            case "poison":
              if (spell.config.damagePerSecond) {
                tesla.takeDamage(spell.config.damagePerSecond * 0.016);
              }
              break;
            case "rage":
              break;
          }
        }
      }
    }
    checkDrowning(units) {
      for (const unit of units) {
        if (unit.isBeingCarried)
          continue;
        const inRiver = unit.position.y >= ARENA.riverY && unit.position.y <= ARENA.riverY + ARENA.riverHeight;
        if (inRiver && !isOnBridge(unit.position.x, unit.position.y)) {
          unit.health = 0;
          this.renderer.addSplashEffect(unit.position.x, unit.position.y);
          playDrowningScream();
        }
      }
    }
    updateCardUI() {
      const cards = document.querySelectorAll(".card");
      cards.forEach((card) => {
        const cardType = card.getAttribute("data-card");
        if (cardType && CARD_COSTS[cardType] !== void 0) {
          const canAfford = this.elixir >= CARD_COSTS[cardType];
          card.classList.toggle("disabled", !canAfford);
        }
      });
    }
    checkGameOver() {
      const playerKing = this.playerTowers[0];
      const enemyKing = this.enemyTowers[0];
      if (!enemyKing.isAlive && !this.gameOver) {
        this.gameOver = true;
        this.winner = "player";
        playTowerDestroyed();
        setTimeout(() => playVictory(), 500);
      } else if (!playerKing.isAlive && !this.gameOver) {
        this.gameOver = true;
        this.winner = "enemy";
        playTowerDestroyed();
        setTimeout(() => playDefeat(), 500);
      }
    }
    render(deltaTime) {
      this.renderer.clear();
      this.renderer.drawArena();
      this.renderer.drawSplashEffects(deltaTime);
      for (const spell of this.spells) {
        this.renderer.drawSpell(spell);
      }
      for (const tower of [...this.playerTowers, ...this.enemyTowers]) {
        this.renderer.drawTower(tower);
      }
      for (const unit of [...this.playerUnits, ...this.enemyUnits]) {
        if (unit.isSurge) {
          this.renderer.drawSurge(unit);
        } else if (unit.isLily) {
          this.renderer.drawLily(unit);
        } else {
          this.renderer.drawUnit(unit, this.gameTime);
        }
      }
      for (const tesla of [...this.playerTeslas, ...this.enemyTeslas]) {
        this.renderer.drawTesla(tesla);
      }
      for (const projectile of this.projectiles) {
        this.renderer.drawProjectile(projectile);
      }
      for (const bubble of this.speechBubbles) {
        this.renderer.drawSpeechBubble(bubble);
      }
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
    restart() {
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
  };

  // src/index.ts
  function init() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) {
      console.error("Could not find canvas element");
      return;
    }
    const game = new Game(canvas);
    game.start();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
