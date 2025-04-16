import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import louvain from 'graphology-communities-louvain';
import Sigma from 'sigma';
import { NodeCircleProgram } from 'sigma/rendering';
import ArrowEdgeProgram from './arrowEdgeProgram';

// Create a tooltip element for node hover
const tooltip = document.createElement('div');
Object.assign(tooltip.style, {
  position: 'absolute',
  pointerEvents: 'none',
  display: 'none',
  background: 'rgba(0, 0, 0, 0.85)',
  color: '#fff',
  padding: '8px',
  borderRadius: '4px',
  fontSize: '14px',
  maxWidth: '300px',
  backdropFilter: 'blur(3px)'
});
document.body.appendChild(tooltip);

// A few distinct colors for communities:
const COMMUNITY_COLORS = [
  "#FF4136", "#0074D9", "#FF851B", "#2ECC40", "#B10DC9", "#FFDC00", "#001f3f", "#39CCCC",
  "#85144b", "#3D9970", "#01FF70", "#AAAAAA"
];

// Helper to pick a color from the array based on community index.
function getCommunityColor(community) {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

// Convert pointer coordinates to graph coordinates.
function pickNodeAtGraphCoords(renderer, graph, pointerGraphPos, threshold = 15) {
  let pickedNode = null;
  let minDistance = Infinity;
  graph.forEachNode((node, attr) => {
    const dx = attr.x - pointerGraphPos.x;
    const dy = attr.y - pointerGraphPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < threshold && distance < minDistance) {
      pickedNode = node;
      minDistance = distance;
    }
  });
  return pickedNode;
}

