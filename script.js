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
    const adjList = Array.from({ length: n + 1 }, () => []);
    for (let [u, v] of edges) {
        adjList[u].push(v);
    }

    const coords = Array(n + 1).fill().map(() => ({ x: 0, y: 0 }));
    const levels = Array(n + 1).fill(-1);
    const queue = [[root, 0]];
    levels[root] = 0;
    let maxLevel = 0;

    while (queue.length > 0) {
        const [node, level] = queue.shift();
        maxLevel = Math.max(maxLevel, level);
        for (let child of adjList[node]) {
            levels[child] = level + 1;
            queue.push([child, level + 1]);
        }
    }

    const nodesPerLevel = Array(maxLevel + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        if (levels[i] >= 0) nodesPerLevel[levels[i]]++;
    }

    const levelWidths = nodesPerLevel.map(count => count * 80);
    const canvasWidth = Math.max(...levelWidths, 800);
    const canvasHeight = (maxLevel + 1) * 120;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

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

    return coords;
}

function drawTree(coords, edges, n) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
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
        ctx.fillStyle = '#2e7d32';
        ctx.arc(coords[i].x, coords[i].y, 20, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
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
    const errorElement = document.getElementById('error');
    errorElement.textContent = '';

    const n = parseInt(document.getElementById('nodes').value);
    const root = parseInt(document.getElementById('root').value);
    const edgesInput = document.getElementById('edges').value.trim();
    const edgePairs = edgesInput ? edgesInput.split(',').map(pair => pair.trim().split(/\s+/).map(Number)) : [];

    if (!n || isNaN(n) || !root || isNaN(root)) {
        errorElement.textContent = "Please enter valid number of nodes and root";
        return;
    }

    const error = validateTree(n, edgePairs, root);
    if (error) {
        errorElement.textContent = error;
        return;
    }

    const coords = assignCoordinates(n, edgePairs, root);
    drawTree(coords, edgePairs, n);
}
