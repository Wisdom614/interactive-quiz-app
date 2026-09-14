/**
 * Blocus (Dots / Jeu des Points) - Mathematics Paper Enclosure Engine
 * Faithful implementation of the Cameroonian & international paper-and-pencil game.
 * 
 * Intersections of mathematics graph paper are the playable spots.
 * Players take turns placing permanent ink dots.
 * Creating closed boundaries of 8-adjacent dots encircles and captures opposing dots and territory.
 * Captured dots remain visible on paper with ownership indicated by colour shading.
 * Enclosures can be recaptured by outer surrounding perimeters.
 */

export type BlocusColor = 'blue' | 'red' | 'green';

export interface BlocusPosition {
  x: number;
  y: number;
}

export interface BlocusDot {
  x: number;
  y: number;
  originalOwner: BlocusColor;
  currentOwner: BlocusColor;
  enclosedBy?: BlocusColor | null;
  placedAtTurn: number;
}

export interface BlocusEnclosure {
  id: string;
  owner: BlocusColor;
  polygon: [number, number][]; // Ordered perimeter vertices for rendering
  capturedDotKeys: string[];   // "x,y" keys of enemy dots captured inside
  interiorPoints: [number, number][];
  createdAtTurn: number;
}

export interface BlocusGridPreset {
  id: 'pocket' | 'standard' | 'grand';
  label: string;
  width: number;
  height: number;
  defaultWinTarget: number;
}

export const BLOCUS_GRID_PRESETS: Record<string, BlocusGridPreset> = {
  pocket: {
    id: 'pocket',
    label: 'Pocket Sheet (15×15)',
    width: 15,
    height: 15,
    defaultWinTarget: 8,
  },
  standard: {
    id: 'standard',
    label: 'Standard Notebook (21×21)',
    width: 21,
    height: 21,
    defaultWinTarget: 15,
  },
  grand: {
    id: 'grand',
    label: 'Double Page Grand (29×29)',
    width: 29,
    height: 29,
    defaultWinTarget: 25,
  },
};

export interface BlocusGameState {
  width: number;
  height: number;
  dots: Record<string, BlocusDot>; // "x,y" -> BlocusDot
  enclosures: BlocusEnclosure[];
  currentTurn: BlocusColor;
  turnOrder: BlocusColor[]; // ['blue', 'red'] or ['blue', 'red', 'green']
  moveCount: number;
  scores: Record<BlocusColor, number>; // Live count of captured opponent dots
  winTarget: number;
  winner: BlocusColor | 'draw' | null;
  winReason: string | null;
  lastMove?: { x: number; y: number; color: BlocusColor; isRecapture?: boolean; newlyCaptured?: number } | null;
}

export function posToKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function keyToPos(key: string): BlocusPosition {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

/**
 * Creates a fresh game state
 */
export function createInitialBlocusState(options?: {
  preset?: 'pocket' | 'standard' | 'grand';
  customWidth?: number;
  customHeight?: number;
  winTarget?: number;
  playerCount?: 2 | 3;
}): BlocusGameState {
  const presetKey = options?.preset || 'standard';
  const preset = BLOCUS_GRID_PRESETS[presetKey] || BLOCUS_GRID_PRESETS.standard;
  const width = options?.customWidth || preset.width;
  const height = options?.customHeight || preset.height;
  const winTarget = options?.winTarget || preset.defaultWinTarget;
  const playerCount = options?.playerCount || 2;

  const turnOrder: BlocusColor[] = playerCount === 3 ? ['blue', 'red', 'green'] : ['blue', 'red'];

  return {
    width,
    height,
    dots: {},
    enclosures: [],
    currentTurn: 'blue',
    turnOrder,
    moveCount: 0,
    scores: {
      blue: 0,
      red: 0,
      green: 0,
    },
    winTarget,
    winner: null,
    winReason: null,
    lastMove: null,
  };
}

/**
 * Checks if coordinate is inside grid boundaries
 */
export function isWithinBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * Checks if two positions are 8-adjacent (orthogonal or diagonal, distance <= 1.42)
 */
export function is8Adjacent(p1: BlocusPosition, p2: BlocusPosition): boolean {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1) || (dx === 1 && dy === 1);
}

