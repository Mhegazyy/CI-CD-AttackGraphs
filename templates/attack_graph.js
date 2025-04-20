// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// import { DirectedGraph } from 'graphology';
// import forceAtlas2 from 'graphology-layout-forceatlas2';
// import Sigma from 'sigma';
// import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
// import tippy from 'tippy.js';

// /**
//  * Simple radius–based picker in Sigma v2
//  */
// function pickNodeAt(renderer, graph, clientX, clientY, threshold = 15) {
//   const rect = renderer.getContainer().getBoundingClientRect();
//   const { x: gx, y: gy } = renderer.viewportToGraph({
//     x: clientX - rect.left,
//     y: clientY - rect.top
//   });

//   let picked = null,
//     minDist = Infinity;
//   graph.forEachNode((node, attr) => {
//     const d = Math.hypot(attr.x - gx, attr.y - gy);
//     if (d < threshold && d < minDist) {
//       picked = node;
//       minDist = d;
//     }
//   });
//   return picked;
// }

// // ───────────────────────────────────────────────────────────
// // Tooltip container for Tippy
// // ───────────────────────────────────────────────────────────
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

// // ───────────────────────────────────────────────────────────
// // Fetch + render attack‑graph
// // ───────────────────────────────────────────────────────────
// fetch('/scan/3/latest')
//   .then(res => res.json())
//   .then(({ attack_graph }) => {
//     if (!attack_graph || !Array.isArray(attack_graph.nodes))
//       throw new Error('Invalid attack_graph format');

//     // Lookup tables
//     const idToNode = new Map();
//     attack_graph.nodes.forEach(n => idToNode.set(String(n.id), n));

//     // 1) Graph + file→children map
//     const graph = new DirectedGraph();
//     const fileMap = new Map();
//     attack_graph.nodes
//       .filter(n => n.type === 'file')
//       .forEach(file => {
//         const fileKey = String(file.id);
//         graph.addNode(fileKey, {
//           label: file.label,
//           filepath: file.filepath,
//           x: Math.random() * 100,
//           y: Math.random() * 100,
//           size: 18, // file‑node radius
//           color: '#0074D9',
//           nodeCategory: 'file',
//           type: 'nodeCircle',
//           _expanded: false
//         });
//         const childrenIDs = Array.isArray(file.children)
//           ? file.children.map(String)
//           : [];
//         fileMap.set(fileKey, childrenIDs);
//       });

//     // 2) functionID → parentFile
//     const fnToFile = new Map();
//     for (const [fileKey, childIDs] of fileMap)
//       childIDs.forEach(fnId => fnToFile.set(fnId, fileKey));

//     // 3) Collapse function→function into file→file edges
//     const seen = new Set();
//     attack_graph.links.forEach(link => {
//       const srcFile = fnToFile.get(String(link.source));
//       const tgtFile = fnToFile.get(String(link.target));
//       if (srcFile && tgtFile && srcFile !== tgtFile) {
//         const eKey = `${srcFile}->${tgtFile}`;
//         if (!seen.has(eKey)) {
//           graph.addEdgeWithKey(eKey, srcFile, tgtFile, {
//             type: 'arrow',
//             color: 'rgba(150,150,150,0.8)',
//             size: 2,
//             arrowSize: 6
//           });
//           seen.add(eKey);
//         }
//       }
//     });

//     const baseEdges = new Set(graph.edges()); // preserve core edges

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
//         minArrowSize: 6,
//         defaultEdgeColor: '#ccc',
//         defaultNodeColor: '#0074D9',
//         labelThreshold: 16
//       },
//       nodeProgramClasses: { nodeCircle: NodeCircleProgram },
//       edgeProgramClasses: { arrow: EdgeArrowProgram } // one program covers all
//     });
//     renderer.refresh();

//     // 6) Tooltip
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
//     renderer.on('leaveNode', () => tooltip._tippy?.hide());

//     // 7) Expand / collapse on click
//     container.addEventListener('click', e => {
//       const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
//       if (!fileKey) return;
//       const attrs = graph.getNodeAttributes(fileKey);
//       if (attrs.nodeCategory !== 'file') return;

//       const childIDs = fileMap.get(fileKey) || [];
//       const childSize = 10; // function‑node radius
//       const orbit = attrs.size + childSize + 10; // guarantees ≥10 px visible edge

