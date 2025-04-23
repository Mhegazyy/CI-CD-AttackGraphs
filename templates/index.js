/* index.js  ─ Front-end controller for repositories page */

const API = 'http://localhost:5000';          // Flask API base
const loaderEl    = document.getElementById('loader');
const scanDoneEl  = document.getElementById('scan-done');

/* ─────────────────────────── helpers ─────────────────────────── */
// tiny util so we don’t repeat classList juggling
function show(el) { el?.classList.remove('hidden'); }
function hide(el) { el?.classList.add('hidden'); }

// track how many fetches are in-flight → when it hits 0 we’re idle
let inflight = 0;
function beginNetwork()   { if (++inflight === 1) { show(loaderEl); hide(scanDoneEl); } }
function endNetwork(done) {
  if (--inflight <= 0) {
    inflight = 0;
    hide(loaderEl);
    if (done) show(scanDoneEl);
  }
}

/* ────────────────────────── generic fetch wrapper ────────────────────────── */
async function request(path, opts = {}) {
  beginNetwork();
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || res.statusText);
    }
    return await res.json();                   // success
  } finally {
    endNetwork(/* done = */true);              // hide spinner & show ✓
  }
}

/* ─────────────────────── repo-table rendering ─────────────────────── */
async function loadRepos() {
  // loader will show automatically through request()
  const repos = await request('/repos');

  const tbody = document.getElementById('repos-body');
  tbody.innerHTML = repos.map(r => `
    <tr>
      <td>${r.name}</td>
      <td><a href="${r.url}" target="_blank">${r.url}</a></td>
      <td>
        <button class="scan-btn"   data-id="${r.id}">Scan</button>
        <button class="graph-btn"  data-id="${r.id}">View Graph</button>
        <button class="report-btn" data-id="${r.id}">View Report</button>
      </td>
    </tr>
  `).join('');

  /* ───────── bind per-row actions ───────── */
  tbody.querySelectorAll('.scan-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = 'Running…';
      hide(scanDoneEl);              // hide ✓ while scan runs
      try {
        await request(`/scan/${id}`, { method: 'POST' });
        alert(`Scan triggered for repo ${id}`);
      } catch (e) {
        alert('Error: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Scan';
      }
    });
  });

  tbody.querySelectorAll('.graph-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window.location.href = `attack_graph.html?repo_id=${id}`;
    });
  });

  tbody.querySelectorAll('.report-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window.location.href = `report.html?repo_id=${id}`;
    });
  });
}

/* ───────────────────── form handler ───────────────────── */
async function initForm() {
  const form = document.getElementById('add-repo-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = form.elements['name'].value.trim();
    const url  = form.elements['url'].value.trim();
    if (!name || !url) {
      alert('Name and URL are required');
      return;
    }
    try {
      await request('/repos', {
        method: 'POST',
        body: JSON.stringify({ name, repo_url: url }),
      });
      form.reset();
      await loadRepos();             // refresh table
    } catch (e) {
      alert('Failed to add repo: ' + e.message);
    }
  });
}

/* ───────────────────────── bootstrap ───────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  hide(scanDoneEl);                  // hide graphics on first load
  await initForm();
  await loadRepos();                 // initial table render
});
