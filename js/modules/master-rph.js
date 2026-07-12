/**
 * SIPENA Lite — Master RPH (SIPENA-012)
 * Relasi: RPH berada di bawah BKPH.
 * RBAC: Admin (full), Asper/BKPH (view+export), KRPH (view wilayah sendiri), Mandor (no access).
 * Fitur: CRUD, Soft Delete, Restore, Search, Filter, Sort, Pagination, Import, Export.
 */
'use strict';

const MasterRPH = (() => {
  const U = () => window.SipenaUtils;

  let state = {
    search: '',
    sortKey: 'kode',
    sortDir: 'asc',
    filterBkph: '',
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

  /** Mengembalikan scope ID user (untuk KRPH: rph_id) */
  function getUserScope() {
    const user = window.app && window.app.currentUser;
    return user ? user.scope : null;
  }

  // ── Render ────────────────────────────────────────────────────
  async function render() {
    const perm  = getPermissions();
    const tabEl = document.getElementById('tab-rph');
    if (!tabEl) return;

    // Akses ditolak untuk Mandor
    if (!perm.view) {
      tabEl.innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--danger);">
          <span style="font-size:3rem;">🚫</span>
          <h3 style="margin-top:1rem;">Akses Ditolak</h3>
          <p style="color:var(--text-secondary);font-size:.9rem;margin-top:.5rem;">
            Anda tidak memiliki hak akses untuk melihat data Master RPH.
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

    // Ambil data
    const role    = window.app.currentUser.role;
    const scope   = getUserScope();
    const allBkph = await window.db.getAllActive('bkph');

    // Admin lihat semua termasuk soft-deleted; role lain hanya aktif
    let allRph = role === 'admin'
      ? await window.db.getAll('rph')
      : await window.db.getAllActive('rph');

    // KRPH hanya lihat RPH miliknya sendiri
    if (role === 'krph' && scope) {
      allRph = allRph.filter(r => r.id === scope);
    }

    // Filter
    let data = [...allRph];
    if (state.filterBkph) {
      data = data.filter(r => r.bkph_id === state.filterBkph);
    }
    if (state.filterStatus) {
      if (state.filterStatus === 'terhapus') {
        data = data.filter(r => r.deleted_at != null);
      } else {
        data = data.filter(r => r.status === state.filterStatus && !r.deleted_at);
      }
    }

    data = U().filterAndSort(data, state.search, ['kode', 'nama', 'keterangan'], state.sortKey, state.sortDir);

    // Isi dropdown filter BKPH (sekali saja atau reset)
    _populateBkphFilter(allBkph);

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('rph-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data RPH</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const rowNo    = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;
        const bkph     = allBkph.find(b => b.id === row.bkph_id);
        const isDeleted = row.deleted_at != null;

        let statusBadge = `<span class="badge ${U().STATUS_AKTIF_BADGE[row.status] || 'badge-inactive'}">${U().STATUS_AKTIF_LABEL[row.status] || row.status}</span>`;
        if (isDeleted) statusBadge = `<span class="badge badge-danger">Terhapus</span>`;

        let actionHtml = '';
        if (perm.write) {
          if (isDeleted) {
            actionHtml = `<button class="btn btn-secondary btn-xs" onclick="MasterRPH.reactivate('${row.id}')" title="Aktifkan Kembali">🔄 Aktifkan</button>`;
          } else {
            actionHtml = `
              <button class="btn btn-secondary btn-xs" onclick="MasterRPH.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="MasterRPH.confirmDelete('${row.id}','${row.nama}')">🗑️</button>`;
          }
        } else {
          actionHtml = `<span class="text-muted-sm">—</span>`;
        }

        return `
        <tr style="${isDeleted ? 'opacity:0.6;' : ''}">
          <td>${rowNo}</td>
          <td><strong>${row.kode}</strong></td>
          <td>${row.nama}</td>
          <td>${bkph ? bkph.nama_bkph : '<span class="text-muted-sm">—</span>'}</td>
          <td style="color:var(--text-secondary)">${row.keterangan || '—'}</td>
          <td>${statusBadge}</td>
          <td><div class="action-btns">${actionHtml}</div></td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(
      document.getElementById('rph-pagination'),
      pager,
      p => { state.page = p; render(); }
    );
  }

  /** Isi dropdown filter BKPH */
  function _populateBkphFilter(allBkph) {
    const sel = document.getElementById('rph-filter-bkph');
    if (!sel) return;
    // Simpan pilihan saat ini
    const current = sel.value;
    sel.innerHTML = `<option value="">Semua BKPH</option>` +
      allBkph.map(b => `<option value="${b.id}" ${b.id === current ? 'selected' : ''}>${b.nama_bkph}</option>`).join('');
  }

  /** Isi dropdown BKPH di modal */
  async function _loadBkphSelect(selectId, selectedId = '') {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const all = await window.db.getAllActive('bkph');
    sel.innerHTML = `<option value="">— Pilih BKPH —</option>` +
      all.map(b => `<option value="${b.id}" ${b.id === selectedId ? 'selected' : ''}>${b.nama_bkph}</option>`).join('');
  }

  // ── Open Modal ──────────────────────────────────────────────
  function openAdd() {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak memiliki akses menulis', 'danger'); return; }
    document.getElementById('rph-form').reset();
    document.getElementById('rph-id').value = '';
    document.getElementById('rph-modal-title').textContent = 'Tambah RPH';
    _loadBkphSelect('rph-bkph');
    U().openModal('rph-modal');
  }

  async function openEdit(id) {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak memiliki akses menulis', 'danger'); return; }
    const row = await window.db.get('rph', id);
    if (!row) return;
    document.getElementById('rph-id').value         = row.id;
    document.getElementById('rph-kode').value       = row.kode;
    document.getElementById('rph-nama').value       = row.nama;
    document.getElementById('rph-keterangan').value = row.keterangan || '';
    document.getElementById('rph-status').value     = row.status;
    document.getElementById('rph-modal-title').textContent = 'Edit RPH';
    await _loadBkphSelect('rph-bkph', row.bkph_id);
    U().openModal('rph-modal');
  }

  // ── Save ────────────────────────────────────────────────────
  async function save(e) {
    e.preventDefault();
    const id       = document.getElementById('rph-id').value || U().uuid();
    const existing = await window.db.get('rph', id);
    const bkph_id  = document.getElementById('rph-bkph').value;
    const kode     = document.getElementById('rph-kode').value.trim().toUpperCase();
    const nama     = document.getElementById('rph-nama').value.trim();

    if (!bkph_id) { U().showToast('Pilih BKPH terlebih dahulu', 'danger'); return; }
    if (!kode)    { U().showToast('Kode RPH wajib diisi', 'danger'); return; }
    if (!nama)    { U().showToast('Nama RPH wajib diisi', 'danger'); return; }

    // Validasi kode unik
    const allActive = await window.db.getAllActive('rph');
    const dup = allActive.find(r => r.kode === kode && r.id !== id);
    if (dup) { U().showToast(`Kode RPH "${kode}" sudah terdaftar di sistem`, 'danger'); return; }

    const record = {
      id, bkph_id, kode, nama,
      keterangan: document.getElementById('rph-keterangan').value.trim(),
      status:     document.getElementById('rph-status').value,
      ...U().makeAudit(U().currentActorId(), existing)
    };

    try {
      await window.db.put('rph', record);
      await window.db.queueSync('rph', existing ? 'update' : 'create', record);
      U().closeModal('rph-modal');
      U().showToast(existing ? 'RPH diperbarui' : 'RPH berhasil ditambahkan', 'success');
      state.page = 1;
      await render();
    } catch (err) {
      U().showToast('Gagal menyimpan: ' + err.message, 'danger');
    }
  }

  // ── Soft Delete ─────────────────────────────────────────────
  async function confirmDelete(id, nama) {
    // Cek dependency: TPG aktif
    const tpgList = await window.db.getByIndex('tpg', 'rph_id', id);
    const activeTpg = tpgList.filter(t => !t.deleted_at);
    if (activeTpg.length > 0) {
      alert(`RPH "${nama}" tidak dapat dihapus.\nMasih terdapat ${activeTpg.length} TPG aktif di bawahnya.\nHapus semua TPG terlebih dahulu.`);
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus RPH "${nama}"?\nData tidak akan dihapus secara permanen.`)) return;

    try {
      const record = await window.db.get('rph', id);
      record.deleted_at  = new Date().toISOString();
      record.updated_at  = new Date().toISOString();
      record.updated_by  = U().currentActorId();
      record.status      = 'nonaktif';
      await window.db.put('rph', record);
      await window.db.queueSync('rph', 'delete', { id });
      U().showToast('RPH berhasil dinonaktifkan (soft delete)', 'success');
      state.page = 1;
      await render();
    } catch (err) {
      U().showToast('Gagal menghapus: ' + err.message, 'danger');
    }
  }

  // ── Restore ─────────────────────────────────────────────────
  async function reactivate(id) {
    try {
      const record = await window.db.get('rph', id);
      if (!record) return;
      record.deleted_at = null;
      record.status     = 'aktif';
      record.updated_at = new Date().toISOString();
      record.updated_by = U().currentActorId();
      await window.db.put('rph', record);
      await window.db.queueSync('rph', 'update', record);
      U().showToast('RPH diaktifkan kembali', 'success');
      await render();
    } catch (err) {
      U().showToast('Gagal mengaktifkan kembali: ' + err.message, 'danger');
    }
  }

  // ── Search / Filter / Sort ──────────────────────────────────
  function onSearch(val)         { state.search = val; state.page = 1; render(); }
  function onFilter(key, val)    { state[key] = val;   state.page = 1; render(); }
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
    const role    = window.app.currentUser.role;
    const scope   = getUserScope();

    let allRph = role === 'admin'
      ? await window.db.getAll('rph')
      : await window.db.getAllActive('rph');
    if (role === 'krph' && scope) allRph = allRph.filter(r => r.id === scope);

    let data = [...allRph];
    if (state.filterBkph)   data = data.filter(r => r.bkph_id === state.filterBkph);
    if (state.filterStatus) {
      if (state.filterStatus === 'terhapus') data = data.filter(r => r.deleted_at != null);
      else data = data.filter(r => r.status === state.filterStatus && !r.deleted_at);
    }
    data = U().filterAndSort(data, state.search, ['kode', 'nama', 'keterangan'], state.sortKey, state.sortDir);

    const rows = data.map((r, idx) => {
      const bkph = allBkph.find(b => b.id === r.bkph_id);
      return {
        No: idx + 1,
        'Kode RPH': r.kode,
        'Nama RPH': r.nama,
        BKPH:       bkph ? bkph.nama_bkph : r.bkph_id,
        Keterangan: r.keterangan || '',
        Status:     r.deleted_at ? 'Terhapus' : r.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master RPH');
    XLSX.writeFile(wb, `Master_RPH_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil', 'success');
  }

  return { render, openAdd, openEdit, save, confirmDelete, reactivate, onSearch, onFilter, onSort, exportExcel };
})();

window.MasterRPH = MasterRPH;
