const EPS = 1e-6;
const NEAR_CLIPPING_PLANE = 1.0;
const FAR_CLIPPING_PLANE = 20.0;
const FOV = Math.PI * 0.5;
const SCREEN_WIDTH = 300;
const PLAYER_STEP_LEN = 0.5;
const PLAYER_SPEED = 2;

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
  static fromAngle(angle: number) {
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
    const dx = that.x - this.x;
    const dy = that.y - this.y;
    return dx * dx + dy * dy;
  }
  lerp(that: Vector2, t: number): Vector2 {
    return that.sub(this).scale(t).add(this);
  }
  dot(that: Vector2): number {
    return this.x * that.x + this.y * that.y;
  }
  array(): [number, number] {
    return [this.x, this.y];
  }
}

class Color {
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
  static red(): Color {
    return new Color(1, 0, 0, 1);
  }
  static green(): Color {
    return new Color(0, 1, 0, 1);
  }
  static blue(): Color {
    return new Color(0, 0, 1, 1);
  }
  static yellow(): Color {
    return new Color(1, 1, 0, 1);
  }
  static purple(): Color {
    return new Color(1, 0, 1, 1);
  }
  static cyan(): Color {
    return new Color(0, 1, 1, 1);
  }
  brightness(factor: number): Color {
    return new Color(factor * this.r, factor * this.g, factor * this.b, this.a);
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
      Vector2.fromAngle(this.direction).scale(NEAR_CLIPPING_PLANE)
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

function sceneSize(scene: Scene): Vector2 {
  const y = scene.length;
  let x = Number.MIN_VALUE;
  for (let row of scene) {
    x = Math.max(x, row.length);
  }
  return new Vector2(x, y);
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

  const gridSize = sceneSize(scene);

  ctx.translate(...position.array());
  ctx.scale(...size.div(gridSize).array());

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ...gridSize.array());

  ctx.lineWidth = 0.06;
  for (let y = 0; y < gridSize.y; ++y) {
    for (let x = 0; x < gridSize.x; ++x) {
      const color = scene[y][x];
      if (color !== null) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
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
  drawCircle(ctx, player.position, 0.2);

  const [p1, p2] = player.fovRange();

  ctx.strokeStyle = "lime";
  drawLine(ctx, p1, p2);
  drawLine(ctx, player.position, p1);
  drawLine(ctx, player.position, p2);

  ctx.restore();
}

type Scene = Array<Array<string | null>>;

function insideScene(scene: Scene, p: Vector2): boolean {
  const size = sceneSize(scene);
  return 0 <= p.x && p.x < size.x && 0 <= p.y && p.y < size.y;
}

function castRay(scene: Scene, p1: Vector2, p2: Vector2): Vector2 {
  let start = p1;
  while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE * FAR_CLIPPING_PLANE) {
    const c = hittingCell(p1, p2);
    if (insideScene(scene, c) && scene[c.y][c.x] !== null) break;
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
  const [r1, r2] = player.fovRange();
  const stripWidth = Math.ceil(ctx.canvas.width / SCREEN_WIDTH);

  for (let x = 0; x < SCREEN_WIDTH; ++x) {
    const p = castRay(scene, player.position, r1.lerp(r2, x / SCREEN_WIDTH));
    const c = hittingCell(player.position, p);
    if (insideScene(scene, c)) {
      const color = scene[c.y][c.x];
      if (color !== null) {
        const v = p.sub(player.position);
        const d = Vector2.fromAngle(player.direction);
        const stripHeight = ctx.canvas.height / v.dot(d);
        ctx.fillStyle = color;
        ctx.fillRect(
          x * stripWidth,
          ctx.canvas.height * 0.5 - stripHeight * 0.5,
          stripWidth,
          stripHeight
        );
      }
    }
  }
}

function renderGame(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  const minimapPosition = Vector2.zero().add(canvasSize(ctx).scale(0.03));
  const cellSize = ctx.canvas.width * 0.025;
  const minimapSize = sceneSize(scene).scale(cellSize);

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  renderScene(ctx, player, scene);
  renderMinimap(ctx, player, minimapPosition, minimapSize, scene);
}

(() => {
  const game = document.getElementById("game") as HTMLCanvasElement | null;
  if (game === null) throw new Error("Can't find game canvas!");
  const factor = 80;
  game.width = 16 * factor;
  game.height = 9 * factor;

  const ctx = game.getContext("2d");
  if (ctx === null) throw new Error("Not supported!");

  let scene = [
    [null, null, null, "red", null, null, null, null, null],
    [null, null, null, "orange", null, null, null, null, null],
    [null, "green", "red", "blue", null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, "red", "purple", null, null, null, null, null, null],
    [null, null, "blue", null, null, null, null, null, null],
    [null, null, null, "red", "yellow", null, null, null, null],
    [null, null, null, null, "green", null, null, null, null],
  ];
  let player = new Player(
    sceneSize(scene).mul(new Vector2(0.65, 0.65)),
    Math.PI * 1.25
  );

  window.addEventListener("keydown", (e) => {
    if (!e.repeat) {
      switch (e.code) {
        case "KeyW":
          {
            player.position = player.position.add(
              Vector2.fromAngle(player.direction).scale(PLAYER_STEP_LEN)
            );
            renderGame(ctx, player, scene);
          }
          break;
        case "KeyS":
          {
            player.position = player.position.sub(
              Vector2.fromAngle(player.direction).scale(PLAYER_STEP_LEN)
            );
            renderGame(ctx, player, scene);
          }
          break;
        case "KeyD":
          {
            player.direction += Math.PI * 0.1;
            renderGame(ctx, player, scene);
          }
          break;
        case "KeyA":
          {
            player.direction -= Math.PI * 0.1;
            renderGame(ctx, player, scene);
          }
          break;
      }
    }
  });

  renderGame(ctx, player, scene);
})();
