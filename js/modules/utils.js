/**
 * SIPENA Lite — Utility Helpers
 * Digunakan oleh semua modul master dan modul operasional.
 * Tidak boleh ada dependensi ke modul lain di sini.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
//  UUID v4 Generator
// ─────────────────────────────────────────────────────────────
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─────────────────────────────────────────────────────────────
//  Audit Fields
// ─────────────────────────────────────────────────────────────
/**
 * Menghasilkan audit fields untuk record baru atau yang diperbarui.
 * @param {string} actor - ID pengguna yang melakukan aksi
 * @param {object|null} existing - Record lama (null jika baru)
 */
function makeAudit(actor, existing = null) {
  const now = new Date().toISOString();
  const by  = actor || 'system';
  if (!existing) {
    return { created_at: now, updated_at: now, created_by: by, updated_by: by, deleted_at: null };
  }
  return {
    created_at: existing.created_at || now,
    updated_at: now,
    created_by: existing.created_by || by,
    updated_by: by,
    deleted_at: existing.deleted_at || null
  };
}

/** Mengembalikan ID user yang sedang login */
function currentActorId() {
  return window.app && window.app.currentUser ? window.app.currentUser.id : 'system';
}

// ─────────────────────────────────────────────────────────────
//  Toast Notification
// ─────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  if (window.app && typeof window.app.showToast === 'function') {
    window.app.showToast(msg, type);
  }
}

// ─────────────────────────────────────────────────────────────
//  Date Formatting
// ─────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────
//  Pagination
// ─────────────────────────────────────────────────────────────
const ROWS_PER_PAGE = 10;

/**
 * Memotong array data sesuai halaman aktif.
 * @param {Array} data - Seluruh data yang sudah difilter/diurutkan
 * @param {number} page - Halaman aktif (1-indexed)
 * @param {number} perPage - Jumlah baris per halaman
 * @returns {{ rows: Array, total: number, totalPages: number }}
 */
function paginate(data, page = 1, perPage = ROWS_PER_PAGE) {
  const total      = data.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage   = Math.min(Math.max(1, page), totalPages);
  const start      = (safePage - 1) * perPage;
  const rows       = data.slice(start, start + perPage);
  return { rows, total, totalPages, page: safePage };
}

// Registry untuk menyimpan callback pagination — menghindari serialisasi closure
const _paginationRegistry = {};
let _paginationSeq = 0;

/**
 * Merender komponen paginasi ke dalam elemen container dengan dropdown pemilih batas baris.
 * @param {HTMLElement} container
 * @param {object} pager - hasil dari paginate()
 * @param {function} onChangeFn - dipanggil dengan nomor halaman baru
 * @param {function|null} onPerPageChangeFn - dipanggil dengan batas data per halaman yang baru
 * @param {number} currentPerPage - batas halaman saat ini
 */
function renderPagination(container, pager, onChangeFn, onPerPageChangeFn = null, currentPerPage = 10) {
  if (!container) return;
  const { page, totalPages, total } = pager;
  const limit = currentPerPage || 10;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  // Bersihkan registry lama untuk container ini agar tidak bocor memori
  const cid = container.dataset.paginationId || (++_paginationSeq);
  container.dataset.paginationId = cid;
  _paginationRegistry[cid] = { pageChange: onChangeFn, perPageChange: onPerPageChangeFn };

  const go = (p) => `window.SipenaUtils._paginationGo(${cid},${p})`;
  const changeLimit = `window.SipenaUtils._paginationLimit(${cid},this.value)`;

  let html = `<div class="pagination-wrapper" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; width:100%;">`;
  
  // Info Data & Dropdown Limit
  html += `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">`;
  html += `<span class="pagination-info">Menampilkan ${start}\u2013${end} dari ${total} data</span>`;
  if (onPerPageChangeFn) {
    html += `<span class="pagination-info" style="display:inline-flex; align-items:center; gap:4px; margin-left:8px; border-left:1px solid var(--border-color); padding-left:12px;">`;
    html += `Tampilkan: `;
    html += `<select class="form-control" style="width:auto; display:inline-block; padding:2px 8px; height:28px; line-height:1; font-size:.8rem; margin:0 4px; vertical-align:middle; background:var(--bg-surface-elevated); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);" onchange="${changeLimit}">`;
    const options = [10, 25, 50, 100, 100000];
    options.forEach(opt => {
      const isSelected = limit === opt ? 'selected' : '';
      const label = opt === 100000 ? 'Semua' : opt;
      html += `<option value="${opt}" ${isSelected}>${label}</option>`;
    });
    html += `</select> baris</span>`;
  }
  html += `</div>`;

  // Controls Paging (hanya render jika total halaman > 1)
  html += `<div class="pagination-controls">`;
  html += `<button class="btn-page${page <= 1 ? ' disabled' : ''}" ${page <= 1 ? 'disabled' : `onclick="${go(page - 1)}"`}>\u2039 Prev</button>`;

  const rangeStart = Math.max(1, page - 2);
  const rangeEnd   = Math.min(totalPages, rangeStart + 4);
  for (let i = rangeStart; i <= rangeEnd; i++) {
    html += `<button class="btn-page${i === page ? ' active' : ''}" onclick="${go(i)}">${i}</button>`;
  }

  html += `<button class="btn-page${page >= totalPages ? ' disabled' : ''}" ${page >= totalPages ? 'disabled' : `onclick="${go(page + 1)}"`}>Next \u203a</button>`;
  html += `</div></div>`;
  
  container.innerHTML = html;
}

