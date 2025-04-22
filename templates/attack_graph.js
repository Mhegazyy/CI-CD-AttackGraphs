// // templates/attack_graph.js

// import { DirectedGraph } from 'graphology';
// import forceAtlas2 from 'graphology-layout-forceatlas2';
// import Sigma from 'sigma';
// import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
// import tippy from 'tippy.js';
// // ───── NEW: DragNodes plugin ──────────────────────────────
// import { DragNodes } from 'sigma/plugins/dragNodes';

// // ─── 1) Grab the repo ID from ?repo_id=… ─────────────────────
// const params = new URLSearchParams(window.location.search);
// const repoId = params.get('repo_id');
// if (!repoId) {
//   document.body.innerHTML =
//     '<p style="color:red; padding:1rem;">Error: No repo_id specified in URL.</p>';
//   throw new Error('Missing repo_id');
// }

// // ─── 2) Display it in the <span id="repo-id"> ─────────────────
// const titleSpan = document.getElementById('repo-id');
// if (titleSpan) titleSpan.textContent = repoId;

// // ─── 3) Prepare the Sigma container ──────────────────────────
// const container = document.getElementById('sigma-container');
// if (!container) {
//   console.error('No element with id="sigma-container" found');
//   throw new Error('Missing sigma-container');
// }
// container.style.touchAction = 'none'; // for drag/zoom on touch

// // ─── 4) Tooltip element for tippy.js ─────────────────────────
// const tooltip = document.createElement('div');
// Object.assign(tooltip.style, {
//   position: 'absolute',
//   pointerEvents: 'none',
//   display: 'none',
//   background: 'rgba(0,0,0,0.8)',
//   color: '#fff',
//   padding: '6px 8px',
//   borderRadius: '4px',
//   fontSize: '12px',
//   maxWidth: '200px',
//   zIndex: 9999,
// });
// document.body.appendChild(tooltip);

// // ─── 5) Helper to pick nodes under cursor ────────────────────
// function pickNodeAt(renderer, graph, x, y, threshold = 15) {
//   const rect = renderer.getContainer().getBoundingClientRect();
//   const { x: gx, y: gy } = renderer.viewportToGraph({
//     x: x - rect.left,
//     y: y - rect.top,
//   });

//   let picked = null,
//       minDist = Infinity;
//   graph.forEachNode((node, attr) => {
//     const d = Math.hypot(attr.x - gx, attr.y - gy);
//     if (d < threshold && d < minDist) {
//       picked = node;
//       minDist = d;
//     }
//   });
//   return picked;
// }

// // ─── 6) Fetch & render the attack graph ──────────────────────
// fetch(`/scan/${repoId}/latest`)
//   .then(res => {
//     if (!res.ok) throw new Error(`Scan not found (status ${res.status})`);
//     return res.json();
//   })
//   .then(data => {
//     const attack_graph = data.attack_graph ?? data;
//     if (!attack_graph.nodes || !Array.isArray(attack_graph.nodes))
//       throw new Error('Invalid attack_graph format');

//     // Build lookup
//     const idToNode = new Map();
//     attack_graph.nodes.forEach(n => idToNode.set(String(n.id), n));

//     // 1) File nodes + file→children map
//     const graph = new DirectedGraph();
//     const fileMap = new Map();
//     attack_graph.nodes
//       .filter(n => n.type === 'file')
//       .forEach(file => {
//         const key = String(file.id);
//         graph.addNode(key, {
//           label: file.label,
//           filepath: file.filepath,
//           x: Math.random() * 100,
//           y: Math.random() * 100,
//           size: 18,
//           color: '#0074D9',
//           nodeCategory: 'file',
//           type: 'nodeCircle',
//           _expanded: false,
//         });
//         const children = Array.isArray(file.children)
//           ? file.children.map(String)
//           : [];
//         fileMap.set(key, children);
//       });

//     // 2) Map function → parent file
//     const fnToFile = new Map();
//     for (const [fileKey, children] of fileMap) {
//       children.forEach(fnId => fnToFile.set(fnId, fileKey));
//     }

//     // 3) Collapse file→file edges
//     const seen = new Set();
//     attack_graph.links.forEach(link => {
//       const srcF = fnToFile.get(String(link.source));
//       const tgtF = fnToFile.get(String(link.target));
//       if (srcF && tgtF && srcF !== tgtF) {
//         const eKey = `${srcF}->${tgtF}`;
//         if (!seen.has(eKey)) {
//           graph.addEdgeWithKey(eKey, srcF, tgtF, {
//             type: 'arrow',
//             color: 'rgba(150,150,150,0.8)',
//             size: 2,
//             arrowSize: 6,
//           });
//           seen.add(eKey);
//         }
//       }
//     });

//     const baseEdges = new Set(graph.edges());

