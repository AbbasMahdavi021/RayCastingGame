const EPS = 1e-6;
const NEAR_CLIPPING_PLANE = 0.1;
const FAR_CLIPPING_PLANE = 20.0;
const FOV = Math.PI * 0.5;
const SCREEN_FACTOR = 10;
const SCREEN_WIDTH = Math.floor(16 * SCREEN_FACTOR);
const SCREEN_HEIGHT = Math.floor(9 * SCREEN_FACTOR);
const PLAYER_STEP_LEN = 0.5;
const PLAYER_SPEED = 2;
const PLAYER_SIZE = 0.5;

class Vector2 {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  static zero(): Vector2 {
    return new Vector2(0, 0);
  }
  static scalar(value: number): Vector2 {
    return new Vector2(value, value);
  }
  static angle(angle: number): Vector2 {
    return new Vector2(Math.cos(angle), Math.sin(angle));
  }
  add(that: Vector2): Vector2 {
    return new Vector2(this.x + that.x, this.y + that.y);
  }
  sub(that: Vector2): Vector2 {
    return new Vector2(this.x - that.x, this.y - that.y);
  }
  div(that: Vector2): Vector2 {
    return new Vector2(this.x / that.x, this.y / that.y);
  }
  mul(that: Vector2): Vector2 {
    return new Vector2(this.x * that.x, this.y * that.y);
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  sqrLength(): number {
    return this.x * this.x + this.y * this.y;
  }
  norm(): Vector2 {
    const l = this.length();
    if (l === 0) return new Vector2(0, 0);
    return new Vector2(this.x / l, this.y / l);
  }
  scale(value: number): Vector2 {
    return new Vector2(this.x * value, this.y * value);
  }
  rot90(): Vector2 {
    return new Vector2(-this.y, this.x);
  }
  sqrDistanceTo(that: Vector2): number {
    return that.sub(this).sqrLength();
  }
  lerp(that: Vector2, t: number): Vector2 {
    return that.sub(this).scale(t).add(this);
  }
  dot(that: Vector2): number {
    return this.x * that.x + this.y * that.y;
  }
  map(f: (x: number) => number): Vector2 {
    return new Vector2(f(this.x), f(this.y));
  }
  array(): [number, number] {
    return [this.x, this.y];
  }
}

class RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
  constructor(r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  static red(): RGBA {
    return new RGBA(1, 0, 0, 1);
  }
  static green(): RGBA {
    return new RGBA(0, 1, 0, 1);
  }
  static blue(): RGBA {
    return new RGBA(0, 0, 1, 1);
  }
  static yellow(): RGBA {
    return new RGBA(1, 1, 0, 1);
  }
  static purple(): RGBA {
    return new RGBA(1, 0, 1, 1);
  }
  static cyan(): RGBA {
    return new RGBA(0, 1, 1, 1);
  }
  brightness(factor: number): RGBA {
    return new RGBA(factor * this.r, factor * this.g, factor * this.b, this.a);
  }
  toStyle(): string {
    return (
      `rgba(` +
      `${Math.floor(this.r * 255)}, ` +
      `${Math.floor(this.g * 255)}, ` +
      `${Math.floor(this.b * 255)}, ` +
      `${this.a})`
    );
  }
}

class Player {
  position: Vector2;
  direction: number;
  constructor(position: Vector2, direction: number) {
    this.position = position;
    this.direction = direction;
  }
  fovRange(): [Vector2, Vector2] {
    const l = Math.tan(FOV * 0.5) * NEAR_CLIPPING_PLANE;
    const p = this.position.add(
      Vector2.angle(this.direction).scale(NEAR_CLIPPING_PLANE)
    );
    const p1 = p.sub(p.sub(this.position).rot90().norm().scale(l));
    const p2 = p.add(p.sub(this.position).rot90().norm().scale(l));
    return [p1, p2];
  }
}

function drawLine(ctx: CanvasRenderingContext2D, p1: Vector2, p2: Vector2) {
  ctx.beginPath();
  ctx.moveTo(...p1.array());
  ctx.lineTo(...p2.array());
  ctx.stroke();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: Vector2,
  radius: number
) {
  ctx.beginPath();
  ctx.arc(...center.array(), radius, 0, 2 * Math.PI);
  ctx.fill();
}

function canvasSize(ctx: CanvasRenderingContext2D): Vector2 {
  return new Vector2(ctx.canvas.width, ctx.canvas.height);
}

function snap(x: number, dx: number): number {
  if (dx > 0) return Math.ceil(x + Math.sign(dx) * EPS);
  if (dx < 0) return Math.floor(x + Math.sign(dx) * EPS);
  return x;
}

function hittingCell(p1: Vector2, p2: Vector2): Vector2 {
  const d = p2.sub(p1);
  return new Vector2(
    Math.floor(p2.x + Math.sign(d.x) * EPS),
    Math.floor(p2.y + Math.sign(d.y) * EPS)
  );
}

function rayStep(p1: Vector2, p2: Vector2): Vector2 {
  /* slope equation
    p1 = (x1, y1)  
    p2 = (x2, y2)
    
    y1 = m*x1 + c
    y2 = m*x2 + c

    dy = y2 - y1
    dx = x2 - x1
    m = dy / dx 
    c = y1 - k*x1

  */
  let p3 = p2;
  const d = p2.sub(p1);
  if (d.x != 0) {
    const m = d.y / d.x;
    const c = p1.y - m * p1.x;
    const x3 = snap(p2.x, d.x);
    const y3 = m * x3 + c;

    {
      const y3 = x3 * m + c;
      p3 = new Vector2(x3, y3);
    }

    if (m !== 0) {
      const y3 = snap(p2.y, d.y);
      const x3 = (y3 - c) / m;
      const p3t = new Vector2(x3, y3);
      if (p2.sqrDistanceTo(p3t) < p2.sqrDistanceTo(p3)) {
        p3 = p3t;
      }
    }
  } else {
    const y3 = snap(p2.y, d.y);
    const x3 = p2.x;
    p3 = new Vector2(x3, y3);
  }

  return p3;
}

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  player: Player,
  position: Vector2,
  size: Vector2,
  scene: Scene
) {
  ctx.save();

  const gridSize = scene.size();

  ctx.translate(...position.array());
  ctx.scale(...size.div(gridSize).array());

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ...gridSize.array());

  ctx.lineWidth = 0.1;
  for (let y = 0; y < gridSize.y; ++y) {
    for (let x = 0; x < gridSize.x; ++x) {
      const cell = scene.getWall(new Vector2(x, y));
      if (cell instanceof RGBA) {
        ctx.fillStyle = cell.toStyle();
        ctx.fillRect(x, y, 1, 1);
      } else if (cell instanceof HTMLImageElement) {
        ctx.drawImage(cell, x, y, 1, 1);
      }
    }
  }

  ctx.strokeStyle = "#303030";
  for (let x = 0; x <= gridSize.x; ++x) {
    drawLine(ctx, new Vector2(x, 0), new Vector2(x, gridSize.y));
  }
  for (let y = 0; y <= gridSize.y; ++y) {
    drawLine(ctx, new Vector2(0, y), new Vector2(gridSize.x, y));
  }

  ctx.fillStyle = "lime";
  // fillCircle(ctx, player.position, 0.2);
  ctx.fillRect(
    player.position.x - PLAYER_SIZE * 0.5,
    player.position.y - PLAYER_SIZE * 0.5,
    PLAYER_SIZE,
    PLAYER_SIZE
  );

  const [p1, p2] = player.fovRange();
  ctx.strokeStyle = "lime";
  drawLine(ctx, p1, p2);
  drawLine(ctx, player.position, p1);
  drawLine(ctx, player.position, p2);

  ctx.restore();
}

