// PNGD2026 DEV fixes — 2026-08-30
// Loaded only after StatiCrypt decrypts dev.html.
(function () {
  const DEFAULT_TYPE_FILTERS_DEV = new Set(['Forecast', 'Actual']);

  function resetFilterControlsToDefaultsDev() {
    SINGLE_FILTER_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.querySelectorAll('#fType input[type="checkbox"]').forEach(c => {
      c.checked = DEFAULT_TYPE_FILTERS_DEV.has(c.value);
    });
  }

  // Fix 1 + Fix 2:
  // - no selected Type means no data (not "all")
  // - YoY Activity matching is canonical across years (OP-26-01 <-> OP-27-01)
  getFilteredFor = function (rawArr) {
    const ac = document.getElementById('fAC').value;
    const ba = document.getElementById('fBA').value;
    const cat = document.getElementById('fCat').value;
    const user = document.getElementById('fUser').value;
    const status = document.getElementById('fStatus').value;
    const month = document.getElementById('fMonth').value;
    const selectedTypes = getSelectedTypes();
    const canonicalAC = ac ? canonicalActivity(ac) : '';
    const isYoYScope = rawArr === YOY_DATA.prior || rawArr === YOY_DATA.current;

    return rawArr.filter(r =>
      (!ac || (isYoYScope
        ? canonicalActivity(r['Activity Code']) === canonicalAC
        : r['Activity Code'] === ac)) &&
      (!ba || String(r['Budget Account']) === ba) &&
      (!cat || r['Category (OPEX/CAPEX)'] === cat) &&
      (!user || r['User'] === user) &&
      (!status || r['Status'] === status) &&
      (!month || r['Month'] === month) &&
      selectedTypes.has(r['Type'])
    );
  };

  // Fix 3: remove Sheet values from inline JavaScript context.
  renderOverBudget = function () {
    const card = document.getElementById('overBudgetCard');
    const list = document.getElementById('overBudgetList');
    const countEl = document.getElementById('obCount');
    if (!card || !list || !RAW.length) {
      if (card) card.style.display = 'none';
      return;
    }

    const groups = {};
    RAW.forEach(r => {
      const ac = r['Activity Code'] || '—';
      const ba = r['Budget Account'] || '—';
      const key = `${ac}||${ba}`;
      if (!groups[key]) groups[key] = { ac, ba, base: 0, spent: 0 };
      const field = r['Type'];
      const amt = parseFloat(r[field] || r['Amount']) || 0;
      if (BASE_TYPES.includes(r['Type'])) groups[key].base += amt;
      else if (SPENT_TYPES.includes(r['Type'])) groups[key].spent += amt;
    });

    const over = Object.values(groups)
      .map(g => ({ ...g, variance: g.spent - g.base }))
      .filter(g => g.variance > 0)
      .sort((a, b) => b.variance - a.variance);

    if (over.length === 0) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';
    countEl.textContent = over.length;
    list.innerHTML = over.map(g => `
      <div class="overbudget-item">
        <span class="overbudget-label">
          <strong>${esc(g.ac)}</strong> (${esc(fmtAccount(g.ba))}) ใช้งบเกินแผนไป
          <span class="overbudget-amt">${fmtN(g.variance)} ฿</span>
        </span>
        <button class="overbudget-link" type="button" data-ac="${esc(g.ac)}" data-ba="${esc(String(g.ba))}">ดู</button>
      </div>
    `).join('');

    list.querySelectorAll('.overbudget-link').forEach(btn => {
      btn.addEventListener('click', () => {
        filterToGroup(btn.dataset.ac || '', btn.dataset.ba || '');
      });
    });
  };

  // Fix 4: hash state must be fully restorable, including "no Type selected".
  saveFiltersToHash = function () {
    const params = new URLSearchParams();
    SINGLE_FILTER_IDS.forEach(id => {
      const el = document.getElementById(id);
      const v = el ? el.value : '';
      if (v) params.set(id, v);
    });

    const types = [...getSelectedTypes()];
    const isDefaultTypes = types.length === DEFAULT_TYPE_FILTERS_DEV.size
      && types.every(t => DEFAULT_TYPE_FILTERS_DEV.has(t));
    if (!isDefaultTypes) params.set('fType', types.join(','));

    const h = params.toString();
    if (h) history.replaceState(null, '', '#' + h);
    else if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  };

  loadFiltersFromHash = function () {
    resetFilterControlsToDefaultsDev();
    const h = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    if (!h) return false;

    const params = new URLSearchParams(h);
    let any = false;
    SINGLE_FILTER_IDS.forEach(id => {
      const v = params.get(id);
      if (v !== null) {
        const el = document.getElementById(id);
        if (el) {
          el.value = v;
          any = true;
        }
      }
    });

    const typeParam = params.get('fType');
    if (typeParam !== null) {
      const selected = new Set(typeParam ? typeParam.split(',') : []);
      document.querySelectorAll('#fType input[type="checkbox"]').forEach(c => {
        c.checked = selected.has(c.value);
      });
      any = true;
    }
    return any;
  };

  clearAllFilters = function () {
    resetFilterControlsToDefaultsDev();
    history.replaceState(null, '', location.pathname + location.search);
    applyFilters();
  };

  // The original handler only re-rendered. This second handler restores controls first.
  window.addEventListener('hashchange', () => {
    loadFiltersFromHash();
    if (RAW.length) applyFilters();
  });

  console.info('[PNGD DEV] fixes 1-4 active');
})();
