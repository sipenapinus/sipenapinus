/**
 * SIPENA Lite — Modul Laporan dengan Kop Surat & Print Layout
 */
'use strict';

const LaporanModule = (() => {
  const U = () => window.SipenaUtils;

  // State local untuk modul laporan
  let reportData = [];
  let reportType = 'realisasi'; // 'realisasi' | 'kehadiran' | 'pantauan'

  async function init() {
    // Set default input tanggal
    const today = U().today();
    const elTanggal = document.getElementById('rpt-tanggal');
    const elAwal = document.getElementById('rpt-tgl-awal');
    const elAkhir = document.getElementById('rpt-tgl-akhir');

    if (elTanggal) elTanggal.value = today;
    if (elAwal) elAwal.value = today.substring(0, 8) + '01'; // awal bulan
    if (elAkhir) elAkhir.value = today;

    // Set default bulan dan periode berdasarkan hari ini
    const todayDate = new Date();
    const currentMonth = todayDate.getMonth() + 1;
    const currentPeriod = todayDate.getDate() <= 15 ? 1 : 2;

    const elBulan = document.getElementById('rpt-bulan');
    const elPeriode = document.getElementById('rpt-periode');
    if (elBulan) elBulan.value = currentMonth;
    if (elPeriode) elPeriode.value = currentPeriod;

    // Set Kop Surat dinamis berdasarkan wilayah kerja user saat ini
    updateKopLabels();

    await initFilters();

    onChangeJenis();
    onChangeFilterTipe();
    await renderReport();
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

  async function onChangeJenis() {
    const jenis = document.getElementById('rpt-jenis').value;
    reportType = jenis;

    const elTitle = document.getElementById('rpt-title');
    if (elTitle) {
      if (jenis === 'realisasi') {
        elTitle.textContent = 'LAPORAN REALISASI PRODUKSI GETAH';
      } else if (jenis === 'kehadiran') {
        elTitle.textContent = 'LAPORAN KEHADIRAN & KEGIATAN PENYADAP';
      } else if (jenis === 'pantauan') {
        elTitle.textContent = 'PANTAUAN KEGIATAN SADAPAN';
      }
    }

    const elTipe = document.getElementById('rpt-filter-tipe');
    if (elTipe) {
      if (jenis === 'pantauan') {
        elTipe.value = 'periode';
        elTipe.disabled = true;
      } else {
        elTipe.disabled = false;
      }
    }
    onChangeFilterTipe();
    await renderReport();
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

    const year = 2026;
    let bln = 1;
    let prd = 1;
    
    const rptBlnEl = document.getElementById('rpt-bulan');
    const rptPrdEl = document.getElementById('rpt-periode');
    if (rptBlnEl) bln = parseInt(rptBlnEl.value);
    if (rptPrdEl) prd = parseInt(rptPrdEl.value);

    let dateLabel = '';
    let dates = [];

    // Setup dates array
    if (tipe === 'harian') {
      const tgl = document.getElementById('rpt-tanggal').value;
      dates = [tgl];
      dateLabel = `Hari/Tanggal: ${U().formatDate(tgl)}`;
    } else if (tipe === 'rentang') {
      const awal = document.getElementById('rpt-tgl-awal').value;
      const akhir = document.getElementById('rpt-tgl-akhir').value;
      
      let curr = new Date(awal);
      const end = new Date(akhir);
      while (curr <= end) {
        dates.push(curr.toISOString().substring(0, 10));
        curr.setDate(curr.getDate() + 1);
      }
      dateLabel = `Rentang Tanggal: ${U().formatDate(awal)} s/d ${U().formatDate(akhir)}`;
    } else if (tipe === 'periode') {
      const blnNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const startDay = prd === 1 ? 1 : 16;
      const endDay = prd === 1 ? 15 : new Date(year, bln, 0).getDate();
      const monthStr = String(bln).padStart(2, '0');
      
      for (let d = startDay; d <= endDay; d++) {
        const dayStr = String(d).padStart(2, '0');
        dates.push(`${year}-${monthStr}-${dayStr}`);
      }
      dateLabel = `Bulan: ${blnNames[bln-1]} 2026 — Periode ${prd}`;
    }

    // Fetch filter inputs
    const rphId = document.getElementById('rpt-filter-rph') ? document.getElementById('rpt-filter-rph').value : '';
    const tpgId = document.getElementById('rpt-filter-tpg') ? document.getElementById('rpt-filter-tpg').value : '';

    const rph = allRph.find(r => r.id === rphId);
    const tpg = allTpg.find(t => t.id === tpgId);

    // Set Kop dynamic BKPH and RPH/TPG
    const elBkph = document.getElementById('kop-bkph');
    if (elBkph) {
      if (rph) {
        elBkph.textContent = `BAGIAN KESATUAN PEMANGKUAN HUTAN (BKPH) BANTARKAWUNG — RPH ${rph.nama.toUpperCase()}`;
      } else {
        elBkph.textContent = `BAGIAN KESATUAN PEMANGKUAN HUTAN (BKPH) BANTARKAWUNG`;
      }
    }

    const elTitle = document.getElementById('rpt-title');
    const elSub = document.getElementById('rpt-subtitle');
    const elTpgRow = document.getElementById('rpt-tpg-row');
    const kopSurat = document.querySelector('.kop-surat');
    const logoMini = document.getElementById('rpt-logo-mini');

    if (jenis === 'pantauan') {
      if (kopSurat) kopSurat.style.display = 'none';
      if (logoMini) logoMini.style.display = 'block';

      const prdRoman = prd === 1 ? 'I' : 'II';
      const blnNames = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
      const periodLabel = `${prdRoman} ${blnNames[bln-1]} 2026`;

      if (elTitle) {
        elTitle.innerHTML = `PANTAUAN KEGIATAN SADAPAN ${rph ? 'RPH ' + rph.nama.toUpperCase() : ''} BKPH BANTARKAWUNG<br><span style="font-size:1rem;">KESATUAN PEMANGKUAN HUTAN PEKALONGAN BARAT</span>`;
      }
      if (elTpgRow) {
        elTpgRow.style.display = 'block';
        elTpgRow.textContent = tpg ? `TPG ${tpg.nama.toUpperCase()}` : '';
      }
      if (elSub) {
        elSub.style.fontWeight = '700';
        elSub.style.fontSize = '1rem';
        elSub.style.color = '#111';
        elSub.textContent = `PERIODE : ${periodLabel}`;
      }
    } else {
      if (kopSurat) kopSurat.style.display = 'flex';
      if (logoMini) logoMini.style.display = 'none';

      if (elTitle) {
        elTitle.textContent = jenis === 'realisasi'
          ? 'LAPORAN REALISASI PRODUKSI GETAH'
          : 'LAPORAN KEHADIRAN & KEGIATAN PENYADAP';
      }
      if (elTpgRow) {
        elTpgRow.style.display = 'none';
        elTpgRow.textContent = '';
      }
      if (elSub) {
        elSub.style.fontWeight = '500';
        elSub.style.fontSize = '.85rem';
        elSub.style.color = '#444';
        elSub.textContent = dateLabel;
      }
    }

    let filtered = [];

    if (jenis === 'realisasi') {
      const rawRealisasi = await window.db.getAllActive('realisasi');
      filtered = rawRealisasi.filter(r => dates.includes(r.tanggal));
      
      // Filter by dropdown RPH/TPG
      if (tpgId) {
        filtered = filtered.filter(r => r.tpg_id === tpgId);
      } else if (rphId) {
        const tpgs = allTpg.filter(t => t.rph_id === rphId).map(t => t.id);
        filtered = filtered.filter(r => tpgs.includes(r.tpg_id));
      } else {
        // Fallback user scope
        const user = window.app.currentUser;
        const role = user ? user.role : '';
        const scope = user ? user.scope : null;
        if (scope && (role === 'tpg' || role === 'mandor')) {
          filtered = filtered.filter(r => r.tpg_id === scope);
        } else if (scope && role === 'krph') {
          const tpgs = allTpg.filter(t => t.rph_id === scope).map(t => t.id);
          filtered = filtered.filter(r => tpgs.includes(r.tpg_id));
        } else if (scope && role === 'bkph') {
          const rphs = allRph.filter(r => r.bkph_id === scope).map(r => r.id);
          const tpgs = allTpg.filter(t => rphs.includes(t.rph_id)).map(t => t.id);
          filtered = filtered.filter(r => tpgs.includes(r.tpg_id));
        }
      }
      filtered.sort((a,b) => a.tanggal.localeCompare(b.tanggal));
      reportData = filtered;
    } else if (jenis === 'kehadiran') {
      const rawKehadiran = await window.db.getAllActive('kehadiran');
      filtered = rawKehadiran.filter(r => dates.includes(r.tanggal));
      
      // Filter by dropdown RPH/TPG
      let activePgns = allPgn.filter(pg => pg.aktif === 1);
      if (tpgId) {
        const apIds = allAP.filter(ap => ap.tpg_id === tpgId).map(ap => ap.id);
        activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
      } else if (rphId) {
        const tpgs = allTpg.filter(t => t.rph_id === rphId).map(t => t.id);
        const apIds = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
        activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
      } else {
        // Fallback user scope
        const user = window.app.currentUser;
        const role = user ? user.role : '';
        const scope = user ? user.scope : null;
        if (scope && (role === 'tpg' || role === 'mandor')) {
          const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
          activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
        } else if (scope && role === 'krph') {
          const tpgs = allTpg.filter(t => t.rph_id === scope).map(t => t.id);
          const apIds = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
          activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
        } else if (scope && role === 'bkph') {
          const rphs = allRph.filter(r => r.bkph_id === scope).map(r => r.id);
          const tpgs = allTpg.filter(t => rphs.includes(t.rph_id)).map(t => t.id);
          const apIds = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
          activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
        }
      }
      const pndIds = activePgns.map(pg => pg.penyadap_id);
      filtered = filtered.filter(k => pndIds.includes(k.penyadap_id));
      filtered.sort((a,b) => a.tanggal.localeCompare(b.tanggal));
      reportData = filtered;
    } else if (jenis === 'pantauan') {
      const kehadiranList = await window.db.getAllActive('kehadiran');
      const realisasiList = await window.db.getAllActive('realisasi');
      const roList = await window.db.getAllActive('ro');
      const targetList = (await window.db.getAllActive('target_penyadap')).filter(x => parseInt(x.tahun) === parseInt(year));

      let activePgns = allPgn.filter(pg => pg.aktif === 1);
      if (tpgId) {
        const apIds = allAP.filter(ap => ap.tpg_id === tpgId).map(ap => ap.id);
        activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
      } else if (rphId) {
        const tpgs = allTpg.filter(t => t.rph_id === rphId).map(t => t.id);
        const apIds = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
        activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
      } else {
        // Fallback user scope
        const user = window.app.currentUser;
        const role = user ? user.role : '';
        const scope = user ? user.scope : null;
        if (scope && (role === 'tpg' || role === 'mandor')) {
          const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
          activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
        } else if (scope && role === 'krph') {
          const tpgs = allTpg.filter(t => t.rph_id === scope).map(t => t.id);
          const apIds = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
          activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
        } else if (scope && role === 'bkph') {
          const rphs = allRph.filter(r => r.bkph_id === scope).map(r => r.id);
          const tpgs = allTpg.filter(t => rphs.includes(t.rph_id)).map(t => t.id);
          const apIds = allAP.filter(ap => tpgs.includes(ap.tpg_id)).map(ap => ap.id);
          activePgns = activePgns.filter(pg => apIds.includes(pg.anak_petak_id));
        }
      }

      // Map row data
      const records = [];
      activePgns.forEach(pg => {
        const psy = allPenyadap.find(p => p.id === pg.penyadap_id);
        if (!psy) return;

        const ap = allAP.find(a => a.id === pg.anak_petak_id);
        const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
        
        const luas_baku = ptk ? (ptk.luas_ha || 0) : 0;
        const luas_sadapan = ap ? (ap.luas_ha || pg.luas_ha || 0) : 0;
        const pohon = pg.jumlah_pohon || (ap ? ap.jumlah_pohon : 0) || 0;

        // Target tahunan
        const myTargets = targetList.filter(t => t.penyadap_id === psy.id && t.anak_petak_id === pg.anak_petak_id);
        const target_tahun = myTargets.reduce((sum, t) => sum + (t.target_kg || 0), 0);

        // Daily activities
        const dailyActivities = dates.map(d => {
          const r = realisasiList.find(x => x.penyadap_id === psy.id && x.tanggal === d);
          if (r) {
            return `S. ${r.berat_bersih}`;
          }
          const k = kehadiranList.find(x => x.penyadap_id === psy.id && x.tanggal === d);
          if (k) {
            const cat = k.status;
            if (cat === 'pembaharuan_1' || cat === 'Pembaruan 1') return 'P1';
            if (cat === 'pembaharuan_2' || cat === 'Pembaruan 2') return 'P2';
            if (cat === 'pembaharuan_3' || cat === 'Pembaruan 3') return 'P3';
            if (cat === 'pengecasan' || cat === 'Pengecasan') return 'CS';
            if (cat === 'ludang' || cat === 'Ludang') return 'L';
            if (cat === 'sakit' || cat === 'Sakit') return 'S';
            if (cat === 'izin' || cat === 'Izin') return 'I';
            if (cat === 'tidak_hadir' || cat === 'Alfa' || cat === 'tidak_aktif') return 'A';
            if (cat === 'hadir' || cat === 'Hadir' || cat === 'aktif' || cat === 'Aktif') return 'H';
            return cat;
          }
          return '—';
        });

        // Target RO
        const matchingRO = roList.find(ro => 
          parseInt(ro.tahun) === parseInt(year) &&
          parseInt(ro.bulan) === parseInt(bln) &&
          parseInt(ro.periode) === parseInt(prd) &&
          ro.penyadap_id === psy.id &&
          ro.areal_id === pg.anak_petak_id
        );
        const ro = matchingRO ? (matchingRO.kesanggupan || 0) : 0;

        // Realisasi
        const myReals = realisasiList.filter(r => r.penyadap_id === psy.id && dates.includes(r.tanggal));
        const realisasi = myReals.reduce((sum, r) => sum + (r.berat_bersih || 0), 0);

        // Keaktifan
        let aktivitas = 'Non Aktif';
        const hasActivity = myReals.length > 0 || kehadiranList.some(k => k.penyadap_id === psy.id && dates.includes(k.tanggal) && k.status !== 'Alfa' && k.status !== 'tidak_hadir');
        if (hasActivity) {
          aktivitas = 'Aktif';
        }

        // Keterangan
        let keterangan = '—';
        if (realisasi === 0) {
          const myKehadirans = kehadiranList.filter(k => k.penyadap_id === psy.id && dates.includes(k.tanggal));
          if (myKehadirans.length > 0) {
            const counts = {};
            myKehadirans.forEach(k => {
              const s = k.status || '—';
              counts[s] = (counts[s] || 0) + 1;
            });
            const sortedCats = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
            keterangan = sortedCats[0] || '—';
          } else {
            keterangan = 'Tidak Aktif';
          }
        }

        records.push({
          petak_nomor: ptk ? ptk.nomor : '—',
          luas_baku,
          penyadap_nama: psy.nama,
          penyadap_nomor: psy.nomor,
          luas_sadapan,
          pohon,
          target_tahun,
          dailyActivities,
          ro,
          realisasi,
          aktivitas,
          keterangan
        });
      });

      // Sort by petak_nomor custom order
      records.sort((a, b) => {
        const idxA = getCustomSortIndex(`Petak ${a.petak_nomor}`);
        const idxB = getCustomSortIndex(`Petak ${b.petak_nomor}`);
        if (idxA !== idxB) return idxA - idxB;
        return a.petak_nomor.localeCompare(b.petak_nomor, undefined, { numeric: true, sensitivity: 'base' });
      });

      reportData = records;
      filtered = records;
    }

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
          
          const pgn = allPgn.find(p => p.penyadap_id === row.penyadap_id && p.aktif === 1);
          let petakLabel = '—';
          if (pgn) {
            const ap = allAP.find(a => a.id === pgn.anak_petak_id);
            const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
            petakLabel = ptk ? `Petak ${ptk.nomor}` : '—';
          }

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
    } else if (jenis === 'kehadiran') {
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
          
          const pgn = allPgn.find(p => p.penyadap_id === row.penyadap_id && p.aktif === 1);
          let petakLabel = '—';
          if (pgn) {
            const ap = allAP.find(a => a.id === pgn.anak_petak_id);
            const ptk = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
            petakLabel = ptk ? `Petak ${ptk.nomor}` : '—';
          }

          const status = row.status || 'Tidak Hadir';
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
    } else if (jenis === 'pantauan') {
      // Enable horizontal scroll for wide pantauan table
      const tableContainer = thead.closest('.table-container');
      if (tableContainer) tableContainer.style.overflowX = 'auto';

      // Add landscape class to print-container for print
      const printContainer = thead.closest('.print-container');
      if (printContainer) printContainer.classList.add('print-landscape');

      const TH = (content, extra='', rowspan=2) =>
        `<th rowspan="${rowspan}" style="text-align:center;vertical-align:middle;border:1px solid #999;padding:3px 4px;font-size:0.72rem;font-weight:700;line-height:1.2;${extra}">${content}</th>`;

      const dateThs = dates.map(d => {
        const dayNum = parseInt(d.split('-')[2]);
        return `<th style="width:22px;min-width:22px;text-align:center;font-size:0.68rem;padding:2px 1px;border:1px solid #ccc;vertical-align:middle;">${dayNum}</th>`;
      }).join('');

      thead.innerHTML = `
        <tr style="background:#c8e6c9;">
          ${TH('NO','width:28px;', 2)}
          ${TH('PETAK','min-width:55px;text-align:left;', 2)}
          ${TH('LUAS<br>BAKU<br>(Ha)','min-width:48px;', 2)}
          ${TH('NAMA PENYADAP','min-width:115px;text-align:left;', 2)}
          ${TH('LUAS<br>SADAP<br>AN<br>(Ha)','min-width:45px;', 2)}
          ${TH('JML<br>POHON','min-width:48px;', 2)}
          ${TH('TARGET/<br>TAHUN<br>(Kg)','min-width:55px;', 2)}
          <th colspan="${dates.length}" style="text-align:center;border:1px solid #999;padding:4px;font-size:0.72rem;font-weight:700;">TANGGAL PEMBAHARUAN, PENGECASAN, LUDANG, DAN SETOR GETAH</th>
          <th colspan="2" style="text-align:center;border:1px solid #999;padding:4px;font-size:0.72rem;font-weight:700;">JUMLAH</th>
          ${TH('AKTIVITAS<br>PENYADAP','min-width:65px;', 2)}
          ${TH('KETERANGAN','min-width:90px;text-align:left;', 2)}
        </tr>
        <tr style="background:#c8e6c9;">
          ${dateThs}
          ${TH('RO<br>(Kg)','min-width:45px;', 1)}
          ${TH('REALI<br>SASI<br>(Kg)','min-width:55px;', 1)}
        </tr>
      `;


      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${dates.length + 11}" style="padding:2rem;color:#666;text-align:center;">Tidak ada data pantauan kegiatan untuk periode filter ini</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map((row, idx) => {
          const dailyCells = row.dailyActivities.map(act => {
            let style = 'text-align:center;font-size:0.75rem;padding:4px;border:1px solid #ccc;';
            let displayVal = act;
            
            if (act.startsWith('S. ')) {
              style += 'background:#e8f5e9;color:#1b4d3e !important;font-weight:700;';
              displayVal = act.substring(3) + ' kg';
            } else if (act === 'P1' || act === 'P2' || act === 'P3') {
              style += 'background:#fffde7;color:#8d6e63 !important;font-weight:700;';
            } else if (act === 'CS') {
              style += 'background:#e3f2fd;color:#0d47a1 !important;font-weight:700;';
            } else if (act === 'L') {
              style += 'background:#f3e5f5;color:#4a148c !important;font-weight:700;';
            } else if (act === 'S' || act === 'I') {
              style += 'background:#fff3e0;color:#e65100 !important;font-weight:700;';
            } else if (act === 'A') {
              style += 'background:#ffebee;color:#c62828 !important;font-weight:700;';
            } else if (act === '—') {
              style += 'color:#aaa !important;';
            }
            
            return `<td style="${style}">${displayVal}</td>`;
          }).join('');

          let actColor = '#000';
          let actBg = '#f2f2f2';
          if (row.aktivitas === 'Aktif') {
            actColor = '#1b4d3e';
            actBg = '#e8f5e9';
          } else {
            actColor = '#c62828';
            actBg = '#ffebee';
          }

          return `
            <tr>
              <td style="text-align:center;border:1px solid #ccc;padding:4px;font-size:0.8rem;">${idx + 1}</td>
              <td style="border:1px solid #ccc;padding:4px;font-weight:700;font-size:0.8rem;">Petak ${row.petak_nomor}</td>
              <td style="text-align:right;border:1px solid #ccc;padding:4px;font-size:0.8rem;">${row.luas_baku.toFixed(2)}</td>
              <td style="border:1px solid #ccc;padding:4px;">
                <strong style="font-size:0.8rem;">${row.penyadap_nama}</strong>
                <div style="font-size:0.7rem;color:#666;">${row.penyadap_nomor}</div>
              </td>
              <td style="text-align:right;border:1px solid #ccc;padding:4px;font-size:0.8rem;">${row.luas_sadapan.toFixed(2)}</td>
              <td style="text-align:right;border:1px solid #ccc;padding:4px;font-size:0.8rem;">${row.pohon.toLocaleString('id-ID')}</td>
              <td style="text-align:right;border:1px solid #ccc;padding:4px;font-size:0.8rem;">${row.target_tahun.toLocaleString('id-ID')}</td>
              ${dailyCells}
              <td style="text-align:right;border:1px solid #ccc;padding:4px;font-weight:700;font-size:0.8rem;">${row.ro.toLocaleString('id-ID')}</td>
              <td style="text-align:right;border:1px solid #ccc;padding:4px;font-weight:700;font-size:0.8rem;color:#1b4d3e;">${row.realisasi.toLocaleString('id-ID')}</td>
              <td style="text-align:center;border:1px solid #ccc;padding:4px;">
                <span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:0.72rem;font-weight:700;white-space:nowrap;color:${actColor};background:${actBg};">${row.aktivitas}</span>
              </td>
              <td style="border:1px solid #ccc;padding:4px;font-size:0.78rem;color:#333;white-space:nowrap;">${row.keterangan}</td>
            </tr>
          `;
        }).join('');

        let totalLuasBaku = 0;
        let totalLuasSadapan = 0;
        let totalPohon = 0;
        let totalTargetTahun = 0;
        let totalRO = 0;
        let totalRealisasi = 0;
        let activeCount = 0;
        let inactiveCount = 0;

        filtered.forEach(r => {
          totalLuasBaku += r.luas_baku;
          totalLuasSadapan += r.luas_sadapan;
          totalPohon += r.pohon;
          totalTargetTahun += r.target_tahun;
          totalRO += r.ro;
          totalRealisasi += r.realisasi;
          if (r.aktivitas === 'Aktif') activeCount++;
          else inactiveCount++;
        });

        const totalRowHtml = `
          <tr class="total-row" style="background:#a5d6a7;font-weight:bold;border-top:3px solid #388e3c;">
            <td colspan="2" style="text-align:center;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">JUMLAH</td>
            <td style="text-align:right;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">${totalLuasBaku.toFixed(2)}</td>
            <td style="border:1px solid #388e3c;padding:5px;"></td>
            <td style="text-align:right;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">${totalLuasSadapan.toFixed(2)}</td>
            <td style="text-align:right;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">${totalPohon.toLocaleString('id-ID')}</td>
            <td style="text-align:right;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">${totalTargetTahun.toLocaleString('id-ID')}</td>
            <td colspan="${dates.length}" style="border:1px solid #388e3c;padding:5px;"></td>
            <td style="text-align:right;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">${totalRO.toLocaleString('id-ID')}</td>
            <td style="text-align:right;border:1px solid #388e3c;padding:5px;font-size:0.8rem;color:#1b4d3e;">${totalRealisasi.toLocaleString('id-ID')}</td>
            <td style="text-align:center;border:1px solid #388e3c;padding:5px;font-size:0.78rem;line-height:1.4;color:#1b4d3e;">
              <span style="display:block;">Aktif: <strong>${activeCount}</strong></span>
              <span style="display:block;">Non-Aktif: <strong>${inactiveCount}</strong></span>
            </td>
            <td style="border:1px solid #388e3c;padding:5px;"></td>
          </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', totalRowHtml);
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
    } else if (reportType === 'kehadiran') {
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
    } else if (reportType === 'pantauan') {
      const bln = parseInt(document.getElementById('rpt-bulan').value);
      const prd = parseInt(document.getElementById('rpt-periode').value);
      const year = 2026;
      
      const startDay = prd === 1 ? 1 : 16;
      const endDay = prd === 1 ? 15 : new Date(year, bln, 0).getDate();

      exportRows = reportData.map((r, idx) => {
        const rowObj = {
          'No': idx + 1,
          'Petak': `Petak ${r.petak_nomor}`,
          'Luas Baku (Ha)': r.luas_baku,
          'Nama Penyadap': r.penyadap_nama,
          'ID Penyadap': r.penyadap_nomor,
          'Luas Sadapan (Ha)': r.luas_sadapan,
          'Jumlah Pohon': r.pohon,
          'Target/Tahun (Kg)': r.target_tahun
        };

        // Add daily columns
        for (let d = startDay; d <= endDay; d++) {
          const actIndex = d - startDay;
          rowObj[`Tanggal ${d}`] = r.dailyActivities[actIndex] || '—';
        }

        rowObj['Target RO (Kg)'] = r.ro;
        rowObj['Realisasi Bersih (Kg)'] = r.realisasi;
        rowObj['Aktivitas Penyadap'] = r.aktivitas;
        rowObj['Keterangan'] = r.keterangan;

        return rowObj;
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    U().showToast('Laporan berhasil diekspor ke Excel!');
  }

  const PETAK_CUSTOM_ORDER = [
    "52a.1", "52c", "52d", "52h.1", "52h.2", "52e.1", "52e.2", "52g.2", "52q", "52t.1",
    "52t.2", "52v", "53b", "53i", "52g.1", "52i", "52k", "52m", "52n", "52o",
    "52r.1", "52r.2", "36c", "36d", "36e", "36j.2", "37a.1", "37a.2", "53d.2", "53f",
    "53h", "53j", "53l.1", "53l.2", "54b", "54c", "54d", "54e.1", "54e.3", "54l",
    "37b.3", "37b.4", "37b.1", "37b.2", "37o.1", "37o.2", "54f", "54g", "54h", "54q",
    "54i", "37d.2", "37d.1", "37d.3", "37e.1", "37e.2", "37f.1", "37g.1", "37g.2", "37h",
    "37i", "37n.1", "37n.2", "38a.2", "38a.1", "38a.3", "38b", "38c.3", "38c.2", "38c.1",
    "38d", "38e", "38h", "38i", "38m.2", "38m.1", "39b", "39d", "39h", "39i",
    "39e", "40i", "40c.1", "40c.2", "40f.1", "41d.1", "41e", "41g", "41j.1", "41l.1",
    "45a", "45c", "45h.1", "45e", "56a", "56b", "55a.1", "55a.2", "55c", "55b.1",
    "55b.2", "55d", "56h", "56c", "56d", "56e", "56f", "56r", "56s", "57c",
    "57d", "57f", "57h.2", "57i", "57j", "57l", "57m", "57.o", "57q", "57t",
    "58a", "58b", "58c", "58d.1", "62c.2", "63b", "63c", "63g", "63.i.1", "63.i.2",
    "63j", "65a", "65b", "65c", "65f", "65g", "65h", "64d.4", "64g", "66a.1",
    "66a.3", "63f", "60l", "62e", "62g", "62h.2", "63h.1", "59a", "59c.4", "59c.5",
    "59c.6", "62c.1", "60p", "62a", "62f", "62d.1", "63d.1", "63e", "64a", "64b.1",
    "64b.2", "60e", "60f", "60g", "61h.1", "61b.1", "61d.2", "61g.1", "61g.2", "61m",
    "61e", "61f", "64e.1", "64i.1", "66c", "66i", "66d.2", "66e.2", "76a", "76i",
    "77d.1", "77p", "80m", "69s", "80n", "80p", "69g.1", "69o.2", "77c.1", "69q",
    "76d", "79a.2", "79a.1", "79d", "79e", "79f.1", "79k.1", "77l", "77m", "77n",
    "77o", "69j", "69r", "77a", "78d.2", "78g.1", "78h", "78k.2", "69t", "78d.1",
    "78e.1", "69k.1", "69k.2", "69o.1", "69p", "80e.1", "80e.2", "80e.3", "80c", "81c",
    "82a.1", "81a.1", "83c", "83g.1", "84a", "84d", "80g", "81b", "81d", "81e",
    "81f", "80j", "80l", "82c", "83e", "83g.2", "83l", "83m.1", "70a.1", "70c",
    "70e", "70g", "70h", "70i", "70k", "70l", "70m", "67d.1", "67f.1", "67h",
    "67a", "67e.1", "68a", "68e.1", "68g", "75c.2", "75c.1", "75d.1", "75e", "75f",
    "67c", "67i", "67j", "67k.1", "67n", "68f.1", "68h.2", "68h.1", "71a.1", "71g.1",
    "71i", "71j", "71s", "71b.2", "71d.2", "71e", "71f", "71k", "71p", "71q",
    "71.t", "71.u.1", "74g.1", "74h.1", "74h.2", "72a", "72b", "72d.2", "72e", "72g",
    "72j", "74f.1", "74f.2", "72k.2", "72k.1", "73h", "73i", "73k", "73c.3", "73c.1",
    "73d.1", "73d.2", "73e.2", "73e.3", "73e.1", "73f", "74b.1", "74c", "6b", "6d",
    "6e", "7c.1", "7l.1", "7e.2", "7g.2", "2a", "4i", "4g", "9c.1", "9d.1",
    "9e.1", "9k", "9f", "10d"
  ];

  function normalizePetakLabel(label) {
    if (!label) return '';
    return label.toLowerCase()
      .trim()
      .replace(/^petak\s+/i, '')
      .replace(/[-_]/g, '.');
  }

  function getCustomSortIndex(label) {
    const norm = normalizePetakLabel(label);
    const idx = PETAK_CUSTOM_ORDER.indexOf(norm);
    return idx === -1 ? 999999 : idx;
  }

  async function initFilters() {
    const user = window.app && window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : '';

    const elRph = document.getElementById('rpt-filter-rph');
    const elTpg = document.getElementById('rpt-filter-tpg');
    if (!elRph || !elTpg) return;

    const allRph = await window.db.getAllActive('rph');
    const allTpg = await window.db.getAllActive('tpg');

    if (role === 'admin' || role === 'bkph') {
      elRph.innerHTML = `<option value="">— Semua RPH —</option>` +
        allRph.map(r => `<option value="${r.id}">${r.nama}</option>`).join('');
      elRph.disabled = false;
    } else if (role === 'krph') {
      const myRph = allRph.find(r => r.id === scope);
      elRph.innerHTML = `<option value="${scope}">${myRph ? myRph.nama : ''}</option>`;
      elRph.disabled = true;
    } else {
      const myTpg = allTpg.find(t => t.id === scope);
      const myRph = myTpg ? allRph.find(r => r.id === myTpg.rph_id) : null;
      elRph.innerHTML = `<option value="${myRph ? myRph.id : ''}">${myRph ? myRph.nama : ''}</option>`;
      elRph.disabled = true;
    }

    async function updateTpgDropdown() {
      const selectedRph = elRph.value;
      let filteredTpg = allTpg;
      if (selectedRph) {
        filteredTpg = allTpg.filter(t => t.rph_id === selectedRph);
      }

      if (role === 'admin' || role === 'bkph' || role === 'krph') {
        elTpg.innerHTML = `<option value="">— Semua TPG —</option>` +
          filteredTpg.map(t => `<option value="${t.id}">${t.nama}</option>`).join('');
        elTpg.disabled = false;
        if (role === 'krph' && !selectedRph) {
          elTpg.innerHTML = `<option value="">— Pilih RPH Terlebih Dahulu —</option>`;
          elTpg.disabled = true;
        }
      } else {
        const myTpg = allTpg.find(t => t.id === scope);
        elTpg.innerHTML = `<option value="${scope}">${myTpg ? myTpg.nama : ''}</option>`;
        elTpg.disabled = true;
      }
    }

    elRph.onchange = async () => {
      await updateTpgDropdown();
      await renderReport();
    };
    elTpg.onchange = async () => {
      await renderReport();
    };

    await updateTpgDropdown();
  }

  async function generateDemoData() {
    const user = window.app && window.app.currentUser;
    const actor = U().currentActorId();
    
    // Cari penyadap aktif
    const allPgn = await window.db.getAllActive('penugasan');
    const allPnd = await window.db.getAllActive('penyadap');
    const activePgns = allPgn.filter(pg => pg.aktif === 1);
    
    if (activePgns.length === 0) {
      U().showToast('Tidak ada penyadap aktif untuk dibuatkan data demo', 'danger');
      return;
    }

    // Ambil penyadap pertama (misalnya Tarpin atau penyadap pertama yang ada)
    const targetPgn = activePgns[0];
    const targetPnd = allPnd.find(p => p.id === targetPgn.penyadap_id);
    if (!targetPnd) {
      U().showToast('Data penyadap tidak ditemukan', 'danger');
      return;
    }

    try {
      // 1. Target Tahunan
      const targetTahunan = {
        id: U().uuid(),
        tahun: 2026,
        penyadap_id: targetPnd.id,
        anak_petak_id: targetPgn.anak_petak_id,
        luas_ha: targetPgn.luas_ha || 2.5,
        pohon: targetPgn.jumlah_pohon || 500,
        target_kg: 1500,
        sync_status: 'local',
        ...U().makeAudit(actor)
      };
      await window.db.put('target_penyadap', targetTahunan);

      // 2. Rencana Operasional (RO)
      const ro1 = {
        id: U().uuid(),
        penyadap_id: targetPnd.id,
        areal_id: targetPgn.anak_petak_id,
        tahun: 2026,
        bulan: 7,
        periode: 1,
        kesanggupan: 120,
        status: 'disetujui',
        sync_status: 'local',
        ...U().makeAudit(actor)
      };
      const ro2 = {
        id: U().uuid(),
        penyadap_id: targetPnd.id,
        areal_id: targetPgn.anak_petak_id,
        tahun: 2026,
        bulan: 7,
        periode: 2,
        kesanggupan: 130,
        status: 'disetujui',
        sync_status: 'local',
        ...U().makeAudit(actor)
      };
      await window.db.put('ro', ro1);
      await window.db.put('ro', ro2);

      // 3. Kehadiran & Realisasi Timbangan
      // Kita buat data untuk tanggal 1 - 15 Juli 2026
      const demoActivities = [
        { tgl: '2026-07-01', type: 'h', val: 'Pembaruan 1' },
        { tgl: '2026-07-02', type: 'h', val: 'Pembaruan 1' },
        { tgl: '2026-07-03', type: 'h', val: 'Pengecasan' },
        { tgl: '2026-07-04', type: 'h', val: 'Ludang' },
        { tgl: '2026-07-05', type: 'h', val: 'Ludang' },
        { tgl: '2026-07-06', type: 'r', val: 8 },
        { tgl: '2026-07-07', type: 'r', val: 12 },
        { tgl: '2026-07-08', type: 'h', val: 'Alfa' },
        { tgl: '2026-07-09', type: 'h', val: 'Sakit' },
        { tgl: '2026-07-10', type: 'r', val: 10 },
        { tgl: '2026-07-11', type: 'h', val: 'Pengecasan' },
        { tgl: '2026-07-12', type: 'r', val: 15 },
        { tgl: '2026-07-13', type: 'h', val: 'Ludang' },
        { tgl: '2026-07-14', type: 'r', val: 7 },
        { tgl: '2026-07-15', type: 'h', val: 'Izin' }
      ];

      for (const act of demoActivities) {
        if (act.type === 'h') {
          // Kehadiran
          const att = {
            id: U().uuid(),
            tanggal: act.tgl,
            penyadap_id: targetPnd.id,
            status: act.val,
            sync_status: 'local',
            ...U().makeAudit(actor)
          };
          await window.db.put('kehadiran', att);
        } else {
          // Realisasi timbangan
          const real = {
            id: U().uuid(),
            penyadap_id: targetPnd.id,
            tpg_id: user ? user.scope : null,
            tanggal: act.tgl,
            berat_kotor: act.val,
            berat_bersih: act.val,
            mutu: 'Mutu Super Premium',
            keterangan: 'Setoran Getah Demo',
            sync_status: 'local',
            ...U().makeAudit(actor)
          };
          await window.db.put('realisasi', real);
        }
      }

      U().showToast(`Data demo berhasil dibuat untuk penyadap: ${targetPnd.nama}!`, 'success');
      await renderReport();
    } catch (e) {
      U().showToast('Gagal membuat data demo: ' + e.message, 'danger');
    }
  }

  return { init, onChangeJenis, onChangeFilterTipe, renderReport, printReport, exportExcel, generateDemoData };
})();


window.LaporanModule = LaporanModule;