/**
 * Adjacent dots always form a trace. A player's dots must not be prevented
 * from joining merely because the other two corners of the square contain
 * opponent dots: dots do not constitute a drawn crossing by themselves.
 */
export function canConnectDiagonally(
  _p1: BlocusPosition,
  _p2: BlocusPosition,
  _dots: Record<string, BlocusDot>,
  _color: BlocusColor
): boolean {
  return true;
}

/**
 * Returns all valid 8-adjacent neighbor dots belonging to the same player
 */
export function getConnectedFriendlyNeighbors(
  pos: BlocusPosition,
  dots: Record<string, BlocusDot>,
  color: BlocusColor,
  width: number,
  height: number
): BlocusPosition[] {
  const neighbors: BlocusPosition[] = [];
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  for (const { dx, dy } of directions) {
    const nx = pos.x + dx;
    const ny = pos.y + dy;
    if (!isWithinBounds(nx, ny, width, height)) continue;

    const neighborDot = dots[posToKey(nx, ny)];
    if (neighborDot && neighborDot.currentOwner === color) {
      if (canConnectDiagonally(pos, { x: nx, y: ny }, dots, color)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  }

  return neighbors;
}

/**
 * Returns each ink stroke that makes up a player's visible trace.
 *
 * The game has always treated adjacent dots as a continuous barrier while
 * detecting enclosures. Exposing those barriers lets the board show players
 * the line they are drawing before the final loop captures a seed.
 */
export function getBlocusTraceSegments(
  dots: Record<string, BlocusDot>,
  width: number,
  height: number
): { from: BlocusPosition; to: BlocusPosition; color: BlocusColor }[] {
  const segments: { from: BlocusPosition; to: BlocusPosition; color: BlocusColor }[] = [];

  for (const dot of Object.values(dots)) {
    const from = { x: dot.x, y: dot.y };
    const neighbors = getConnectedFriendlyNeighbors(from, dots, dot.currentOwner, width, height);

    for (const to of neighbors) {
      // Keep one canonical direction so each segment is rendered once.
      if (from.x < to.x || (from.x === to.x && from.y < to.y)) {
        segments.push({ from, to, color: dot.currentOwner });
      }
    }
  }

  return segments;
}

/**
 * Topological Dual Flood Fill to detect enclosures:
 * Floods from the grid perimeter. Any points (and enemy dots) that cannot reach the perimeter
 * without crossing the player's connected barrier are enclosed!
 */
export function detectEnclosuresForPlayer(
  dots: Record<string, BlocusDot>,
  color: BlocusColor,
  width: number,
  height: number
): {
  enclosedClusters: { interior: [number, number][]; perimeter: [number, number][] }[];
} {
  // Build a 2D barrier matrix for player 'color'
  // High-resolution dual grid (2*W-1) x (2*H-1) to accurately block diagonal connections without leaks
  const resX = width * 2 - 1;
  const resY = height * 2 - 1;
  const blocked = new Uint8Array(resX * resY);

  // 1. Mark player's dots as blocked
  for (const key in dots) {
    const dot = dots[key];
    if (dot.currentOwner === color) {
      const gx = dot.x * 2;
      const gy = dot.y * 2;
      blocked[gy * resX + gx] = 1;
    }
  }

  // 2. Mark connections between adjacent friendly dots as blocked
  for (const key in dots) {
    const dot = dots[key];
    if (dot.currentOwner === color) {
      const p1 = { x: dot.x, y: dot.y };
      const friends = getConnectedFriendlyNeighbors(p1, dots, color, width, height);
      for (const p2 of friends) {
        // Only process each edge once
        if (p1.x < p2.x || (p1.x === p2.x && p1.y < p2.y)) {
          const midX = p1.x + p2.x; // (x1*2 + x2*2)/2 in fine grid
          const midY = p1.y + p2.y;
          blocked[midY * resX + midX] = 1;
        }
      }
    }
  }

  // 3. Flood fill from outer boundaries of the fine grid
  const visited = new Uint8Array(resX * resY);
  const queue: number[] = [];

  // Enqueue all boundary coordinates of the fine grid that are not blocked
  for (let x = 0; x < resX; x++) {
    if (!blocked[0 * resX + x]) {
      visited[0 * resX + x] = 1;
      queue.push(x, 0);
    }
    const bottomY = resY - 1;
    if (!blocked[bottomY * resX + x]) {
      visited[bottomY * resX + x] = 1;
      queue.push(x, bottomY);
    }
  }
  for (let y = 0; y < resY; y++) {
    if (!blocked[y * resX + 0]) {
      visited[y * resX + 0] = 1;
      queue.push(0, y);
    }
    const rightX = resX - 1;
    if (!blocked[y * resX + rightX]) {
      visited[y * resX + rightX] = 1;
      queue.push(rightX, y);
    }
  }

  let head = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < resX && ny >= 0 && ny < resY) {
        const idx = ny * resX + nx;
        if (!visited[idx] && !blocked[idx]) {
          visited[idx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // 4. Any original grid intersection (even coordinates x*2, y*2) that was NOT visited
  // and is NOT part of the player's own barrier is ENCLOSED!
  const enclosedSet = new Set<string>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fineIdx = y * 2 * resX + x * 2;
      const existingDot = dots[posToKey(x, y)];
      // If it wasn't reached by outside flood fill and isn't the player's own dot:
      if (!visited[fineIdx] && (!existingDot || existingDot.currentOwner !== color)) {
        enclosedSet.add(posToKey(x, y));
      }
    }
  }

  if (enclosedSet.size === 0) {
    return { enclosedClusters: [] };
  }

  // 5. Group enclosed points into connected components
  const components: [number, number][][] = [];
  const processed = new Set<string>();

  for (const key of enclosedSet) {
    if (processed.has(key)) continue;

    const comp: [number, number][] = [];
    const compQueue = [keyToPos(key)];
    processed.add(key);

    while (compQueue.length > 0) {
      const curr = compQueue.shift()!;
      comp.push([curr.x, curr.y]);

      // Check 4-orthogonal neighbors
      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 },
      ];

      for (const n of neighbors) {
        const nKey = posToKey(n.x, n.y);
        if (enclosedSet.has(nKey) && !processed.has(nKey)) {
          processed.add(nKey);
          compQueue.push(n);
        }
      }
    }

    components.push(comp);
  }

  // 6. For each component, find its enclosing perimeter of friendly dots
  const enclosedClusters: { interior: [number, number][]; perimeter: [number, number][] }[] = [];

  for (const comp of components) {
    // Find all player's dots adjacent to this component
    const boundarySet = new Set<string>();
    for (const [cx, cy] of comp) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bx = cx + dx;
          const by = cy + dy;
          if (isWithinBounds(bx, by, width, height)) {
            const bDot = dots[posToKey(bx, by)];
            if (bDot && bDot.currentOwner === color) {
              boundarySet.add(posToKey(bx, by));
            }
          }
        }
      }
    }

    if (boundarySet.size >= 4) {
      // Order perimeter vertices into a simple polygon
      const perimeterPoints = orderPerimeterPolygon(Array.from(boundarySet).map(keyToPos));
      enclosedClusters.push({
        interior: comp,
        perimeter: perimeterPoints,
      });
    }
  }

  return { enclosedClusters };
}