type Tile = RGBA | HTMLImageElement | null;

class Scene {
  walls: Array<Tile>;
  width: number;
  height: number;
  floor1: RGBA;
  floor2: RGBA;
  ceiling1: RGBA;
  ceiling2: RGBA;
  constructor(walls: Array<Array<Tile>>) {
    this.floor1 = new RGBA(0.094, 0.094, 0.094, 1.0);
    this.floor2 = new RGBA(0.188, 0.188, 0.188, 1.0);
    this.ceiling1 = new RGBA(0.53, 0.81, 0.92, 1.0);
    this.ceiling2 = new RGBA(0.26, 0.48, 0.73, 1.0);
    this.height = walls.length;
    this.width = Number.MIN_VALUE;
    for (let row of walls) {
      this.width = Math.max(this.width, row.length);
    }
    this.walls = [];
    for (let row of walls) {
      this.walls = this.walls.concat(row);
      for (let i = 0; i < this.width - row.length; ++i) {
        this.walls.push(null);
      }
    }
  }
  size(): Vector2 {
    return new Vector2(this.width, this.height);
  }
  contains(p: Vector2): boolean {
    return 0 <= p.x && p.x < this.width && 0 <= p.y && p.y < this.height;
  }
  getWall(p: Vector2): Tile | undefined {
    if (!this.contains(p)) return undefined;
    const fp = p.map(Math.floor);
    return this.walls[fp.y * this.width + fp.x];
  }
  getFloor(p: Vector2): Tile | undefined {
    const t = p.map(Math.floor);
    if ((t.x + t.y) % 2 == 0) {
      return this.floor1;
    } else {
      return this.floor2;
    }
  }
  getCeiling(p: Vector2): Tile | undefined {
    const t = p.map(Math.floor);
    if ((t.x + t.y) % 2 == 0) {
      return this.ceiling1;
    } else {
      return this.ceiling2;
    }
  }
  isWall(p: Vector2): boolean {
    const c = this.getWall(p);
    return c !== null && c !== undefined;
  }
}

