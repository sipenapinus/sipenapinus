/**
 * SIPENA Lite — Master BKPH
 * CRUD + Search + Filter + Sort + Pagination + Export Excel + Import Excel (Partial & Full)
 * RBAC: Admin (all), Asper (view, export), KRPH (view), TPG/Mandor (No Access)
 */
'use strict';

const MasterBKPH = (() => {
  const U = () => window.SipenaUtils;

  let state = {
    search: '',
    sortKey: 'kode_bkph',
    sortDir: 'asc',
    filterStatus: '',
    page: 1
  };

  /**
   * Helper to check access permissions based on role.
   * Admin: full
   * Asper: view + export
   * KRPH: view only
   * Mandor TPG / Mandor Sadap: no access
   */
  function getPermissions() {
    const user = window.app && window.app.currentUser;
    if (!user) return { view: false, write: false, export: false };
    
    const role = user.role;
    if (role === 'admin') {
      return { view: true, write: true, export: true };
    } else if (role === 'bkph') {
      return { view: true, write: false, export: true };
    } else if (role === 'krph') {
      return { view: true, write: false, export: false };
    }
    return { view: false, write: false, export: false };
  }

  // ── Render Tabel ──────────────────────────────────────────
  async function render() {
    const perm = getPermissions();
    const tabEl = document.getElementById('tab-bkph');
    if (!tabEl) return;

    if (!perm.view) {
      tabEl.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--danger);">
          <span style="font-size:3rem;">🚫</span>
          <h3 style="margin-top:1rem;">Akses Ditolak</h3>
          <p style="color:var(--text-secondary); font-size:.9rem; margin-top:.5rem;">
            Anda tidak memiliki hak akses untuk melihat data Master BKPH.
          </p>
        </div>`;
      return;
    }

    // Tampilkan toolbar & action buttons sesuai role
    const toolbar = tabEl.querySelector('.table-toolbar');
    if (toolbar) {
      // Toggle write-only buttons (Tambah, Import)
      const writeBtns = toolbar.querySelectorAll('.btn-primary, label[style*="cursor:pointer"]');
      writeBtns.forEach(btn => {
        btn.style.display = perm.write ? 'inline-flex' : 'none';
      });
      // Toggle export button
      const exportBtn = toolbar.querySelector('button[onclick="MasterBKPH.exportExcel()"]');
      if (exportBtn) {
        exportBtn.style.display = perm.export ? 'inline-flex' : 'none';
      }
    }

    const all = await window.db.getAll('bkph'); // Get all including soft-deleted for reactivate feature
    
    // Filter out deleted if not admin, or keep for admin to reactivate
    let activeData = all;
    if (window.app && window.app.currentUser && window.app.currentUser.role !== 'admin') {
      activeData = all.filter(r => !r.deleted_at);
    }

    let data = U().filterAndSort(activeData, state.search, ['kode_bkph', 'nama_bkph', 'alamat', 'keterangan'], state.sortKey, state.sortDir);
    
    if (state.filterStatus) {
      if (state.filterStatus === 'terhapus') {
        data = data.filter(r => r.deleted_at != null);
      } else {
        data = data.filter(r => r.status === state.filterStatus && !r.deleted_at);
      }
    }

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('bkph-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data BKPH</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map((row, idx) => {
        const rowNo = (pager.page - 1) * U().ROWS_PER_PAGE + idx + 1;
        const isDeleted = row.deleted_at != null;
        
        let statusBadge = `<span class="badge ${U().STATUS_AKTIF_BADGE[row.status] || 'badge-inactive'}">${row.status}</span>`;
        if (isDeleted) {
          statusBadge = `<span class="badge badge-danger">Terhapus</span>`;
        }

        let actionHtml = '';
        if (perm.write) {
          if (isDeleted) {
            actionHtml = `
              <button class="btn btn-secondary btn-xs" onclick="MasterBKPH.reactivate('${row.id}')" title="Aktifkan Kembali">🔄 Aktifkan</button>
            `;
          } else {
            actionHtml = `
              <button class="btn btn-secondary btn-xs" onclick="MasterBKPH.openEdit('${row.id}')">✏️ Edit</button>
              <button class="btn btn-danger btn-xs" onclick="MasterBKPH.confirmDelete('${row.id}','${row.nama_bkph}')">🗑️</button>
            `;
          }
        } else {
          actionHtml = `<span class="text-muted-sm">—</span>`;
        }

        return `
        <tr style="${isDeleted ? 'opacity: 0.6; background-color: rgba(255,0,0,0.02);' : ''}">
          <td>${rowNo}</td>
          <td><strong>${row.kode_bkph}</strong></td>
          <td>${row.nama_bkph}</td>
          <td style="color:var(--text-secondary)">
            ${row.alamat || '—'}
            ${row.telepon ? `<div class="text-muted-sm">📞 ${row.telepon}</div>` : ''}
            ${row.email ? `<div class="text-muted-sm">✉️ ${row.email}</div>` : ''}
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="action-btns">
              ${actionHtml}
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(
      document.getElementById('bkph-pagination'),
      pager,
      p => { state.page = p; render(); }
    );
  }

  // ── Open Modal ─────────────────────────────────────────────
  function openAdd() {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak memiliki akses menulis', 'danger'); return; }

    document.getElementById('bkph-form').reset();
    document.getElementById('bkph-id').value = '';
    document.getElementById('bkph-status').value = 'Aktif';
    document.getElementById('bkph-modal-title').textContent = 'Tambah BKPH';
    U().openModal('bkph-modal');
  }

  async function openEdit(id) {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak memiliki akses menulis', 'danger'); return; }

    const row = await window.db.get('bkph', id);
    if (!row) return;

    document.getElementById('bkph-id').value          = row.id;
    document.getElementById('bkph-kode').value        = row.kode_bkph;
    document.getElementById('bkph-nama').value        = row.nama_bkph;
    document.getElementById('bkph-alamat').value      = row.alamat || '';
    document.getElementById('bkph-telepon').value     = row.telepon || '';
    document.getElementById('bkph-email').value       = row.email || '';
    document.getElementById('bkph-keterangan').value  = row.keterangan || '';
    document.getElementById('bkph-status').value      = row.status;
    document.getElementById('bkph-modal-title').textContent = 'Edit BKPH';
    
    U().openModal('bkph-modal');
  }

  // ── Save ───────────────────────────────────────────────────
  async function save(e) {
    e.preventDefault();
    const id       = document.getElementById('bkph-id').value || U().uuid();
    const existing = await window.db.get('bkph', id);
    
    const kode = document.getElementById('bkph-kode').value.trim().toUpperCase();
    const nama = document.getElementById('bkph-nama').value.trim();
    const email = document.getElementById('bkph-email').value.trim();
    const status = document.getElementById('bkph-status').value;

    // Validasi input
    if (!kode) { U().showToast('Kode BKPH wajib diisi', 'danger'); return; }
    if (!nama) { U().showToast('Nama BKPH wajib diisi', 'danger'); return; }

    // Validasi format email
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        U().showToast('Format email tidak valid', 'danger');
        return;
      }
    }

    // Validasi keunikan kode_bkph
    const all = await window.db.getAllActive('bkph');
    const dup = all.find(r => r.kode_bkph === kode && r.id !== id);
    if (dup) {
      U().showToast('Kode BKPH sudah terdaftar di sistem', 'danger');
      return;
    }

    const record = {
      id,
      kode_bkph: kode,
      nama_bkph: nama,
      alamat: document.getElementById('bkph-alamat').value.trim(),
      telepon: document.getElementById('bkph-telepon').value.trim(),
      email: email,
      keterangan: document.getElementById('bkph-keterangan').value.trim(),
      status: status,
      ...U().makeAudit(U().currentActorId(), existing)
    };

    try {
      await window.db.put('bkph', record);
      await window.db.queueSync('bkph', existing ? 'update' : 'create', record);
      U().closeModal('bkph-modal');
      U().showToast(existing ? 'BKPH diperbarui' : 'BKPH berhasil ditambahkan', 'success');
      state.page = 1;
      await render();
    } catch (err) {
      U().showToast('Gagal menyimpan: ' + err.message, 'danger');
    }
  }

  // ── Soft Delete ────────────────────────────────────────────
  function confirmDelete(id, nama) {
    if (!confirm(`Apakah Anda yakin ingin menghapus BKPH "${nama}"?\nData tidak akan dihapus secara permanen.`)) return;
    doDelete(id);
  }

  async function doDelete(id) {
    try {
      const record = await window.db.get('bkph', id);
      if (!record) return;
      
      // Ubah status ke Tidak Aktif saat dihapus logis
      record.status = 'Tidak Aktif';
      record.deleted_at = new Date().toISOString();
      record.updated_at = new Date().toISOString();
      record.updated_by = U().currentActorId();

      await window.db.put('bkph', record);
      await window.db.queueSync('bkph', 'delete', { id });
      
      U().showToast('BKPH berhasil dinonaktifkan (soft delete)');
      state.page = 1;
      await render();
    } catch (err) {
      U().showToast('Gagal menghapus: ' + err.message, 'danger');
    }
  }

  // ── Reactivate (Aktifkan Kembali) ──────────────────────────
  async function reactivate(id) {
    try {
      const record = await window.db.get('bkph', id);
      if (!record) return;

      record.deleted_at = null;
      record.status = 'Aktif';
      record.updated_at = new Date().toISOString();
      record.updated_by = U().currentActorId();

      await window.db.put('bkph', record);
      await window.db.queueSync('bkph', 'update', record);

      U().showToast('BKPH diaktifkan kembali', 'success');
      await render();
    } catch (err) {
      U().showToast('Gagal mengaktifkan kembali: ' + err.message, 'danger');
    }
  }

  // ── Search / Filter / Sort ─────────────────────────────────
  function onSearch(val) { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val; state.page = 1; render(); }
  function onSort(key) {
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = 'asc'; }
    render();
  }

  // ── Export Excel ───────────────────────────────────────────
  async function exportExcel() {
    const perm = getPermissions();
    if (!perm.export) { U().showToast('Anda tidak memiliki akses export', 'danger'); return; }

    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    
    const all = await window.db.getAll('bkph');
    let activeData = all;
    if (window.app && window.app.currentUser && window.app.currentUser.role !== 'admin') {
      activeData = all.filter(r => !r.deleted_at);
    }

    let data = U().filterAndSort(activeData, state.search, ['kode_bkph', 'nama_bkph', 'alamat', 'keterangan'], state.sortKey, state.sortDir);
    
    if (state.filterStatus) {
      if (state.filterStatus === 'terhapus') {
        data = data.filter(r => r.deleted_at != null);
      } else {
        data = data.filter(r => r.status === state.filterStatus && !r.deleted_at);
      }
    }

    const rows = data.map((r, idx) => ({
      No: idx + 1,
      'Kode BKPH': r.kode_bkph,
      'Nama BKPH': r.nama_bkph,
      Alamat: r.alamat || '',
      Telepon: r.telepon || '',
      Email: r.email || '',
      Keterangan: r.keterangan || '',
      Status: r.deleted_at ? 'Terhapus' : r.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master BKPH');
    XLSX.writeFile(wb, `Master_BKPH_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil');
  }

  return { render, openAdd, openEdit, save, confirmDelete, reactivate, onSearch, onFilter, onSort, exportExcel };
})();

window.MasterBKPH = MasterBKPH;