/**
 * Orders a set of boundary points into a coherent perimeter polygon (clockwise order)
 */
function orderPerimeterPolygon(points: BlocusPosition[]): [number, number][] {
  if (points.length <= 3) {
    return points.map((p) => [p.x, p.y]);
  }

  // Center of mass
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  // Sort by polar angle from centroid
  const sorted = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  return sorted.map((p) => [p.x, p.y]);
}

/**
 * Places an ink dot on the paper, updates enclosures, recalculates scores, and checks victory.
 */
export function placeBlocusDot(
  state: BlocusGameState,
  x: number,
  y: number
): {
  success: boolean;
  error?: string;
  newState: BlocusGameState;
  newCapturesCount: number;
  isRecapture: boolean;
} {
  const key = posToKey(x, y);

  if (!isWithinBounds(x, y, state.width, state.height)) {
    return { success: false, error: 'OUT_OF_BOUNDS', newState: state, newCapturesCount: 0, isRecapture: false };
  }

  if (state.dots[key]) {
    return { success: false, error: 'POSITION_OCCUPIED', newState: state, newCapturesCount: 0, isRecapture: false };
  }

  if (state.winner) {
    return { success: false, error: 'GAME_OVER', newState: state, newCapturesCount: 0, isRecapture: false };
  }

  const activeColor = state.currentTurn;
  // A move may also be simulated for AI and UI previews. Clone individual dots
  // as well as the record so those simulations can never mutate live state.
  const newDots: Record<string, BlocusDot> = Object.fromEntries(
    Object.entries(state.dots).map(([dotKey, dot]) => [dotKey, { ...dot }])
  );

  // Place permanent dot
  newDots[key] = {
    x,
    y,
    originalOwner: activeColor,
    currentOwner: activeColor,
    enclosedBy: null,
    placedAtTurn: state.moveCount + 1,
  };

  // Run enclosure detection for active color
  const { enclosedClusters } = detectEnclosuresForPlayer(newDots, activeColor, state.width, state.height);

  let newCapturesCount = 0;
  let isRecapture = false;
  const newEnclosures: BlocusEnclosure[] = [...state.enclosures];

  for (const cluster of enclosedClusters) {
    const capturedKeys: string[] = [];

    for (const [ix, iy] of cluster.interior) {
      const dotKey = posToKey(ix, iy);
      const interiorDot = newDots[dotKey];

      if (interiorDot && interiorDot.currentOwner !== activeColor) {
        capturedKeys.push(dotKey);
        // Check if this was previously captured (Recapture!)
        if (interiorDot.enclosedBy && interiorDot.enclosedBy !== activeColor) {
          isRecapture = true;
        }
        // Transfer ownership / enclose
        interiorDot.currentOwner = activeColor;
        interiorDot.enclosedBy = activeColor;
        newCapturesCount++;
      }
    }

    // Only create visual enclosure boundary if it captures opponent dots or territory
    if (capturedKeys.length > 0) {
      const enclosureId = `enc-${activeColor}-${state.moveCount + 1}-${Math.random().toString(36).substring(2, 6)}`;
      newEnclosures.push({
        id: enclosureId,
        owner: activeColor,
        polygon: cluster.perimeter,
        capturedDotKeys: capturedKeys,
        interiorPoints: cluster.interior,
        createdAtTurn: state.moveCount + 1,
      });
    }
  }

  // Recalculate live scores for all players based on current captures
  const scores: Record<BlocusColor, number> = { blue: 0, red: 0, green: 0 };
  for (const dKey in newDots) {
    const d = newDots[dKey];
    if (d.enclosedBy && d.originalOwner !== d.enclosedBy) {
      scores[d.enclosedBy] = (scores[d.enclosedBy] || 0) + 1;
    }
  }

  // Check victory condition
  let winner: BlocusColor | 'draw' | null = null;
  let winReason: string | null = null;

  if (scores[activeColor] >= state.winTarget) {
    winner = activeColor;
    winReason = `Reached target of ${state.winTarget} captured dots!`;
  }

  // Capturing an opponent seed earns an immediate bonus placement. Otherwise,
  // play passes normally to the next colour in the turn order.
  const currentIndex = state.turnOrder.indexOf(activeColor);
  const nextTurn = newCapturesCount > 0
    ? activeColor
    : state.turnOrder[(currentIndex + 1) % state.turnOrder.length];

  const newState: BlocusGameState = {
    ...state,
    dots: newDots,
    enclosures: newEnclosures,
    currentTurn: nextTurn,
    moveCount: state.moveCount + 1,
    scores,
    winner,
    winReason,
    lastMove: {
      x,
      y,
      color: activeColor,
      isRecapture,
      newlyCaptured: newCapturesCount,
    },
  };

  return {
    success: true,
    newState,
    newCapturesCount,
    isRecapture,
  };
}

