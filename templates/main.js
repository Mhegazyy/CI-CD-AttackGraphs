// main.js

import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { NodeCircleProgram } from 'sigma/rendering';
import tippy from 'tippy.js';
import ArrowEdgeProgram from './arrowEdgeProgram'; // your custom edge program

/**
 * Helper to pick the closest node within a threshold.
 */
function pickNodeAt(renderer, graph, clientX, clientY, threshold = 15) {
  const container = renderer.getContainer();
  const rect = container.getBoundingClientRect();
  // convert screen → graph coordinates
  const { x: gx, y: gy } = renderer.viewportToGraph({
    x: clientX - rect.left,
    y: clientY - rect.top,
  });

  let picked = null;
  let minDist = Infinity;
  graph.forEachNode((node, attr) => {
    const dx = attr.x - gx;
    const dy = attr.y - gy;
    const d = Math.hypot(dx, dy);
    if (d < threshold && d < minDist) {
      picked = node;
      minDist = d;
    }
  });

  return picked;
}

// Create an off-DOM tooltip container for Tippy
const tooltip = document.createElement('div');
Object.assign(tooltip.style, {
  position: 'absolute',
  pointerEvents: 'none',
  display: 'none',
  background: 'rgba(0,0,0,0.8)',
  color: '#fff',
  padding: '6px',
  borderRadius: '4px',
  fontSize: '12px',
  maxWidth: '200px'
});
document.body.appendChild(tooltip);

fetch('/scan/3/latest')
  .then((r) => r.json())
  .then(({ attack_graph }) => {
    if (!attack_graph) throw new Error('No attack_graph in response');

    // 1) Build an empty Graphology graph
    const graph   = new Graph();
    const fileMap = new Map(); // fileId -> its children array

    // 2) Add only file nodes initially
    attack_graph.nodes
      .filter((n) => n.type === 'file')
      .forEach((file) => {
        graph.addNode(file.id, {
          ...file,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 18,
          color: '#0074D9',
          nodeCategory: 'file',
          type: 'nodeCircle',
          _expanded: false,
        });
        fileMap.set(file.id, file.children || []);
      });

    // 3) Collapse function→function links into file→file calls
    const seen = new Set();
    attack_graph.links.forEach((link) => {
      // find parent file of source & target
      const srcFile = attack_graph.nodes.find((n) =>
        n.children?.some((c) => c.id === link.source)
      )?.id;
      const tgtFile = attack_graph.nodes.find((n) =>
        n.children?.some((c) => c.id === link.target)
      )?.id;
      if (srcFile && tgtFile && srcFile !== tgtFile) {
        const edgeKey = `${srcFile}->${tgtFile}`;
        if (!seen.has(edgeKey)) {
          graph.addEdgeWithKey(edgeKey, srcFile, tgtFile, {
            type:      'calls',
            color:     'rgba(150,150,150,0.8)',
            size:      2,
            arrowSize: 6,
          });
          seen.add(edgeKey);
        }
      }
    });

    // 4) Run ForceAtlas2 to spread out the file nodes
    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: { gravity: 1, scalingRatio: 4, adjustSizes: true },
    });

    // 5) Initialize Sigma
    const container = document.getElementById('container');
    container.style.touchAction = 'none';
    const renderer = new Sigma(graph, container, {
      settings: {
        defaultEdgeType: 'arrow',
        minArrowSize:    6,
        defaultEdgeColor:'#ccc',
        defaultNodeColor:'#0074D9',
        labelThreshold: 16
      },
      nodeProgramClasses: { nodeCircle: NodeCircleProgram },
      edgeProgramClasses: {
        calls:     ArrowEdgeProgram,
        has_child: ArrowEdgeProgram
      }
    });

    // 6) Show tooltip on file hover
    renderer.on('enterNode', ({ node }) => {
      const a = graph.getNodeAttributes(node);
      if (a.nodeCategory !== 'file') return;
      const tip = tippy(tooltip, {
        content: `<strong>${a.label}</strong><br>${a.filepath}`,
        allowHTML: true,
        placement: 'top',
        trigger: 'manual',
        theme: 'light-border'
      });
      tip.show();
    });
    renderer.on('leaveNode', () => {
      tooltip._tippy?.hide();
    });

    // 7) Drill‑down expand/collapse on click
    container.addEventListener('click', (e) => {
      const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
      if (!fileKey) return;
      const f = graph.getNodeAttributes(fileKey);
      if (f.nodeCategory !== 'file') return;

      if (!f._expanded) {
        // EXPAND: add each function and its edges
        fileMap.get(fileKey).forEach((fn, i) => {
          const fnKey = `${fileKey}::${fn.id}`;
          const angle = (2 * Math.PI * i) / fileMap.get(fileKey).length;
          const radius = 30;
          graph.addNode(fnKey, {
            ...fn,
            x: f.x + Math.cos(angle) * radius,
            y: f.y + Math.sin(angle) * radius,
            size: 10,
            color: fn.vulnerable ? '#FF4136' : '#2ECC40',
            nodeCategory: 'function',
            type: 'nodeCircle'
          });
          graph.addEdge(`${fileKey}->${fnKey}`, fileKey, fnKey, {
            type:      'has_child',
            color:     'rgba(200,200,200,0.6)',
            size:      1,
            arrowSize: 4
          });
        });

        // add intra‑file call edges
        attack_graph.links.forEach((link) => {
          const children = fileMap.get(fileKey).map((c) => c.id);
          if (
            children.includes(link.source) &&
            children.includes(link.target)
          ) {
            const srcKey = `${fileKey}::${link.source}`;
            const tgtKey = `${fileKey}::${link.target}`;
            graph.addEdge(
              `${srcKey}->${tgtKey}`,
              srcKey,
              tgtKey,
              { type: 'calls', color: '#999', size: 1, arrowSize: 4 }
            );
          }
        });

        graph.setNodeAttribute(fileKey, '_expanded', true);
      } else {
        // COLLAPSE: remove all child nodes + edges
        fileMap.get(fileKey).forEach((fn) => {
          const fnKey = `${fileKey}::${fn.id}`;
          if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
        });
        // remove their edges
        graph.forEachEdge((key, edge) => {
          if (key.startsWith(`${fileKey}->`) || key.includes(`${fileKey}::`)) {
            graph.dropEdge(key);
          }
        });
        graph.setNodeAttribute(fileKey, '_expanded', false);
      }

      renderer.refresh();
    });

    console.log('✅ Graph rendered');
  })
  .catch(console.error);
