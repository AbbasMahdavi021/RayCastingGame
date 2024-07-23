"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const EPS = 1e-6;
const NEAR_CLIPPING_PLANE = 0.25;
const FAR_CLIPPING_PLANE = 10.0;
const FOV = Math.PI * 0.5;
const SCREEN_WIDTH = 300;
const PLAYER_STEP_LEN = 0.5;
const PLAYER_SPEED = 2;
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    static zero() {
        return new Vector2(0, 0);
    }
    static fromAngle(angle) {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
    add(that) {
        return new Vector2(this.x + that.x, this.y + that.y);
    }
    sub(that) {
        return new Vector2(this.x - that.x, this.y - that.y);
    }
    div(that) {
        return new Vector2(this.x / that.x, this.y / that.y);
    }
    mul(that) {
        return new Vector2(this.x * that.x, this.y * that.y);
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    sqrLength() {
        return this.x * this.x + this.y * this.y;
    }
    norm() {
        const l = this.length();
        if (l === 0)
            return new Vector2(0, 0);
        return new Vector2(this.x / l, this.y / l);
    }
    scale(value) {
        return new Vector2(this.x * value, this.y * value);
    }
    rot90() {
        return new Vector2(-this.y, this.x);
    }
    sqrDistanceTo(that) {
        return that.sub(this).sqrLength();
    }
    lerp(that, t) {
        return that.sub(this).scale(t).add(this);
    }
    dot(that) {
        return this.x * that.x + this.y * that.y;
    }
    array() {
        return [this.x, this.y];
    }
}
class Color {
    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    static red() {
        return new Color(1, 0, 0, 1);
    }
    static green() {
        return new Color(0, 1, 0, 1);
    }
    static blue() {
        return new Color(0, 0, 1, 1);
    }
    static yellow() {
        return new Color(1, 1, 0, 1);
    }
    static purple() {
        return new Color(1, 0, 1, 1);
    }
    static cyan() {
        return new Color(0, 1, 1, 1);
    }
    brightness(factor) {
        return new Color(factor * this.r, factor * this.g, factor * this.b, this.a);
    }
    toStyle() {
        return (`rgba(` +
            `${Math.floor(this.r * 255)}, ` +
            `${Math.floor(this.g * 255)}, ` +
            `${Math.floor(this.b * 255)}, ` +
            `${this.a})`);
    }
}
class Player {
    constructor(position, direction) {
        this.position = position;
        this.direction = direction;
    }
    fovRange() {
        const l = Math.tan(FOV * 0.5) * NEAR_CLIPPING_PLANE;
        const p = this.position.add(Vector2.fromAngle(this.direction).scale(NEAR_CLIPPING_PLANE));
        const p1 = p.sub(p.sub(this.position).rot90().norm().scale(l));
        const p2 = p.add(p.sub(this.position).rot90().norm().scale(l));
        return [p1, p2];
    }
}
function drawLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(...p1.array());
    ctx.lineTo(...p2.array());
    ctx.stroke();
}
function drawCircle(ctx, center, radius) {
    ctx.beginPath();
    ctx.arc(...center.array(), radius, 0, 2 * Math.PI);
    ctx.fill();
}
function canvasSize(ctx) {
    return new Vector2(ctx.canvas.width, ctx.canvas.height);
}
function sceneSize(scene) {
    const y = scene.length;
    let x = Number.MIN_VALUE;
    for (let row of scene) {
        x = Math.max(x, row.length);
    }
    return new Vector2(x, y);
}
function snap(x, dx) {
    if (dx > 0)
        return Math.ceil(x + Math.sign(dx) * EPS);
    if (dx < 0)
        return Math.floor(x + Math.sign(dx) * EPS);
    return x;
}
function hittingCell(p1, p2) {
    const d = p2.sub(p1);
    return new Vector2(Math.floor(p2.x + Math.sign(d.x) * EPS), Math.floor(p2.y + Math.sign(d.y) * EPS));
}
function rayStep(p1, p2) {
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
    }
    else {
        const y3 = snap(p2.y, d.y);
        const x3 = p2.x;
        p3 = new Vector2(x3, y3);
    }
    return p3;
}
function renderMinimap(ctx, player, position, size, scene) {
    ctx.save();
    const gridSize = sceneSize(scene);
    ctx.translate(...position.array());
    ctx.scale(...size.div(gridSize).array());
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, ...gridSize.array());
    ctx.lineWidth = 0.06;
    for (let y = 0; y < gridSize.y; ++y) {
        for (let x = 0; x < gridSize.x; ++x) {
            const cell = scene[y][x];
            if (cell instanceof Color) {
                ctx.fillStyle = cell.toStyle();
                ctx.fillRect(x, y, 1, 1);
            }
            else if (cell instanceof HTMLImageElement) {
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
    drawCircle(ctx, player.position, 0.2);
    const [p1, p2] = player.fovRange();
    ctx.strokeStyle = "lime";
    drawLine(ctx, p1, p2);
    drawLine(ctx, player.position, p1);
    drawLine(ctx, player.position, p2);
    ctx.restore();
}
function insideScene(scene, p) {
    const size = sceneSize(scene);
    return 0 <= p.x && p.x < size.x && 0 <= p.y && p.y < size.y;
}
function castRay(scene, p1, p2) {
    let start = p1;
    while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE * FAR_CLIPPING_PLANE) {
        const c = hittingCell(p1, p2);
        if (insideScene(scene, c) && scene[c.y][c.x] !== null)
            break;
        const p3 = rayStep(p1, p2);
        p1 = p2;
        p2 = p3;
    }
    return p2;
}
function renderScene(ctx, player, scene) {
    const [r1, r2] = player.fovRange();
    const stripWidth = Math.ceil(ctx.canvas.width / SCREEN_WIDTH);
    for (let x = 0; x < SCREEN_WIDTH; ++x) {
        const p = castRay(scene, player.position, r1.lerp(r2, x / SCREEN_WIDTH));
        const c = hittingCell(player.position, p);
        if (insideScene(scene, c)) {
            const cell = scene[c.y][c.x];
            if (cell instanceof Color) {
                const v = p.sub(player.position);
                const d = Vector2.fromAngle(player.direction);
                const stripHeight = ctx.canvas.height / v.dot(d);
                ctx.fillStyle = cell.brightness(1 / v.dot(d)).toStyle();
                ctx.fillRect(x * stripWidth, (ctx.canvas.height - stripHeight) * 0.5, stripWidth, stripHeight);
            }
            else if (cell instanceof HTMLImageElement) {
                const v = p.sub(player.position);
                const d = Vector2.fromAngle(player.direction);
                const stripHeight = ctx.canvas.height / v.dot(d);
                let u = 0;
                const t = p.sub(c);
                if ((Math.abs(t.x) < EPS || Math.abs(t.x - 1) < EPS) && t.y > 0) {
                    u = t.y;
                }
                else {
                    u = t.x;
                }
                ctx.drawImage(cell, Math.floor(u * cell.width), 0, 1, cell.height, x * stripWidth, (ctx.canvas.height - stripHeight) * 0.5, stripWidth, stripHeight);
                ctx.fillStyle = new Color(0, 0, 0, 1 - 1 / v.dot(d)).toStyle();
                ctx.fillRect(x * stripWidth, (ctx.canvas.height - stripHeight * 1.01) * 0.5, stripWidth, stripHeight * 1.01);
            }
        }
    }
}
function renderGame(ctx, player, scene) {
    const minimapPosition = Vector2.zero().add(canvasSize(ctx).scale(0.03));
    const cellSize = ctx.canvas.width * 0.025;
    const minimapSize = sceneSize(scene).scale(cellSize);
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    renderScene(ctx, player, scene);
    renderMinimap(ctx, player, minimapPosition, minimapSize, scene);
}
function loadImageData(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const image = new Image();
        image.src = url;
        return new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = reject;
        });
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    const game = document.getElementById("game");
    if (game === null)
        throw new Error("Can't find game canvas!");
    const factor = 80;
    game.width = 16 * factor;
    game.height = 9 * factor;
    const ctx = game.getContext("2d");
    if (ctx === null)
        throw new Error("Not supported!");
    const face = yield loadImageData("assets/images/sad.png").catch(() => Color.purple());
    let scene = [
        [null, null, null, face, null, null, null, null, null],
        [null, null, null, face, null, null, null, null, null],
        [null, face, face, face, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
    ];
    let player = new Player(sceneSize(scene).mul(new Vector2(0.65, 0.65)), Math.PI * 1.25);
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
    const frame = (timestamp) => {
        const deltaTime = (timestamp - prevTimestamp) / 1000;
        prevTimestamp = timestamp;
        let velocity = Vector2.zero();
        let angularVelocity = 0.0;
        if (movingForward) {
            velocity = velocity.add(Vector2.fromAngle(player.direction).scale(PLAYER_SPEED));
        }
        if (movingBackward) {
            velocity = velocity.sub(Vector2.fromAngle(player.direction).scale(PLAYER_SPEED));
        }
        if (turningLeft) {
            angularVelocity -= Math.PI;
        }
        if (turningRight) {
            angularVelocity += Math.PI;
        }
        player.direction = player.direction + angularVelocity * deltaTime;
        player.position = player.position.add(velocity.scale(deltaTime));
        renderGame(ctx, player, scene);
        window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame((timestamp) => {
        prevTimestamp = timestamp;
        window.requestAnimationFrame(frame);
    });
}))();
