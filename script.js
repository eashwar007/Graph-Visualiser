const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

class GraphVisualizer {
  constructor() {
    this.nodes = [];
    this.edges = [];
    this.isDirected = false;
    this.showLabels = true;
    this.showBridges = false;
    this.showSCC = false;
    this.bridges = [];
    this.sccs = [];
    this.sccColors = []; // Will be dynamically generated
    
    // Zoom and pan properties
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.baseRadius = 25;
    
    // Setup mouse events for zoom
    this.setupZoomControls();
  }

  // Generate unlimited distinct colors using HSL color space
  generateSCCColors(numSCCs) {
    this.sccColors = [];
    
    if (numSCCs === 0) return;
    
    // Use golden angle for better color distribution
    const goldenAngle = 137.508; // degrees
    
    for (let i = 0; i < numSCCs; i++) {
      // Distribute hues evenly around color wheel
      const hue = (i * goldenAngle) % 360;
      
      // Vary saturation and lightness for better distinction
      const saturation = 60 + (i % 3) * 15; // 60%, 75%, 90%
      const lightness = 45 + (i % 4) * 10;  // 45%, 55%, 65%, 75%
      
      // Convert HSL to hex color
      const color = this.hslToHex(hue, saturation, lightness);
      this.sccColors.push(color);
    }
  }

