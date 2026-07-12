/**
 * SIPENA Lite — Master TPG (SIPENA-012)
 * Relasi: TPG berada di bawah RPH, RPH berada di bawah BKPH.
 * RBAC: Admin (full), Asper/BKPH (view+export), KRPH (view wilayah sendiri), Mandor (no access).
 * Fitur: CRUD, Soft Delete, Restore, Search, Filter, Sort, Pagination, Import, Export.
 */
'use strict';

const MasterTPG = (() => {
  const U = () => window.SipenaUtils;

  let state = {
    search: '',
    sortKey: 'kode',
    sortDir: 'asc',
    filterBkph: '',
    filterRph: '',
    filterStatus: '',
    page: 1
  };

  // ── RBAC ──────────────────────────────────────────────────────
  function getPermissions() {
    const user = window.app && window.app.currentUser;
    if (!user) return { view: false, write: false, export: false };
    switch (user.role) {
      case 'admin': return { view: true, write: true, export: true };
      case 'bkph':  return { view: true, write: false, export: true };
      case 'krph':  return { view: true, write: false, export: false };
      default:      return { view: false, write: false, export: false };
    }
  }

  function getUserScope() {
    const user = window.app && window.app.currentUser;
    return user ? user.scope : null;
  }

  // ── Render ────────────────────────────────────────────────────
  async function render() {
    const perm  = getPermissions();
    const tabEl = document.getElementById('tab-tpg');
    if (!tabEl) return;

    if (!perm.view) {
      tabEl.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--danger);">
          <span style="font-size:3rem;">🚫</span>
          <h3 style="margin-top:1rem;">Akses Ditolak</h3>
          <p style="color:var(--text-secondary);font-size:.9rem;margin-top:.5rem;">
            Anda tidak memiliki hak akses untuk melihat data Master TPG.
          </p>
        </div>`;
      return;
    }

    // RBAC toolbar
    const toolbar = tabEl.querySelector('.table-toolbar');
    if (toolbar) {
      toolbar.querySelectorAll('.write-only').forEach(el => {
        el.style.display = perm.write ? '' : 'none';
      });
      const exportBtn = toolbar.querySelector('.export-btn');
      if (exportBtn) exportBtn.style.display = perm.export ? '' : 'none';
    }

    const role  = window.app.currentUser.role;
    const scope = getUserScope(); // untuk KRPH: rph_id

    const allBkph = await window.db.getAllActive('bkph');
    const allRph  = await window.db.getAllActive('rph');

    // Admin lihat semua termasuk soft-deleted
    let allTpg = role === 'admin'
      ? await window.db.getAll('tpg')
      : await window.db.getAllActive('tpg');

    // KRPH hanya lihat TPG di RPH miliknya
    if (role === 'krph' && scope) {
      allTpg = allTpg.filter(t => t.rph_id === scope);
    }

    // Filter
    let data = [...allTpg];
    if (state.filterBkph) {
      // Filter berdasarkan BKPH (melalui RPH)
      const rphOfBkph = allRph.filter(r => r.bkph_id === state.filterBkph).map(r => r.id);
      data = data.filter(t => rphOfBkph.includes(t.rph_id));
    }
    if (state.filterRph) {
      data = data.filter(t => t.rph_id === state.filterRph);
    }
    if (state.filterStatus) {
      if (state.filterStatus === 'terhapus') {
        data = data.filter(t => t.deleted_at != null);
      } else {
        data = data.filter(t => t.status === state.filterStatus && !t.deleted_at);
      }
    }

    data = U().filterAndSort(data, state.search, ['kode', 'nama', 'keterangan'], state.sortKey, state.sortDir);

    // Isi filter dropdown
    _populateBkphFilter(allBkph);
    _populateRphFilter(allRph, state.filterBkph);

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('tpg-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Belum ada data TPG</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const rowNo     = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;
        const rph       = allRph.find(r => r.id === row.rph_id);
        const bkph      = rph ? allBkph.find(b => b.id === rph.bkph_id) : null;
        const isDeleted = row.deleted_at != null;

        let statusBadge = `<span class="badge ${U().STATUS_AKTIF_BADGE[row.status] || 'badge-inactive'}">${U().STATUS_AKTIF_LABEL[row.status] || row.status}</span>`;
        if (isDeleted) statusBadge = `<span class="badge badge-danger">Terhapus</span>`;

        let actionHtml = '';
        if (perm.write) {
          if (isDeleted) {
            actionHtml = `<button class="btn btn-secondary btn-xs" onclick="MasterTPG.reactivate('${row.id}')" title="Aktifkan Kembali">🔄 Aktifkan</button>`;
          } else {
            actionHtml = `
              <button class="btn btn-secondary btn-xs" onclick="MasterTPG.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="MasterTPG.confirmDelete('${row.id}','${row.nama}')">🗑️</button>`;
          }
        } else {
          actionHtml = `<span class="text-muted-sm">—</span>`;
        }

        return `
        <tr style="${isDeleted ? 'opacity:0.6;' : ''}">
          <td>${rowNo}</td>
          <td><strong>${row.kode}</strong></td>
          <td>${row.nama}</td>
          <td>${rph ? rph.nama : '<span class="text-muted-sm">—</span>'}</td>
          <td>${bkph ? bkph.nama_bkph : '<span class="text-muted-sm">—</span>'}</td>
          <td style="color:var(--text-secondary)">${row.keterangan || '—'}</td>
          <td>${statusBadge}</td>
          <td><div class="action-btns">${actionHtml}</div></td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(
      document.getElementById('tpg-pagination'),
      pager,
      p => { state.page = p; render(); }
    );
  }

  /** Isi dropdown filter BKPH */
  function _populateBkphFilter(allBkph) {
    const sel = document.getElementById('tpg-filter-bkph');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">Semua BKPH</option>` +
      allBkph.map(b => `<option value="${b.id}" ${b.id === current ? 'selected' : ''}>${b.nama_bkph}</option>`).join('');
  }

  /** Isi dropdown filter RPH (difilter berdasarkan BKPH jika ada) */
  async function _populateRphFilter(allRph, filterBkph = '') {
    const sel = document.getElementById('tpg-filter-rph');
    if (!sel) return;
    const current = sel.value;
    const filtered = filterBkph ? allRph.filter(r => r.bkph_id === filterBkph) : allRph;
    sel.innerHTML = `<option value="">Semua RPH</option>` +
      filtered.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${r.nama}</option>`).join('');
  }

  /** Isi dropdown RPH di modal */
  async function _loadRphSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const all = await window.db.getAllActive('rph');
    sel.innerHTML = `<option value="">— Pilih RPH —</option>` +
      all.map(r => `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${r.nama}</option>`).join('');
  }

  // ── Open Modal ──────────────────────────────────────────────
  function openAdd() {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak memiliki akses menulis', 'danger'); return; }
    document.getElementById('tpg-form').reset();
    document.getElementById('tpg-id').value = '';
    document.getElementById('tpg-modal-title').textContent = 'Tambah TPG';
    _loadRphSelect('tpg-rph');
    U().openModal('tpg-modal');
  }

  async function openEdit(id) {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak memiliki akses menulis', 'danger'); return; }
    const row = await window.db.get('tpg', id);
    if (!row) return;
    document.getElementById('tpg-id').value         = row.id;
    document.getElementById('tpg-kode').value       = row.kode;
    document.getElementById('tpg-nama').value       = row.nama;
    document.getElementById('tpg-keterangan').value = row.keterangan || '';
    document.getElementById('tpg-status').value     = row.status;
    document.getElementById('tpg-modal-title').textContent = 'Edit TPG';
    await _loadRphSelect('tpg-rph', row.rph_id);
    U().openModal('tpg-modal');
  }

  // ── Save ────────────────────────────────────────────────────
  async function save(e) {
    e.preventDefault();
    const id       = document.getElementById('tpg-id').value || U().uuid();
    const existing = await window.db.get('tpg', id);
    const rph_id   = document.getElementById('tpg-rph').value;
    const kode     = document.getElementById('tpg-kode').value.trim().toUpperCase();
    const nama     = document.getElementById('tpg-nama').value.trim();

    if (!rph_id) { U().showToast('Pilih RPH terlebih dahulu', 'danger'); return; }
    if (!kode)   { U().showToast('Kode TPG wajib diisi', 'danger'); return; }
    if (!nama)   { U().showToast('Nama TPG wajib diisi', 'danger'); return; }

    // Validasi kode unik
    const allActive = await window.db.getAllActive('tpg');
    const dup = allActive.find(t => t.kode === kode && t.id !== id);
    if (dup) { U().showToast(`Kode TPG "${kode}" sudah terdaftar di sistem`, 'danger'); return; }

    const record = {
      id, rph_id, kode, nama,
      keterangan: document.getElementById('tpg-keterangan').value.trim(),
      status:     document.getElementById('tpg-status').value,
      ...U().makeAudit(U().currentActorId(), existing)
    };

    try {
      await window.db.put('tpg', record);
      await window.db.queueSync('tpg', existing ? 'update' : 'create', record);
      U().closeModal('tpg-modal');
      U().showToast(existing ? 'TPG diperbarui' : 'TPG berhasil ditambahkan', 'success');
      state.page = 1;
      await render();
    } catch (err) {
      U().showToast('Gagal menyimpan: ' + err.message, 'danger');
    }
  }

  // ── Soft Delete ─────────────────────────────────────────────
  async function confirmDelete(id, nama) {
    // Cek dependency: Penugasan aktif melalui Anak Petak yang terhubung ke TPG ini
    // (TPG dihubungkan ke Anak Petak via tpg_id di anak_petak store)
    const anakPetakList = await window.db.getByIndex('anak_petak', 'tpg_id', id);
    const activeAP = anakPetakList.filter(ap => !ap.deleted_at);
    if (activeAP.length > 0) {
      alert(`TPG "${nama}" tidak dapat dihapus.\nMasih terdapat ${activeAP.length} Anak Petak aktif yang terkait.\nPindahkan atau hapus Anak Petak terlebih dahulu.`);
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus TPG "${nama}"?\nData tidak akan dihapus secara permanen.`)) return;

    try {
      const record = await window.db.get('tpg', id);
      record.deleted_at = new Date().toISOString();
      record.updated_at = new Date().toISOString();
      record.updated_by = U().currentActorId();
      record.status     = 'nonaktif';
      await window.db.put('tpg', record);
      await window.db.queueSync('tpg', 'delete', { id });
      U().showToast('TPG berhasil dinonaktifkan (soft delete)', 'success');
      state.page = 1;
      await render();
    } catch (err) {
      U().showToast('Gagal menghapus: ' + err.message, 'danger');
    }
  }

  // ── Restore ─────────────────────────────────────────────────
  async function reactivate(id) {
    try {
      const record = await window.db.get('tpg', id);
      if (!record) return;
      record.deleted_at = null;
      record.status     = 'aktif';
      record.updated_at = new Date().toISOString();
      record.updated_by = U().currentActorId();
      await window.db.put('tpg', record);
      await window.db.queueSync('tpg', 'update', record);
      U().showToast('TPG diaktifkan kembali', 'success');
      await render();
    } catch (err) {
      U().showToast('Gagal mengaktifkan kembali: ' + err.message, 'danger');
    }
  }

  // ── Search / Filter / Sort ──────────────────────────────────
  function onSearch(val)      { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) {
    state[key] = val;
    // Jika BKPH filter berubah, reset filter RPH
    if (key === 'filterBkph') state.filterRph = '';
    state.page = 1;
    render();
  }
  function onSort(key) {
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = 'asc'; }
    render();
  }

  // ── Export Excel ────────────────────────────────────────────
  async function exportExcel() {
    const perm = getPermissions();
    if (!perm.export) { U().showToast('Anda tidak memiliki akses export', 'danger'); return; }
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }

    const allBkph = await window.db.getAllActive('bkph');
    const allRph  = await window.db.getAllActive('rph');
    const role    = window.app.currentUser.role;
    const scope   = getUserScope();

    let allTpg = role === 'admin'
      ? await window.db.getAll('tpg')
      : await window.db.getAllActive('tpg');
    if (role === 'krph' && scope) allTpg = allTpg.filter(t => t.rph_id === scope);

    let data = [...allTpg];
    if (state.filterBkph) {
      const rphOfBkph = allRph.filter(r => r.bkph_id === state.filterBkph).map(r => r.id);
      data = data.filter(t => rphOfBkph.includes(t.rph_id));
    }
    if (state.filterRph) data = data.filter(t => t.rph_id === state.filterRph);
    if (state.filterStatus) {
      if (state.filterStatus === 'terhapus') data = data.filter(t => t.deleted_at != null);
      else data = data.filter(t => t.status === state.filterStatus && !t.deleted_at);
    }
    data = U().filterAndSort(data, state.search, ['kode', 'nama', 'keterangan'], state.sortKey, state.sortDir);

    const rows = data.map((t, idx) => {
      const rph  = allRph.find(r => r.id === t.rph_id);
      const bkph = rph ? allBkph.find(b => b.id === rph.bkph_id) : null;
      return {
        No: idx + 1,
        'Kode TPG': t.kode,
        'Nama TPG': t.nama,
        RPH:        rph  ? rph.nama      : t.rph_id,
        BKPH:       bkph ? bkph.nama_bkph : '—',
        Keterangan: t.keterangan || '',
        Status:     t.deleted_at ? 'Terhapus' : t.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master TPG');
    XLSX.writeFile(wb, `Master_TPG_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil', 'success');
  }

  return { render, openAdd, openEdit, save, confirmDelete, reactivate, onSearch, onFilter, onSort, exportExcel };
})();

window.MasterTPG = MasterTPG;
