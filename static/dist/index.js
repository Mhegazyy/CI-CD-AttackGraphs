import"./styles.js";const m="http://localhost:5000",c=document.getElementById("loader"),o=document.getElementById("scan-done");function l(e){e==null||e.classList.remove("hidden")}function r(e){e==null||e.classList.add("hidden")}let i=0;function f(){++i===1&&(l(c),r(o))}function h(e){--i<=0&&(i=0,r(c),l(o))}async function s(e,a={}){f();try{const t=await fetch(`${m}${e}`,{headers:{"Content-Type":"application/json"},...a});if(!t.ok){const n=await t.text();throw new Error(n||t.statusText)}return await t.json()}finally{h()}}async function u(){const e=await s("/repos"),a=document.getElementById("repos-body");a.innerHTML=e.map(t=>`
    <tr>
      <td>${t.name}</td>
      <td><a href="${t.url}" target="_blank">${t.url}</a></td>
      <td>
        <button class="scan-btn"   data-id="${t.id}">Scan</button>
        <button class="graph-btn"  data-id="${t.id}">View Graph</button>
        <button class="report-btn" data-id="${t.id}">View Report</button>
      </td>
    </tr>
  `).join(""),a.querySelectorAll(".scan-btn").forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.id;t.disabled=!0,t.textContent="Running…",r(o);try{await s(`/scan/${n}`,{method:"POST"}),alert(`Scan triggered for repo ${n}`)}catch(d){alert("Error: "+d.message)}finally{t.disabled=!1,t.textContent="Scan"}})}),a.querySelectorAll(".graph-btn").forEach(t=>{t.addEventListener("click",()=>{const n=t.dataset.id;window.location.href=`attack_graph.html?repo_id=${n}`})}),a.querySelectorAll(".report-btn").forEach(t=>{t.addEventListener("click",()=>{const n=t.dataset.id;window.location.href=`report.html?repo_id=${n}`})})}async function p(){const e=document.getElementById("add-repo-form");e.addEventListener("submit",async a=>{a.preventDefault();const t=e.elements.name.value.trim(),n=e.elements.url.value.trim();if(!t||!n){alert("Name and URL are required");return}try{await s("/repos",{method:"POST",body:JSON.stringify({name:t,repo_url:n})}),e.reset(),await u()}catch(d){alert("Failed to add repo: "+d.message)}})}document.addEventListener("DOMContentLoaded",async()=>{r(o),await p(),await u()});
