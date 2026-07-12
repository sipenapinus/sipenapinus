/**
 * SIPENA Lite — Master User
 * Dipindah dari Pengaturan ke Master Data.
 * Hanya Admin yang dapat mengakses.
 */
'use strict';

const MasterUser = (() => {
  const U = () => window.SipenaUtils;

  let state = { search: '', sortKey: 'nama_lengkap', sortDir: 'asc', filterRole: '', filterStatus: '', page: 1 };

  async function render() {
    const all = await window.db.getAllActive('users');
    const allBkph = await window.db.getAllActive('bkph');
    const allRph  = await window.db.getAllActive('rph');
    const allTpg  = await window.db.getAllActive('tpg');

    let data  = all;
    if (state.filterRole)   data = data.filter(r => r.role === state.filterRole);
    if (state.filterStatus) data = data.filter(r => r.status === state.filterStatus);
    data = U().filterAndSort(data, state.search, ['nama_lengkap', 'username', 'nip'], state.sortKey, state.sortDir);

    const pager = U().paginate(data, state.page);
    const tbody = document.getElementById('user-master-tbody');
    if (!tbody) return;

    if (pager.rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Belum ada data Pengguna</td></tr>`;
    } else {
      tbody.innerHTML = pager.rows.map(row => {
        const roleBadge = U().ROLE_BADGE[row.role] || 'badge-inactive';
        const roleLabel = U().ROLE_LABELS[row.role] || row.role;
        const statusBadge = U().STATUS_AKTIF_BADGE[row.status] || 'badge-inactive';
        const statusLabel = U().STATUS_AKTIF_LABEL[row.status] || row.status;

        // Lookup nama wilayah kerja berdasarkan role & scope ID
        let scopeLabel = '—';
        if (row.scope) {
          if (row.role === 'bkph') {
            const item = allBkph.find(b => b.id === row.scope);
            scopeLabel = item ? `${item.nama_bkph} (${item.kode_bkph})` : row.scope;
          } else if (row.role === 'krph') {
            const item = allRph.find(r => r.id === row.scope);
            scopeLabel = item ? `${item.nama} (${item.kode})` : row.scope;
          } else if (row.role === 'tpg' || row.role === 'mandor') {
            const item = allTpg.find(t => t.id === row.scope);
            scopeLabel = item ? `${item.nama} (${item.kode})` : row.scope;
          } else {
            scopeLabel = row.scope;
          }
        }

        return `<tr>
          <td>
            <strong>${row.nama_lengkap}</strong>
            <div class="text-muted-sm">NIP: ${row.nip || '—'}</div>
          </td>
          <td><code>${row.username}</code></td>
          <td><span class="badge ${roleBadge}">${roleLabel}</span></td>
          <td style="color:var(--text-secondary)">${scopeLabel}</td>
          <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
          <td>${U().formatDate(row.created_at)}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-secondary btn-xs" onclick="MasterUser.openEdit('${row.id}')">✏️ Edit</button>
              ${row.id !== (window.app && window.app.currentUser ? window.app.currentUser.id : '') ?
                `<button class="btn btn-danger btn-xs" onclick="MasterUser.confirmDelete('${row.id}','${row.nama_lengkap}')">🗑️</button>` :
                `<span class="text-muted-sm">Aktif</span>`
              }
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    U().renderPagination(document.getElementById('user-master-pagination'), pager, p => { state.page = p; render(); });
  }

  async function _loadScopeSelect(role, selectedScope = '') {
    const rphGroup = document.getElementById('user-rph-group');
    const rphSel   = document.getElementById('user-rph-select');
    const group    = document.getElementById('user-scope-group');
    const label    = document.getElementById('user-scope-label');
    const sel      = document.getElementById('user-scope-select');
    
    if (!group || !sel || !rphGroup || !rphSel) return;

    // Reset visibilitas dan konten
    rphGroup.style.display = 'none';
    group.style.display = 'none';
    sel.innerHTML = '';
    rphSel.innerHTML = '';

    if (role === 'bkph') {
      const items = await window.db.getAllActive('bkph');
      if (label) label.textContent = 'BKPH';
      if (items.length > 0) {
        group.style.display = 'block';
        sel.innerHTML = `<option value="">— Pilih BKPH —</option>` +
          items.map(i => `<option value="${i.id}" ${i.id === selectedScope ? 'selected' : ''}>${i.nama_bkph} (${i.kode_bkph})</option>`).join('');
      }
    } else if (role === 'krph') {
      const items = await window.db.getAllActive('rph');
      if (label) label.textContent = 'RPH';
      if (items.length > 0) {
        group.style.display = 'block';
        sel.innerHTML = `<option value="">— Pilih RPH —</option>` +
          items.map(i => `<option value="${i.id}" ${i.id === selectedScope ? 'selected' : ''}>${i.nama} (${i.kode})</option>`).join('');
      }
    } else if (role === 'tpg' || role === 'mandor') {
      // Tampilkan RPH filter di atas TPG
      rphGroup.style.display = 'block';
      group.style.display = 'block';
      if (label) label.textContent = 'TPG';

      const allRph = await window.db.getAllActive('rph');
      const allTpg = await window.db.getAllActive('tpg');

      // Cari RPH dari TPG yang terpilih
      let matchedRphId = '';
      if (selectedScope) {
        const currentTpg = allTpg.find(t => t.id === selectedScope);
        if (currentTpg) matchedRphId = currentTpg.rph_id;
      }

      // Isi dropdown RPH
      rphSel.innerHTML = `<option value="">— Pilih RPH untuk Filter TPG —</option>` +
        allRph.map(r => `<option value="${r.id}" ${r.id === matchedRphId ? 'selected' : ''}>${r.nama} (${r.kode})</option>`).join('');

      // Isi dropdown TPG
      if (matchedRphId) {
        const filteredTpgs = allTpg.filter(t => t.rph_id === matchedRphId);
        sel.innerHTML = `<option value="">— Pilih TPG —</option>` +
          filteredTpgs.map(t => `<option value="${t.id}" ${t.id === selectedScope ? 'selected' : ''}>${t.nama} (${t.kode})</option>`).join('');
      } else {
        sel.innerHTML = `<option value="">— Pilih RPH Terlebih Dahulu —</option>`;
      }
    }
  }

  async function onRphChange() {
    const rphId = document.getElementById('user-rph-select').value;
    const sel   = document.getElementById('user-scope-select');
    if (!sel) return;

    if (!rphId) {
      sel.innerHTML = `<option value="">— Pilih RPH Terlebih Dahulu —</option>`;
      return;
    }

    const allTpg = await window.db.getAllActive('tpg');
    const filteredTpgs = allTpg.filter(t => t.rph_id === rphId);

    if (filteredTpgs.length > 0) {
      sel.innerHTML = `<option value="">— Pilih TPG —</option>` +
        filteredTpgs.map(t => `<option value="${t.id}">${t.nama} (${t.kode})</option>`).join('');
    } else {
      sel.innerHTML = `<option value="">— Tidak ada TPG di RPH ini —</option>`;
    }
  }

  async function onRoleChange() {
    const role = document.getElementById('user-role-select').value;
    await _loadScopeSelect(role);
  }

  function openAdd() {
    document.getElementById('user-master-form').reset();
    document.getElementById('user-master-id').value = '';
    document.getElementById('user-master-modal-title').textContent = 'Tambah Pengguna';
    document.getElementById('user-rph-group').style.display = 'none';
    document.getElementById('user-scope-group').style.display = 'none';
    document.getElementById('user-password-group').style.display = 'block';
    
    const pwdInput = document.getElementById('user-master-password');
    pwdInput.value = '';
    pwdInput.placeholder = 'Password akun baru';
    pwdInput.type = 'password';
    pwdInput.required = true;
    const toggleBtn = pwdInput.nextElementSibling;
    if (toggleBtn && toggleBtn.tagName === 'BUTTON') {
      toggleBtn.textContent = '👁️';
    }

    U().openModal('user-master-modal');
  }

  async function openEdit(id) {
    const row = await window.db.get('users', id);
    if (!row) return;
    document.getElementById('user-master-id').value       = row.id;
    document.getElementById('user-master-nama').value     = row.nama_lengkap;
    document.getElementById('user-master-nip').value      = row.nip || '';
    document.getElementById('user-master-username').value = row.username;
    document.getElementById('user-role-select').value     = row.role;
    document.getElementById('user-master-status').value   = row.status;
    
    const pwdInput = document.getElementById('user-master-password');
    pwdInput.value = '';
    pwdInput.placeholder = '•••••••• (Tetap aman di database, isi jika ingin diganti)';
    pwdInput.type = 'password';
    pwdInput.required = false;
    const toggleBtn = pwdInput.nextElementSibling;
    if (toggleBtn && toggleBtn.tagName === 'BUTTON') {
      toggleBtn.textContent = '👁️';
    }

    document.getElementById('user-master-modal-title').textContent = 'Edit Pengguna';
    await _loadScopeSelect(row.role, row.scope || '');
    U().openModal('user-master-modal');
  }

  async function save(e) {
    e.preventDefault();
    try {
      const id       = document.getElementById('user-master-id').value || U().uuid();
      const existing = await window.db.get('users', id);
      const username = document.getElementById('user-master-username').value.trim().toLowerCase();
      const password = document.getElementById('user-master-password').value;
      const role     = document.getElementById('user-role-select').value;

      if (!username) { U().showToast('Username wajib diisi', 'danger'); return; }

      // Validasi username unik — cek SEMUA user termasuk yang soft-deleted
      // karena IndexedDB unique index berlaku untuk semua record
      const allUsers = await window.db.getAll('users');
      const dup = allUsers.find(u => u.username === username && u.id !== id);
      if (dup) {
        if (dup.deleted_at) {
          U().showToast(`Username "${username}" sudah dipakai user yang dinonaktifkan. Gunakan username lain.`, 'danger');
        } else {
          U().showToast('Username sudah digunakan', 'danger');
        }
        return;
      }

      let password_hash = existing ? existing.password_hash : '';
      if (password) {
        password_hash = await _doHash(password);
        if (!password_hash) {
          U().showToast('Gagal mengenkripsi password. Pastikan aplikasi diakses via localhost.', 'danger');
          return;
        }
      }
      if (!password_hash) { U().showToast('Password wajib diisi untuk pengguna baru', 'danger'); return; }

      const scopeSel = document.getElementById('user-scope-select');
      const record = {
        id, username, password_hash, role,
        nama_lengkap: document.getElementById('user-master-nama').value.trim(),
        nip:          document.getElementById('user-master-nip').value.trim(),
        scope:        scopeSel && scopeSel.value ? scopeSel.value : null,
        status:       document.getElementById('user-master-status').value,
        ...U().makeAudit(U().currentActorId(), existing)
      };

      await window.db.put('users', record);
      await window.db.queueSync('users', existing ? 'update' : 'create', { ...record, password_hash: '[REDACTED]' });
      U().closeModal('user-master-modal');
      U().showToast(existing ? 'Pengguna diperbarui' : 'Pengguna berhasil ditambahkan');
      state.page = 1;
      await render();
    } catch (err) {
      console.error('[MasterUser.save] Error:', err);
      U().showToast('Gagal menyimpan: ' + err.message, 'danger');
    }
  }

  /**
   * Hash password menggunakan Web Crypto API (SHA-256).
   * Fallback ke hash sederhana (base64) jika crypto.subtle tidak tersedia
   * (misalnya akses via HTTP non-localhost).
   */
  async function _doHash(password) {
    try {
      // Cek window.hashPassword (dari app.js)
      if (typeof window.hashPassword === 'function') {
        return await window.hashPassword(password);
      }
      // Cek hashPassword global langsung
      if (typeof hashPassword === 'function') {
        return await hashPassword(password);
      }
      // Fallback manual: gunakan crypto.subtle langsung
      if (window.crypto && window.crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(password);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      // Fallback terakhir: btoa sederhana (tidak aman, hanya untuk offline dev)
      console.warn('[MasterUser] crypto.subtle tidak tersedia, menggunakan fallback encoding.');
      return btoa(unescape(encodeURIComponent(password + '_sipena_salt')));
    } catch (err) {
      console.error('[MasterUser._doHash] Error:', err);
      return null;
    }
  }

  async function confirmDelete(id, nama) {
    if (!confirm(`Nonaktifkan akun "${nama}"?\nAkun akan di-soft-delete dan tidak dapat login.`)) return;
    await window.db.softDelete('users', id, U().currentActorId());
    U().showToast('Akun pengguna dinonaktifkan');
    state.page = 1;
    await render();
  }

  function onSearch(val) { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val; state.page = 1; render(); }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const all = await window.db.getAllActive('users');
    const rows = all.map(r => ({
      Nama: r.nama_lengkap, NIP: r.nip || '', Username: r.username,
      Role: U().ROLE_LABELS[r.role] || r.role, Wilayah: r.scope || '',
      Status: r.status, Dibuat: U().formatDate(r.created_at)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master User');
    XLSX.writeFile(wb, `Master_User_${U().today()}.xlsx`);
    U().showToast('Export Excel berhasil');
  }

  return { render, openAdd, openEdit, save, confirmDelete, onSearch, onFilter, onRoleChange, onRphChange, exportExcel };
})();

window.MasterUser = MasterUser;
