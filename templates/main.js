// import Graph from 'graphology';
// import forceAtlas2 from 'graphology-layout-forceatlas2';
// import Sigma from 'sigma';
// import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
// import tippy from 'tippy.js';

// /**
//  * Simple radius‐based picker in Sigma v2:
//  */
// function pickNodeAt(renderer, graph, clientX, clientY, threshold = 15) {
//   const container = renderer.getContainer();
//   const rect = container.getBoundingClientRect();
//   const { x: gx, y: gy } = renderer.viewportToGraph({
//     x: clientX - rect.left,
//     y: clientY - rect.top,
//   });

//   let picked = null,
//       minDist = Infinity;
//   graph.forEachNode((node, attr) => {
//     const dx = attr.x - gx,
//           dy = attr.y - gy,
//           d  = Math.hypot(dx, dy);
//     if (d < threshold && d < minDist) {
//       picked = node;
//       minDist = d;
//     }
//   });
//   return picked;
// }

// // Off‐DOM tooltip container for Tippy
// const tooltip = document.createElement('div');
// Object.assign(tooltip.style, {
//   position: 'absolute',
//   pointerEvents: 'none',
//   display: 'none',
//   background: 'rgba(0,0,0,0.8)',
//   color: '#fff',
//   padding: '6px',
//   borderRadius: '4px',
//   fontSize: '12px',
//   maxWidth: '200px'
// });
// document.body.appendChild(tooltip);

// fetch('/scan/3/latest')
//   .then((res) => res.json())
//   .then(({ attack_graph }) => {
//     if (!attack_graph) throw new Error('No attack_graph in response');

//     // 1) Build Graphology graph
//     const graph   = new Graph();
//     const fileMap = new Map(); // fileId → its children[]

//     // 2) Add file nodes only
//     attack_graph.nodes
//       .filter((n) => n.type === 'file')
//       .forEach((file) => {
//         graph.addNode(file.id, {
//           ...file,
//           x: Math.random() * 100,
//           y: Math.random() * 100,
//           size: 18,
//           color: '#0074D9',
//           nodeCategory: 'file',
//           type: 'nodeCircle',
//           _expanded: false
//         });
//         fileMap.set(file.id, file.children || []);
//       });

//     // 3) Collapse function→function into file→file calls
//     const seen = new Set();
//     attack_graph.links.forEach((link) => {
//       const srcFile = attack_graph.nodes.find((n) =>
//         n.children?.some((c) => c.id === link.source)
//       )?.id;
//       const tgtFile = attack_graph.nodes.find((n) =>
//         n.children?.some((c) => c.id === link.target)
//       )?.id;
//       if (srcFile && tgtFile && srcFile !== tgtFile) {
//         const edgeKey = `${srcFile}->${tgtFile}`;
//         if (!seen.has(edgeKey)) {
//           graph.addEdgeWithKey(edgeKey, srcFile, tgtFile, {
//             type:      'arrow',                // <— use built‑in arrow
//             color:     'rgba(150,150,150,0.8)',
//             size:      2,
//             arrowSize: 6
//           });
//           seen.add(edgeKey);
//         }
//       }
//     });

//     // 4) Layout
//     forceAtlas2.assign(graph, {
//       iterations: 200,
//       settings: { gravity: 1, scalingRatio: 4, adjustSizes: true }
//     });

//     // 5) Sigma init
//     const container = document.getElementById('container');
//     container.style.touchAction = 'none';
//     const renderer = new Sigma(graph, container, {
//       settings: {
//         defaultEdgeType: 'arrow',   // ensure "arrow" is the default
//         minArrowSize:    6,
//         defaultEdgeColor:'#ccc',
//         defaultNodeColor:'#0074D9',
//         labelThreshold: 16
//       },
//       nodeProgramClasses: { nodeCircle: NodeCircleProgram },
//       edgeProgramClasses: {
//         arrow:     EdgeArrowProgram,  // <— add this!
//         calls:     EdgeArrowProgram,
//         has_child: EdgeArrowProgram
//       }
//     });

