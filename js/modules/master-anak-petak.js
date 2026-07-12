/**
 * SIPENA Lite — Master Anak Petak (sub-tab mandiri)
 */
'use strict';

const MasterAnakPetak = (() => {
  const U = () => window.SipenaUtils;

  let state = { search: '', sortKey: 'huruf', sortDir: 'asc', filterPetak: '', page: 1 };

  async function render() {
    const allAP    = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const allRph   = await window.db.getAllActive('rph');

    let data = allAP;
    if (state.filterPetak) data = data.filter(r => r.petak_id === state.filterPetak);
    data = U().filterAndSort(data, state.search, ['huruf', 'keterangan'], state.sortKey, state.sortDir);

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('ap-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data Anak Petak</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map(row => {
        const petak = allPetak.find(p => p.id === row.petak_id);
        const rph   = petak ? allRph.find(r => r.id === petak.rph_id) : null;
        const label = petak ? `${petak.nomor}${row.huruf}` : row.huruf;
        return `<tr>
          <td><strong>${label}</strong></td>
          <td>${rph ? rph.nama : '—'}</td>
          <td>${petak ? `Petak ${petak.nomor}` : '—'}</td>
          <td>${(row.luas_ha || 0).toFixed(2)} ha</td>
          <td>${row.jumlah_pohon || 0} pohon</td>
          <td style="color:var(--text-secondary)">${row.keterangan || '—'}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-secondary btn-xs" onclick="MasterAnakPetak.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="MasterAnakPetak.confirmDelete('${row.id}','${label}')">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('ap-pagination'), pager, p => { state.page = p; render(); });
  }

  async function _loadPetakSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const all = await window.db.getAllActive('petak');
    sel.innerHTML = `<option value="">— Pilih Petak —</option>` +
      all.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>Petak ${p.nomor}</option>`).join('');
  }

  function openAdd() {
    document.getElementById('ap-form').reset();
    document.getElementById('ap-id').value = '';
    document.getElementById('ap-modal-title').textContent = 'Tambah Anak Petak';
    _loadPetakSelect('ap-petak');
    U().openModal('ap-modal');
  }

  async function openEdit(id) {
    const row = await window.db.get('anak_petak', id);
    if (!row) return;
    document.getElementById('ap-id').value          = row.id;
    document.getElementById('ap-huruf').value       = row.huruf;
    document.getElementById('ap-luas').value        = row.luas_ha || '';
    document.getElementById('ap-pohon').value       = row.jumlah_pohon || '';
    document.getElementById('ap-keterangan').value  = row.keterangan || '';
    document.getElementById('ap-modal-title').textContent = 'Edit Anak Petak';
    await _loadPetakSelect('ap-petak', row.petak_id);
    U().openModal('ap-modal');
  }

  async function save(e) {
    e.preventDefault();
    const id       = document.getElementById('ap-id').value || U().uuid();
    const existing = await window.db.get('anak_petak', id);
    const petak_id = document.getElementById('ap-petak').value;
    const huruf    = document.getElementById('ap-huruf').value.trim().toUpperCase();

    if (!petak_id) { U().showToast('Pilih Petak terlebih dahulu', 'danger'); return; }
    if (!huruf)    { U().showToast('Huruf Anak Petak wajib diisi', 'danger'); return; }

    // Validasi: huruf unik dalam satu petak
    const allAP = await window.db.getAllActive('anak_petak');
    const dup   = allAP.find(r => r.petak_id === petak_id && r.huruf === huruf && r.id !== id);
    if (dup) { U().showToast(`Anak Petak ${huruf} sudah ada pada petak ini`, 'danger'); return; }

    const record = {
      id, petak_id, huruf,
      luas_ha:      parseFloat(document.getElementById('ap-luas').value) || 0,
      jumlah_pohon: parseInt(document.getElementById('ap-pohon').value) || 0,
      keterangan:   document.getElementById('ap-keterangan').value.trim(),
      ...U().makeAudit(U().currentActorId(), existing)
    };

    await window.db.put('anak_petak', record);
    await window.db.queueSync('anak_petak', existing ? 'update' : 'create', record);
    U().closeModal('ap-modal');
    U().showToast(existing ? 'Anak Petak diperbarui' : 'Anak Petak berhasil ditambahkan');
    state.page = 1;
    await render();
  }

  async function confirmDelete(id, label) {
    // Cek apakah ada penugasan aktif pada anak petak ini
    const pgn = await window.db.getByIndex('penugasan', 'anak_petak_id', id);
    const aktif = pgn.filter(p => !p.deleted_at && p.aktif === 1);
    if (aktif.length > 0) {
      alert(`Anak Petak ${label} tidak dapat dihapus.\nTerdapat ${aktif.length} penugasan aktif.\nAkhiri penugasan terlebih dahulu.`);
      return;
    }
    if (!confirm(`Hapus Anak Petak ${label}?`)) return;
    await window.db.softDelete('anak_petak', id, U().currentActorId());
    U().showToast('Anak Petak dihapus');
    state.page = 1;
    await render();
  }

  function onSearch(val) { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val; state.page = 1; render(); }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const allAP    = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const rows = allAP.map(r => {
      const petak = allPetak.find(p => p.id === r.petak_id);
      return {
        Label: petak ? `${petak.nomor}${r.huruf}` : r.huruf,
        Petak: petak ? petak.nomor : r.petak_id,
        Huruf: r.huruf,
        Luas_Ha: r.luas_ha || 0,
        Jumlah_Pohon: r.jumlah_pohon || 0,
        Keterangan: r.keterangan || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Anak Petak');
    XLSX.writeFile(wb, `Master_Anak_Petak_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil');
  }

  return { render, openAdd, openEdit, save, confirmDelete, onSearch, onFilter, exportExcel };
})();

window.MasterAnakPetak = MasterAnakPetak;