  // Convert HSL to hex color
  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  setupZoomControls() {
    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 0.1;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (e.deltaY < 0) {
        // Zoom in - allow up to 5x zoom
        this.zoom = Math.min(this.zoom * (1 + zoomFactor), 5);
      } else {
        // Zoom out - allow down to 0.05x for very large graphs
        this.zoom = Math.max(this.zoom * (1 - zoomFactor), 0.05);
      }
      
      this.draw();
    });

    // Double click to reset zoom to optimal for current graph
    canvas.addEventListener('dblclick', () => {
      this.zoom = this.calculateOptimalZoom(this.nodes.length);
      this.offsetX = 0;
      this.offsetY = 0;
      this.draw();
    });
  }

  // Calculate optimal zoom based on number of nodes - simple version
  calculateOptimalZoom(nodeCount) {
    if (nodeCount <= 10) return 1;
    if (nodeCount <= 20) return 0.8;
    if (nodeCount <= 30) return 0.6;
    if (nodeCount <= 40) return 0.5;
    return 0.4; // For 41-50 nodes
  }

  // Parse input and create graph
  parseInput(nodeCount, edgesInput, directed, showLabels, showBridges, showSCC) {
    this.isDirected = directed;
    this.showLabels = showLabels;
    this.showBridges = showBridges && !directed; // Only for undirected graphs
    this.showSCC = showSCC && directed; // Only for directed graphs
    this.nodes = [];
    this.edges = [];
    this.bridges = [];
    this.sccs = [];

    // Create layout for up to 50 nodes - simple circular arrangement
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;
    
    // Create nodes array first
    const nodeDataArray = [];
    for (let i = 1; i <= nodeCount; i++) {
      nodeDataArray.push({ id: i, label: i.toString() });
    }
    
    // Simple circular layout
    nodeDataArray.forEach((nodeData, index) => {
      const angle = (2 * Math.PI * index) / nodeDataArray.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      this.nodes.push({
        id: nodeData.id,
        x: x,
        y: y,
        radius: this.baseRadius
      });
    });

    // Set optimal zoom for the graph size
    this.zoom = this.calculateOptimalZoom(nodeCount);
    this.offsetX = 0;
    this.offsetY = 0;

    // Parse edges if provided
    if (edgesInput.trim()) {
      const edgeList = edgesInput.split(',').map(e => {
        const parts = e.trim().split(/\s+/).map(Number);
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
          throw new Error(`Invalid edge format: "${e.trim()}"`);
        }
        return parts;
      });

      // Validate and add edges
      for (let [u, v] of edgeList) {
        if (u < 1 || u > nodeCount || v < 1 || v > nodeCount) {
          throw new Error(`Edge contains invalid node: ${u} ${v}. Nodes must be between 1 and ${nodeCount}.`);
        }
        
        this.edges.push({ from: u, to: v });
      }
    }

    // Run algorithms if requested
    if (this.showBridges && !directed) {
      this.findBridges();
    }
    if (this.showSCC && directed) {
      this.findSCCs();
    }
  }

  // Tarjan's algorithm to find bridges
  findBridges() {
    const n = this.nodes.length;
    const adj = Array.from({ length: n + 1 }, () => []);
    
    // Build adjacency list for undirected graph
    this.edges.forEach(edge => {
      adj[edge.from].push(edge.to);
      adj[edge.to].push(edge.from);
    });

    const visited = Array(n + 1).fill(false);
    const disc = Array(n + 1).fill(-1);
    const low = Array(n + 1).fill(-1);
    const parent = Array(n + 1).fill(-1);
    this.bridges = [];
    let time = 0;

    const bridgeUtil = (u) => {
      visited[u] = true;
      disc[u] = low[u] = ++time;

      for (let v of adj[u]) {
        if (!visited[v]) {
          parent[v] = u;
          bridgeUtil(v);

          low[u] = Math.min(low[u], low[v]);

          // If low[v] > disc[u], then u-v is a bridge
          if (low[v] > disc[u]) {
            this.bridges.push([u, v]);
          }
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    };

    // Find bridges in all components
    for (let i = 1; i <= n; i++) {
      if (!visited[i]) {
        bridgeUtil(i);
      }
    }
  }

  // Kosaraju's algorithm to find SCCs
  findSCCs() {
    const n = this.nodes.length;
    const adj = Array.from({ length: n + 1 }, () => []);
    const revAdj = Array.from({ length: n + 1 }, () => []);
    
    // Build adjacency lists
    this.edges.forEach(edge => {
      adj[edge.from].push(edge.to);
      revAdj[edge.to].push(edge.from);
    });

    const visited = Array(n + 1).fill(false);
    const stack = [];

    // First DFS to fill stack with finish times
    const dfs1 = (v) => {
      visited[v] = true;
      for (let u of adj[v]) {
        if (!visited[u]) {
          dfs1(u);
        }
      }
      stack.push(v);
    };

    for (let i = 1; i <= n; i++) {
      if (!visited[i]) {
        dfs1(i);
      }
    }

    // Second DFS on reversed graph
    visited.fill(false);
    this.sccs = [];

    const dfs2 = (v, component) => {
      visited[v] = true;
      component.push(v);
      for (let u of revAdj[v]) {
        if (!visited[u]) {
          dfs2(u, component);
        }
      }
    };

    while (stack.length > 0) {
      const v = stack.pop();
      if (!visited[v]) {
        const component = [];
        dfs2(v, component);
        this.sccs.push(component);
      }
    }

    // Generate colors for all SCCs found
    this.generateSCCColors(this.sccs.length);
  }

  // Create consistent circular layout for all node counts
  createCircularLayout(nodeCount) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    if (nodeCount === 1) {
      // Single node in center
      this.nodes.push({
        id: 1,
        x: centerX,
        y: centerY,
        radius: this.baseRadius
      });
    } else {
      // Always use circular arrangement - scalable for any number of nodes
      // Calculate radius based on number of nodes to prevent overlap
      const minRadius = Math.max(150, nodeCount * 8); // Minimum spacing
      const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;
      const radius = Math.min(maxRadius, minRadius);
      
      for (let i = 1; i <= nodeCount; i++) {
        const angle = (2 * Math.PI * (i - 1)) / nodeCount - Math.PI / 2;
        this.nodes.push({
          id: i,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          radius: this.baseRadius
        });
      }
    }
  }

  // Draw the graph with zoom and scaling
  draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom transformation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-canvas.width / 2 + this.offsetX, -canvas.height / 2 + this.offsetY);
    
    // Draw edges first (so they appear behind nodes)
    this.drawEdges();
    
    // Draw nodes on top
    this.drawNodes();
    
    ctx.restore();
    
    // Draw zoom info
    this.drawZoomInfo();
  }

  drawZoomInfo() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`Zoom: ${(this.zoom * 100).toFixed(0)}%`, 20, 30);
    ctx.fillText('Scroll: Zoom In/Out', 20, 45);
    ctx.fillText('Double-click: Reset', 20, 60);
  }

  isBridge(from, to) {
    return this.bridges.some(bridge => 
      (bridge[0] === from && bridge[1] === to) || 
      (bridge[0] === to && bridge[1] === from)
    );
  }

  drawEdges() {
    this.edges.forEach(edge => {
      const nodeA = this.nodes[edge.from - 1];
      const nodeB = this.nodes[edge.to - 1];
      
      // Handle self-loops
      if (edge.from === edge.to) {
        this.drawSelfLoop(nodeA, false);
        return;
      }
      
      // Set edge color
      if (this.showBridges && this.isBridge(edge.from, edge.to)) {
        ctx.strokeStyle = '#e91e63'; // Red for bridges
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = '#8e24aa'; // Default purple
        ctx.lineWidth = 2;
      }
      
      // Check if edge intersects with other nodes and draw curved if needed
      if (this.edgeIntersectsNodes(nodeA, nodeB)) {
        this.drawCurvedEdge(nodeA, nodeB, true); // true indicates we need arrow direction
      } else {
        this.drawStraightEdge(nodeA, nodeB);
        // Draw arrow for directed graphs (only for straight edges)
        if (this.isDirected) {
          this.drawArrow(nodeA, nodeB);
        }
      }
    });
  }

  // Check if a straight line between two nodes intersects with other nodes
  edgeIntersectsNodes(nodeA, nodeB) {
    for (let node of this.nodes) {
      // Skip the endpoint nodes
      if (node.id === nodeA.id || node.id === nodeB.id) continue;
      
      // Check if the line segment intersects with this node's circle
      if (this.lineIntersectsCircle(nodeA, nodeB, node)) {
        return true;
      }
    }
    return false;
  }

  // Check if line segment intersects with a circle (node)
  lineIntersectsCircle(nodeA, nodeB, circleNode) {
    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const fx = nodeA.x - circleNode.x;
    const fy = nodeA.y - circleNode.y;
    
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - (circleNode.radius + 10) * (circleNode.radius + 10); // Add 10px buffer
    
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) return false; // No intersection
    
    const sqrt_discriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrt_discriminant) / (2 * a);
    const t2 = (-b + sqrt_discriminant) / (2 * a);
    
    // Check if intersection points are within the line segment
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }

  // Draw straight edge
  drawStraightEdge(nodeA, nodeB) {
    ctx.beginPath();
    ctx.moveTo(nodeA.x, nodeA.y);
    ctx.lineTo(nodeB.x, nodeB.y);
    ctx.stroke();
  }

  // Draw curved edge to avoid intersecting nodes
  drawCurvedEdge(nodeA, nodeB, drawArrow = false) {
    const midX = (nodeA.x + nodeB.x) / 2;
    const midY = (nodeA.y + nodeB.y) / 2;
    
    // Calculate perpendicular offset for curve
    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;
    
    // Perpendicular vector (rotated 90 degrees)
    const perpX = -dy / length;
    const perpY = dx / length;
    
    // Curve offset (30% of the distance between nodes)
    const offset = Math.min(80, length * 0.3);
    
    // Control point for quadratic curve
    const controlX = midX + perpX * offset;
    const controlY = midY + perpY * offset;
    
    // Draw quadratic curve
    ctx.beginPath();
    ctx.moveTo(nodeA.x, nodeA.y);
    ctx.quadraticCurveTo(controlX, controlY, nodeB.x, nodeB.y);
    ctx.stroke();
    
    // Draw arrow for curved edge if needed
    if (drawArrow && this.isDirected) {
      this.drawCurvedArrow(nodeA, nodeB, controlX, controlY);
    }
  }

  drawSelfLoop(node, isBridge = false) {
    ctx.strokeStyle = isBridge ? '#e91e63' : '#8e24aa';
    ctx.lineWidth = isBridge ? 4 : 2;
    
    ctx.beginPath();
    ctx.arc(node.x + 35, node.y - 35, 20, 0, 2 * Math.PI);
    ctx.stroke();
    
    if (this.isDirected) {
      // Arrow for self-loop
      const arrowX = node.x + 15;
      const arrowY = node.y - 35;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 8, arrowY - 5);
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 8, arrowY + 5);
      ctx.stroke();
    }
  }

  drawArrow(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;
    
    const unitX = dx / length;
    const unitY = dy / length;
    
    // Position arrow near the target node
    const arrowX = to.x - unitX * (to.radius + 5);
    const arrowY = to.y - unitY * (to.radius + 5);
    
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowLength * Math.cos(Math.atan2(dy, dx) - arrowAngle),
      arrowY - arrowLength * Math.sin(Math.atan2(dy, dx) - arrowAngle)
    );
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowLength * Math.cos(Math.atan2(dy, dx) + arrowAngle),
      arrowY - arrowLength * Math.sin(Math.atan2(dy, dx) + arrowAngle)
    );
    ctx.stroke();
  }

  // Draw arrow for curved edges - calculates tangent direction at the end of the curve
  drawCurvedArrow(from, to, controlX, controlY) {
    // Calculate the tangent direction at the end of the quadratic curve
    // For quadratic Bezier curve, the tangent at t=1 is: 2 * (P2 - P1)
    // where P1 is control point and P2 is end point
    const tangentX = 2 * (to.x - controlX);
    const tangentY = 2 * (to.y - controlY);
    const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    
    if (tangentLength === 0) return;
    
    const unitTangentX = tangentX / tangentLength;
    const unitTangentY = tangentY / tangentLength;
    
    // Position arrow near the target node along the curve direction
    const arrowX = to.x - unitTangentX * (to.radius + 5);
    const arrowY = to.y - unitTangentY * (to.radius + 5);
    
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    const tangentAngle = Math.atan2(unitTangentY, unitTangentX);
    
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowLength * Math.cos(tangentAngle - arrowAngle),
      arrowY - arrowLength * Math.sin(tangentAngle - arrowAngle)
    );
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowLength * Math.cos(tangentAngle + arrowAngle),
      arrowY - arrowLength * Math.sin(tangentAngle + arrowAngle)
    );
    ctx.stroke();
  }

  getNodeSCCColor(nodeId) {
    if (!this.showSCC) return '#ab47bc';
    
    for (let i = 0; i < this.sccs.length; i++) {
      if (this.sccs[i].includes(nodeId)) {
        return this.sccColors[i]; // Now guaranteed to exist
      }
    }
    return '#ab47bc'; // Default color for nodes not in any SCC
  }

  drawNodes() {
    this.nodes.forEach(node => {
      // Calculate scaled radius
      const scaledRadius = node.radius * Math.max(0.5, Math.min(1, this.zoom));
      
      // Node circle with SCC coloring if enabled
      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledRadius, 0, 2 * Math.PI);
      ctx.fillStyle = this.getNodeSCCColor(node.id);
      ctx.fill();
      ctx.strokeStyle = '#6a1b9a';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Node label with scaled font
      if (this.showLabels) {
        ctx.fillStyle = 'white';
        const fontSize = Math.max(10, 16 * Math.max(0.5, Math.min(1, this.zoom)));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id, node.x, node.y);
      }
    });
  }
}

