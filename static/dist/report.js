import"./styles.js";const g=new URLSearchParams(window.location.search),m=g.get("repo_id");if(!m)throw document.getElementById("report-container").innerHTML='<p class="error">Error: repo_id is missing</p>',new Error("Missing repo_id");const u=document.querySelector("a[data-repo-link]");u&&(u.href=`attack_graph.html?repo_id=${m}`);fetch(`/scan/${m}/latest`).then(a=>{if(!a.ok)throw new Error(`Scan not found (status ${a.status})`);return a.json()}).then(a=>y(a)).catch(a=>{document.getElementById("report-container").innerHTML=`<p class="error">${a.message}</p>`});function C(a){return a.replace(/([A-Z])/g," $1").replace(/_/g," ").replace(/\w\S*/g,i=>i.charAt(0).toUpperCase()+i.slice(1).toLowerCase())}function y(a){var h;const i=document.getElementById("report-container");i.innerHTML="";const p=a.ai_assessment||((h=a.scan_results)==null?void 0:h.ai_assessment);if(p&&p.impact_assessment){const r=p.impact_assessment,t=document.createElement("section");t.className="report-section";const s=document.createElement("h2");s.textContent="AI Impact Assessment",t.appendChild(s);const d=document.createElement("p");if(d.innerHTML=`<strong>Overall Risk:</strong> ${r.overall_risk}`,t.appendChild(d),Array.isArray(r.critical_attack_paths)){const e=document.createElement("h3");e.textContent="Critical Attack Paths",t.appendChild(e);const n=document.createElement("ul");n.className="report-list",r.critical_attack_paths.forEach(o=>{const c=document.createElement("li");c.textContent=o.join(" → "),n.appendChild(c)}),t.appendChild(n)}if(Array.isArray(r.functions_analysis)){const e=document.createElement("h3");e.textContent="Functions Analysis",t.appendChild(e);const n=document.createElement("table");n.className="func-analysis",n.innerHTML=`
        <thead>
          <tr>
            <th>Function</th>
            <th>Risk</th>
            <th>Impact</th>
            <th>Vulnerabilities</th>
            <th>Recommendation</th>
          </tr>
        </thead>
      `;const o=document.createElement("tbody");r.functions_analysis.forEach(c=>{const l=document.createElement("tr"),f=c.vulnerabilities.map(_=>_.message).join("; ")||"None";l.innerHTML=`
          <td>${c.function_id}</td>
          <td>${c.risk_rating}</td>
          <td>${c.impact_rating}</td>
          <td>${f}</td>
          <td>${c.recommendation}</td>
        `,o.appendChild(l)}),n.appendChild(o),t.appendChild(n)}i.appendChild(t)}const E=new Set(["ai_assessment","attack_graph"]);Object.entries(a).forEach(([r,t])=>{if(E.has(r))return;const s=document.createElement("section");s.className="report-section";const d=document.createElement("h2");if(d.textContent=C(r),s.appendChild(d),Array.isArray(t)){const e=document.createElement("ul");t.forEach(n=>{const o=document.createElement("li");o.textContent=typeof n=="object"?JSON.stringify(n):n,e.appendChild(o)}),s.appendChild(e)}else if(t&&typeof t=="object"){const e=document.createElement("dl");Object.entries(t).forEach(([n,o])=>{const c=document.createElement("dt");c.textContent=C(n);const l=document.createElement("dd");l.textContent=o,e.appendChild(c),e.appendChild(l)}),s.appendChild(e)}else{const e=document.createElement("p");e.textContent=t,s.appendChild(e)}i.appendChild(s)})}
