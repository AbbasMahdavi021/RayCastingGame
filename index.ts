const EPS = 1e-6;
const NEAR_CLIPPING_PLANE = 0.1;
const FAR_CLIPPING_PLANE = 20.0;
const FOV = Math.PI * 0.5;
const SCREEN_FACTOR = 70;
const SCREEN_WIDTH = Math.floor(16 * SCREEN_FACTOR);
const SCREEN_HEIGHT = Math.floor(9 * SCREEN_FACTOR);

const PLAYER_SPEED = 2;
const PLAYER_SIZE = 0.5;

type Tile = String | HTMLImageElement | null;

class Scene {
  walls: Array<Tile>;
  width: number;
  height: number;

  constructor(walls: Array<Array<Tile>>) {
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

  // Returns the size of the scene as a Vector2 object
  size(): Vector2 {
    return new Vector2(this.width, this.height);
  }

  // Checks if the given position is within the scene boundaries
  contains(p: Vector2): boolean {
    return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
  }

  // Retrieves the wall tile at a given position, or undefined if out of bounds
  getWall(p: Vector2): Tile | undefined {
    if (!this.contains(p)) return undefined;
    return this.walls[p.y * this.width + p.x];
  }

  // Checks if there is a wall at a given position
  isWall(p: Vector2): boolean {
    const tile = this.getWall(p);
    return tile !== null && tile !== undefined;
  }
}

class Player {
  position: Vector2;
  direction: number;

  constructor(position: Vector2, direction: number) {
    this.position = position;
    this.direction = direction;
  }

