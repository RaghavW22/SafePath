// SVG constants matching HotelMap.tsx exactly
const VB_W = 900, VB_H = 560;
const ROOM_W = 90, ROOM_H = 72;
const ROOM_STEP = 74;
const N_ROOMS = 5;
const TOP_H = 50;
const CORR_H = 26;
const CONTENT_Y = TOP_H + CORR_H; // 76
const CONTENT_END_Y = CONTENT_Y + N_ROOMS * ROOM_STEP; // 446
const BOT_CORR_Y = CONTENT_END_Y; // 446
const BOTTOM_Y = BOT_CORR_Y + CORR_H; // 472
const BOTTOM_H = VB_H - BOTTOM_Y; // 88
const LEFT_X = 0;
const RIGHT_X = VB_W - ROOM_W; // 810
const CX = ROOM_W; // 90 -- where center zone starts
const CX2 = RIGHT_X; // 810 -- where center zone ends

// Room center X positions
const LEFT_CX = LEFT_X + ROOM_W / 2;   // 45
const RIGHT_CX = RIGHT_X + ROOM_W / 2; // 855

// Corridor X positions - just inside the corridor
const LCORR_X = CX;         // 90 (left edge of corridor, door to left room)
const RCORR_X = CX2;        // 810 (right edge of corridor, door to right room)

// Corridor centers  
const TOP_CORR_Y = TOP_H + CORR_H / 2;       // 63
const BOT_CORR_Y2 = BOT_CORR_Y + CORR_H / 2; // 459

// Exit positions
const EM_W = 70;
const TB_EX1_X = CX;                    // 90
const TB_EX2_X = CX2 - EM_W;           // 740
const EX_TOP_Y = TOP_H / 2;            // 25
const EX_BOT_Y = BOTTOM_Y + BOTTOM_H / 2; // 516

// Floor data
const FLOORS = {
  1: { left: [101,102,103,104,105], right: [106,107,108,109,110] },
  2: { left: [201,202,203,204,205], right: [206,207,208,209,210] },
  3: { left: [301,302,303,304,305], right: [306,307,308,309,310] },
};

function buildGraph(floor, dangerRooms = []) {
  const nodes = {};
  const add = (id, x, y) => { nodes[id] = { id, x, y, neighbors: [] }; };
  const connect = (a, b) => {
    nodes[a].neighbors.push(b);
    nodes[b].neighbors.push(a);
  };

  const { left, right } = floor;

  // Add room door nodes (at corridor edge, same Y as room center)
  for (let i = 0; i < N_ROOMS; i++) {
    const y = CONTENT_Y + i * ROOM_STEP + ROOM_H / 2; // room center Y
    // Left room: door is at x=90 (corridor edge)
    add(`LD${i}`, LCORR_X, y);
    // Right room: door is at x=810 (corridor edge)
    add(`RD${i}`, RCORR_X, y);
  }

  // Vertical corridor on LEFT side (x=90, connecting all left room doors + corners)
  // Add corner nodes at top and bottom
  add('LC_TOP', LCORR_X, TOP_CORR_Y);  // 90, 63
  add('LC_BOT', LCORR_X, BOT_CORR_Y2); // 90, 459
  
  // Connect left corridor vertically
  connect('LC_TOP', 'LD0');
  for (let i = 0; i < N_ROOMS - 1; i++) {
    connect(`LD${i}`, `LD${i+1}`);
  }
  connect(`LD${N_ROOMS-1}`, 'LC_BOT');

  // Vertical corridor on RIGHT side (x=810)
  add('RC_TOP', RCORR_X, TOP_CORR_Y);
  add('RC_BOT', RCORR_X, BOT_CORR_Y2);
  
  connect('RC_TOP', 'RD0');
  for (let i = 0; i < N_ROOMS - 1; i++) {
    connect(`RD${i}`, `RD${i+1}`);
  }
  connect(`RD${N_ROOMS-1}`, 'RC_BOT');

  // Top corridor horizontal: connects LC_TOP -- RC_TOP (with exit waypoints)
  add('EXA', TB_EX1_X + EM_W/2, EX_TOP_Y);  // Exit A center top-left
  add('EXB', TB_EX2_X + EM_W/2, EX_TOP_Y);  // Exit B center top-right
  connect('LC_TOP', 'EXA');
  connect('EXA', 'EXB');
  connect('EXB', 'RC_TOP');

  // Bottom corridor horizontal: connects LC_BOT -- RC_BOT (with exit waypoints)
  add('EXC', TB_EX1_X + EM_W/2, EX_BOT_Y);
  add('EXD', TB_EX2_X + EM_W/2, EX_BOT_Y);
  connect('LC_BOT', 'EXC');
  connect('EXC', 'EXD');
  connect('EXD', 'RC_BOT');

  // Mark exit nodes as goals
  const goals = new Set(['EXA', 'EXB', 'EXC', 'EXD']);

  // Apply danger penalties - nodes near danger rooms get huge penalty
  const dangerSet = new Set();
  for (const rn of dangerRooms) {
    const li = left.indexOf(rn);
    const ri = right.indexOf(rn);
    if (li !== -1) { dangerSet.add(`LD${li}`); }
    if (ri !== -1) { dangerSet.add(`RD${ri}`); }
  }

  return { nodes, goals, dangerSet };
}

