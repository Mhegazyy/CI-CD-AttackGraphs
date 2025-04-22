import"./styles.js";const i="http://localhost:5000";async function o(a,n={}){const t=await fetch(`${i}${a}`,{headers:{"Content-Type":"application/json"},...n});if(!t.ok){const e=await t.text();throw new Error(e||t.statusText)}return t.json()}async function d(){const a=await o("/repos"),n=document.getElementById("repos-body");n.innerHTML=a.map(t=>`
    <tr>
      <td>${t.name}</td>
      <td><a href="${t.url}" target="_blank">${t.url}</a></td>
      <td>
        <button class="scan-btn" data-id="${t.id}">Scan</button>
        <button class="graph-btn" data-id="${t.id}">View Graph</button>
        <button class="report-btn" data-id="${t.id}">View Report</button>
      </td>
    </tr>
  `).join(""),n.querySelectorAll(".scan-btn").forEach(t=>{t.addEventListener("click",async()=>{const e=t.dataset.id;t.disabled=!0,t.textContent="Running…";try{await o(`/scan/${e}`,{method:"POST"}),alert("Scan triggered for repo "+e)}catch(r){alert("Error: "+r.message)}finally{t.disabled=!1,t.textContent="Scan"}})}),n.querySelectorAll(".graph-btn").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.id;window.location.href=`attack_graph.html?repo_id=${e}`})}),n.querySelectorAll(".report-btn").forEach(t=>{t.addEventListener("click",()=>{const e=t.dataset.id;window.location.href=`report.html?repo_id=${e}`})})}async function s(){const a=document.getElementById("add-repo-form");a.addEventListener("submit",async n=>{n.preventDefault();const t=a.elements.name.value.trim(),e=a.elements.url.value.trim();if(!t||!e){alert("Name and URL are required");return}try{await o("/repos",{method:"POST",body:JSON.stringify({name:t,repo_url:e})}),a.reset(),await d()}catch(r){alert("Failed to add repo: "+r.message)}})}document.addEventListener("DOMContentLoaded",async()=>{await s(),await d()});
