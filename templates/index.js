const API = 'http://localhost:5000';  // base URL of your Flask API

// Fetch and return JSON from the given endpoint
async function request(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json();
}

// Renders the table of repos
async function loadRepos() {
  const repos = await request('/repos');
  const tbody = document.getElementById('repos-body');
  tbody.innerHTML = repos.map(r => `
    <tr>
      <td>${r.name}</td>
      <td><a href="${r.url}" target="_blank">${r.url}</a></td>
      <td>
        <button class="scan-btn" data-id="${r.id}">Scan</button>
        <button class="graph-btn" data-id="${r.id}">View Graph</button>
        <button class="report-btn" data-id="${r.id}">View Report</button>
      </td>
    </tr>
  `).join('');

  // Bind actions
  tbody.querySelectorAll('.scan-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.textContent = 'Running…';
      try {
        await request(`/scan/${id}`, { method: 'POST' });
        alert('Scan triggered for repo ' + id);
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
      // navigate to your graph page; adjust the filename if needed
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

// Handles the "Add Repository" form
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
      await loadRepos();
    } catch (e) {
      alert('Failed to add repo: ' + e.message);
    }
  });
}

// Bootstraps the page
document.addEventListener('DOMContentLoaded', async () => {
  await initForm();
  await loadRepos();
});