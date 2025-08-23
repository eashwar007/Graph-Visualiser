const canvas = document.getElementById('treeCanvas');
const ctx = canvas.getContext('2d');
const maxNodes = 20;

function validateTree(n, edges, root) {
    if (root < 1 || root > n) return "Root must be between 1 and " + n;
    if (n > maxNodes) return "Number of nodes exceeds maximum limit of " + maxNodes;

    if (edges.length !== n - 1) {
        return "A tree with " + n + " nodes must have exactly " + (n - 1) + " edges";
    }

    const adjList = Array.from({ length: n + 1 }, () => []);
    for (let [u, v] of edges) {
        if (u < 1 || u > n || v < 1 || v > n) return "Invalid node in edge";
        adjList[u].push(v);
        adjList[v].push(u); // undirected for validation
    }

    // BFS/DFS to check connectivity and cycles
    const visited = Array(n + 1).fill(false);
    const queue = [[root, -1]];
    visited[root] = true;
    let count = 0;

    while (queue.length > 0) {
        const [node, parent] = queue.shift();
        count++;

        for (let neighbor of adjList[node]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                queue.push([neighbor, node]);
            } else if (neighbor !== parent) {
                return "Cycle detected in the graph";
            }
        }
    }

    if (count !== n) return "Not all nodes are reachable from the root";
    return "";
}

function assignCoordinates(n, edges, root) {
    // Build undirected adjacency
    const adjList = Array.from({ length: n + 1 }, () => []);
    for (let [u, v] of edges) {
        adjList[u].push(v);
        adjList[v].push(u); // undirected for traversal
    }

    // Rebuild a directed tree (root → children)
    const directed = Array.from({ length: n + 1 }, () => []);
    const levels = Array(n + 1).fill(-1);
    const queue = [root];
    levels[root] = 0;
    let maxLevel = 0;

    while (queue.length > 0) {
        const node = queue.shift();
        for (let neighbor of adjList[node]) {
            if (levels[neighbor] === -1) {
                levels[neighbor] = levels[node] + 1;
                maxLevel = Math.max(maxLevel, levels[neighbor]);
                directed[node].push(neighbor);  // orient edge root → child
                queue.push(neighbor);
            }
        }
    }

    // Count nodes per level
    const nodesPerLevel = Array(maxLevel + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        if (levels[i] >= 0) nodesPerLevel[levels[i]]++;
    }

    // Resize canvas
    const levelWidths = nodesPerLevel.map(count => count * 80);
    const canvasWidth = Math.max(...levelWidths, 800);
    const canvasHeight = (maxLevel + 1) * 120;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Assign coordinates
    const coords = Array(n + 1).fill().map(() => ({ x: 0, y: 0 }));
    const levelOffsets = Array(maxLevel + 1).fill(0);

    for (let i = 1; i <= n; i++) {
        if (levels[i] >= 0) {
            const level = levels[i];
            const x = (canvasWidth / (nodesPerLevel[level] + 1)) * (levelOffsets[level] + 1);
            const y = level * 120 + 60;
            coords[i] = { x, y };
            levelOffsets[level]++;
        }
    }

    return { coords, directed };
}


function drawTree(coords, edges, n) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    ctx.strokeStyle = '#8e24aa';
    ctx.lineWidth = 3;
    for (let [u, v] of edges) {
        ctx.beginPath();
        ctx.moveTo(coords[u].x, coords[u].y);
        ctx.lineTo(coords[v].x, coords[v].y);
        ctx.stroke();
    }

    // Draw nodes
    for (let i = 1; i <= n; i++) {
        if (coords[i].x === 0 && coords[i].y === 0) continue;

        // Node circle
        ctx.beginPath();
        ctx.fillStyle = '#ab47bc';
        ctx.arc(coords[i].x, coords[i].y, 22, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#6a1b9a';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Node number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, coords[i].x, coords[i].y);
    }
}

function visualizeTree() {
  const nodes = parseInt(document.getElementById("nodes").value);
  const root = parseInt(document.getElementById("root").value);
  const edgesInput = document.getElementById("edges").value.trim();
  const errorEl = document.getElementById("error");
  const canvas = document.getElementById("treeCanvas");
  const ctx = canvas.getContext("2d");

  errorEl.textContent = "";

  // Resize canvas dynamically
  canvas.width = canvas.parentElement.clientWidth - 40;
  canvas.height = canvas.parentElement.clientHeight - 40;

  // Validation
  if (isNaN(nodes) || isNaN(root) || !edgesInput) {
    errorEl.textContent = "⚠️ Please enter valid nodes, root, and edges.";
    return;
  }

  if (nodes > 15) {
    errorEl.textContent = "⚠️ Too many nodes! Please enter 15 or fewer.";
    return;
  }

  // Build adjacency list
  const edges = edgesInput.split(",").map(e => e.trim().split(" ").map(Number));
  const adj = Array.from({ length: nodes + 1 }, () => []);
  for (let [u, v] of edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  // BFS to assign levels
  const levels = {};
  const visited = new Set();
  const queue = [[root, 0]];
  visited.add(root);
  while (queue.length) {
    const [node, depth] = queue.shift();
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    for (let nei of adj[node]) {
      if (!visited.has(nei)) {
        visited.add(nei);
        queue.push([nei, depth + 1]);
      }
    }
  }

  // Drawing
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "16px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const depthKeys = Object.keys(levels).map(Number);
  const vSpacing = canvas.height / (depthKeys.length + 1);
  const nodePositions = {};

  depthKeys.forEach((depth, i) => {
    const nodesAtLevel = levels[depth];
    const hSpacing = canvas.width / (nodesAtLevel.length + 1);
    nodesAtLevel.forEach((node, j) => {
      const x = (j + 1) * hSpacing;
      const y = (i + 1) * vSpacing;
      nodePositions[node] = [x, y];
    });
  });

  // Draw edges
  ctx.strokeStyle = "#8e24aa";
  ctx.lineWidth = 3;
  for (let [u, v] of edges) {
    if (nodePositions[u] && nodePositions[v]) {
      ctx.beginPath();
      ctx.moveTo(...nodePositions[u]);
      ctx.lineTo(...nodePositions[v]);
      ctx.stroke();
    }
  }

  // Draw nodes
  for (let node in nodePositions) {
    const [x, y] = nodePositions[node];
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#ab47bc";
    ctx.fill();
    ctx.strokeStyle = "#6a1b9a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.fillText(node, x, y);
  }
}


