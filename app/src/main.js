import Graph from 'graphology';
import noverlap from 'graphology-layout-noverlap';
import Sigma from 'sigma';
import ArrowEdgeProgram from './arrowEdgeProgram';

console.log("Custom arrow edge program:", ArrowEdgeProgram);



// Create a tooltip element for node hover info.
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.pointerEvents = 'none';
tooltip.style.display = 'none';
tooltip.style.background = 'rgba(0, 0, 0, 0.7)';
tooltip.style.color = '#fff';
tooltip.style.padding = '5px';
tooltip.style.borderRadius = '3px';
tooltip.style.fontSize = '12px';
document.body.appendChild(tooltip);


// Fetch the attack graph JSON file (adjust the URL as needed).
fetch('/scan/3/latest')
  .then(response => response.json())
  .then(data => {
    console.log("Loaded graph data:", data);

    // Extract the attack graph from the loaded JSON.
    const graphData = data.attack_graph;
    if (!graphData || !graphData.nodes) {
      console.error("Graph data does not have a 'nodes' property:", graphData);
      return;
    }

    // Create a new graph instance.
    const graph = new Graph();
    // Mapping from original node id to deduplicated unique key.
    const nodeMapping = {};

    // Add nodes with deduplication.
    graphData.nodes.forEach(node => {
      // For internal function nodes, build a unique key using normalized_filepath (if available) and label.
      // For external_function nodes, try to merge with an existing function node.
      if (node.type === "external_function") {
        const simpleLabel = node.label.split('.').pop();
        let foundKey = null;
        graph.forEachNode((key, attr) => {
          if (attr.nodeType === "function" && attr.label === simpleLabel) {
            foundKey = key;
          }
        });
        if (foundKey) {
          nodeMapping[node.id] = foundKey;
          return;
        } else {
          const uniqueKey = node.id;
          graph.addNode(uniqueKey, {
            label: node.label,
            x: (node.x !== undefined) ? node.x : Math.random() * 100,
            y: (node.y !== undefined) ? node.y : Math.random() * 100,
            size: (node.size !== undefined) ? node.size : 10,
            color: "#ccc", // default color for external functions
            vulnerable: node.vulnerable,
            filepath: node.filepath,
            vulnerabilities: node.vulnerabilities,
            nodeType: node.type,
            lineno: node.lineno,
            end_lineno: node.end_lineno,
            class_name: node.class_name,
            normalized_filepath: node.normalized_filepath
          });
          nodeMapping[node.id] = uniqueKey;
          return;
        }
      }

      // For function (or other) nodes.
      const uniqueKey = node.normalized_filepath ? `${node.normalized_filepath}:${node.label}` : node.id;

      if (!graph.hasNode(uniqueKey)) {
        const x = (node.x !== undefined) ? node.x : Math.random() * 100;
        const y = (node.y !== undefined) ? node.y : Math.random() * 100;
        const size = (node.size !== undefined) ? node.size : 10;
        let color = "#0074D9"; // default blue for functions
        if (node.type === "function") {
          color = node.vulnerable ? "#FF4136" : "#0074D9";
        }
        if (node.type === "vulnerability") {
          color = "#FFA500"; // orange for vulnerabilities
        }
        graph.addNode(uniqueKey, {
          label: node.label,
          x: x,
          y: y,
          size: size,
          color: color,
          vulnerable: node.vulnerable,
          filepath: node.filepath,
          vulnerabilities: node.vulnerabilities,
          nodeType: node.type,
          lineno: node.lineno,
          end_lineno: node.end_lineno,
          class_name: node.class_name,
          normalized_filepath: node.normalized_filepath
        });
      } else {
        if (node.vulnerable && !graph.getNodeAttribute(uniqueKey, 'vulnerable')) {
          graph.setNodeAttribute(uniqueKey, 'vulnerable', true);
          graph.setNodeAttribute(uniqueKey, 'color', "#FF4136");
          const currVuls = graph.getNodeAttribute(uniqueKey, 'vulnerabilities') || [];
          graph.setNodeAttribute(uniqueKey, 'vulnerabilities', currVuls.concat(node.vulnerabilities || []));
        }
      }
      nodeMapping[node.id] = uniqueKey;
    });

    // Add edges from the JSON using the deduplication mapping.
    if (graphData.links) {
      graphData.links.forEach(link => {
        const sourceKey = nodeMapping[link.source];
        const targetKey = nodeMapping[link.target];
        // Only add the edge if both nodes exist.
        if (graph.hasNode(sourceKey) && graph.hasNode(targetKey)) {
          // Check if an edge already exists between these two nodes.
          if (!graph.hasEdge(sourceKey, targetKey)) {
            graph.addEdge(sourceKey, targetKey, {
              label: link.type, // e.g., "calls"
              color: "#ccc",
              arrow: true
            });
          }
        }
      });
    } else {
      console.warn("No links property found in graph data.");
    }

    // Apply the noverlap layout to adjust node positions.
    noverlap.assign(graph, { margin: 10 });

    // Initialize Sigma to render the graph.
    const container = document.getElementById('container');
    const renderer = new Sigma(graph, container, {
      settings: {
        defaultEdgeColor: "#ccc",
        defaultNodeColor: "#0074D9",
        labelThreshold: 16,
        edgeProgram: ArrowEdgeProgram // Your custom edge program here.
      }
    });
    
    // --- Tooltips on Hover ---
    renderer.on('enterNode', ({ node }) => {
      const attr = graph.getNodeAttributes(node);
      let vulnInfo = "";
      if (attr.vulnerabilities && attr.vulnerabilities.length > 0) {
        vulnInfo = "Vulnerabilities: " + attr.vulnerabilities.map(v => v.check_id).join(", ") + "<br>";
      }
      tooltip.innerHTML = `<strong>${attr.label}</strong><br>
                           File: ${attr.filepath || "N/A"}<br>
                           ${vulnInfo}Line: ${attr.lineno} - ${attr.end_lineno}`;
      tooltip.style.display = 'block';
    });

    renderer.on('leaveNode', () => {
      tooltip.style.display = 'none';
    });

    container.addEventListener('mousemove', event => {
      tooltip.style.left = event.pageX + 10 + 'px';
      tooltip.style.top = event.pageY + 10 + 'px';
    });

    // --- Custom Node Dragging Implementation ---
    let draggedNode = null;
    let isDragging = false;
    let pointerDown = false;

    // Helper: Convert viewport (client) coordinates to graph coordinates.
    function viewportToGraph(event) {
      const camera = renderer.getCamera();
      const rect = container.getBoundingClientRect();
      const viewportX = event.clientX - rect.left;
      const viewportY = event.clientY - rect.top;
      const centerX = container.offsetWidth / 2;
      const centerY = container.offsetHeight / 2;
      const graphX = camera.x + (viewportX - centerX) / camera.ratio;
      const graphY = camera.y + (viewportY - centerY) / camera.ratio;
      return { x: graphX, y: graphY };
    }

    container.addEventListener('pointerdown', event => {
      pointerDown = true;
      const graphCoords = viewportToGraph(event);
      let closestNode = null;
      let minDist = Infinity;
      graph.forEachNode((node, attr) => {
        const dx = attr.x - graphCoords.x;
        const dy = attr.y - graphCoords.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist < (attr.size || 10) * 2) {
          minDist = dist;
          closestNode = node;
        }
      });
      if (closestNode) {
        draggedNode = closestNode;
        isDragging = true;
      }
    });

    container.addEventListener('pointermove', event => {
      if (!pointerDown || !isDragging || !draggedNode) return;
      const graphCoords = viewportToGraph(event);
      graph.setNodeAttribute(draggedNode, 'x', graphCoords.x);
      graph.setNodeAttribute(draggedNode, 'y', graphCoords.y);
      renderer.refresh();
    });

    container.addEventListener('pointerup', () => {
      pointerDown = false;
      isDragging = false;
      draggedNode = null;
    });

    console.log("Attack graph rendered successfully.");
  })
  .catch(error => {
    console.error("Error loading attack graph: ", error);
  });
