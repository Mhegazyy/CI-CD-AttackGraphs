// import { DirectedGraph }   from 'graphology';
// import forceAtlas2         from 'graphology-layout-forceatlas2';
// import noverlap            from 'graphology-layout-noverlap';
// import Sigma               from 'sigma';
// import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
// import tippy               from 'tippy.js';
// import 'tippy.js/dist/tippy.css';
// import 'tippy.js/dist/svg-arrow.css';
// import 'tippy.js/themes/light-border.css';

// /* ───────────────────────── 1) Grab repo_id ─────────────────────────────── */
// const params = new URLSearchParams(window.location.search);
// const repoId = params.get('repo_id');
// if (!repoId) {
//   document.body.innerHTML =
//     '<p style="color:red;padding:1rem;">Error: repo_id missing.</p>';
//   throw new Error('Missing repo_id');
// }

// /* ───────────────────────── 2) Place it in <span id="repo-id"> ──────────── */
// const span = document.getElementById('repo-id');
// if (span) span.textContent = repoId;

// /* ───────────────────────── 3) Prepare container ────────────────────────── */
// const container = document.getElementById('sigma-container');
// if (!container) throw new Error('Missing #sigma-container');
// container.style.touchAction = 'none';
// container.style.cursor = 'grab';

// /* ───────────────────────── 4) Tiny helper to pick node at cursor ───────── */
// function pickNodeAt(renderer, graph, x, y, thr = 15) {
//   const rect = renderer.getContainer().getBoundingClientRect();
//   const { x: gx, y: gy } = renderer.viewportToGraph({ x: x - rect.left, y: y - rect.top });
//   let pick = null, best = Infinity;
//   graph.forEachNode((n, a) => {
//     const d = Math.hypot(a.x - gx, a.y - gy);
//     if (d < thr && d < best) { pick = n; best = d; }
//   });
//   return pick;
// }

// /* ───────────────────────── 5) Fetch latest scan ────────────────────────── */
// fetch(`/scan/${repoId}/latest`)
//   .then(r => { if (!r.ok) throw new Error(`Scan ${repoId} not found`); return r.json(); })
//   .then(render)
//   .catch(err => {
//     console.error(err);
//     container.innerHTML = `<p style="color:red;padding:1rem;">${err.message}</p>`;
//   });

// /* ───────────────────────── 6) Main render fn ───────────────────────────── */
// function render(data) {
//   const attack_graph = data.attack_graph ?? data;
//   if (!Array.isArray(attack_graph.nodes)) throw new Error('Invalid attack_graph');

//   /* 6a) grab AI assessment (for attack paths) */
//   const ia = data.ai_assessment ||
//              data.scan_results?.ai_assessment ||
//              {};
//   const funcPathPairs = [];      // every consecutive fn→fn in each path
//   (ia.impact_assessment?.critical_attack_paths || ia.critical_attack_paths || [])
//     .forEach(path => {
//       for (let i = 0; i < path.length - 1; i++)
//         funcPathPairs.push([String(path[i]), String(path[i + 1])]);
//     });

//   /* quick-lookups we will need later */
//   const attackFuncEdge = new Set(); // "fnID|fnID"
//   const attackFileEdge = new Set(); // "fileID|fileID"

//   /* 6b) Build node maps ahead of graph creation */
//   const idToNode  = new Map();
//   const fnToFile  = new Map();   // functionID -> fileID
//   const fileMap   = new Map();   // fileID -> [children fnIDs]

//   attack_graph.nodes.forEach(n => idToNode.set(String(n.id), n));
//   attack_graph.nodes.filter(n => n.type === 'file')
//     .forEach(f => fileMap.set(String(f.id), (f.children || []).map(String)));

//   fileMap.forEach((children, fileId) => children.forEach(fnId => fnToFile.set(fnId, fileId)));

//   /* 6c) translate attack path pairs to look-ups */
//   funcPathPairs.forEach(([s, t]) => {
//     attackFuncEdge.add(`${s}|${t}`);
//     const sF = fnToFile.get(s), tF = fnToFile.get(t);
//     if (sF && tF) attackFileEdge.add(`${sF}|${tF}`);
//   });

//   /* 6d) Build Graphology graph (collapsed view first) */
//   const G = new DirectedGraph();

