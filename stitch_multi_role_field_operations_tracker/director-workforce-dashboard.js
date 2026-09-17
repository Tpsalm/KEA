(() => {
  const snapshot = {
    period: 'September 2026',
    kpis: [
      ['ACTIVE VSR', 45, 'lime'],
      ['ACTIVE ASST. VSR', 6, 'orange'],
      ['TOTAL ACTIVE STAFF', 51, 'charcoal'],
      ['PROSPECTIVE STAFF', 5, 'pale'],
      ['FUNDED VSR', 32, 'lime'],
      ['TOTAL INSURED', 39, 'orange'],
      ['EMPLOYEE CODES ISSUED', 42, 'charcoal']
    ],
    workforce: [['Active VSR', 45, '#8dc63f'], ['Active ASST VSR', 6, '#ff921b']],
    funding: [
      ['Funded', 32, '#8dc63f'], ['Awaiting Funding', 0, '#f7941d'], ['No Loan Required', 1, '#6f9dc7'],
      ['Awaiting Fidelity Insurance', 2, '#f4c542'], ['Under Review - Risk & Compliance', 3, '#b5b5b5'],
      ['Cleared by Risk & Compliance', 4, '#77a6d1'], ['Documents Incomplete / Missing', 0, '#d9d9d9'],
      ['Insured but No Loan', 4, '#92c83e'], ['Insured', 3, '#286b2c']
    ],
    insurance: [['Insured', 39, '#8dc63f'], ['Not Insured / Pending', 6, '#cfcfcf']],
    onboarding: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], vsr: [0, 0, 0, 0, 0, 16, 19, 1, 11, 0, 0, 0], assistant: [0, 0, 0, 0, 0, 0, 0, 2, 4, 0, 0, 0] },
    monthlyFunding: [0, 0, 0, 0, 0, 17, 12, 0, 3, 0, 0, 0],
    locations: [['Abeokuta', 3], ['Asaba', 0], ['Benin', 1], ['Enugu', 4], ['Ibadan', 11], ['Lagos', 27], ['Ogun', 1], ['Ogun (ABK)', 1], ['Ogun (Ijebu)', 2], ['Osogbo', 1]],
    statuses: [['Funded', 32], ['Awaiting Funding', 0], ['No Loan Required', 1], ['Awaiting Fidelity Insurance', 2], ['Under Review - Risk & Compliance', 3], ['Cleared by Risk & Compliance', 4], ['Documents Incomplete / Missing', 0], ['Status Not Provided - Needs Follow-up', 0], ['Resigned', 0], ['(Blank / No Status Yet)', 4], ['Insured', 3], ['Insured but No Loan', 4]],
    actions: [['Missing Employee Code', 17], ['Missing Onboard Date (Funded)', 1], ['Risk / Compliance Review', 0], ['Missing Email or Phone (Active)', 0], ['Awaiting Fidelity Insurance', 2]],
    redFlags: [['Shittu Akinsanya', 'DANGER - Fund Accountability'], ['Olanipekun Micheal', 'No additional note on file']]
  };

  const style = document.createElement('style');
  style.textContent = `
    .director-dashboard{display:flex;flex-direction:column;gap:10px;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;color:#161616}
    .director-dashboard *{box-sizing:border-box}.director-titlebar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:12px 18px;background:#303030;color:#fff}.director-titlebar h2{margin:0;font:700 24px/1.1 Arial,sans-serif}.director-titlebar p{margin:3px 0 0;color:#8dc63f;font-size:11px;font-weight:700;letter-spacing:.04em}.director-period{font-size:11px;font-weight:700;text-align:right}.director-period small{display:block;margin-top:7px;color:#d7d7d7;font-size:9px;font-style:italic;font-weight:400}
    .director-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:#fff}.director-kpi{min-height:92px;padding:14px 8px;text-align:center;color:#fff}.director-kpi.lime{background:#8dc63f}.director-kpi.orange{background:#f7941d}.director-kpi.charcoal{background:#303030}.director-kpi.pale{background:#d9d9d9;color:#171717}.director-kpi-label{font-size:9px;font-weight:700}.director-kpi-value{margin-top:18px;font-size:29px;font-weight:700}.director-note{display:flex;justify-content:space-between;gap:10px;padding:6px 12px;background:#303030;color:#fff;font-size:10px}.director-note strong{color:#8dc63f}.director-grid{display:grid;grid-template-columns:1.15fr 1.5fr .95fr;gap:10px}.director-card{min-width:0;border:1px solid #9d9d9d;border-radius:10px;background:#fff;overflow:hidden}.director-card h3{margin:0;padding:10px;text-align:center;font-size:17px}.director-card-head{padding:5px 8px;background:#303030;color:#fff;font-size:10px;font-weight:700}.director-card-body{padding:10px}.director-donut-wrap{display:flex;align-items:center;justify-content:center;min-height:185px}.director-donut{position:relative;width:140px;height:140px;border-radius:50%;background:var(--donut);}.director-donut:after{position:absolute;content:'';inset:37px;border-radius:50%;background:#fff}.director-donut-value{position:absolute;z-index:1;inset:0;display:grid;place-items:center;font-size:20px;font-weight:700}.director-legend{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;padding:2px 10px 10px;font-size:9px}.director-legend span:before{display:inline-block;width:7px;height:7px;margin-right:5px;background:var(--legend);content:''}.director-columns{display:flex;align-items:flex-end;gap:7px;height:205px;padding:15px 12px 25px;border-top:1px solid #ddd}.director-column-item{display:flex;flex:1;align-items:center;flex-direction:column;justify-content:flex-end;height:100%;gap:4px;font-size:8px}.director-column-bar{width:100%;max-width:30px;height:var(--height);min-height:1px;background:#517fbc}.director-column-value{font-size:8px}.director-line-chart{width:100%;height:205px}.director-line-chart polyline{fill:none;stroke:#8dc63f;stroke-width:3}.director-line-chart circle{fill:#8dc63f}.director-table-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid #999}.director-table{font-size:10px}.director-table h4{margin:0;padding:6px;background:#303030;color:#fff;font-size:10px}.director-table-row{display:flex;justify-content:space-between;gap:10px;padding:3px 7px;border-bottom:1px solid #ddd}.director-table-row strong{font-weight:700}.director-red{color:#c33}.director-red-list{padding:5px 8px;font-size:10px}.director-red-list div{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #ddd}.director-source{padding:5px 8px;color:#555;font-size:9px;font-style:italic}
    @media(max-width:900px){.director-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.director-grid{grid-template-columns:1fr 1fr}.director-grid>.director-card:last-child{grid-column:1/-1}.director-table-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){.director-titlebar{display:block}.director-period{margin-top:10px;text-align:left}.director-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.director-grid,.director-table-grid{grid-template-columns:1fr}.director-card{grid-column:auto!important}.director-kpi-value{margin-top:12px}}
  `;
  document.head.appendChild(style);

  const donut = (items) => {
    const total = items.reduce((sum, item) => sum + item[1], 0) || 1;
    let cursor = 0;
    const stops = items.map((item) => { const start = cursor; cursor += item[1] / total * 360; return `${item[2]} ${start}deg ${cursor}deg`; }).join(', ');
    return `<div class="director-donut" style="--donut:conic-gradient(${stops})"><div class="director-donut-value">${total}</div></div>`;
  };
  const legend = (items) => `<div class="director-legend">${items.map(item => `<span style="--legend:${item[2]}">${item[0]} <b>${item[1]}</b></span>`).join('')}</div>`;
  const columns = (labels, values, secondValues) => { const max = Math.max(...values, ...secondValues, 1); return `<div class="director-columns">${labels.map((label, index) => `<div class="director-column-item"><span class="director-column-value">${values[index] || 0} ${secondValues[index] ? `· ${secondValues[index]}` : ''}</span><div style="display:flex;align-items:flex-end;gap:2px;height:100%"><div class="director-column-bar" style="--height:${Math.max(values[index] / max * 155, values[index] ? 3 : 1)}px;background:#8dc63f"></div><div class="director-column-bar" style="--height:${Math.max(secondValues[index] / max * 155, secondValues[index] ? 3 : 1)}px;background:#f7941d"></div></div><span>${label}</span></div>`).join('')}</div><div class="director-source"><span style="color:#8dc63f">■ VSR Onboarded</span> &nbsp; <span style="color:#f7941d">■ ASST. VSR Onboarded</span></div>`; };
  const line = (values) => { const max = Math.max(...values, 1); const points = values.map((value, index) => `${12 + index * 7.1},${185 - value / max * 155}`).join(' '); return `<svg class="director-line-chart" viewBox="0 0 100 205" preserveAspectRatio="none" aria-label="Monthly VSR funding line chart"><line x1="10" y1="185" x2="96" y2="185" stroke="#aaa"/><polyline points="${points}"/>${values.map((value, index) => `<circle cx="${12 + index * 7.1}" cy="${185 - value / max * 155}" r="1.8"/>`).join('')}</svg>`; };
  const rows = (items) => items.map(item => `<div class="director-table-row"><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join('');

  const root = document.createElement('section');
  root.className = 'director-dashboard';
  root.setAttribute('aria-label', 'September 2026 VSR workforce and recruitment dashboard');
  root.innerHTML = `<div class="director-titlebar"><div><h2>KEA GROUP</h2><p>VSR WORKFORCE &amp; RECRUITMENT DASHBOARD</p></div><div class="director-period">Reporting Period: ${snapshot.period}<small>Workforce · Recruitment · Funding · Insurance · Compliance</small></div></div><div class="director-kpis">${snapshot.kpis.map(item => `<div class="director-kpi ${item[2]}"><div class="director-kpi-label">${item[0]}</div><div class="director-kpi-value">${item[1]}</div></div>`).join('')}</div><div class="director-note"><span>This Month: <strong>11 new VSR</strong> &nbsp;|&nbsp; 4 new ASST. VSR onboarded</span><span>Year to Date: 47 VSR onboarded &nbsp;|&nbsp; 6 ASST. VSR onboarded</span><span class="director-red">Records requiring review: 18 &nbsp;|&nbsp; ⚑ Red Flagged: 3</span></div><div class="director-grid"><article class="director-card"><div class="director-card-head">ACTIVE WORKFORCE &amp; FUNDING STATUS</div><h3>Active Workforce</h3><div class="director-donut-wrap">${donut(snapshot.workforce)}</div>${legend(snapshot.workforce)}</article><article class="director-card"><div class="director-card-head">VSR FUNDING STATUS</div><h3>VSR Funding Status</h3><div class="director-donut-wrap">${donut(snapshot.funding)}</div>${legend(snapshot.funding)}</article><article class="director-card"><div class="director-card-head">FIDELITY INSURANCE COVERAGE</div><h3>Fidelity Insurance<br>Coverage</h3><div class="director-donut-wrap">${donut(snapshot.insurance)}</div>${legend(snapshot.insurance)}</article></div><article class="director-card"><div class="director-card-head">MONTHLY STAFF ONBOARDING - VSR vs ASST. VSR</div><h3>Monthly Staff Onboarding</h3>${columns(snapshot.onboarding.labels, snapshot.onboarding.vsr, snapshot.onboarding.assistant)}</article><article class="director-card"><div class="director-card-head">MONTHLY VSR FUNDING</div><h3>Monthly VSR Funding</h3>${line(snapshot.monthlyFunding)}<div class="director-source">Jun: 17 &nbsp; · &nbsp; Jul: 12 &nbsp; · &nbsp; Sep: 3</div></article><div class="director-table-grid"><div class="director-table"><h4>VSR STATUS BREAKDOWN - All Dropdown Values (Active + Prospective)</h4>${rows(snapshot.statuses)}</div><div class="director-table"><h4>ACTIVE VSRS BY LOCATION</h4>${rows(snapshot.locations)}</div><div class="director-table"><h4>⚠ ACTION REQUIRED</h4>${rows(snapshot.actions)}<h4>RED FLAG LIST (auto-updates from VSR Tracker - Risk Status)</h4><div class="director-red-list">${snapshot.redFlags.map(item => `<div><span class="director-red">⚑ ${item[0]}</span><em>${item[1]}</em></div>`).join('')}</div></div></div><div class="director-source">Exact values transcribed from the supplied September 2026 workforce tracker images.</div>`;

  const main = document.querySelector('main');
  const content = main?.firstElementChild;
  if (main && content) content.prepend(root);
})();
