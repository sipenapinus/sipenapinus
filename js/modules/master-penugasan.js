/**
 * SIPENA Lite — Master Penugasan Penyadap
 * Validasi: total % target per anak_petak tidak boleh > 100%
 */
'use strict';

const MasterPenugasan = (() => {
  const U = () => window.SipenaUtils;

  let state = { search: '', sortKey: 'tanggal_mulai', sortDir: 'desc', filterAktif: '', page: 1 };

  async function render() {
    const allPgn      = await window.db.getAllActive('penugasan');
    const allPenyadap = await window.db.getAllActive('penyadap_master');
    const allAP       = await window.db.getAllActive('anak_petak');
    const allPetak    = await window.db.getAllActive('petak');

    const user = window.app && window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : '';

    let data = allPgn;

    if ((role === 'mandor' || role === 'tpg') && scope) {
      const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
      data = data.filter(pg => apIds.includes(pg.anak_petak_id));
    }

    if (state.filterAktif !== '') {
      const v = parseInt(state.filterAktif);
      data = data.filter(r => r.aktif === v);
    }
    data = U().filterAndSort(data, state.search, ['keterangan'], state.sortKey, state.sortDir);

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('penugasan-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data Penugasan</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map(row => {
        const psy   = allPenyadap.find(p => p.id === row.penyadap_id);
        const ap    = allAP.find(a => a.id === row.anak_petak_id);
        const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
        const label = petak && ap ? `Petak ${petak.nomor}${ap.huruf}` : '—';
        const aktifBadge = row.aktif ? 'badge-success' : 'badge-inactive';
        const aktifLabel = row.aktif ? 'Aktif' : 'Selesai';
        return `<tr>
          <td>
            <strong>${psy ? psy.nama : '—'}</strong>
            <div class="text-muted-sm">${psy ? psy.nomor : ''}</div>
          </td>
          <td>${label}</td>
          <td><strong>${row.persen_target}%</strong></td>
          <td><strong>${(row.jumlah_pohon || 0).toLocaleString('id-ID')} pohon</strong></td>
          <td style="color:var(--text-secondary);max-width:160px">${row.keterangan || '—'}</td>
          <td><span class="badge ${aktifBadge}">${aktifLabel}</span></td>
          <td>
            <div class="action-btns">
              <button class="btn btn-secondary btn-xs" onclick="MasterPenugasan.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="MasterPenugasan.confirmDelete('${row.id}')">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('penugasan-pagination'), pager, p => { state.page = p; render(); });
  }

  async function _loadPenyadapSelect(selId, selectedId = '') {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const all = await window.db.getAllActive('penyadap_master');

    const user = window.app && window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : '';
    let filtered = all;

    if ((role === 'mandor' || role === 'tpg') && scope) {
      const allPgn = await window.db.getAllActive('penugasan');
      const allAP  = await window.db.getAllActive('anak_petak');
      const apIds  = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);

      // Penyadap yang sudah ditugaskan di wilayah ini
      const assignedInScope = allPgn.filter(pg => pg.aktif === 1 && apIds.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id);
      // Penyadap yang sudah ditugaskan di mana saja (di luar wilayah ini) - hanya hitung penugasan yang aktif
      const assignedElsewhere = new Set(
        allPgn.filter(pg => pg.aktif === 1 && pg.anak_petak_id && !apIds.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id)
      );

      // Cari tahu siapa saja user di TPG yang sama (agar tapper yang dibuat Mandor TPG bisa ditugaskan Mandor Sadap)
      const allUsers = await window.db.getAllActive('users');
      const usersInSameTpg = new Set(allUsers.filter(u => u.scope === scope).map(u => u.id));

      filtered = all.filter(p =>
        assignedInScope.includes(p.id) ||                         // sudah ditugaskan di wilayah mandor ini
        p.created_by === user.id  ||                               // dibuat oleh mandor ini
        usersInSameTpg.has(p.created_by) ||                        // dibuat oleh Mandor TPG di wilayah yang sama
        (!assignedElsewhere.has(p.id) && p.status === 'aktif')      // belum ditugaskan di wilayah lain & aktif
      );
    }

    sel.innerHTML = `<option value="">— Pilih Penyadap —</option>` +
      filtered.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nomor} — ${p.nama} (${p.status})</option>`).join('');
  }

  let cachedAnakPetak = [];

  function renderAnakPetakOptions(selectEl, selectedId = '', query = '') {
    const filtered = cachedAnakPetak.filter(item => {
      return item.label.toLowerCase().includes(query);
    });

    selectEl.innerHTML = `<option value="">— Pilih Petak —</option>` +
      filtered.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.label}</option>`).join('');
  }

  async function _loadAnakPetakSelect(selId, selectedId = '') {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const allAP    = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    
    // Filter berdasarkan wilayah kerja Mandor jika user adalah Mandor/TPG
    const user = window.app && window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : '';
    let filteredAP = allAP;
    
    if ((role === 'mandor' || role === 'tpg') && scope) {
      filteredAP = allAP.filter(ap => {
        if (ap.tpg_id !== scope) return false;
        if (role === 'mandor' && user) {
          const parentPetak = allPetak.find(p => p.id === ap.petak_id);
          if (!parentPetak || parentPetak.mandor_id !== user.id) return false;
        }
        return true;
      });
    }

    // Cache the list of option data
    cachedAnakPetak = filteredAP.map(ap => {
      const p = allPetak.find(x => x.id === ap.petak_id);
      const label = p ? `Petak ${p.nomor} (${ap.luas_ha || 0} ha)` : ap.huruf;
      return { id: ap.id, label: label };
    });

    // Populate initially
    renderAnakPetakOptions(sel, selectedId);

    // Bind search event
    const searchInput = document.getElementById('pgn-petak-search');
    if (searchInput) {
      searchInput.value = ''; // Reset search input
      searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const currentSelected = sel.value; // Read currently selected value
        renderAnakPetakOptions(sel, currentSelected, query);
      };
    }
  }

  async function openAdd() {
    document.getElementById('penugasan-form').reset();
    document.getElementById('penugasan-id').value = '';
    document.getElementById('pgn-aktif').value = '1';
    document.getElementById('pgn-pohon').value = '';
    document.getElementById('penugasan-modal-title').textContent = 'Tambah Penugasan';
    await _loadPenyadapSelect('pgn-penyadap');
    await _loadAnakPetakSelect('pgn-anak-petak');
    U().openModal('penugasan-modal');
  }

  async function openEdit(id) {
    const row = await window.db.get('penugasan', id);
    if (!row) return;
    document.getElementById('penugasan-id').value        = row.id;
    document.getElementById('pgn-persen').value         = row.persen_target;
    document.getElementById('pgn-pohon').value          = row.jumlah_pohon || '';
    document.getElementById('pgn-aktif').value          = String(row.aktif);
    document.getElementById('pgn-keterangan').value     = row.keterangan || '';
    document.getElementById('penugasan-modal-title').textContent = 'Edit Penugasan';
    await _loadPenyadapSelect('pgn-penyadap', row.penyadap_id);
    await _loadAnakPetakSelect('pgn-anak-petak', row.anak_petak_id);
    U().openModal('penugasan-modal');
  }

  async function save(e) {
    e.preventDefault();
    const id          = document.getElementById('penugasan-id').value || U().uuid();
    const existing    = await window.db.get('penugasan', id);
    const penyadap_id = document.getElementById('pgn-penyadap').value;
    const ap_id       = document.getElementById('pgn-anak-petak').value;

    if (!penyadap_id) { U().showToast('Pilih Penyadap terlebih dahulu', 'danger'); return; }
    if (!ap_id)       { U().showToast('Pilih Petak terlebih dahulu', 'danger'); return; }

    // Cek duplikat Penugasan aktif untuk Penyadap yang sama di Anak Petak yang sama
    const allPgn  = await window.db.getAllActive('penugasan');
    const dup = allPgn.find(r => r.penyadap_id === penyadap_id && r.anak_petak_id === ap_id && r.aktif === 1 && r.id !== id);
    if (dup) {
      U().showToast('Penyadap sudah memiliki penugasan aktif di petak ini', 'danger');
      return;
    }

    const aktif = parseInt(document.getElementById('pgn-aktif').value);
    const record = {
      id, 
      penyadap_id, 
      anak_petak_id: ap_id, 
      persen_target: existing ? existing.persen_target : 100,
      jumlah_pohon: existing ? existing.jumlah_pohon : 0,
      tanggal_mulai:  existing ? existing.tanggal_mulai : U().today(),
      tanggal_selesai: null,
      aktif,
      keterangan: document.getElementById('pgn-keterangan').value.trim(),
      ...U().makeAudit(U().currentActorId(), existing)
    };

    await window.db.put('penugasan', record);
    await window.db.queueSync('penugasan', existing ? 'update' : 'create', record);
    U().closeModal('penugasan-modal');
    U().showToast(existing ? 'Penugasan diperbarui' : 'Penugasan berhasil ditambahkan');
    state.page = 1;
    await render();
  }

  function confirmDelete(id) {
    if (!confirm('Hapus penugasan ini? Riwayat akan tetap tersimpan di database.')) return;
    window.db.softDelete('penugasan', id, U().currentActorId())
      .then(() => { U().showToast('Penugasan dihapus'); state.page = 1; render(); });
  }

  function onSearch(val) { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val; state.page = 1; render(); }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const allPgn      = await window.db.getAllActive('penugasan');
    const allPenyadap = await window.db.getAllActive('penyadap_master');
    const allAP       = await window.db.getAllActive('anak_petak');
    const allPetak    = await window.db.getAllActive('petak');
    const rows = allPgn.map(r => {
      const psy   = allPenyadap.find(p => p.id === r.penyadap_id);
      const ap    = allAP.find(a => a.id === r.anak_petak_id);
      const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
      return {
        Penyadap: psy ? `${psy.nomor} — ${psy.nama}` : r.penyadap_id,
        Anak_Petak: petak && ap ? `${petak.nomor}${ap.huruf}` : r.anak_petak_id,
        Persen_Target: r.persen_target,
        Tgl_Mulai: r.tanggal_mulai || '',
        Tgl_Selesai: r.tanggal_selesai || '',
        Status: r.aktif ? 'Aktif' : 'Selesai',
        Keterangan: r.keterangan || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Penugasan');
    XLSX.writeFile(wb, `Penugasan_Penyadap_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil');
  }

  return { render, openAdd, openEdit, save, confirmDelete, onSearch, onFilter, exportExcel };
})();

window.MasterPenugasan = MasterPenugasan;