//     // 6) Tooltip on file hover
//     renderer.on('enterNode', ({ node }) => {
//       const a = graph.getNodeAttributes(node);
//       if (a.nodeCategory !== 'file') return;
//       tippy(tooltip, {
//         content: `<strong>${a.label}</strong><br>${a.filepath}`,
//         allowHTML: true,
//         placement: 'top',
//         trigger: 'manual',
//         theme: 'light-border'
//       }).show();
//     });
//     renderer.on('leaveNode', () => {
//       tooltip._tippy?.hide();
//     });

//     // 7) Drill‑down
//     container.addEventListener('click', (e) => {
//       const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
//       if (!fileKey) return;
//       const f = graph.getNodeAttributes(fileKey);
//       if (f.nodeCategory !== 'file') return;

//       if (!f._expanded) {
//         // EXPAND: functions + arrows
//         fileMap.get(fileKey).forEach((fn, i) => {
//           const fnKey = `${fileKey}::${fn.id}`;
//           const angle = (2 * Math.PI * i) / fileMap.get(fileKey).length;
//           const radius = 30;
//           graph.addNode(fnKey, {
//             ...fn,
//             x: f.x + Math.cos(angle) * radius,
//             y: f.y + Math.sin(angle) * radius,
//             size: 10,
//             color: fn.vulnerable ? '#FF4136' : '#2ECC40',
//             nodeCategory: 'function',
//             type: 'nodeCircle'
//           });
//           graph.addEdge(`${fileKey}->${fnKey}`, fileKey, fnKey, {
//             type:      'arrow',    // `<— arrow here too`
//             color:     'rgba(200,200,200,0.6)',
//             size:      1,
//             arrowSize: 4
//           });
//         });

//         // intra‑file calls
//         attack_graph.links.forEach((link) => {
//           const children = fileMap.get(fileKey).map((c) => c.id);
//           if (
//             children.includes(link.source) &&
//             children.includes(link.target)
//           ) {
//             const srcKey = `${fileKey}::${link.source}`;
//             const tgtKey = `${fileKey}::${link.target}`;
//             graph.addEdge(
//               `${srcKey}->${tgtKey}`,
//               srcKey,
//               tgtKey,
//               { type: 'arrow', color: '#999', size: 1, arrowSize: 4 }
//             );
//           }
//         });

//         graph.setNodeAttribute(fileKey, '_expanded', true);
//       } else {
//         // COLLAPSE
//         fileMap.get(fileKey).forEach((fn) => {
//           const fnKey = `${fileKey}::${fn.id}`;
//           if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
//         });
//         graph.forEachEdge((key) => {
//           if (key.startsWith(`${fileKey}->`) || key.includes(`${fileKey}::`)) {
//             graph.dropEdge(key);
//           }
//         });
//         graph.setNodeAttribute(fileKey, '_expanded', false);
//       }

//       renderer.refresh();
//     });

//     console.log('✅ Attack graph rendered');
//   })
//   .catch(console.error);









//////////////////////////////////////////////////////////////////////////////////////////////////////////
// import Graph from 'graphology';
// import forceAtlas2 from 'graphology-layout-forceatlas2';
// import Sigma from 'sigma';
// import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
// import tippy from 'tippy.js';

// /**
//  * Simple radius–based picker in Sigma v2:
//  */
// function pickNodeAt(renderer, graph, clientX, clientY, threshold = 15) {
//   const container = renderer.getContainer();
//   const rect = container.getBoundingClientRect();
//   const { x: gx, y: gy } = renderer.viewportToGraph({
//     x: clientX - rect.left,
//     y: clientY - rect.top,
//   });

//   let picked = null,
//       minDist = Infinity;
//   graph.forEachNode((node, attr) => {
//     const dx = attr.x - gx,
//           dy = attr.y - gy,
//           d  = Math.hypot(dx, dy);
//     if (d < threshold && d < minDist) {
//       picked = node;
//       minDist = d;
//     }
//   });
//   return picked;
// }

// // Off–DOM tooltip container for Tippy
// const tooltip = document.createElement('div');
// Object.assign(tooltip.style, {
//   position: 'absolute',
//   pointerEvents: 'none',
//   display: 'none',
//   background: 'rgba(0,0,0,0.8)',
//   color: '#fff',
//   padding: '6px',
//   borderRadius: '4px',
//   fontSize: '12px',
//   maxWidth: '200px'
// });
// document.body.appendChild(tooltip);