function castRay(scene: Scene, p1: Vector2, p2: Vector2): Vector2 {
  let start = p1;
  while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE * FAR_CLIPPING_PLANE) {
    const c = hittingCell(p1, p2);
    if (scene.isWall(c)) break;
    const p3 = rayStep(p1, p2);
    p1 = p2;
    p2 = p3;
  }
  return p2;
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  ctx.save();
  ctx.scale(ctx.canvas.width / SCREEN_WIDTH, ctx.canvas.height / SCREEN_HEIGHT);
  const [r1, r2] = player.fovRange();
  for (let x = 0; x < SCREEN_WIDTH; ++x) {
    const p = castRay(scene, player.position, r1.lerp(r2, x / SCREEN_WIDTH));
    const c = hittingCell(player.position, p);
    const cell = scene.getWall(c);
    if (cell instanceof RGBA) {
      const v = p.sub(player.position);
      const d = Vector2.angle(player.direction);
      const stripHeight = SCREEN_HEIGHT / v.dot(d);
      ctx.fillStyle = cell.brightness(1 / v.dot(d)).toStyle();
      ctx.fillRect(
        Math.floor(x),
        Math.floor((SCREEN_HEIGHT - stripHeight) * 0.5),
        Math.ceil(1),
        Math.ceil(stripHeight)
      );
    } else if (cell instanceof HTMLImageElement) {
      const v = p.sub(player.position);
      const d = Vector2.angle(player.direction);
      const stripHeight = SCREEN_HEIGHT / v.dot(d);

      let u = 0;
      const t = p.sub(c);
      if ((Math.abs(t.x) < EPS || Math.abs(t.x - 1) < EPS) && t.y > 0) {
        u = t.y;
      } else {
        u = t.x;
      }

      ctx.drawImage(
        cell,
        Math.floor(u * cell.width),
        0,
        1,
        cell.height,
        Math.floor(x),
        Math.floor((SCREEN_HEIGHT - stripHeight) * 0.5),
        Math.ceil(1),
        Math.ceil(stripHeight)
      );
      ctx.fillStyle = new RGBA(0, 0, 0, 1 - 1 / v.dot(d)).toStyle();
      ctx.fillRect(
        Math.floor(x),
        Math.floor((SCREEN_HEIGHT - stripHeight) * 0.5),
        Math.ceil(1),
        Math.ceil(stripHeight)
      );
    }
  }
  ctx.restore();
}

