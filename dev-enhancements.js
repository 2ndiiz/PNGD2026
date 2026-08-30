// PNGD2026 DEV enhancements — Phase 1+
// Loaded only after StatiCrypt decrypts dev.html and after dev-patch.js.
(function () {
  'use strict';

  const state = {
    search: '',
    phase: '1',
  };

  const originalGetFilteredFor = getFilteredFor;
  const originalRenderApp = renderApp;
  const originalApplyFilters = applyFilters;
  const originalClearAllFilters = clearAllFilters;

  function textOf(row) {
    return [
      row['Activity Code'], row['Budget Account'], row['Description'],
      row['Category (OPEX/CAPEX)'], row['User'], row['Status'],
      row['Type'], row['Month']
    ].map(v => String(v == null ? '' : v).toLowerCase()).join(' | ');
  }

  function matchesSearch(row) {
    const q = state.search.trim().toLowerCase();
    return !q || textOf(row).includes(q);
  }

  getFilteredFor = function (rawArr) {
    return originalGetFilteredFor(rawArr).filter(matchesSearch);
  };

  function getExecutiveScope(rawArr) {
    const ac = document.getElementById('fAC')?.value || '';
    const ba = document.getElementById('fBA')?.value || '';
    const cat = document.getElementById('fCat')?.value || '';
    const user = document.getElementById('fUser')?.value || '';
    const status = document.getElementById('fStatus')?.value || '';
    const month = document.getElementById('fMonth')?.value || '';
    return rawArr.filter(r =>
      (!ac || r['Activity Code'] === ac) &&
      (!ba || String(r['Budget Account']) === ba) &&
      (!cat || r['Category (OPEX/CAPEX)'] === cat) &&
      (!user || r['User'] === user) &&
      (!status || r['Status'] === status) &&
      (!month || r['Month'] === month) &&
      matchesSearch(r)
    );
  }

  function amountOf(row) {
    const field = row['Type'];
    const n = Number(row[field] ?? row['Amount']);
    return Number.isFinite(n) ? n : 0;
  }

  function healthMeta(pct) {
    if (!Number.isFinite(pct)) return { level: 'unknown', label: 'NO BUDGET' };
    if (pct > 100) return { level: 'red', label: 'OVER BUDGET' };
    if (pct >= 90) return { level: 'orange', label: 'NEAR LIMIT' };
    if (pct >= 70) return { level: 'amber', label: 'WATCH' };
    return { level: 'green', label: 'HEALTHY' };
  }

  function injectStyles() {
    if (document.getElementById('pngd-dev-enhance-style')) return;
    const style = document.createElement('style');
    style.id = 'pngd-dev-enhance-style';
    style.textContent = `
      .dev-search-wrap{display:flex;align-items:center;gap:7px;min-width:230px;flex:1 1 260px;max-width:390px}
      .dev-search-wrap input{width:100%;height:34px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);padding:0 11px;font-family:inherit;font-size:12px;outline:none}
      .dev-search-wrap input:focus{border-color:var(--blue);box-shadow:0 0 0 2px rgba(26,86,160,.1)}
      .dev-search-hint{font-size:9px;color:var(--text3);white-space:nowrap}
      .exec-overview{margin-bottom:18px}
      .exec-overview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .exec-overview-title{font-size:12px;font-weight:700;letter-spacing:.45px;text-transform:uppercase;color:var(--text2)}
      .health-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:700;border:1px solid var(--border)}
      .health-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
      .health-green .health-dot{background:#15803d}.health-green{background:#f0fdf4;color:#166534;border-color:#bbf7d0}
      .health-amber .health-dot{background:#ca8a04}.health-amber{background:#fefce8;color:#854d0e;border-color:#fde68a}
      .health-orange .health-dot{background:#ea580c}.health-orange{background:#fff7ed;color:#9a3412;border-color:#fed7aa}
      .health-red .health-dot{background:#dc2626}.health-red{background:#fef2f2;color:#991b1b;border-color:#fecaca}
      .health-unknown .health-dot{background:#64748b}.health-unknown{background:var(--surface2);color:var(--text2)}
      .exec-grid{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:10px}
      .exec-metric{border:1px solid var(--border);border-radius:10px;background:var(--surface);padding:12px 13px;min-width:0}
      .exec-metric-label{font-size:9px;text-transform:uppercase;letter-spacing:.45px;color:var(--text3);font-weight:700;margin-bottom:5px}
      .exec-metric-value{font-size:18px;font-weight:700;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .exec-metric-sub{font-size:10px;color:var(--text3);margin-top:4px;line-height:1.35}
      .dq-card{margin-bottom:18px;border-left:5px solid #64748b}
      .dq-card.dq-warn{border-left-color:#ca8a04}.dq-card.dq-good{border-left-color:#15803d}
      .dq-summary{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .dq-badge{font-size:10px;font-weight:700;border:1px solid var(--border);border-radius:999px;padding:4px 8px;background:var(--surface2)}
      .dq-list{margin-top:10px;display:grid;gap:5px;font-size:11px;color:var(--text2)}
      .dq-item{padding:7px 9px;border:1px solid var(--border);border-radius:7px;background:var(--surface2)}
      .health-row-green td:last-child{color:#166534!important}.health-row-amber td:last-child{color:#854d0e!important}.health-row-orange td:last-child{color:#9a3412!important}.health-row-red td:last-child{color:#991b1b!important;background:#fef2f2}
      #kpiEl .kpi.dev-health-green{border-bottom:3px solid #15803d}#kpiEl .kpi.dev-health-amber{border-bottom:3px solid #ca8a04}#kpiEl .kpi.dev-health-orange{border-bottom:3px solid #ea580c}#kpiEl .kpi.dev-health-red{border-bottom:3px solid #dc2626}
      @media(max-width:1100px){.exec-grid{grid-template-columns:repeat(3,minmax(140px,1fr))}}
      @media(max-width:680px){.dev-search-wrap{min-width:100%;max-width:none}.exec-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.exec-overview-head{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function ensureSearch() {
    if (document.getElementById('devGlobalSearch')) return;
    const clear = document.getElementById('clearBtn');
    if (!clear || !clear.parentElement) return;
    const wrap = document.createElement('div');
    wrap.className = 'dev-search-wrap';
    wrap.innerHTML = '<input id="devGlobalSearch" type="search" autocomplete="off" placeholder="ค้นหา Activity / Account / Description / User…" aria-label="ค้นหาข้อมูลทั้งหมด"><span class="dev-search-hint">/ search</span>';
    clear.parentElement.insertBefore(wrap, clear);
    const input = wrap.querySelector('input');
    input.value = state.search;
    input.addEventListener('input', () => {
      state.search = input.value;
      if (typeof applyFiltersDebounced === 'function') applyFiltersDebounced(); else applyFilters();
    });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
        e.preventDefault(); input.focus();
      }
    });
  }

  function ensureOverview() {
    const app = document.getElementById('appContent');
    const kpis = document.getElementById('kpiEl');
    if (!app || !kpis || document.getElementById('devExecutiveOverview')) return;
    const box = document.createElement('section');
    box.id = 'devExecutiveOverview';
    box.className = 'exec-overview';
    box.innerHTML = '<div class="exec-overview-head"><div><div class="exec-overview-title">Executive Summary</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">Budget health & year-end outlook · current filter scope</div></div><div id="devHealthPill" class="health-pill health-unknown"><span class="health-dot"></span><span>LOADING</span></div></div><div id="devExecutiveGrid" class="exec-grid"></div>';
    app.insertBefore(box, kpis);
  }

  function ensureDataQuality() {
    const kpis = document.getElementById('kpiEl');
    if (!kpis || document.getElementById('devDataQuality')) return;
    const card = document.createElement('div');
    card.id = 'devDataQuality';
    card.className = 'card dq-card';
    card.innerHTML = '<div class="card-header dq-summary"><span class="card-title">DATA QUALITY <span id="devDqCount" class="dq-badge">Checking…</span></span><button id="devDqToggle" type="button" style="font-family:inherit;font-size:10px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">รายละเอียด</button></div><div id="devDqBody" class="card-body" style="display:none;padding-top:2px;"></div>';
    kpis.insertAdjacentElement('afterend', card);
    card.querySelector('#devDqToggle').addEventListener('click', () => {
      const body = card.querySelector('#devDqBody');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      card.querySelector('#devDqToggle').textContent = open ? 'รายละเอียด' : 'ซ่อน';
    });
  }

  function ensureUI() {
    injectStyles();
    ensureSearch();
    ensureOverview();
    ensureDataQuality();
  }

  function updateExecutive() {
    const grid = document.getElementById('devExecutiveGrid');
    const pill = document.getElementById('devHealthPill');
    if (!grid || !pill || !RAW.length) return;
    const scope = getExecutiveScope(RAW);
    let budget = 0, posted = 0, pipeline = 0;
    scope.forEach(r => {
      const amt = amountOf(r);
      if (BASE_TYPES.includes(r['Type'])) budget += amt;
      if (SPENT_TYPES.includes(r['Type'])) {
        if (String(r['Status'] || '').trim() === 'Packing Forecast') pipeline += amt;
        else posted += amt;
      }
    });
    const projected = posted + pipeline;
    const remaining = budget - projected;
    const atRisk = Math.max(projected - budget, 0);
    const pct = budget > 0 ? projected / budget * 100 : NaN;
    const h = healthMeta(pct);
    pill.className = 'health-pill health-' + h.level;
    pill.innerHTML = '<span class="health-dot"></span><span>' + h.label + (Number.isFinite(pct) ? ' · ' + pct.toFixed(1) + '%' : '') + '</span>';
    grid.innerHTML = [
      ['Budget', fmtM(budget), 'Forecast + Personal'],
      ['Posted Actual', fmtM(posted), 'Actual excluding Packing Forecast'],
      ['Pipeline', fmtM(pipeline), 'Packing Forecast'],
      ['Projected EOY', fmtM(projected), Number.isFinite(pct) ? pct.toFixed(1) + '% of budget' : 'No budget base'],
      ['Remaining', fmtM(remaining), remaining >= 0 ? 'Available vs projected' : 'Projected overspend'],
      ['Budget at Risk', fmtM(atRisk), atRisk > 0 ? 'Projected over budget' : 'No projected overrun']
    ].map(x => '<div class="exec-metric"><div class="exec-metric-label">' + esc(x[0]) + '</div><div class="exec-metric-value">' + esc(x[1]) + '</div><div class="exec-metric-sub">' + esc(x[2]) + '</div></div>').join('');
  }

  function collectQualityIssues() {
    const issues = [];
    const validCats = new Set(['OPEX','CAPEX']);
    const validTypes = new Set(ALL_TYPES);
    RAW.forEach((r, i) => {
      const row = i + 2;
      const ac = String(r['Activity Code'] || '').trim() || '(no activity)';
      const ba = String(r['Budget Account'] ?? '').trim();
      const cat = String(r['Category (OPEX/CAPEX)'] || '').trim();
      const type = String(r['Type'] || '').trim();
      const month = String(r['Month'] || '').trim();
      const desc = String(r['Description'] || '').trim();
      if (!ba) issues.push({ row, ac, issue: 'Budget Account ว่าง' });
      if (cat && !validCats.has(cat)) issues.push({ row, ac, issue: 'Category ไม่ใช่ OPEX/CAPEX: ' + cat });
      if (!validTypes.has(type)) issues.push({ row, ac, issue: 'Type ไม่รู้จัก: ' + (type || '(blank)') });
      if (!MONTHS.includes(month)) issues.push({ row, ac, issue: 'Month format ไม่ถูกต้อง: ' + (month || '(blank)') });
      if (!desc) issues.push({ row, ac, issue: 'Description ว่าง' });
      const rawAmount = r['Amount'];
      if (rawAmount !== '' && rawAmount != null && !Number.isFinite(Number(rawAmount))) issues.push({ row, ac, issue: 'Amount ไม่ใช่ตัวเลข' });
    });
    return issues;
  }

  function updateDataQuality() {
    const card = document.getElementById('devDataQuality');
    const count = document.getElementById('devDqCount');
    const body = document.getElementById('devDqBody');
    if (!card || !count || !body || !RAW.length) return;
    const issues = collectQualityIssues();
    card.classList.toggle('dq-good', issues.length === 0);
    card.classList.toggle('dq-warn', issues.length > 0);
    count.textContent = issues.length === 0 ? '✓ 0 issues' : issues.length + ' issues';
    if (!issues.length) {
      body.innerHTML = '<div style="font-size:11px;color:var(--text2);">ไม่พบปัญหาตาม validation rules ของ Dashboard ในข้อมูลปีนี้</div>';
      return;
    }
    const shown = issues.slice(0, 12);
    body.innerHTML = '<div style="font-size:10px;color:var(--text3);margin-bottom:7px;">แสดง ' + shown.length + ' จาก ' + issues.length + ' จุด · ตรวจจากข้อมูลหลัง parse</div><div class="dq-list">' + shown.map(x => '<div class="dq-item"><strong>Row ' + x.row + ' · ' + esc(x.ac) + '</strong> — ' + esc(x.issue) + '</div>').join('') + '</div>';
  }

  function decorateTrafficLights() {
    document.querySelectorAll('#pivotEl tr.subtotal-row').forEach(row => {
      row.classList.remove('health-row-green','health-row-amber','health-row-orange','health-row-red');
      const cell = row.lastElementChild;
      const pct = parseFloat(String(cell?.textContent || '').replace('%',''));
      if (!Number.isFinite(pct)) return;
      const h = healthMeta(pct);
      if (h.level !== 'unknown') row.classList.add('health-row-' + h.level);
    });
    document.querySelectorAll('#kpiEl .kpi').forEach(k => k.classList.remove('dev-health-green','dev-health-amber','dev-health-orange','dev-health-red'));
    const util = [...document.querySelectorAll('#kpiEl .kpi')].find(k => /Utilization/i.test(k.textContent || ''));
    if (util) {
      const pct = parseFloat(util.querySelector('.kpi-value')?.textContent || '');
      const h = healthMeta(pct);
      if (h.level !== 'unknown') util.classList.add('dev-health-' + h.level);
    }
  }

  function refreshEnhancements() {
    ensureUI();
    updateExecutive();
    updateDataQuality();
    decorateTrafficLights();
  }

  renderApp = function () {
    originalRenderApp();
    ensureUI();
  };

  applyFilters = function () {
    ensureUI();
    originalApplyFilters();
    refreshEnhancements();
  };

  clearAllFilters = function () {
    state.search = '';
    const input = document.getElementById('devGlobalSearch');
    if (input) input.value = '';
    originalClearAllFilters();
  };

  ensureUI();
  if (RAW.length) refreshEnhancements();
  window.__PNGD_DEV_ENHANCEMENTS = { version: 'phase1-20260831', state };
  console.info('[PNGD DEV] Phase 1 enhancements active');
})();
