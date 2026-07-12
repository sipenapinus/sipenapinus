/**
 * SIPENA Lite — Master Coordinator & Seed Data (v6)
 * Mendelegasikan render ke module per entitas.
 * Menyediakan seed data awal jika database kosong.
 */
'use strict';

// ─────────────────────────────────────────────────────────────
//  Seed Data
// ─────────────────────────────────────────────────────────────
async function seedMasterData() {
  // Jika flag 'skip seed' aktif (user memakai data nyata), lewati seed
  if (localStorage.getItem('sipena_skip_seed') === '1') {
    console.log('[Seeding] Dilewati — mode data nyata aktif.');
    return;
  }
  const existing = await window.db.getAllActive('bkph');
  if (existing.length > 0) return; // sudah ada seed

  console.log('[Seeding] Initializing database v6 seeds...');

  const actor = 'system-seed';
  const base  = () => window.SipenaUtils.makeAudit(actor);

  // 1. BKPH
  await window.db.putMany('bkph', [
    { id: 'bkph-01', kode_bkph: 'BKPH-BTK', nama_bkph: 'BKPH Bantarkawung', alamat: 'Jl. Raya Bantarkawung No. 1, Brebes, Jawa Tengah', telepon: '0289-511111', email: 'bantarkawung@perhutani.co.id', keterangan: 'Kantor Utama BKPH Bantarkawung', status: 'Aktif', ...base() }
  ]);

  // 2. RPH
  await window.db.putMany('rph', [
    { id: 'rph-01', bkph_id: 'bkph-01', kode: 'RPH-BTK', nama: 'RPH Bantarkawung', keterangan: '', status: 'aktif', ...base() },
    { id: 'rph-02', bkph_id: 'bkph-01', kode: 'RPH-SLM', nama: 'RPH Salem',        keterangan: '', status: 'aktif', ...base() },
    { id: 'rph-03', bkph_id: 'bkph-01', kode: 'RPH-TNJ', nama: 'RPH Tonjong',      keterangan: '', status: 'aktif', ...base() }
  ]);

  // 3. TPG
  await window.db.putMany('tpg', [
    { id: 'tpg-01', rph_id: 'rph-01', kode: 'TPG-BDB', nama: 'TPG Bandbayang', keterangan: '', status: 'aktif', ...base() },
    { id: 'tpg-02', rph_id: 'rph-01', kode: 'TPG-CBT', nama: 'TPG Cibentang', keterangan: '', status: 'aktif', ...base() },
    { id: 'tpg-03', rph_id: 'rph-02', kode: 'TPG-SLM', nama: 'TPG Salem',     keterangan: '', status: 'aktif', ...base() },
    { id: 'tpg-04', rph_id: 'rph-03', kode: 'TPG-TNJ', nama: 'TPG Tonjong',   keterangan: '', status: 'aktif', ...base() }
  ]);

  // Update Mandor Mardi scope
  const mandorUser = await window.db.get('users', 'usr-mandor');
  if (mandorUser) {
    mandorUser.nama_lengkap = 'Mardi';
    mandorUser.scope = 'tpg-01'; // TPG Bandbayang
    await window.db.put('users', mandorUser);
  }

  // 4. Petak
  await window.db.putMany('petak', [
    { id: 'ptk-01', rph_id: 'rph-01', tpg_id: 'tpg-01', nomor: '37H', luas_ha: 55.90, jumlah_pohon: 5450, kelas_hutan: '2018', keterangan: 'Petak Bantarkawung utara', ...base() },
    { id: 'ptk-02', rph_id: 'rph-01', tpg_id: 'tpg-01', nomor: '38A-1', luas_ha: 51.30, jumlah_pohon: 5100, kelas_hutan: '2019', keterangan: 'Areal sadap barat', ...base() },
    { id: 'ptk-03', rph_id: 'rph-02', tpg_id: 'tpg-03', nomor: '61', luas_ha: 20.00, jumlah_pohon: 2000, kelas_hutan: '2020', keterangan: 'Areal Salem', ...base() }
  ]);

  // 5. Anak Petak
  await window.db.putMany('anak_petak', [
    { id: 'ap-01', petak_id: 'ptk-01', huruf: 'A', luas_ha: 12.50, jumlah_pohon: 1250, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-02', petak_id: 'ptk-01', huruf: 'B', luas_ha: 10.00, jumlah_pohon:  980, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-03', petak_id: 'ptk-01', huruf: 'C', luas_ha:  8.75, jumlah_pohon:  875, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-04', petak_id: 'ptk-01', huruf: 'D', luas_ha:  9.20, jumlah_pohon:  920, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-05', petak_id: 'ptk-01', huruf: 'E', luas_ha: 14.00, jumlah_pohon: 1400, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-06', petak_id: 'ptk-02', huruf: 'A', luas_ha: 11.30, jumlah_pohon: 1100, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-07', petak_id: 'ptk-02', huruf: 'B', luas_ha: 10.50, jumlah_pohon: 1050, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-08', petak_id: 'ptk-02', huruf: 'C', luas_ha:  9.00, jumlah_pohon:  900, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-09', petak_id: 'ptk-02', huruf: 'D', luas_ha:  8.50, jumlah_pohon:  850, tpg_id: 'tpg-01', keterangan: '', ...base() },
    { id: 'ap-10', petak_id: 'ptk-02', huruf: 'E', luas_ha: 12.00, jumlah_pohon: 1200, tpg_id: 'tpg-01', keterangan: '', ...base() }
  ]);

  // 6. Penyadap
  await window.db.putMany('penyadap_master', [
    { id: 'psm-01', nomor: 'PS-001', nama: 'AHMAD',         alamat: 'Dusun Kaliputih RT 02/03 Bantarkawung', no_hp: '081234567001', status: 'aktif', ...base() },
    { id: 'psm-02', nomor: 'PS-002', nama: 'IBRAHIM',       alamat: 'Dusun Cibeuti RT 01/01 Bantarkawung',  no_hp: '081234567002', status: 'aktif', ...base() },
    { id: 'psm-03', nomor: 'PS-003', nama: 'MUSA',          alamat: 'Dusun Cikaret RT 03/02 Bantarkawung',  no_hp: '081234567003', status: 'aktif', ...base() },
    { id: 'psm-04', nomor: 'PS-004', nama: 'LUT',           alamat: 'Dusun Kaliwadas RT 04/01 Bantarkawung',no_hp: '081234567004', status: 'aktif', ...base() },
    { id: 'psm-05', nomor: 'PS-005', nama: 'ADAM',          alamat: 'Dusun Paguyuban RT 01/02 Salem',       no_hp: '081234567005', status: 'aktif', ...base() },
    { id: 'psm-06', nomor: 'PS-006', nama: 'ADI',           alamat: 'Dusun Gombong RT 02/04 Salem',         no_hp: '081234567006', status: 'aktif', ...base() },
    { id: 'psm-07', nomor: 'PS-007', nama: 'IBNU',          alamat: 'Dusun Cibenda RT 03/02 Tonjong',       no_hp: '081234567007', status: 'aktif', ...base() },
    { id: 'psm-08', nomor: 'PS-008', nama: 'JOKO',          alamat: 'Dusun Tonjong RT 01/01 Tonjong',       no_hp: '081234567008', status: 'aktif', ...base() },
    { id: 'psm-09', nomor: 'PS-009', nama: 'AGUS',          alamat: 'Dusun Salem RT 02/02 Salem',           no_hp: '081234567009', status: 'aktif', ...base() },
    { id: 'psm-10', nomor: 'PS-010', nama: 'SUNAR',         alamat: 'Dusun Salem RT 03/03 Salem',           no_hp: '081234567010', status: 'aktif', ...base() }
  ]);

  // 7. Penugasan
  await window.db.putMany('penugasan', [
    { id: 'pgn-01', penyadap_id: 'psm-01', anak_petak_id: 'ap-01', persen_target: 100, jumlah_pohon: 1250, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-02', penyadap_id: 'psm-02', anak_petak_id: 'ap-02', persen_target: 100, jumlah_pohon: 980, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-03', penyadap_id: 'psm-03', anak_petak_id: 'ap-03', persen_target: 100, jumlah_pohon: 875, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-04', penyadap_id: 'psm-04', anak_petak_id: 'ap-04', persen_target: 100, jumlah_pohon: 920, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-05', penyadap_id: 'psm-05', anak_petak_id: 'ap-05', persen_target: 100, jumlah_pohon: 1400, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-06', penyadap_id: 'psm-06', anak_petak_id: 'ap-06', persen_target: 100, jumlah_pohon: 1100, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-07', penyadap_id: 'psm-07', anak_petak_id: 'ap-07', persen_target: 100, jumlah_pohon: 1050, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-08', penyadap_id: 'psm-08', anak_petak_id: 'ap-08', persen_target: 100, jumlah_pohon: 900, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-09', penyadap_id: 'psm-09', anak_petak_id: 'ap-09', persen_target: 100, jumlah_pohon: 850, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() },
    { id: 'pgn-10', penyadap_id: 'psm-10', anak_petak_id: 'ap-10', persen_target: 100, jumlah_pohon: 1200, tanggal_mulai: '2026-01-01', tanggal_selesai: null, aktif: 1, keterangan: '', ...base() }
  ]);

  // 8. Seed Target 2026
  await window.db.putMany('target_bkph', [
    { id: 'tgb-01', tahun: 2026, target_kg: 786000, ...base() }
  ]);
  await window.db.putMany('target_rph', [
    { id: 'tgr-01', tahun: 2026, rph_id: 'rph-01', target_kg: 786000, ...base() }
  ]);
  await window.db.putMany('target_tpg', [
    { id: 'tgt-01', tahun: 2026, tpg_id: 'tpg-01', target_kg: 400000, ...base() },
    { id: 'tgt-02', tahun: 2026, tpg_id: 'tpg-02', target_kg: 386000, ...base() }
  ]);
  await window.db.putMany('target_mandor', [
    { id: 'tgm-01', tahun: 2026, mandor_id: 'usr-mandor', target_kg: 400000, ...base() }
  ]);
  await window.db.putMany('target_penyadap', [
    { id: 'tgp-01', tahun: 2026, penyadap_id: 'psm-01', anak_petak_id: 'ap-01', luas_ha: 12.5, pohon: 1250, target_kg: 10000, ...base() },
    { id: 'tgp-02', tahun: 2026, penyadap_id: 'psm-02', anak_petak_id: 'ap-02', luas_ha: 10.0, pohon: 980,  target_kg: 5000, ...base() },
    { id: 'tgp-03', tahun: 2026, penyadap_id: 'psm-03', anak_petak_id: 'ap-03', luas_ha: 8.75, pohon: 875,  target_kg: 3000, ...base() },
    { id: 'tgp-04', tahun: 2026, penyadap_id: 'psm-04', anak_petak_id: 'ap-04', luas_ha: 9.2,  pohon: 920,  target_kg: 7000, ...base() },
    { id: 'tgp-05', tahun: 2026, penyadap_id: 'psm-05', anak_petak_id: 'ap-05', luas_ha: 14.0, pohon: 1350, target_kg: 8000, ...base() },
    { id: 'tgp-06', tahun: 2026, penyadap_id: 'psm-06', anak_petak_id: 'ap-06', luas_ha: 11.3, pohon: 1050, target_kg: 9500, ...base() },
    { id: 'tgp-07', tahun: 2026, penyadap_id: 'psm-07', anak_petak_id: 'ap-07', luas_ha: 10.5, pohon: 990,  target_kg: 5000, ...base() },
    { id: 'tgp-08', tahun: 2026, penyadap_id: 'psm-08', anak_petak_id: 'ap-08', luas_ha: 9.0,  pohon: 850,  target_kg: 3000, ...base() },
    { id: 'tgp-09', tahun: 2026, penyadap_id: 'psm-09', anak_petak_id: 'ap-09', luas_ha: 8.5,  pohon: 750,  target_kg: 7000, ...base() },
    { id: 'tgp-10', tahun: 2026, penyadap_id: 'psm-10', anak_petak_id: 'ap-10', luas_ha: 12.0, pohon: 1100, target_kg: 8000, ...base() }
  ]);

  // 9. Seed RO (Rencana Operasional) - Juli 2026 (Bulan 7), Periode 1
  await window.db.putMany('ro', [
    { id: 'ro-s-01', penyadap_id: 'psm-01', areal_id: 'ap-01', tahun: 2026, bulan: 7, periode: 1, kesanggupan: 500, status: 'disetujui', sync_status: 'synced', ...base() },
    { id: 'ro-s-02', penyadap_id: 'psm-02', areal_id: 'ap-02', tahun: 2026, bulan: 7, periode: 1, kesanggupan: 300, status: 'disetujui', sync_status: 'synced', ...base() },
    { id: 'ro-s-06', penyadap_id: 'psm-06', areal_id: 'ap-06', tahun: 2026, bulan: 7, periode: 1, kesanggupan: 500, status: 'disetujui', sync_status: 'synced', ...base() },
    { id: 'ro-s-07', penyadap_id: 'psm-07', areal_id: 'ap-07', tahun: 2026, bulan: 7, periode: 1, kesanggupan: 300, status: 'disetujui', sync_status: 'synced', ...base() }
  ]);

  // 10. Seed Realisasi - Juli 2026 (produksi s.d hari ini, dan transaksi realisasi periode ini)
  // Total produksi s.d hari ini disimulasikan dari gabungan transaksi realisasi di IndexedDB
  await window.db.putMany('realisasi', [
    // Realisasi akumulatif masa lalu (s.d hari ini)
    { id: 'rl-s-01', penyadap_id: 'psm-01', tpg_id: 'tpg-01', tanggal: '2026-07-05', berat_kotor: 5200, berat_bersih: 5000, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-02', penyadap_id: 'psm-02', tpg_id: 'tpg-01', tanggal: '2026-07-06', berat_kotor: 2100, berat_bersih: 2000, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-03', penyadap_id: 'psm-03', tpg_id: 'tpg-01', tanggal: '2026-07-05', berat_kotor: 950,  berat_bersih: 900,  mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-04', penyadap_id: 'psm-04', tpg_id: 'tpg-01', tanggal: '2026-07-07', berat_kotor: 4400, berat_bersih: 4200, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-05', penyadap_id: 'psm-05', tpg_id: 'tpg-01', tanggal: '2026-07-08', berat_kotor: 4200, berat_bersih: 4000, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-06', penyadap_id: 'psm-06', tpg_id: 'tpg-01', tanggal: '2026-07-05', berat_kotor: 4950, berat_bersih: 4750, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-07', penyadap_id: 'psm-07', tpg_id: 'tpg-01', tanggal: '2026-07-06', berat_kotor: 2100, berat_bersih: 2000, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-08', penyadap_id: 'psm-08', tpg_id: 'tpg-01', tanggal: '2026-07-05', berat_kotor: 950,  berat_bersih: 900,  mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-09', penyadap_id: 'psm-09', tpg_id: 'tpg-01', tanggal: '2026-07-07', berat_kotor: 4400, berat_bersih: 4200, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-s-10', penyadap_id: 'psm-10', tpg_id: 'tpg-01', tanggal: '2026-07-08', berat_kotor: 4200, berat_bersih: 4000, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },

    // Realisasi periode ini (tanggal 11 & 15)
    { id: 'rl-p-01', penyadap_id: 'psm-01', tpg_id: 'tpg-01', tanggal: '2026-07-15', berat_kotor: 260, berat_bersih: 250, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-p-02', penyadap_id: 'psm-02', tpg_id: 'tpg-01', tanggal: '2026-07-11', berat_kotor: 160, berat_bersih: 150, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-p-06', penyadap_id: 'psm-06', tpg_id: 'tpg-01', tanggal: '2026-07-15', berat_kotor: 260, berat_bersih: 250, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() },
    { id: 'rl-p-07', penyadap_id: 'psm-07', tpg_id: 'tpg-01', tanggal: '2026-07-11', berat_kotor: 160, berat_bersih: 150, mutu: 'Premium', status: 'verified', sync_status: 'synced', ...base() }
  ]);

  // 11. Seed Kehadiran (Periode 1: 1 - 15 Juli 2026)
  // 8 Hadir, 1 Sakit, 1 Tidak Hadir (Kasus Musa sakit, Joko tidak hadir, lainnya hadir)
  await window.db.putMany('kehadiran', [
    { id: 'kh-01', tanggal: '2026-07-11', penyadap_id: 'psm-01', status: 'hadir', ...base() },
    { id: 'kh-02', tanggal: '2026-07-11', penyadap_id: 'psm-02', status: 'hadir', ...base() },
    { id: 'kh-03', tanggal: '2026-07-11', penyadap_id: 'psm-03', status: 'sakit', ...base() },
    { id: 'kh-04', tanggal: '2026-07-11', penyadap_id: 'psm-04', status: 'hadir', ...base() },
    { id: 'kh-05', tanggal: '2026-07-11', penyadap_id: 'psm-05', status: 'hadir', ...base() },
    { id: 'kh-06', tanggal: '2026-07-11', penyadap_id: 'psm-06', status: 'hadir', ...base() },
    { id: 'kh-07', tanggal: '2026-07-11', penyadap_id: 'psm-07', status: 'hadir', ...base() },
    { id: 'kh-08', tanggal: '2026-07-11', penyadap_id: 'psm-08', status: 'tidak_hadir', ...base() },
    { id: 'kh-09', tanggal: '2026-07-11', penyadap_id: 'psm-09', status: 'hadir', ...base() },
    { id: 'kh-10', tanggal: '2026-07-11', penyadap_id: 'psm-10', status: 'hadir', ...base() }
  ]);

  // 12. Seed Monitoring Lapangan
  await window.db.putMany('monitoring', [
    { id: 'mn-01', tanggal: '2026-07-11', penyadap_id: 'psm-01', anak_petak_id: 'ap-01', kategori: 'Pembaruan 1', keterangan: 'Pembaruan koakan sadapan ke-1', ...base() },
    { id: 'mn-02', tanggal: '2026-07-11', penyadap_id: 'psm-02', anak_petak_id: 'ap-02', kategori: 'Pembaruan 2', keterangan: 'Koakan ke-2 berjalan baik', ...base() },
    { id: 'mn-03', tanggal: '2026-07-11', penyadap_id: 'psm-03', anak_petak_id: 'ap-03', kategori: 'Sakit', keterangan: 'Izin sakit demam', ...base() },
    { id: 'mn-04', tanggal: '2026-07-11', penyadap_id: 'psm-04', anak_petak_id: 'ap-04', kategori: 'Rencana Setor Periode 2', keterangan: 'Setoran ditunda ke periode berikutnya', ...base() },
    { id: 'mn-05', tanggal: '2026-07-11', penyadap_id: 'psm-05', anak_petak_id: 'ap-05', kategori: 'Hujan', keterangan: 'Hujan lebat menghambat penyadapan', ...base() }
  ]);

  console.log('[Master] Seed data v6 successfully loaded.');
}

// ─────────────────────────────────────────────────────────────
//  Tab Switcher & Render Dispatcher
// ─────────────────────────────────────────────────────────────
const MASTER_TABS = ['bkph', 'rph', 'tpg', 'petak', 'penyadap', 'penugasan', 'user'];

async function switchMasterTab(tab) {
  // Hide all panels
  MASTER_TABS.forEach(t => {
    const panel = document.getElementById(`tab-${t}`);
    if (panel) panel.style.display = 'none';
  });

  // Show active panel
  const active = document.getElementById(`tab-${tab}`);
  if (active) active.style.display = 'block';

  // Update button styles
  document.querySelectorAll('.master-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.className = `btn master-tab btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`;
  });

  // Render content
  const renderMap = {
    'bkph':       () => window.MasterBKPH.render(),
    'rph':        () => window.MasterRPH.render(),
    'tpg':        () => window.MasterTPG.render(),
    'petak':      () => window.MasterPetak.render(),
    'penyadap':   () => window.MasterPenyadap.render(),
    'penugasan':  () => window.MasterPenugasan.render(),
    'user':       () => window.MasterUser.render()
  };

  if (renderMap[tab]) await renderMap[tab]();
}

window.switchMasterTab = switchMasterTab;
window.seedMasterData  = seedMasterData;
