/**
 * SIPENA Lite — Master Petak
 */
'use strict';

const MasterPetak = (() => {
  const U = () => window.SipenaUtils;

  let state = { search: '', sortKey: 'nomor', sortDir: 'asc', filterRph: '', filterTpg: '', page: 1, perPage: 10 };

  async function render() {
    const allPetak = await window.db.getAllActive('petak');
    const allRph   = await window.db.getAllActive('rph');
    const allTpg   = await window.db.getAllActive('tpg');

    // ── Isi dropdown filter RPH (hanya isi ulang isi opsinya, jaga value) ──
    const rphSel = document.getElementById('petak-filter-rph');
    if (rphSel) {
      const curRph = state.filterRph;
      rphSel.innerHTML = `<option value="">Semua RPH</option>` +
        allRph.map(r => `<option value="${r.id}" ${r.id === curRph ? 'selected' : ''}>${r.nama}</option>`).join('');
    }

    // ── Isi dropdown filter TPG (sesuai RPH yang dipilih, jaga value) ──
    const tpgSel = document.getElementById('petak-filter-tpg');
    if (tpgSel) {
      const curTpg = state.filterTpg;
      const visibleTpg = state.filterRph
        ? allTpg.filter(t => t.rph_id === state.filterRph)
        : allTpg;
      tpgSel.innerHTML = `<option value="">Semua TPG</option>` +
        visibleTpg.map(t => `<option value="${t.id}" ${t.id === curTpg ? 'selected' : ''}>${t.nama}</option>`).join('');
    }

    let data = allPetak;
    if (state.filterRph) data = data.filter(r => r.rph_id === state.filterRph);
    if (state.filterTpg) data = data.filter(r => r.tpg_id === state.filterTpg);
    data = U().filterAndSort(data, state.search, ['nomor', 'kelas_hutan', 'keterangan'], state.sortKey, state.sortDir);

    const pager = U().paginate(data, state.page, state.perPage);
    const tbody = document.getElementById('petak-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">Belum ada data Petak</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map(row => {
        const rph = allRph.find(r => r.id === row.rph_id);
        const tpg = allTpg.find(t => t.id === row.tpg_id);
        return `<tr>
          <td><strong>${row.nomor}</strong></td>
          <td>${rph ? rph.nama : '—'}</td>
          <td>${tpg ? tpg.nama : '—'}</td>
          <td>${(row.luas_ha || 0).toFixed(2)} ha</td>
          <td>${row.jumlah_pohon || 0}</td>
          <td style="color:var(--text-secondary)">${row.kelas_hutan || '—'}</td>
          <td style="color:var(--text-secondary)">${row.keterangan || '—'}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-secondary btn-xs" onclick="MasterPetak.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="MasterPetak.confirmDelete('${row.id}','${row.nomor}')">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(
      document.getElementById('petak-pagination'), 
      pager, 
      p => { state.page = p; render(); },
      lim => { state.perPage = lim; state.page = 1; render(); },
      state.perPage
    );
  }


  async function _loadRphSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const all = await window.db.getAllActive('rph');
    sel.innerHTML = `<option value="">— Pilih RPH —</option>` +
      all.map(r => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${r.nama}</option>`).join('');
  }

  async function _loadTpgSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const all = await window.db.getAllActive('tpg');
    sel.innerHTML = `<option value="">— Pilih TPG —</option>` +
      all.map(t => `<option value="${t.id}" ${t.id === selectedId ? 'selected' : ''}>${t.nama}</option>`).join('');
  }

  async function openAdd() {
    document.getElementById('petak-form').reset();
    document.getElementById('petak-id').value = '';
    document.getElementById('petak-modal-title').textContent = 'Tambah Petak';
    await _loadRphSelect('petak-rph');
    await _loadTpgSelect('petak-tpg');
    U().openModal('petak-modal');
  }

  async function openEdit(id) {
    const row = await window.db.get('petak', id);
    if (!row) return;
    document.getElementById('petak-id').value          = row.id;
    document.getElementById('petak-nomor').value       = row.nomor;
    document.getElementById('petak-luas').value        = row.luas_ha || '';
    document.getElementById('petak-pohon').value       = row.jumlah_pohon || '';
    document.getElementById('petak-kelas').value       = row.kelas_hutan || '';
    document.getElementById('petak-keterangan').value  = row.keterangan || '';
    document.getElementById('petak-modal-title').textContent = 'Edit Petak';
    await _loadRphSelect('petak-rph', row.rph_id);
    await _loadTpgSelect('petak-tpg', row.tpg_id);
    U().openModal('petak-modal');
  }

  async function save(e) {
    e.preventDefault();
    const id       = document.getElementById('petak-id').value || U().uuid();
    const existing = await window.db.get('petak', id);
    const rph_id   = document.getElementById('petak-rph').value;
    const tpg_id   = document.getElementById('petak-tpg').value;
    const nomor    = document.getElementById('petak-nomor').value.trim();
    const luas_ha  = parseFloat(document.getElementById('petak-luas').value) || 0;
    const jumlah_pohon = parseInt(document.getElementById('petak-pohon').value) || 0;

    if (!rph_id) { U().showToast('Pilih RPH terlebih dahulu', 'danger'); return; }
    if (!tpg_id) { U().showToast('Pilih TPG terlebih dahulu', 'danger'); return; }
    if (!nomor)  { U().showToast('Nomor Petak tidak boleh kosong', 'danger'); return; }

    // Validasi: nomor unik dalam satu RPH
    const all = await window.db.getAllActive('petak');
    const dup = all.find(r => r.rph_id === rph_id && r.nomor === nomor && r.id !== id);
    if (dup) { U().showToast(`Petak ${nomor} sudah ada di RPH ini`, 'danger'); return; }

    const record = {
      id, rph_id, tpg_id, nomor, luas_ha, jumlah_pohon,
      kelas_hutan: document.getElementById('petak-kelas').value.trim(),
      keterangan:  document.getElementById('petak-keterangan').value.trim(),
      ...U().makeAudit(U().currentActorId(), existing)
    };

    await window.db.put('petak', record);
    await window.db.queueSync('petak', existing ? 'update' : 'create', record);

    // Dummy mirroring anak_petak agar tidak merusak relasi/dependensi data lain
    const apId = `ap-${id}`;
    const existingAp = await window.db.get('anak_petak', apId);
    const apRecord = {
      id: apId,
      petak_id: id,
      huruf: '',
      luas_ha,
      jumlah_pohon,
      tpg_id,
      keterangan: record.keterangan,
      ...U().makeAudit(U().currentActorId(), existingAp)
    };
    await window.db.put('anak_petak', apRecord);
    await window.db.queueSync('anak_petak', existingAp ? 'update' : 'create', apRecord);

    U().closeModal('petak-modal');
    U().showToast(existing ? 'Petak diperbarui' : 'Petak berhasil ditambahkan');
    state.page = 1;
    await render();
  }

  async function confirmDelete(id, nomor) {
    const apId = `ap-${id}`;
    // Cek dependensi penugasan aktif
    const pgn = await window.db.getByIndex('penugasan', 'anak_petak_id', apId);
    const aktif = pgn.filter(p => !p.deleted_at && p.aktif === 1);
    if (aktif.length > 0) {
      alert(`Petak ${nomor} tidak dapat dihapus.\nTerdapat ${aktif.length} penugasan aktif.\nAkhiri penugasan terlebih dahulu.`);
      return;
    }

    if (!confirm(`Hapus Petak ${nomor}?`)) return;
    await window.db.softDelete('petak', id, U().currentActorId());
    await window.db.softDelete('anak_petak', apId, U().currentActorId());

    U().showToast('Petak dihapus');
    state.page = 1;
    await render();
  }

  function onSearch(val) { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val; state.page = 1; render(); }

  /**
   * Dipanggil saat filter RPH berubah.
   * Otomatis mengisi dropdown TPG hanya dengan TPG di bawah RPH yang dipilih.
   */
  async function onFilterRph(rphId) {
    state.filterRph = rphId;
    state.filterTpg = '';
    state.page = 1;

    const sel = document.getElementById('petak-filter-tpg');
    if (sel) {
      if (!rphId) {
        // Tampilkan semua TPG
        const allTpg = await window.db.getAllActive('tpg');
        sel.innerHTML = `<option value="">Semua TPG</option>` +
          allTpg.map(t => `<option value="${t.id}">${t.nama}</option>`).join('');
      } else {
        // Filter TPG sesuai RPH
        const allTpg = await window.db.getAllActive('tpg');
        const filtered = allTpg.filter(t => t.rph_id === rphId);
        sel.innerHTML = `<option value="">Semua TPG</option>` +
          filtered.map(t => `<option value="${t.id}">${t.nama}</option>`).join('');
      }
      sel.value = '';
    }

    render();
  }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const allPetak = await window.db.getAllActive('petak');
    const allRph   = await window.db.getAllActive('rph');
    const allTpg   = await window.db.getAllActive('tpg');
    const rows = allPetak.map(r => {
      const rph = allRph.find(x => x.id === r.rph_id);
      const tpg = allTpg.find(t => t.id === r.tpg_id);
      return {
        Nomor: r.nomor,
        RPH: rph ? rph.nama : r.rph_id,
        TPG: tpg ? tpg.nama : r.tpg_id,
        Luas_Ha: r.luas_ha || 0,
        Jumlah_Pohon: r.jumlah_pohon || 0,
        Tahun_Tanam: r.kelas_hutan || '',
        Keterangan: r.keterangan || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Petak');
    XLSX.writeFile(wb, `Master_Petak_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil');
  }

  return { render, openAdd, openEdit, save, confirmDelete, onSearch, onFilter, onFilterRph, exportExcel };
})();

window.MasterPetak = MasterPetak;
