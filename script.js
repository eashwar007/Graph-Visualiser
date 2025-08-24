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
    this.sccColors = [];

    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.baseRadius = 25;

    this.isDragging = false;
    this.dragNode = null;
    this.mouseX = 0;
    this.mouseY = 0;

    this.setupControls();
  }

  // Generate unlimited distinct colors using HSL color space
  generateSCCColors(numSCCs) {
    this.sccColors = [];
    
    if (numSCCs === 0) return;

    const goldenAngle = 137.508; 
    
    for (let i = 0; i < numSCCs; i++) {
      const hue = (i * goldenAngle) % 360;

      const saturation = 60 + (i % 3) * 15;
      const lightness = 45 + (i % 4) * 10;

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

  setupControls() {
    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 0.1;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      if (e.deltaY < 0) {
        // Zoom in
        this.zoom = Math.min(this.zoom * (1 + zoomFactor), 2);
      } else {
        // Zoom out
        this.zoom = Math.max(this.zoom * (1 - zoomFactor), 0.2);
      }
      
      this.draw();
    });

    canvas.addEventListener('dblclick', (e) => {
      if (this.isDragging) return;
      
      this.zoom = this.calculateOptimalZoom(this.nodes.length);
      this.offsetX = 0;
      this.offsetY = 0;
      this.draw();
    });

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - canvas.width / 2) / this.zoom + canvas.width / 2 - this.offsetX;
      const mouseY = (e.clientY - rect.top - canvas.height / 2) / this.zoom + canvas.height / 2 - this.offsetY;

      const clickedNode = this.getNodeAt(mouseX, mouseY);
      if (clickedNode) {
        this.isDragging = true;
        this.dragNode = clickedNode;
        this.mouseX = mouseX;
        this.mouseY = mouseY;
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - canvas.width / 2) / this.zoom + canvas.width / 2 - this.offsetX;
      const mouseY = (e.clientY - rect.top - canvas.height / 2) / this.zoom + canvas.height / 2 - this.offsetY;
      
      if (this.isDragging && this.dragNode) {
        this.dragNode.x = mouseX;
        this.dragNode.y = mouseY;
        this.draw();
      } else {
        const hoveredNode = this.getNodeAt(mouseX, mouseY);
        canvas.style.cursor = hoveredNode ? 'grab' : 'default';
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      this.dragNode = null;
      canvas.style.cursor = 'default';
    });

    canvas.addEventListener('mouseleave', (e) => {
      this.isDragging = false;
      this.dragNode = null;
      canvas.style.cursor = 'default';
    });
  }

  // Calculate optimal zoom based on number of nodes
  calculateOptimalZoom(nodeCount) {
    if (nodeCount <= 10) return 1;
    if (nodeCount <= 20) return 0.8;
    if (nodeCount <= 30) return 0.6;
    if (nodeCount <= 40) return 0.5;
    return 0.4; 
  }

  // Get node at specific coordinates (for drag detection)
  getNodeAt(x, y) {
    for (let node of this.nodes) {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      if (distance <= node.radius) {
        return node;
      }
    }
    return null;
  }

  parseInput(nodeCount, edgesInput, directed, showLabels, showBridges, showSCC) {
    this.isDirected = directed;
    this.showLabels = showLabels;
    this.showBridges = showBridges && !directed;
    this.showSCC = showSCC && directed;
    this.nodes = [];
    this.edges = [];
    this.bridges = [];
    this.sccs = [];

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;

    const nodeDataArray = [];
    for (let i = 1; i <= nodeCount; i++) {
      nodeDataArray.push({ id: i, label: i.toString() });
    }

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

    this.zoom = this.calculateOptimalZoom(nodeCount);
    this.offsetX = 0;

    if (edgesInput.trim()) {
      const edgeList = edgesInput.split(',').map(e => {
        const parts = e.trim().split(/\s+/).map(Number);
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
          throw new Error(`Invalid edge format: "${e.trim()}"`);
        }
        return parts;
      });

      for (let [u, v] of edgeList) {
        if (u < 1 || u > nodeCount || v < 1 || v > nodeCount) {
          throw new Error(`Edge contains invalid node: ${u} ${v}. Nodes must be between 1 and ${nodeCount}.`);
        }
        
        this.edges.push({ from: u, to: v });
      }
    }

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

          if (low[v] > disc[u]) {
            this.bridges.push([u, v]);
          }
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    };

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

    this.edges.forEach(edge => {
      adj[edge.from].push(edge.to);
      revAdj[edge.to].push(edge.from);
    });

    const visited = Array(n + 1).fill(false);
    const stack = [];

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
    this.generateSCCColors(this.sccs.length);
  }

  createCircularLayout(nodeCount) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    if (nodeCount === 1) {
      this.nodes.push({
        id: 1,
        x: centerX,
        y: centerY,
        radius: this.baseRadius
      });
    } else {
      const minRadius = Math.max(150, nodeCount * 8);
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
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-canvas.width / 2 + this.offsetX, -canvas.height / 2 + this.offsetY);
    
    this.drawEdges();

    this.drawNodes();
    
    ctx.restore();

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
        ctx.strokeStyle = '#e91e63';
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = '#8e24aa';
        ctx.lineWidth = 2;
      }
      this.drawStraightEdge(nodeA, nodeB);
      
      if (this.isDirected) {
        this.drawArrow(nodeA, nodeB);
      }
    });
  }

  // Draw straight edge
  drawStraightEdge(nodeA, nodeB) {
    ctx.beginPath();
    ctx.moveTo(nodeA.x, nodeA.y);
    ctx.lineTo(nodeB.x, nodeB.y);
    ctx.stroke();
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

  getNodeSCCColor(nodeId) {
    if (!this.showSCC) return '#ab47bc';
    
    for (let i = 0; i < this.sccs.length; i++) {
      if (this.sccs[i].includes(nodeId)) {
        return this.sccColors[i];
      }
    }
    return '#ab47bc';
  }

  drawNodes() {
    this.nodes.forEach(node => {
      const scaledRadius = node.radius * Math.max(0.5, Math.min(1, this.zoom));

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

  canvas.width = canvas.parentElement.clientWidth - 40;
  canvas.height = canvas.parentElement.clientHeight - 40;

  if (isNaN(nodes) || nodes <= 0) {
    errorEl.textContent = "Please enter a valid number of nodes (positive integer).";
    return;
  }

  if (nodes > 50) {
    errorEl.textContent = "Please enter 50 or fewer nodes for optimal visualization.";
    return;
  }

  if (showBridges && directed) {
    errorEl.textContent = "Bridge detection only works with undirected graphs.";
    return;
  }

  if (showSCC && !directed) {
    errorEl.textContent = "SCC detection only works with directed graphs.";
    return;
  }

  try {
    graphViz.parseInput(nodes, edgesInput, directed, showLabels, showBridges, showSCC);
    
    graphViz.draw();
    
    if (showBridges && graphViz.bridges.length > 0) {
      console.log('Bridges found:', graphViz.bridges);
    }
    
    if (showSCC && graphViz.sccs.length > 0) {
      console.log('Strongly Connected Components:', graphViz.sccs);
    }
    
  } catch (error) {
    errorEl.textContent = `${error.message}`;
  }
}