  // Calculates the field of view (FOV) range as two points
  fovRange(): [Vector2, Vector2] {
    // Calculate the distance from the center of the FOV to the edge
    const distanceToEdge = Math.tan(FOV * 0.5) * NEAR_CLIPPING_PLANE;

    // Calculate the point directly in front of the player at the near clipping plane
    const frontPoint = this.position.add(
      Vector2.angle(this.direction).scale(NEAR_CLIPPING_PLANE)
    );

    // Calculate the left and right edges of the FOV
    const directionToEdge = frontPoint
      .sub(this.position)
      .rot90()
      .norm()
      .scale(distanceToEdge);
    const leftEdge = frontPoint.sub(directionToEdge);
    const rightEdge = frontPoint.add(directionToEdge);

    return [leftEdge, rightEdge];
  }
}

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
  interpolate(that: Vector2, t: number): Vector2 {
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

/**
 * Adjusts a number to the nearest boundary based on the direction of adjustment.
 *
 * @param x - The value to be adjusted.
 * @param dx - The direction of adjustment. Positive means rounding up, negative means rounding down.
 *
 * @returns The adjusted value, rounded to the nearest boundary according to the direction.
 */
function alignToGrid(x: number, dx: number): number {
  if (dx > 0) return Math.ceil(x + Math.sign(dx) * EPS);
  if (dx < 0) return Math.floor(x + Math.sign(dx) * EPS);
  return x;
}

/**
 * Determines the grid cell at the endpoint of a ray, adjusting to the nearest grid line.
 *
 * @param start - The starting point of the ray.
 * @param end - The end point of the ray.
 *
 * @returns The grid cell coordinates at the ray's endpoint, aligned to the nearest grid line.
 */
function findCellAtRayEnd(start: Vector2, end: Vector2): Vector2 {
  const delta = end.sub(start);
  return new Vector2(
    Math.floor(end.x + Math.sign(delta.x) * EPS),
    Math.floor(end.y + Math.sign(delta.y) * EPS)
  );
}

/**
 * Computes the intersection point of a ray with the grid lines.
 * The ray is defined by two points, `p1` and `p2`. This function snaps the end of the ray to the nearest grid line, considering both x and y coordinates.
        
        y = m*x + b
        x = (y - b) / m

        p1 = (x1, y1)
        P2 = (X2, Y2)

        y1= m*x1 + b
        y2= m*x2 + b

        //get b from first equation
        b = y1 - m*x1
        
        // plugin b into second equation 
        y2 = m*x2 + y1 - m*x1
        //simplify
        y2 = m*x2 - m*x1 + y1
        y2 = m(x2 - x1) + y1
        y2 - y1 = m(x2 - x1)
        (y2 - y1) / (x2 - x1) = m
        m = (y2 - y1) / (x2 - x1)

        //delta
        dx = (x2 - x1)
        dy = (y2 - y1)
        
        //slope
        m = dy / dx
        //y-intercept
        b = y1 - m*x1 

 * @param p1 - The starting point of the ray.
 * @param p2 - The end point of the ray.
 *
 * @returns The snapped intersection point of the ray with the nearest grid line.
 */

function findRayIntersection(p1: Vector2, p2: Vector2): Vector2 {
  let intersection = p2;
  const delta = p2.sub(p1);

  if (delta.x !== 0) {
    const slope = delta.y / delta.x; // Slope of the line
    const intercept = p1.y - slope * p1.x; // Y-intercept of the line

    // Snap to the nearest vertical grid line
    const xGridLine = alignToGrid(p2.x, delta.x);
    const yGridLine = slope * xGridLine + intercept;
    intersection = new Vector2(xGridLine, yGridLine);

    // Snap to the nearest horizontal grid line
    if (slope !== 0) {
      const yGridLineSnap = alignToGrid(p2.y, delta.y);
      const xGridLineSnap = (yGridLineSnap - intercept) / slope;
      const potentialIntersection = new Vector2(xGridLineSnap, yGridLineSnap);

      // Choose the intersection point that is closest to p2
      if (
        p2.sqrDistanceTo(potentialIntersection) < p2.sqrDistanceTo(intersection)
      ) {
        intersection = potentialIntersection;
      }
    }
  } else {
    // Vertical line case: snap to the nearest horizontal grid line
    const yGridLine = alignToGrid(p2.y, delta.y);
    intersection = new Vector2(p2.x, yGridLine);
  }

  return intersection;
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
      if (cell instanceof String) {
        ctx.fillStyle = "purple";
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
  ctx.fillRect(
    player.position.x - PLAYER_SIZE * 0.5,
    player.position.y - PLAYER_SIZE * 0.5,
    PLAYER_SIZE,
    PLAYER_SIZE
  );

  ctx.restore();
}

/**
 * Traces a ray through a scene to find where it intersects with a wall or exits the scene.
 *
 * @param scene - The scene object containing information about walls and the grid.
 * @param p1 - The starting point of the ray.
 * @param p2 - The end point of the ray.
 *
 * @returns The final intersection point of the ray, which could be where it hits a wall or the far clipping plane.
 */
function castRay(scene: Scene, p1: Vector2, p2: Vector2): Vector2 {
  let start = p1;

  // Loop until the ray reaches the far clipping plane or intersects with a wall
  while (start.sqrDistanceTo(p1) < FAR_CLIPPING_PLANE * FAR_CLIPPING_PLANE) {
    // Find the grid cell at the endpoint of the ray
    const cell = findCellAtRayEnd(p1, p2);

    // Check if the cell contains a wall
    if (scene.isWall(cell)) break;

    // Calculate the next intersection point of the ray with the grid
    const intersection = findRayIntersection(p1, p2);

    // Update the ray's start and end points
    p1 = p2;
    p2 = intersection;
  }

  // Return the final point where the ray intersects with a wall or exits the scene
  return p2;
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene
) {
  ctx.save();
  ctx.scale(ctx.canvas.width / SCREEN_WIDTH, ctx.canvas.height / SCREEN_HEIGHT);

  const [leftRay, rightRay] = player.fovRange();

  for (let screenX = 0; screenX < SCREEN_WIDTH; ++screenX) {
    const ray = castRay(
      scene,
      player.position,
      leftRay.interpolate(rightRay, screenX / SCREEN_WIDTH)
    );
    const hitCellCoordinates = findCellAtRayEnd(player.position, ray);
    const wall = scene.getWall(hitCellCoordinates);

    if (typeof wall === "string") {
      // Render a wall with a solid color if the wall is represented as a string
      // The 'wall' being a string implies it is a placeholder or color name.

      // Calculate the vector from the player's position to the ray's intersection point
      const rayVector = ray.sub(player.position);

      // Get the direction the player is facing, converted into a vector
      const direction = Vector2.angle(player.direction);

      // Compute the height of the wall strip on the screen
      // This is done using the distance between the ray's intersection point and the player.
      // The height is inversely proportional to the distance from the player to the wall.
      const wallHeight = SCREEN_HEIGHT / rayVector.dot(direction);

      // Set the color to "purple" for rendering the wall
      ctx.fillStyle = "purple";

      // Draw the wall as a vertical strip on the canvas
      // The width of the strip is 1 pixel, and its height is determined by 'wallHeight'.
      ctx.fillRect(
        Math.floor(screenX), // X position of the strip on the screen
        Math.floor((SCREEN_HEIGHT - wallHeight) * 0.5), // Y position, centered vertically
        Math.ceil(1), // Width of the strip (1 pixel)
        Math.ceil(wallHeight) // Height of the strip
      );
    } else if (wall instanceof HTMLImageElement) {
      // Render a wall with a texture if the wall is an HTML image element

      // Calculate the vector from the player's position to the ray's intersection point
      const rayVector = ray.sub(player.position);

      // Get the direction the player is facing, converted into a vector
      const direction = Vector2.angle(player.direction);

      // Compute the height of the wall strip on the screen
      // This is done using the distance between the ray's intersection point and the player.
      // The height is inversely proportional to the distance from the player to the wall.
      const wallHeight = SCREEN_HEIGHT / rayVector.dot(direction);

      // Initialize the texture coordinate to 0
      let textureCoordinate = 0;

      // Determine the relative position of the hit point within the cell
      const relativeHitPosition = ray.sub(hitCellCoordinates);

      // Calculate the texture coordinate based on the position where the ray intersects the wall
      if (
        (Math.abs(relativeHitPosition.x) < EPS || // Check if the x-coordinate is very close to the grid lines
          Math.abs(relativeHitPosition.x - 1) < EPS) &&
        relativeHitPosition.y > 0 // Ensure the y-coordinate is positive
      ) {
        // If the intersection is close to the vertical edges, use the y-coordinate for texture mapping
        textureCoordinate = relativeHitPosition.y;
      } else {
        // Otherwise, use the x-coordinate for texture mapping
        textureCoordinate = relativeHitPosition.x;
      }

      // Draw the wall texture onto the canvas
      ctx.drawImage(
        wall, // The image element to use as the texture
        Math.floor(textureCoordinate * wall.width), // X position on the texture
        0, // Y position on the texture
        1, // Width of the texture (1 pixel for the strip)
        wall.height, // Height of the texture
        Math.floor(screenX), // X position of the strip on the screen
        Math.floor((SCREEN_HEIGHT - wallHeight) * 0.5), // Y position, centered vertically
        Math.ceil(1), // Width of the strip (1 pixel)
        Math.ceil(wallHeight) // Height of the strip
      );

      // Calculate the alpha value for shading
      // This adds a darkening effect based on the distance from the player
      const alpha = 1 - 1 / rayVector.dot(direction);

      // Set the fill style to a semi-transparent black color for shading
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;

      // Draw a shaded strip over the texture to simulate depth and lighting
      ctx.fillRect(
        Math.floor(screenX), // X position of the strip on the screen
        Math.floor((SCREEN_HEIGHT - wallHeight) * 0.5), // Y position, centered vertically
        Math.ceil(1), // Width of the strip (1 pixel)
        Math.ceil(wallHeight) // Height of the strip
      );
    }
  }
  ctx.restore();
}

async function renderGame(
  ctx: CanvasRenderingContext2D,
  player: Player,
  scene: Scene,
  showMinimap: boolean
) {
  const minimapSize = Math.min(ctx.canvas.width, ctx.canvas.height) * 0.3;
  const minimapPosition = new Vector2(
    (ctx.canvas.width - minimapSize) / 2,
    ctx.canvas.height - minimapSize - 10 // 10 pixels padding from the bottom
  );

  ctx.fillStyle = "#181818";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.fillStyle = "hsl(220, 20%, 30%)";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height / 2);
  // renderFloor(ctx, player, scene);
  // renderCeiling(ctx, player, scene);
  renderScene(ctx, player, scene);

  if (showMinimap) {
    renderMinimap(
      ctx,
      player,
      minimapPosition,
      new Vector2(minimapSize, minimapSize),
      scene
    );
  }

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
  // Calculate the coordinates of the top-left corner of the player's bounding box
  // Subtract half the player size to get the left edge and floor the result for grid alignment
  const leftTopCorner = newPosition
    .sub(Vector2.scalar(PLAYER_SIZE * 0.5))
    .map(Math.floor);

  // Calculate the coordinates of the bottom-right corner of the player's bounding box
  // Add half the player size to get the right edge and floor the result for grid alignment
  const rightBottomCorner = newPosition
    .add(Vector2.scalar(PLAYER_SIZE * 0.5))
    .map(Math.floor);

  // Loop through each grid cell within the bounding box of the player
  for (let x = leftTopCorner.x; x <= rightBottomCorner.x; ++x) {
    for (let y = leftTopCorner.y; y <= rightBottomCorner.y; ++y) {
      // Check if the current grid cell contains a wall
      if (scene.isWall(new Vector2(x, y))) {
        // If a wall is found, the player cannot move to this position
        return false;
      }
    }
  }

  // If no walls are found within the bounding box, the player can move to this position
  return true;
}

(async () => {
  //Hot Reload
  const isDev = window.location.hostname === "localhost";
  console.log(isDev);
  if (isDev) {
    const ws = new WebSocket("ws://localhost:8080");

    ws.addEventListener("message", (event) => {
      if (event.data === "reload") {
        window.location.reload();
      }
    });
  }

  const game = document.getElementById("game") as HTMLCanvasElement | null;
  if (game === null) throw new Error("No canvas with id `game` is found");

  function resizeGameCanvas(game: HTMLCanvasElement) {
    const aspectRatio = 16 / 9; // Aspect ratio for the game screen
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Maintain the 16:9 aspect ratio
    if (width / height > aspectRatio) {
      width = height * aspectRatio; // Limit width
    } else {
      height = width / aspectRatio; // Limit height
    }

    game.width = width;
    game.height = height;
  }

  // Resize canvas initially and on window resize, passing the `game` canvas
  resizeGameCanvas(game);
  window.addEventListener("resize", () => resizeGameCanvas(game));

  const ctx = game.getContext("2d");
  if (ctx === null) throw new Error("2D context is not supported");
  ctx.imageSmoothingEnabled = false;

  const wall1 = await loadImageData("assets/textures/wall1.png").catch(
    () => "brown"
  );
  const wall2 = await loadImageData("assets/textures/wall2.png").catch(
    () => "brown"
  );
  const wall3 = await loadImageData("assets/textures/wall3.png").catch(
    () => "brown"
  );
  const wall4 = await loadImageData("assets/textures/wall4.png").catch(
    () => "brown"
  );

  const door1 = await loadImageData("assets/textures/door1.png").catch(
    () => "grey"
  );

  const scene = new Scene([
    [
      wall1, wall1, wall1, wall2, wall1, wall1, wall3, wall1,
      wall3, wall1, wall1, wall1, wall4, wall1, wall1, wall1,
    ],
    [
      wall1, null, null, null, null, wall1, null, null,
      null, null, null, null, null, null, null, wall1,
    ],
    [
      wall1, null, wall1, wall1, null, wall1, null, wall1,
      wall3, wall1, null, wall1, wall1, null, null, wall1,
    ],
    [
      wall1, null, null, wall3, null, null, null, door1,
      null, null, null, null, wall4, null, null, wall3,
    ],
    [
      wall1, door1, wall1, wall1, null, wall1, null, wall1,
      wall4, wall1, null, wall1, wall1, null, wall1, wall1,
    ],
    [
      wall1, null, null, null, null, wall1, null, null,
      null, null, null, null, null, null, null, wall2,
    ],
    [
      wall2, null, wall1, wall4, wall1, wall1, null, wall1,
      wall3, wall2, wall1, null, wall1, wall1, null, wall1,
    ],
    [
      wall2, null, wall3, null, null, null, null, null,
      null, null, wall1, null, null, null, null, door1,
    ],
    [
      wall1, null, wall1, null, wall1, wall3, wall1, null,
      wall1, null, wall1, wall2, wall1, null, null, wall4,
    ],
    [
      wall3, null, null, null, null, null, null, null,
      wall1, null, null, null, null, null, null, wall1,
    ],
    [
      wall3, door1, wall1, wall1, null, wall1, wall1, wall1,
      wall1, wall1, null, wall1, wall4, wall3, wall1, wall1,
    ],
    [
      wall1, null, wall2, null, null, null, null, null,
      null, null, null, null, null, null, null, wall1,
    ],
    [
      wall2, null, wall1, null, wall1, wall3, wall1, wall2,
      wall1, wall2, wall1, null, null, null, wall1, wall1,
    ],
    [
      wall1, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, wall1,
    ],
    [
      wall1, wall1, wall3, wall1, wall2, wall2, wall1, wall3,
      door1, wall1, wall1, wall1, wall1, wall1, wall1, wall1,
    ],
  ]);
  
  let showMinimap = true;

  // Add event listener for the minimap checkbox
  const toggleMinimapCheckbox = document.getElementById("toggleMinimap") as HTMLInputElement;
  toggleMinimapCheckbox.addEventListener("change", (event) => {
    showMinimap = (event.target as HTMLInputElement).checked;
  });

  const player = new Player(
    scene.size().mul(new Vector2(0.5, 0.5)),
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
    const elapsedSeconds = (timestamp - prevTimestamp) / 1000;
    prevTimestamp = timestamp;

    let movement = Vector2.zero();
    let rotationSpeed = 0.0;

    // Update movement based on input
    const movementStep = Vector2.angle(player.direction).scale(PLAYER_SPEED);

    if (movingForward) {
      movement = movement.add(movementStep);
    }
    if (movingBackward) {
      movement = movement.sub(movementStep);
    }

    // Update rotation based on input
    if (turningLeft) {
      rotationSpeed -= Math.PI;
    }
    if (turningRight) {
      rotationSpeed += Math.PI;
    }

    // Update player's direction and position
    player.direction += rotationSpeed * elapsedSeconds;

    const newX = player.position.x + movement.x * elapsedSeconds;
    if (canPlayerGoThere(scene, new Vector2(newX, player.position.y))) {
      player.position.x = newX;
    }

    const newY = player.position.y + movement.y * elapsedSeconds;
    if (canPlayerGoThere(scene, new Vector2(player.position.x, newY))) {
      player.position.y = newY;
    }

    // Render the game
    renderGame(ctx, player, scene, showMinimap);

    // Request the next frame
    window.requestAnimationFrame(frame);
  };

  // Start the game loop
  window.requestAnimationFrame((timestamp) => {
    prevTimestamp = timestamp;
    window.requestAnimationFrame(frame);
  });
})();