//       if (!attrs._expanded) {
//         // EXPAND
//         childIDs.forEach((fnId, i) => {
//           const fnKey = `${fileKey}::${fnId}`;
//           if (!graph.hasNode(fnKey)) {
//             const fn = idToNode.get(fnId) || {};
//             const angle = (2 * Math.PI * i) / childIDs.length;
//             graph.addNode(fnKey, {
//               label: fn.label,
//               filepath: fn.filepath,
//               x: attrs.x + Math.cos(angle) * orbit,
//               y: attrs.y + Math.sin(angle) * orbit,
//               size: childSize,
//               color: fn.vulnerable ? '#FF4136' : '#2ECC40',
//               nodeCategory: 'function',
//               type: 'nodeCircle'
//             });
//             graph.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
//               type: 'arrow',
//               color: 'rgba(200,200,200,0.7)',
//               size: 1,
//               arrowSize: 4
//             });
//           }
//         });

//         // intra‑file function→function edges
//         const setIDs = new Set(childIDs);
//         attack_graph.links.forEach(link => {
//           const s = String(link.source),
//             t = String(link.target);
//           if (setIDs.has(s) && setIDs.has(t)) {
//             const sKey = `${fileKey}::${s}`;
//             const tKey = `${fileKey}::${t}`;
//             const eKey = `${sKey}->${tKey}`;
//             if (!graph.hasEdge(eKey))
//               graph.addEdgeWithKey(eKey, sKey, tKey, {
//                 type: 'arrow',
//                 color: '#999',
//                 size: 1,
//                 arrowSize: 4
//               });
//           }
//         });

//         graph.setNodeAttribute(fileKey, '_expanded', true);
//         renderer.refresh();
//       } else {
//         // COLLAPSE
//         childIDs.forEach(fnId => {
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

//     console.log('✅ Attack graph rendered');
//   })
//   .catch(console.error);

// ───────────────────────────────────────────────────────────
import { DirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
import tippy from 'tippy.js';

/* -------------------------------------------------- */
/* Helper: pick node under cursor                     */
/* -------------------------------------------------- */
function pickNodeAt(renderer, graph, clientX, clientY, threshold = 15) {
  const rect = renderer.getContainer().getBoundingClientRect();
  const { x: gx, y: gy } = renderer.viewportToGraph({
    x: clientX - rect.left,
    y: clientY - rect.top,
  });

  let picked = null,
    minDist = Infinity;
  graph.forEachNode((node, attr) => {
    const d = Math.hypot(attr.x - gx, attr.y - gy);
    if (d < threshold && d < minDist) {
      picked = node;
      minDist = d;
    }
  });
  return picked;
}

/* -------------------------------------------------- */
/* Off‑DOM tooltip container for tippy.js             */
/* -------------------------------------------------- */
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
  maxWidth: '200px',
});
document.body.appendChild(tooltip);

