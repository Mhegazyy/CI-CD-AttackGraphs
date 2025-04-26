// import { DirectedGraph } from 'graphology';
// import forceAtlas2 from 'graphology-layout-forceatlas2';
// import noverlap from 'graphology-layout-noverlap';
// import Sigma from 'sigma';
// import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
// import tippy from 'tippy.js';
// import 'tippy.js/dist/tippy.css';
// import 'tippy.js/dist/svg-arrow.css';
// import 'tippy.js/themes/light-border.css';

// // ───────────────────────────────────────────────────────────
// // 0)  Repo-id & DOM hooks
// // ───────────────────────────────────────────────────────────
// const params  = new URLSearchParams(window.location.search);
// const repoId  = params.get('repo_id');
// if (!repoId) {
//   document.body.innerHTML = '<p style="color:red">Error: repo_id missing</p>';
//   throw new Error('repo_id missing');
// }
// const titleSpan = document.getElementById('repo-id');
// if (titleSpan) titleSpan.textContent = repoId;

// const container = document.getElementById('sigma-container');
// if (!container) throw new Error('Missing <div id="sigma-container">');

// container.style.touchAction = 'none';
// container.style.cursor      = 'grab';

// // ───────────────────────────────────────────────────────────
// // 1) Helper: Pick node under cursor (unchanged)
// // ───────────────────────────────────────────────────────────
// function pickNodeAt(renderer, graph, x, y, threshold = 15) {
//   const rect = renderer.getContainer().getBoundingClientRect();
//   const { x: gx, y: gy } = renderer.viewportToGraph({
//     x: x - rect.left,
//     y: y - rect.top,
//   });
//   let picked = null, minDist = Infinity;
//   graph.forEachNode((node, attr) => {
//     const d = Math.hypot(attr.x - gx, attr.y - gy);
//     if (d < threshold && d < minDist) {
//       picked   = node;
//       minDist  = d;
//     }
//   });
//   return picked;
// }

// // ───────────────────────────────────────────────────────────
// // 2) Fetch scan → get attack_graph & AI-assessment
// // ───────────────────────────────────────────────────────────
// fetch(`/scan/${repoId}/latest`)
//   .then(r => {
//     if (!r.ok) throw new Error(`Scan not found (status ${r.status})`);
//     return r.json();
//   })
//   .then(data => {
//     /* ----------------------------------------
//        2a) basic graph data
//     ---------------------------------------- */
//     const attack_graph = data.attack_graph ?? data;
//     if (!Array.isArray(attack_graph.nodes))
//       throw new Error('Invalid attack_graph');

//     /* ----------------------------------------
//        2b) AI assessment for attack-paths
//     ---------------------------------------- */
//     const ia   = data.ai_assessment?.impact_assessment ?? {};
//     const edgeInAttackPath = new Set();
//     (ia.critical_attack_paths || []).forEach(path => {
//       for (let i = 0; i < path.length - 1; i++) {
//         edgeInAttackPath.add(`${path[i]}|${path[i + 1]}`);
//       }
//     });

//     /* ----------------------------------------
//        2c) build lookups
//     ---------------------------------------- */
//     const idToNode = new Map();
//     attack_graph.nodes.forEach(n => idToNode.set(String(n.id), n));

//     const graph   = new DirectedGraph();
//     const fileMap = new Map();     // file-node → [funcIds]

//     // ── FILE NODES ─────────────────────────────────────────
//     attack_graph.nodes
//       .filter(n => n.type === 'file')
//       .forEach(file => {
//         const key   = String(file.id);
//         const funcs = (file.children || []).map(String);
//         fileMap.set(key, funcs);

//         // is any child vulnerable?
//         const tainted = funcs.some(fnId => {
//           const meta = idToNode.get(fnId) || {};
//           return meta.vulnerable;
//         });

//         graph.addNode(key, {
//           label       : file.label,
//           filepath    : file.filepath,
//           x           : Math.random() * 100,
//           y           : Math.random() * 100,
//           size        : 18,
//           color       : tainted ? '#ffe066' : '#0074D9',  // ⭐ yellow if vulnerable
//           nodeCategory: 'file',
//           type        : 'nodeCircle',
//           _expanded   : false,
//         });
//       });

//     /* map func → parent file */
//     const fnToFile = new Map();
//     fileMap.forEach((children, fk) => children.forEach(fn => fnToFile.set(fn, fk)));

