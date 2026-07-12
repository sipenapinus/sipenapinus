/**
 * SIPENA Lite — IndexedDB Manager v4
 * v4: Tambah kode_bkph, nama_bkph, telepon, email ke bkph.
 */

'use strict';

class SipenaDB {
  constructor() {
    this.dbName    = 'sipena_lite_db';
    this.dbVersion = 6;
    this.db        = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = e => {
        console.error('[DB] Open error:', e);
        reject(e.target.error);
      };

      request.onsuccess = e => {
        this.db = e.target.result;
        console.log(`[DB] Ready v${this.dbVersion}`);
        resolve(this.db);
      };

      request.onupgradeneeded = e => {
        const db  = e.target.result;
        const old = e.oldVersion;
        console.log(`[DB] Upgrade: v${old} → v${this.dbVersion}`);
        this._createStores(db, old);
      };
    });
  }

  _createStores(db, oldVersion) {
    // Upgrade hook to safely modify store definition
    if (oldVersion > 0 && oldVersion < 4) {
      if (db.objectStoreNames.contains('bkph')) {
        db.deleteObjectStore('bkph');
      }
    }

    // Helper: only create if not exists
    const ensure = (name, options) => {
      if (!db.objectStoreNames.contains(name)) {
        return db.createObjectStore(name, options);
      }
      // During upgrade we need the transaction to access existing stores
      return null;
    };

    // ── v1 stores ──
    ensure('meta',       { keyPath: 'key' });

    if (!db.objectStoreNames.contains('users')) {
      const s = db.createObjectStore('users', { keyPath: 'id' });
      s.createIndex('username',   'username',   { unique: true });
      s.createIndex('role',       'role',        { unique: false });
      s.createIndex('deleted_at', 'deleted_at',  { unique: false });
    }

    if (!db.objectStoreNames.contains('sync_queue')) {
      const s = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      s.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Legacy stores (kept for backward compatibility, not used by SIPENA-010+)
    if (!db.objectStoreNames.contains('areal_sadap')) {
      const s = db.createObjectStore('areal_sadap', { keyPath: 'id' });
      s.createIndex('mandor_id', 'mandor_id', { unique: false });
    }
    if (!db.objectStoreNames.contains('ro')) {
      const s = db.createObjectStore('ro', { keyPath: 'id' });
      s.createIndex('areal_id',    'areal_id',    { unique: false });
      s.createIndex('penyadap_id', 'penyadap_id', { unique: false });
      s.createIndex('sync_status', 'sync_status', { unique: false });
    }
    if (!db.objectStoreNames.contains('realisasi')) {
      const s = db.createObjectStore('realisasi', { keyPath: 'id' });
      s.createIndex('penyadap_id', 'penyadap_id', { unique: false });
      s.createIndex('tpg_id',      'tpg_id',      { unique: false });
      s.createIndex('sync_status', 'sync_status', { unique: false });
      s.createIndex('tanggal',     'tanggal',     { unique: false });
    }
    if (!db.objectStoreNames.contains('penyadap')) {
      const s = db.createObjectStore('penyadap', { keyPath: 'id' });
      s.createIndex('mandor_id', 'mandor_id', { unique: false });
      s.createIndex('areal_id',  'areal_id',  { unique: false });
    }

    // ── v2/v4 Master Data stores ──
    if (!db.objectStoreNames.contains('bkph')) {
      const s = db.createObjectStore('bkph', { keyPath: 'id' });
      s.createIndex('kode_bkph',  'kode_bkph',  { unique: true });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('rph')) {
      const s = db.createObjectStore('rph', { keyPath: 'id' });
      s.createIndex('bkph_id',    'bkph_id',    { unique: false });
      s.createIndex('kode',       'kode',       { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('tpg')) {
      const s = db.createObjectStore('tpg', { keyPath: 'id' });
      s.createIndex('rph_id',     'rph_id',     { unique: false });
      s.createIndex('kode',       'kode',       { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('petak')) {
      const s = db.createObjectStore('petak', { keyPath: 'id' });
      s.createIndex('rph_id',       'rph_id',       { unique: false });
      s.createIndex('nomor',        'nomor',        { unique: false });
      // v3: kelas_hutan — no index needed (teks bebas)
      s.createIndex('deleted_at',   'deleted_at',   { unique: false });
    }

    if (!db.objectStoreNames.contains('anak_petak')) {
      const s = db.createObjectStore('anak_petak', { keyPath: 'id' });
      s.createIndex('petak_id',   'petak_id',   { unique: false });
      s.createIndex('tpg_id',     'tpg_id',     { unique: false }); // v3
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('penyadap_master')) {
      const s = db.createObjectStore('penyadap_master', { keyPath: 'id' });
      s.createIndex('nomor',      'nomor',      { unique: false });
      s.createIndex('status',     'status',     { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('penugasan')) {
      const s = db.createObjectStore('penugasan', { keyPath: 'id' });
      s.createIndex('penyadap_id',   'penyadap_id',   { unique: false });
      s.createIndex('anak_petak_id', 'anak_petak_id', { unique: false });
      s.createIndex('aktif',         'aktif',         { unique: false });
      s.createIndex('deleted_at',    'deleted_at',    { unique: false });
    }

    // ── v5 Target Stores ──
    if (!db.objectStoreNames.contains('target_bkph')) {
      const s = db.createObjectStore('target_bkph', { keyPath: 'id' });
      s.createIndex('tahun',      'tahun',      { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('target_rph')) {
      const s = db.createObjectStore('target_rph', { keyPath: 'id' });
      s.createIndex('tahun',      'tahun',      { unique: false });
      s.createIndex('rph_id',     'rph_id',     { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('target_tpg')) {
      const s = db.createObjectStore('target_tpg', { keyPath: 'id' });
      s.createIndex('tahun',      'tahun',      { unique: false });
      s.createIndex('tpg_id',     'tpg_id',     { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('target_mandor')) {
      const s = db.createObjectStore('target_mandor', { keyPath: 'id' });
      s.createIndex('tahun',      'tahun',      { unique: false });
      s.createIndex('mandor_id',  'mandor_id',  { unique: false });
      s.createIndex('deleted_at', 'deleted_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('target_penyadap')) {
      const s = db.createObjectStore('target_penyadap', { keyPath: 'id' });
      s.createIndex('tahun',       'tahun',       { unique: false });
      s.createIndex('penyadap_id', 'penyadap_id', { unique: false });
      s.createIndex('deleted_at',  'deleted_at',  { unique: false });
    }

    // ── v6 Attendance and Monitoring Stores ──
    if (!db.objectStoreNames.contains('kehadiran')) {
      const s = db.createObjectStore('kehadiran', { keyPath: 'id' });
      s.createIndex('tanggal',     'tanggal',     { unique: false });
      s.createIndex('penyadap_id', 'penyadap_id', { unique: false });
      s.createIndex('deleted_at',  'deleted_at',  { unique: false });
    }

    if (!db.objectStoreNames.contains('monitoring')) {
      const s = db.createObjectStore('monitoring', { keyPath: 'id' });
      s.createIndex('tanggal',     'tanggal',     { unique: false });
      s.createIndex('penyadap_id', 'penyadap_id', { unique: false });
      s.createIndex('deleted_at',  'deleted_at',  { unique: false });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Core CRUD
  // ─────────────────────────────────────────────────────────────

  _tx(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('[DB] Not initialized. Call init() first.');
    const tx    = this.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { tx, store };
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const { store } = this._tx(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const { store } = this._tx(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  /** Hanya record yang belum soft-deleted */
  async getAllActive(storeName) {
    const all = await this.getAll(storeName);
    return all.filter(r => !r.deleted_at);
  }

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const { store } = this._tx(storeName, 'readwrite');
      const req = store.put(data);
      req.onsuccess = () => resolve(data);
      req.onerror   = () => reject(req.error);
    });
  }

  async putMany(storeName, items) {
    return new Promise((resolve, reject) => {
      if (!items || items.length === 0) { resolve([]); return; }
      const { tx, store } = this._tx(storeName, 'readwrite');
      tx.oncomplete = () => resolve(items);
      tx.onerror    = () => reject(tx.error);
      items.forEach(item => store.put(item));
    });
  }

  async clearStore(storeName) {
    return new Promise((resolve, reject) => {
      const { store } = this._tx(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
    });
  }

  async hardDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const { store } = this._tx(storeName, 'readwrite');
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
    });
  }

  /**
   * Soft delete: set deleted_at tanpa menghapus record dari store.
   * Data penyadap TIDAK boleh di-soft-delete (business rule).
   */
  async softDelete(storeName, id, actorId) {
    const record = await this.get(storeName, id);
    if (!record) throw new Error('Record tidak ditemukan');
    record.deleted_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    record.updated_by = actorId || 'system';
    await this.put(storeName, record);
    await this.queueSync(storeName, 'delete', { id });
    return record;
  }

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const { store } = this._tx(storeName);
      const req = store.index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror   = () => reject(req.error);
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Offline Sync Queue
  // ─────────────────────────────────────────────────────────────

  async queueSync(storeName, action, payload) {
    await this.put('sync_queue', { storeName, action, payload, timestamp: Date.now() });
  }

  async getSyncQueue() {
    const all = await this.getAll('sync_queue');
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  async dequeueSync(id) {
    return this.hardDelete('sync_queue', id);
  }
}

window.db = new SipenaDB();