/**
 * Pass turn if no safe moves remain
 */
export function passTurn(state: BlocusGameState): BlocusGameState {
  const currentIndex = state.turnOrder.indexOf(state.currentTurn);
  const nextTurn = state.turnOrder[(currentIndex + 1) % state.turnOrder.length];

  return {
    ...state,
    currentTurn: nextTurn,
    moveCount: state.moveCount + 1,
  };
}

/**
 * Calculates endgame territory tally when both players pass or paper is full
 */
export function evaluateEndgameTally(state: BlocusGameState): {
  winner: BlocusColor | 'draw';
  finalScores: Record<BlocusColor, number>;
} {
  const finalScores: Record<BlocusColor, number> = { blue: 0, red: 0, green: 0 };

  // Points = 2 points per captured dot + 1 point per enclosed empty intersection
  for (const key in state.dots) {
    const dot = state.dots[key];
    if (dot.enclosedBy && dot.originalOwner !== dot.enclosedBy) {
      finalScores[dot.enclosedBy] += 2;
    }
  }

  for (const enc of state.enclosures) {
    finalScores[enc.owner] += enc.interiorPoints.length;
  }

  let maxScore = -1;
  let winner: BlocusColor | 'draw' = 'draw';

  for (const player of state.turnOrder) {
    if (finalScores[player] > maxScore) {
      maxScore = finalScores[player];
      winner = player;
    } else if (finalScores[player] === maxScore) {
      winner = 'draw';
    }
  }

  return { winner, finalScores };
}