const graphViz = new GraphVisualizer();

function visualizeGraph() {
  const nodes = parseInt(document.getElementById("nodes").value);
  const edgesInput = document.getElementById("edges").value.trim();
  const directed = document.getElementById("directed").checked;
  const showLabels = document.getElementById("showLabels").checked;
  const showBridges = document.getElementById("showBridges").checked;
  const showSCC = document.getElementById("showSCC").checked;
  const errorEl = document.getElementById("error");

  errorEl.textContent = "";

  // Resize canvas dynamically
  canvas.width = canvas.parentElement.clientWidth - 40;
  canvas.height = canvas.parentElement.clientHeight - 40;

  // Basic validation
  if (isNaN(nodes) || nodes <= 0) {
    errorEl.textContent = "⚠️ Please enter a valid number of nodes (positive integer).";
    return;
  }

  if (nodes > 50) {
    errorEl.textContent = "⚠️ Please enter 50 or fewer nodes for optimal visualization.";
    return;
  }

  // Validate algorithm selections
  if (showBridges && directed) {
    errorEl.textContent = "⚠️ Bridge detection only works with undirected graphs.";
    return;
  }

  if (showSCC && !directed) {
    errorEl.textContent = "⚠️ SCC detection only works with directed graphs.";
    return;
  }

  try {
    // Parse and create graph
    graphViz.parseInput(nodes, edgesInput, directed, showLabels, showBridges, showSCC);
    
    // Draw graph with automatic zoom
    graphViz.draw();
    
    // Display algorithm results
    if (showBridges && graphViz.bridges.length > 0) {
      console.log('Bridges found:', graphViz.bridges);
    }
    
    if (showSCC && graphViz.sccs.length > 0) {
      console.log('Strongly Connected Components:', graphViz.sccs);
    }
    
  } catch (error) {
    errorEl.textContent = `⚠️ ${error.message}`;
  }
}