function _paginationGo(cid, page) {
  const reg = _paginationRegistry[cid];
  if (reg && typeof reg.pageChange === 'function') reg.pageChange(page);
}

function _paginationLimit(cid, limit) {
  const reg = _paginationRegistry[cid];
  if (reg && typeof reg.perPageChange === 'function') reg.perPageChange(parseInt(limit));
}


// ─────────────────────────────────────────────────────────────
//  Search / Sort / Filter
// ─────────────────────────────────────────────────────────────
/**
 * Memfilter dan mengurutkan array data.
 * @param {Array} data
 * @param {string} search - Query pencarian
 * @param {Array<string>} searchFields - Field yang dicari
 * @param {string} sortKey - Field untuk sorting
 * @param {string} sortDir - 'asc' | 'desc'
 */
function filterAndSort(data, search = '', searchFields = [], sortKey = '', sortDir = 'asc') {
  let result = [...data];

  if (search && searchFields.length) {
    const q = search.toLowerCase().trim();
    result = result.filter(r =>
      searchFields.some(f => r[f] != null && String(r[f]).toLowerCase().includes(q))
    );
  }

  if (sortKey) {
    result.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'id', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
//  Import Error Panel
// ─────────────────────────────────────────────────────────────
/**
 * Menampilkan panel daftar kesalahan import Excel.
 * @param {string} panelId - ID elemen container panel
 * @param {Array<{row, field, message}>} errors
 */
function showImportErrors(panelId, errors) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  if (!errors || errors.length === 0) {
    panel.style.display = 'none';
    return;
  }

  let html = `
    <div class="import-error-header">
      <span>⚠️ Ditemukan ${errors.length} kesalahan pada file Excel</span>
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${panelId}').style.display='none'">Tutup</button>
    </div>
    <table class="import-error-table">
      <thead><tr><th>Baris</th><th>Kolom</th><th>Pesan Kesalahan</th></tr></thead>
      <tbody>`;
  errors.forEach(e => {
    html += `<tr><td>${e.row}</td><td><code>${e.field}</code></td><td>${e.message}</td></tr>`;
  });
  html += `</tbody></table>`;
  panel.innerHTML = html;
  panel.style.display = 'block';
}

function hideImportErrors(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
//  Modal Helpers
// ─────────────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    makeDraggable(id);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    const content = el.querySelector('.modal-content');
    if (content) {
      // Reset drag position style on close so it centers next time
      content.style.position = '';
      content.style.left = '';
      content.style.top = '';
      content.style.transform = '';
      content.style.margin = '';
    }
  }
}

function makeDraggable(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  const header = modal.querySelector('.modal-header');
  if (!content || !header) return;

  header.style.cursor = 'move';
  header.style.userSelect = 'none';

  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  header.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    if (e.target.classList.contains('modal-close') || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    
    // Convert to absolute coordinates on first drag
    if (content.style.position !== 'absolute') {
      const rect = content.getBoundingClientRect();
      content.style.position = 'absolute';
      content.style.left = rect.left + 'px';
      content.style.top = rect.top + 'px';
      content.style.transform = 'none';
      content.style.margin = '0';
    }

    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    content.style.top = (content.offsetTop - pos2) + 'px';
    content.style.left = (content.offsetLeft - pos1) + 'px';
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Badge & Label Maps
// ─────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  admin:  'Administrator',
  bkph:   'Asper / KBPH',
  krph:   'KRPH',
  tpg:    'Mandor TPG',
  mandor: 'Mandor Sadap'
};

const ROLE_BADGE = {
  admin:  'badge-role admin',
  bkph:   'badge-role bkph',
  krph:   'badge-role krph',
  tpg:    'badge-role tpg',
  mandor: 'badge-role mandor'
};

const STATUS_PENYADAP_LABEL = { aktif: 'Aktif', tidak_aktif: 'Tidak Aktif', pindah: 'Pindah', berhenti: 'Berhenti' };
const STATUS_PENYADAP_BADGE = { aktif: 'badge-success', tidak_aktif: 'badge-inactive', pindah: 'badge-warning', berhenti: 'badge-danger' };

const STATUS_AKTIF_LABEL = { aktif: 'Aktif', nonaktif: 'Nonaktif', 'Aktif': 'Aktif', 'Tidak Aktif': 'Tidak Aktif' };
// Mendukung format lama (aktif/nonaktif) dan baru (Aktif/Tidak Aktif) untuk BKPH
const STATUS_AKTIF_BADGE = {
  aktif:        'badge-success',
  nonaktif:     'badge-inactive',
  'Aktif':      'badge-success',
  'Tidak Aktif':'badge-inactive'
};

// ─────────────────────────────────────────────────────────────
//  Expose globally
// ─────────────────────────────────────────────────────────────
window.SipenaUtils = {
  uuid,
  makeAudit,
  currentActorId,
  showToast,
  formatDate,
  today,
  paginate,
  renderPagination,
  _paginationGo,
  _paginationLimit,
  filterAndSort,
  showImportErrors,
  hideImportErrors,
  openModal,
  closeModal,
  ROWS_PER_PAGE,
  ROLE_LABELS,
  ROLE_BADGE,
  STATUS_PENYADAP_LABEL,
  STATUS_PENYADAP_BADGE,
  STATUS_AKTIF_LABEL,
  STATUS_AKTIF_BADGE
};