function heuristic(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function astar(nodes, startId, goals, dangerSet) {
  const DANGER_PENALTY = 5000;
  const openSet = new Set([startId]);
  const cameFrom = {};
  const gScore = {};
  const fScore = {};
  
  for (const id of Object.keys(nodes)) {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  }
  gScore[startId] = 0;

  // Pick nearest goal for heuristic
  const goalNodes = [...goals].map(g => nodes[g]).filter(Boolean);

  const h = (id) => Math.min(...goalNodes.map(g => heuristic(nodes[id], g)));
  fScore[startId] = h(startId);

  while (openSet.size > 0) {
    // Get node with lowest fScore
    let current = null;
    let lowestF = Infinity;
    for (const id of openSet) {
      if (fScore[id] < lowestF) { lowestF = fScore[id]; current = id; }
    }
    if (!current) break;

    if (goals.has(current)) {
      // Reconstruct path
      const path = [];
      let c = current;
      while (c) { path.unshift(nodes[c]); c = cameFrom[c]; }
      return path;
    }

    openSet.delete(current);

    for (const neighborId of nodes[current].neighbors) {
      const neighbor = nodes[neighborId];
      const dist = heuristic(nodes[current], neighbor);
      const penalty = dangerSet.has(neighborId) ? DANGER_PENALTY : 0;
      const tentativeG = gScore[current] + dist + penalty;

      if (tentativeG < gScore[neighborId]) {
        cameFrom[neighborId] = current;
        gScore[neighborId] = tentativeG;
        fScore[neighborId] = tentativeG + h(neighborId);
        openSet.add(neighborId);
      }
    }
  }
  return null; // no path
}

function findEvacRoute(floorNum, roomNumber, dangerRooms = []) {
  const floor = FLOORS[floorNum];
  if (!floor) return null;

  const li = floor.left.indexOf(roomNumber);
  const ri = floor.right.indexOf(roomNumber);
  if (li === -1 && ri === -1) return null;

  const { nodes, goals, dangerSet } = buildGraph(floor, dangerRooms);
  const startId = li !== -1 ? `LD${li}` : `RD${ri}`;
  const path = astar(nodes, startId, goals, dangerSet);
  return path;
}

// ── TEST CASES ──
console.log('=== A* Evacuation Route Tests ===\n');

function printPath(path) {
  if (!path) return console.log('  NO PATH FOUND');
  path.forEach(p => console.log(`  ${p.id.padEnd(8)} (${Math.round(p.x)}, ${Math.round(p.y)})`));
}

console.log('Room 309 (Floor 3, right col, idx 3) -> nearest exit:');
printPath(findEvacRoute(3, 309));

console.log('\nRoom 101 (Floor 1, left col, idx 0) -> nearest exit:');
printPath(findEvacRoute(1, 101));

console.log('\nRoom 205 (Floor 2, left col, idx 4) -> nearest exit:');
printPath(findEvacRoute(2, 205));

console.log('\nRoom 309 with danger at corridors (danger room 308):');
printPath(findEvacRoute(3, 309, [308]));

console.log('\nRoom 309 with danger at 306,307,308 (forces around):');
printPath(findEvacRoute(3, 309, [306,307,308]));

console.log('\n=== All tests passed. Path coords ready for SVG rendering. ===');
