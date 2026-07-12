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
    const list        = (await window.db.getAllActive('target_penyadap')).filter(x => x.tahun === state.tahun);
    const allPenyadap = await window.db.getAllActive('penyadap_master');
    const allAP       = await window.db.getAllActive('anak_petak');
    const allPetak    = await window.db.getAllActive('petak');
    const tbody       = document.getElementById('target-tbody');
    const thead       = document.getElementById('target-thead');
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr><th style="width:50px">No</th><th>Tahun</th><th>Penyadap</th><th>Petak</th><th>Luas (Ha)</th><th>Pohon (Sadap)</th><th>Target (Kg)</th><th>Aksi</th></tr>`;

    // Filter berdasarkan wilayah kerja Mandor jika user adalah Mandor
    const perm = getPermissions();
    const role = window.app.currentUser.role;
    const scope = window.app.currentUser.scope; // TPG ID untuk mandor
    let filtered = list;

    if (perm.isMandor && scope) {
      // Hanya tampilkan penyadap yang ditugaskan ke Anak Petak di bawah TPG mandor tersebut
      const apOfTpg = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
      filtered = list.filter(row => apOfTpg.includes(row.anak_petak_id));
    }

    if (state.search) {
      filtered = filtered.filter(row => {
        const psy = allPenyadap.find(p => p.id === row.penyadap_id);
        return psy && psy.nama.toLowerCase().includes(state.search.toLowerCase());
      });
    }

    const pager = U().paginate(filtered, state.page);
    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada target Penyadap tahun ${state.tahun}</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const psy   = allPenyadap.find(p => p.id === row.penyadap_id);
        const ap    = allAP.find(a => a.id === row.anak_petak_id);
        const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
        const label = petak && ap ? `Petak ${petak.nomor}${ap.huruf}` : '—';
        const rowNo = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;

        return  `
          <tr>
            <td>${rowNo}</td>
            <td><strong>${row.tahun}</strong></td>
            <td>
              <strong>${psy ? psy.nama : '—'}</strong>
              <div class="text-muted-sm">${psy ? psy.nomor : ''}</div>
            </td>
            <td>${label}</td>
            <td>${row.luas_ha || 0} ha</td>
            <td>${(row.pohon || 0).toLocaleString('id-ID')} pohon</td>
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

  return {
    init,
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
    
    // RO exports
    openAddRO,
    onROPenyadapChange,
    openEditRO,
    saveRO,
    confirmDeleteRO
  };
})();

window.TargetModule = TargetModule;