async function renderGame(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  const minimapSize = 300;
  const minimapPosition = new Vector2(
    (ctx.canvas.width - minimapSize) / 2,
    ctx.canvas.height - minimapSize - 10 // 10 pixels padding from the bottom
  );

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = "hsl(220, 20%, 30%)";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height / 2);
  renderFloor(ctx, player, scene);
  renderCeiling(ctx, player, scene);
  renderScene(ctx, player, scene);
  renderMinimap(
    ctx,
    player,
    minimapPosition,
    new Vector2(minimapSize, minimapSize),
    scene
  );
}

function renderCeiling(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  ctx.save();
  ctx.scale(ctx.canvas.width / SCREEN_WIDTH, ctx.canvas.height / SCREEN_HEIGHT);

  const pz = SCREEN_HEIGHT / 2;
  const [p1, p2] = player.fovRange();
  const bp = p1.sub(player.position).length();
  for (let y = SCREEN_HEIGHT / 2; y < SCREEN_HEIGHT; ++y) {
    const sz = SCREEN_HEIGHT - y - 1;

    const ap = pz - sz;
    const b = ((bp / ap) * pz) / NEAR_CLIPPING_PLANE;
    const t1 = player.position.add(p1.sub(player.position).norm().scale(b));
    const t2 = player.position.add(p2.sub(player.position).norm().scale(b));

    for (let x = 0; x < SCREEN_WIDTH; ++x) {
      const t = t1.lerp(t2, x / SCREEN_WIDTH);
      const tile = scene.getCeiling(t);
      if (tile instanceof RGBA) {
        ctx.fillStyle = tile.toStyle();
        ctx.fillRect(x, sz, 1, 1);
      } else if (tile instanceof HTMLImageElement) {
        const c = t.map((x) => x - Math.floor(x));
        ctx.drawImage(
          tile,
          Math.floor(c.x * tile.width),
          Math.floor(c.y * tile.height),
          1,
          1,
          x,
          y,
          1,
          1
        );
      }
    }
  }

  ctx.restore();
}

function renderFloor(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  ctx.save();
  ctx.scale(ctx.canvas.width / SCREEN_WIDTH, ctx.canvas.height / SCREEN_HEIGHT);
  const pz = SCREEN_HEIGHT / 2;
  const [p1, p2] = player.fovRange();
  const bp = p1.sub(player.position).length();
  for (let y = SCREEN_HEIGHT / 2; y < SCREEN_HEIGHT; ++y) {
    const sz = SCREEN_HEIGHT - y - 1;
    const ap = pz - sz;
    const b = ((bp / ap) * pz) / NEAR_CLIPPING_PLANE;
    const t1 = player.position.add(p1.sub(player.position).norm().scale(b));
    const t2 = player.position.add(p2.sub(player.position).norm().scale(b));
    for (let x = 0; x < SCREEN_WIDTH; ++x) {
      const t = t1.lerp(t2, x / SCREEN_WIDTH);
      const tile = scene.getFloor(t);
      if (tile instanceof RGBA) {
        ctx.fillStyle = tile.toStyle();
        ctx.fillRect(x, y, 1, 1);
      } else if (tile instanceof HTMLImageElement) {
        const c = t.map((x) => x - Math.floor(x));
        ctx.drawImage(
          tile,
          Math.floor(c.x * tile.width),
          Math.floor(c.y * tile.height),
          1,
          1,
          x,
          y,
          1,
          1
        );
      }
    }
  }
  ctx.restore();
}