/* -------------------------------------------------- */
/* Fetch attack graph and render                      */
/* -------------------------------------------------- */
fetch('/scan/3/latest')
  .then((res) => res.json())
  .then(({ attack_graph }) => {
    if (!attack_graph || !Array.isArray(attack_graph.nodes))
      throw new Error('Invalid attack_graph format');

    /* --- Build lookup maps --- */
    const idToNode = new Map();
    attack_graph.nodes.forEach((n) => idToNode.set(String(n.id), n));

    /* --- 1. Graph + file→children map --- */
    const graph = new DirectedGraph();
    const fileMap = new Map();

    attack_graph.nodes
      .filter((n) => n.type === 'file')
      .forEach((file) => {
        const fileKey = String(file.id);
        graph.addNode(fileKey, {
          label: file.label,
          filepath: file.filepath,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 18, // file radius
          color: '#0074D9',
          nodeCategory: 'file',
          type: 'nodeCircle',
          _expanded: false,
        });
        const childrenIDs = Array.isArray(file.children)
          ? file.children.map(String)
          : [];
        fileMap.set(fileKey, childrenIDs);
      });

    /* --- 2. functionID → parentFile map --- */
    const fnToFile = new Map();
    for (const [fileKey, childIDs] of fileMap)
      childIDs.forEach((fnId) => fnToFile.set(fnId, fileKey));

    /* --- 3. Collapse function→function into file→file edges --- */
    const seen = new Set();
    attack_graph.links.forEach((link) => {
      const srcFile = fnToFile.get(String(link.source));
      const tgtFile = fnToFile.get(String(link.target));
      if (srcFile && tgtFile && srcFile !== tgtFile) {
        const eKey = `${srcFile}->${tgtFile}`;
        if (!seen.has(eKey)) {
          graph.addEdgeWithKey(eKey, srcFile, tgtFile, {
            type: 'arrow',
            color: 'rgba(150,150,150,0.8)',
            size: 2,
            arrowSize: 6,
          });
          seen.add(eKey);
        }
      }
    });

    const baseEdges = new Set(graph.edges()); // preserve core edges

    /* --- 4. Layout --- */
    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: { gravity: 1, scalingRatio: 4, adjustSizes: true },
    });

    /* --- 5. Sigma init --- */
    const container = document.getElementById('container');
    container.style.touchAction = 'none';

    const renderer = new Sigma(graph, container, {
      settings: {
        defaultEdgeType: 'arrow',
        minArrowSize: 6,
        defaultEdgeColor: '#ccc',
        defaultNodeColor: '#0074D9',
        labelThreshold: 16,
      },
      nodeProgramClasses: { nodeCircle: NodeCircleProgram },
      edgeProgramClasses: { arrow: EdgeArrowProgram }, // one program handles all
    });
    renderer.refresh();

    /* --- 6. Tooltip --- */
    renderer.on('enterNode', ({ node }) => {
      const a = graph.getNodeAttributes(node);
      if (a.nodeCategory !== 'file') return;
      tippy(tooltip, {
        content: `<strong>${a.label}</strong><br>${a.filepath}`,
        allowHTML: true,
        placement: 'top',
        trigger: 'manual',
        theme: 'light-border',
      }).show();
    });
    renderer.on('leaveNode', () => tooltip._tippy?.hide());

    /* --------------------------------------------------
       7. Expand / collapse on click
       -------------------------------------------------- */
    container.addEventListener('click', (e) => {
      const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
      if (!fileKey) return;
      const attrs = graph.getNodeAttributes(fileKey);
      if (attrs.nodeCategory !== 'file') return;

      const childIDs = fileMap.get(fileKey) || [];
      const childSize = 10; // radius of function nodes
      const orbit = attrs.size + childSize + 14; // ≥14 px visible edge

      if (!attrs._expanded) {
        /* ---------- EXPAND ---------- */
        childIDs.forEach((fnId, i) => {
          const fnKey = `${fileKey}::${fnId}`;
          if (graph.hasNode(fnKey)) return; // already added

          const fnMeta = idToNode.get(fnId) || {};
          const angle = (2 * Math.PI * i) / childIDs.length;

          graph.addNode(fnKey, {
            label: fnMeta.label,
            filepath: fnMeta.filepath,
            x: attrs.x + Math.cos(angle) * orbit,
            y: attrs.y + Math.sin(angle) * orbit,
            size: childSize,
            color: fnMeta.vulnerable ? '#FF4136' : '#2ECC40',
            nodeCategory: 'function',
            type: 'nodeCircle',
          });

          // parent → child spoke (long enough & bright)
          graph.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
            type: 'arrow',
            color: '#FF851B',
            size: 2,
            arrowSize: 8,
          });
        });

        /* ---- intra‑file function→function edges ---- */
        const setIDs = new Set(childIDs);
        attack_graph.links.forEach((link) => {
          const s = String(link.source),
            t = String(link.target);
          if (setIDs.has(s) && setIDs.has(t)) {
            const sKey = `${fileKey}::${s}`;
            const tKey = `${fileKey}::${t}`;
            const eKey = `${sKey}->${tKey}`;
            if (!graph.hasEdge(eKey))
              graph.addEdgeWithKey(eKey, sKey, tKey, {
                type: 'arrow',
                color: '#999',
                size: 1,
                arrowSize: 4,
              });
          }
        });

        graph.setNodeAttribute(fileKey, '_expanded', true);
        renderer.refresh();
      } else {
        /* ---------- COLLAPSE ---------- */
        childIDs.forEach((fnId) => {
          const fnKey = `${fileKey}::${fnId}`;
          if (graph.hasNode(fnKey)) graph.dropNode(fnKey);
        });
        graph.edges().forEach((eKey) => {
          if (!baseEdges.has(eKey)) graph.dropEdge(eKey);
        });
        graph.setNodeAttribute(fileKey, '_expanded', false);
        renderer.refresh();
      }
    });

    console.log('✅ Attack graph rendered');
  })
  .catch(console.error);
