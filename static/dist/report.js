import"./styles.js";const $=new URLSearchParams(window.location.search),m=$.get("repo_id");if(!m)throw document.getElementById("report-container").innerHTML='<p class="error">Error: repo_id is missing</p>',new Error("Missing repo_id");const C=document.querySelector("a[data-repo-link]");C&&(C.href=`attack_graph.html?repo_id=${m}`);fetch(`/scan/${m}/latest`).then(t=>{if(!t.ok)throw new Error(`Scan not found (status ${t.status})`);return t.json()}).then(t=>b(t)).catch(t=>{document.getElementById("report-container").innerHTML=`<p class="error">${t.message}</p>`});function E(t=0){return t>=.67?"High":t>=.34?"Medium":"Low"}function _(t){return t.replace(/([A-Z])/g," $1").replace(/_/g," ").replace(/\w\S*/g,o=>o.charAt(0).toUpperCase()+o.slice(1).toLowerCase())}function b(t){var h;const o=document.getElementById("report-container");o.innerHTML="";const p=t.ai_assessment||((h=t.scan_results)==null?void 0:h.ai_assessment);if(p&&p.impact_assessment){const s=p.impact_assessment,e=document.createElement("section");e.className="report-section";const i=document.createElement("h2");i.textContent="AI Impact Assessment",e.appendChild(i);const d=document.createElement("p");if(d.innerHTML=`<strong>Overall Risk:</strong> ${s.overall_risk}`,e.appendChild(d),Array.isArray(s.critical_attack_paths)){const n=document.createElement("h3");n.textContent="Critical Attack Paths",e.appendChild(n);const c=document.createElement("ul");c.className="report-list",s.critical_attack_paths.forEach(r=>{const a=document.createElement("li");a.textContent=r.join(" → "),c.appendChild(a)}),e.appendChild(c)}if(Array.isArray(s.functions_analysis)){const n=document.createElement("h3");n.textContent="Functions Analysis",e.appendChild(n);const c=document.createElement("table");c.className="func-analysis",c.innerHTML=`
        <thead>
          <tr>
            <th>Function</th>
            <th>Risk</th>
            <th>Impact</th>
            <th>Vulnerabilities</th>
            <th>Recommendation</th>
          </tr>
        </thead>
      `;const r=document.createElement("tbody");s.functions_analysis.forEach(a=>{var u;const l=document.createElement("tr"),f=isFinite(a.risk_rating)?E(+a.risk_rating):a.risk_rating,y=isFinite(a.impact_rating)?E(+a.impact_rating):a.impact_rating,k=((u=a.vulnerabilities)==null?void 0:u.map(A=>A.message).join("; "))||"None";l.innerHTML=`
          <td>${a.function_id}</td>
          <td>${f}</td>
          <td>${y}</td>
          <td>${k}</td>
          <td>${a.recommendation}</td>
        `,r.appendChild(l)}),c.appendChild(r),e.appendChild(c)}o.appendChild(e)}const g=new Set(["ai_assessment","attack_graph"]);Object.entries(t).forEach(([s,e])=>{if(g.has(s))return;const i=document.createElement("section");i.className="report-section";const d=document.createElement("h2");if(d.textContent=_(s),i.appendChild(d),Array.isArray(e)){const n=document.createElement("ul");e.forEach(c=>{const r=document.createElement("li");r.textContent=typeof c=="object"?JSON.stringify(c):c,n.appendChild(r)}),i.appendChild(n)}else if(e&&typeof e=="object"){const n=document.createElement("dl");Object.entries(e).forEach(([c,r])=>{const a=document.createElement("dt");a.textContent=_(c);const l=document.createElement("dd");l.textContent=r,n.appendChild(a),n.appendChild(l)}),i.appendChild(n)}else{const n=document.createElement("p");n.textContent=e,i.appendChild(n)}o.appendChild(i)})}