//   /* Add file nodes */
//   fileMap.forEach((children, fileId) => {
//     const fileMeta = idToNode.get(fileId) || {};
//     const hasVuln  = children.some(fnId => (idToNode.get(fnId)?.vulnerable));
//     G.addNode(fileId, {
//       label : fileMeta.label || fileMeta.filepath || fileId,
//       filepath: fileMeta.filepath,
//       x: Math.random() * 100, y: Math.random() * 100,
//       size: 18,
//       color: hasVuln ? '#FFDC00' /* yellow */ : '#0074D9',
//       nodeCategory: 'file',
//       type: 'nodeCircle',
//       _expanded: false,
//     });
//   });

//   /* Add collapsed file→file edges (one per unique pair) */
//   const seenCollapsed = new Set();
//   attack_graph.links.forEach(l => {
//     const sFile = fnToFile.get(String(l.source));
//     const tFile = fnToFile.get(String(l.target));
//     if (!sFile || !tFile || sFile === tFile) return;
//     const key = `${sFile}|${tFile}`;
//     if (seenCollapsed.has(key)) return;
//     seenCollapsed.add(key);

//     const isAttack = attackFileEdge.has(key);
//     G.addEdgeWithKey(`${sFile}->${tFile}`, sFile, tFile, {
//       type     : 'arrow',
//       size     : isAttack ? 3 : 2,
//       color    : isAttack ? '#d62728' : 'rgba(150,150,150,0.8)',
//       arrowSize: isAttack ? 8 : 6,
//     });
//   });
//   const baseEdges = new Set(G.edges());

//   /* 6e) initial layout */
//   forceAtlas2.assign(G, { iterations: 200,
//     settings: { gravity: 1, scalingRatio: 4, adjustSizes: true } });
//   noverlap.assign(G, { gridSize: 10, nodeMargin: 15, scaleNodes: 1.2, maxIterations: 200 });

//   /* 6f) Sigma renderer */
//   const renderer = new Sigma(G, container, {
//     settings: {
//       defaultEdgeType  : 'arrow',
//       defaultNodeColor : '#0074D9',
//       labelThreshold   : 16,
//       labelSize        : 'fixed',
//     },
//     nodeProgramClasses: { nodeCircle: NodeCircleProgram },
//     edgeProgramClasses: { arrow     : EdgeArrowProgram },
//   });
//   renderer.refresh();

//   /* 6g) Tool-tip on hover with tippy.js */
//   renderer.on('enterNode', ({ node }) => {
//     const a = G.getNodeAttributes(node);
//     const rows = Object.entries(a).map(([k, v]) =>
//       `<tr><th style="text-align:left;padding:2px 4px">${k}</th><td style="padding:2px 4px">${v}</td></tr>`).join('');
//     const vp   = renderer.graphToViewport({ x: a.x, y: a.y });
//     const rect = container.getBoundingClientRect();
//     const referenceRect = {
//       width: 0, height: 0,
//       top: rect.top + vp.y, bottom: rect.top + vp.y,
//       left: rect.left + vp.x, right: rect.left + vp.x,
//     };
//     tippy(document.body, {
//       content: `<strong>${a.label}</strong><table>${rows}</table>`,
//       allowHTML: true, interactive: true, trigger: 'manual',
//       theme: 'light-border', placement: 'right',
//       animation: 'shift-away', arrow: true, offset: [0, 8],
//       getReferenceClientRect: () => referenceRect,
//     }).show();
//   });
//   renderer.on('leaveNode', () => document.querySelectorAll('.tippy-box').forEach(t => t._tippy?.destroy()));

//   /* 6h) Expand / collapse files on click */
//   container.addEventListener('click', e => {
//     const fileKey = pickNodeAt(renderer, G, e.clientX, e.clientY);
//     if (!fileKey) return;
//     const aFile = G.getNodeAttributes(fileKey);
//     if (aFile.nodeCategory !== 'file') return;

//     const children = fileMap.get(fileKey) || [];
//     const childSize = 10;
//     const orbit = aFile.size + childSize + 8;

//     if (!aFile._expanded) {
//       /* ── EXPAND ───────────────────────────────────────────────────────── */
//       children.forEach((fnId, idx) => {
//         const fnKey = `${fileKey}::${fnId}`;
//         if (G.hasNode(fnKey)) return;
//         const meta = idToNode.get(fnId) || {};