// fetch('/scan/3/latest')
//   .then((res) => res.json())
//   .then(({ attack_graph }) => {
//     if (!attack_graph) throw new Error('No attack_graph in response');

//     // 1) Build Graphology graph
//     const graph   = new Graph();
//     const fileMap = new Map(); // fileId → its children[]

//     // 2) Add file nodes only
//     attack_graph.nodes
//       .filter((n) => n.type === 'file')
//       .forEach((file) => {
//         graph.addNode(file.id, {
//           ...file,
//           x: Math.random() * 100,
//           y: Math.random() * 100,
//           size: 18,
//           color: '#0074D9',
//           nodeCategory: 'file',
//           type: 'nodeCircle',
//           _expanded: false
//         });
//         fileMap.set(file.id, file.children || []);
//       });

//     // 3) Collapse function→function into file→file calls
//     const seen = new Set();
//     attack_graph.links.forEach((link) => {
//       const srcFile = attack_graph.nodes.find((n) =>
//         n.children?.some((c) => c.id === link.source)
//       )?.id;
//       const tgtFile = attack_graph.nodes.find((n) =>
//         n.children?.some((c) => c.id === link.target)
//       )?.id;
//       if (srcFile && tgtFile && srcFile !== tgtFile) {
//         const edgeKey = `${srcFile}->${tgtFile}`;
//         if (!seen.has(edgeKey)) {
//           graph.addEdgeWithKey(edgeKey, srcFile, tgtFile, {
//             type:      'arrow',
//             color:     'rgba(150,150,150,0.8)',
//             size:      2,
//             arrowSize: 6
//           });
//           seen.add(edgeKey);
//         }
//       }
//     });

//     // 4) Layout
//     forceAtlas2.assign(graph, {
//       iterations: 200,
//       settings: { gravity: 1, scalingRatio: 4, adjustSizes: true }
//     });

//     // 5) Sigma init
//     const container = document.getElementById('container');
//     container.style.touchAction = 'none';
//     const renderer = new Sigma(graph, container, {
//       settings: {
//         defaultEdgeType: 'arrow',
//         minArrowSize:    6,
//         defaultEdgeColor:'#ccc',
//         defaultNodeColor:'#0074D9',
//         labelThreshold: 16
//       },
//       nodeProgramClasses: { nodeCircle: NodeCircleProgram },
//       edgeProgramClasses: {
//         arrow:     EdgeArrowProgram,
//         calls:     EdgeArrowProgram,
//         has_child: EdgeArrowProgram
//       }
//     });

//     // 6) Tooltip on file hover
//     renderer.on('enterNode', ({ node }) => {
//       const a = graph.getNodeAttributes(node);
//       if (a.nodeCategory !== 'file') return;
//       tippy(tooltip, {
//         content: `<strong>${a.label}</strong><br>${a.filepath}`,
//         allowHTML: true,
//         placement: 'top',
//         trigger: 'manual',
//         theme: 'light-border'
//       }).show();
//     });
//     renderer.on('leaveNode', () => {
//       tooltip._tippy?.hide();
//     });

//     // 7) Drill–down
//     container.addEventListener('click', (e) => {
//       const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
//       if (!fileKey) return;
//       const f = graph.getNodeAttributes(fileKey);
//       if (f.nodeCategory !== 'file') return;

//       const rawChildren = fileMap.get(fileKey) || [];

//       if (!f._expanded) {
//         // Prepare children with stable IDs
//         const children = rawChildren.map((fn, i) => ({
//           fn,
//           childId: fn.id != null ? fn.id : `auto-${i}`
//         }));

