/**
 * SIPENA Lite — Modul Manajemen Target (target.js)
 * Mengelola target tahunan secara hierarkis: BKPH → RPH → TPG → Mandor → Penyadap.
 * Validasi indikator kelengkapan berjenjang (🟢/🟡/🔴).
 */
'use strict';

const TargetModule = (() => {
  const U = () => window.SipenaUtils;

  let state = {
    tahun: 2026,
    subTab: 'bkph', // bkph, rph, tpg, mandor, penyadap
    search: '',
    page: 1
  };

  const PETAK_CUSTOM_ORDER = [
    "52a.1", "52c", "52d", "52h.1", "52h.2", "52e.1", "52e.2", "52g.2", "52q", "52t.1",
    "52t.2", "52v", "53b", "53i", "52g.1", "52i", "52k", "52m", "52n", "52o",
    "52r.1", "52r.2", "36c", "36d", "36e", "36j.2", "37a.1", "37a.2", "53d.2", "53f",
    "53h", "53j", "53l.1", "53l.2", "54b", "54c", "54d", "54e.1", "54e.3", "54l",
    "37b.3", "37b.4", "37b.1", "37b.2", "37o.1", "37o.2", "54f", "54g", "54h", "54q",
    "54i", "37d.2", "37d.1", "37d.3", "37e.1", "37e.2", "37f.1", "37g.1", "37g.2", "37h",
    "37i", "37n.1", "37n.2", "38a.2", "38a.1", "38a.3", "38b", "38c.3", "38c.2", "38c.1",
    "38d", "38e", "38h", "38i", "38m.2", "38m.1", "39b", "39d", "39h", "39i",
    "39e", "40i", "40c.1", "40c.2", "40f.1", "41d.1", "41e", "41g", "41j.1", "41l.1",
    "45a", "45c", "45h.1", "45e", "56a", "56b", "55a.1", "55a.2", "55c", "55b.1",
    "55b.2", "55d", "56h", "56c", "56d", "56e", "56f", "56r", "56s", "57c",
    "57d", "57f", "57h.2", "57i", "57j", "57l", "57m", "57.o", "57q", "57t",
    "58a", "58b", "58c", "58d.1", "62c.2", "63b", "63c", "63g", "63.i.1", "63.i.2",
    "63j", "65a", "65b", "65c", "65f", "65g", "65h", "64d.4", "64g", "66a.1",
    "66a.3", "63f", "60l", "62e", "62g", "62h.2", "63h.1", "59a", "59c.4", "59c.5",
    "59c.6", "62c.1", "60p", "62a", "62f", "62d.1", "63d.1", "63e", "64a", "64b.1",
    "64b.2", "60e", "60f", "60g", "61h.1", "61b.1", "61d.2", "61g.1", "61g.2", "61m",
    "61e", "61f", "64e.1", "64i.1", "66c", "66i", "66d.2", "66e.2", "76a", "76i",
    "77d.1", "77p", "80m", "69s", "80n", "80p", "69g.1", "69o.2", "77c.1", "69q",
    "76d", "79a.2", "79a.1", "79d", "79e", "79f.1", "79k.1", "77l", "77m", "77n",
    "77o", "69j", "69r", "77a", "78d.2", "78g.1", "78h", "78k.2", "69t", "78d.1",
    "78e.1", "69k.1", "69k.2", "69o.1", "69p", "80e.1", "80e.2", "80e.3", "80c", "81c",
    "82a.1", "81a.1", "83c", "83g.1", "84a", "84d", "80g", "81b", "81d", "81e",
    "81f", "80j", "80l", "82c", "83e", "83g.2", "83l", "83m.1", "70a.1", "70c",
    "70e", "70g", "70h", "70i", "70k", "70l", "70m", "67d.1", "67f.1", "67h",
    "67a", "67e.1", "68a", "68e.1", "68g", "75c.2", "75c.1", "75d.1", "75e", "75f",
    "67c", "67i", "67j", "67k.1", "67n", "68f.1", "68h.2", "68h.1", "71a.1", "71g.1",
    "71i", "71j", "71s", "71b.2", "71d.2", "71e", "71f", "71k", "71p", "71q",
    "71.t", "71.u.1", "74g.1", "74h.1", "74h.2", "72a", "72b", "72d.2", "72e", "72g",
    "72j", "74f.1", "74f.2", "72k.2", "72k.1", "73h", "73i", "73k", "73c.3", "73c.1",
    "73d.1", "73d.2", "73e.2", "73e.3", "73e.1", "73f", "74b.1", "74c", "6b", "6d",
    "6e", "7c.1", "7l.1", "7e.2", "7g.2", "2a", "4i", "4g", "9c.1", "9d.1",
    "9e.1", "9k", "9f", "10d"
  ];

  function normalizePetakLabel(label) {
    if (!label) return '';
    return label.toLowerCase()
      .trim()
      .replace(/^petak\s+/i, '')
      .replace(/[-_]/g, '.');
  }

  function getCustomSortIndex(label) {
    const norm = normalizePetakLabel(label);
    const idx = PETAK_CUSTOM_ORDER.indexOf(norm);
    return idx === -1 ? 999999 : idx;
  }

  // ── Hak Akses / RBAC ──────────────────────────────────────────
  function getPermissions() {
    const user = window.app && window.app.currentUser;
    if (!user) return { view: false, write: false, isMandor: false };
    const role = user.role;
    
    // Admin: CRUD full
    if (role === 'admin') return { view: true, write: true, isMandor: false };
    // Asper / KRPH: View only
    if (role === 'bkph' || role === 'krph') return { view: true, write: false, isMandor: false };
    // Mandor (Mandor Sadap / Mandor TPG): CRUD target penyadap di wilayah kerjanya
    if (role === 'mandor' || role === 'tpg') return { view: true, write: true, isMandor: true };
    
    return { view: false, write: false, isMandor: false };
  }

  // ── Inisialisasi Modul ────────────────────────────────────────
  function init() {
    const perm = getPermissions();
    if (!perm.view) return;

    // Default sub-tab berdasarkan role
    if (perm.isMandor) {
      state.subTab = 'penyadap';
    } else {
      state.subTab = 'bkph';
    }

    renderSubTabs();
    render();
  }

  // ── Render Sub-Tabs Menu Target ──────────────────────────────
  function renderSubTabs() {
    const container = document.getElementById('target-tab-headers');
    if (!container) return;

    const perm = getPermissions();
    const tabs = [
      { id: 'bkph', label: '🏢 BKPH', visible: !perm.isMandor },
      { id: 'rph', label: '🌲 RPH', visible: !perm.isMandor },
      { id: 'tpg', label: '🏭 TPG', visible: !perm.isMandor },
      { id: 'mandor', label: '👤 Mandor', visible: !perm.isMandor },
      { id: 'penyadap', label: '👷 Penyadap', visible: true }
    ];

    container.innerHTML = tabs
      .filter(t => t.visible)
      .map(t => `<button class="btn ${state.subTab === t.id ? 'btn-primary' : 'btn-secondary'} btn-sm target-tab-btn" onclick="TargetModule.switchSubTab('${t.id}')">${t.label}</button>`)
      .join(' ');
  }

  function switchSubTab(tabId) {
    state.subTab = tabId;
    state.page = 1;
    state.search = '';
    const searchInput = document.getElementById('target-search-input');
    if (searchInput) searchInput.value = '';
    renderSubTabs();
    render();
  }

  function changeTahun(val) {
    state.tahun = parseInt(val) || 2026;
    state.page = 1;
    render();
    // Update dashboard utama juga jika sedang aktif
    if (window.app) window.app.loadDashboardData();
  }

  // ── Main Render ───────────────────────────────────────────────
  async function render() {
    const perm = getPermissions();
    if (!perm.view) return;

    // 1. Hitung kelengkapan target & render indicator status bar
    await renderIndicatorBar();

    // 2. Render entitas tabel berdasarkan sub-tab saat ini
    const triggerBtn = document.getElementById('btn-add-target');
    const importBtn  = document.getElementById('btn-import-target');
    const templateBtn = document.getElementById('btn-template-target');

    if (triggerBtn) {
      if (state.subTab === 'penyadap') {
        triggerBtn.style.display = perm.write ? 'block' : 'none';
        triggerBtn.textContent = '+ Target Penyadap';
      } else {
        triggerBtn.style.display = (perm.write && !perm.isMandor) ? 'block' : 'none';
        triggerBtn.textContent = `+ Target ${state.subTab.toUpperCase()}`;
      }
    }

    if (importBtn && templateBtn) {
      if (state.subTab === 'penyadap') {
        importBtn.style.display = perm.write ? 'block' : 'none';
        templateBtn.style.display = perm.write ? 'block' : 'none';
      } else {
        importBtn.style.display = (perm.write && !perm.isMandor) ? 'block' : 'none';
        templateBtn.style.display = (perm.write && !perm.isMandor) ? 'block' : 'none';
      }
    }

    // Hide inline elements if not penyadap
    if (state.subTab !== 'penyadap') {
      const trackerContainer = document.getElementById('target-quota-tracker-container');
      if (trackerContainer) trackerContainer.innerHTML = '';
      const saveBtnContainer = document.getElementById('target-save-all-container');
      if (saveBtnContainer) saveBtnContainer.innerHTML = '';
    }

    switch (state.subTab) {
      case 'bkph':     await renderBKPH(); break;
      case 'rph':      await renderRPH(); break;
      case 'tpg':      await renderTPG(); break;
      case 'mandor':   await renderMandor(); break;
      case 'penyadap': await renderPenyadap(); break;
    }
  }

  // ── Render Indikator Kelengkapan (🟢/🟡/🔴) ────────────────────
  async function renderIndicatorBar() {
    const bar = document.getElementById('target-indicator-bar');
    if (!bar) return;

    const t = state.tahun;

    // Load data
    const bkphList = (await window.db.getAllActive('target_bkph')).filter(x => x.tahun === t);
    const rphList  = (await window.db.getAllActive('target_rph')).filter(x => x.tahun === t);
    const tpgList  = (await window.db.getAllActive('target_tpg')).filter(x => x.tahun === t);
    const mdrList  = (await window.db.getAllActive('target_mandor')).filter(x => x.tahun === t);
    const pndList  = (await window.db.getAllActive('target_penyadap')).filter(x => x.tahun === t);

    const sumBkph = bkphList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumRph  = rphList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumTpg  = tpgList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumMdr  = mdrList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumPnd  = pndList.reduce((s, x) => s + (x.target_kg || 0), 0);

    const getStatus = (lower, upper) => {
      if (upper === 0) return { label: 'Belum Lengkap', cls: 'status-yellow', emoji: '🟡' };
      if (lower === upper) return { label: 'Sesuai', cls: 'status-green', emoji: '🟢' };
      if (lower < upper) return { label: 'Belum Lengkap', cls: 'status-yellow', emoji: '🟡' };
      return { label: 'Tidak Sesuai', cls: 'status-red', emoji: '🔴' };
    };

    const stRph = getStatus(sumRph, sumBkph);
    const stTpg = getStatus(sumTpg, sumRph);
    const stMdr = getStatus(sumMdr, sumTpg);
    const stPnd = getStatus(sumPnd, sumMdr);

    bar.innerHTML = `
      <div class="target-indicator-card">
        <span class="target-indicator-title">RPH vs BKPH</span>
        <span class="target-indicator-value ${stRph.cls}">${stRph.emoji} ${stRph.label}</span>
        <span class="target-indicator-detail">${sumRph.toLocaleString('id-ID')} / ${sumBkph.toLocaleString('id-ID')} kg</span>
      </div>
      <div class="target-indicator-card">
        <span class="target-indicator-title">TPG vs RPH</span>
        <span class="target-indicator-value ${stTpg.cls}">${stTpg.emoji} ${stTpg.label}</span>
        <span class="target-indicator-detail">${sumTpg.toLocaleString('id-ID')} / ${sumRph.toLocaleString('id-ID')} kg</span>
      </div>
      <div class="target-indicator-card">
        <span class="target-indicator-title">Mandor vs TPG</span>
        <span class="target-indicator-value ${stMdr.cls}">${stMdr.emoji} ${stMdr.label}</span>
        <span class="target-indicator-detail">${sumMdr.toLocaleString('id-ID')} / ${sumTpg.toLocaleString('id-ID')} kg</span>
      </div>
      <div class="target-indicator-card">
        <span class="target-indicator-title">Penyadap vs Mandor</span>
        <span class="target-indicator-value ${stPnd.cls}">${stPnd.emoji} ${stPnd.label}</span>
        <span class="target-indicator-detail">${sumPnd.toLocaleString('id-ID')} / ${sumMdr.toLocaleString('id-ID')} kg</span>
      </div>
    `;
  }

  // ── Render BKPH ──────────────────────────────────────────────
  async function renderBKPH() {
    const list = (await window.db.getAllActive('target_bkph')).filter(x => x.tahun === state.tahun);
    const tbody = document.getElementById('target-tbody');
    const thead = document.getElementById('target-thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr><th style="width:50px">No</th><th>Tahun</th><th>BKPH</th><th>Target Tahunan (Kg)</th><th>Aksi</th></tr>`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada target BKPH tahun ${state.tahun}</td></tr>`;
      U().renderPagination(document.getElementById('target-pagination'), { total: 0, page: 1, totalPages: 1 }, null);
      return;
    }

    const perm = getPermissions();
    tbody.innerHTML = list.map((row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${row.tahun}</strong></td>
        <td>BKPH Bantarkawung (Utama)</td>
        <td><strong>${(row.target_kg || 0).toLocaleString('id-ID')} kg</strong></td>
        <td>
          <div class="action-btns">
            ${perm.write ? `
              <button class="btn btn-secondary btn-xs" onclick="TargetModule.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="TargetModule.confirmDelete('${row.id}')">🗑️</button>
            ` : '—'}
          </div>
        </td>
      </tr>
    `).join('');

    U().renderPagination(document.getElementById('target-pagination'), { total: list.length, page: 1, totalPages: 1 }, null);
  }

  // ── Render RPH ──────────────────────────────────────────────
  async function renderRPH() {
    const list    = (await window.db.getAllActive('target_rph')).filter(x => x.tahun === state.tahun);
    const allRph  = await window.db.getAllActive('rph');
    const tbody   = document.getElementById('target-tbody');
    const thead   = document.getElementById('target-thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr><th style="width:50px">No</th><th>Tahun</th><th>RPH</th><th>Target Tahunan (Kg)</th><th>Aksi</th></tr>`;

    let filtered = list;
    if (state.search) {
      filtered = list.filter(row => {
        const rph = allRph.find(r => r.id === row.rph_id);
        return rph && rph.nama.toLowerCase().includes(state.search.toLowerCase());
      });
    }

    const pager = U().paginate(filtered, state.page);
    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada target RPH tahun ${state.tahun}</td></tr>`;
    } else {
      const perm = getPermissions();
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const rph   = allRph.find(r => r.id === row.rph_id);
        const rowNo = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;
        return `
          <tr>
            <td>${rowNo}</td>
            <td><strong>${row.tahun}</strong></td>
            <td>${rph ? rph.nama : '—'}</td>
            <td><strong>${(row.target_kg || 0).toLocaleString('id-ID')} kg</strong></td>
            <td>
              <div class="action-btns">
                ${perm.write ? `
                  <button class="btn btn-secondary btn-xs" onclick="TargetModule.openEdit('${row.id}')">✏️ Edit</button>
                  <button class="btn btn-danger btn-xs" onclick="TargetModule.confirmDelete('${row.id}')">🗑️</button>
                ` : '—'}
              </div>
            </td>
          </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('target-pagination'), pager, p => { state.page = p; render(); });
  }

  // ── Render TPG ──────────────────────────────────────────────
  async function renderTPG() {
    const list    = (await window.db.getAllActive('target_tpg')).filter(x => x.tahun === state.tahun);
    const allTpg  = await window.db.getAllActive('tpg');
    const tbody   = document.getElementById('target-tbody');
    const thead   = document.getElementById('target-thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr><th style="width:50px">No</th><th>Tahun</th><th>TPG</th><th>Target Tahunan (Kg)</th><th>Aksi</th></tr>`;

    let filtered = list;
    if (state.search) {
      filtered = list.filter(row => {
        const tpg = allTpg.find(t => t.id === row.tpg_id);
        return tpg && tpg.nama.toLowerCase().includes(state.search.toLowerCase());
      });
    }

    const pager = U().paginate(filtered, state.page);
    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada target TPG tahun ${state.tahun}</td></tr>`;
    } else {
      const perm = getPermissions();
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const tpg   = allTpg.find(t => t.id === row.tpg_id);
        const rowNo = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;
        return `
          <tr>
            <td>${rowNo}</td>
            <td><strong>${row.tahun}</strong></td>
            <td>${tpg ? tpg.nama : '—'}</td>
            <td><strong>${(row.target_kg || 0).toLocaleString('id-ID')} kg</strong></td>
            <td>
              <div class="action-btns">
                ${perm.write ? `
                  <button class="btn btn-secondary btn-xs" onclick="TargetModule.openEdit('${row.id}')">✏️ Edit</button>
                  <button class="btn btn-danger btn-xs" onclick="TargetModule.confirmDelete('${row.id}')">🗑️</button>
                ` : '—'}
              </div>
            </td>
          </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('target-pagination'), pager, p => { state.page = p; render(); });
  }

  // ── Render Mandor ───────────────────────────────────────────
  async function renderMandor() {
    const list     = (await window.db.getAllActive('target_mandor')).filter(x => x.tahun === state.tahun);
    const allUsers = await window.db.getAllActive('users');
    const tbody    = document.getElementById('target-tbody');
    const thead    = document.getElementById('target-thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr><th style="width:50px">No</th><th>Tahun</th><th>Mandor</th><th>Target Tahunan (Kg)</th><th>Aksi</th></tr>`;

    let filtered = list;
    if (state.search) {
      filtered = list.filter(row => {
        const usr = allUsers.find(u => u.id === row.mandor_id);
        return usr && usr.nama_lengkap.toLowerCase().includes(state.search.toLowerCase());
      });
    }

    const pager = U().paginate(filtered, state.page);
    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Belum ada target Mandor tahun ${state.tahun}</td></tr>`;
    } else {
      const perm = getPermissions();
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const usr   = allUsers.find(u => u.id === row.mandor_id);
        const rowNo = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;
        return `
          <tr>
            <td>${rowNo}</td>
            <td><strong>${row.tahun}</strong></td>
            <td>${usr ? usr.nama_lengkap : '—'}</td>
            <td><strong>${(row.target_kg || 0).toLocaleString('id-ID')} kg</strong></td>
            <td>
              <div class="action-btns">
                ${perm.write ? `
                  <button class="btn btn-secondary btn-xs" onclick="TargetModule.openEdit('${row.id}')">✏️ Edit</button>
                  <button class="btn btn-danger btn-xs" onclick="TargetModule.confirmDelete('${row.id}')">🗑️</button>
                ` : '—'}
              </div>
            </td>
          </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('target-pagination'), pager, p => { state.page = p; render(); });
  }

  // ── Render Penyadap ─────────────────────────────────────────
  async function renderPenyadap() {
    const perm = getPermissions();
    const tbody = document.getElementById('target-tbody');
    const thead = document.getElementById('target-thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr><th style="width:50px">No</th><th>Penyadap</th><th>Petak</th><th>Luas (Ha)</th><th>Pohon (Sadap)</th><th>Target Petak (Kg)</th><th>Target Penyadap (Kg)</th></tr>`;

    const user = window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : null;

    const allPenyadap = await window.db.getAllActive('penyadap_master');
    const allAP = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const allPgn = await window.db.getAllActive('penugasan');
    const targetList = (await window.db.getAllActive('target_penyadap')).filter(x => x.tahun === state.tahun);
    const apTargetList = (await window.db.getAllActive('target_anak_petak')).filter(x => x.tahun === state.tahun);

    const activePenugasan = allPgn.filter(pg => pg.aktif === 1);
    
    let assignedPgn = activePenugasan;
    if (perm.isMandor && scope) {
      if (role === 'mandor') {
        assignedPgn = activePenugasan.filter(pg => {
          const ap = allAP.find(a => a.id === pg.anak_petak_id);
          const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
          return petak && petak.mandor_id === user.id;
        });
      } else {
        const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
        assignedPgn = activePenugasan.filter(pg => apIds.includes(pg.anak_petak_id));
      }
    }

    let displayRows = [];
    assignedPgn.forEach(pg => {
      const psy = allPenyadap.find(p => p.id === pg.penyadap_id);
      const ap = allAP.find(a => a.id === pg.anak_petak_id);
      const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
      
      if (!psy || !ap) return;
      
      const targetRecord = targetList.find(t => t.penyadap_id === pg.penyadap_id && t.anak_petak_id === pg.anak_petak_id);
      const apTargetRecord = apTargetList.find(t => t.anak_petak_id === pg.anak_petak_id);
      const targetPetakVal = apTargetRecord ? (apTargetRecord.target_kg || 0) : 0;
      
      displayRows.push({
        id: targetRecord ? targetRecord.id : `new-${pg.penyadap_id}-${pg.anak_petak_id}`,
        penyadap_id: pg.penyadap_id,
        anak_petak_id: pg.anak_petak_id,
        psy,
        ap,
        petak,
        target_petak: targetPetakVal,
        luas_ha: targetRecord ? targetRecord.luas_ha : (ap.luas_ha || 0),
        pohon: targetRecord ? targetRecord.pohon : (pg.jumlah_pohon || ap.jumlah_pohon || 0),
        target_kg: targetRecord ? (targetRecord.target_kg || 0) : 0
      });
    });

    if (state.search) {
      const q = state.search.toLowerCase();
      displayRows = displayRows.filter(r => r.psy.nama.toLowerCase().includes(q));
    }

    // Sort displayRows by custom petak order -> Penyadap name
    displayRows.sort((a, b) => {
      const petakLabelA = a.petak && a.ap ? `Petak ${a.petak.nomor}${a.ap.huruf}` : '';
      const petakLabelB = b.petak && b.ap ? `Petak ${b.petak.nomor}${b.ap.huruf}` : '';
      
      const idxA = getCustomSortIndex(petakLabelA);
      const idxB = getCustomSortIndex(petakLabelB);
      if (idxA !== idxB) return idxA - idxB;
      
      const nameA = a.psy ? a.psy.nama : '';
      const nameB = b.psy ? b.psy.nama : '';
      return nameA.localeCompare(nameB);
    });

    // Quota Tracker calculation for Mandor / TPG
    let trackerHtml = '';
    let targetTpgVal = 0;
    if (perm.isMandor && scope) {
      let titleLabel = '';
      let allocatedVal = 0;

      if (role === 'mandor') {
        titleLabel = 'Target Mandor Anda';
        const allMandorTargets = await window.db.getAllActive('target_mandor');
        const matching = allMandorTargets.find(t => t.tahun === state.tahun && t.mandor_id === user.id);
        targetTpgVal = matching ? (matching.target_kg || 0) : 0;

        const myApIds = allAP.filter(ap => {
          const petak = allPetak.find(p => p.id === ap.petak_id);
          return petak && petak.mandor_id === user.id;
        }).map(ap => ap.id);

        allocatedVal = targetList
          .filter(t => myApIds.includes(t.anak_petak_id))
          .reduce((sum, t) => sum + (t.target_kg || 0), 0);
      } else {
        titleLabel = 'Target TPG Anda';
        const allTpgTargets = await window.db.getAllActive('target_tpg');
        const matching = allTpgTargets.find(t => t.tahun === state.tahun && t.tpg_id === scope);
        targetTpgVal = matching ? (matching.target_kg || 0) : 0;

        const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
        allocatedVal = targetList
          .filter(t => apIds.includes(t.anak_petak_id))
          .reduce((sum, t) => sum + (t.target_kg || 0), 0);
      }
        
      const remaining = Math.max(0, targetTpgVal - allocatedVal);
      const pct = targetTpgVal > 0 ? Math.min(100, Math.round((allocatedVal / targetTpgVal) * 100)) : 0;
      
      trackerHtml = `
        <div class="card" style="margin-bottom:1.5rem;padding:1.25rem;background:var(--bg-surface-elevated);border-left:4px solid var(--primary);border-radius:var(--radius-md);">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:1.5rem;margin-bottom:0.75rem;">
            <div>
              <span style="font-size:.78rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">🎯 ${titleLabel}</span>
              <div style="font-size:1.3rem;font-weight:700;color:var(--text-primary);margin-top:.25rem;">${targetTpgVal.toLocaleString('id-ID')} kg</div>
            </div>
            <div style="text-align:right;margin-left:auto;">
              <span style="font-size:.78rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Alokasi Penyadap</span>
              <div style="font-size:1.3rem;font-weight:700;color:var(--primary);margin-top:.25rem;"><span id="tracker-allocated">${allocatedVal.toLocaleString('id-ID')}</span> kg (${pct}%)</div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:.78rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Sisa Kuota</span>
              <div style="font-size:1.3rem;font-weight:700;color:${remaining > 0 ? 'var(--warning)' : 'var(--text-secondary)'};margin-top:.25rem;"><span id="tracker-remaining">${remaining.toLocaleString('id-ID')}</span> kg</div>
            </div>
          </div>
          <div class="progress-bar-container" style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;">
            <div id="tracker-bar" class="progress-bar-fill" style="width:${pct}%;height:100%;background:var(--primary);transition:width .3s ease;"></div>
          </div>
        </div>
      `;
    }

    let trackerContainer = document.getElementById('target-quota-tracker-container');
    if (!trackerContainer) {
      trackerContainer = document.createElement('div');
      trackerContainer.id = 'target-quota-tracker-container';
      const area = document.getElementById('target-indicator-bar');
      if (area) area.after(trackerContainer);
    }
    trackerContainer.innerHTML = trackerHtml;

    if (displayRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Tidak ada penyadap aktif di penugasan</td></tr>`;
      U().renderPagination(document.getElementById('target-pagination'), { total: 0, page: 1, totalPages: 1 }, null);
      return;
    }

    tbody.innerHTML = displayRows.map((row, idx) => {
      const label = row.petak && row.ap ? `Petak ${row.petak.nomor}${row.ap.huruf}` : '—';
      const inputEl = perm.write ? `
        <input type="number" class="form-control target-input-val" style="width:120px;display:inline-block;margin:0;"
          data-id="${row.id}"
          data-pnd="${row.penyadap_id}"
          data-ap="${row.anak_petak_id}"
          data-luas="${row.luas_ha}"
          data-pohon="${row.pohon}"
          value="${row.target_kg || ''}"
          placeholder="0"
          oninput="TargetModule.updateInlineTotal(${targetTpgVal})">
      ` : `<strong>${(row.target_kg || 0).toLocaleString('id-ID')} kg</strong>`;

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${row.psy.nama}</strong>
            <div class="text-muted-sm">${row.psy.nomor}</div>
          </td>
          <td>${label}</td>
          <td>${row.luas_ha || 0} ha</td>
          <td>${(row.pohon || 0).toLocaleString('id-ID')} pohon</td>
          <td><strong>${(row.target_petak || 0).toLocaleString('id-ID')} kg</strong></td>
          <td>${inputEl}</td>
        </tr>
      `;
    }).join('');

    const currentSum = displayRows.reduce((sum, r) => sum + r.target_kg, 0);
    const sumHtml = `
      <tr style="background:rgba(255,255,255,.02);font-weight:bold;">
        <td colspan="6" style="text-align:right;padding-right:1rem;">TOTAL TARGET ALOKASI:</td>
        <td><span id="inline-allocated-total">${currentSum.toLocaleString('id-ID')}</span> kg</td>
      </tr>
    `;
    tbody.insertAdjacentHTML('beforeend', sumHtml);

    let saveBtnContainer = document.getElementById('target-save-all-container');
    if (!saveBtnContainer) {
      saveBtnContainer = document.createElement('div');
      saveBtnContainer.id = 'target-save-all-container';
      saveBtnContainer.style.marginTop = '1rem';
      saveBtnContainer.style.textAlign = 'right';
      const pager = document.getElementById('target-pagination');
      if (pager) pager.after(saveBtnContainer);
    }
    
    saveBtnContainer.innerHTML = perm.write ? `
      <button class="btn btn-primary" onclick="TargetModule.saveAllPenyadap()">💾 Simpan Semua Target</button>
    ` : '';

    U().renderPagination(document.getElementById('target-pagination'), { total: displayRows.length, page: 1, totalPages: 1 }, null);
  }

  // ── Dropdown Select Loaders ──────────────────────────────────
  async function _loadEntitiesSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    if (state.subTab === 'rph') {
      const all = await window.db.getAllActive('rph');
      sel.innerHTML = `<option value="">— Pilih RPH —</option>` +
        all.map(r => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${r.nama} (${r.kode})</option>`).join('');
    } else if (state.subTab === 'tpg') {
      const all = await window.db.getAllActive('tpg');
      sel.innerHTML = `<option value="">— Pilih TPG —</option>` +
        all.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.nama} (${t.kode})</option>`).join('');
    } else if (state.subTab === 'mandor') {
      const all = await window.db.getAllActive('users');
      const mandors = all.filter(u => u.role === 'mandor' || u.role === 'tpg');
      sel.innerHTML = `<option value="">— Pilih Mandor —</option>` +
        mandors.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.nama_lengkap} (Scope: ${m.scope || '—'})</option>`).join('');
    }
  }

  async function _loadPenyadapSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const all = await window.db.getAllActive('penyadap_master');
    sel.innerHTML = `<option value="">— Pilih Penyadap —</option>` +
      all.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nomor} — ${p.nama}</option>`).join('');
  }

  async function _loadAnakPetakSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    
    const allAP    = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    
    // Jika Mandor yang input, batasi anak petak hanya yang ada di scope TPG Mandor tersebut
    const role = window.app.currentUser.role;
    const scope = window.app.currentUser.scope;
    let filteredAP = allAP;
    if ((role === 'mandor' || role === 'tpg') && scope) {
      filteredAP = allAP.filter(ap => ap.tpg_id === scope);
    }

    sel.innerHTML = `<option value="">— Pilih Petak —</option>` +
      filteredAP.map(ap => {
        const p = allPetak.find(x => x.id === ap.petak_id);
        const label = p ? `Petak ${p.nomor} (${ap.luas_ha || 0} ha)` : ap.huruf;
        return `<option value="${ap.id}" ${ap.id === selectedId ? 'selected' : ''}>${label}</option>`;
      }).join('');
  }

  // ── Open Modals ─────────────────────────────────────────────
  async function openAdd() {
    const form = document.getElementById('target-modal-form');
    if (form) form.reset();
    document.getElementById('target-item-id').value = '';
    document.getElementById('target-tahun').value = state.tahun;
    
    const elPohon = document.getElementById('target-pohon');
    if (elPohon) elPohon.value = '';

    const generalGroup = document.getElementById('target-general-group');
    const penyadapGroup = document.getElementById('target-penyadap-group');

    if (state.subTab === 'bkph') {
      generalGroup.style.display = 'block';
      penyadapGroup.style.display = 'none';
      document.getElementById('target-entity-label').style.display = 'none';
      document.getElementById('target-entity-select').style.display = 'none';
      document.getElementById('target-entity-select').required = false;
      document.getElementById('target-modal-title').textContent = 'Tambah Target BKPH';
    } else if (state.subTab === 'penyadap') {
      generalGroup.style.display = 'none';
      penyadapGroup.style.display = 'block';
      document.getElementById('target-modal-title').textContent = 'Tambah Target Penyadap';
      await _loadPenyadapSelect('target-pnd-select');
      await _loadAnakPetakSelect('target-ap-select');
    } else {
      generalGroup.style.display = 'block';
      penyadapGroup.style.display = 'none';
      document.getElementById('target-entity-label').style.display = 'block';
      document.getElementById('target-entity-select').style.display = 'block';
      document.getElementById('target-entity-select').required = true;
      document.getElementById('target-entity-label').textContent = state.subTab.toUpperCase();
      document.getElementById('target-modal-title').textContent = `Tambah Target ${state.subTab.toUpperCase()}`;
      await _loadEntitiesSelect('target-entity-select');
    }

    U().openModal('target-modal');
  }

  async function openEdit(id) {
    const storeName = `target_${state.subTab}`;
    const row = await window.db.get(storeName, id);
    if (!row) return;

    const form = document.getElementById('target-modal-form');
    if (form) form.reset();
    document.getElementById('target-item-id').value = row.id;
    document.getElementById('target-tahun').value = row.tahun;

    const generalGroup = document.getElementById('target-general-group');
    const penyadapGroup = document.getElementById('target-penyadap-group');

    if (state.subTab === 'bkph') {
      generalGroup.style.display = 'block';
      penyadapGroup.style.display = 'none';
      document.getElementById('target-entity-label').style.display = 'none';
      document.getElementById('target-entity-select').style.display = 'none';
      document.getElementById('target-entity-select').required = false;
      document.getElementById('target-val-kg').value = row.target_kg;
      document.getElementById('target-modal-title').textContent = 'Edit Target BKPH';
    } else if (state.subTab === 'penyadap') {
      generalGroup.style.display = 'none';
      penyadapGroup.style.display = 'block';
      document.getElementById('target-modal-title').textContent = 'Edit Target Penyadap';
      await _loadPenyadapSelect('target-pnd-select', row.penyadap_id);
      await _loadAnakPetakSelect('target-ap-select', row.anak_petak_id);
      document.getElementById('target-luas-ha').value = row.luas_ha;
      document.getElementById('target-pohon').value = row.pohon || '';
      document.getElementById('target-pnd-val-kg').value = row.target_kg;
    } else {
      generalGroup.style.display = 'block';
      penyadapGroup.style.display = 'none';
      document.getElementById('target-entity-label').style.display = 'block';
      document.getElementById('target-entity-select').style.display = 'block';
      document.getElementById('target-entity-select').required = true;
      document.getElementById('target-entity-label').textContent = state.subTab.toUpperCase();
      document.getElementById('target-val-kg').value = row.target_kg;
      document.getElementById('target-modal-title').textContent = `Edit Target ${state.subTab.toUpperCase()}`;

      const selectedEntityId = row.rph_id || row.tpg_id || row.mandor_id;
      await _loadEntitiesSelect('target-entity-select', selectedEntityId);
    }

    U().openModal('target-modal');
  }

  // ── Save Target ──────────────────────────────────────────────
  async function save(e) {
    e.preventDefault();
    const id = document.getElementById('target-item-id').value || U().uuid();
    const tahun = parseInt(document.getElementById('target-tahun').value);
    const storeName = `target_${state.subTab}`;
    const existing = await window.db.get(storeName, id);

    let record = { id, tahun };

    if (state.subTab === 'bkph') {
      record.target_kg = parseFloat(document.getElementById('target-val-kg').value) || 0;
      
      // BKPH Hanya ada 1 record target per tahun
      const allBkph = await window.db.getAllActive('target_bkph');
      const dup = allBkph.find(x => x.tahun === tahun && x.id !== id);
      if (dup) {
        U().showToast(`Target BKPH tahun ${tahun} sudah diinput`, 'danger');
        return;
      }
    } else if (state.subTab === 'penyadap') {
      const penyadap_id = document.getElementById('target-pnd-select').value;
      const anak_petak_id = document.getElementById('target-ap-select').value;
      const luas_ha = parseFloat(document.getElementById('target-luas-ha').value) || 0;
      const pohon = parseInt(document.getElementById('target-pohon').value) || 0;
      const target_kg = parseFloat(document.getElementById('target-pnd-val-kg').value) || 0;

      if (!penyadap_id) { U().showToast('Pilih Penyadap terlebih dahulu', 'danger'); return; }
      if (!anak_petak_id) { U().showToast('Pilih Anak Petak terlebih dahulu', 'danger'); return; }

      // Cek duplikat Penyadap-Anak Petak pada tahun yang sama
      const allPnd = await window.db.getAllActive('target_penyadap');
      const dup = allPnd.find(x => x.tahun === tahun && x.penyadap_id === penyadap_id && x.anak_petak_id === anak_petak_id && x.id !== id);
      if (dup) {
        U().showToast('Penyadap sudah memiliki target di Anak Petak ini pada tahun yang sama', 'danger');
        return;
      }

      record = {
        ...record,
        penyadap_id,
        anak_petak_id,
        luas_ha,
        pohon,
        target_kg
      };
    } else {
      const entityId = document.getElementById('target-entity-select').value;
      if (!entityId) { U().showToast(`Pilih ${state.subTab.toUpperCase()} terlebih dahulu`, 'danger'); return; }

      const target_kg = parseFloat(document.getElementById('target-val-kg').value) || 0;
      record.target_kg = target_kg;

      if (state.subTab === 'rph') {
        record.rph_id = entityId;
        const all = await window.db.getAllActive('target_rph');
        if (all.find(x => x.tahun === tahun && x.rph_id === entityId && x.id !== id)) {
          U().showToast('Target RPH ini sudah diinput pada tahun yang sama', 'danger'); return;
        }
      } else if (state.subTab === 'tpg') {
        record.tpg_id = entityId;
        const all = await window.db.getAllActive('target_tpg');
        if (all.find(x => x.tahun === tahun && x.tpg_id === entityId && x.id !== id)) {
          U().showToast('Target TPG ini sudah diinput pada tahun yang sama', 'danger'); return;
        }
      } else if (state.subTab === 'mandor') {
        record.mandor_id = entityId;
        const all = await window.db.getAllActive('target_mandor');
        if (all.find(x => x.tahun === tahun && x.mandor_id === entityId && x.id !== id)) {
          U().showToast('Target Mandor ini sudah diinput pada tahun yang sama', 'danger'); return;
        }
      }
    }

    // Tambah audit trail
    record = {
      ...record,
      ...U().makeAudit(U().currentActorId(), existing)
    };

    try {
      await window.db.put(storeName, record);
      await window.db.queueSync(storeName, existing ? 'update' : 'create', record);
      U().closeModal('target-modal');
      U().showToast(existing ? 'Target berhasil diperbarui' : 'Target berhasil ditambahkan', 'success');
      state.page = 1;
      await render();
    } catch (e) {
      U().showToast('Gagal menyimpan target: ' + e.message, 'danger');
    }
  }

  // ── Hapus Target (Soft Delete) ────────────────────────────────
  async function confirmDelete(id) {
    const storeName = `target_${state.subTab}`;
    if (!confirm('Apakah Anda yakin ingin menghapus data target ini?')) return;

    try {
      await window.db.softDelete(storeName, id, U().currentActorId());
      U().showToast('Target berhasil dihapus (soft delete)', 'success');
      state.page = 1;
      await render();
    } catch (e) {
      U().showToast('Gagal menghapus: ' + e.message, 'danger');
    }
  }

  // ── Pencarian ────────────────────────────────────────────────
  function onSearch(val) {
    state.search = val;
    state.page = 1;
    render();
  }

  // ── Ekspor Excel ─────────────────────────────────────────────
  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }

    const t = state.tahun;
    const storeName = `target_${state.subTab}`;
    const list = (await window.db.getAllActive(storeName)).filter(x => x.tahun === t);

    let rows = [];
    if (state.subTab === 'bkph') {
      rows = list.map(r => ({ Tahun: r.tahun, BKPH: 'BKPH Bantarkawung', 'Target (Kg)': r.target_kg }));
    } else if (state.subTab === 'rph') {
      const allRph = await window.db.getAllActive('rph');
      rows = list.map(r => {
        const item = allRph.find(x => x.id === r.rph_id);
        return { Tahun: r.tahun, RPH: item ? item.nama : r.rph_id, 'Target (Kg)': r.target_kg };
      });
    } else if (state.subTab === 'tpg') {
      const allTpg = await window.db.getAllActive('tpg');
      rows = list.map(r => {
        const item = allTpg.find(x => x.id === r.tpg_id);
        return { Tahun: r.tahun, TPG: item ? item.nama : r.tpg_id, 'Target (Kg)': r.target_kg };
      });
    } else if (state.subTab === 'mandor') {
      const allUsers = await window.db.getAllActive('users');
      rows = list.map(r => {
        const item = allUsers.find(x => x.id === r.mandor_id);
        return { Tahun: r.tahun, Mandor: item ? item.nama_lengkap : r.mandor_id, 'Target (Kg)': r.target_kg };
      });
    } else if (state.subTab === 'penyadap') {
      const allPenyadap = await window.db.getAllActive('penyadap_master');
      const allAP = await window.db.getAllActive('anak_petak');
      const allPetak = await window.db.getAllActive('petak');
      rows = list.map(r => {
        const psy = allPenyadap.find(x => x.id === r.penyadap_id);
        const ap = allAP.find(x => x.id === r.anak_petak_id);
        const p = ap ? allPetak.find(x => x.id === ap.petak_id) : null;
        return {
          Tahun: r.tahun,
          Penyadap: psy ? psy.nama : r.penyadap_id,
          'No Penyadap': psy ? psy.nomor : '',
          'Anak Petak': p && ap ? `Petak ${p.nomor}${ap.huruf}` : r.anak_petak_id,
          'Luas (Ha)': r.luas_ha || 0,
          'Target (Kg)': r.target_kg
        };
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Target ${state.subTab.toUpperCase()}`);
    XLSX.writeFile(wb, `Target_${state.subTab.toUpperCase()}_${t}.xlsx`);
    U().showToast('Export Excel berhasil', 'success');
  }

  // ── Hitung Progress Kelengkapan Untuk Dashboard ─────────────
  async function getTargetKelengkapan(tahun) {
    const t = parseInt(tahun) || 2026;
    
    const bkphList = (await window.db.getAllActive('target_bkph')).filter(x => x.tahun === t);
    const rphList  = (await window.db.getAllActive('target_rph')).filter(x => x.tahun === t);
    const tpgList  = (await window.db.getAllActive('target_tpg')).filter(x => x.tahun === t);
    const mdrList  = (await window.db.getAllActive('target_mandor')).filter(x => x.tahun === t);
    const pndList  = (await window.db.getAllActive('target_penyadap')).filter(x => x.tahun === t);

    const sumBkph = bkphList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumRph  = rphList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumTpg  = tpgList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumMdr  = mdrList.reduce((s, x) => s + (x.target_kg || 0), 0);
    const sumPnd  = pndList.reduce((s, x) => s + (x.target_kg || 0), 0);

    const matchSymbol = (lower, upper) => {
      if (upper === 0) return '🟡 Belum Lengkap';
      if (lower === upper) return 'Sesuai ✔';
      if (lower < upper) return 'Belum Lengkap 🟡';
      return 'Tidak Sesuai 🔴';
    };

    const pndPercent = sumMdr > 0 ? Math.min(100, Math.round((sumPnd / sumMdr) * 100)) : 0;

    return {
      bkph: sumBkph > 0 ? 'Sesuai ✔' : '🟡 Belum Lengkap',
      rph: matchSymbol(sumRph, sumBkph),
      tpg: matchSymbol(sumTpg, sumRph),
      mandor: matchSymbol(sumMdr, sumTpg),
      penyadap: `${pndPercent}%`
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  Rencana Operasional (RO) Management
  // ─────────────────────────────────────────────────────────────

  async function openAddRO() {
    document.getElementById('ro-modal-form').reset();
    document.getElementById('ro-id').value = '';
    document.getElementById('ro-modal-title').textContent = 'Susun RO Baru';
    
    // Set default values
    document.getElementById('ro-tahun').value = '2026';
    document.getElementById('ro-bulan').value = '7'; // Juli
    document.getElementById('ro-periode').value = '1';

    await _loadROPenyadaps();
    U().openModal('ro-modal');
  }

  async function _loadROPenyadaps(selectedPenyadapId = '') {
    const user = window.app.currentUser;
    const role = user ? user.role : '';
    const scopeTpgId = user ? user.scope : '';

    const allPnd = await window.db.getAllActive('penyadap_master');
    const allPgn = await window.db.getAllActive('penugasan');
    const allAP = await window.db.getAllActive('anak_petak');

    let filteredPnd = allPnd;

    if (role === 'mandor' || role === 'tpg') {
      if (scopeTpgId) {
        // Ambil penyadap yang ditugaskan di anak petak di bawah TPG mandor
        const apIds = allAP.filter(ap => ap.tpg_id === scopeTpgId).map(ap => ap.id);
        const pndIds = allPgn.filter(pg => apIds.includes(pg.anak_petak_id) && pg.aktif === 1).map(pg => pg.penyadap_id);
        filteredPnd = allPnd.filter(p => pndIds.includes(p.id));
      }
    }

    const sel = document.getElementById('ro-penyadap');
    if (!sel) return;

    if (filteredPnd.length === 0) {
      sel.innerHTML = '<option value="">— Tidak ada penyadap aktif di wilayah Anda —</option>';
    } else {
      sel.innerHTML = '<option value="">— Pilih Penyadap —</option>' +
        filteredPnd.map(p => `<option value="${p.id}" ${p.id === selectedPenyadapId ? 'selected' : ''}>${p.nama} (${p.nomor})</option>`).join('');
    }

    // Clear areal select
    const arealSel = document.getElementById('ro-areal');
    if (arealSel) arealSel.innerHTML = '<option value="">— Pilih Petak —</option>';
  }

  async function onROPenyadapChange(penyadapId, selectedArealId = '') {
    const arealSel = document.getElementById('ro-areal');
    if (!arealSel) return;

    if (!penyadapId) {
      arealSel.innerHTML = '<option value="">— Pilih Petak —</option>';
      return;
    }

    const allPgn = await window.db.getAllActive('penugasan');
    const allAP = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');

    // Dapatkan anak petak tempat penyadap ditugaskan
    const apIds = allPgn.filter(pg => pg.penyadap_id === penyadapId && pg.aktif === 1).map(pg => pg.anak_petak_id);
    const assignedAPs = allAP.filter(ap => apIds.includes(ap.id));

    if (assignedAPs.length === 0) {
      arealSel.innerHTML = '<option value="">— Penyadap belum ditugaskan ke petak —</option>';
    } else {
      arealSel.innerHTML = '<option value="">— Pilih Petak —</option>' +
        assignedAPs.map(ap => {
          const petak = allPetak.find(p => p.id === ap.petak_id);
          const label = petak ? `Petak ${petak.nomor}` : ap.huruf;
          return `<option value="${ap.id}" ${ap.id === selectedArealId ? 'selected' : ''}>${label}</option>`;
        }).join('');
    }
  }

  async function openEditRO(roId) {
    const ro = await window.db.get('ro', roId);
    if (!ro) { U().showToast('Data RO tidak ditemukan', 'danger'); return; }

    document.getElementById('ro-id').value = ro.id;
    document.getElementById('ro-tahun').value = ro.tahun;
    document.getElementById('ro-bulan').value = ro.bulan;
    document.getElementById('ro-periode').value = ro.periode;
    document.getElementById('ro-kesanggupan').value = ro.kesanggupan;
    document.getElementById('ro-modal-title').textContent = 'Edit Rencana Operasional (RO)';

    await _loadROPenyadaps(ro.penyadap_id);
    await onROPenyadapChange(ro.penyadap_id, ro.areal_id);

    U().openModal('ro-modal');
  }

  async function saveRO(e) {
    e.preventDefault();
    const id = document.getElementById('ro-id').value || U().uuid();
    const existing = await window.db.get('ro', id);

    const tahun = parseInt(document.getElementById('ro-tahun').value);
    const bulan = parseInt(document.getElementById('ro-bulan').value);
    const periode = parseInt(document.getElementById('ro-periode').value);
    const penyadap_id = document.getElementById('ro-penyadap').value;
    const areal_id = document.getElementById('ro-areal').value;
    const kesanggupan = parseInt(document.getElementById('ro-kesanggupan').value);

    if (!penyadap_id || !areal_id || !kesanggupan) {
      U().showToast('Semua field wajib diisi', 'danger');
      return;
    }

    // Validasi: 1 penyadap hanya boleh punya 1 RO per areal, tahun, bulan, periode
    const allROs = await window.db.getAllActive('ro');
    const dup = allROs.find(r => 
      r.penyadap_id === penyadap_id && 
      r.areal_id === areal_id && 
      r.tahun === tahun && 
      r.bulan === bulan && 
      r.periode === periode && 
      r.id !== id
    );

    if (dup) {
      U().showToast('Rencana Operasional (RO) penyadap untuk periode ini sudah terdaftar!', 'danger');
      return;
    }

    const record = {
      id,
      penyadap_id,
      areal_id,
      tahun,
      bulan,
      periode,
      kesanggupan,
      status: 'disetujui', // Auto-approved local
      sync_status: 'local',
      ...U().makeAudit(U().currentActorId(), existing)
    };

    await window.db.put('ro', record);
    await window.db.queueSync('ro', existing ? 'update' : 'create', record);

    U().closeModal('ro-modal');
    U().showToast(existing ? 'RO berhasil diperbarui' : 'RO berhasil ditambahkan');
    
    // Refresh RO table & dashboard
    if (window.app) {
      await window.app.loadTargetROData();
      await window.app.loadDashboardData();
    }
  }

  async function confirmDeleteRO(roId) {
    if (!confirm('Apakah Anda yakin ingin menghapus Rencana Operasional (RO) ini?')) return;
    
    await window.db.softDelete('ro', roId, U().currentActorId());
    await window.db.queueSync('ro', 'delete', { id: roId });
    U().showToast('RO berhasil dihapus');
    
    // Refresh RO table & dashboard
    if (window.app) {
      await window.app.loadTargetROData();
      await window.app.loadDashboardData();
    }
  }

  async function onAnakPetakChange(apId) {
    if (!apId) return;
    const ap = await window.db.get('anak_petak', apId);
    if (ap) {
      const elLuas = document.getElementById('target-luas-ha');
      const elPohon = document.getElementById('target-pohon');
      if (elLuas) elLuas.value = ap.luas_ha || '';
      if (elPohon) elPohon.value = ap.jumlah_pohon || '';
    }
  }

  // ── Final Target Mass Import & Inline Edit Methods ───────────
  async function downloadSingleSheetTemplate() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const tahun = state.tahun;
    const allRph = await window.db.getAllActive('rph');
    const allTpg = await window.db.getAllActive('tpg');
    const allPetak = await window.db.getAllActive('petak');
    const allAP = await window.db.getAllActive('anak_petak');

    const wb = XLSX.utils.book_new();

    const headers = ['Tahun', 'RPH', 'TPG', 'Petak', 'ID Anak Petak', 'Target (Kg)'];

    // Map data first to include RPH and TPG names for sorting
    const mappedAP = allAP.map(ap => {
      const petak = allPetak.find(p => p.id === ap.petak_id);
      const tpg = allTpg.find(t => t.id === (ap.tpg_id || (petak ? petak.tpg_id : null)));
      const rph = allRph.find(r => r.id === (tpg ? tpg.rph_id : (petak ? petak.rph_id : null)));
      const petakLabel = petak ? `Petak ${petak.nomor}${ap.huruf}` : ap.huruf;

      return {
        rphName: rph ? rph.nama : '',
        tpgName: tpg ? tpg.nama : '',
        petakLabel: petakLabel,
        apId: ap.id
      };
    });

    // Sort by user's custom order
    mappedAP.sort((a, b) => {
      const idxA = getCustomSortIndex(a.petakLabel);
      const idxB = getCustomSortIndex(b.petakLabel);
      if (idxA !== idxB) return idxA - idxB;
      return a.petakLabel.localeCompare(b.petakLabel, undefined, { numeric: true, sensitivity: 'base' });
    });

    const rows = [headers].concat(
      mappedAP.map(item => [
        tahun,
        item.rphName,
        item.tpgName,
        item.petakLabel,
        item.apId,
        ''
      ])
    );

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 }, // Tahun
      { wch: 20 }, // RPH
      { wch: 20 }, // TPG
      { wch: 15 }, // Petak
      { wch: 30 }, // ID Anak Petak
      { wch: 15 }  // Target (Kg)
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Target Petak');
    XLSX.writeFile(wb, `Template_Target_Petak_${tahun}.xlsx`);
    U().showToast(`Template Target Petak ${tahun} berhasil diunduh`);
  }

  async function importSingleSheetFile(file) {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    if (!file) return;

    U().hideImportErrors('target-import-errors');

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (rows.length === 0) {
      U().showToast('File Excel kosong atau tidak ada data', 'danger');
      return;
    }

    const errors = [];
    const actor = U().currentActorId();
    const year = state.tahun;

    // Load references
    const allAP = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const allTpg = await window.db.getAllActive('tpg');
    const allRph = await window.db.getAllActive('rph');
    const allUsers = await window.db.getAllActive('users');

    const targetAnakPetak = [];

    // Parse rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const id = String(row['ID Anak Petak'] || row['id_anak_petak'] || '').trim();
      const targetKg = parseFloat(row['Target (Kg)'] || row['target_kg'] || 0);

      if (!id) {
        errors.push({ row: rowNum, sheet: 'Target Petak', message: 'ID Anak Petak wajib diisi' });
        continue;
      }

      const ap = allAP.find(a => a.id === id);
      if (!ap) {
        errors.push({ row: rowNum, sheet: 'Target Petak', message: `ID Anak Petak "${id}" tidak terdaftar di sistem` });
        continue;
      }

      if (targetKg < 0) {
        errors.push({ row: rowNum, sheet: 'Target Petak', message: 'Target tidak boleh kurang dari 0' });
        continue;
      }

      targetAnakPetak.push({
        id: U().uuid(),
        tahun: year,
        anak_petak_id: ap.id,
        target_kg: targetKg,
        ...U().makeAudit(actor)
      });
    }

    if (errors.length > 0) {
      const errList = errors.map(e => `Baris ${e.row}: ${e.message}`);
      U().showImportErrors('target-import-errors', errList);
      U().showToast(`Impor dibatalkan. Ditemukan ${errors.length} kesalahan.`, 'danger');
      return;
    }

    // 1. Delete old target_anak_petak records for this year
    const oldAnakPetaks = (await window.db.getAllActive('target_anak_petak')).filter(x => x.tahun === year);
    for (const item of oldAnakPetaks) {
      await window.db.softDelete('target_anak_petak', item.id, actor);
    }

    // 2. Save new target_anak_petak records
    if (targetAnakPetak.length > 0) {
      await window.db.putMany('target_anak_petak', targetAnakPetak);
      for (const item of targetAnakPetak) {
        await window.db.queueSync('target_anak_petak', 'create', item);
      }
    }

    // 3. Compute Aggregations
    const sumBkph = targetAnakPetak.reduce((sum, item) => sum + item.target_kg, 0);

    const rphSums = {};
    const tpgSums = {};

    targetAnakPetak.forEach(item => {
      const ap = allAP.find(a => a.id === item.anak_petak_id);
      const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
      const tpg = allTpg.find(t => t.id === (ap.tpg_id || (petak ? petak.tpg_id : null)));
      const rph = allRph.find(r => r.id === (tpg ? tpg.rph_id : (petak ? petak.rph_id : null)));

      if (tpg) {
        tpgSums[tpg.id] = (tpgSums[tpg.id] || 0) + item.target_kg;
      }
      if (rph) {
        rphSums[rph.id] = (rphSums[rph.id] || 0) + item.target_kg;
      }
    });

    const mandorSums = {};
    targetAnakPetak.forEach(item => {
      const ap = allAP.find(a => a.id === item.anak_petak_id);
      const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
      if (petak && petak.mandor_id) {
        mandorSums[petak.mandor_id] = (mandorSums[petak.mandor_id] || 0) + item.target_kg;
      }
    });

    const targetBkph = [{
      id: U().uuid(),
      tahun: year,
      target_kg: sumBkph,
      ...U().makeAudit(actor)
    }];

    const targetRph = Object.keys(rphSums).map(rphId => ({
      id: U().uuid(),
      tahun: year,
      rph_id: rphId,
      target_kg: rphSums[rphId],
      ...U().makeAudit(actor)
    }));

    const targetTpg = Object.keys(tpgSums).map(tpgId => ({
      id: U().uuid(),
      tahun: year,
      tpg_id: tpgId,
      target_kg: tpgSums[tpgId],
      ...U().makeAudit(actor)
    }));

    const targetMandor = Object.keys(mandorSums).map(mandorId => ({
      id: U().uuid(),
      tahun: year,
      mandor_id: mandorId,
      target_kg: mandorSums[mandorId],
      ...U().makeAudit(actor)
    }));

    // Clear old aggregated targets for this year
    const bkphs = (await window.db.getAllActive('target_bkph')).filter(x => x.tahun === year);
    const rphs = (await window.db.getAllActive('target_rph')).filter(x => x.tahun === year);
    const tpgs = (await window.db.getAllActive('target_tpg')).filter(x => x.tahun === year);
    const mandors = (await window.db.getAllActive('target_mandor')).filter(x => x.tahun === year);

    for (const t of bkphs) await window.db.softDelete('target_bkph', t.id, actor);
    for (const t of rphs) await window.db.softDelete('target_rph', t.id, actor);
    for (const t of tpgs) await window.db.softDelete('target_tpg', t.id, actor);
    for (const t of mandors) await window.db.softDelete('target_mandor', t.id, actor);

    // Save new records
    if (targetBkph.length > 0) await window.db.putMany('target_bkph', targetBkph);
    if (targetRph.length > 0) await window.db.putMany('target_rph', targetRph);
    if (targetTpg.length > 0) await window.db.putMany('target_tpg', targetTpg);
    if (targetMandor.length > 0) await window.db.putMany('target_mandor', targetMandor);

    // Queue sync
    for (const r of targetBkph) await window.db.queueSync('target_bkph', 'create', r);
    for (const r of targetRph) await window.db.queueSync('target_rph', 'create', r);
    for (const r of targetTpg) await window.db.queueSync('target_tpg', 'create', r);
    for (const r of targetMandor) await window.db.queueSync('target_mandor', 'create', r);

    U().showToast('Impor Target Petak dan Agregasi Berhasil!', 'success');
    render();
  }

  function handleTemplateClick() {
    const perm = getPermissions();
    if (state.subTab === 'penyadap') {
      MasterImport.downloadTemplate('target_penyadap');
    } else if (!perm.isMandor) {
      downloadSingleSheetTemplate();
    } else {
      U().showToast('Anda tidak berwenang mengunduh template', 'danger');
    }
  }

  async function handleImportClick(file) {
    const perm = getPermissions();
    if (state.subTab === 'penyadap') {
      await MasterImport.importFile('target_penyadap', file, 'target-import-errors');
    } else if (!perm.isMandor) {
      await importSingleSheetFile(file);
    } else {
      U().showToast('Anda tidak berwenang mengimpor data', 'danger');
    }
  }

  function updateInlineTotal(targetTpgVal = 0) {
    const inputs = document.querySelectorAll('.target-input-val');
    let sum = 0;
    inputs.forEach(input => {
      sum += parseFloat(input.value) || 0;
    });

    const totalEl = document.getElementById('inline-allocated-total');
    if (totalEl) totalEl.textContent = sum.toLocaleString('id-ID');

    const allocatedEl = document.getElementById('tracker-allocated');
    const remainingEl = document.getElementById('tracker-remaining');
    const barEl = document.getElementById('tracker-bar');

    if (allocatedEl && remainingEl && barEl) {
      allocatedEl.textContent = sum.toLocaleString('id-ID');
      const rem = Math.max(0, targetTpgVal - sum);
      remainingEl.textContent = rem.toLocaleString('id-ID');
      const pct = targetTpgVal > 0 ? Math.min(100, Math.round((sum / targetTpgVal) * 100)) : 0;
      barEl.style.width = pct + '%';
      
      if (sum > targetTpgVal) {
        barEl.style.backgroundColor = 'var(--danger)';
      } else {
        barEl.style.backgroundColor = 'var(--primary)';
      }
    }
  }

  async function saveAllPenyadap() {
    const inputs = document.querySelectorAll('.target-input-val');
    const actor = U().currentActorId();
    const records = [];

    for (const input of inputs) {
      const id = input.getAttribute('data-id');
      const penyadap_id = input.getAttribute('data-pnd');
      const anak_petak_id = input.getAttribute('data-ap');
      const luas_ha = parseFloat(input.getAttribute('data-luas')) || 0;
      const pohon = parseInt(input.getAttribute('data-pohon')) || 0;
      const target_kg = parseFloat(input.value) || 0;

      const recordId = id.startsWith('new-') ? U().uuid() : id;
      const existing = await window.db.get('target_penyadap', recordId);

      const record = {
        id: recordId,
        tahun: state.tahun,
        penyadap_id,
        anak_petak_id,
        luas_ha,
        pohon,
        target_kg,
        ...U().makeAudit(actor, existing)
      };

      records.push(record);
    }

    try {
      if (records.length > 0) {
        await window.db.putMany('target_penyadap', records);
        for (const r of records) {
          await window.db.queueSync('target_penyadap', 'create', r);
        }
      }
      U().showToast('Semua target penyadap berhasil disimpan!', 'success');
      await render();
      if (window.app) window.app.loadDashboardData();
    } catch (e) {
      U().showToast('Gagal menyimpan target: ' + e.message, 'danger');
    }
  }

  return {
    init,
    state,
    switchSubTab,
    changeTahun,
    openAdd,
    openEdit,
    save,
    confirmDelete,
    onSearch,
    exportExcel,
    getTargetKelengkapan,
    getPermissions,
    onAnakPetakChange,
    
    // final custom target inline methods
    handleTemplateClick,
    handleImportClick,
    updateInlineTotal,
    saveAllPenyadap,

    // RO exports
    openAddRO,
    onROPenyadapChange,
    openEditRO,
    saveRO,
    confirmDeleteRO
  };
})();

window.TargetModule = TargetModule;