//         const angle = (2 * Math.PI * idx) / children.length;
//         const baseColor = meta.vulnerable ? '#FF4136' : '#2ECC40';
//         const attr = {
//           label: meta.label || fnId,
//           filepath: meta.filepath,
//           x: aFile.x + Math.cos(angle) * orbit,
//           y: aFile.y + Math.sin(angle) * orbit,
//           size: childSize,
//           color: baseColor,
//           nodeCategory: 'function',
//           type: 'nodeCircle',
//         };

//         /* highlight functions that are start/target inside an attack path */
//         if ([...attackFuncEdge].some(e => e.startsWith(`${fnId}|`) || e.endsWith(`|${fnId}`))) {
//           attr.color = '#d62728';
//           attr.size  = childSize + 2;
//         }
//         G.addNode(fnKey, attr);

//         /* edge file → function */
//         G.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
//           type: 'arrow', color: 'rgba(150,150,150,0.8)', size: 2, arrowSize: 8,
//         });
//       });

//       /* intra-file function→function edges */
//       const setIDs = new Set(children);
//       attack_graph.links.forEach(l => {
//         const s = String(l.source), t = String(l.target);
//         if (!(setIDs.has(s) && setIDs.has(t))) return;
//         const sKey = `${fileKey}::${s}`, tKey = `${fileKey}::${t}`;
//         const eKey = `${sKey}->${tKey}`;
//         if (G.hasEdge(eKey)) return;
//         const isAttack = attackFuncEdge.has(`${s}|${t}`);
//         G.addEdgeWithKey(eKey, sKey, tKey, {
//           type: 'arrow',
//           color: isAttack ? '#d62728' : '#999',
//           size: isAttack ? 2 : 1,
//           arrowSize: isAttack ? 6 : 4,
//         });
//       });

//       G.setNodeAttribute(fileKey, '_expanded', true);

//     } else {
//       /* ── COLLAPSE ─────────────────────────────────────────────────────── */
//       children.forEach(fnId => {
//         const fnKey = `${fileKey}::${fnId}`;
//         if (G.hasNode(fnKey)) G.dropNode(fnKey);
//       });
//       /* drop edges added during expansion */
//       G.edges().forEach(e => { if (!baseEdges.has(e)) G.dropEdge(e); });
//       G.setNodeAttribute(fileKey, '_expanded', false);
//     }

//     /* adjust layout locally to avoid overlaps */
//     noverlap.assign(G, { gridSize: 10, nodeMargin: 15, scaleNodes: 1.2, maxIterations: 100 });
//     renderer.refresh();
//   });

//   console.log(`✅ Attack graph for repo ${repoId} rendered`);
// }

import { DirectedGraph } from 'graphology';
import forceAtlas2        from 'graphology-layout-forceatlas2';
import noverlap           from 'graphology-layout-noverlap';
import Sigma              from 'sigma';
import { NodeCircleProgram, EdgeArrowProgram } from 'sigma/rendering';
import tippy              from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/dist/svg-arrow.css';
import 'tippy.js/themes/light-border.css';

/* ───────── 1) repo_id from URL ─────────────────────────────────────────── */
const params = new URLSearchParams(window.location.search);
const repoId = params.get('repo_id');
if (!repoId) {
  document.body.innerHTML =
    '<p style="color:red;padding:1rem;">Error: repo_id missing.</p>';
  throw new Error('Missing repo_id');
}

/* ───────── 2) Put it in title span ─────────────────────────────────────── */
const span = document.getElementById('repo-id');
if (span) span.textContent = repoId;

/* ───────── 3) Sigma container ──────────────────────────────────────────── */
const container = document.getElementById('sigma-container');
if (!container) throw new Error('Missing #sigma-container');
container.style.touchAction = 'none';
container.style.cursor      = 'grab';

/* ───────── tiny helper to pick node under cursor ──────────────────────── */
function pickNodeAt(renderer, graph, x, y, thr = 15) {
  const rect = renderer.getContainer().getBoundingClientRect();
  const { x: gx, y: gy } = renderer.viewportToGraph({
    x: x - rect.left, y: y - rect.top,
  });
  let pick = null, best = Infinity;
  graph.forEachNode((n, a) => {
    const d = Math.hypot(a.x - gx, a.y - gy);
    if (d < thr && d < best) { pick = n; best = d; }
  });
  return pick;
}

/* ───────── 4) fetch latest scan & render ───────────────────────────────── */
fetch(`/scan/${repoId}/latest`)
  .then(r => { if (!r.ok) throw new Error(`Scan ${repoId} not found`); return r.json(); })
  .then(render)
  .catch(err => {
    console.error(err);
    container.innerHTML = `<p style="color:red;padding:1rem;">${err.message}</p>`;
  });