//     /* ── COLLAPSED FILE→FILE EDGES (plus red highlight) ── */
//     const seenEdges = new Set();
//     attack_graph.links.forEach(link => {
//       const srcF = fnToFile.get(String(link.source));
//       const tgtF = fnToFile.get(String(link.target));
//       if (srcF && tgtF && srcF !== tgtF) {
//         const key = `${srcF}|${tgtF}`;
//         if (seenEdges.has(key)) return;
//         seenEdges.add(key);

//         graph.addEdgeWithKey(`${srcF}->${tgtF}`, srcF, tgtF, {
//           type     : 'arrow',
//           size     : edgeInAttackPath.has(key) ? 3      : 2,
//           color    : edgeInAttackPath.has(key) ? '#d62728' : 'rgba(150,150,150,0.8)', // ⭐ red if attack path
//           arrowSize: edgeInAttackPath.has(key) ? 8      : 6,
//           isAttack : edgeInAttackPath.has(key) ? 1      : 0,
//         });
//       }
//     });
//     const baseEdges = new Set(graph.edges()); // remember originals

//     /* ----------------------------------------
//        3) Layout
//     ---------------------------------------- */
//     forceAtlas2.assign(graph, {
//       iterations: 200,
//       settings  : { gravity: 1, scalingRatio: 4, adjustSizes: true },
//     });
//     noverlap.assign(graph, {
//       gridSize: 10, nodeMargin: 15, scaleNodes: 1.2, maxIterations: 200,
//     });

//     /* ----------------------------------------
//        4) Sigma renderer
//     ---------------------------------------- */
//     const renderer = new Sigma(graph, container, {
//       settings: {
//         defaultEdgeType  : 'arrow',
//         minArrowSize     : 6,
//         labelSize        : 'fixed',
//         labelThreshold   : 16,
//         nodeReducer(node, attrs) {
//           // flash attack-path edges on hover
//           return attrs;
//         },
//       },
//       nodeProgramClasses: { nodeCircle: NodeCircleProgram },
//       edgeProgramClasses: { arrow     : EdgeArrowProgram },
//     });
//     renderer.refresh();

//     /* ----------------------------------------
//        5) Tooltip on hover (unchanged)
//     ---------------------------------------- */
//     renderer.on('enterNode', ({ node }) => {
//       const a = graph.getNodeAttributes(node);
//       const rows = Object.entries(a).map(
//         ([k, v]) => `<tr><th style="text-align:left;padding:2px 4px">${k}</th>
//                          <td style="padding:2px 4px">${v}</td></tr>`).join('');

//       const vp   = renderer.graphToViewport({ x: a.x, y: a.y });
//       const rect = container.getBoundingClientRect();
//       const referenceRect = {
//         width: 0, height: 0,
//         top: rect.top + vp.y, bottom: rect.top + vp.y,
//         left: rect.left + vp.x, right: rect.left + vp.x,
//       };

//       tippy(document.body, { // use document.body as ref
//         content : `<strong>${a.label}</strong><table>${rows}</table>`,
//         allowHTML: true,
//         trigger : 'manual',
//         placement: 'right',
//         animation: 'shift-away',
//         arrow: true,
//         offset: [0, 8],
//         theme : 'light-border',
//         getReferenceClientRect: () => referenceRect,
//       }).show();
//     });
//     renderer.on('leaveNode', () => document.body._tippy?.hide());

//     /* ----------------------------------------
//        6) Expand/collapse logic (UNCHANGED)
//     ---------------------------------------- */
//     container.addEventListener('click', e => {
//       const fileKey = pickNodeAt(renderer, graph, e.clientX, e.clientY);
//       if (!fileKey) return;
//       const attrs = graph.getNodeAttributes(fileKey);
//       if (attrs.nodeCategory !== 'file') return;

//       const children   = fileMap.get(fileKey) || [];
//       const childSize  = 10;
//       const orbit      = attrs.size + childSize + 8;