fetch('/scan/3/latest')
  .then(response => response.json())
  .then(data => {
    if (!data.attack_graph) {
      document.getElementById('container').innerHTML = "<p>No attack graph available.</p>";
      return;
    }

    const graph = new Graph();
    const nodeMap = new Map();
    const edges = [];

    // Process nodes – force size = 10 for all nodes.
    const nodes = data.attack_graph.nodes.map(node => {
      let key, attributes;
      const x = (node.x !== undefined && !isNaN(node.x)) ? node.x : Math.random() * 100;
      const y = (node.y !== undefined && !isNaN(node.y)) ? node.y : Math.random() * 100;
      const size = 30;
      
      // For external functions try to merge with existing function nodes by label.
      if (node.type === "external_function") {
        const simpleLabel = node.label.split('.').pop();
        const foundKey = [...nodeMap.values()].find(k => {
          try {
            const label = graph.getNodeAttribute(k, 'label');
            const nodeCategory = graph.getNodeAttribute(k, 'nodeCategory');
            return label === simpleLabel && nodeCategory === 'function';
          } catch (e) {
            return false;
          }
        });
        if (foundKey) {
          key = foundKey;
          nodeMap.set(node.id, key);
          return { key, attributes: {} };
        } else {
          key = node.id;
          attributes = {
            ...node,
            x, y,
            color: "#666",
            size,
            nodeCategory: node.type,
            type: "nodeCircle"
          };
        }
      } else {
        key = node.normalized_filepath ? `${node.normalized_filepath}:${node.label}` : node.id;
        attributes = {
          ...node,
          x, y,
          color: "#0074D9",
          size,
          nodeCategory: node.type,
          type: "nodeCircle"
        };
      }
      nodeMap.set(node.id, key);
      return { key, attributes };
    }).filter(n => n.attributes && Object.keys(n.attributes).length > 0);
    
    // Process edges with semi-transparent colors.
    data.attack_graph.links?.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (source && target && !graph.hasEdge(source, target)) {
        edges.push({
          source,
          target,
          attributes: {
            type: "arrow",
            color: link.attack_path ? "rgba(255,0,0,0.6)" : "rgba(59, 59, 59, 0.69)",
            size: 5,
            arrowSize: 8
          }
        });
      }
    });
    
    // Batch import nodes and edges.
    graph.import({
      nodes: nodes.map(({ key, attributes }) => ({ key, attributes })),
      edges: edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        attributes: edge.attributes
      }))
    });
    
    // 1) Community detection using Louvain.
    const partition = louvain(graph);
    graph.forEachNode(node => {
      const community = partition[node] || 0;
      graph.setNodeAttribute(node, 'color', getCommunityColor(community));
    });
    
    // 2) Apply ForceAtlas2 layout for grouping.
    forceAtlas2.assign(graph, {
      iterations: 600,
      settings: {
        strongGravityMode: true,
        gravity: 4.0,
        scalingRatio: 4.0,
        adjustSizes: true
      }
    });
    
    // 3) Apply noverlap layout.
    // noverlap.assign(graph, { margin: 5, gridSize: 50 });
    
    // 4) Initialize Sigma renderer.
    const container = document.getElementById('container');
    container.style.touchAction = "none";
    const renderer = new Sigma(graph, container, {
      settings: {
        edgeProgram: ArrowEdgeProgram,
        defaultEdgeColor: "#ccc",
        defaultNodeColor: "#0074D9",
        labelThreshold: 16,
      },
      nodeProgramClasses: {
        nodeCircle: NodeCircleProgram,
      }
    });

    // Enhanced tooltip using Tippy.js.
    renderer.on('enterNode', ({ node }) => {
      const attr = graph.getNodeAttributes(node);
      let content = `<strong>${attr.label}</strong><br>`;
      content += `<strong>File:</strong> ${attr.filepath}<br>`;
      if (attr.vulnerabilities && attr.vulnerabilities.length > 0) {
        content += `<strong>Vulnerabilities:</strong><br>`;
        attr.vulnerabilities.forEach(vuln => {
          content += `<em>${vuln.message}</em> (Severity: ${vuln.severity})<br>`;
        });
      }
      tippy(document.body, {
        content,
        allowHTML: true,
        interactive: true,
        placement: 'top',
        trigger: 'manual',
        animation: 'scale',
        theme: 'light-border'
      }).show();
    });
    renderer.on('leaveNode', () => {
      // Let tooltips auto-dismiss on mouse leave
    });
    container.addEventListener('mousemove', event => {
      tooltip.style.left = event.pageX + 10 + 'px';
      tooltip.style.top = event.pageY + 10 + 'px';
    });

    // --- INTERACTIVE DRILL-DOWN (EXPAND/COLLAPSE) ---
    // This section assumes that some nodes have a "children" property, which is an array
    // of detailed child nodes. On clicking an expandable node, we toggle expansion.
    renderer.on('clickNode', ({ node }) => {
      const attr = graph.getNodeAttributes(node);
      if (!attr.children || attr.children.length === 0) return;
      if (!attr.expanded) {
        console.log(`Expanding node ${node}`);
        graph.setNodeAttribute(node, 'expanded', true);
        // For each child in the children array, add a new node and edge.
        attr.children.forEach((child, index) => {
          const childKey = `${node}::${child.id}`;
          const offset = (index + 1) * 20;
          const childX = attr.x + offset;
          const childY = attr.y + offset;
          graph.addNode(childKey, Object.assign({}, child, {
            x: childX,
            y: childY,
            size: 30,  // Force size 10
            type: 'nodeCircle',
            nodeCategory: child.type
          }));
          graph.addEdge(node, childKey, {
            type: 'has_child',
            color: 'rgba(102,102,102,0.2)',
            size: 1,
            arrowSize: 6
          });
        });
        renderer.refresh();
      } else {
        console.log(`Collapsing node ${node}`);
        graph.forEachNode(n => {
          if (n.startsWith(`${node}::`)) {
            graph.dropNode(n);
          }
        });
        graph.setNodeAttribute(node, 'expanded', false);
        renderer.refresh();
      }
    });
    // --- END DRILL-DOWN ---

    // --- NODE DRAGGING AND CAMERA PANNING ---
    let dragState = null;
    let panState = null;
    container.addEventListener('pointerdown', event => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const pointer = renderer.viewportToGraph({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      const picked = pickNodeAtGraphCoords(renderer, graph, pointer, 15);
      if (picked) {
        dragState = {
          node: picked,
          nodeX: graph.getNodeAttribute(picked, 'x'),
          nodeY: graph.getNodeAttribute(picked, 'y'),
          pointerX: pointer.x,
          pointerY: pointer.y
        };
      } else {
        const camera = renderer.getCamera();
        panState = {
          cameraX: camera.x,
          cameraY: camera.y,
          pointerX: pointer.x,
          pointerY: pointer.y
        };
      }
    });
    container.addEventListener('pointermove', event => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const pointer = renderer.viewportToGraph({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      if (dragState) {
        const dx = pointer.x - dragState.pointerX;
        const dy = pointer.y - dragState.pointerY;
        graph.setNodeAttribute(dragState.node, 'x', dragState.nodeX + dx);
        graph.setNodeAttribute(dragState.node, 'y', dragState.nodeY + dy);
        renderer.refresh();
      } else if (panState) {
        const dx = pointer.x - panState.pointerX;
        const dy = pointer.y - panState.pointerY;
        const camera = renderer.getCamera();
        camera.setState({
          x: panState.cameraX - dx,
          y: panState.cameraY - dy
        });
      }
    });
    container.addEventListener('pointerup', event => {
      event.preventDefault();
      dragState = null;
      panState = null;
    });

    console.log("Attack graph rendered successfully.");
    console.log("Node count:", graph.order);
    console.log("Edge count:", graph.size);

  })
  .catch(console.error);