//         // EXPAND: add each function node + arrow
//         children.forEach(({ fn, childId }, i) => {
//           const fnKey = `${fileKey}::${childId}`;
//           if (!graph.hasNode(fnKey)) {
//             const angle  = (2 * Math.PI * i) / children.length;
//             const radius = 30;
//             graph.addNode(fnKey, {
//               ...fn,
//               x: f.x + Math.cos(angle) * radius,
//               y: f.y + Math.sin(angle) * radius,
//               size: 10,
//               color: fn.vulnerable ? '#FF4136' : '#2ECC40',
//               nodeCategory: 'function',
//               type: 'nodeCircle'
//             });
//             graph.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
//               type:      'arrow',
//               color:     'rgba(200,200,200,0.6)',
//               size:      1,
//               arrowSize: 4
//             });
//           }
//         });

//         // intra–file function calls
//         attack_graph.links.forEach((link) => {
//           const ids = rawChildren.map((c) => c.id);
//           if (ids.includes(link.source) && ids.includes(link.target)) {
//             const srcKey = `${fileKey}::${link.source}`;
//             const tgtKey = `${fileKey}::${link.target}`;
//             const edgeKey = `${srcKey}->${tgtKey}`;
//             if (!graph.hasEdge(edgeKey)) {
//               graph.addEdgeWithKey(edgeKey, srcKey, tgtKey, {
//                 type:      'arrow',
//                 color:     '#999',
//                 size:      1,
//                 arrowSize: 4
//               });
//             }
//           }
//         });

//         graph.setNodeAttribute(fileKey, '_expanded', true);
//       } else {
//         // COLLAPSE: remove function nodes + edges
//         rawChildren.forEach((fn, i) => {
//           const childId = fn.id != null ? fn.id : `auto-${i}`;
//           const fnKey   = `${fileKey}::${childId}`;
//           if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
//         });
//         graph.forEachEdge((key) => {
//           if (key.startsWith(`${fileKey}->`) || key.includes(`${fileKey}::`)) {
//             graph.dropEdge(key);
//           }
//         });
//         graph.setNodeAttribute(fileKey, '_expanded', false);
//       }

//       renderer.refresh();
//     });

//     console.log('✅ Attack graph rendered');
//   })
//   .catch(console.error);




///////////////////////////////////////////////////////////////////////////////////////////////////////////////


import { DirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
import tippy from 'tippy.js';

/**
 * Simple radius–based picker in Sigma v2
 */
function pickNodeAt(renderer, graph, clientX, clientY, threshold = 15) {
  const rect = renderer.getContainer().getBoundingClientRect();
  const { x: gx, y: gy } = renderer.viewportToGraph({
    x: clientX - rect.left,
    y: clientY - rect.top,
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

// Off‑DOM tooltip container for Tippy
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
  .then(res => res.json())
  .then(({ attack_graph }) => {
    if (!attack_graph || !Array.isArray(attack_graph.nodes)) {
      throw new Error('Invalid attack_graph format');
    }

    // ——— Build a lookup from node ID to its metadata ———
    const idToNode = new Map();
    attack_graph.nodes.forEach(n => {
      idToNode.set(String(n.id), n);
    });

    // ——— Initialize Graphology graph and file → [childIDs] map ———
    const graph = new DirectedGraph();
    const fileMap = new Map(); // fileId → array of function‑ID strings

    attack_graph.nodes
      .filter(n => n.type === 'file')
      .forEach(file => {
        const fileKey = String(file.id);
        // Add the file node with random initial coordinates
        graph.addNode(fileKey, {
          label:        file.label,
          filepath:     file.filepath,
          x:            Math.random() * 100,
          y:            Math.random() * 100,
          size:         18,
          color:        '#0074D9',
          nodeCategory: 'file',
          type:         'nodeCircle',
          _expanded:    false
        });
        // Children property is an array of function-ID strings
        const childrenIDs = Array.isArray(file.children)
          ? file.children.map(String)
          : [];
        fileMap.set(fileKey, childrenIDs);
      });

    // ——— Build function‑ID → parent fileId map ———
    const functionToFile = new Map();
    for (const [fileKey, childIDs] of fileMap) {
      childIDs.forEach(fnId => {
        functionToFile.set(fnId, fileKey);
      });
    }

    // ——— Collapse function→function calls into file→file edges ———
    const seen = new Set();
    attack_graph.links.forEach(link => {
      const srcId = String(link.source);
      const tgtId = String(link.target);
      const srcFile = functionToFile.get(srcId);
      const tgtFile = functionToFile.get(tgtId);

      if (srcFile && tgtFile && srcFile !== tgtFile) {
        const edgeKey = `${srcFile}->${tgtFile}`;
        if (!seen.has(edgeKey)) {
          graph.addEdgeWithKey(edgeKey, srcFile, tgtFile, {
            type:      'arrow',
            color:     'rgba(150,150,150,0.8)',
            size:      2,
            arrowSize: 6
          });
          seen.add(edgeKey);
        }
      }
    });

    // ——— Apply ForceAtlas2 layout ———
    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: { gravity: 1, scalingRatio: 4, adjustSizes: true }
    });

    console.log('Edges after collapse:', graph.edges().length);

    // ——— Initialize Sigma renderer ———
    const container = document.getElementById('container');
    if (!container) throw new Error('#container element not found');
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
        arrow:     EdgeArrowProgram,
        calls:     EdgeArrowProgram,
        has_child: EdgeArrowProgram
      }
    });

    renderer.refresh();

    // ——— Tooltip behavior on file hover ———
    renderer.on('enterNode', ({ node }) => {
      const a = graph.getNodeAttributes(node);
      if (a.nodeCategory !== 'file') return;
      tippy(tooltip, {
        content: `<strong>${a.label}</strong><br>${a.filepath}`,
        allowHTML: true,
        placement: 'top',
        trigger: 'manual',
        theme: 'light-border'
      }).show();
    });
    renderer.on('leaveNode', () => {
      tooltip._tippy?.hide();
    });

    // ——— Drill‑down expand/collapse on click ———
    container.addEventListener('click', e => {
      const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
      if (!fileKey) return;
      const attrs = graph.getNodeAttributes(fileKey);
      if (attrs.nodeCategory !== 'file') return;

      const childIDs = fileMap.get(fileKey) || [];
      if (!attrs._expanded) {
        // EXPAND: add each function node + file→function edge
        childIDs.forEach((fnId, i) => {
          const fnKey = `${fileKey}::${fnId}`;
          if (!graph.hasNode(fnKey)) {
            const fnMeta = idToNode.get(fnId) || {};
            const angle  = (2 * Math.PI * i) / childIDs.length;
            const radius = 30;
            graph.addNode(fnKey, {
              label:        fnMeta.label,
              filepath:     fnMeta.filepath,
              x:            attrs.x + Math.cos(angle) * radius,
              y:            attrs.y + Math.sin(angle) * radius,
              size:         10,
              color:        fnMeta.vulnerable ? '#FF4136' : '#2ECC40',
              nodeCategory: 'function',
              type:         'nodeCircle'
            });
            graph.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
              type:      'arrow',
              color:     'rgba(200,200,200,0.6)',
              size:      1,
              arrowSize: 4
            });
          }
        });

        // Add intra‑file function→function edges
        const setIDs = new Set(childIDs);
        attack_graph.links.forEach(link => {
          const s = String(link.source), t = String(link.target);
          if (setIDs.has(s) && setIDs.has(t)) {
            const sKey = `${fileKey}::${s}`;
            const tKey = `${fileKey}::${t}`;
            const eKey = `${sKey}->${tKey}`;
            if (!graph.hasEdge(eKey)) {
              graph.addEdgeWithKey(eKey, sKey, tKey, {
                type:      'arrow',
                color:     '#999',
                size:      1,
                arrowSize: 4
              });
            }
          }
        });

        graph.setNodeAttribute(fileKey, '_expanded', true);
      } else {
        // COLLAPSE: remove all child nodes + edges
        childIDs.forEach(fnId => {
          const fnKey = `${fileKey}::${fnId}`;
          if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
        });
        graph.forEachEdge((key) => {
          if (key.startsWith(`${fileKey}->`) || key.includes(`${fileKey}::`)) {
            graph.dropEdge(key);
          }
        });
        graph.setNodeAttribute(fileKey, '_expanded', false);
      }

      renderer.refresh();
    });

    console.log('✅ Attack graph rendered');
  })
  .catch(console.error);