//     // 4) Layout — tighten nodes by lowering scalingRatio
//     forceAtlas2.assign(graph, {
//       iterations: 200,
//       settings: {
//         gravity: 1,
//         scalingRatio: 0.5,    // ← lower repulsion → tighter graph
//         adjustSizes: true,
//         barnesHutOptimize: true
//       },
//     });

//     // 5) Sigma init
//     const renderer = new Sigma(graph, container, {
//       settings: {
//         defaultEdgeType: 'arrow',
//         minArrowSize: 6,
//         defaultEdgeColor: '#ccc',
//         defaultNodeColor: '#0074D9',
//         labelThreshold: 10,      // show smaller labels
//         labelSize: 'fixed'
//       },
//       nodeProgramClasses: { nodeCircle: NodeCircleProgram },
//       edgeProgramClasses: { arrow: EdgeArrowProgram },
//     });

//     // ─── NEW: enable node drag & drop ───────────────────────────
//     const dragHandler = new DragNodes(graph, renderer, renderer.getContainer());
//     dragHandler.enable();

//     renderer.refresh();

//     // 6) Rich tooltip on hoveimport 'tippy.js/dist/tippy.css';          // core styles
// import 'tippy.js/dist/svg-arrow.css';      // if you use SVG arrows
// import 'tippy.js/themes/light-border.css'; // bring in a built‑in theme (optional)
// import './your-custom-tippy.css';          // *then* your overridesr (any node)
//     renderer.on('enterNode', ({ node }) => {
//       const a = graph.getNodeAttributes(node);
//       // build table of attributes
//       const rows = Object.entries(a)
//         .map(([k, v]) =>
//           `<tr>
//              <th style="text-align:left;padding:2px 4px">${k}</th>
//              <td style="padding:2px 4px">${v}</td>
//            </tr>`
//         ).join('');
//       tippy(tooltip, {
//         content: `<strong>${a.label}</strong><table>${rows}</table>`,
//         allowHTML: true,
//         interactive: true,
//         trigger: 'manual',
//         placement: 'top',
//         theme: 'light-border',
//       }).show();
//     });
//     renderer.on('leaveNode', () => tooltip._tippy?.hide());

//     // 7) Expand / collapse (unchanged) …
//     container.addEventListener('click', e => {
//       const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
//       if (!fileKey) return;
//       const attrs = graph.getNodeAttributes(fileKey);
//       if (attrs.nodeCategory !== 'file') return;

//       const children = fileMap.get(fileKey) || [];
//       const childSize = 10;
//       const orbit = attrs.size + childSize + 14;

//       if (!attrs._expanded) {
//         // EXPAND…
//         children.forEach((fnId, idx) => {
//           const fnKey = `${fileKey}::${fnId}`;
//           if (graph.hasNode(fnKey)) return;
//           const meta = idToNode.get(fnId) || {};
//           const angle = (2 * Math.PI * idx) / children.length;
//           graph.addNode(fnKey, {
//             label: meta.label,
//             filepath: meta.filepath,
//             x: attrs.x + Math.cos(angle) * orbit,
//             y: attrs.y + Math.sin(angle) * orbit,
//             size: childSize,
//             color: meta.vulnerable ? '#FF4136' : '#2ECC40',
//             nodeCategory: 'function',
//             type: 'nodeCircle',
//           });
//           graph.addEdgeWithKey(
//             `${fileKey}->${fnKey}`,
//             fileKey,
//             fnKey,
//             { type: 'arrow', color: '#FF851B', size: 2, arrowSize: 8 }
//           );
//         });
//         // intra‑file edges…
//         const setIDs = new Set(children);
//         attack_graph.links.forEach(link => {
//           const s = String(link.source), t = String(link.target);
//           if (setIDs.has(s) && setIDs.has(t)) {
//             const sKey = `${fileKey}::${s}`, tKey = `${fileKey}::${t}`;
//             const eKey = `${sKey}->${tKey}`;
//             if (!graph.hasEdge(eKey)) {
//               graph.addEdgeWithKey(eKey, sKey, tKey, {
//                 type: 'arrow', color: '#999', size: 1, arrowSize: 4
//               });
//             }
//           }
//         });
//         graph.setNodeAttribute(fileKey, '_expanded', true);
//         renderer.refresh();
//       } else {
//         // COLLAPSE…
//         children.forEach(fnId => {
//           const fnKey = `${fileKey}::${fnId}`;
//           if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
//         });
//         graph.edges().forEach(eKey => {
//           if (!baseEdges.has(eKey)) graph.dropEdge(eKey);
//         });
//         graph.setNodeAttribute(fileKey, '_expanded', false);
//         renderer.refresh();
//       }
//     });

