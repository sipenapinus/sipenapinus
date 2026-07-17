/**
 * SIPENA Lite - Modul Realisasi Produksi (realisasi.js)
 * Mandor TPG menginput data timbangan getah pinus di TPG-nya.
 * Asper / KRPH / Mandor Sadap hanya melihat data sesuai scope.
 */
'use strict';

const RealisasiModule = (() => {
  const U = () => window.SipenaUtils;

  let state = {
    search: '',
    sortKey: 'tanggal',
    sortDir: 'desc',
    page: 1,
    filterBulan: '2026-07', // Default filter bulan Juli 2026 agar konsisten dengan Dashboard
    filterMutu: '',
    filterPeriode: '' // '' = semua, '1' = Periode 1 (1-15), '2' = Periode 2 (16-31)
  };

  const MUTU_OPTIONS = [
    { val: 'Mutu Premium',       label: 'Mutu Premium',       cls: 'badge-warning' },
    { val: 'Mutu Super Premium', label: 'Mutu Super Premium', cls: 'badge-success' },
    { val: 'Mutu 1',             label: 'Mutu 1',             cls: 'badge-info' },
    { val: 'Mutu 2',             label: 'Mutu 2',             cls: 'badge-inactive' }
  ];

  function getPermissions() {
    const user = window.app && window.app.currentUser;
    if (!user) return { view: false, write: false };
    const role = user.role;
    if (role === 'tpg')   return { view: true, write: true };
    if (role === 'admin') return { view: true, write: true };
    if (role === 'bkph' || role === 'krph') return { view: true, write: false };
    if (role === 'mandor') return { view: true, write: false };
    return { view: false, write: false };
  }

  async function _getFilteredRealisasi() {
    const user  = window.app.currentUser;
    const role  = user ? user.role : '';
    const scope = user ? user.scope : null;
    const all   = await window.db.getAllActive('realisasi');

    if (role === 'tpg' && scope)    return all.filter(r => r.tpg_id === scope);
    if (role === 'mandor' && scope) return all.filter(r => r.tpg_id === scope);
    if (role === 'krph' && scope) {
      const allTpg = await window.db.getAllActive('tpg');
      const ids = allTpg.filter(t => t.rph_id === scope).map(t => t.id);
      return all.filter(r => ids.includes(r.tpg_id));
    }
    return all;
  }

  async function _getFilteredROs(allRO, filterBulan) {
    const user  = window.app.currentUser;
    const role  = user ? user.role : '';
    const scope = user ? user.scope : null;

    let ros = allRO;

    // Filter by Month
    if (filterBulan) {
      const parts = filterBulan.split('-');
      if (parts.length === 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        ros = ros.filter(ro => ro.tahun === year && ro.bulan === month);
      }
    }

    // Filter by Scope
    if (role === 'tpg' && scope) {
      const allAP = await window.db.getAllActive('anak_petak');
      const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
      return ros.filter(ro => apIds.includes(ro.areal_id));
    }
    if (role === 'mandor' && scope) {
      const allAP = await window.db.getAllActive('anak_petak');
      const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
      return ros.filter(ro => apIds.includes(ro.areal_id));
    }
    if (role === 'krph' && scope) {
      const allTpg = await window.db.getAllActive('tpg');
      const tpgIds = allTpg.filter(t => t.rph_id === scope).map(t => t.id);
      const allAP = await window.db.getAllActive('anak_petak');
      const apIds = allAP.filter(ap => tpgIds.includes(ap.tpg_id)).map(ap => ap.id);
      return ros.filter(ro => apIds.includes(ro.areal_id));
    }
    return ros;
  }

  function findROKesanggupan(rl, allRO) {
    if (!rl.tanggal || !rl.penyadap_id) return 0;
    const parts = rl.tanggal.split('-');
    if (parts.length !== 3) return 0;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const period = day <= 15 ? 1 : 2;

    const matchingRO = allRO.find(ro => 
      ro.tahun === year &&
      ro.bulan === month &&
      ro.periode === period &&
      ro.penyadap_id === rl.penyadap_id
    );
    return matchingRO ? (matchingRO.kesanggupan || 0) : 0;
  }

  async function updateROHelper() {
    const penyadapId = document.getElementById('real-penyadap').value;
    const tanggalVal = document.getElementById('real-tanggal').value;
    const elHelper = document.getElementById('real-ro-helper');
    if (!elHelper) return;

    if (!penyadapId || !tanggalVal) {
      elHelper.value = '0 kg';
      return;
    }

    const parts = tanggalVal.split('-');
    if (parts.length !== 3) {
      elHelper.value = '0 kg';
      return;
    }
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    const period = day <= 15 ? 1 : 2;

    const allRO = await window.db.getAllActive('ro');
    console.log('[DEBUG RO] allRO:', allRO);
    console.log('[DEBUG RO] Searching for:', { year, month, period, penyadapId });
    
    const matchingRO = allRO.find(ro => {
      const matchTahun = parseInt(ro.tahun) === parseInt(year);
      const matchBulan = parseInt(ro.bulan) === parseInt(month);
      const matchPeriode = parseInt(ro.periode) === parseInt(period);
      const matchPenyadap = ro.penyadap_id === penyadapId;
      console.log(`[DEBUG RO] Comparing item:`, ro, { matchTahun, matchBulan, matchPeriode, matchPenyadap });
      return matchTahun && matchBulan && matchPeriode && matchPenyadap;
    });

    const target = matchingRO ? (matchingRO.kesanggupan || 0) : 0;
    console.log('[DEBUG RO] Result target:', target);
    elHelper.value = target + ' kg';
  }

  async function render() {
    const perm = getPermissions();
    if (!perm.view) return;

    const tableBody = document.getElementById('realisasi-table-body');
    if (!tableBody) return;

    // Set default value for month input filter if not yet populated
    const filterInput = document.getElementById('real-filter-bulan');
    if (filterInput && !filterInput.value) {
      filterInput.value = state.filterBulan;
    }

    const btnInput = document.getElementById('btn-input-realisasi');
    if (btnInput) btnInput.style.display = perm.write ? 'inline-flex' : 'none';

    // Load lists
    const allPndMaster = await window.db.getAllActive('penyadap_master');
    const allPndLegacy = await window.db.getAll('penyadap');
    const allTpg = await window.db.getAllActive('tpg');
    const allRO  = await window.db.getAllActive('ro');
    
    let data = await _getFilteredRealisasi();

    if (state.filterBulan) data = data.filter(r => r.tanggal && r.tanggal.startsWith(state.filterBulan));
    if (state.filterMutu)  data = data.filter(r => r.mutu === state.filterMutu);
    if (state.filterPeriode) {
      const p = parseInt(state.filterPeriode);
      data = data.filter(r => {
        if (!r.tanggal) return false;
        const day = parseInt((r.tanggal.split('-')[2]) || 0);
        return p === 1 ? day <= 15 : day >= 16;
      });
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      data = data.filter(r => {
        const pnd = allPndMaster.find(p => p.id === r.penyadap_id) || allPndLegacy.find(p => p.id === r.penyadap_id);
        const name = pnd ? (pnd.nama || pnd.name || '') : '';
        return name.toLowerCase().includes(q) ||
               (r.tanggal && r.tanggal.includes(q)) ||
               (r.mutu && r.mutu.toLowerCase().includes(q));
      });
    }

    data.sort((a, b) => {
      let va = a[state.sortKey] || '';
      let vb = b[state.sortKey] || '';
      if (state.sortDir === 'asc') return va > vb ? 1 : -1;
      return va < vb ? 1 : -1;
    });

    const pager = U().paginate(data, state.page, 20);

    if (pager.rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="9" class="empty-state">Belum ada data realisasi timbangan getah</td></tr>';
      U().renderPagination(document.getElementById('realisasi-pagination'), pager, p => { state.page = p; render(); });
      _renderSummary([], allRO);
      return;
    }

    tableBody.innerHTML = pager.rows.map(rl => {
      const pnd = allPndMaster.find(p => p.id === rl.penyadap_id) || allPndLegacy.find(p => p.id === rl.penyadap_id);
      const tpg = allTpg.find(t => t.id === rl.tpg_id);
      const mutuOpt = MUTU_OPTIONS.find(m => m.val === rl.mutu) || { cls: 'badge-inactive', label: rl.mutu || '-' };
      const canEdit = perm.write;

      const targetRO = findROKesanggupan(rl, allRO);
      const real = rl.berat_bersih || 0;
      
      let pctText = '-';
      let pctColor = 'var(--text-secondary)';
      if (targetRO > 0) {
        const pct = (real / targetRO) * 100;
        pctText = pct.toFixed(1) + '%';
        if (pct >= 100) {
          pctColor = 'var(--primary)'; // Green / Sukses
        } else if (pct >= 80) {
          pctColor = 'var(--warning)'; // Yellow / Mendekati
        } else {
          pctColor = 'var(--danger)';  // Red / Meleset
        }
      }

      return '<tr>' +
        '<td><strong>' + (rl.tanggal || '-') + '</strong></td>' +
        '<td><strong>' + (pnd ? (pnd.nama || pnd.name) : 'Unknown') + '</strong><div class="text-muted-sm">' + (pnd ? (pnd.nomor || '-') : '-') + '</div></td>' +
        '<td>' + (tpg ? tpg.nama : (rl.tpg_id || '-')) + '</td>' +
        '<td><strong>' + (targetRO > 0 ? targetRO.toLocaleString('id-ID') + ' kg' : '-') + '</strong></td>' +
        '<td><strong>' + real.toLocaleString('id-ID') + ' kg</strong></td>' +
        '<td><span style="font-weight:bold; color:' + pctColor + '">' + pctText + '</span></td>' +
        '<td><span class="badge ' + mutuOpt.cls + '">' + mutuOpt.label + '</span></td>' +
        '<td><span class="badge ' + (rl.sync_status === 'synced' ? 'badge-success' : 'badge-warning') + '">' + (rl.sync_status === 'synced' ? 'Tersinkron' : 'Lokal') + '</span></td>' +
        '<td>' + (canEdit ?
          '<div class="action-btns"><button class="btn btn-secondary btn-xs" onclick="RealisasiModule.openEdit(\'' + rl.id + '\')">Edit</button>' +
          '<button class="btn btn-danger btn-xs" onclick="RealisasiModule.confirmDelete(\'' + rl.id + '\')">X</button></div>'
          : '<span class="text-muted-sm">-</span>') +
        '</td></tr>';
    }).join('');

    U().renderPagination(document.getElementById('realisasi-pagination'), pager, p => { state.page = p; render(); });
    _renderSummary(data, allRO);
    await _renderBelumSetor(allRO, allPndMaster);
  }

  async function _renderSummary(data, allRO) {
    // Calculate total RO hierarchically within filterBulan scope
    const filteredROs = await _getFilteredROs(allRO, state.filterBulan);
    console.log('DEBUG_REALISASI_ROS_DETAILS:', filteredROs.map(ro => `${ro.id}:${ro.penyadap_id}:P${ro.periode}:${ro.kesanggupan}kg`));
    const totalRO = filteredROs.reduce((sum, ro) => sum + (ro.kesanggupan || 0), 0);

    const totalBersih = data.reduce((s, r) => s + (r.berat_bersih || 0), 0);
    const totalTrx    = data.length;
    const pndAktif    = new Set(data.map(r => r.penyadap_id)).size;

    const el = (id) => document.getElementById(id);
    if (el('real-total-ro'))     el('real-total-ro').textContent     = totalRO.toLocaleString('id-ID')     + ' kg';
    if (el('real-total-bersih')) el('real-total-bersih').textContent = totalBersih.toLocaleString('id-ID') + ' kg';
    if (el('real-total-trx'))    el('real-total-trx').textContent    = totalTrx    + ' transaksi';
    if (el('real-total-pnd'))    el('real-total-pnd').textContent    = pndAktif    + ' penyadap';
  }

  async function _renderBelumSetor(allRO, allPndMaster) {
    const tbody  = document.getElementById('real-belum-setor-tbody');
    const countEl = document.getElementById('real-belum-setor-count');
    if (!tbody) return;

    // Tentukan tahun & bulan dari filter aktif
    const filterBulan = state.filterBulan || '';
    const parts = filterBulan.split('-');
    const filterYear  = parts.length === 2 ? parseInt(parts[0]) : null;
    const filterMonth = parts.length === 2 ? parseInt(parts[1]) : null;

    // Ambil semua RO di bulan/tahun yang difilter (scope sesuai role)
    const filteredROs = await _getFilteredROs(allRO, filterBulan);

    // Ambil semua realisasi periode ini (sudah difilter scope)
    let allReal = await _getFilteredRealisasi();
    if (filterBulan) allReal = allReal.filter(r => r.tanggal && r.tanggal.startsWith(filterBulan));

    // Filter periode jika ada
    let rosToCheck = filteredROs;
    if (state.filterPeriode) {
      const p = parseInt(state.filterPeriode);
      rosToCheck = filteredROs.filter(ro => ro.periode === p);
    }

    // Ambil data pendukung
    const allAP    = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const allKehadiran = await window.db.getAllActive('kehadiran');
    const todayStr = new Date().toISOString().split('T')[0];

    const STATUS_LABEL = {
      'hadir':         'Hadir',
      'pembaharuan_1': 'Pembaharuan 1',
      'pembaharuan_2': 'Pembaharuan 2',
      'pembaharuan_3': 'Pembaharuan 3',
      'pengecasan':    'Pengecasan/Stimulasi',
      'ludang':        'Ludang',
      'sakit':         'Sakit',
      'izin':          'Izin',
      'tidak_hadir':   'Tidak Hadir / Alpa'
    };

    // Cari penyadap yang punya RO tapi belum setor realisasi di periode ini
    const belumSetor = [];
    for (const ro of rosToCheck) {
      if (!ro.penyadap_id || (ro.kesanggupan || 0) <= 0) continue;

      // Cek apakah sudah ada realisasi untuk penyadap ini di bulan+periode yang sama
      const sudahSetor = allReal.some(r => {
        if (r.penyadap_id !== ro.penyadap_id) return false;
        if (!r.tanggal) return false;
        const d = parseInt(r.tanggal.split('-')[2] || 0);
        const pRl = d <= 15 ? 1 : 2;
        const yRl = parseInt(r.tanggal.split('-')[0]);
        const mRl = parseInt(r.tanggal.split('-')[1]);
        return yRl === ro.tahun && mRl === ro.bulan && pRl === ro.periode;
      });

      if (!sudahSetor) {
        // Cari data kehadiran hari ini
        const khd = allKehadiran.find(k => k.tanggal === todayStr && k.penyadap_id === ro.penyadap_id);
        const statusLabel = khd ? (STATUS_LABEL[khd.status] || khd.status) : null;

        // Cari info anak petak & petak
        const ap    = allAP.find(a => a.id === ro.areal_id);
        const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
        const petakLabel = petak && ap ? `Petak ${petak.nomor}${ap.huruf}` : (ro.areal_id || '—');

        // Cari nama penyadap
        const pnd = allPndMaster.find(p => p.id === ro.penyadap_id);

        // Badge keterangan
        let ketBadge = 'badge-inactive';
        let ketText  = 'Belum ada data kehadiran';
        if (khd) {
          ketText = `Belum Setor \u2014 ${statusLabel}`;
          if (khd.status === 'sakit')        ketBadge = 'badge-warning';
          else if (khd.status === 'tidak_hadir') ketBadge = 'badge-danger';
          else if (khd.status === 'izin')    ketBadge = 'badge-inactive';
          else                               ketBadge = 'badge-info'; // aktif: hadir/pembaharuan/ludang
        }

        belumSetor.push({ ro, pnd, petakLabel, ketText, ketBadge });
      }
    }

    // Update counter badge
    if (countEl) {
      countEl.textContent = belumSetor.length;
      countEl.className = belumSetor.length === 0
        ? 'badge badge-success'
        : 'badge badge-warning';
    }

    if (belumSetor.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Semua penyadap yang punya RO sudah setor 🎉</td></tr>`;
      return;
    }

    tbody.innerHTML = belumSetor.map(({ ro, pnd, petakLabel, ketText, ketBadge }) => `
      <tr>
        <td>
          <strong>${pnd ? pnd.nama : ro.penyadap_id}</strong>
          <div class="text-muted-sm">${pnd ? pnd.nomor : '—'}</div>
        </td>
        <td><strong>${(ro.kesanggupan || 0).toLocaleString('id-ID')} kg</strong></td>
        <td>${petakLabel}</td>
        <td><span class="badge ${ketBadge}">${ketText}</span></td>
      </tr>
    `).join('');
  }

  async function _loadPenyadapDropdown(selectedId) {
    selectedId = selectedId || '';
    const user = window.app.currentUser;
    const role = user ? user.role : '';
    const scopeTpgId = user ? user.scope : null;

    const allPndMaster = await window.db.getAllActive('penyadap_master');
    const allPndLegacy = await window.db.getAll('penyadap');
    const allPgn = await window.db.getAllActive('penugasan');
    const allAP  = await window.db.getAllActive('anak_petak');

    let filteredPnd = allPndMaster;
    if ((role === 'tpg' || role === 'mandor') && scopeTpgId) {
      const apIds  = allAP.filter(ap => ap.tpg_id === scopeTpgId).map(ap => ap.id);
      
      // We will match penugasan
      const pndIds = allPgn.filter(pg => apIds.includes(pg.anak_petak_id) && pg.aktif === 1).map(pg => pg.penyadap_id);
      filteredPnd = allPndMaster.filter(p => pndIds.includes(p.id));
      
      // Fallback to legacy penyadap if no master penyadap has assignment
      if (filteredPnd.length === 0) {
        filteredPnd = allPndLegacy.filter(p => p.mandor_id === 'usr-mandor');
      }
    } else {
      // Admin/Asper/KRPH can view/select legacy or master penyadaps
      // Merging both lists for dropdown
      const ids = new Set(allPndMaster.map(p => p.id));
      filteredPnd = [...allPndMaster];
      allPndLegacy.forEach(p => {
        if (!ids.has(p.id)) {
          filteredPnd.push({ id: p.id, nama: p.name, nomor: 'LGC' });
        }
      });
    }

    const sel = document.getElementById('real-penyadap');
    if (!sel) return;
    sel.innerHTML = (filteredPnd.length === 0)
      ? '<option value="">- Tidak ada penyadap di wilayah Anda -</option>'
      : '<option value="">- Pilih Penyadap -</option>' +
        filteredPnd.map(p => '<option value="' + p.id + '"' + (p.id === selectedId ? ' selected' : '') + '>' + (p.nama || p.name) + ' (' + p.nomor + ')</option>').join('');
  }

  async function openAdd() {
    const perm = getPermissions();
    if (!perm.write) { U().showToast('Anda tidak berwenang menginput realisasi', 'danger'); return; }
    document.getElementById('real-modal-form').reset();
    document.getElementById('real-id').value = '';
    document.getElementById('real-modal-title').textContent = 'Input Realisasi Timbangan Getah';
    document.getElementById('real-tanggal').value = new Date().toISOString().split('T')[0];
    await _loadPenyadapDropdown();
    await updateROHelper();
    U().openModal('realisasi-modal');
  }

  async function openEdit(id) {
    const perm = getPermissions();
    if (!perm.write) return;
    const rl = await window.db.get('realisasi', id);
    if (!rl) { U().showToast('Data tidak ditemukan', 'danger'); return; }
    document.getElementById('real-id').value = rl.id;
    document.getElementById('real-tanggal').value = rl.tanggal || '';
    document.getElementById('real-berat-bersih').value = rl.berat_bersih || '';
    document.getElementById('real-mutu').value = rl.mutu || '';
    document.getElementById('real-keterangan').value = rl.keterangan || '';
    document.getElementById('real-modal-title').textContent = 'Edit Realisasi Timbangan Getah';
    await _loadPenyadapDropdown(rl.penyadap_id);
    await updateROHelper();
    U().openModal('realisasi-modal');
  }

  async function save(e) {
    e.preventDefault();
    const perm = getPermissions();
    if (!perm.write) return;

    const id       = document.getElementById('real-id').value || U().uuid();
    const existing = await window.db.get('realisasi', id);

    const penyadapId  = document.getElementById('real-penyadap').value;
    if (!penyadapId)  { U().showToast('Pilih penyadap terlebih dahulu', 'danger'); return; }

    const beratBersih = parseFloat(document.getElementById('real-berat-bersih').value) || 0;
    if (beratBersih <= 0) { U().showToast('Berat bersih harus diisi', 'danger'); return; }

    const user  = window.app.currentUser;
    const tpgId = user ? user.scope : null;

    const record = {
      id,
      penyadap_id:  penyadapId,
      tpg_id:       tpgId,
      tanggal:      document.getElementById('real-tanggal').value,
      berat_kotor:  beratBersih, // Set same as bersih as kotor is hidden
      berat_bersih: beratBersih,
      mutu:         document.getElementById('real-mutu').value,
      keterangan:   document.getElementById('real-keterangan').value.trim(),
      sync_status:  'local',
      ...U().makeAudit(U().currentActorId(), existing)
    };

    await window.db.put('realisasi', record);
    await window.db.queueSync('realisasi', existing ? 'update' : 'create', record);
    U().closeModal('realisasi-modal');
    U().showToast(existing ? 'Data realisasi diperbarui' : 'Realisasi berhasil dicatat');
    state.page = 1;
    await render();
    if (window.DashboardModule) window.DashboardModule.init();
  }

  async function confirmDelete(id) {
    if (!confirm('Hapus data realisasi ini?')) return;
    await window.db.softDelete('realisasi', id, U().currentActorId());
    await window.db.queueSync('realisasi', 'delete', { id });
    U().showToast('Data realisasi dihapus');
    state.page = 1;
    await render();
  }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const allPndMaster = await window.db.getAllActive('penyadap_master');
    const allPndLegacy = await window.db.getAll('penyadap');
    const allTpg = await window.db.getAllActive('tpg');
    const allRO  = await window.db.getAllActive('ro');
    const data   = await _getFilteredRealisasi();
    
    const rows = data.map(r => {
      const pnd = allPndMaster.find(p => p.id === r.penyadap_id) || allPndLegacy.find(p => p.id === r.penyadap_id);
      const tpg = allTpg.find(t => t.id === r.tpg_id);
      const targetRO = findROKesanggupan(r, allRO);
      const real = r.berat_bersih || 0;
      const pct = targetRO > 0 ? ((real / targetRO) * 100).toFixed(1) + '%' : '-';
      
      return {
        'Tanggal Setor':     r.tanggal || '',
        'Penyadap':          pnd ? (pnd.nama || pnd.name) : 'Unknown',
        'No. Penyadap':      pnd ? (pnd.nomor || '-') : '-',
        'TPG':               tpg ? tpg.nama : '',
        'Target RO (kg)':    targetRO > 0 ? targetRO : '-',
        'Realisasi Bersih (kg)': real,
        'Pencapaian (%)':    pct,
        'Mutu':              r.mutu || '',
        'Keterangan':        r.keterangan || '',
        'Status Sinkron':    r.sync_status === 'synced' ? 'Tersinkron' : 'Lokal'
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Realisasi Produksi');
    XLSX.writeFile(wb, 'Realisasi_' + U().today() + '.xlsx');
    U().showToast('Export Excel berhasil');
  }

  function onSearch(val)      { state.search = val; state.page = 1; render(); }
  function onFilter(key, val) { state[key] = val;   state.page = 1; render(); }
  function onSort(key) {
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = 'desc'; }
    render();
  }

  return { render, openAdd, openEdit, save, confirmDelete, exportExcel, onSearch, onFilter, onSort, updateROHelper };
})();

window.RealisasiModule = RealisasiModule;