/* ───────── 5) main render function ─────────────────────────────────────── */
function render(data) {
  const attack_graph = data.attack_graph ?? data;
  if (!Array.isArray(attack_graph.nodes)) throw new Error('Invalid attack_graph');

  /* 5a) attack-path lookup tables (from AI assessment) */
  const ia = data.ai_assessment ||
             data.scan_results?.ai_assessment || {};
  const funcPairs = [];  // consecutive function-id pairs
  (ia.impact_assessment?.critical_attack_paths || ia.critical_attack_paths || [])
    .forEach(p => {
      for (let i = 0; i < p.length - 1; i++) funcPairs.push([String(p[i]), String(p[i+1])]);
    });
  const attackFuncEdge  = new Set(funcPairs.map(([s,t]) => `${s}|${t}`));
  const attackFileEdge  = new Set(); // will fill later

  /* 5b) node look-ups */
  const idToNode = new Map(attack_graph.nodes.map(n => [String(n.id), n]));
  const fileMap  = new Map();        // fileId → [childFnIds]
  const fnToFile = new Map();        // fnId   → fileId

  attack_graph.nodes.filter(n => n.type === 'file')
    .forEach(f => fileMap.set(String(f.id), (f.children || []).map(String)));
  fileMap.forEach((children, f) => children.forEach(fn => fnToFile.set(fn, f)));

  /* compute file-level edges that belong to an attack path */
  funcPairs.forEach(([s,t]) => {
    const fs = fnToFile.get(s), ft = fnToFile.get(t);
    if (fs && ft) attackFileEdge.add(`${fs}|${ft}`);
  });

  /* 5c) create graphology graph in collapsed view */
  const G = new DirectedGraph();

  /* add file nodes */
  fileMap.forEach((children, fid) => {
    const meta  = idToNode.get(fid) || {};
    const risky = children.some(fn => idToNode.get(fn)?.vulnerable);
    G.addNode(fid, {
      label: meta.label || meta.filepath || fid,
      filepath: meta.filepath,
      x: Math.random()*100, y: Math.random()*100,
      size: 18,
      color: risky ? '#FFDC00' : '#0074D9',   // yellow if some vuln fn
      nodeCategory: 'file',
      type: 'nodeCircle',
      _expanded: false,
    });
  });

  /* collapsed file→file edges */
  const seenEdge = new Set();
  attack_graph.links.forEach(l => {
    const sF = fnToFile.get(String(l.source));
    const tF = fnToFile.get(String(l.target));
    if (!sF || !tF || sF === tF) return;
    const key = `${sF}|${tF}`;
    if (seenEdge.has(key)) return;   // only one collapsed edge
    seenEdge.add(key);

    const isAtk = attackFileEdge.has(key);
    G.addEdgeWithKey(`${sF}->${tF}`, sF, tF, {
      type: 'arrow',
      size: isAtk ? 3 : 2,
      color: isAtk ? '#d62728' : 'rgba(150,150,150,0.8)',
      arrowSize: isAtk ? 8 : 6,
    });
  });
  const baseEdges = new Set(G.edges());

  /* 5d) layout */
  forceAtlas2.assign(G, { iterations: 200,
    settings: { gravity: 1, scalingRatio: 4, adjustSizes: true }});
  noverlap.assign(G, { gridSize: 10, nodeMargin: 15, scaleNodes: 1.2, maxIterations: 200 });

  /* 5e) Sigma renderer */
  const renderer = new Sigma(G, container, {
    settings: {
      defaultEdgeType: 'arrow',
      labelThreshold : 16,
      labelSize      : 'fixed',
    },
    nodeProgramClasses: { nodeCircle: NodeCircleProgram },
    edgeProgramClasses: { arrow     : EdgeArrowProgram },
  });
  renderer.refresh();

  /* ───── 5f) Tooltip (singleton)  ─────────────────────────────────────── */

  /* one reusable tippy instance */
  const tip = tippy(document.body, {
    trigger: 'manual',
    allowHTML: true,
    interactive: true,
    theme: 'light-border',
    animation: 'shift-away',
    arrow: true,
    placement: 'right',
    offset: [0,8],
  });

  renderer.on('enterNode', ({ node }) => {
    const attr = G.getNodeAttributes(node);

    /* nice table incl. vulnerability messages */
    const rows = Object.entries(attr)
      .filter(([k]) => !k.startsWith('_'))        // skip internal attrs
      .map(([k, v]) => {
        if (k === 'vulnerabilities' && Array.isArray(v) && v.length) {
          v = v.map(o => o.message || JSON.stringify(o)).join('<br>');
        }
        return `<tr>
                  <th style="text-align:left;padding:2px 4px">${k}</th>
                  <td style="padding:2px 4px">${v || '—'}</td>
                </tr>`;
      }).join('');

    /* position tooltip exactly on node */
    const vp   = renderer.graphToViewport({ x: attr.x, y: attr.y });
    const rect = container.getBoundingClientRect();
    const ref  = {
      width:0, height:0,
      top: rect.top + vp.y, bottom: rect.top + vp.y,
      left: rect.left + vp.x, right: rect.left + vp.x,
    };

    tip.setContent(`<strong>${attr.label}</strong><table>${rows}</table>`);
    tip.setProps({ getReferenceClientRect: () => ref });
    tip.show();
  });

  renderer.on('leaveNode', () => tip.hide());

  /* ───── 5g) Expand / collapse files on click ─────────────────────────── */
  container.addEventListener('click', e => {
    const fileKey = pickNodeAt(renderer, G, e.clientX, e.clientY);
    if (!fileKey) return;
    const nAttr = G.getNodeAttributes(fileKey);
    if (nAttr.nodeCategory !== 'file') return;

    const children = fileMap.get(fileKey) || [];
    const childSize = 10;
    const orbit = nAttr.size + childSize + 8;

    if (!nAttr._expanded) {
      /* --- EXPAND ------------------------------------------------------- */
      children.forEach((fnId, idx) => {
        const fnKey = `${fileKey}::${fnId}`;
        if (G.hasNode(fnKey)) return;

        const meta = idToNode.get(fnId) || {};
        const angle = (2 * Math.PI * idx) / children.length;
        const baseColor = meta.vulnerable ? '#FF4136' : '#2ECC40';

        /* collect attributes, *including vulnerabilities* */
        const attr = {
          label: meta.label || fnId,
          filepath: meta.filepath,
          vulnerabilities: meta.vulnerabilities || [],
          x: nAttr.x + Math.cos(angle) * orbit,
          y: nAttr.y + Math.sin(angle) * orbit,
          size: childSize,
          color: baseColor,
          nodeCategory: 'function',
          type: 'nodeCircle',
        };

        /* emphasise nodes that appear in an attack path */
        if ([...attackFuncEdge].some(e => e.startsWith(`${fnId}|`) || e.endsWith(`|${fnId}`))) {
          attr.color = '#d62728';
          attr.size  = childSize + 2;
        }

        G.addNode(fnKey, attr);
        G.addEdgeWithKey(`${fileKey}->${fnKey}`, fileKey, fnKey, {
          type:'arrow', color:'rgba(150,150,150,0.8)', size:2, arrowSize:8,
        });
      });

      /* intra-file edges */
      const idSet = new Set(children);
      attack_graph.links.forEach(l => {
        const s = String(l.source), t = String(l.target);
        if (!(idSet.has(s) && idSet.has(t))) return;
        const sKey = `${fileKey}::${s}`, tKey = `${fileKey}::${t}`;
        const eKey = `${sKey}->${tKey}`;
        if (G.hasEdge(eKey)) return;
        const atk  = attackFuncEdge.has(`${s}|${t}`);
        G.addEdgeWithKey(eKey, sKey, tKey, {
          type:'arrow',
          color: atk ? '#d62728' : '#999',
          size:  atk ? 2        : 1,
          arrowSize: atk ? 6 : 4,
        });
      });

      G.setNodeAttribute(fileKey,'_expanded',true);

    } else {
      /* --- COLLAPSE ----------------------------------------------------- */
      children.forEach(fnId => {
        const fnKey = `${fileKey}::${fnId}`;
        if (G.hasNode(fnKey)) G.dropNode(fnKey);
      });
      G.edges().forEach(e => { if (!baseEdges.has(e)) G.dropEdge(e); });
      G.setNodeAttribute(fileKey,'_expanded',false);
    }

    noverlap.assign(G, { gridSize:10, nodeMargin:15, scaleNodes:1.2, maxIterations:100 });
    renderer.refresh();
  });

  console.log(`✅ Attack graph for repo ${repoId} rendered`);
}
