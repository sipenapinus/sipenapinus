/**
 * SIPENA Lite — Modul Laporan dengan Kop Surat & Print Layout
 */
'use strict';

const LaporanModule = (() => {
  const U = () => window.SipenaUtils;

  // State local untuk modul laporan
  let reportData = [];
  let reportType = 'realisasi'; // 'realisasi' | 'kehadiran'

  function init() {
    // Set default input tanggal
    const today = U().today();
    const elTanggal = document.getElementById('rpt-tanggal');
    const elAwal = document.getElementById('rpt-tgl-awal');
    const elAkhir = document.getElementById('rpt-tgl-akhir');

    if (elTanggal) elTanggal.value = today;
    if (elAwal) elAwal.value = today.substring(0, 8) + '01'; // awal bulan
    if (elAkhir) elAkhir.value = today;

    // Set Kop Surat dinamis berdasarkan wilayah kerja user saat ini
    updateKopLabels();

    onChangeJenis();
    onChangeFilterTipe();
    renderReport();
  }

  function updateKopLabels() {
    const user = window.app.currentUser;
    const role = user ? user.role : '';
    const elBkph = document.getElementById('kop-bkph');
    const elSignAsper = document.getElementById('rpt-sign-asper');
    const elSignAsperNip = document.getElementById('rpt-sign-asper-nip');

    const elSignMaker = document.getElementById('rpt-sign-maker');
    const elSignMakerNip = document.getElementById('rpt-sign-maker-nip');
    const elDateLabel = document.getElementById('rpt-date-label');

    if (elSignMaker && user) {
      elSignMaker.textContent = user.nama_lengkap || user.username;
      elSignMakerNip.textContent = user.nip ? `NIP. ${user.nip}` : '—';
    }

    if (elDateLabel) {
      elDateLabel.innerHTML = `Bantarkawung, ${U().formatDate(U().today())}<br><strong>Petugas Pembuat Laporan</strong>`;
    }

    // Cari Asper/KBPH aktif secara dinamis dari database user
    window.db.getAllActive('users').then(users => {
      const asperUser = users.find(u => u.role === 'bkph');
      if (asperUser) {
        if (elSignAsper) elSignAsper.textContent = asperUser.nama_lengkap;
        if (elSignAsperNip) elSignAsperNip.textContent = asperUser.nip ? `NIP. ${asperUser.nip}` : '—';
      } else {
        if (elSignAsper) elSignAsper.textContent = 'DWI ANGGONO PUTRA S.Hut';
        if (elSignAsperNip) elSignAsperNip.textContent = '—';
      }
    }).catch(err => {
      console.error('[Laporan] Gagal memuat tanda tangan Asper:', err);
      if (elSignAsper) elSignAsper.textContent = 'DWI ANGGONO PUTRA S.Hut';
      if (elSignAsperNip) elSignAsperNip.textContent = '—';
    });
  }

  function onChangeJenis() {
    const jenis = document.getElementById('rpt-jenis').value;
    reportType = jenis;

    const elTitle = document.getElementById('rpt-title');
    if (elTitle) {
      elTitle.textContent = jenis === 'realisasi' 
        ? 'LAPORAN REALISASI PRODUKSI GETAH' 
        : 'LAPORAN KEHADIRAN & KEGIATAN PENYADAP';
    }
  }

  function onChangeFilterTipe() {
    const tipe = document.getElementById('rpt-filter-tipe').value;
    
    const pnlPeriode = document.getElementById('rpt-input-periode');
    const pnlHarian = document.getElementById('rpt-input-harian');
    const pnlRentang = document.getElementById('rpt-input-rentang');

    if (pnlPeriode) pnlPeriode.style.display = tipe === 'periode' ? 'flex' : 'none';
    if (pnlHarian) pnlHarian.style.display = tipe === 'harian' ? 'block' : 'none';
    
    // For rentang
    if (pnlRentang) {
      pnlRentang.style.display = tipe === 'rentang' ? 'flex' : 'none';
      const childs = pnlRentang.querySelectorAll('.form-group');
      childs.forEach(c => c.style.display = 'block');
    }
  }

  async function renderReport() {
    const jenis = document.getElementById('rpt-jenis').value;
    const tipe = document.getElementById('rpt-filter-tipe').value;

    const allPenyadap = await window.db.getAllActive('penyadap_master');
    const allPetak = await window.db.getAllActive('petak');
    const allAP = await window.db.getAllActive('anak_petak');
    const allTpg = await window.db.getAllActive('tpg');
    const allRph = await window.db.getAllActive('rph');
    const allPgn = await window.db.getAllActive('penugasan');

    let rawData = [];
    let dateLabel = '';

    // 1. Get raw records based on type
    if (jenis === 'realisasi') {
      rawData = await window.db.getAllActive('realisasi');
    } else {
      rawData = await window.db.getAllActive('kehadiran');
    }

    // 2. Filter by Date / Time
    let filtered = [];
    if (tipe === 'harian') {
      const tgl = document.getElementById('rpt-tanggal').value;
      filtered = rawData.filter(r => r.tanggal === tgl);
      dateLabel = `Hari/Tanggal: ${U().formatDate(tgl)}`;
    } else if (tipe === 'rentang') {
      const awal = document.getElementById('rpt-tgl-awal').value;
      const akhir = document.getElementById('rpt-tgl-akhir').value;
      filtered = rawData.filter(r => r.tanggal >= awal && r.tanggal <= akhir);
      dateLabel = `Rentang Tanggal: ${U().formatDate(awal)} s/d ${U().formatDate(akhir)}`;
    } else if (tipe === 'periode') {
      const bln = parseInt(document.getElementById('rpt-bulan').value);
      const prd = parseInt(document.getElementById('rpt-periode').value);
      const blnNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      
      filtered = rawData.filter(r => {
        const parts = r.tanggal.split('-');
        if (parts.length !== 3) return false;
        const rYear = parseInt(parts[0]);
        const rMonth = parseInt(parts[1]);
        const rDay = parseInt(parts[2]);

        if (rYear !== 2026 || rMonth !== bln) return false;
        if (prd === 1) return rDay <= 15;
        if (prd === 2) return rDay > 15;
        return false;
      });
      dateLabel = `Bulan: ${blnNames[bln-1]} 2026 — Periode ${prd}`;
    }

    // 3. Filter by User Scope (Asper, KRPH, Mandor TPG)
    const user = window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : null;

    if (scope && (role === 'tpg' || role === 'mandor')) {
      if (jenis === 'realisasi') {
        filtered = filtered.filter(r => r.tpg_id === scope);
      } else {
        const activePgns = allPgn.filter(pg => pg.aktif === 1);
        const apOfTpg = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
        const pndIds = activePgns.filter(pg => apOfTpg.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id);
        filtered = filtered.filter(k => pndIds.includes(k.penyadap_id));
      }
    } else if (scope && role === 'krph') {
      const tpgs = allTpg.filter(t => t.rph_id === scope).map(t => t.id);
      if (jenis === 'realisasi') {
        filtered = filtered.filter(r => tpgs.includes(r.tpg_id));
      } else {
        const activePgns = allPgn.filter(pg => pg.aktif === 1);
        const apOfRph = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
        const pndIds = activePgns.filter(pg => apOfRph.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id);
        filtered = filtered.filter(k => pndIds.includes(k.penyadap_id));
      }
    } else if (scope && role === 'bkph') {
      const rphs = allRph.filter(r => r.bkph_id === scope).map(r => r.id);
      const tpgs = allTpg.filter(t => rphs.includes(t.rph_id)).map(t => t.id);
      if (jenis === 'realisasi') {
        filtered = filtered.filter(r => tpgs.includes(r.tpg_id));
      } else {
        const activePgns = allPgn.filter(pg => pg.aktif === 1);
        const apOfBkph = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
        const pndIds = activePgns.filter(pg => apOfBkph.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id);
        filtered = filtered.filter(k => pndIds.includes(k.penyadap_id));
      }
    }

    // Urutkan berdasarkan tanggal
    filtered.sort((a,b) => a.tanggal.localeCompare(b.tanggal));
    reportData = filtered;

    // Set subtitle
    const elSub = document.getElementById('rpt-subtitle');
    if (elSub) elSub.textContent = dateLabel;

    // 4. Render Table
    const thead = document.getElementById('rpt-table-head');
    const tbody = document.getElementById('rpt-table-body');
    if (!thead || !tbody) return;

    if (jenis === 'realisasi') {
      thead.innerHTML = `<tr>
        <th style="width:40px;text-align:center;">No</th>
        <th>Tanggal</th>
        <th>Penyadap</th>
        <th>Petak</th>
        <th>TPG</th>
        <th style="text-align:right;">Target (Kg)</th>
        <th style="text-align:right;">Realisasi Bersih (Kg)</th>
        <th>Mutu</th>
        <th>Keterangan</th>
      </tr>`;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding:2rem;color:#666;text-align:center;">Tidak ada data realisasi untuk periode filter ini</td></tr>`;
      } else {
        const allRO = await window.db.getAllActive('ro');
        tbody.innerHTML = filtered.map((row, idx) => {
          const psy = allPenyadap.find(p => p.id === row.penyadap_id);
          const tpg = allTpg.find(t => t.id === row.tpg_id);
          
          // Cari Petak penugasan
          const pgn = allPgn.find(p => p.penyadap_id === row.penyadap_id && p.aktif === 1);
          let petakLabel = '—';
          if (pgn) {
            const ap = allAP.find(a => a.id === pgn.anak_petak_id);
            const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
            petakLabel = ptk ? `Petak ${ptk.nomor}` : '—';
          }

          // Cari Target (RO Kesanggupan)
          const targetRO = findROKesanggupan(row, allRO);

          return `<tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${U().formatDate(row.tanggal)}</td>
            <td><strong>${psy ? psy.nama : '—'}</strong><br><span style="font-size:.75rem;color:#555;">${psy ? psy.nomor : ''}</span></td>
            <td>${petakLabel}</td>
            <td>${tpg ? tpg.nama : '—'}</td>
            <td style="text-align:right;font-weight:600;">${targetRO.toLocaleString('id-ID')} kg</td>
            <td style="text-align:right;font-weight:700;color:#1b4d3e;">${(row.berat_bersih || 0).toLocaleString('id-ID')} kg</td>
            <td>${row.mutu || '—'}</td>
            <td>${row.keterangan || '—'}</td>
          </tr>`;
        }).join('');
      }
    } else {
      // Kehadiran
      thead.innerHTML = `<tr>
        <th style="width:40px;text-align:center;">No</th>
        <th>Tanggal</th>
        <th>Penyadap</th>
        <th>Petak Kerja</th>
        <th>Status Kehadiran</th>
        <th>Keterangan</th>
      </tr>`;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:2rem;color:#666;text-align:center;">Tidak ada data kehadiran untuk periode filter ini</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map((row, idx) => {
          const psy = allPenyadap.find(p => p.id === row.penyadap_id);
          
          // Cari Petak penugasan
          const pgn = allPgn.find(p => p.penyadap_id === row.penyadap_id && p.aktif === 1);
          let petakLabel = '—';
          if (pgn) {
            const ap = allAP.find(a => a.id === pgn.anak_petak_id);
            const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
            petakLabel = ptk ? `Petak ${ptk.nomor}` : '—';
          }

          // Kategori status kehadiran badge
          const status = row.kategori || 'Tidak Hadir';
          let statusColor = '#000';
          let statusBg = '#f2f2f2';

          if (['Pembaruan 1', 'Pembaruan 2', 'Pembaruan 3', 'Aktif'].includes(status)) {
            statusColor = '#1b4d3e';
            statusBg = '#e8f5e9';
          } else if (['Sakit', 'Izin'].includes(status)) {
            statusColor = '#b78103';
            statusBg = '#fffde7';
          } else {
            statusColor = '#c62828';
            statusBg = '#ffebee';
          }

          return `<tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${U().formatDate(row.tanggal)}</td>
            <td><strong>${psy ? psy.nama : '—'}</strong><br><span style="font-size:.75rem;color:#555;">${psy ? psy.nomor : ''}</span></td>
            <td>${petakLabel}</td>
            <td><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:.8rem;font-weight:600;color:${statusColor};background:${statusBg};">${status}</span></td>
            <td>${row.keterangan || '—'}</td>
          </tr>`;
        }).join('');
      }
    }
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

  function printReport() {
    window.print();
  }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    if (reportData.length === 0) { U().showToast('Laporan kosong, tidak ada data untuk diekspor', 'warning'); return; }

    const allPenyadap = await window.db.getAllActive('penyadap_master');
    const allPetak = await window.db.getAllActive('petak');
    const allAP = await window.db.getAllActive('anak_petak');
    const allTpg = await window.db.getAllActive('tpg');
    const allPgn = await window.db.getAllActive('penugasan');

    let exportRows = [];
    const filename = `Laporan_${reportType}_${U().today()}`;

    if (reportType === 'realisasi') {
      const allRO = await window.db.getAllActive('ro');
      exportRows = reportData.map((r, idx) => {
        const psy = allPenyadap.find(p => p.id === r.penyadap_id);
        const tpg = allTpg.find(t => t.id === r.tpg_id);
        const pgn = allPgn.find(p => p.penyadap_id === r.penyadap_id && p.aktif === 1);
        let petakLabel = '—';
        if (pgn) {
          const ap = allAP.find(a => a.id === pgn.anak_petak_id);
          const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
          petakLabel = ptk ? ptk.nomor : '—';
        }
        const targetRO = findROKesanggupan(r, allRO);

        return {
          'No': idx + 1,
          'Tanggal': r.tanggal,
          'ID Penyadap': psy ? psy.nomor : '',
          'Nama Penyadap': psy ? psy.nama : '',
          'Petak': petakLabel,
          'TPG': tpg ? tpg.nama : '',
          'Target RO (Kg)': targetRO,
          'Realisasi Bersih (Kg)': r.berat_bersih || 0,
          'Mutu': r.mutu || '',
          'Keterangan': r.keterangan || ''
        };
      });
    } else {
      exportRows = reportData.map((r, idx) => {
        const psy = allPenyadap.find(p => p.id === r.penyadap_id);
        const pgn = allPgn.find(p => p.penyadap_id === r.penyadap_id && p.aktif === 1);
        let petakLabel = '—';
        if (pgn) {
          const ap = allAP.find(a => a.id === pgn.anak_petak_id);
          const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
          petakLabel = ptk ? ptk.nomor : '—';
        }

        return {
          'No': idx + 1,
          'Tanggal': r.tanggal,
          'ID Penyadap': psy ? psy.nomor : '',
          'Nama Penyadap': psy ? psy.nama : '',
          'Petak': petakLabel,
          'Status Kehadiran': r.kategori || 'Tidak Hadir',
          'Keterangan': r.keterangan || ''
        };
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    U().showToast('Laporan berhasil diekspor ke Excel!');
  }

  return { init, onChangeJenis, onChangeFilterTipe, renderReport, printReport, exportExcel };
})();

window.LaporanModule = LaporanModule;
