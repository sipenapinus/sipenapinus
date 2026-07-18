/**
 * SIPENA Lite — Master Penyadap
 * Business Rule: Data penyadap TIDAK BOLEH dihapus permanen.
 * Hanya boleh ubah status.
 */
'use strict';

const MasterPenyadap = (() => {
  const U = () => window.SipenaUtils;

  let state = { search: '', sortKey: 'nama', sortDir: 'asc', filterStatus: '', page: 1 };

  async function render() {
    const all = await window.db.getAllActive('penyadap_master');
    let data  = all;

    const user = window.app && window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : '';

    if ((role === 'mandor' || role === 'tpg') && scope) {
      const allPgn = await window.db.getAllActive('penugasan');
      const allAP = await window.db.getAllActive('anak_petak');
      const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
      const assignedPndIds = allPgn.filter(pg => apIds.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id);
      data = all.filter(p => assignedPndIds.includes(p.id) || p.created_by === user.id);
    }

    if (state.filterStatus) data = data.filter(r => r.status === state.filterStatus);
    data = U().filterAndSort(data, state.search, ['nomor', 'nama', 'alamat', 'no_hp'], state.sortKey, state.sortDir);

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('penyadap-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada data Penyadap</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map(row => {
        const badge = U().STATUS_PENYADAP_BADGE[row.status] || 'badge-inactive';
        const label = U().STATUS_PENYADAP_LABEL[row.status] || row.status;
        return `<tr>
          <td><strong>${row.nomor}</strong></td>
          <td>${row.nama}</td>
          <td style="color:var(--text-secondary)">${row.alamat || '—'}</td>
          <td>${row.no_hp || '—'}</td>
          <td><span class="badge ${badge}">${label}</span></td>
          <td>
            <div class="action-btns">
              <button class="btn btn-secondary btn-xs" onclick="MasterPenyadap.openEdit('${row.id}')">✏️ Edit</button>
              <!-- Tidak ada tombol Hapus: Business Rule SIPENA-002 §6 -->
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('penyadap-pagination'), pager, p => { state.page = p; render(); });
  }

  function openAdd() {
    document.getElementById('penyadap-form').reset();
    document.getElementById('penyadap-id').value = '';
    document.getElementById('penyadap-modal-title').textContent = 'Tambah Penyadap';
    U().openModal('penyadap-modal');
  }

  async function openEdit(id) {
    const row = await window.db.get('penyadap_master', id);
    if (!row) return;
    document.getElementById('penyadap-id').value         = row.id;
    document.getElementById('penyadap-nomor').value      = row.nomor;
    document.getElementById('penyadap-nama').value       = row.nama;
    document.getElementById('penyadap-alamat').value     = row.alamat || '';
    document.getElementById('penyadap-hp').value         = row.no_hp || '';
    document.getElementById('penyadap-status').value     = row.status;
    document.getElementById('penyadap-modal-title').textContent = 'Edit Penyadap';
    U().openModal('penyadap-modal');
  }

  async function save(e) {
    e.preventDefault();
    const id       = document.getElementById('penyadap-id').value || U().uuid();
    const existing = await window.db.get('penyadap_master', id);
    const nomor    = document.getElementById('penyadap-nomor').value.trim().toUpperCase();

    // Validasi: nomor unik
    const all = await window.db.getAllActive('penyadap_master');
    const dup = all.find(r => r.nomor === nomor && r.id !== id);
    if (dup) { U().showToast(`Nomor penyadap ${nomor} sudah terdaftar`, 'danger'); return; }

    const record = {
      id, nomor,
      nama:   document.getElementById('penyadap-nama').value.trim(),
      alamat: document.getElementById('penyadap-alamat').value.trim(),
      no_hp:  document.getElementById('penyadap-hp').value.trim(),
      status: document.getElementById('penyadap-status').value,
      ...U().makeAudit(U().currentActorId(), existing)
    };

    await window.db.put('penyadap_master', record);
    await window.db.queueSync('penyadap_master', existing ? 'update' : 'create', record);
    U().closeModal('penyadap-modal');
    U().showToast(existing ? 'Data penyadap diperbarui' : 'Penyadap berhasil ditambahkan');
    state.page = 1;
    await render();
  }

  function onSearch(val) { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val; state.page = 1; render(); }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const all = await window.db.getAllActive('penyadap_master');
    const rows = all.map(r => ({
      Nomor: r.nomor, Nama: r.nama, Alamat: r.alamat || '',
      No_HP: r.no_hp || '', Status: r.status
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Penyadap');
    XLSX.writeFile(wb, `Master_Penyadap_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil');
  }

  return { render, openAdd, openEdit, save, onSearch, onFilter, exportExcel };
})();

window.MasterPenyadap = MasterPenyadap;
