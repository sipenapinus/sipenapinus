/**
 * SIPENA Lite — Master Import Module
 * - Download Template Excel (kosong berformat benar)
 * - Import Excel dengan validasi per baris
 * - Panel daftar kesalahan import
 * - Mendukung Impor Parsial (hanya baris valid) jika disetujui pengguna
 */
'use strict';

const MasterImport = (() => {
  const U = () => window.SipenaUtils;

  // ─────────────────────────────────────────────────────────────
  //  Template Definitions
  // ─────────────────────────────────────────────────────────────
  const TEMPLATES = {
    bkph: {
      label: 'BKPH',
      headers: ['kode_bkph', 'nama_bkph', 'alamat', 'telepon', 'email', 'keterangan', 'status'],
      example: [['BKPH-BTK', 'BKPH Bantarkawung', 'Jl. Raya Bantarkawung No. 1', '0812345678', 'bantarkawung@perhutani.co.id', 'Kantor utama BKPH Bantarkawung', 'Aktif']],
      notes: 'Kolom status: Aktif | Tidak Aktif'
    },
    rph: {
      label: 'RPH',
      headers: ['kode_bkph', 'kode', 'nama', 'keterangan', 'status'],
      example: [['BKPH-BTK', 'RPH-BTK-01', 'RPH Bantarkawung 1', 'Keterangan opsional', 'Aktif']],
      notes: 'kode_bkph: isi Kode BKPH yang sudah ada | status: Aktif | Tidak Aktif'
    },
    tpg: {
      label: 'TPG',
      headers: ['kode_rph', 'kode', 'nama', 'keterangan', 'status'],
      example: [['RPH-BTK-01', 'TPG-01', 'TPG Ciseureuh', 'Keterangan opsional', 'Aktif']],
      notes: 'kode_rph: isi Kode RPH yang sudah ada | status: Aktif | Tidak Aktif'
    },
    penyadap: {
      label: 'Penyadap',
      headers: ['nomor', 'nama', 'alamat', 'no_hp', 'status'],
      example: [['PS-001', 'Nama Penyadap', 'Alamat Lengkap', '081234567890', 'aktif']],
      notes: 'Kolom status: aktif | tidak_aktif | pindah | berhenti'
    },
    petak: {
      label: 'Petak',
      headers: ['nomor', 'kode_rph', 'kode_tpg', 'luas_ha', 'jumlah_pohon', 'tahun_tanam', 'keterangan'],
      example: [['42', 'RPH-BTK', 'TPG-BDB', 12.5, 1250, 2018, 'Keterangan opsional']],
      notes: 'kode_rph: isi Kode RPH (lihat Master RPH) | kode_tpg: isi Kode TPG (lihat Master TPG)'
    },
    anak_petak: {
      label: 'Anak Petak',
      headers: ['petak_id', 'huruf', 'luas_ha', 'jumlah_pohon', 'keterangan'],
      example: [['ID-PETAK', 'A', '12.5', '1250', 'Keterangan opsional']],
      notes: 'petak_id: gunakan ID dari export Master Petak'
    },
    penugasan: {
      label: 'Penugasan',
      headers: ['nomor_penyadap', 'nama_penyadap', 'no_petak'],
      example: [['PS-001', 'TARPIN', '42']],
      notes: 'nomor_penyadap: nomor penyadap | nama_penyadap: nama (otomatis terisi) | no_petak: isi nomor petak penugasan'
    },
    user: {
      label: 'User',
      headers: ['nama_lengkap', 'nip', 'username', 'password', 'role', 'scope', 'status'],
      example: [['Nama Lengkap', '198001012000011001', 'username', 'password123', 'mandor', 'ID-TPG', 'aktif']],
      notes: 'role: admin | bkph | krph | tpg | mandor | status: aktif | nonaktif'
    },
    bkph: {
      label: 'BKPH',
      headers: ['kode_bkph', 'nama_bkph', 'alamat', 'telepon', 'email', 'keterangan', 'status'],
      example: [['BKPH-BTK', 'BKPH Bantarkawung', 'Jl. Raya Bantarkawung No. 1', '0812345678', 'bantarkawung@perhutani.co.id', 'Kantor utama BKPH Bantarkawung', 'Aktif']],
      notes: 'Kolom status: Aktif | Tidak Aktif'
    },
    target_bkph: {
      label: 'Target BKPH',
      headers: ['tahun', 'target_kg'],
      example: [[2026, 24000]],
      notes: 'tahun: angka tahun | target_kg: angka target dalam kilogram'
    },
    target_rph: {
      label: 'Target RPH',
      headers: ['tahun', 'kode_rph', 'target_kg'],
      example: [[2026, 'RPH-BTK-01', 8000]],
      notes: 'kode_rph: kode RPH yang terdaftar | target_kg: angka target dalam kilogram'
    },
    target_tpg: {
      label: 'Target TPG',
      headers: ['tahun', 'kode_tpg', 'target_kg'],
      example: [[2026, 'TPG-01', 4000]],
      notes: 'kode_tpg: kode TPG yang terdaftar | target_kg: angka target dalam kilogram'
    },
    target_mandor: {
      label: 'Target Mandor',
      headers: ['tahun', 'username_mandor', 'target_kg'],
      example: [[2026, 'mandor', 2000]],
      notes: 'username_mandor: username mandor yang terdaftar | target_kg: angka target dalam kilogram'
    },
    target_penyadap: {
      label: 'Target Penyadap',
      headers: ['tahun', 'nomor_penyadap', 'no_petak', 'luas_ha', 'pohon', 'target_kg'],
      example: [[2026, 'PS-001', '42', 12.5, 1250, 1000]],
      notes: 'nomor_penyadap: no penyadap | no_petak: nomor petak | pohon: jumlah pohon | huruf_anak_petak (opsional): isi jika satu petak punya beberapa anak petak'
    }
  };

  // ─────────────────────────────────────────────────────────────
  //  Download Template
  // ─────────────────────────────────────────────────────────────
  async function downloadTemplate(section) {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    const tmpl = TEMPLATES[section];
    if (!tmpl) { U().showToast('Template tidak ditemukan', 'danger'); return; }

    const wb = XLSX.utils.book_new();

    // Untuk target_penyadap, penyadap & penugasan: pre-fill dari data yang ada di DB
    let dataRows;
    if (section === 'target_penyadap') {
      dataRows = await _buildTargetPenyadapRows();
    } else if (section === 'penyadap') {
      dataRows = await _buildPenyadapRows();
    } else if (section === 'penugasan') {
      dataRows = await _buildPenugasanRows();
    } else {
      dataRows = [tmpl.headers, ...tmpl.example];
    }

    const wsData = XLSX.utils.aoa_to_sheet(dataRows);
    wsData['!cols'] = dataRows[0].map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, wsData, tmpl.label);

    // Sheet 2: Petunjuk
    const petunjuk = [
      ['TEMPLATE IMPORT — ' + tmpl.label.toUpperCase()],
      [''],
      ['Petunjuk:'],
      ['1. Data penyadap & petak sudah terisi otomatis dari penugasan aktif.'],
      ['2. Isi kolom target_kg (target produksi dalam Kg) untuk setiap penyadap.'],
      ['3. Jangan mengubah nilai pada kolom lain (tahun, nomor_penyadap, no_petak, luas_ha, pohon).'],
      ['4. Simpan file dalam format .xlsx sebelum diimport.'],
      ['5. ' + tmpl.notes],
    ];
    const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
    XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk');

    XLSX.writeFile(wb, `Template_Import_${tmpl.label}_SIPENA.xlsx`);
    U().showToast(`Template ${tmpl.label} berhasil diunduh`);
  }

  // ─────────────────────────────────────────────────────────────
  //  Build baris pre-filled Target Penyadap dari penugasan aktif
  // ─────────────────────────────────────────────────────────────
  async function _buildTargetPenyadapRows() {
    const tahun    = new Date().getFullYear();
    const headers  = TEMPLATES.target_penyadap.headers;

    // Load semua data yang dibutuhkan
    const [penugasan, penyadapAll, anakPetakAll, petakAll] = await Promise.all([
      window.db.getAllActive('penugasan'),
      window.db.getAllActive('penyadap_master'),
      window.db.getAllActive('anak_petak'),
      window.db.getAllActive('petak')
    ]);

    // Filter penugasan berdasarkan scope user (mandor/tpg)
    const user = window.app && window.app.currentUser;
    let filtered = penugasan.filter(pg => pg.aktif);
    if (user && (user.role === 'mandor' || user.role === 'tpg') && user.scope) {
      const apIds = anakPetakAll.filter(ap => ap.tpg_id === user.scope).map(ap => ap.id);
      filtered = filtered.filter(pg => apIds.includes(pg.anak_petak_id));
    }

    // Buat baris pre-filled
    const rows = [headers];
    for (const pg of filtered) {
      const ps  = penyadapAll.find(p => p.id === pg.penyadap_id);
      const ap  = anakPetakAll.find(a => a.id === pg.anak_petak_id);
      const ptk = ap ? petakAll.find(p => p.id === ap.petak_id) : null;
      if (!ps || !ap || !ptk) continue;

      rows.push([
        tahun,
        ps.nomor,
        ptk.nomor,
        ap.luas_ha     || '',
        ap.jumlah_pohon || '',
        ''   // ← target_kg: dikosongkan, mandor yang isi
      ]);
    }

    // Jika belum ada penugasan, tampilkan baris contoh agar tidak membingungkan
    if (rows.length === 1) {
      rows.push(...TEMPLATES.target_penyadap.example);
    }

    return rows;
  }

  // ─────────────────────────────────────────────────────────────
  //  Build baris pre-filled Penyadap dari data yang sudah ada di DB
  // ─────────────────────────────────────────────────────────────
  async function _buildPenyadapRows() {
    const headers = TEMPLATES.penyadap.headers;
    const allPenyadap = await window.db.getAllActive('penyadap_master');

    const rows = [headers];
    for (const p of allPenyadap) {
      rows.push([
        p.nomor  || '',
        p.nama   || '',
        p.alamat || '',
        p.no_hp  || '',
        p.status || 'aktif'
      ]);
    }

    // Jika belum ada data, tampilkan baris contoh
    if (rows.length === 1) {
      rows.push(...TEMPLATES.penyadap.example);
    }

    return rows;
  }

  // ─────────────────────────────────────────────────────────────
  //  Build baris pre-filled Penugasan dari penyadap yang terdaftar
  // ─────────────────────────────────────────────────────────────
  async function _buildPenugasanRows() {
    const headers = TEMPLATES.penugasan.headers;
    
    // Load semua data
    const [allPenyadap, allPenugasan, allAP, allPetak] = await Promise.all([
      window.db.getAllActive('penyadap_master'),
      window.db.getAllActive('penugasan'),
      window.db.getAllActive('anak_petak'),
      window.db.getAllActive('petak')
    ]);

    const user = window.app && window.app.currentUser;
    const role = user ? user.role : '';
    const scope = user ? user.scope : '';

    let filteredPenyadap = allPenyadap;
    if ((role === 'mandor' || role === 'tpg') && scope) {
      const apIds = allAP.filter(ap => ap.tpg_id === scope).map(ap => ap.id);
      const assignedInScope = allPenugasan.filter(pg => apIds.includes(pg.anak_petak_id)).map(pg => pg.penyadap_id);
      
      filteredPenyadap = allPenyadap.filter(p =>
        assignedInScope.includes(p.id) ||
        p.created_by === user.id
      );
    }

    const rows = [headers];
    for (const p of filteredPenyadap) {
      // Cari apakah penyadap ini sudah ada penugasan aktif
      const activePg = allPenugasan.find(pg => pg.penyadap_id === p.id && pg.aktif === 1);
      let ptkNo = '';
      let pohon = '';
      let persen = 100;
      let aktif = 1;
      let ket = '';

      if (activePg) {
        const ap = allAP.find(a => a.id === activePg.anak_petak_id);
        const ptk = ap ? allPetak.find(pt => pt.id === ap.petak_id) : null;
        if (ptk) ptkNo = ptk.nomor;
        pohon = activePg.jumlah_pohon || '';
        persen = activePg.persen_target || 100;
        aktif = activePg.aktif;
        ket = activePg.keterangan || '';
      }

      rows.push([
        p.nomor,
        p.nama || '',
        ptkNo
      ]);
    }

    if (rows.length === 1) {
      rows.push(...TEMPLATES.penugasan.example);
    }

    return rows;
  }


  // ─────────────────────────────────────────────────────────────
  //  Import + Validasi + Partial Import
  // ─────────────────────────────────────────────────────────────
  async function importFile(section, file, errorPanelId) {
    if (typeof XLSX === 'undefined') { U().showToast('Library Excel belum tersedia', 'danger'); return; }
    if (!file) return;

    U().hideImportErrors(errorPanelId);

    const tmpl = TEMPLATES[section];
    if (!tmpl) return;

    const buffer = await file.arrayBuffer();
    const wb     = XLSX.read(buffer, { type: 'array' });
    
    // Cari sheet yang sesuai dengan label template, atau fallback ke sheet pertama yang bukan "Petunjuk"
    let sheetName = wb.SheetNames.find(name => name.toLowerCase() === tmpl.label.toLowerCase());
    if (!sheetName) {
      sheetName = wb.SheetNames.find(name => name.toLowerCase() !== 'petunjuk');
    }
    if (!sheetName) sheetName = wb.SheetNames[0];

    const ws     = wb.Sheets[sheetName];
    const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) {
      U().showToast('File Excel kosong atau tidak ada data', 'danger');
      return;
    }

    const { errors, records } = await _validate(section, rows);

    const storeMap = {
      bkph:            'bkph',
      rph:             'rph',
      tpg:             'tpg',
      penyadap:        'penyadap_master',
      petak:           'petak',
      anak_petak:      'anak_petak',
      penugasan:       'penugasan',
      user:            'users',
      target_bkph:     'target_bkph',
      target_rph:      'target_rph',
      target_tpg:      'target_tpg',
      target_mandor:   'target_mandor',
      target_penyadap: 'target_penyadap'
    };

    const store = storeMap[section];
    if (!store) return;

    // Trigger re-render function
    const triggerRender = () => {
      const renderMap = {
        bkph:            () => window.MasterBKPH && window.MasterBKPH.render(),
        rph:             () => window.MasterRPH  && window.MasterRPH.render(),
        tpg:             () => window.MasterTPG  && window.MasterTPG.render(),
        penyadap:        () => window.MasterPenyadap && window.MasterPenyadap.render(),
        petak:           () => window.MasterPetak && window.MasterPetak.render(),
        anak_petak:      () => window.MasterAnakPetak && window.MasterAnakPetak.render(),
        penugasan:       () => window.MasterPenugasan && window.MasterPenugasan.render(),
        user:            () => window.MasterUser && window.MasterUser.render(),
        target_bkph:     () => window.TargetModule && window.TargetModule.render(),
        target_rph:      () => window.TargetModule && window.TargetModule.render(),
        target_tpg:      () => window.TargetModule && window.TargetModule.render(),
        target_mandor:   () => window.TargetModule && window.TargetModule.render(),
        target_penyadap: () => window.TargetModule && window.TargetModule.render()
      };
      if (renderMap[section]) renderMap[section]();
    };

    if (errors.length > 0) {
      U().showImportErrors(errorPanelId, errors);
      const validCount = records.length;
      
      if (validCount > 0) {
        // Tampilkan dialog konfirmasi untuk Impor Parsial
        const userApproved = confirm(`Ditemukan ${errors.length} baris salah di file Excel Anda.\n\nApakah Anda ingin mengimpor ${validCount} data yang valid saja?`);
        if (userApproved) {
          await window.db.putMany(store, records);
          U().showToast(`Impor parsial berhasil: ${validCount} data diimpor, ${errors.length} baris salah dilewati`, 'warning');
          triggerRender();
          return;
        }
      }
      
      U().showToast(`Ditemukan ${errors.length} kesalahan. Impor dibatalkan.`, 'danger');
      return;
    }

    // Semua valid — lakukan impor penuh
    await window.db.putMany(store, records);
    U().showToast(`Import berhasil: ${records.length} data ${TEMPLATES[section].label} dimuat`, 'success');
    triggerRender();
  }

  // Helper untuk menormalisasikan dan memetakan key Excel ke template headers (case-insensitive & space/underscore-insensitive)
  function _normalizeRowKeys(row, headers) {
    const mapped = {};
    const headerMap = {};
    headers.forEach(h => {
      const norm = h.toLowerCase().replace(/[\s_-]/g, '');
      headerMap[norm] = h;
    });

    const customMapping = {
      koderph: ['kode_rph', 'kode'],
      namarph: ['nama'],
      bkph: ['kode_bkph'],
      kodetpg: ['kode_tpg', 'kode'],
      namatpg: ['nama'],
      rph: ['kode_rph'],
      tpg: ['kode_tpg'],
      nopenyadap: ['nomor'],
      nomorpenyadap: ['nomor'],
      namalengkap: ['nama'],
      nama: ['nama_lengkap'],
      wilayah: ['scope']
    };

    for (const key of Object.keys(row)) {
      const normKey = key.toLowerCase().replace(/[\s_-]/g, '');
      let mappedHeader = headerMap[normKey];
      
      if (!mappedHeader && customMapping[normKey]) {
        const targets = customMapping[normKey];
        const matchedTarget = targets.find(t => headerMap[t.toLowerCase().replace(/[\s_-]/g, '')]);
        if (matchedTarget) {
          mappedHeader = headerMap[matchedTarget.toLowerCase().replace(/[\s_-]/g, '')];
        }
      }
      
      if (mappedHeader) {
        mapped[mappedHeader] = row[key];
      } else {
        mapped[key] = row[key];
      }
    }
    return mapped;
  }

  // ─────────────────────────────────────────────────────────────
  //  Validasi per Section
  // ─────────────────────────────────────────────────────────────
  async function _validate(section, rows) {
    const errors  = [];
    const records = [];
    const actor   = U().currentActorId();

    const validators = {
      bkph:            _validateBKPH,
      rph:             _validateRPH,
      tpg:             _validateTPG,
      penyadap:        _validatePenyadap,
      petak:           _validatePetak,
      anak_petak:      _validateAnakPetak,
      penugasan:       _validatePenugasan,
      user:            _validateUser,
      target_bkph:     _validateTargetBKPH,
      target_rph:      _validateTargetRPH,
      target_tpg:      _validateTargetTPG,
      target_mandor:   _validateTargetMandor,
      target_penyadap: _validateTargetPenyadap
    };

    const fn = validators[section];
    if (!fn) return { errors: [{ row: 0, field: 'section', message: 'Section tidak dikenali' }], records: [] };

    const existingData = await _loadExistingData(section);
    const headers = TEMPLATES[section].headers;

    // Untuk melacak duplikat kode_bkph di dalam file Excel itu sendiri
    const seenKodesInSheet = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // baris 1 header
      const rawRow = rows[i];
      const row    = _normalizeRowKeys(rawRow, headers);
      const result = await fn(row, rowNum, existingData, actor, seenKodesInSheet);
      if (result.errors && result.errors.length > 0) {
        errors.push(...result.errors);
      } else if (result.record) {
        records.push(result.record);
      }
    }

    return { errors, records };
  }

  async function _loadExistingData(section) {
    return {
      bkph_all:            await window.db.getAllActive('bkph'),
      rph_all:             await window.db.getAllActive('rph'),
      tpg_all:             await window.db.getAllActive('tpg'),
      penyadap_all:        await window.db.getAllActive('penyadap_master'),
      petak_all:           await window.db.getAllActive('petak'),
      anak_petak_all:      await window.db.getAllActive('anak_petak'),
      penugasan_all:       await window.db.getAllActive('penugasan'),
      users_all:           await window.db.getAllActive('users'),
      target_bkph_all:     await window.db.getAllActive('target_bkph'),
      target_rph_all:      await window.db.getAllActive('target_rph'),
      target_tpg_all:      await window.db.getAllActive('target_tpg'),
      target_mandor_all:   await window.db.getAllActive('target_mandor'),
      target_penyadap_all: await window.db.getAllActive('target_penyadap')
    };
  }

  function _err(row, field, message) {
    return { row, field, message };
  }

  // ── Validator RPH ───────────────────────────────────────────
  async function _validateRPH(row, rowNum, data, actor, seenInSheet) {
    const errors  = [];
    const kodeBkph = String(row.kode_bkph || '').trim().toUpperCase();
    const kode     = String(row.kode || '').trim().toUpperCase();
    const nama     = String(row.nama || '').trim();
    let status     = String(row.status || 'aktif').trim();

    // Cari BKPH berdasarkan kode_bkph atau nama_bkph
    const bkph = data.bkph_all.find(b => 
      b.kode_bkph.toUpperCase() === kodeBkph || 
      b.nama_bkph.toUpperCase() === kodeBkph
    );
    if (!kodeBkph) {
      errors.push(_err(rowNum, 'kode_bkph', 'Kode BKPH wajib diisi'));
    } else if (!bkph) {
      errors.push(_err(rowNum, 'kode_bkph', `BKPH dengan kode "${kodeBkph}" tidak ditemukan di sistem`));
    }

    if (!kode) {
      errors.push(_err(rowNum, 'kode', 'Kode RPH wajib diisi'));
    } else {
      const dupKey = kode;
      if (seenInSheet.has(dupKey)) {
        errors.push(_err(rowNum, 'kode', `Kode RPH "${kode}" duplikat di dalam file Excel`));
      } else {
        seenInSheet.add(dupKey);
      }
      const dupDb = data.rph_all.find(r => r.kode === kode);
      if (dupDb) errors.push(_err(rowNum, 'kode', `Kode RPH "${kode}" sudah terdaftar di sistem`));
    }

    if (!nama) errors.push(_err(rowNum, 'nama', 'Nama RPH wajib diisi'));

    const cleanStatus = status.toLowerCase().replace(/[\s_-]/g, '');
    if (cleanStatus === 'aktif' || cleanStatus === 'active') {
      status = 'aktif';
    } else if (cleanStatus === 'tidakaktif' || cleanStatus === 'nonaktif' || cleanStatus === 'inactive') {
      status = 'nonaktif';
    } else {
      errors.push(_err(rowNum, 'status', `Status tidak valid: "${status}". Pilih: Aktif | Tidak Aktif`));
    }

    if (errors.length) return { errors };
    return { record: {
      id: U().uuid(),
      bkph_id:    bkph ? bkph.id : '',
      kode, nama,
      keterangan: String(row.keterangan || '').trim(),
      status,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator TPG ───────────────────────────────────────────
  async function _validateTPG(row, rowNum, data, actor, seenInSheet) {
    const errors  = [];
    const kodeRph = String(row.kode_rph || '').trim().toUpperCase();
    const kode    = String(row.kode || '').trim().toUpperCase();
    const nama    = String(row.nama || '').trim();
    let status    = String(row.status || 'aktif').trim();

    // Cari RPH berdasarkan kode atau nama
    const rph = data.rph_all.find(r => 
      r.kode.toUpperCase() === kodeRph || 
      r.nama.toUpperCase() === kodeRph
    );
    if (!kodeRph) {
      errors.push(_err(rowNum, 'kode_rph', 'Kode RPH wajib diisi'));
    } else if (!rph) {
      errors.push(_err(rowNum, 'kode_rph', `RPH dengan kode "${kodeRph}" tidak ditemukan di sistem`));
    }

    if (!kode) {
      errors.push(_err(rowNum, 'kode', 'Kode TPG wajib diisi'));
    } else {
      if (seenInSheet.has(kode)) {
        errors.push(_err(rowNum, 'kode', `Kode TPG "${kode}" duplikat di dalam file Excel`));
      } else {
        seenInSheet.add(kode);
      }
      const dupDb = data.tpg_all.find(t => t.kode === kode);
      if (dupDb) errors.push(_err(rowNum, 'kode', `Kode TPG "${kode}" sudah terdaftar di sistem`));
    }

    if (!nama) errors.push(_err(rowNum, 'nama', 'Nama TPG wajib diisi'));

    const cleanStatus = status.toLowerCase().replace(/[\s_-]/g, '');
    if (cleanStatus === 'aktif' || cleanStatus === 'active') {
      status = 'aktif';
    } else if (cleanStatus === 'tidakaktif' || cleanStatus === 'nonaktif' || cleanStatus === 'inactive') {
      status = 'nonaktif';
    } else {
      errors.push(_err(rowNum, 'status', `Status tidak valid: "${status}". Pilih: Aktif | Tidak Aktif`));
    }

    if (errors.length) return { errors };
    return { record: {
      id: U().uuid(),
      rph_id:     rph ? rph.id : '',
      kode, nama,
      keterangan: String(row.keterangan || '').trim(),
      status,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator BKPH ──────────────────────────────────────────
  async function _validateBKPH(row, rowNum, data, actor, seenKodesInSheet) {
    const errors = [];
    const kode = String(row.kode_bkph || '').trim().toUpperCase();
    const nama = String(row.nama_bkph || '').trim();
    const email = String(row.email || '').trim();
    let status = String(row.status || 'Aktif').trim();

    if (!kode) {
      errors.push(_err(rowNum, 'kode_bkph', 'Kode BKPH wajib diisi'));
    } else {
      if (seenKodesInSheet.has(kode)) {
        errors.push(_err(rowNum, 'kode_bkph', `Kode BKPH "${kode}" duplikat di dalam file Excel`));
      } else {
        seenKodesInSheet.add(kode);
      }
      
      const dupDb = data.bkph_all.find(r => r.kode_bkph === kode);
      if (dupDb) {
        errors.push(_err(rowNum, 'kode_bkph', `Kode BKPH "${kode}" sudah terdaftar di sistem`));
      }
    }

    if (!nama) errors.push(_err(rowNum, 'nama_bkph', 'Nama BKPH wajib diisi'));

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(_err(rowNum, 'email', 'Format email tidak valid'));
      }
    }

    const cleanStatus = status.toLowerCase().replace(/[\s_-]/g, '');
    if (cleanStatus === 'aktif' || cleanStatus === 'active') {
      status = 'Aktif';
    } else if (cleanStatus === 'tidakaktif' || cleanStatus === 'nonaktif' || cleanStatus === 'inactive') {
      status = 'Tidak Aktif';
    } else {
      errors.push(_err(rowNum, 'status', `Status tidak valid: "${status}". Pilih: Aktif | Tidak Aktif`));
    }

    if (errors.length) return { errors };

    return { record: {
      id: U().uuid(),
      kode_bkph: kode,
      nama_bkph: nama,
      alamat: String(row.alamat || '').trim(),
      telepon: String(row.telepon || '').trim(),
      email: email,
      keterangan: String(row.keterangan || '').trim(),
      status: status,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Penyadap ──────────────────────────────────────
  async function _validatePenyadap(row, rowNum, data, actor, seenInSheet) {
    const errors = [];
    const nomorKey = String(row.nomor || '').toUpperCase().trim();

    if (!nomorKey) errors.push(_err(rowNum, 'nomor', 'Nomor penyadap wajib diisi'));
    if (!row.nama)  errors.push(_err(rowNum, 'nama',  'Nama wajib diisi'));

    let status = String(row.status || 'aktif').trim().toLowerCase().replace(/[\s-]/g, '_');
    const validStatus = ['aktif', 'tidak_aktif', 'pindah', 'berhenti'];
    if (status === 'tidakaktif' || status === 'nonaktif') status = 'tidak_aktif';

    if (status && !validStatus.includes(status)) {
      errors.push(_err(rowNum, 'status', `Status tidak valid: "${row.status}". Pilih: aktif | tidak_aktif | pindah | berhenti`));
    }

    // Deteksi duplikat dalam file yang sama
    if (nomorKey && seenInSheet.has(nomorKey)) {
      errors.push(_err(rowNum, 'nomor', `Nomor "${nomorKey}" muncul lebih dari sekali dalam file Excel. Periksa apakah baris contoh template sudah dihapus.`));
    } else if (nomorKey) {
      seenInSheet.add(nomorKey);
    }

    // Upsert: jika nomor sudah ada → update data lama, bukan error
    const existing = data.penyadap_all.find(r => r.nomor === nomorKey);

    if (errors.length) return { errors };
    return { record: {
      id: existing ? existing.id : U().uuid(),
      nomor: nomorKey,
      nama: String(row.nama).trim(),
      alamat: String(row.alamat || '').trim(),
      no_hp: String(row.no_hp || '').trim(),
      status,
      ...U().makeAudit(actor, existing)
    }};
  }

  // ── Validator Petak ─────────────────────────────────────────
  async function _validatePetak(row, rowNum, data, actor) {
    const errors = [];
    const nomor    = String(row.nomor    || '').trim();
    // Support kolom kode_rph/kode_tpg (baru) ATAU rph_id/tpg_id (lama)
    const kodeRph  = String(row.kode_rph || row.rph_id || '').trim().toUpperCase();
    const kodeTpg  = String(row.kode_tpg || row.tpg_id || '').trim().toUpperCase();

    if (!nomor)   errors.push(_err(rowNum, 'nomor',    'Nomor petak wajib diisi'));
    if (!kodeRph) errors.push(_err(rowNum, 'kode_rph', 'Kode RPH wajib diisi'));
    if (!kodeTpg) errors.push(_err(rowNum, 'kode_tpg', 'Kode TPG wajib diisi'));

    // Cari RPH berdasarkan ID, kode, atau nama (case-insensitive)
    const rphObj = data.rph_all.find(r =>
      (r.id && r.id.toUpperCase() === kodeRph) ||
      (r.kode && r.kode.toUpperCase() === kodeRph) ||
      (r.nama && r.nama.toUpperCase() === kodeRph)
    );
    if (kodeRph && !rphObj)
      errors.push(_err(rowNum, 'kode_rph', `RPH dengan ID/kode/nama "${kodeRph}" tidak ditemukan. Cek di Master RPH.`));

    // Cari TPG berdasarkan ID, kode, atau nama (case-insensitive)
    const tpgObj = data.tpg_all.find(t =>
      (t.id && t.id.toUpperCase() === kodeTpg) ||
      (t.kode && t.kode.toUpperCase() === kodeTpg) ||
      (t.nama && t.nama.toUpperCase() === kodeTpg)
    );
    if (kodeTpg && !tpgObj)
      errors.push(_err(rowNum, 'kode_tpg', `TPG dengan ID/kode/nama "${kodeTpg}" tidak ditemukan. Cek di Master TPG.`));

    // Validasi TPG harus berada di bawah RPH yang dipilih
    if (rphObj && tpgObj && tpgObj.rph_id !== rphObj.id)
      errors.push(_err(rowNum, 'kode_tpg', `TPG "${kodeTpg}" bukan bagian dari RPH "${kodeRph}"`));

    // Cek duplikat nomor di RPH yang sama
    if (rphObj) {
      const dup = data.petak_all.find(r => r.rph_id === rphObj.id && r.nomor === nomor);
      if (dup) errors.push(_err(rowNum, 'nomor', `Petak ${nomor} sudah ada di RPH ini`));
    }

    if (errors.length) return { errors };

    const petakId      = U().uuid();
    const luas_ha      = parseFloat(row.luas_ha) || 0;
    const jumlah_pohon = parseInt(row.jumlah_pohon) || 0;
    const rph_id       = rphObj.id;
    const keterangan   = String(row.keterangan || '').trim();

    // Simpan dummy mirroring anak_petak agar relasi target/penugasan berjalan sempurna
    const apId = `ap-${petakId}`;
    const apRecord = {
      id: apId,
      petak_id: petakId,
      huruf: '',
      luas_ha,
      jumlah_pohon,
      tpg_id,
      keterangan,
      ...U().makeAudit(actor)
    };
    await window.db.put('anak_petak', apRecord);
    await window.db.queueSync('anak_petak', 'create', apRecord);

    return { record: {
      id: petakId,
      nomor,
      rph_id,
      tpg_id,
      luas_ha,
      jumlah_pohon,
      kelas_hutan: String(row.tahun_tanam || '').trim(),
      keterangan,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Anak Petak ────────────────────────────────────
  async function _validateAnakPetak(row, rowNum, data, actor) {
    const errors = [];
    if (!row.petak_id) errors.push(_err(rowNum, 'petak_id', 'petak_id wajib diisi'));
    if (!row.huruf)    errors.push(_err(rowNum, 'huruf',    'Huruf anak petak wajib diisi'));

    const petakExists = data.petak_all.find(r => r.id === String(row.petak_id));
    if (row.petak_id && !petakExists)
      errors.push(_err(rowNum, 'petak_id', `Petak dengan ID "${row.petak_id}" tidak ditemukan`));

    const dup = data.anak_petak_all.find(r => r.petak_id === String(row.petak_id) && r.huruf === String(row.huruf).toUpperCase());
    if (dup) errors.push(_err(rowNum, 'huruf', `Anak Petak ${row.huruf} sudah ada di petak ini`));

    if (errors.length) return { errors };
    return { record: {
      id: U().uuid(),
      petak_id: String(row.petak_id).trim(),
      huruf: String(row.huruf).trim().toUpperCase(),
      luas_ha: parseFloat(row.luas_ha) || 0,
      jumlah_pohon: parseInt(row.jumlah_pohon) || 0,
      keterangan: String(row.keterangan || '').trim(),
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Penugasan ─────────────────────────────────────
  async function _validatePenugasan(row, rowNum, data, actor) {
    const errors = [];

    // Support dua format:
    // [BARU] nomor_penyadap + no_petak (human-readable, direkomendasikan)
    // [LAMA] penyadap_id + anak_petak_id (UUID internal, backward compat)
    let penyadapId  = null;
    let anakPetakId = null;
    let jumlahPohon = 0;

    const useHumanReadable = !!(row.nomor_penyadap || row.no_petak);

    if (useHumanReadable) {
      // Resolve nomor penyadap → ID
      const nomorPs = String(row.nomor_penyadap || '').trim().toUpperCase();
      if (!nomorPs) {
        errors.push(_err(rowNum, 'nomor_penyadap', 'Nomor penyadap wajib diisi'));
      } else {
        const ps = data.penyadap_all.find(p => p.nomor === nomorPs);
        if (!ps) errors.push(_err(rowNum, 'nomor_penyadap', `Penyadap "${nomorPs}" tidak ditemukan di sistem`));
        else penyadapId = ps.id;
      }

      // Resolve no_petak → anak_petak_id & jumlah_pohon (case-insensitive)
      const noPetak = String(row.no_petak || '').trim().toUpperCase();
      if (!noPetak) {
        errors.push(_err(rowNum, 'no_petak', 'Nomor petak wajib diisi'));
      } else {
        const petak = data.petak_all.find(p => String(p.nomor).trim().toUpperCase() === noPetak);
        if (!petak) {
          errors.push(_err(rowNum, 'no_petak', `Petak "${noPetak}" tidak ditemukan di sistem`));
        } else {
          const ap = data.anak_petak_all.find(a => a.petak_id === petak.id);
          if (!ap) {
            errors.push(_err(rowNum, 'no_petak', `Anak Petak untuk Petak "${noPetak}" tidak ditemukan`));
          } else {
            anakPetakId = ap.id;
            jumlahPohon = ap.jumlah_pohon || 0; // Otomatis ambil jumlah pohon dari Master
          }
        }
      }
    } else {
      // Format lama: langsung pakai UUID
      if (!row.penyadap_id)   errors.push(_err(rowNum, 'penyadap_id',   'penyadap_id wajib diisi'));
      if (!row.anak_petak_id) errors.push(_err(rowNum, 'anak_petak_id', 'anak_petak_id wajib diisi'));
      penyadapId  = row.penyadap_id   ? String(row.penyadap_id).trim()   : null;
      anakPetakId = row.anak_petak_id ? String(row.anak_petak_id).trim() : null;
      
      if (anakPetakId) {
        const ap = data.anak_petak_all.find(a => a.id === anakPetakId);
        jumlahPohon = ap ? (ap.jumlah_pohon || 0) : 0;
      }
    }

    const persen = 100;

    if (errors.length) return { errors };

    // Cek duplikat penugasan aktif yang sama
    const dupAktif = data.penugasan_all.find(r =>
      r.penyadap_id === penyadapId &&
      r.anak_petak_id === anakPetakId &&
      r.aktif === 1
    );
    if (dupAktif) return { errors: [_err(rowNum, 'nomor_penyadap', `Penyadap ini sudah memiliki penugasan aktif di petak yang sama`)] };

    return { record: {
      id: U().uuid(),
      penyadap_id:   penyadapId,
      anak_petak_id: anakPetakId,
      persen_target: persen,
      jumlah_pohon:  jumlahPohon, // Gunakan jumlah pohon yang di-resolve otomatis
      tanggal_mulai: U().today(),
      tanggal_selesai: null,
      aktif: 1,
      keterangan: '',
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator User ──────────────────────────────────────────

  async function _validateUser(row, rowNum, data, actor) {
    const errors = [];
    if (!row.nama_lengkap) errors.push(_err(rowNum, 'nama_lengkap', 'Nama lengkap wajib diisi'));
    if (!row.username)     errors.push(_err(rowNum, 'username',     'Username wajib diisi'));
    if (!row.password)     errors.push(_err(rowNum, 'password',     'Password wajib diisi'));

    const role = String(row.role || 'mandor').trim().toLowerCase();
    const validRoles = ['admin', 'bkph', 'krph', 'tpg', 'mandor'];
    if (row.role && !validRoles.includes(role))
      errors.push(_err(rowNum, 'role', `Role tidak valid: "${row.role}". Pilih: ${validRoles.join(', ')}`));

    const dup = data.users_all.find(u => u.username === String(row.username).toLowerCase());
    if (dup) errors.push(_err(rowNum, 'username', `Username "${row.username}" sudah digunakan`));

    let status = String(row.status || 'aktif').trim().toLowerCase();
    if (status === 'aktif' || status === 'active') {
      status = 'aktif';
    } else if (status === 'nonaktif' || status === 'tidak aktif' || status === 'inactive') {
      status = 'nonaktif';
    } else {
      errors.push(_err(rowNum, 'status', `Status tidak valid: "${row.status}". Pilih: aktif | nonaktif`));
    }

    if (errors.length) return { errors };

    const _hp = typeof window.hashPassword === 'function' ? window.hashPassword : hashPassword;
    const password_hash = await _hp(String(row.password));
    return { record: {
      id: U().uuid(),
      nama_lengkap: String(row.nama_lengkap).trim(),
      nip: String(row.nip || '').trim(),
      username: String(row.username).trim().toLowerCase(),
      password_hash,
      role,
      scope: row.scope ? String(row.scope).trim() : null,
      status,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Target BKPH ────────────────────────────────────
  async function _validateTargetBKPH(row, rowNum, data, actor, seenInSheet) {
    const errors = [];
    const tahun = parseInt(row.tahun);
    const target_kg = parseFloat(row.target_kg) || 0;

    if (!row.tahun || isNaN(tahun)) errors.push(_err(rowNum, 'tahun', 'Tahun wajib diisi dengan angka'));
    if (!row.target_kg || target_kg <= 0) errors.push(_err(rowNum, 'target_kg', 'Target produksi (Kg) harus lebih besar dari 0'));

    if (errors.length) return { errors };

    // Cek duplikat tahun di sheet
    const dupKey = String(tahun);
    if (seenInSheet.has(dupKey)) {
      errors.push(_err(rowNum, 'tahun', `Target BKPH untuk tahun ${tahun} duplikat di dalam file Excel`));
    } else {
      seenInSheet.add(dupKey);
    }

    // Cek duplikat tahun di DB
    const dupDb = data.target_bkph_all.find(x => x.tahun === tahun);
    if (dupDb) errors.push(_err(rowNum, 'tahun', `Target BKPH untuk tahun ${tahun} sudah terdaftar di sistem`));

    if (errors.length) return { errors };

    return { record: {
      id: U().uuid(),
      tahun,
      target_kg,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Target RPH ─────────────────────────────────────
  async function _validateTargetRPH(row, rowNum, data, actor, seenInSheet) {
    const errors = [];
    const tahun = parseInt(row.tahun);
    const kode_rph = String(row.kode_rph || '').trim().toUpperCase();
    const target_kg = parseFloat(row.target_kg) || 0;

    if (!row.tahun || isNaN(tahun)) errors.push(_err(rowNum, 'tahun', 'Tahun wajib diisi dengan angka'));
    if (!kode_rph) errors.push(_err(rowNum, 'kode_rph', 'Kode RPH wajib diisi'));
    if (!row.target_kg || target_kg <= 0) errors.push(_err(rowNum, 'target_kg', 'Target produksi (Kg) harus lebih besar dari 0'));

    const rph = data.rph_all.find(r => r.kode === kode_rph);
    if (kode_rph && !rph) errors.push(_err(rowNum, 'kode_rph', `RPH dengan kode "${kode_rph}" tidak ditemukan`));

    if (errors.length) return { errors };

    // Cek duplikat di sheet
    const dupKey = `${tahun}_${rph.id}`;
    if (seenInSheet.has(dupKey)) {
      errors.push(_err(rowNum, 'kode_rph', `Target RPH "${kode_rph}" untuk tahun ${tahun} duplikat di dalam file Excel`));
    } else {
      seenInSheet.add(dupKey);
    }

    // Cek duplikat di DB
    const dupDb = data.target_rph_all.find(x => x.tahun === tahun && x.rph_id === rph.id);
    if (dupDb) errors.push(_err(rowNum, 'kode_rph', `Target RPH "${kode_rph}" untuk tahun ${tahun} sudah terdaftar`));

    if (errors.length) return { errors };

    return { record: {
      id: U().uuid(),
      tahun,
      rph_id: rph.id,
      target_kg,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Target TPG ─────────────────────────────────────
  async function _validateTargetTPG(row, rowNum, data, actor, seenInSheet) {
    const errors = [];
    const tahun = parseInt(row.tahun);
    const kode_tpg = String(row.kode_tpg || '').trim().toUpperCase();
    const target_kg = parseFloat(row.target_kg) || 0;

    if (!row.tahun || isNaN(tahun)) errors.push(_err(rowNum, 'tahun', 'Tahun wajib diisi dengan angka'));
    if (!kode_tpg) errors.push(_err(rowNum, 'kode_tpg', 'Kode TPG wajib diisi'));
    if (!row.target_kg || target_kg <= 0) errors.push(_err(rowNum, 'target_kg', 'Target produksi (Kg) harus lebih besar dari 0'));

    const tpg = data.tpg_all.find(t => t.kode === kode_tpg);
    if (kode_tpg && !tpg) errors.push(_err(rowNum, 'kode_tpg', `TPG dengan kode "${kode_tpg}" tidak ditemukan`));

    if (errors.length) return { errors };

    const dupKey = `${tahun}_${tpg.id}`;
    if (seenInSheet.has(dupKey)) {
      errors.push(_err(rowNum, 'kode_tpg', `Target TPG "${kode_tpg}" untuk tahun ${tahun} duplikat di dalam file Excel`));
    } else {
      seenInSheet.add(dupKey);
    }

    const dupDb = data.target_tpg_all.find(x => x.tahun === tahun && x.tpg_id === tpg.id);
    if (dupDb) errors.push(_err(rowNum, 'kode_tpg', `Target TPG "${kode_tpg}" untuk tahun ${tahun} sudah terdaftar`));

    if (errors.length) return { errors };

    return { record: {
      id: U().uuid(),
      tahun,
      tpg_id: tpg.id,
      target_kg,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Target Mandor ──────────────────────────────────
  async function _validateTargetMandor(row, rowNum, data, actor, seenInSheet) {
    const errors = [];
    const tahun = parseInt(row.tahun);
    const username = String(row.username_mandor || '').trim().toLowerCase();
    const target_kg = parseFloat(row.target_kg) || 0;

    if (!row.tahun || isNaN(tahun)) errors.push(_err(rowNum, 'tahun', 'Tahun wajib diisi dengan angka'));
    if (!username) errors.push(_err(rowNum, 'username_mandor', 'Username mandor wajib diisi'));
    if (!row.target_kg || target_kg <= 0) errors.push(_err(rowNum, 'target_kg', 'Target produksi (Kg) harus lebih besar dari 0'));

    const user = data.users_all.find(u => u.username === username && (u.role === 'mandor' || u.role === 'tpg'));
    if (username && !user) errors.push(_err(rowNum, 'username_mandor', `User Mandor dengan username "${username}" tidak ditemukan`));

    if (errors.length) return { errors };

    const dupKey = `${tahun}_${user.id}`;
    if (seenInSheet.has(dupKey)) {
      errors.push(_err(rowNum, 'username_mandor', `Target Mandor "${username}" untuk tahun ${tahun} duplikat di dalam file Excel`));
    } else {
      seenInSheet.add(dupKey);
    }

    const dupDb = data.target_mandor_all.find(x => x.tahun === tahun && x.mandor_id === user.id);
    if (dupDb) errors.push(_err(rowNum, 'username_mandor', `Target Mandor "${username}" untuk tahun ${tahun} sudah terdaftar`));

    if (errors.length) return { errors };

    return { record: {
      id: U().uuid(),
      tahun,
      mandor_id: user.id,
      target_kg,
      ...U().makeAudit(actor)
    }};
  }

  // ── Validator Target Penyadap ────────────────────────────────
  async function _validateTargetPenyadap(row, rowNum, data, actor, seenInSheet) {
    const errors = [];
    const tahun = parseInt(row.tahun);
    const nomorPenyadap = String(row.nomor_penyadap || '').trim().toUpperCase();
    const noPetak = String(row.no_petak || '').trim().toUpperCase();
    const hurufAnakPetak = String(row.huruf_anak_petak || '').trim().toUpperCase();
    const luas_ha = parseFloat(row.luas_ha) || 0;
    const pohon = parseInt(row.pohon) || 0;
    const target_kg = parseFloat(row.target_kg) || 0;

    if (!row.tahun || isNaN(tahun)) errors.push(_err(rowNum, 'tahun', 'Tahun wajib diisi dengan angka'));
    if (!nomorPenyadap) errors.push(_err(rowNum, 'nomor_penyadap', 'Nomor penyadap wajib diisi'));
    if (!noPetak) errors.push(_err(rowNum, 'no_petak', 'Nomor petak wajib diisi'));
    // huruf_anak_petak bersifat OPSIONAL — jika kosong, sistem otomatis ambil anak petak pertama dari petak
    if (!row.luas_ha || luas_ha <= 0) errors.push(_err(rowNum, 'luas_ha', 'Luas areal (Ha) harus lebih besar dari 0'));
    if (!row.target_kg || target_kg <= 0) errors.push(_err(rowNum, 'target_kg', 'Target produksi (Kg) harus lebih besar dari 0'));

    const penyadap = data.penyadap_all.find(p => String(p.nomor).trim().toUpperCase() === nomorPenyadap);
    if (nomorPenyadap && !penyadap) errors.push(_err(rowNum, 'nomor_penyadap', `Penyadap dengan nomor "${nomorPenyadap}" tidak ditemukan`));

    const petak = data.petak_all.find(p => String(p.nomor).trim().toUpperCase() === noPetak);
    let ap = null;
    if (noPetak && !petak) {
      errors.push(_err(rowNum, 'no_petak', `Petak dengan nomor "${noPetak}" tidak ditemukan`));
    } else if (petak) {
      if (hurufAnakPetak) {
        // Jika huruf diisi, cari yang spesifik
        ap = data.anak_petak_all.find(a => a.petak_id === petak.id && String(a.huruf).trim().toUpperCase() === hurufAnakPetak);
        if (!ap) errors.push(_err(rowNum, 'huruf_anak_petak', `Anak Petak "${noPetak}${hurufAnakPetak}" tidak ditemukan`));
      } else {
        // Jika huruf kosong, ambil anak petak pertama dari petak ini
        ap = data.anak_petak_all.find(a => a.petak_id === petak.id);
        if (!ap) errors.push(_err(rowNum, 'no_petak', `Tidak ada anak petak ditemukan untuk Petak "${noPetak}"`));
      }
    }

    if (errors.length) return { errors };

    // Validasi duplikat di sheet
    const dupKey = `${tahun}_${penyadap.id}_${ap.id}`;
    if (seenInSheet.has(dupKey)) {
      errors.push(_err(rowNum, 'nomor_penyadap', `Target Penyadap "${nomorPenyadap}" di Anak Petak "${noPetak}${hurufAnakPetak}" pada tahun ${tahun} duplikat di dalam file Excel`));
    } else {
      seenInSheet.add(dupKey);
    }

    // Cek duplikat di DB — jika sudah ada, lakukan upsert (update) bukan error
    const existingTarget = data.target_penyadap_all.find(x => x.tahun === tahun && x.penyadap_id === penyadap.id && x.anak_petak_id === ap.id);

    if (errors.length) return { errors };


    return { record: {
      id: existingTarget ? existingTarget.id : U().uuid(),
      tahun,
      penyadap_id: penyadap.id,
      anak_petak_id: ap.id,
      luas_ha,
      pohon: pohon > 0 ? pohon : (ap.jumlah_pohon || 0), // Fallback ke jumlah pohon di master anak petak
      target_kg,
      ...U().makeAudit(actor, existingTarget)
    }};
  }

  return { downloadTemplate, importFile };
})();

window.MasterImport = MasterImport;