async function loadImageData(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = reject;
  });
}

function canPlayerGoThere(scene: Scene, newPosition: Vector2): boolean {
  // TODO: try circle boundary instead of a box
  const leftTopCorner = newPosition
    .sub(Vector2.scalar(PLAYER_SIZE * 0.5))
    .map(Math.floor);
  const rightBottomCorner = newPosition
    .add(Vector2.scalar(PLAYER_SIZE * 0.5))
    .map(Math.floor);
  for (let x = leftTopCorner.x; x <= rightBottomCorner.x; ++x) {
    for (let y = leftTopCorner.y; y <= rightBottomCorner.y; ++y) {
      if (scene.isWall(new Vector2(x, y))) {
        return false;
      }
    }
  }
  return true;
}

(async () => {
  const game = document.getElementById("game") as HTMLCanvasElement | null;
  if (game === null) throw new Error("No canvas with id `game` is found");
  const factor = 80;
  game.width = 16 * factor;
  game.height = 9 * factor;
  const ctx = game.getContext("2d");
  if (ctx === null) throw new Error("2D context is not supported");
  ctx.imageSmoothingEnabled = false;

  const wall = await loadImageData("assets/textures/wall.png").catch(() =>
    RGBA.purple()
  );

  const scene: Scene = new Scene([
    [null, wall, wall, wall, wall, wall, null, null, null],
    [null, null, null, wall, null, wall, null, null, null],
    [null, wall, wall, wall, null, wall, wall, wall, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, wall, wall, wall, null, null, null, null, null],
    [null, null, null, wall, wall, wall, null, null, null],
    [null, null, null, null, null, null, null, null, null],
  ]);

  const player = new Player(
    scene.size().mul(new Vector2(0.63, 0.63)),
    Math.PI * 1.25
  );
  let movingForward = false;
  let movingBackward = false;
  let turningLeft = false;
  let turningRight = false;

  window.addEventListener("keydown", (e) => {
    if (!e.repeat) {
      switch (e.code) {
        case "KeyW":
          movingForward = true;
          break;
        case "KeyS":
          movingBackward = true;
          break;
        case "KeyA":
          turningLeft = true;
          break;
        case "KeyD":
          turningRight = true;
          break;
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (!e.repeat) {
      switch (e.code) {
        case "KeyW":
          movingForward = false;
          break;
        case "KeyS":
          movingBackward = false;
          break;
        case "KeyA":
          turningLeft = false;
          break;
        case "KeyD":
          turningRight = false;
          break;
      }
    }
  });

  let prevTimestamp = 0;
  const frame = (timestamp: number) => {
    const deltaTime = (timestamp - prevTimestamp) / 1000;
    prevTimestamp = timestamp;
    let velocity = Vector2.zero();
    let angularVelocity = 0.0;
    if (movingForward) {
      velocity = velocity.add(
        Vector2.angle(player.direction).scale(PLAYER_SPEED)
      );
    }
    if (movingBackward) {
      velocity = velocity.sub(
        Vector2.angle(player.direction).scale(PLAYER_SPEED)
      );
    }
    if (turningLeft) {
      angularVelocity -= Math.PI;
    }
    if (turningRight) {
      angularVelocity += Math.PI;
    }
    player.direction = player.direction + angularVelocity * deltaTime;
    const nx = player.position.x + velocity.x * deltaTime;
    if (canPlayerGoThere(scene, new Vector2(nx, player.position.y))) {
      player.position.x = nx;
    }
    const ny = player.position.y + velocity.y * deltaTime;
    if (canPlayerGoThere(scene, new Vector2(player.position.x, ny))) {
      player.position.y = ny;
    }
    renderGame(ctx, player, scene);
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame((timestamp) => {
    prevTimestamp = timestamp;
    window.requestAnimationFrame(frame);
  });
})();