//       if (!attrs._expanded) {
//         // EXPAND
//         children.forEach((fnId, idx) => {
//           const fnKey = `${fileKey}::${fnId}`;
//           if (graph.hasNode(fnKey)) return;
//           const meta  = idToNode.get(fnId) || {};
//           const angle = (2 * Math.PI * idx) / children.length;
//           graph.addNode(fnKey, {
//             label       : meta.label,
//             filepath    : meta.filepath,
//             x           : attrs.x + Math.cos(angle) * orbit,
//             y           : attrs.y + Math.sin(angle) * orbit,
//             size        : childSize,
//             color       : meta.vulnerable ? '#FF4136' : '#2ECC40',
//             nodeCategory: 'function',
//             type        : 'nodeCircle',
//           });
//           graph.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
//             type: 'arrow', color: 'rgba(150,150,150,0.8)', size: 2, arrowSize: 8,
//           });
//         });

//         // intra-file edges
//         const set = new Set(children);
//         attack_graph.links.forEach(l => {
//           const s = String(l.source), t = String(l.target);
//           if (set.has(s) && set.has(t)) {
//             const sKey = `${fileKey}::${s}`, tKey = `${fileKey}::${t}`;
//             const eKey = `${sKey}->${tKey}`;
//             if (!graph.hasEdge(eKey))
//               graph.addEdgeWithKey(eKey, sKey, tKey,
//                 { type: 'arrow', color: '#999', size: 1, arrowSize: 4 });
//           }
//         });

//         graph.setNodeAttribute(fileKey, '_expanded', true);

//       } else {
//         // COLLAPSE
//         children.forEach(fnId => graph.dropNode(`${fileKey}::${fnId}`));
//         graph.edges().forEach(e => { if (!baseEdges.has(e)) graph.dropEdge(e); });
//         graph.setNodeAttribute(fileKey, '_expanded', false);
//       }

//       noverlap.assign(graph, { gridSize: 10, nodeMargin: 15,
//                                scaleNodes: 1.2, maxIterations: 100 });
//       renderer.refresh();
//     });

//     console.log(`✅ Graph for ${repoId} rendered with attack-path & vulnerable-file highlighting.`);
//   })
//   .catch(err => {
//     console.error(err);
//     container.innerHTML = `<p style="color:red">${err.message}</p>`;
//   });
/* attack_graph.js
 * Renders an interactive “collapsed-by-file” call-graph with:
 *   • files that contain at least one vulnerable function shown in **yellow**
 *   • edges that belong to any critical attack path shown in **red**
 *   • when a file is expanded its vulnerable functions are red / green,
 *     and attack-path function→function hops are red arrows
 * Uses: graphology, sigma, force-atlas-2, noverlap & tippy.js
 * ------------------------------------------------------------------------- */

import { DirectedGraph }   from 'graphology';
import forceAtlas2         from 'graphology-layout-forceatlas2';
import noverlap            from 'graphology-layout-noverlap';
import Sigma               from 'sigma';
import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
import tippy               from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/svg-arrow.css';
import 'tippy.js/themes/light-border.css';

/* ───────────────────────── 1) Grab repo_id ─────────────────────────────── */
const params = new URLSearchParams(window.location.search);
const repoId = params.get('repo_id');
if (!repoId) {
  document.body.innerHTML =
    '<p style="color:red;padding:1rem;">Error: repo_id missing.</p>';
  throw new Error('Missing repo_id');
}

/* ───────────────────────── 2) Place it in <span id="repo-id"> ──────────── */
const span = document.getElementById('repo-id');
if (span) span.textContent = repoId;

/* ───────────────────────── 3) Prepare container ────────────────────────── */
const container = document.getElementById('sigma-container');
if (!container) throw new Error('Missing #sigma-container');
container.style.touchAction = 'none';
container.style.cursor = 'grab';

/* ───────────────────────── 4) Tiny helper to pick node at cursor ───────── */
function pickNodeAt(renderer, graph, x, y, thr = 15) {
  const rect = renderer.getContainer().getBoundingClientRect();
  const { x: gx, y: gy } = renderer.viewportToGraph({ x: x - rect.left, y: y - rect.top });
  let pick = null, best = Infinity;
  graph.forEachNode((n, a) => {
    const d = Math.hypot(a.x - gx, a.y - gy);
    if (d < thr && d < best) { pick = n; best = d; }
  });
  return pick;
}

/* ───────────────────────── 5) Fetch latest scan ────────────────────────── */
fetch(`/scan/${repoId}/latest`)
  .then(r => { if (!r.ok) throw new Error(`Scan ${repoId} not found`); return r.json(); })
  .then(render)
  .catch(err => {
    console.error(err);
    container.innerHTML = `<p style="color:red;padding:1rem;">${err.message}</p>`;
  });