/**
 * AI "Schoolyard Bot" heuristic move generator
 */
export function getBlocusAIMove(
  state: BlocusGameState,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM',
  aiColor: BlocusColor = 'red'
): BlocusPosition {
  const width = state.width;
  const height = state.height;

  // 1. Collect all vacant intersections
  const vacant: BlocusPosition[] = [];
  const candidateScores: { pos: BlocusPosition; score: number }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = posToKey(x, y);
      if (!state.dots[key]) {
        vacant.push({ x, y });
      }
    }
  }

  if (vacant.length === 0) {
    return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  }

  // If opening move (very few dots on board), pick near center
  if (state.moveCount < 3) {
    const midX = Math.floor(width / 2);
    const midY = Math.floor(height / 2);
    const centerCandidates = vacant.filter(
      (p) => Math.abs(p.x - midX) <= 3 && Math.abs(p.y - midY) <= 3
    );
    if (centerCandidates.length > 0) {
      return centerCandidates[Math.floor(Math.random() * centerCandidates.length)];
    }
  }

  // 2. Score candidates based on:
  // - Immediate Capture! (Simulate move and check if newCapturesCount > 0)
  // - Threat Block! (Did opponent just move nearby?)
  // - Chain Formation (8-adjacency with friendly dots)
  const oppColor = state.turnOrder.find((c) => c !== aiColor) || 'blue';

  for (const pos of vacant) {
    let score = 0;

    // Simulation check for immediate capture
    if (difficulty !== 'EASY') {
      const testResult = placeBlocusDot(state, pos.x, pos.y);
      if (testResult.newCapturesCount > 0) {
        score += 1000 * testResult.newCapturesCount;
      }
      if (testResult.isRecapture) {
        score += 2500;
      }
    }

    // Distance to friendly dots & opponent dots
    let friendlyAdj = 0;
    let enemyAdj = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = pos.x + dx;
        const ny = pos.y + dy;
        const neighbor = state.dots[posToKey(nx, ny)];
        if (neighbor) {
          if (neighbor.currentOwner === aiColor) friendlyAdj++;
          if (neighbor.currentOwner === oppColor) enemyAdj++;
        }
      }
    }

    // Prefer creating encircling arcs (1 to 3 friendly neighbors)
    if (friendlyAdj === 1) score += 40;
    if (friendlyAdj === 2) score += 80;
    if (friendlyAdj === 3) score += 60; // 3 neighbors close to loop

    // Prefer positioning near opponent dots to start surrounding them
    if (enemyAdj > 0) {
      score += enemyAdj * 50;
    }

    // Center bias
    const distFromCenter = Math.hypot(pos.x - width / 2, pos.y - height / 2);
    score -= distFromCenter * 2;

    candidateScores.push({ pos, score });
  }

  candidateScores.sort((a, b) => b.score - a.score);

  if (difficulty === 'EASY') {
    // Novice: pick from top 30% with noise
    const topN = Math.min(candidateScores.length, 6);
    return candidateScores[Math.floor(Math.random() * topN)].pos;
  }

  // Medium / Hard: pick highest scoring move
  return candidateScores[0].pos;
}
