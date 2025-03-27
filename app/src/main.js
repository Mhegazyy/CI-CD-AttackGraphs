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

// Helper to pick a color from the array based on community
function getCommunityColor(community) {
  // For large graphs with many communities, you might want a bigger palette or a color generator
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

// Convert pointer to graph coordinates, then pick node by graph distance
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
    const graph = new Graph();
    const nodeMap = new Map();
    const edges = [];

    // Process nodes
    const nodes = data.attack_graph.nodes.map(node => {
      let key, attributes;
      const x = (node.x !== undefined && !isNaN(node.x)) ? node.x : Math.random() * 100;
      const y = (node.y !== undefined && !isNaN(node.y)) ? node.y : Math.random() * 100;
      
      // We’ll force size=10 for all nodes:
      const size = 10;

      // For external functions or other classification, we might set different properties, but size is always 10.
      if (node.type === "external_function") {
        // Attempt to merge with existing function node by label
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
            color: "#666",   // default color for external (will be overridden by community color)
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
          color: "#0074D9", // default color (overridden by community color)
          size,
          nodeCategory: node.type,
          type: "nodeCircle"
        };
      }

      nodeMap.set(node.id, key);
      return { key, attributes };
    }).filter(n => n.attributes && Object.keys(n.attributes).length > 0);

    // Process edges with semi-transparent colors
    data.attack_graph.links?.forEach(link => {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (source && target && !graph.hasEdge(source, target)) {
        edges.push({
          source,
          target,
          attributes: {
            type: "arrow",
            // Attack path => red, else semi-transparent gray
            color: link.attack_path ? "rgba(255,0,0,0.6)" : "rgba(59, 59, 59, 0.69)",
            size: 2,
            arrowSize: 8
          }
        });
      }
    });

    // Import nodes & edges
    graph.import({
      nodes: nodes.map(({ key, attributes }) => ({ key, attributes })),
      edges: edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        attributes: edge.attributes
      }))
    });

    // 1) Community detection with Louvain
    const partition = louvain(graph);
    // Assign a color per community
    graph.forEachNode(node => {
      const community = partition[node] || 0;
      graph.setNodeAttribute(node, 'color', getCommunityColor(community));
    });

    // 2) ForceAtlas2 layout
    forceAtlas2.assign(graph, {
      iterations: 600,
      settings: {
        strongGravityMode: true,
        gravity: 2.0,
        scalingRatio: 4.0,
        adjustSizes: true
      }
    });

    // 3) No-overlap pass
    noverlap.assign(graph, { margin: 5, gridSize: 50 });

    // 4) Initialize Sigma
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
        nodeCircle: NodeCircleProgram
      }
    });

    // Enhanced tooltip
    renderer.on('enterNode', ({ node }) => {
      const attr = graph.getNodeAttributes(node);
      const vuls = (attr.vulnerabilities || [])
        .map(v => `${v.check_id} (${v.severity})`)
        .join('<br>');
      tooltip.innerHTML = `
        <strong>${attr.label}</strong>
        <div style="margin-top:6px;color:#aaa">
          ${attr.nodeCategory === 'external' ? 'External' : 'Internal'} ${attr.nodeCategory}
        </div>
        ${attr.filepath ? `<div>📄 ${attr.filepath}</div>` : ''}
        ${attr.lineno ? `<div>📏 Lines ${attr.lineno}-${attr.end_lineno}</div>` : ''}
        ${vuls ? `<div style="margin-top:8px;color:${attr.color}">⚠️ ${vuls}</div>` : ''}
      `;
      tooltip.style.display = 'block';
    });
    renderer.on('leaveNode', () => {
      tooltip.style.display = 'none';
    });
    container.addEventListener('mousemove', event => {
      tooltip.style.left = event.pageX + 10 + 'px';
      tooltip.style.top = event.pageY + 10 + 'px';
    });

    // 5) Pan or drag logic
    let dragState = null;
    let panState = null;
    // If we pick a node, we drag that node. Otherwise, we pan the camera.
    container.addEventListener('pointerdown', event => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      // Convert pointer to graph coords
      const pointerGraphPos = renderer.viewportToGraph({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      // Try picking a node within threshold 15
      const picked = pickNodeAtGraphCoords(graph, pointerGraphPos, 15);
      if (picked) {
        dragState = {
          node: picked,
          nodeX: graph.getNodeAttribute(picked, 'x'),
          nodeY: graph.getNodeAttribute(picked, 'y'),
          pointerX: pointerGraphPos.x,
          pointerY: pointerGraphPos.y
        };
      } else {
        // Start camera panning
        const camera = renderer.getCamera();
        panState = {
          cameraX: camera.x,
          cameraY: camera.y,
          pointerX: pointerGraphPos.x,
          pointerY: pointerGraphPos.y
        };
      }
    });
    container.addEventListener('pointermove', event => {
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const pointerGraphPos = renderer.viewportToGraph({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      if (dragState) {
        // Node dragging
        const dx = pointerGraphPos.x - dragState.pointerX;
        const dy = pointerGraphPos.y - dragState.pointerY;
        graph.setNodeAttribute(dragState.node, 'x', dragState.nodeX + dx);
        graph.setNodeAttribute(dragState.node, 'y', dragState.nodeY + dy);
        renderer.refresh();
      } else if (panState) {
        // Camera panning
        const camera = renderer.getCamera();
        const dx = pointerGraphPos.x - panState.pointerX;
        const dy = pointerGraphPos.y - panState.pointerY;
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

    // Helper: pick node by graph distance
    function pickNodeAtGraphCoords(graph, pointer, threshold) {
      let pickedNode = null;
      let minDistance = Infinity;
      graph.forEachNode((node, attr) => {
        const dx = attr.x - pointer.x;
        const dy = attr.y - pointer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < threshold && distance < minDistance) {
          pickedNode = node;
          minDistance = distance;
        }
      });
      return pickedNode;
    }

    console.log("Attack graph rendered successfully.");
  })
  .catch(console.error);
