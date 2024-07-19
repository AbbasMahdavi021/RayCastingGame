const EPS = 1e-3;
const NEAR_CLIPPING_PLANE = 0.75;
const FOV = Math.PI * 0.5;

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
  norm(): Vector2 {
    const l = this.length();
    if (l == 0) return new Vector2(0, 0);
    return new Vector2(this.x / l, this.y / l);
  }
  scale(value: number): Vector2 {
    return new Vector2(this.x * value, this.y * value);
  }
  rot90(): Vector2 {
    return new Vector2(-this.y, this.x);
  }
  distanceTo(that: Vector2): number {
    return that.sub(this).length();
  }
  array(): [number, number] {
    return [this.x, this.y];
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

    const p1 = p.add(p.sub(this.position).rot90().norm().scale(l));
    const p2 = p.sub(p.sub(this.position).rot90().norm().scale(l));

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
      if (p2.distanceTo(p3t) < p2.distanceTo(p3)) {
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

type Scene = Array<Array<number>>;

function castRay(scene: Scene, p1: Vector2, p2: Vector2): Vector2 {
  throw new Error("castRay TODO");
}

function minimap(
  ctx: CanvasRenderingContext2D,
  player: Player,
  position: Vector2,
  size: Vector2,
  scene: Scene
) {
  ctx.save();

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const gridSize = sceneSize(scene);

  ctx.translate(...position.array());
  ctx.scale(...size.div(gridSize).array());

  ctx.lineWidth = 0.06;

  for (let y = 0; y < gridSize.y; ++y) {
    for (let x = 0; x < gridSize.x; ++x) {
      if (scene[y][x] !== 0) {
        ctx.fillStyle = "#303030";
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

(() => {
  let scene = [
    [0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const game = document.getElementById("game") as HTMLCanvasElement | null;
  if (game === null) {
    throw new Error("Can't find game canvas!");
  }
  const factor = 70;
  game.width = 16 * factor;
  game.height = 12 * factor;

  const ctx = game.getContext("2d");
  if (ctx === null) {
    throw new Error("Not supported!");
  }

  let player = new Player(
    sceneSize(scene).mul(new Vector2(0.65, 0.65)),
    Math.PI * 1.25
  );

  let minimapPosition = Vector2.zero().add(canvasSize(ctx).scale(0.03));
  let cellSize = ctx.canvas.width * 0.07;
  let minimapSize = sceneSize(scene).scale(cellSize);

  minimap(ctx, player, minimapPosition, minimapSize, scene);
})();