//     console.log(`✅ Attack graph for repo ${repoId} rendered`);
//   })
//   .catch(err => {
//     console.error(err);
//     container.innerHTML = `<p style="color:red; padding:1rem;">${err.message}</p>`;
//   });
// templates/attack_graph.js

// templates/attack_graph.js

// templates/attack_graph.js

// templates/attack_graph.js

// templates/attack_graph.js

// templates/attack_graph.js

import { DirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';
import Sigma from 'sigma';
import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';          // core styles
import 'tippy.js/dist/svg-arrow.css';      // SVG arrow (optional)
import 'tippy.js/themes/light-border.css'; // built‑in theme (optional)

// ─── 1) Grab the repo ID from ?repo_id=… ─────────────────────
const params = new URLSearchParams(window.location.search);
const repoId = params.get('repo_id');
if (!repoId) {
  document.body.innerHTML =
    '<p style="color:red; padding:1rem;">Error: No repo_id specified in URL.</p>';
  throw new Error('Missing repo_id');
}

// ─── 2) Display it in the <span id="repo-id"> ─────────────────
const titleSpan = document.getElementById('repo-id');
if (titleSpan) titleSpan.textContent = repoId;

// ─── 3) Prepare the Sigma container ──────────────────────────
const container = document.getElementById('sigma-container');
if (!container) {
  console.error('No element with id="sigma-container" found');
  throw new Error('Missing sigma-container');
}
container.style.touchAction = 'none';
container.style.cursor = 'grab';

// ─── 4) Tooltip element for tippy.js ─────────────────────────
const tooltip = document.createElement('div');
Object.assign(tooltip.style, {
  position: 'absolute',
  pointerEvents: 'none',
  display: 'none',
  background: 'rgba(0,0,0,0.8)',
  color: '#fff',
  padding: '6px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  maxWidth: '200px',
  zIndex: 9999,
});
document.body.appendChild(tooltip);

// ─── 5) Helper to pick nodes under cursor ────────────────────
function pickNodeAt(renderer, graph, x, y, threshold = 15) {
  const rect = renderer.getContainer().getBoundingClientRect();
  const { x: gx, y: gy } = renderer.viewportToGraph({
    x: x - rect.left,
    y: y - rect.top,
  });
  let picked = null, minDist = Infinity;
  graph.forEachNode((node, attr) => {
    const d = Math.hypot(attr.x - gx, attr.y - gy);
    if (d < threshold && d < minDist) {
      picked = node;
      minDist = d;
    }
  });
  return picked;
}

// ─── 6) Fetch & render the attack graph ──────────────────────
fetch(`/scan/${repoId}/latest`)
  .then(res => {
    if (!res.ok) throw new Error(`Scan not found (status ${res.status})`);
    return res.json();
  })
  .then(data => {
    const attack_graph = data.attack_graph ?? data;
    if (!Array.isArray(attack_graph.nodes))
      throw new Error('Invalid attack_graph format');

    // Build lookup
    const idToNode = new Map();
    attack_graph.nodes.forEach(n => idToNode.set(String(n.id), n));

    // 1) File nodes + file→children map
    const graph = new DirectedGraph();
    const fileMap = new Map();
    attack_graph.nodes
      .filter(n => n.type === 'file')
      .forEach(file => {
        const key = String(file.id);
        graph.addNode(key, {
          label: file.label,
          filepath: file.filepath,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 18,
          color: '#0074D9',
          nodeCategory: 'file',
          type: 'nodeCircle',
          _expanded: false,
        });
        fileMap.set(key, (file.children || []).map(String));
      });

    // 2) FunctionID → parentFile map
    const fnToFile = new Map();
    fileMap.forEach((children, fk) => {
      children.forEach(fnId => fnToFile.set(fnId, fk));
    });

    // 3) Collapse file→file edges
    const seen = new Set();
    attack_graph.links.forEach(link => {
      const srcF = fnToFile.get(String(link.source));
      const tgtF = fnToFile.get(String(link.target));
      if (srcF && tgtF && srcF !== tgtF) {
        const eKey = `${srcF}->${tgtF}`;
        if (!seen.has(eKey)) {
          graph.addEdgeWithKey(eKey, srcF, tgtF, {
            type: 'arrow',
            color: 'rgba(150,150,150,0.8)',
            size: 2,
            arrowSize: 6,
          });
          seen.add(eKey);
        }
      }
    });
    const baseEdges = new Set(graph.edges());

    // 4) Initial ForceAtlas2 layout
    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: {
        gravity: 1,
        scalingRatio: 4,
        adjustSizes: true,
      },
    });

    // 5) NoOverlap refinement
    noverlap.assign(graph, {
      gridSize: 10,
      nodeMargin: 15,
      scaleNodes: 1.2,
      maxIterations: 200,
    });

    // 6) Sigma init
    const renderer = new Sigma(graph, container, {
      settings: {
        defaultEdgeType: 'arrow',
        minArrowSize: 6,
        defaultEdgeColor: '#ccc',
        defaultNodeColor: '#0074D9',
        labelThreshold: 16,
        labelSize: 'fixed',
      },
      nodeProgramClasses: { nodeCircle: NodeCircleProgram },
      edgeProgramClasses: { arrow: EdgeArrowProgram },
    });
    renderer.refresh();

    // 7) Rich tooltip on hover, positioned at node
    renderer.on('enterNode', ({ node }) => {
      const a = graph.getNodeAttributes(node);
      // Build rows for table
      const rows = Object.entries(a)
        .map(
          ([k, v]) =>
            `<tr>
               <th style="text-align:left;padding:2px 4px">${k}</th>
               <td style="padding:2px 4px">${v}</td>
             </tr>`
        )
        .join('');

      // Compute the node's pixel position within the container
      const vp = renderer.graphToViewport({ x: a.x, y: a.y });
      const rect = container.getBoundingClientRect();
      const referenceRect = {
        width: 0,
        height: 0,
        top: rect.top + vp.y,
        bottom: rect.top + vp.y,
        left: rect.left + vp.x,
        right: rect.left + vp.x,
      };

      tippy(tooltip, {
        content: `<strong>${a.label}</strong><table>${rows}</table>`,
        allowHTML: true,
        interactive: true,
        trigger: 'manual',
        placement: 'right',
        animation: 'shift-away',
        arrow: true,
        offset: [0, 8],
        theme: 'custom',
        getReferenceClientRect: () => referenceRect,
        popperOptions: {
          modifiers: [
            {
              name: 'preventOverflow',
              options: { padding: 8 },
            },
            {
              name: 'flip',
              options: { fallbackPlacements: ['right', 'bottom', 'top'] },
            },
          ],
        },
      }).show();
    });
    renderer.on('leaveNode', () => tooltip._tippy?.hide());

    // 8) Expand / collapse on click, with tighter orbit
    container.addEventListener('click', e => {
      const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
      if (!fileKey) return;
      const attrs = graph.getNodeAttributes(fileKey);
      if (attrs.nodeCategory !== 'file') return;

      const children = fileMap.get(fileKey) || [];
      const childSize = 10;
      const orbit = attrs.size + childSize + 8; // closer orbit

      if (!attrs._expanded) {
        // EXPAND
        children.forEach((fnId, idx) => {
          const fnKey = `${fileKey}::${fnId}`;
          if (graph.hasNode(fnKey)) return;
          const meta = idToNode.get(fnId) || {};
          const angle = (2 * Math.PI * idx) / children.length;
          graph.addNode(fnKey, {
            label: meta.label,
            filepath: meta.filepath,
            x: attrs.x + Math.cos(angle) * orbit,
            y: attrs.y + Math.sin(angle) * orbit,
            size: childSize,
            color: meta.vulnerable ? '#FF4136' : '#2ECC40',
            nodeCategory: 'function',
            type: 'nodeCircle',
          });
          graph.addEdgeWithKey(
            `${fileKey}->${fnKey}`,
            fileKey,
            fnKey,
            { type: 'arrow', color: '#FF851B', size: 2, arrowSize: 8 }
          );
        });

        // intra‑file edges
        const setIDs = new Set(children);
        attack_graph.links.forEach(link => {
          const s = String(link.source),
            t = String(link.target);
          if (setIDs.has(s) && setIDs.has(t)) {
            const sKey = `${fileKey}::${s}`,
              tKey = `${fileKey}::${t}`,
              eKey = `${sKey}->${tKey}`;
            if (!graph.hasEdge(eKey)) {
              graph.addEdgeWithKey(eKey, sKey, tKey, {
                type: 'arrow',
                color: '#999',
                size: 1,
                arrowSize: 4,
              });
            }
          }
        });

        graph.setNodeAttribute(fileKey, '_expanded', true);
      } else {
        // COLLAPSE
        children.forEach(fnId => {
          const fnKey = `${fileKey}::${fnId}`;
          if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
        });
        graph.edges().forEach(eKey => {
          if (!baseEdges.has(eKey)) graph.dropEdge(eKey);
        });
        graph.setNodeAttribute(fileKey, '_expanded', false);
      }

      // Re-apply noverlap after expand/collapse to avoid overlap
      noverlap.assign(graph, {
        gridSize: 10,
        nodeMargin: 15,
        scaleNodes: 1.2,
        maxIterations: 100,
      });
      renderer.refresh();
    });

    console.log(`✅ Attack graph for repo ${repoId} rendered`);
  })
  .catch(err => {
    console.error(err);
    container.innerHTML =
      `<p style="color:red; padding:1rem;">${err.message}</p>`;
  });