/* ───────────────────────── 6) Main render fn ───────────────────────────── */
function render(data) {
  const attack_graph = data.attack_graph ?? data;
  if (!Array.isArray(attack_graph.nodes)) throw new Error('Invalid attack_graph');

  /* 6a) grab AI assessment (for attack paths) */
  const ia = data.ai_assessment ||
             data.scan_results?.ai_assessment ||
             {};
  const funcPathPairs = [];      // every consecutive fn→fn in each path
  (ia.impact_assessment?.critical_attack_paths || ia.critical_attack_paths || [])
    .forEach(path => {
      for (let i = 0; i < path.length - 1; i++)
        funcPathPairs.push([String(path[i]), String(path[i + 1])]);
    });

  /* quick-lookups we will need later */
  const attackFuncEdge = new Set(); // "fnID|fnID"
  const attackFileEdge = new Set(); // "fileID|fileID"

  /* 6b) Build node maps ahead of graph creation */
  const idToNode  = new Map();
  const fnToFile  = new Map();   // functionID -> fileID
  const fileMap   = new Map();   // fileID -> [children fnIDs]

  attack_graph.nodes.forEach(n => idToNode.set(String(n.id), n));
  attack_graph.nodes.filter(n => n.type === 'file')
    .forEach(f => fileMap.set(String(f.id), (f.children || []).map(String)));

  fileMap.forEach((children, fileId) => children.forEach(fnId => fnToFile.set(fnId, fileId)));

  /* 6c) translate attack path pairs to look-ups */
  funcPathPairs.forEach(([s, t]) => {
    attackFuncEdge.add(`${s}|${t}`);
    const sF = fnToFile.get(s), tF = fnToFile.get(t);
    if (sF && tF) attackFileEdge.add(`${sF}|${tF}`);
  });

  /* 6d) Build Graphology graph (collapsed view first) */
  const G = new DirectedGraph();

  /* Add file nodes */
  fileMap.forEach((children, fileId) => {
    const fileMeta = idToNode.get(fileId) || {};
    const hasVuln  = children.some(fnId => (idToNode.get(fnId)?.vulnerable));
    G.addNode(fileId, {
      label : fileMeta.label || fileMeta.filepath || fileId,
      filepath: fileMeta.filepath,
      x: Math.random() * 100, y: Math.random() * 100,
      size: 18,
      color: hasVuln ? '#FFDC00' /* yellow */ : '#0074D9',
      nodeCategory: 'file',
      type: 'nodeCircle',
      _expanded: false,
    });
  });

  /* Add collapsed file→file edges (one per unique pair) */
  const seenCollapsed = new Set();
  attack_graph.links.forEach(l => {
    const sFile = fnToFile.get(String(l.source));
    const tFile = fnToFile.get(String(l.target));
    if (!sFile || !tFile || sFile === tFile) return;
    const key = `${sFile}|${tFile}`;
    if (seenCollapsed.has(key)) return;
    seenCollapsed.add(key);

    const isAttack = attackFileEdge.has(key);
    G.addEdgeWithKey(`${sFile}->${tFile}`, sFile, tFile, {
      type     : 'arrow',
      size     : isAttack ? 3 : 2,
      color    : isAttack ? '#d62728' : 'rgba(150,150,150,0.8)',
      arrowSize: isAttack ? 8 : 6,
    });
  });
  const baseEdges = new Set(G.edges());

  /* 6e) initial layout */
  forceAtlas2.assign(G, { iterations: 200,
    settings: { gravity: 1, scalingRatio: 4, adjustSizes: true } });
  noverlap.assign(G, { gridSize: 10, nodeMargin: 15, scaleNodes: 1.2, maxIterations: 200 });

  /* 6f) Sigma renderer */
  const renderer = new Sigma(G, container, {
    settings: {
      defaultEdgeType  : 'arrow',
      defaultNodeColor : '#0074D9',
      labelThreshold   : 16,
      labelSize        : 'fixed',
    },
    nodeProgramClasses: { nodeCircle: NodeCircleProgram },
    edgeProgramClasses: { arrow     : EdgeArrowProgram },
  });
  renderer.refresh();

  /* 6g) Tool-tip on hover with tippy.js */
  renderer.on('enterNode', ({ node }) => {
    const a = G.getNodeAttributes(node);
    const rows = Object.entries(a).map(([k, v]) =>
      `<tr><th style="text-align:left;padding:2px 4px">${k}</th><td style="padding:2px 4px">${v}</td></tr>`).join('');
    const vp   = renderer.graphToViewport({ x: a.x, y: a.y });
    const rect = container.getBoundingClientRect();
    const referenceRect = {
      width: 0, height: 0,
      top: rect.top + vp.y, bottom: rect.top + vp.y,
      left: rect.left + vp.x, right: rect.left + vp.x,
    };
    tippy(document.body, {
      content: `<strong>${a.label}</strong><table>${rows}</table>`,
      allowHTML: true, interactive: true, trigger: 'manual',
      theme: 'light-border', placement: 'right',
      animation: 'shift-away', arrow: true, offset: [0, 8],
      getReferenceClientRect: () => referenceRect,
    }).show();
  });
  renderer.on('leaveNode', () => document.querySelectorAll('.tippy-box').forEach(t => t._tippy?.destroy()));

  /* 6h) Expand / collapse files on click */
  container.addEventListener('click', e => {
    const fileKey = pickNodeAt(renderer, G, e.clientX, e.clientY);
    if (!fileKey) return;
    const aFile = G.getNodeAttributes(fileKey);
    if (aFile.nodeCategory !== 'file') return;

    const children = fileMap.get(fileKey) || [];
    const childSize = 10;
    const orbit = aFile.size + childSize + 8;

    if (!aFile._expanded) {
      /* ── EXPAND ───────────────────────────────────────────────────────── */
      children.forEach((fnId, idx) => {
        const fnKey = `${fileKey}::${fnId}`;
        if (G.hasNode(fnKey)) return;
        const meta = idToNode.get(fnId) || {};

        const angle = (2 * Math.PI * idx) / children.length;
        const baseColor = meta.vulnerable ? '#FF4136' : '#2ECC40';
        const attr = {
          label: meta.label || fnId,
          filepath: meta.filepath,
          x: aFile.x + Math.cos(angle) * orbit,
          y: aFile.y + Math.sin(angle) * orbit,
          size: childSize,
          color: baseColor,
          nodeCategory: 'function',
          type: 'nodeCircle',
        };

        /* highlight functions that are start/target inside an attack path */
        if ([...attackFuncEdge].some(e => e.startsWith(`${fnId}|`) || e.endsWith(`|${fnId}`))) {
          attr.color = '#d62728';
          attr.size  = childSize + 2;
        }
        G.addNode(fnKey, attr);

        /* edge file → function */
        G.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
          type: 'arrow', color: 'rgba(150,150,150,0.8)', size: 2, arrowSize: 8,
        });
      });

      /* intra-file function→function edges */
      const setIDs = new Set(children);
      attack_graph.links.forEach(l => {
        const s = String(l.source), t = String(l.target);
        if (!(setIDs.has(s) && setIDs.has(t))) return;
        const sKey = `${fileKey}::${s}`, tKey = `${fileKey}::${t}`;
        const eKey = `${sKey}->${tKey}`;
        if (G.hasEdge(eKey)) return;
        const isAttack = attackFuncEdge.has(`${s}|${t}`);
        G.addEdgeWithKey(eKey, sKey, tKey, {
          type: 'arrow',
          color: isAttack ? '#d62728' : '#999',
          size: isAttack ? 2 : 1,
          arrowSize: isAttack ? 6 : 4,
        });
      });

      G.setNodeAttribute(fileKey, '_expanded', true);

    } else {
      /* ── COLLAPSE ─────────────────────────────────────────────────────── */
      children.forEach(fnId => {
        const fnKey = `${fileKey}::${fnId}`;
        if (G.hasNode(fnKey)) G.dropNode(fnKey);
      });
      /* drop edges added during expansion */
      G.edges().forEach(e => { if (!baseEdges.has(e)) G.dropEdge(e); });
      G.setNodeAttribute(fileKey, '_expanded', false);
    }

    /* adjust layout locally to avoid overlaps */
    noverlap.assign(G, { gridSize: 10, nodeMargin: 15, scaleNodes: 1.2, maxIterations: 100 });
    renderer.refresh();
  });

  console.log(`✅ Attack graph for repo ${repoId} rendered`);
}
