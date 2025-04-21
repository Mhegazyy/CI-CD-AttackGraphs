// templates/report.js

// 1) Grab repo_id
const params = new URLSearchParams(window.location.search);
const repoId = params.get('repo_id');
if (!repoId) {
  document.getElementById('report-container').innerHTML =
    '<p class="error">Error: repo_id is missing</p>';
  throw new Error('Missing repo_id');
}

// 2) Fix “View Graph” nav link
const graphLink = document.querySelector('a[data-repo-link]');
if (graphLink) graphLink.href = `attack_graph.html?repo_id=${repoId}`;

// 3) Fetch the latest scan
fetch(`/scan/${repoId}/latest`)
  .then(r => {
    if (!r.ok) throw new Error(`Scan not found (status ${r.status})`);
    return r.json();
  })
  .then(data => renderReport(data))
  .catch(err => {
    document.getElementById('report-container').innerHTML =
      `<p class="error">${err.message}</p>`;
  });

// 4) Helper to title‑case keys
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    );
}

// 5) Main renderer
function renderReport(report) {
  const container = document.getElementById('report-container');
  container.innerHTML = ''; // clear

  // 5a) If there's an AI assessment, render it first
  const ai = report.ai_assessment || report.scan_results?.ai_assessment;
  if (ai && ai.impact_assessment) {
    const ia = ai.impact_assessment;

    const section = document.createElement('section');
    section.className = 'report-section';

    // Title
    const h2 = document.createElement('h2');
    h2.textContent = 'AI Impact Assessment';
    section.appendChild(h2);

    // Overall Risk
    const pRisk = document.createElement('p');
    pRisk.innerHTML = `<strong>Overall Risk:</strong> ${ia.overall_risk}`;
    section.appendChild(pRisk);

    // Critical Attack Paths
    if (Array.isArray(ia.critical_attack_paths)) {
      const h3 = document.createElement('h3');
      h3.textContent = 'Critical Attack Paths';
      section.appendChild(h3);

      const ul = document.createElement('ul');
      ul.className = 'report-list';
      ia.critical_attack_paths.forEach(path => {
        const li = document.createElement('li');
        li.textContent = path.join(' → ');
        ul.appendChild(li);
      });
      section.appendChild(ul);
    }

    // Functions Analysis Table
    if (Array.isArray(ia.functions_analysis)) {
      const h3fn = document.createElement('h3');
      h3fn.textContent = 'Functions Analysis';
      section.appendChild(h3fn);

      const table = document.createElement('table');
      table.className = 'func-analysis';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Function</th>
            <th>Risk</th>
            <th>Impact</th>
            <th>Vulnerabilities</th>
            <th>Recommendation</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      ia.functions_analysis.forEach(f => {
        const tr = document.createElement('tr');
        const vulnTexts = f.vulnerabilities.map(v => v.message).join('; ') || 'None';
        tr.innerHTML = `
          <td>${f.function_id}</td>
          <td>${f.risk_rating}</td>
          <td>${f.impact_rating}</td>
          <td>${vulnTexts}</td>
          <td>${f.recommendation}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      section.appendChild(table);
    }

    container.appendChild(section);
  }

  // 5b) Render any other top‑level sections
  const skip = new Set(['ai_assessment', 'attack_graph']);
  Object.entries(report).forEach(([key, value]) => {
    if (skip.has(key)) return;

    const section = document.createElement('section');
    section.className = 'report-section';

    const h2 = document.createElement('h2');
    h2.textContent = formatKey(key);
    section.appendChild(h2);

    if (Array.isArray(value)) {
      const ul = document.createElement('ul');
      value.forEach(item => {
        const li = document.createElement('li');
        li.textContent = typeof item === 'object'
          ? JSON.stringify(item)
          : item;
        ul.appendChild(li);
      });
      section.appendChild(ul);

    } else if (value && typeof value === 'object') {
      const dl = document.createElement('dl');
      Object.entries(value).forEach(([k, v]) => {
        const dt = document.createElement('dt');
        dt.textContent = formatKey(k);
        const dd = document.createElement('dd');
        dd.textContent = v;
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      section.appendChild(dl);

    } else {
      const p = document.createElement('p');
      p.textContent = value;
      section.appendChild(p);
    }

    container.appendChild(section);
  });
}
