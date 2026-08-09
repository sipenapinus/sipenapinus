/**
 * SIPENA Lite — Modul Dashboard Hierarki Operasional (dashboard.js)
 * Pusat monitoring operasional getah pinus yang mendukung drill-down dinamis:
 * BKPH → RPH → TPG → Mandor → Petak → Penyadap.
 */
'use strict';

const DashboardModule = (() => {
  const U = () => window.SipenaUtils;

  let state = {
    tahun: 2026,
    bulan: 7, // Juli
    periode: 1, // 1: tgl 1-15, 2: tgl 16-akhir
    filterStatus: '', // '', 'hijau', 'kuning', 'merah'
    search: '',
    drillPath: [] // stack of { level, id, label }
  };

  // ── Hak Akses / Hierarki Awal ─────────────────────────────────
  async function getCurrentUserSafe() {
    if (window.app && window.app.currentUser) return window.app.currentUser;
    const sessionToken = localStorage.getItem('sipena_session');
    if (sessionToken) {
      try {
        const sessionData = JSON.parse(sessionToken);
        let user = await window.db.get('users', sessionData.id);
        if (!user && sessionData.username) {
          const allUsers = await window.db.getAll('users');
          user = allUsers.find(u => u.username === sessionData.username && !u.deleted_at);
        }
        if (user && user.status === 'aktif' && !user.deleted_at) {
          if (window.app) window.app.currentUser = user;
          return user;
        }
      } catch (e) {}
    }
    return null;
  }

  async function getInitialDrillPath() {
    try {
      const user = await getCurrentUserSafe();
      if (!user) return [];

      const path = [];
      const role = user.role || '';
      const scope = user.scope || null;

      if (role === 'admin' || role === 'bkph') {
        return [];
      }

      if (role === 'krph') {
        let rphId = scope;
        let rph = rphId ? await window.db.get('rph', rphId) : null;
        if (!rph) {
          const allRph = await window.db.getAllActive('rph');
          rph = allRph[0] || null;
          if (rph) rphId = rph.id;
        }
        if (rph) {
          path.push({ level: 'rph', id: rph.id, label: rph.nama });
        }
        return path;
      }

      if (role === 'tpg') {
        let tpgId = scope;
        let tpg = tpgId ? await window.db.get('tpg', tpgId) : null;
        if (!tpg) {
          const allTpg = await window.db.getAllActive('tpg');
          tpg = allTpg[0] || null;
          if (tpg) tpgId = tpg.id;
        }
        if (tpg) {
          const rph = await window.db.get('rph', tpg.rph_id);
          if (rph) path.push({ level: 'rph', id: rph.id, label: rph.nama });
          path.push({ level: 'tpg', id: tpg.id, label: tpg.nama });
        }
        return path;
      }

      if (role === 'mandor') {
        let tpgId = scope;
        let tpg = tpgId ? await window.db.get('tpg', tpgId) : null;
        
        if (!tpg) {
          const allAP  = await window.db.getAllActive('anak_petak');
          const allPetak = await window.db.getAllActive('petak');
          const myPetak = allPetak.find(p => p.mandor_id === user.id);
          if (myPetak) {
            const ap = allAP.find(a => a.petak_id === myPetak.id && a.tpg_id);
            if (ap) tpgId = ap.tpg_id;
          }
          if (!tpgId && allAP.length > 0) {
            const firstAP = allAP.find(ap => ap.tpg_id);
            if (firstAP) tpgId = firstAP.tpg_id;
          }
          tpg = tpgId ? await window.db.get('tpg', tpgId) : null;
        }
        
        const rph = tpg ? await window.db.get('rph', tpg.rph_id) : null;
        if (rph) path.push({ level: 'rph', id: rph.id, label: rph.nama });
        if (tpg) path.push({ level: 'tpg', id: tpg.id, label: tpg.nama });
        path.push({ level: 'mandor', id: user.id, label: user.nama_lengkap || user.username || 'Mandor', scopeTpg: tpg ? tpg.id : '' });
        return path;
      }

      return [];
    } catch (err) {
      console.error('[DashboardModule] getInitialDrillPath error:', err);
      return [];
    }
  }

  // ── Inisialisasi ──────────────────────────────────────────────
  async function init() {
    try {
      const today = new Date();
      state.tahun = today.getFullYear();
      state.bulan = today.getMonth() + 1;
      state.periode = today.getDate() <= 15 ? 1 : 2;

      state.drillPath = await getInitialDrillPath();
      state.search = '';
      state.filterStatus = '';
      
      const selThn = document.getElementById('dash-filter-tahun');
      const selBln = document.getElementById('dash-filter-bulan');
      const selPrd = document.getElementById('dash-filter-periode');
      if (selThn) selThn.value = state.tahun;
      if (selBln) selBln.value = state.bulan;
      if (selPrd) selPrd.value = state.periode;

      await render();
    } catch (err) {
      console.error('[DashboardModule.init] Error:', err);
      const container = document.getElementById('dashboard-render-area');
      if (container) await renderBKPHLevel(container);
    }
  }

  // ── Event Handlers ───────────────────────────────────────────
  function setFilter(key, val) {
    state[key] = val;
    render();
  }

  function drillTo(level, id, label) {
    state.drillPath.push({ level, id, label });
    state.search = '';
    const searchInput = document.getElementById('dash-search-input');
    if (searchInput) searchInput.value = '';
    render();
  }

  function drillBack(index) {
    state.drillPath = state.drillPath.slice(0, index + 1);
    state.search = '';
    const searchInput = document.getElementById('dash-search-input');
    if (searchInput) searchInput.value = '';
    render();
  }

  function drillReset() {
    getInitialDrillPath().then(path => {
      state.drillPath = path;
      state.search = '';
      const searchInput = document.getElementById('dash-search-input');
      if (searchInput) searchInput.value = '';
      render();
    });
  }

  function resetDrill() {
    getInitialDrillPath().then(path => {
      state.drillPath = path;
      state.search = '';
      const searchInput = document.getElementById('dash-search-input');
      if (searchInput) searchInput.value = '';
      render();
    });
  }

  // ── Main Render Dispatcher ────────────────────────────────────
  async function render() {
    const container = document.getElementById('dashboard-render-area');
    if (!container) return;

    try {
      await renderBreadcrumbs();
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">⏳ Memuat data...</div>';

      const activeDrill = state.drillPath && state.drillPath.length > 0 ? state.drillPath[state.drillPath.length - 1] : null;

      if (!activeDrill) {
        await renderBKPHLevel(container);
      } else if (activeDrill.level === 'rph') {
        await renderRPHLevel(container, activeDrill.id);
      } else if (activeDrill.level === 'tpg') {
        await renderTPGLevel(container, activeDrill.id);
      } else if (activeDrill.level === 'mandor') {
        await renderMandorLevel(container, activeDrill.id);
      } else {
        await renderBKPHLevel(container);
      }
    } catch (err) {
      console.error('[DashboardModule] Render error:', err);
      try {
        await renderBKPHLevel(container);
      } catch (e2) {
        container.innerHTML = `
          <div class="card" style="border-left:4px solid var(--danger);padding:1.5rem;margin:1rem 0;">
            <h4 style="color:var(--danger);margin-bottom:.5rem;">⚠️ Gagal Memuat Dashboard</h4>
            <p style="color:var(--text-secondary);font-size:.9rem;">${err.message || err}</p>
            <button class="btn btn-secondary btn-sm" style="margin-top:1rem;" onclick="DashboardModule.render()">🔄 Coba Lagi</button>
          </div>
        `;
      }
    }
  }

  // ── Render Breadcrumbs ────────────────────────────────────────
  async function renderBreadcrumbs() {
    const el = document.getElementById('dashboard-breadcrumbs');
    if (!el) return;

    const user = await getCurrentUserSafe();
    if (!user) {
      el.innerHTML = '';
      return;
    }
    const isRestricted = user.role !== 'admin' && user.role !== 'bkph';

    let html = '';
    if (!isRestricted) {
      html += `<span class="breadcrumb-item active-link" onclick="DashboardModule.resetDrill()">BKPH Bantarkawung</span>`;
    } else {
      html += `<span class="breadcrumb-item">BKPH Bantarkawung</span>`;
    }

    state.drillPath.forEach((item, idx) => {
      // Tentukan apakah item ini bisa diklik untuk back-navigate
      // KRPH tidak bisa back ke atas scope RPH, Mandor tidak bisa back ke atas scope Mandor
      let canClick = true;
      if (user.role === 'krph' && idx === 0) canClick = false;
      if ((user.role === 'tpg' || user.role === 'mandor') && idx <= 2) canClick = false;

      html += ` <span class="breadcrumb-separator">&gt;</span> `;
      if (canClick && idx < state.drillPath.length - 1) {
        html += `<span class="breadcrumb-item active-link" onclick="DashboardModule.drillBack(${idx})">${item.label}</span>`;
      } else {
        html += `<span class="breadcrumb-item">${item.label}</span>`;
      }
    });

    el.innerHTML = html;
  }

  // ── Helper Ambil Batas Warna Target (🟢/🟡/🔴) ──────────────────
  function getStatusIndicator(realisasi, target) {
    if (target === 0) return { label: 'Belum Lengkap', cls: 'status-yellow', color: 'var(--warning)' };
    const pct = (realisasi / target) * 100;
    if (pct >= 100) return { label: 'Tercapai', cls: 'status-green', color: 'var(--primary)' };
    if (pct >= 80) return { label: 'Kurang', cls: 'status-yellow', color: 'var(--warning)' };
    return { label: 'Tertinggal', cls: 'status-red', color: 'var(--danger)' };
  }
  // ── Helpers: Kehadiran Hierarki ─────────────────────────────────
  function _getPenyadapIdsByApIds(apIds, allPgn) {
    return [...new Set(
      allPgn.filter(pg => apIds.includes(pg.anak_petak_id) && pg.aktif === 1).map(pg => pg.penyadap_id)
    )];
  }

  const IZIN_STATUSES = ['izin_pertanian','izin_bangunan','izin_hajatan','izin_lainnya','izin'];

  function _buildKehadiranSummary(penyadapIds, todayStr, allKehadiran) {
    if (!penyadapIds || penyadapIds.length === 0)
      return { total:0, aktif:0, hadir:0, pemb1:0, pemb2:0, pemb3:0, pengecasan:0, ludang:0, sakit:0, izin:0, izinPertanian:0, izinBangunan:0, izinHajatan:0, izinLainnya:0, tidakHadir:0, belumCde:0 };
    const khds = allKehadiran.filter(k => k.tanggal === todayStr && penyadapIds.includes(k.penyadap_id));
    const AKTIF = ['hadir','pembaharuan_1','pembaharuan_2','pembaharuan_3','pengecasan','ludang'];
    return {
      total:         penyadapIds.length,
      aktif:         khds.filter(k => AKTIF.includes(k.status)).length,
      hadir:         khds.filter(k => k.status === 'hadir').length,
      pemb1:         khds.filter(k => k.status === 'pembaharuan_1').length,
      pemb2:         khds.filter(k => k.status === 'pembaharuan_2').length,
      pemb3:         khds.filter(k => k.status === 'pembaharuan_3').length,
      pengecasan:    khds.filter(k => k.status === 'pengecasan').length,
      ludang:        khds.filter(k => k.status === 'ludang').length,
      sakit:         khds.filter(k => k.status === 'sakit').length,
      izin:          khds.filter(k => IZIN_STATUSES.includes(k.status)).length,
      izinPertanian: khds.filter(k => k.status === 'izin_pertanian').length,
      izinBangunan:  khds.filter(k => k.status === 'izin_bangunan').length,
      izinHajatan:   khds.filter(k => k.status === 'izin_hajatan').length,
      izinLainnya:   khds.filter(k => k.status === 'izin_lainnya').length,
      tidakHadir:    khds.filter(k => k.status === 'tidak_hadir').length,
      belumCde:      Math.max(0, penyadapIds.length - khds.length)
    };
  }

  function _buildKehadiranCardHtml(s) {
    if (s.total === 0) return '';
    const det = [
      s.pemb1      > 0 ? `└ Pemb.1: <b>${s.pemb1}</b>`          : null,
      s.pemb2      > 0 ? `└ Pemb.2: <b>${s.pemb2}</b>`          : null,
      s.pemb3      > 0 ? `└ Pemb.3: <b>${s.pemb3}</b>`          : null,
      s.pengecasan > 0 ? `└ Pengecasan: <b>${s.pengecasan}</b>` : null,
      s.ludang     > 0 ? `└ Ludang: <b>${s.ludang}</b>`         : null,
    ].filter(Boolean);
    return `<div style="margin-top:.6rem;padding-top:.5rem;border-top:1px solid var(--border-color);font-size:.78rem;line-height:1.85;">
      <div style="font-size:.7rem;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem;">👷 Kehadiran Hari Ini</div>
      <div style="display:flex;justify-content:space-between;"><span style="color:var(--primary);font-weight:600;">✅ Aktif Kerja</span><strong style="color:var(--primary);">${s.aktif} / ${s.total}</strong></div>
      ${det.length > 0 ? `<div style="padding-left:.4rem;color:var(--text-secondary);font-size:.71rem;display:flex;flex-wrap:wrap;gap:.1rem .5rem;">${det.map(d => `<span>${d}</span>`).join('')}</div>` : ''}
      ${s.sakit         > 0 ? `<div style="display:flex;justify-content:space-between;"><span>🟡 Sakit</span><strong style="color:var(--warning);">${s.sakit}</strong></div>` : ''}
      ${s.izin          > 0 ? `<div style="display:flex;justify-content:space-between;"><span>⚪ Izin (${s.izin})</span><strong style="color:var(--text-secondary);"></strong></div>` : ''}
      ${s.izinPertanian > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.75rem;"><span>↳ Pertanian</span><strong style="color:var(--text-secondary);">${s.izinPertanian}</strong></div>` : ''}
      ${s.izinBangunan  > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.75rem;"><span>↳ Bangunan</span><strong style="color:var(--text-secondary);">${s.izinBangunan}</strong></div>` : ''}
      ${s.izinHajatan   > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.75rem;"><span>↳ Hajatan</span><strong style="color:var(--text-secondary);">${s.izinHajatan}</strong></div>` : ''}
      ${s.izinLainnya   > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.75rem;"><span>↳ Lainnya</span><strong style="color:var(--text-secondary);">${s.izinLainnya}</strong></div>` : ''}
      ${s.tidakHadir    > 0 ? `<div style="display:flex;justify-content:space-between;"><span>🔴 Tidak Hadir</span><strong style="color:var(--danger);">${s.tidakHadir}</strong></div>` : ''}
      <div style="display:flex;justify-content:space-between;"><span>⏳ Belum di CDE</span><strong>${s.belumCde}</strong></div>
    </div>`;
  }

  function _buildKehadiranBannerHtml(s) {
    if (s.total === 0) return '';
    return `<div style="background:var(--bg-surface-elevated);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:.75rem 1rem;margin-bottom:1.25rem;">
      <div style="font-size:.72rem;color:var(--text-secondary);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">👷 Ringkasan Kehadiran Penyadap Hari Ini &nbsp;<span style="font-weight:400;">(Total Penyadap: ${s.total})</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:.35rem 1.25rem;font-size:.8rem;align-items:baseline;">
        <span style="color:var(--primary);font-weight:700;">✅ Aktif: ${s.aktif}</span>
        <span style="color:var(--text-secondary);font-size:.72rem;">(Pemb.1:${s.pemb1} | Pemb.2:${s.pemb2} | Pemb.3:${s.pemb3} | Pengecasan:${s.pengecasan} | Ludang:${s.ludang})</span>
        <span style="color:var(--warning);font-weight:600;">🟡 Sakit: ${s.sakit}</span>
        <span style="color:var(--text-secondary);">⚪ Izin: ${s.izin}</span>
        <span style="color:var(--danger);font-weight:600;">🔴 Alpa: ${s.tidakHadir}</span>
        <span style="font-weight:600;">⏳ Belum di CDE: ${s.belumCde}</span>
      </div>
    </div>`;
  }

  // ── Helper untuk membangun Summary Banner makro di bagian atas ──
  function buildSummaryBannerHtml(title, totalLuas, targetTahun, realTahun, pctTahun, roPeriode, pctRoTahun, realPeriode, pctReal, statusColor) {
    return `
      <div class="card" style="padding:1.25rem; margin-bottom:1.5rem; border-left:4px solid var(--primary); background:var(--bg-surface-elevated); border-radius:var(--radius-md);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
          <div style="display:flex; flex-direction:column; gap:.25rem;">
            <span style="font-size:.78rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600; letter-spacing:.05em;">Cakupan Wilayah</span>
            <strong style="font-size:1.15rem; color:var(--text-primary);">${title}</strong>
          </div>
          <div>
            <span style="font-size:.8rem; color:var(--text-secondary);">Total Luas: </span>
            <strong style="font-size:.95rem; color:var(--text-primary);">${(parseFloat(totalLuas) || 0).toFixed(2)} ha</strong>
          </div>
        </div>
        
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-top:0.5rem;">
          <div style="display:flex; flex-direction:column; gap:.2rem;">
            <span style="font-size:.75rem; color:var(--text-secondary);">Target Tahunan</span>
            <strong style="font-size:1.05rem; color:var(--text-primary);">${targetTahun.toLocaleString('id-ID')} kg</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:.2rem;">
            <span style="font-size:.75rem; color:var(--text-secondary);">Pencapaian s.d Hari Ini</span>
            <strong style="font-size:1.05rem; color:var(--primary);">${realTahun.toLocaleString('id-ID')} kg <span style="font-size:.8rem; color:var(--text-secondary);">(${pctTahun}%)</span></strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:.2rem;">
            <span style="font-size:.75rem; color:var(--text-secondary);">RO Periode Ini</span>
            <strong style="font-size:1.05rem; color:var(--warning);">${roPeriode.toLocaleString('id-ID')} kg <span style="font-size:.8rem; color:var(--text-secondary);">(${pctRoTahun}% dari target tahunan)</span></strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:.2rem;">
            <span style="font-size:.75rem; color:var(--text-secondary);">Realisasi Periode Ini</span>
            <strong style="font-size:1.05rem; color:${statusColor};">${realPeriode.toLocaleString('id-ID')} kg <span style="font-size:.8rem; color:var(--text-secondary);">(${pctReal}% dari target tahunan)</span></strong>
          </div>
        </div>
      </div>
    `;
  }

  // ── 1. BKPH Level: Tampilkan RPH list ──────────────────────────
  async function renderBKPHLevel(container) {
    const allRph       = await window.db.getAllActive('rph');
    const allTpg       = await window.db.getAllActive('tpg');
    const allReal      = await window.db.getAllActive('realisasi');
    const allTarRph    = await window.db.getAllActive('target_rph');
    const allUsers     = await window.db.getAllActive('users');
    const allPetak     = await window.db.getAllActive('petak');
    const allAP        = await window.db.getAllActive('anak_petak');
    const allPgn       = await window.db.getAllActive('penugasan');
    const allKehadiran = await window.db.getAllActive('kehadiran');

    const year     = state.tahun;
    const todayStr = new Date().toISOString().split('T')[0];

    // ── KALKULASI SUMMARY BANNER BKPH ──
    const allTarBkph = await window.db.getAllActive('target_bkph');
    const tarBkph = allTarBkph.find(t => parseInt(t.tahun) === parseInt(year));
    const targetTahun = tarBkph ? tarBkph.target_kg : 0;
    const targetPeriode = targetTahun / 12; // target bulanan

    const totalLuas = allPetak.reduce((sum, p) => sum + (parseFloat(p.luas_ha) || 0), 0);

    // Kehadiran & Penyadap total BKPH hari ini (semua penyadap aktif)
    const allApIds  = allAP.map(ap => ap.id);
    const allPndIds = _getPenyadapIdsByApIds(allApIds, allPgn);
    const khdBkph   = _buildKehadiranSummary(allPndIds, todayStr, allKehadiran);

    // Filter realisasi seluruh BKPH secara hirarkis (hanya dari penyadap yang memiliki penugasan aktif)
    const realisasiBkphList = allReal.filter(rl => allPndIds.length > 0 ? allPndIds.includes(rl.penyadap_id) : true);

    // Pencapaian s.d hari ini (Realisasi akumulatif tahun ini)
    const realTahun = realisasiBkphList
      .filter(rl => new Date(rl.tanggal).getFullYear() === year)
      .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

    const allRO = await window.db.getAllActive('ro');
    const roPeriode = allRO
      .filter(ro => parseInt(ro.tahun) === parseInt(year) && parseInt(ro.bulan) === parseInt(state.bulan) && parseInt(ro.periode) === parseInt(state.periode))
      .reduce((sum, ro) => sum + (parseFloat(ro.kesanggupan) || 0), 0);

    const realPeriode = realisasiBkphList.filter(rl => {
      const d = new Date(rl.tanggal);
      const rlYear = d.getFullYear();
      const rlMonth = d.getMonth() + 1;
      const rlDay = d.getDate();
      if (rlYear !== year || rlMonth !== state.bulan) return false;
      if (state.periode === 1) return rlDay >= 1 && rlDay <= 15;
      return rlDay >= 16;
    }).reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

    const pctTahun = targetTahun > 0 ? ((realTahun / targetTahun) * 100).toFixed(2) : '0.00';
    const pctRoTahun = targetTahun > 0 ? ((roPeriode / targetTahun) * 100).toFixed(2) : '0.00';
    const pctReal = targetTahun > 0 ? ((realPeriode / targetTahun) * 100).toFixed(2) : '0.00';

    const st = getStatusIndicator(realPeriode, targetPeriode);

    const bannerHtml = buildSummaryBannerHtml(
      'BKPH Bantarkawung (Total Wilayah)',
      totalLuas, targetTahun, realTahun, pctTahun,
      roPeriode, pctRoTahun, realPeriode, pctReal,
      st.color
    );

    let rphs = allRph;
    if (state.search) {
      rphs = allRph.filter(r => r.nama.toLowerCase().includes(state.search.toLowerCase()));
    }

    const cardsHtml = await Promise.all(rphs.map(async r => {
      const tar = allTarRph.find(t => t.tahun === year && t.rph_id === r.id);
      const targetKg = tar ? tar.target_kg : 0;
      const targetPeriodeRph = targetKg / 12;

      const tpgIds = allTpg.filter(t => t.rph_id === r.id).map(t => t.id);

      // Kehadiran per RPH hari ini
      const tpgIdsRph = allTpg.filter(tt => tt.rph_id === r.id).map(tt => tt.id);
      const apIdsRph  = allAP.filter(ap => tpgIdsRph.includes(ap.tpg_id)).map(ap => ap.id);
      const pndIdsRph = _getPenyadapIdsByApIds(apIdsRph, allPgn);
      const khdRph    = _buildKehadiranSummary(pndIdsRph, todayStr, allKehadiran);

      // Filter realisasi RPH hirarkis berbasis penyadap aktif di RPH ini
      const realRphList = allReal.filter(rl => pndIdsRph.length > 0 ? pndIdsRph.includes(rl.penyadap_id) : tpgIds.includes(rl.tpg_id));

      // 1. Realisasi Periode Ini (sesuai filter Bulan & Periode aktif di dashboard)
      const realRphPeriode = realRphList.filter(rl => {
        const d = new Date(rl.tanggal);
        if (d.getFullYear() !== year || (d.getMonth() + 1) !== state.bulan) return false;
        if (state.periode === 1) return d.getDate() >= 1 && d.getDate() <= 15;
        return d.getDate() >= 16;
      }).reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      // 2. Realisasi Tahunan (s.d. Hari Ini)
      const realRphTahun = realRphList
        .filter(rl => new Date(rl.tanggal).getFullYear() === year)
        .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      // Luas terakumulasi dari semua petak di RPH ini
      const luasRph = allPetak
        .filter(p => p.rph_id === r.id)
        .reduce((sum, p) => sum + (parseFloat(p.luas_ha) || 0), 0);

      const pctPeriode = targetPeriodeRph > 0 ? ((realRphPeriode / targetPeriodeRph) * 100).toFixed(2) : '0.00';
      const pctTahun   = targetKg > 0 ? ((realRphTahun / targetKg) * 100).toFixed(2) : '0.00';
      const st         = getStatusIndicator(realRphPeriode, targetPeriodeRph);

      if (state.filterStatus && st.cls !== `status-${state.filterStatus}`) return '';

      // Nama KRPH (role='krph', scope=rph.id)
      const krph = allUsers.find(u => u.role === 'krph' && u.scope === r.id);
      const krphLine = krph
        ? `<div style="font-size:.78rem;color:var(--text-secondary);margin-top:.2rem;">KRPH ${krph.nama_lengkap}</div>`
        : '';

      return `
        <div class="card metric-card hover-card" onclick="DashboardModule.drillTo('rph', '${r.id}', '${r.nama}')" style="border-left:5px solid ${st.color};cursor:pointer;">
          <div class="metric-header">
            <span class="metric-title" style="font-size:1.1rem;font-weight:600;">${r.nama}</span>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          ${krphLine}
          <div style="margin-top:.85rem;display:flex;flex-direction:column;gap:.35rem;">
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Target Tahunan</span>
              <span style="float:right;font-weight:600;">${targetKg.toLocaleString('id-ID')} kg</span>
            </div>
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Realisasi Periode Ini</span>
              <span style="float:right;font-weight:600;color:${st.color};">${realRphPeriode.toLocaleString('id-ID')} kg (${pctPeriode}%)</span>
            </div>
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Pencapaian s.d Hari Ini</span>
              <span style="float:right;font-weight:600;color:var(--primary);">${realRphTahun.toLocaleString('id-ID')} kg (${pctTahun}%)</span>
            </div>
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Luas</span>
              <span style="float:right;font-weight:600;">${(parseFloat(luasRph) || 0).toFixed(2)} ha</span>
            </div>
            <div class="progress-bar-container" style="margin-top:.25rem;">
              <div class="progress-bar-fill" style="width:${Math.min(100, pctPeriode)}%;background-color:${st.color};"></div>
            </div>
            ${_buildKehadiranCardHtml(khdRph)}
          </div>
        </div>
      `;
    }));

    container.innerHTML = `
      ${bannerHtml}
      ${_buildKehadiranBannerHtml(khdBkph)}
      <h3 style="margin-bottom:1rem;color:var(--primary);">Daftar Wilayah RPH</h3>
      <div class="metrics-grid">
        ${cardsHtml.join('') || '<div class="empty-state" style="grid-column:1/-1;">Tidak ada data RPH yang sesuai filter</div>'}
      </div>
    `;
  }

  // ── 2. RPH Level: Tampilkan TPG list ──────────────────────────
  async function renderRPHLevel(container, rphId) {
    const allTpg       = await window.db.getAllActive('tpg');
    const allReal      = await window.db.getAllActive('realisasi');
    const allTarTpg    = await window.db.getAllActive('target_tpg');
    const allUsers     = await window.db.getAllActive('users');
    const allPetak     = await window.db.getAllActive('petak');
    const allPgn       = await window.db.getAllActive('penugasan');
    const allKehadiran = await window.db.getAllActive('kehadiran');
    const year     = state.tahun;
    const todayStr = new Date().toISOString().split('T')[0];

    // ── KALKULASI SUMMARY BANNER RPH ──
    const allTarRph = await window.db.getAllActive('target_rph');
    const tarRph = allTarRph.find(t => parseInt(t.tahun) === parseInt(year) && t.rph_id === rphId);
    const targetTahun = tarRph ? tarRph.target_kg : 0;
    const targetPeriode = targetTahun / 12; // target bulanan

    const totalLuas = allPetak.filter(p => p.rph_id === rphId).reduce((sum, p) => sum + (parseFloat(p.luas_ha) || 0), 0);

    const tpgIds = allTpg.filter(t => t.rph_id === rphId).map(t => t.id);
    const allRO = await window.db.getAllActive('ro');
    const allAP = await window.db.getAllActive('anak_petak');
    const apOfRph = allAP.filter(ap => tpgIds.includes(ap.tpg_id)).map(ap => ap.id);
    const pndOfRph = _getPenyadapIdsByApIds(apOfRph, allPgn);

    // Filter realisasi RPH hirarkis berbasis penyadap aktif di RPH ini
    const realRphList = allReal.filter(rl => pndOfRph.length > 0 ? pndOfRph.includes(rl.penyadap_id) : tpgIds.includes(rl.tpg_id));

    // Pencapaian s.d hari ini
    const realTahun = realRphList
      .filter(rl => new Date(rl.tanggal).getFullYear() === year)
      .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

    const roPeriode = allRO
      .filter(ro => parseInt(ro.tahun) === parseInt(year) && parseInt(ro.bulan) === parseInt(state.bulan) && parseInt(ro.periode) === parseInt(state.periode) && apOfRph.includes(ro.areal_id))
      .reduce((sum, ro) => sum + (parseInt(ro.kesanggupan) || 0), 0);

    const realPeriode = realRphList.filter(rl => {
      const d = new Date(rl.tanggal);
      const rlYear = d.getFullYear();
      const rlMonth = d.getMonth() + 1;
      const rlDay = d.getDate();
      if (rlYear !== year || rlMonth !== state.bulan) return false;
      if (state.periode === 1) return rlDay >= 1 && rlDay <= 15;
      return rlDay >= 16;
    }).reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

    const pctTahun = targetTahun > 0 ? ((realTahun / targetTahun) * 100).toFixed(2) : '0.00';
    const pctRoTahun = targetTahun > 0 ? ((roPeriode / targetTahun) * 100).toFixed(2) : '0.00';
    const pctReal = targetTahun > 0 ? ((realPeriode / targetTahun) * 100).toFixed(2) : '0.00';

    const st = getStatusIndicator(realPeriode, targetPeriode);

    // Ambil nama RPH
    const currentRph = await window.db.get('rph', rphId);
    const bannerHtml = buildSummaryBannerHtml(
      `RPH ${currentRph ? currentRph.nama : '—'}`,
      totalLuas, targetTahun, realTahun, pctTahun,
      roPeriode, pctRoTahun, realPeriode, pctReal,
      st.color
    );

    // Kehadiran total RPH hari ini (menggunakan pndOfRph yang sudah dideklarasikan di atas)
    const khdRph   = _buildKehadiranSummary(pndOfRph, todayStr, allKehadiran);

    let tpgs = allTpg.filter(t => t.rph_id === rphId);
    if (state.search) {
      tpgs = tpgs.filter(t => t.nama.toLowerCase().includes(state.search.toLowerCase()));
    }

    const cardsHtml = await Promise.all(tpgs.map(async t => {
      const tar = allTarTpg.find(x => x.tahun === year && x.tpg_id === t.id);
      const targetKg = tar ? tar.target_kg : 0;
      const targetPeriodeTpg = targetKg / 12;

      // Kehadiran & Penyadap per TPG hari ini
      const apIdsTpg  = allAP.filter(ap => ap.tpg_id === t.id).map(ap => ap.id);
      const pndIdsTpg = _getPenyadapIdsByApIds(apIdsTpg, allPgn);
      const khdTpg    = _buildKehadiranSummary(pndIdsTpg, todayStr, allKehadiran);

      // Filter realisasi TPG hirarkis berbasis penyadap aktif di TPG ini
      const realTpgList = allReal.filter(rl => pndIdsTpg.length > 0 ? pndIdsTpg.includes(rl.penyadap_id) : rl.tpg_id === t.id);

      // 1. Realisasi Periode Ini (sesuai filter Bulan & Periode aktif di dashboard)
      const realTpgPeriode = realTpgList.filter(rl => {
        const d = new Date(rl.tanggal);
        if (d.getFullYear() !== year || (d.getMonth() + 1) !== state.bulan) return false;
        if (state.periode === 1) return d.getDate() >= 1 && d.getDate() <= 15;
        return d.getDate() >= 16;
      }).reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      // 2. Realisasi Tahunan (s.d. Hari Ini)
      const realTpgTahun = realTpgList
        .filter(rl => new Date(rl.tanggal).getFullYear() === year)
        .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      // Luas terakumulasi dari semua petak di TPG ini
      const luasTpg = allPetak
        .filter(p => p.tpg_id === t.id)
        .reduce((sum, p) => sum + (parseFloat(p.luas_ha) || 0), 0);

      const pctPeriode = targetPeriodeTpg > 0 ? ((realTpgPeriode / targetPeriodeTpg) * 100).toFixed(2) : '0.00';
      const pctTahun   = targetKg > 0 ? ((realTpgTahun / targetKg) * 100).toFixed(2) : '0.00';
      const st         = getStatusIndicator(realTpgPeriode, targetPeriodeTpg);

      if (state.filterStatus && st.cls !== `status-${state.filterStatus}`) return '';

      const mandorTpg = allUsers.find(u => u.role === 'tpg' && u.scope === t.id);
      const mandorLine = mandorTpg
        ? `<div style="font-size:.78rem;color:var(--text-secondary);margin-top:.2rem;">Mandor ${mandorTpg.nama_lengkap}</div>`
        : '';

      return `
        <div class="card metric-card hover-card" onclick="DashboardModule.drillTo('tpg', '${t.id}', '${t.nama}')" style="border-left:5px solid ${st.color};cursor:pointer;">
          <div class="metric-header">
            <span class="metric-title" style="font-size:1.1rem;font-weight:600;">${t.nama}</span>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          ${mandorLine}
          <div style="margin-top:.85rem;display:flex;flex-direction:column;gap:.35rem;">
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Target Tahunan</span>
              <span style="float:right;font-weight:600;">${targetKg.toLocaleString('id-ID')} kg</span>
            </div>
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Realisasi Periode Ini</span>
              <span style="float:right;font-weight:600;color:${st.color};">${realTpgPeriode.toLocaleString('id-ID')} kg (${pctPeriode}%)</span>
            </div>
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Pencapaian s.d Hari Ini</span>
              <span style="float:right;font-weight:600;color:var(--primary);">${realTpgTahun.toLocaleString('id-ID')} kg (${pctTahun}%)</span>
            </div>
            <div style="font-size:.8rem;">
              <span style="color:var(--text-secondary);">Luas</span>
              <span style="float:right;font-weight:600;">${luasTpg.toFixed(2)} ha</span>
            </div>
            <div class="progress-bar-container" style="margin-top:.25rem;">
              <div class="progress-bar-fill" style="width:${Math.min(100, pctPeriode)}%;background-color:${st.color};"></div>
            </div>
            ${_buildKehadiranCardHtml(khdTpg)}
          </div>
        </div>
      `;
    }));

    container.innerHTML = `
      ${bannerHtml}
      ${_buildKehadiranBannerHtml(khdRph)}
      <h3 style="margin-bottom:1rem;color:var(--primary);">Daftar TPG</h3>
      <div class="metrics-grid">
        ${cardsHtml.join('') || '<div class="empty-state" style="grid-column:1/-1;">Tidak ada data TPG yang sesuai filter</div>'}
      </div>
    `;
  }

  // ── 3. TPG Level: Tampilkan Mandor list ───────────────────────
  async function renderTPGLevel(container, tpgId) {
    const allUsers     = await window.db.getAllActive('users');
    const allReal      = await window.db.getAllActive('realisasi');
    const allTarMdr    = await window.db.getAllActive('target_mandor');
    const allAP        = await window.db.getAllActive('anak_petak');
    const allPetak     = await window.db.getAllActive('petak');
    const allPgn       = await window.db.getAllActive('penugasan');
    const allKehadiran = await window.db.getAllActive('kehadiran');
    const year     = state.tahun;
    const todayStr = new Date().toISOString().split('T')[0];

    // Anak petak di bawah TPG ini (fix: definisikan apOfTpg sebelum dipakai di roPeriode)
    const apOfTpg = allAP.filter(ap => ap.tpg_id === tpgId).map(ap => ap.id);

    // Kehadiran seluruh penyadap di TPG ini hari ini
    const pndOfTpg = _getPenyadapIdsByApIds(apOfTpg, allPgn);
    const khdTpg   = _buildKehadiranSummary(pndOfTpg, todayStr, allKehadiran);

    // ── KALKULASI SUMMARY BANNER TPG ──
    const allTarTpg = await window.db.getAllActive('target_tpg');
    const tarTpg = allTarTpg.find(t => parseInt(t.tahun) === parseInt(year) && t.tpg_id === tpgId);
    const targetTahun = tarTpg ? tarTpg.target_kg : 0;
    const targetPeriode = targetTahun / 12; // target bulanan

    const totalLuas = allPetak.filter(p => p.tpg_id === tpgId).reduce((sum, p) => sum + (parseFloat(p.luas_ha) || 0), 0);

    // Pencapaian s.d hari ini
    const realTahun = allReal
      .filter(rl => (pndOfTpg.length > 0 ? pndOfTpg.includes(rl.penyadap_id) : rl.tpg_id === tpgId) && new Date(rl.tanggal).getFullYear() === year)
      .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

    const allRO = await window.db.getAllActive('ro');
    const roPeriode = allRO
      .filter(ro => parseInt(ro.tahun) === parseInt(year) && parseInt(ro.bulan) === parseInt(state.bulan) && parseInt(ro.periode) === parseInt(state.periode) && apOfTpg.includes(ro.areal_id))
      .reduce((sum, ro) => sum + (parseInt(ro.kesanggupan) || 0), 0);

    const realPeriode = allReal.filter(rl => {
      if (pndOfTpg.length > 0 ? !pndOfTpg.includes(rl.penyadap_id) : rl.tpg_id !== tpgId) return false;
      const d = new Date(rl.tanggal);
      const rlYear = d.getFullYear();
      const rlMonth = d.getMonth() + 1;
      const rlDay = d.getDate();
      if (rlYear !== year || rlMonth !== state.bulan) return false;
      if (state.periode === 1) return rlDay >= 1 && rlDay <= 15;
      return rlDay >= 16;
    }).reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

    const pctTahun = targetTahun > 0 ? ((realTahun / targetTahun) * 100).toFixed(2) : '0.00';
    const pctRoTahun = targetTahun > 0 ? ((roPeriode / targetTahun) * 100).toFixed(2) : '0.00';
    const pctReal = targetTahun > 0 ? ((realPeriode / targetTahun) * 100).toFixed(2) : '0.00';

    const st = getStatusIndicator(realPeriode, targetPeriode);

    // Ambil nama TPG
    const currentTpg = await window.db.get('tpg', tpgId);
    const bannerHtml = buildSummaryBannerHtml(
      `TPG ${currentTpg ? currentTpg.nama : '—'}`,
      totalLuas, targetTahun, realTahun, pctTahun,
      roPeriode, pctRoTahun, realPeriode, pctReal,
      st.color
    );

    // Filter mandor SADAP yang scope-nya TPG ini (bukan Mandor TPG itu sendiri)
    let mandors = allUsers.filter(u => u.role === 'mandor' && u.scope === tpgId);
    if (state.search) {
      mandors = mandors.filter(u => u.nama_lengkap.toLowerCase().includes(state.search.toLowerCase()));
    }

    const allApTargets = await window.db.getAllActive('target_anak_petak');
    const apTargetList = allApTargets.filter(x => parseInt(x.tahun) === parseInt(year));

    const cardsHtml = await Promise.all(mandors.map(async m => {
      const myApIds = allAP.filter(ap => {
        const petak = allPetak.find(p => p.id === ap.petak_id);
        return petak && petak.mandor_id === m.id;
      }).map(ap => ap.id);

      const targetKg = apTargetList.filter(t => myApIds.includes(t.anak_petak_id)).reduce((s, t) => s + (parseInt(t.target_kg) || 0), 0);

      // Dapatkan penyadap aktif di bawah wilayah mandor m ini saja
      const pndOfMdr = _getPenyadapIdsByApIds(myApIds, allPgn);

      // Kehadiran penyadap khusus mandor m
      const khdMdr = _buildKehadiranSummary(pndOfMdr, todayStr, allKehadiran);

      // Realisasi tahunan mandor m
      const realMdr = allReal
        .filter(rl => pndOfMdr.includes(rl.penyadap_id) && new Date(rl.tanggal).getFullYear() === year)
        .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      // RO Periode mandor m (berdasarkan anak petak mandor ini)
      const roMdr = allRO
        .filter(ro => parseInt(ro.tahun) === parseInt(year) && parseInt(ro.bulan) === parseInt(state.bulan) && parseInt(ro.periode) === parseInt(state.periode) && myApIds.includes(ro.areal_id))
        .reduce((sum, ro) => sum + (parseInt(ro.kesanggupan) || 0), 0);

      // Realisasi Periode mandor m
      const realMdrPeriode = allReal.filter(rl => {
        if (!pndOfMdr.includes(rl.penyadap_id)) return false;
        const d = new Date(rl.tanggal);
        if (d.getFullYear() !== year || (d.getMonth() + 1) !== state.bulan) return false;
        if (state.periode === 1) return d.getDate() >= 1 && d.getDate() <= 15;
        return d.getDate() >= 16;
      }).reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      const roProgress = roMdr > 0 ? Math.min(100, (realMdrPeriode / roMdr) * 100) : 0;
      const roProgressColor = roProgress >= 100 ? 'var(--primary)' : roProgress >= 80 ? 'var(--warning)' : 'var(--danger)';

      const st = getStatusIndicator(realMdr, targetKg);

      if (state.filterStatus && st.cls !== `status-${state.filterStatus}`) {
        return '';
      }

      return `
        <div class="card metric-card hover-card" onclick="DashboardModule.drillTo('mandor', '${m.id}', '${m.nama_lengkap}')" style="border-left: 5px solid ${st.color}; cursor:pointer;">
          <div class="metric-header">
            <span class="metric-title" style="font-size:1.1rem;font-weight:600;">Mandor ${m.nama_lengkap}</span>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          <div style="margin-top:1rem;">
            <div style="font-size:.8rem;color:var(--text-secondary);">Realisasi vs Target Tahunan:</div>
            <strong style="font-size:1.1rem;">
              ${realMdr.toLocaleString('id-ID')} / ${targetKg.toLocaleString('id-ID')} kg
              <span style="font-size:0.8rem;font-weight:600;color:${targetKg > 0 ? (realMdr/targetKg >= 1 ? 'var(--primary)' : realMdr/targetKg >= 0.8 ? 'var(--warning)' : 'var(--danger)') : 'var(--text-secondary)'};">
                (${targetKg > 0 ? ((realMdr/targetKg)*100).toFixed(2) : '0.00'}%)
              </span>
            </strong>
            <div class="progress-bar-container" style="margin-top:.25rem;">
              <div class="progress-bar-fill" style="width: ${targetKg > 0 ? Math.min(100, (realMdr/targetKg)*100) : 0}%; background-color:${st.color};"></div>
            </div>
          </div>
          <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border-color);">
            <div style="font-size:.8rem;color:var(--text-secondary);">RO Periode Ini:</div>
            <strong style="font-size:1.1rem;color:${roProgressColor};">
              ${realMdrPeriode.toLocaleString('id-ID')} / ${roMdr.toLocaleString('id-ID')} kg
              <span style="font-size:0.8rem;">(${roProgress.toFixed(1)}%)</span>
            </strong>
            <div class="progress-bar-container" style="margin-top:.25rem;">
              <div class="progress-bar-fill" style="width:${roProgress}%;background-color:${roProgressColor};"></div>
            </div>
          </div>
          ${_buildKehadiranCardHtml(khdMdr)}
        </div>
      `;
    }));

    container.innerHTML = `
      ${bannerHtml}
      ${_buildKehadiranBannerHtml(khdTpg)}
      <h3 style="margin-bottom:1rem;color:var(--primary);">Daftar Mandor Sadap</h3>
      <div class="metrics-grid">
        ${cardsHtml.join('') || '<div class="empty-state" style="grid-column:1/-1;">Tidak ada data Mandor yang sesuai filter</div>'}
      </div>
    `;
  }

  // ── 4. Mandor Level: Tampilkan Dashboard Mandor Komprehensif ──
  async function renderMandorLevel(container, mandorId) {
    const t = state.tahun;
    const b = state.bulan;
    const p = state.periode;

    // Load data relasional
    const mandorUser  = await window.db.get('users', mandorId);
    
    // Dapatkan scopeTpgId: prioritas dari user.scope, lalu dari drillPath, lalu auto-detect
    let scopeTpgId = mandorUser ? mandorUser.scope : null;
    if (scopeTpgId) {
      const validTpg = await window.db.get('tpg', scopeTpgId);
      if (!validTpg) scopeTpgId = null;
    }
    
    if (!scopeTpgId) {
      // Coba ambil dari drillPath state
      const mandorDrill = state.drillPath.find(d => d.level === 'mandor');
      if (mandorDrill && mandorDrill.scopeTpg) {
        const validTpg = await window.db.get('tpg', mandorDrill.scopeTpg);
        if (validTpg) scopeTpgId = validTpg.id;
      }
    }
    
    if (!scopeTpgId) {
      // Auto-detect TPG dari anak_petak
      const allAPTemp = await window.db.getAllActive('anak_petak');
      const firstAP = allAPTemp.find(ap => ap.tpg_id);
      if (firstAP && firstAP.tpg_id) scopeTpgId = firstAP.tpg_id;
    }

    const allAP       = await window.db.getAllActive('anak_petak');
    const allPetak    = await window.db.getAllActive('petak');
    const allPnd      = await window.db.getAllActive('penyadap_master');
    const allPgn      = await window.db.getAllActive('penugasan');
    
    const allTarPnd   = await window.db.getAllActive('target_penyadap');
    const allRO       = await window.db.getAllActive('ro');
    const allReal     = await window.db.getAllActive('realisasi');
    const allKehadiran = await window.db.getAllActive('kehadiran');
    const allMonitoring = await window.db.getAllActive('monitoring');

    // Dapatkan petak-petak yang menjadi pangkuan Mandor ini saja (secara ketat melalui petak.mandor_id)
    let petakList = allPetak.filter(pt => pt.mandor_id === mandorId);

    // Jika di tabel petak belum ada mandor_id yang terisi, pelajari dari penugasan penyadap aktif milik mandor ini
    if (petakList.length === 0) {
      const myPgns = allPgn.filter(pg => (pg.mandor_id === mandorId || pg.created_by === mandorId) && pg.aktif === 1);
      const myApIdsFromPgn = [...new Set(myPgns.map(pg => pg.anak_petak_id))];
      const aps = allAP.filter(ap => myApIdsFromPgn.includes(ap.id));
      const pIds = [...new Set(aps.map(ap => ap.petak_id))];
      petakList = allPetak.filter(pt => pIds.includes(pt.id));
    }

    // Dapatkan anak_petak yang ADA di dalam petakList milik Mandor ini
    const petakIds = petakList.map(pt => pt.id);
    const myApIds = allAP.filter(ap => petakIds.includes(ap.petak_id)).map(ap => ap.id);
    const apOfTpg = allAP.filter(ap => myApIds.includes(ap.id));

    // Perhitungan Ringkasan Metrik
    const allApTargets = await window.db.getAllActive('target_anak_petak');
    const apTargetList = allApTargets.filter(x => parseInt(x.tahun) === parseInt(t));
    const targetPndOfMdr = allTarPnd.filter(tp => parseInt(tp.tahun) === parseInt(t) && myApIds.includes(tp.anak_petak_id));

    const sumTargetTahun = apTargetList.filter(x => myApIds.includes(x.anak_petak_id)).reduce((sum, x) => sum + (parseFloat(x.target_kg) || 0), 0);
    const targetPeriode = Math.round(sumTargetTahun / 12);

    // Kumpulkan seluruh data penyadap di anak petak mandor (menggunakan penugasan aktif)
    const activePndIds = _getPenyadapIdsByApIds(myApIds, allPgn);

    // 2. Rencana Operasional (RO) Periode ini
    const roPeriodeList = allRO.filter(ro => 
      parseInt(ro.tahun) === parseInt(t) && parseInt(ro.bulan) === parseInt(b) && parseInt(ro.periode) === parseInt(p) &&
      myApIds.includes(ro.areal_id)
    );
    const roPeriode = roPeriodeList.reduce((sum, x) => sum + (parseFloat(x.kesanggupan) || 0), 0);

    // 3. Realisasi getah bersih
    // Hari ini (tanggal sistem saat ini)
    const todayStr = new Date().toISOString().split('T')[0];
    const realHariIni = allReal
      .filter(rl => activePndIds.includes(rl.penyadap_id) && rl.tanggal === todayStr)
      .reduce((sum, x) => sum + (parseFloat(x.berat_bersih) || 0), 0);

    // Periode ini: realisasi dari tanggal 1 s.d 15 (Periode 1) or 16 s.d akhir (Periode 2)
    const realPeriodeList = allReal.filter(rl => {
      if (!activePndIds.includes(rl.penyadap_id)) return false;
      const d = new Date(rl.tanggal);
      const rlYear = d.getFullYear();
      const rlMonth = d.getMonth() + 1;
      const rlDay = d.getDate();
      if (parseInt(rlYear) !== parseInt(t) || parseInt(rlMonth) !== parseInt(b)) return false;
      if (parseInt(p) === 1) return rlDay >= 1 && rlDay <= 15;
      return rlDay >= 16;
    });
    const realPeriode = realPeriodeList.reduce((sum, x) => sum + (parseFloat(x.berat_bersih) || 0), 0);

    // Bulan ini
    const realBulan = allReal
      .filter(rl => activePndIds.includes(rl.penyadap_id) && parseInt(new Date(rl.tanggal).getFullYear()) === parseInt(t) && parseInt(new Date(rl.tanggal).getMonth() + 1) === parseInt(b))
      .reduce((sum, x) => sum + (parseFloat(x.berat_bersih) || 0), 0);

    // Tahun ini
    const realTahun = allReal
      .filter(rl => activePndIds.includes(rl.penyadap_id) && parseInt(new Date(rl.tanggal).getFullYear()) === parseInt(t))
      .reduce((sum, x) => sum + (parseFloat(x.berat_bersih) || 0), 0);

    // Progress
    const roProgress = roPeriode > 0 ? ((realPeriode / roPeriode) * 100).toFixed(2) : '0.00';
    const targetProgress = targetPeriode > 0 ? ((realPeriode / targetPeriode) * 100).toFixed(2) : '0.00';

    let roProgressColor = 'var(--danger)';
    const roProgressNum = parseFloat(roProgress);
    if (roProgressNum >= 100) {
      roProgressColor = 'var(--primary)';
    } else if (roProgressNum >= 80) {
      roProgressColor = 'var(--warning)';
    }

    // Kehadiran Hari ini (tanggal sistem saat ini)
    const pndKehadiranToday = allKehadiran.filter(k => k.tanggal === todayStr && activePndIds.includes(k.penyadap_id));
    
    // Status aktif: hadir + pembaharuan 1/2/3 + pengecasan + ludang
    const STATUS_AKTIF = ['hadir', 'pembaharuan_1', 'pembaharuan_2', 'pembaharuan_3', 'pengecasan', 'ludang'];
    const countAktif        = pndKehadiranToday.filter(k => STATUS_AKTIF.includes(k.status)).length;
    const countHadir        = pndKehadiranToday.filter(k => k.status === 'hadir').length;
    const countPemb1        = pndKehadiranToday.filter(k => k.status === 'pembaharuan_1').length;
    const countPemb2        = pndKehadiranToday.filter(k => k.status === 'pembaharuan_2').length;
    const countPemb3        = pndKehadiranToday.filter(k => k.status === 'pembaharuan_3').length;
    const countPengecasan   = pndKehadiranToday.filter(k => k.status === 'pengecasan').length;
    const countLudang       = pndKehadiranToday.filter(k => k.status === 'ludang').length;
    const countSakit          = pndKehadiranToday.filter(k => k.status === 'sakit').length;
    const countIzin           = pndKehadiranToday.filter(k => IZIN_STATUSES.includes(k.status)).length;
    const countIzinPertanian  = pndKehadiranToday.filter(k => k.status === 'izin_pertanian').length;
    const countIzinBangunan   = pndKehadiranToday.filter(k => k.status === 'izin_bangunan').length;
    const countIzinHajatan    = pndKehadiranToday.filter(k => k.status === 'izin_hajatan').length;
    const countIzinLainnya    = pndKehadiranToday.filter(k => k.status === 'izin_lainnya').length;
    const countTidakHadir     = pndKehadiranToday.filter(k => k.status === 'tidak_hadir').length;
    const countBelumDicek     = Math.max(0, activePndIds.length - pndKehadiranToday.length);

    // Setor getah
    const countSudahSetor = [...new Set(realPeriodeList.filter(rl => activePndIds.includes(rl.penyadap_id)).map(rl => rl.penyadap_id))].length;
    const countBelumSetor = Math.max(0, activePndIds.length - countSudahSetor);
    const countRencanaSetor = [...new Set(roPeriodeList.filter(ro => (parseFloat(ro.kesanggupan) || 0) > 0 && activePndIds.includes(ro.penyadap_id)).map(ro => ro.penyadap_id))].length;

    // Monitoring terbanyak
    const monitoringToday = allMonitoring.filter(m => m.tanggal === todayStr && activePndIds.includes(m.penyadap_id));
    const monCounts = {};
    monitoringToday.forEach(m => {
      monCounts[m.kategori] = (monCounts[m.kategori] || 0) + 1;
    });

    // Render Ringkasan HTML
    let ringkasanHtml = `
      <!-- Metrik Utama -->
      <div class="metrics-grid" style="margin-bottom:2rem;">
        <div class="card metric-card">
          <div class="metric-header"><span class="metric-title">TARGET MANDOR</span><span class="metric-icon">🎯</span></div>
          <div>
            <div class="metric-value">${(parseFloat(sumTargetTahun) || 0).toLocaleString('id-ID')} <span style="font-size:1rem;color:var(--text-secondary);">kg</span></div>
            <div class="metric-footer">Total Target Petak Pangkuan</div>
          </div>
        </div>

        <div class="card metric-card">
          <div class="metric-header"><span class="metric-title">PRODUKSI S.D HARI INI</span><span class="metric-icon">📈</span></div>
          <div>
            <div class="metric-value">${(parseFloat(realTahun) || 0).toLocaleString('id-ID')} <span style="font-size:1rem;color:var(--text-secondary);">kg</span> <span style="font-size:.85rem;font-weight:600;color:${sumTargetTahun>0?(realTahun/sumTargetTahun>=1?'var(--primary)':realTahun/sumTargetTahun>=0.8?'var(--warning)':'var(--danger)'):'var(--text-secondary)'};"> (${sumTargetTahun>0?((realTahun/sumTargetTahun)*100).toFixed(2) : '0.00'}%)</span></div>
            <div class="metric-footer">Dari Awal Tahun ${t}</div>
          </div>
        </div>

        <div class="card metric-card">
          <div class="metric-header"><span class="metric-title">RENCANA OPERASIONAL (RO)</span><span class="metric-icon">📋</span></div>
          <div>
            <div class="metric-value">${(parseFloat(roPeriode) || 0).toLocaleString('id-ID')} <span style="font-size:1rem;color:var(--text-secondary);">kg</span> <span style="font-size:.85rem;font-weight:600;color:${sumTargetTahun>0?(roPeriode/sumTargetTahun>=1?'var(--primary)':roPeriode/sumTargetTahun>=0.8?'var(--warning)':'var(--danger)'):'var(--text-secondary)'};"> (${sumTargetTahun>0?((roPeriode/sumTargetTahun)*100).toFixed(2) : '0.00'}%)</span></div>
            <div class="metric-footer">Periode ${p} Bulan ${b}</div>
          </div>
        </div>

        <div class="card metric-card">
          <div class="metric-header"><span class="metric-title">REALISASI PERIODE</span><span class="metric-icon">🛢️</span></div>
          <div>
            <div class="metric-value">${(parseFloat(realPeriode) || 0).toLocaleString('id-ID')} <span style="font-size:1rem;color:var(--text-secondary);">kg</span> <span style="font-size:.85rem;font-weight:600;color:${sumTargetTahun>0?(realPeriode/sumTargetTahun>=1?'var(--primary)':realPeriode/sumTargetTahun>=0.8?'var(--warning)':'var(--danger)'):'var(--text-secondary)'};"> (${sumTargetTahun>0?((realPeriode/sumTargetTahun)*100).toFixed(2) : '0.00'}%)</span></div>
            <div class="metric-footer">Hari ini: ${(parseFloat(realHariIni) || 0).toLocaleString('id-ID')} kg</div>
          </div>
        </div>

        <div class="card metric-card">
          <div class="metric-header"><span class="metric-title">SELISIH RO - REALISASI</span><span class="metric-icon">⚖️</span></div>
          <div>
            <div class="metric-value" style="color: ${realPeriode >= roPeriode ? 'var(--primary)' : 'var(--danger)'};">
              ${realPeriode >= roPeriode ? '+' : ''}${(parseFloat(realPeriode - roPeriode) || 0).toLocaleString('id-ID')} <span style="font-size:1rem;color:var(--text-secondary);">kg</span>
            </div>
            <div class="metric-footer">${realPeriode >= roPeriode ? 'Surplus dari kesanggupan RO' : 'Kurang dari kesanggupan RO'}</div>
          </div>
        </div>
      </div>

      <!-- Metrik Sekunder (Grid Kecil) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;margin-bottom:2rem;">
        <!-- Card Kehadiran -->
        <div class="card" style="padding:1rem; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <h4 style="margin-bottom:.75rem;font-size:.9rem;color:var(--text-secondary);">👷 KEHADIRAN HARI INI</h4>
            <div style="font-size:.85rem;line-height:1.6;">
              <div style="display:flex;justify-content:space-between;padding:.15rem 0;border-bottom:1px solid var(--border-color);margin-bottom:.25rem;">
                <span style="font-weight:600;color:var(--primary);">✅ Aktif Kerja</span>
                <strong style="color:var(--primary);">${countAktif}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding-left:.5rem;"><span style="color:var(--text-secondary);">└ Hadir</span><strong style="color:var(--primary);">${countHadir}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-left:.5rem;"><span style="color:var(--text-secondary);">└ Pembaharuan 1</span><strong style="color:var(--primary);">${countPemb1}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-left:.5rem;"><span style="color:var(--text-secondary);">└ Pembaharuan 2</span><strong style="color:var(--primary);">${countPemb2}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-left:.5rem;"><span style="color:var(--text-secondary);">└ Pembaharuan 3</span><strong style="color:var(--primary);">${countPemb3}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-left:.5rem;"><span style="color:var(--text-secondary);">└ Pengecasan/Stimulasi</span><strong style="color:var(--primary);">${countPengecasan}</strong></div>
              <div style="display:flex;justify-content:space-between;padding-left:.5rem;margin-bottom:.25rem;"><span style="color:var(--text-secondary);">└ Ludang</span><strong style="color:var(--primary);">${countLudang}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>🟡 Sakit</span><strong style="color:var(--warning);">${countSakit}</strong></div>
              ${countIzin > 0 ? `
              <div style="display:flex;justify-content:space-between;"><span>⚪ Izin (${countIzin})</span><strong style="color:var(--text-secondary);"></strong></div>
              ${countIzinPertanian > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.78rem;"><span style="color:var(--text-secondary);">↳ Pertanian</span><strong style="color:var(--text-secondary);">${countIzinPertanian}</strong></div>` : ''}
              ${countIzinBangunan  > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.78rem;"><span style="color:var(--text-secondary);">↳ Bangunan</span><strong style="color:var(--text-secondary);">${countIzinBangunan}</strong></div>` : ''}
              ${countIzinHajatan   > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.78rem;"><span style="color:var(--text-secondary);">↳ Hajatan</span><strong style="color:var(--text-secondary);">${countIzinHajatan}</strong></div>` : ''}
              ${countIzinLainnya   > 0 ? `<div style="display:flex;justify-content:space-between;padding-left:.75rem;font-size:.78rem;"><span style="color:var(--text-secondary);">↳ Lainnya</span><strong style="color:var(--text-secondary);">${countIzinLainnya}</strong></div>` : ''}
              ` : '<div style="display:flex;justify-content:space-between;"><span>⚪ Izin</span><strong style="color:var(--text-secondary);">0</strong></div>'}
              <div style="display:flex;justify-content:space-between;"><span>🔴 Tidak Hadir</span><strong style="color:var(--danger);">${countTidakHadir}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>⏳ Belum di CDE</span><strong>${countBelumDicek}</strong></div>
            </div>
          </div>
          ${(window.app && window.app.currentUser && ['admin','mandor','tpg'].includes(window.app.currentUser.role)) ? `
            <button class="btn btn-secondary btn-xs" style="margin-top:.75rem; width:100%; justify-content:center;" onclick="DashboardModule.openAttendanceModal('${mandorId}')">📝 Catat Kehadiran</button>
          ` : ''}
        </div>

        <!-- Card Penyadap -->
        <div class="card" style="padding:1rem;">
          <h4 style="margin-bottom:.75rem;font-size:.9rem;color:var(--text-secondary);">👥 STATUS PENYADAP</h4>
          <div style="font-size:.85rem;line-height:1.6;margin-top:.5rem;">
            <div style="display:flex;justify-content:space-between;"><span>Penyadap Aktif</span><strong>${activePndIds.length}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>Sudah Setor</span><strong style="color:var(--primary);">${countSudahSetor}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>Belum Setor</span><strong style="color:var(--danger);">${countBelumSetor}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span>Rencana Setor</span><strong style="color:var(--warning);">${countRencanaSetor}</strong></div>
          </div>
        </div>

        <!-- Card Monitoring Terbanyak -->
        <div class="card" style="padding:1rem;">
          <h4 style="margin-bottom:.75rem;font-size:.9rem;color:var(--text-secondary);">🔎 MONITORING TERBANYAK</h4>
          <div style="font-size:.85rem;line-height:1.6;">
            ${Object.keys(monCounts).length > 0 
              ? Object.entries(monCounts).map(([cat, count]) => `<div style="display:flex;justify-content:space-between;"><span>${cat}</span><strong>${count}</strong></div>`).join('')
              : '<div class="text-muted" style="text-align:center;padding:1rem 0;">Belum ada catatan lapangan</div>'
            }
          </div>
        </div>

        <!-- Card Progres Periode (Radial Chart Visual) -->
        <div class="card" style="padding:1rem;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <h4 style="margin-bottom:.5rem;font-size:.9rem;color:var(--text-secondary);align-self:flex-start;">📈 PROGRESS RO PERIODE</h4>
          <div style="position:relative;width:80px;height:80px;border-radius:50%;background:conic-gradient(${roProgressColor} ${roProgress}%, var(--bg-surface-elevated) 0);display:flex;align-items:center;justify-content:center;margin:auto;">
            <div style="width:65px;height:65px;border-radius:50%;background:var(--card-bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;color:var(--text-primary);">
              ${roProgress}%
            </div>
          </div>
          <div style="font-size:.75rem;color:var(--text-secondary);text-align:center;margin-top:.5rem;">
            ${realPeriode.toLocaleString('id-ID')} / ${roPeriode.toLocaleString('id-ID')} Kg
          </div>
        </div>
      </div>
    `;

    // ── Tabel Operasional Rekap per Petak ─────────────────────────
    let petakHtml = '';

    for (const pt of petakList) {
      // Dapatkan anak petak di petak ini yang terhubung dengan TPG mandor
      const aps = apOfTpg.filter(ap => ap.petak_id === pt.id);
      const apIds = aps.map(a => a.id);

      const adminTargetPetak = aps.reduce((sum, ap) => {
        const record = apTargetList.find(x => x.anak_petak_id === ap.id);
        return sum + (record ? (record.target_kg || 0) : 0);
      }, 0);

      // Cari penugasan penyadap untuk anak petak ini (yang aktif)
      const penugasanList = allPgn.filter(pg => pg.aktif === 1 && apIds.includes(pg.anak_petak_id));

      // Jika ada pencarian, saring penyadapnya
      let filteredPenugasan = penugasanList;
      if (state.search) {
        filteredPenugasan = penugasanList.filter(pg => {
          const psy = allPnd.find(p => p.id === pg.penyadap_id || p.nomor === pg.penyadap_id);
          return psy && (psy.nama.toLowerCase().includes(state.search.toLowerCase()) || psy.nomor.toLowerCase().includes(state.search.toLowerCase()));
        });
      }

      if (filteredPenugasan.length === 0 && state.search) continue;

      // Hitung akumulasi petak
      const totTargetTahun = filteredPenugasan.reduce((s, pg) => {
        const targ = targetPndOfMdr.find(tp => tp.penyadap_id === pg.penyadap_id && tp.anak_petak_id === pg.anak_petak_id);
        return s + (targ ? (targ.target_kg || 0) : 0);
      }, 0);
      const totLuas = filteredPenugasan.reduce((s, pg) => {
        const targ = targetPndOfMdr.find(tp => tp.penyadap_id === pg.penyadap_id && tp.anak_petak_id === pg.anak_petak_id);
        const ap = aps.find(a => a.id === pg.anak_petak_id);
        return s + (targ ? (parseFloat(targ.luas_ha) || 0) : (ap ? (parseFloat(ap.luas_ha) || 0) : 0));
      }, 0);
      const totPohon = filteredPenugasan.reduce((s, pg) => {
        const targ = targetPndOfMdr.find(tp => tp.penyadap_id === pg.penyadap_id && tp.anak_petak_id === pg.anak_petak_id);
        const ap = aps.find(a => a.id === pg.anak_petak_id);
        return s + (targ ? (parseInt(targ.pohon) || 0) : (pg.jumlah_pohon || (ap ? (parseInt(ap.jumlah_pohon) || 0) : 0)));
      }, 0);
      
      // Ambil realisasi kumulatif s.d hari ini untuk penyadap-penyadap di anak petak ini
      let totProd = 0;
      let totRo = 0;
      let totReal = 0;

      const tableRows = filteredPenugasan.map((pg, idx) => {
        const psy = allPnd.find(p => p.id === pg.penyadap_id || p.nomor === pg.penyadap_id);
        const ap  = aps.find(a => a.id === pg.anak_petak_id);
        
        // Cari target record jika ada
        const targ = targetPndOfMdr.find(tp => tp.penyadap_id === pg.penyadap_id && tp.anak_petak_id === pg.anak_petak_id);
        
        // Target tahunan penyadap di petak ini
        const tgtTahun = targ ? (parseInt(targ.target_kg) || 0) : 0;
        const luasVal  = targ ? (parseFloat(targ.luas_ha) || 0) : (ap ? (parseFloat(ap.luas_ha) || 0) : 0);
        const pohonVal = targ ? (parseInt(targ.pohon) || 0) : (pg.jumlah_pohon || (ap ? (parseInt(ap.jumlah_pohon) || 0) : 0));

        // Produksi s.d hari ini (Juli 2026)
        const prodPenyadap = allReal
          .filter(rl => rl.penyadap_id === pg.penyadap_id && new Date(rl.tanggal).getFullYear() === t)
          .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);
        totProd += prodPenyadap;
        const prodPct = tgtTahun > 0 ? ((prodPenyadap / tgtTahun) * 100).toFixed(2) : '0.00';

        // RO Periode ini
        const roPenyadapObj = roPeriodeList.find(ro => ro.penyadap_id === pg.penyadap_id && ro.areal_id === pg.anak_petak_id);
        const roPenyadap = roPenyadapObj ? (parseInt(roPenyadapObj.kesanggupan) || 0) : 0;
        totRo += roPenyadap;

        // Realisasi Periode ini
        const realPenyadap = realPeriodeList
          .filter(rl => rl.penyadap_id === pg.penyadap_id)
          .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);
        totReal += realPenyadap;
        const realRoPct = roPenyadap > 0 ? ((realPenyadap / roPenyadap) * 100).toFixed(2) : '0.00';

        // Keterangan: jika sudah setor → tanggal setor
        // jika belum setor → tampilkan "Belum Setor — [Alasan Kehadiran]"
        // jika tidak ada kehadiran → dari monitoring atau hanya 'Belum Setor'
        const STATUS_LABEL = {
          'hadir': 'Hadir', 'pembaharuan_1': 'Pembaharuan 1',
          'pembaharuan_2': 'Pembaharuan 2', 'pembaharuan_3': 'Pembaharuan 3',
          'pengecasan': 'Pengecasan/Stimulasi',
          'ludang': 'Ludang',
          'sakit': 'Sakit', 'izin': 'Izin', 'tidak_hadir': 'Tidak Hadir'
        };
        const monPenyadap = monitoringToday.find(m => m.penyadap_id === pg.penyadap_id && m.anak_petak_id === pg.anak_petak_id);
        const khdPenyadap = pndKehadiranToday.find(k => k.penyadap_id === pg.penyadap_id);

        let ket = 'Belum Setor';
        let ketBadge = 'badge-inactive';

        // Cari setoran terakhir periode ini
        const lastRl = realPeriodeList
          .filter(rl => rl.penyadap_id === pg.penyadap_id)
          .sort((x, y) => new Date(y.tanggal) - new Date(x.tanggal))[0];

        if (lastRl) {
          // ✅ Sudah setor → tampilkan tanggal setor
          const d = new Date(lastRl.tanggal);
          ket = `Setor ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
          ketBadge = 'badge-success';
        } else if (khdPenyadap) {
          // ⚠️ Belum setor → tampilkan "Belum Setor — [Alasan dari Kehadiran]"
          const statusLabel = STATUS_LABEL[khdPenyadap.status] || khdPenyadap.status;
          ket = `Belum Setor \u2014 ${statusLabel}`;
          if (khdPenyadap.status === 'sakit') {
            ketBadge = 'badge-warning';       // 🟡 Kuning = Sakit
          } else if (khdPenyadap.status === 'tidak_hadir') {
            ketBadge = 'badge-danger';        // 🔴 Merah = Alpa
          } else if (khdPenyadap.status === 'izin') {
            ketBadge = 'badge-inactive';      // ⚫ Abu = Izin
          } else {
            ketBadge = 'badge-info';          // 🔵 Biru = Aktif tapi belum setor (Hadir/Pembaharuan/Ludang)
          }
        } else if (monPenyadap) {
          // Tidak ada data kehadiran → ambil dari monitoring
          ket = `Belum Setor \u2014 ${monPenyadap.kategori}`;
          ketBadge = 'badge-inactive';
        }

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>
              <strong>${psy ? psy.nama : '—'}</strong>
              <div class="text-muted-sm">${psy ? psy.nomor : ''}</div>
            </td>
            <td><strong>${(parseFloat(luasVal) || 0).toFixed(2)} ha</strong></td>
            <td><strong>${(parseInt(pohonVal) || 0).toLocaleString('id-ID')} pohon</strong></td>
            <td>${tgtTahun.toLocaleString('id-ID')} Kg</td>
            <td>
              <strong>${prodPenyadap.toLocaleString('id-ID')} Kg</strong>
              <div class="text-muted-sm">${prodPct}%</div>
            </td>
            <td>
              <strong>${roPenyadap.toLocaleString('id-ID')} Kg</strong>
            </td>
            <td>
              <strong>${realPenyadap.toLocaleString('id-ID')} Kg</strong>
              <div class="text-muted-sm">${realRoPct}%</div>
            </td>
            <td><span class="badge ${ketBadge}">${ket}</span></td>
          </tr>
        `;
      });

      const tableRowsHtml = filteredPenugasan.length > 0 ? tableRows.join('') : '<tr><td colspan="9" style="text-align:center;padding:1rem;color:var(--text-secondary);">Belum ada penugasan penyadap aktif pada petak ini</td></tr>';

      const totProdPct = totTargetTahun > 0 ? ((totProd / totTargetTahun) * 100).toFixed(2) : '0.00';
      const totRealRoPct = totRo > 0 ? ((totReal / totRo) * 100).toFixed(2) : '0.00';

      petakHtml += `
        <div style="margin-bottom:2rem;">
          <!-- Header Petak -->
          <div style="background:var(--primary);color:white;padding:.6rem 1rem;border-radius:var(--radius-sm) var(--radius-sm) 0 0;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:0.4rem;">
              <strong style="font-size:1.1rem;letter-spacing:0.5px;">PETAK ${pt.nomor}</strong>
              <div style="display:flex;gap:1.5rem;font-size:.82rem;font-weight:600;">
                <div>PRODUKSI: <span style="background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px;">${totProd.toLocaleString('id-ID')} Kg (${totProdPct}%)</span></div>
                <div>RO: <span style="background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px;">${totRo.toLocaleString('id-ID')} Kg</span></div>
                <div>REALISASI: <span style="background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px;">${totReal.toLocaleString('id-ID')} Kg (${totRealRoPct}%)</span></div>
              </div>
            </div>
            
            <div style="border-top:1px dashed rgba(255,255,255,0.25);padding-top:0.4rem;display:flex;gap:1.5rem;font-size:.78rem;opacity:0.95;flex-wrap:wrap;">
              <div>🎯 <strong>Target</strong>: ${adminTargetPetak.toLocaleString('id-ID')} Kg (Terisi: ${totTargetTahun.toLocaleString('id-ID')} Kg | Kurang: ${Math.max(0, adminTargetPetak - totTargetTahun).toLocaleString('id-ID')} Kg)</div>
              <div>🗺️ <strong>Luas</strong>: ${(parseFloat(pt?.luas_ha) || 0).toFixed(2)} ha (Terisi: ${(parseFloat(totLuas) || 0).toFixed(2)} ha | Kurang: ${Math.max(0, (parseFloat(pt?.luas_ha) || 0) - totLuas).toFixed(2)} ha)</div>
              <div>🌲 <strong>Pohon</strong>: ${(parseInt(pt?.jumlah_pohon) || 0).toLocaleString('id-ID')} (Terisi: ${totPohon.toLocaleString('id-ID')} | Kurang: ${Math.max(0, (parseInt(pt?.jumlah_pohon) || 0) - totPohon).toLocaleString('id-ID')})</div>
            </div>
          </div>
          
          <!-- Tabel Penyadap -->
          <div class="table-container" style="border-radius:0 0 var(--radius-sm) var(--radius-sm);border-top:none;">
            <div class="table-wrapper">
              <table style="width:100%">
                <thead>
                  <tr>
                    <th style="width:50px">NO</th>
                    <th>PENYADAP</th>
                    <th>LUAS (HA)</th>
                    <th>POHON (SADAP)</th>
                    <th>TARGET TAHUNAN</th>
                    <th>PRODUKSI S.D HARI INI</th>
                    <th>RO PERIODE INI</th>
                    <th>REALISASI PERIODE INI</th>
                    <th>KETERANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                  <!-- Baris Jumlah -->
                  <tr style="background:var(--bg-surface-elevated);font-weight:700;">
                    <td colspan="2" style="text-align:right;">JUMLAH:</td>
                    <td>${(parseFloat(totLuas) || 0).toFixed(2)} ha</td>
                    <td>${totPohon.toLocaleString('id-ID')} pohon</td>
                    <td>${totTargetTahun.toLocaleString('id-ID')} Kg</td>
                    <td>
                      ${totProd.toLocaleString('id-ID')} Kg
                      <div class="text-muted-sm" style="font-weight:normal;">${totProdPct}%</div>
                    </td>
                    <td>
                      ${totRo.toLocaleString('id-ID')} Kg
                    </td>
                    <td>
                      ${totReal.toLocaleString('id-ID')} Kg
                      <div class="text-muted-sm" style="font-weight:normal;">${totRealRoPct}%</div>
                    </td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:.5rem;">
        <h3 style="color:var(--primary);margin:0;">Dashboard Mandor ${mandorUser ? mandorUser.nama_lengkap : ''}</h3>
        <button class="btn btn-secondary btn-sm" onclick="DashboardModule.exportExcelSummary('${mandorId}')">📤 Export Summary</button>
      </div>
      
      ${ringkasanHtml}
      
      <h3 style="margin-bottom:1rem;color:var(--primary);">Rekap Kinerja Per Petak</h3>
      ${petakHtml || '<div class="empty-state">Belum ada data petak sadapan untuk mandor ini</div>'}
    `;
  }

  // ── Ekspor Excel Ringkasan Mandor ─────────────────────────────
  async function exportExcelSummary(mandorId) {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }

    const t = state.tahun;
    const b = state.bulan;
    const p = state.periode;

    const mandorUser = await window.db.get('users', mandorId);
    const scopeTpgId = mandorUser ? mandorUser.scope : '';

    const allAP    = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const allPnd   = await window.db.getAllActive('penyadap_master');
    const allTarPnd = await window.db.getAllActive('target_penyadap');
    const allRO    = await window.db.getAllActive('ro');
    const allReal  = await window.db.getAllActive('realisasi');

    const apOfTpg = allAP.filter(ap => ap.tpg_id === scopeTpgId);
    const targetPndOfMdr = allTarPnd.filter(tp => tp.tahun === t && apOfTpg.map(ap => ap.id).includes(tp.anak_petak_id));

    const rows = targetPndOfMdr.map(targ => {
      const psy = allPnd.find(x => x.id === targ.penyadap_id || x.nomor === targ.penyadap_id);
      const ap = apOfTpg.find(x => x.id === targ.anak_petak_id);
      const ptk = ap ? allPetak.find(x => x.id === ap.petak_id) : null;

      // RPH target
      const tgtTahun = targ.target_kg || 0;

      // Produksi s/d hari ini
      const prodPenyadap = allReal
        .filter(rl => rl.penyadap_id === targ.penyadap_id && new Date(rl.tanggal).getFullYear() === t)
        .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      // RO
      const roPenyadapObj = allRO.find(ro => ro.penyadap_id === targ.penyadap_id && ro.areal_id === targ.anak_petak_id && ro.tahun === t && ro.bulan === b && ro.periode === p);
      const roPenyadap = roPenyadapObj ? (parseFloat(roPenyadapObj.kesanggupan) || 0) : 0;

      // Realisasi
      const realPenyadap = allReal
        .filter(rl => {
          if (rl.penyadap_id !== targ.penyadap_id || rl.tpg_id !== scopeTpgId) return false;
          const d = new Date(rl.tanggal);
          if (d.getFullYear() !== t || d.getMonth() + 1 !== b) return false;
          return p === 1 ? d.getDate() <= 15 : d.getDate() >= 16;
        })
        .reduce((sum, rl) => sum + (parseFloat(rl.berat_bersih) || 0), 0);

      return {
        Penyadap: psy ? psy.nama : targ.penyadap_id,
        'No Penyadap': psy ? psy.nomor : '',
        Petak: ptk ? `Petak ${ptk.nomor}${ap.huruf}` : '',
        'Target Tahunan (Kg)': tgtTahun,
        'Produksi s.d Hari Ini (Kg)': prodPenyadap,
        'RO Periode ini (Kg)': roPenyadap,
        'Realisasi Periode ini (Kg)': realPenyadap
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary Kinerja');
    XLSX.writeFile(wb, `Summary_Kinerja_Mandor_${mandorUser ? mandorUser.nama_lengkap : 'Mandor'}_${t}_B${b}_P${p}.xlsx`);
    U().showToast('Export Summary Excel berhasil', 'success');
  }

  // ─────────────────────────────────────────────────────────────
  //  Attendance (Absen) Kehadiran Penyadap
  // ─────────────────────────────────────────────────────────────

  function _renderAttendanceList(tbody, penyadaps, selectedDate, allKehadiran) {
    const options = [
      { val: '',               label: '— (Tidak Ada Kegiatan Khusus)' },
      { val: 'pembaharuan_1',  label: '🟢 Pembaharuan 1' },
      { val: 'pembaharuan_2',  label: '🟢 Pembaharuan 2' },
      { val: 'pembaharuan_3',  label: '🟢 Pembaharuan 3' },
      { val: 'pengecasan',     label: '🟢 Pengecasan/Stimulasi' },
      { val: 'ludang',         label: '🟢 Ludang' },
      { val: 'sakit',          label: '🟡 Sakit' },
      { val: 'izin_pertanian', label: '⚪ Izin — Pertanian' },
      { val: 'izin_bangunan',  label: '⚪ Izin — Bangunan' },
      { val: 'izin_hajatan',   label: '⚪ Izin — Hajatan' },
      { val: 'izin_lainnya',   label: '⚪ Izin — Lainnya' },
      { val: 'tidak_hadir',    label: '🔴 Alpa' }
    ];

    tbody.innerHTML = penyadaps.map(p => {
      // Cari status absen jika sudah dicatat sebelumnya untuk tanggal terpilih
      const khd = allKehadiran.find(k => k.tanggal === selectedDate && k.penyadap_id === p.id);
      // Kalau belum ada catatan atau statusnya 'hadir' lama → default ke '' (kosong)
      const activeStatus = khd ? (khd.status === 'hadir' ? '' : khd.status) : '';

      const selectsHtml = `
        <select class="form-control attendance-status-select" data-penyadap-id="${p.id}" style="margin:0; max-width:210px;">
          ${options.map(opt => `<option value="${opt.val}" ${opt.val === activeStatus ? 'selected' : ''}>${opt.label}</option>`).join('')}
        </select>
      `;

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: .75rem .5rem;">
            <strong>${p.nama}</strong>
            <div class="text-muted-sm">${p.nomor}</div>
          </td>
          <td style="padding: .75rem .5rem; text-align: center; display: flex; justify-content: center;">
            ${selectsHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  async function openAttendanceModal(mandorId) {
    const defaultDate = new Date().toISOString().split('T')[0]; // Tanggal aktif dashboard/hari ini
    const dateInput = document.getElementById('attendance-date');
    if (dateInput) dateInput.value = defaultDate;

    // Load data relasional
    const mandorUser = await window.db.get('users', mandorId);
    let scopeTpgId = mandorUser ? mandorUser.scope : null;
    
    if (!scopeTpgId) {
      // Auto-detect dari anak_petak
      const allAPTemp = await window.db.getAllActive('anak_petak');
      const allTarTemp = await window.db.getAllActive('target_penyadap');
      const firstAP = allAPTemp.find(ap => allTarTemp.some(tp => tp.anak_petak_id === ap.id));
      if (firstAP && firstAP.tpg_id) scopeTpgId = firstAP.tpg_id;
    }

    const allAP = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');
    const allPgn = await window.db.getAllActive('penugasan');
    const allPnd = await window.db.getAllActive('penyadap_master');
    const allTarPnd = await window.db.getAllActive('target_penyadap');
    let allKehadiran = await window.db.getAllActive('kehadiran');

    // Dapatkan penyadap aktif di bawah wilayah mandor ini
    const myApIds = allAP.filter(ap => {
      const petak = allPetak.find(p => p.id === ap.petak_id);
      return petak && petak.mandor_id === mandorId;
    }).map(ap => ap.id);
    const activePndIds = _getPenyadapIdsByApIds(myApIds, allPgn);
    const penyadaps = allPnd.filter(p => activePndIds.includes(p.id));

    const tbody = document.getElementById('attendance-list-tbody');
    if (!tbody) return;

    if (penyadaps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="empty-state">Tidak ada penyadap aktif di wilayah TPG Anda</td></tr>`;
      U().openModal('attendance-modal');
      return;
    }

    // Render baris pertama kali
    _renderAttendanceList(tbody, penyadaps, defaultDate, allKehadiran);

    // Ketersediaan dinamis saat tanggal picker diubah
    if (dateInput) {
      dateInput.onchange = async function() {
        const newDate = this.value;
        if (!newDate) return;
        allKehadiran = await window.db.getAllActive('kehadiran');
        _renderAttendanceList(tbody, penyadaps, newDate, allKehadiran);
      };
    }

    U().openModal('attendance-modal');
  }

  async function saveAttendance(e) {
    e.preventDefault();
    const todayStr = document.getElementById('attendance-date').value;
    const selects = document.querySelectorAll('.attendance-status-select');
    
    if (selects.length === 0) {
      U().closeModal('attendance-modal');
      return;
    }

    // Ambil data absen yang sudah ada
    const allKehadiran = await window.db.getAllActive('kehadiran');
    const actor = U().currentActorId();

    for (const select of selects) {
      const penyadap_id = select.dataset.penyadapId;
      const status = select.value;

      // Skip jika tidak ada kegiatan dipilih (status kosong = tidak ada catatan = '—' di buku)
      if (!status) {
        // Hapus record lama jika ada (agar kembali ke '—')
        const existing = allKehadiran.find(k => k.tanggal === todayStr && k.penyadap_id === penyadap_id);
        if (existing) {
          await window.db.delete('kehadiran', existing.id);
        }
        continue;
      }

      // Cari record kehadiran lama untuk penyadap ini pada tanggal ini
      const existing = allKehadiran.find(k => k.tanggal === todayStr && k.penyadap_id === penyadap_id);
      const id = existing ? existing.id : U().uuid();

      const record = {
        id,
        tanggal: todayStr,
        penyadap_id,
        status,
        ...U().makeAudit(actor, existing)
      };

      await window.db.put('kehadiran', record);
      await window.db.queueSync('kehadiran', existing ? 'update' : 'create', record);
    }

    U().closeModal('attendance-modal');
    U().showToast('Kehadiran berhasil disimpan', 'success');

    // Refresh dashboard
    await render();
  }

  return {
    init,
    setFilter,
    drillTo,
    drillBack,
    drillReset,
    resetDrill,
    render,
    exportExcelSummary,
    
    // Attendance exports
    openAttendanceModal,
    saveAttendance
  };
})();

window.DashboardModule = DashboardModule;
