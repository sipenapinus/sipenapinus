/**
 * SIPENA Lite - Main Application Manager
 * Coordinates Authentication, Session Management, RBAC Filters, User CRUD, and Audits.
 */

// Pure JS SHA-256 Implementation for non-secure contexts (HTTP)
function sha256_js(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j; 

  var result = '';
  var words = [];
  var asciiLength = ascii[lengthProperty] * 8;
  
  var hash = sha256_js.h = sha256_js.h || [];
  var k = sha256_js.k = sha256_js.k || [];
  var primeCounter = k[lengthProperty];

  var isCandidate = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isCandidate[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isCandidate[i] = 1;
      }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return; // ASCII-only check
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiLength | 0);
  
  var h = hash.slice(0);
  
  for (j = 0; j < words[lengthProperty]; ) {
    var w = words.slice(j, j += 16);
    var oldHash = h.slice(0);
    
    for (i = 0; i < 64; i++) {
      var wItem = w[i];
      if (i >= 16) {
        var s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        wItem = w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      
      var ch = (h[4] & h[5]) ^ (~h[4] & h[6]);
      var maj = (h[0] & h[1]) ^ (h[0] & h[2]) ^ (h[1] & h[2]);
      var temp1 = (h[7] + (rightRotate(h[4], 6) ^ rightRotate(h[4], 11) ^ rightRotate(h[4], 25)) + ch + k[i] + wItem) | 0;
      var temp2 = ((rightRotate(h[0], 2) ^ rightRotate(h[0], 13) ^ rightRotate(h[0], 22)) + maj) | 0;
      
      h = [ (temp1 + temp2) | 0 ].concat(h);
      h[4] = (h[4] + temp1) | 0;
      h.pop();
    }
    
    for (i = 0; i < 8; i++) {
      h[i] = (h[i] + oldHash[i]) | 0;
    }
  }
  
  for (i = 0; i < 8; i++) {
    var hex = (h[i] >>> 0).toString(16);
    while (hex[lengthProperty] < 8) hex = '0' + hex;
    result += hex;
  }
  return result;
}

// Helper to hash passwords locally using SHA-256
async function hashPassword(password) {
  if (!password) return '';
  try {
    if (window.crypto && window.crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('[hashPassword] crypto.subtle failed, falling back to pure JS hash:', e);
  }
  // Fallback to pure JS SHA-256
  return sha256_js(password);
}

// Generate client-side UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Toggle password visibility between text and password types
function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btnEl.textContent = '🙈';
  } else {
    input.type = 'password';
    btnEl.textContent = '👁️';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

class SipenaApp {
  constructor() {
    this.currentUser = null;
    this.initListeners();
  }

  /**
   * Initializes the application.
   */
  async init() {
    // 1. Initialize Database
    try {
      await window.db.init();
      console.log('Database initialized successfully.');
      
      // Seed default auth/session data if empty
      await this.seedDatabaseIfEmpty();
      
      // Seed master data (BKPH, RPH, TPG, Petak, Penyadap, Penugasan)
      if (typeof window.seedMasterData === 'function') {
        await window.seedMasterData();
      }
      
      // Data Migration: Pastikan semua user mandor/tpg memiliki scope yang benar
      await this._migrateUserScopes();
    } catch (err) {
      this.showToast('Gagal memuat database lokal: ' + err.message, 'danger');
    }

    // 2. Register Service Worker
    this.registerServiceWorker();

    // 3. Set up SPA Routing
    this.initRouting();

    // 4. Update initial network state UI
    this.updateNetworkStatus();

    // 5. Authenticate session
    await this.checkSession();
  }

  /**
   * Checks for an active user session in localStorage.
   */
  async checkSession() {
    const sessionToken = localStorage.getItem('sipena_session');
    
    if (sessionToken) {
      try {
        const sessionData = JSON.parse(sessionToken);
        // Find user in local database
        const user = await window.db.get('users', sessionData.id);
        
        if (user && user.status === 'aktif' && !user.deleted_at) {
          this.currentUser = user;
          this.showMainApp();
          return;
        }
      } catch (e) {
        console.error('Session load error', e);
      }
    }
    
    // Default to show Login page
    this.showLoginPage();
  }

  /**
   * Displays the login screen and hides the app layout.
   */
  showLoginPage() {
    this.currentUser = null;
    localStorage.removeItem('sipena_session');
    
    document.getElementById('login-container').style.display = 'flex';
    document.querySelector('.app-container').style.display = 'none';
  }

  /**
   * Displays the main layout, updates user widget, and filters links by role.
   */
  showMainApp() {
    document.getElementById('login-container').style.display = 'none';
    document.querySelector('.app-container').style.display = 'block';

    // 1. Populate sidebar user initials, name, and role description
    const initials = this.currentUser.nama_lengkap
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    
    document.getElementById('avatar-initials').innerText = initials;
    document.getElementById('profile-name').innerText = this.currentUser.nama_lengkap;
    
    let displayRole = 'Petugas';
    if (this.currentUser.role === 'admin') displayRole = 'Administrator';
    else if (this.currentUser.role === 'bkph') displayRole = 'Asper / KBPH';
    else if (this.currentUser.role === 'krph') displayRole = 'KRPH';
    else if (this.currentUser.role === 'tpg')  displayRole = 'Mandor TPG';
    else if (this.currentUser.role === 'mandor') displayRole = 'Mandor Sadap';
    
    document.getElementById('profile-role').innerText = displayRole;

    // 2. Dynamic RBAC filter on sidebar menus
    this.applyRoleRestrictions();
  }

  /**
   * Filters navigation items and section panels depending on user role scopes.
   */
  applyRoleRestrictions() {
    const role = this.currentUser.role;
    const navLinks = document.querySelectorAll('.nav-link');
    
    let defaultTab = 'dashboard';
    
    navLinks.forEach(link => {
      const tab = link.getAttribute('data-section');
      let visible = true;

      if (role === 'bkph') {
        // Asper: Dashboard, Target & RO, Realisasi (view-only), Pengaturan (No Data Master)
        if (tab === 'master') visible = false;
      } else if (role === 'krph') {
        // KRPH: Dashboard, Target & RO, Realisasi (view-only), Pengaturan (No Data Master)
        if (tab === 'master') visible = false;
      } else if (role === 'tpg') {
        // Mandor TPG: Dashboard + Realisasi Produksi (write) + Target & RO + Data Master + Pengaturan
        defaultTab = 'dashboard';
      } else if (role === 'mandor') {
        // Mandor Sadap: Dashboard + Target & RO + Realisasi (view-only) + Data Master + Pengaturan
        defaultTab = 'dashboard';
      }

      link.parentElement.style.display = visible ? 'block' : 'none';
    });

    // Filter master tab sub-buttons based on role
    // Hanya filter tombol yang punya data-tab (sub-tab Data Master)
    // Tombol tanpa data-tab (seperti "Target Tahunan" dan "RO") tidak difilter
    const masterTabBtns = document.querySelectorAll('.master-tab');
    masterTabBtns.forEach(btn => {
      const sub = btn.getAttribute('data-tab');
      let btnVisible = true;
      if ((role === 'mandor' || role === 'tpg') && sub) {
        // Hanya sembunyikan sub-tab Data Master yang bukan Penyadap/Penugasan
        if (sub !== 'penyadap' && sub !== 'penugasan') btnVisible = false;
      }
      btn.style.display = btnVisible ? 'inline-flex' : 'none';
    });

    // 3. Load default tab
    const activeLink = document.querySelector(`.nav-link[data-section="${defaultTab}"]`);
    if (activeLink) activeLink.click();

    // 4. Hide/Show Admin specific user panels in Settings
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
      adminPanel.style.display = (role === 'admin') ? 'block' : 'none';
    }
  }

  /**
   * Handles local authentication submission.
   */
  async handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim().toLowerCase();
    const passwordInput = document.getElementById('login-password').value;

    try {
      const users = await window.db.getAll('users');
      const user = users.find(u => u.username === usernameInput && !u.deleted_at);

      if (!user) {
        this.showToast('Username tidak ditemukan!', 'danger');
        return;
      }

      if (user.status !== 'aktif') {
        this.showToast('Akun Anda dinonaktifkan!', 'danger');
        return;
      }

      // Hash password input and compare
      const hashedInput = await hashPassword(passwordInput);
      if (user.password_hash !== hashedInput) {
        this.showToast('Password salah!', 'danger');
        return;
      }

      // Successful login
      this.currentUser = user;
      localStorage.setItem('sipena_session', JSON.stringify({ id: user.id, username: user.username }));
      
      this.showToast(`Selamat datang, ${user.nama_lengkap}!`, 'success');
      this.showMainApp();
      
      // Clear login inputs
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
    } catch (err) {
      this.showToast('Gagal memproses login: ' + err.message, 'danger');
    }
  }

  /**
   * Destroys the active session and redirects to login overlay.
   */
  handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar dari aplikasi?')) {
      this.showLoginPage();
      this.showToast('Sesi Anda telah berakhir.', 'success');
    }
  }

  /**
   * Helper to return standard audit columns based on user context.
   */
  getAuditTrail(originalItem = null) {
    const now = new Date().toISOString();
    const actorId = this.currentUser ? this.currentUser.id : 'system-seed';

    if (!originalItem) {
      return {
        created_at: now,
        updated_at: now,
        created_by: actorId,
        updated_by: actorId,
        deleted_at: null
      };
    }

    return {
      created_at: originalItem.created_at || now,
      updated_at: now,
      created_by: originalItem.created_by || actorId,
      updated_by: actorId,
      deleted_at: originalItem.deleted_at || null
    };
  }

  /**
   * Data migration: pastikan user mandor/tpg bawaan (usr-mandor, usr-tpg) memiliki scope.
   * Dijalankan setiap init tapi operasinya idempotent (tidak merusak data yang sudah ada).
   */
  async _migrateUserScopes() {
    try {
      // Patch usr-mandor (Mardi) → scope: tpg-01
      const mandorUser = await window.db.get('users', 'usr-mandor');
      if (mandorUser && !mandorUser.scope) {
        mandorUser.scope = 'tpg-01';
        mandorUser.nama_lengkap = mandorUser.nama_lengkap || 'Mardi';
        await window.db.put('users', mandorUser);
        console.log('[Migration] Set scope tpg-01 for usr-mandor');
      }
      // Patch usr-tpg (Mardi TPG) → scope: tpg-01 jika ada
      const tpgUser = await window.db.get('users', 'usr-tpg');
      if (tpgUser && !tpgUser.scope) {
        tpgUser.scope = 'tpg-01';
        await window.db.put('users', tpgUser);
        console.log('[Migration] Set scope tpg-01 for usr-tpg');
      }
    } catch (e) {
      console.warn('[Migration] _migrateUserScopes skipped:', e.message);
    }
  }

  /**
   * Seeds default tables with mock data and hashed credentials.
   */
  async seedDatabaseIfEmpty() {
    const existingUsers = await window.db.getAll('users');
    if (existingUsers.length > 0) return;

    console.log('[Seeding] Initializing database seeds from seed-data.js...');

    if (window.SIPENA_SEED_DATA) {
      const stores = [
        'meta', 'users', 'bkph', 'rph', 'tpg', 'petak', 'anak_petak',
        'penyadap_master', 'penugasan', 'ro', 'realisasi', 'kehadiran',
        'monitoring', 'areal_sadap', 'penyadap'
      ];
      for (const store of stores) {
        const items = window.SIPENA_SEED_DATA[store];
        if (Array.isArray(items) && items.length > 0) {
          await window.db.putMany(store, items);
        }
      }
      console.log('[Seeding] Done seeding database from custom seed-data.js.');
    } else {
      console.warn('[Seeding] Warning: window.SIPENA_SEED_DATA not found. Seeding fallback admin user...');
      const hashAdmin = await hashPassword('admin123');
      const auditBase = {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system-seed',
        updated_by: 'system-seed',
        deleted_at: null
      };
      const adminUser = { id: 'usr-admin', username: 'admin', password_hash: hashAdmin, role: 'admin', nama_lengkap: 'Budi Santoso', nip: '198104122005011002', scope: null, status: 'aktif', ...auditBase };
      await window.db.put('users', adminUser);
      console.log('[Seeding] Created fallback admin user.');
    }

    // Ensure metadata
    const hasMetaLastSync = await window.db.get('meta', 'last_sync');
    if (!hasMetaLastSync) await window.db.put('meta', { key: 'last_sync', value: Date.now() });
    const hasMetaAppVersion = await window.db.get('meta', 'app_version');
    if (!hasMetaAppVersion) await window.db.put('meta', { key: 'app_version', value: '1.0.0' });
  }

  // --- ADMINISTRATOR USER CRUD FUNCTIONS (Moved to MasterUser) ---
  async loadUsers() {}
  openAddUserModal() {}
  async openEditUserModal(id) {}
  closeUserModal() {}
  handleRoleChange(selectedValue = '') {}
  async handleSaveUser(e) {}
  async handleDeleteUser(id) {}
  // --- End Admin Users section ---

  /**
   * Registers the Service Worker.
   */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => console.log('Service Worker registered with scope:', reg.scope))
          .catch(err => console.error('Service Worker registration failed:', err));
      });
    }
  }

  /**
   * Binds global window event listeners.
   */
  initListeners() {
    window.addEventListener('online', () => this.updateNetworkStatus());
    window.addEventListener('offline', () => this.updateNetworkStatus());

    // Mobile sidebar toggle
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.app-sidebar');
      const toggleBtn = e.target.closest('.mobile-menu-btn');
      
      if (toggleBtn) {
        sidebar.classList.toggle('active');
      } else if (sidebar && sidebar.classList.contains('active') && !e.target.closest('.app-sidebar')) {
        sidebar.classList.remove('active');
      }
    });
  }

  /**
   * Updates network indicator badge depending on browser state.
   */
  updateNetworkStatus() {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;

    if (navigator.onLine) {
      indicator.className = 'sync-indicator online';
      indicator.innerHTML = '<span class="dot blink"></span> Online (Tersinkron)';
      this.triggerBackgroundSync();
    } else {
      indicator.className = 'sync-indicator offline';
      indicator.innerHTML = '<span class="dot"></span> Offline Mode';
    }
  }

  /**
   * Simulated synchronization of offline queues.
   */
  async triggerBackgroundSync() {
    const queue = await window.db.getSyncQueue();
    if (queue.length === 0) return;

    console.log(`[Sync] Found ${queue.length} items to sync...`);
    this.showToast(`Menyinkronkan ${queue.length} perubahan lokal ke server...`, 'warning');

    // Simulate sending changes to server API
    for (const item of queue) {
      try {
        await new Promise(r => setTimeout(r, 400)); // simulate server lag
        await window.db.dequeueSync(item.id);
      } catch (err) {
        console.error('[Sync] Error syncing item ID:', item.id, err);
      }
    }
    
    this.showToast('Sinkronisasi data selesai!', 'success');
    this.loadDashboardData();
  }

  /**
   * Basic SPA Router to toggle visibility of main screen sections.
   */
  initRouting() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSectionId = link.getAttribute('data-section');

        // Toggle active menu
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Toggle visibility
        sections.forEach(sec => {
          if (sec.id === `${targetSectionId}-section`) {
            sec.classList.add('active');
          } else {
            sec.classList.remove('active');
          }
        });

        // Close sidebar if mobile view
        document.querySelector('.app-sidebar').classList.remove('active');

        // Load specific data on demand depending on what section is activated
        if (targetSectionId === 'dashboard') {
          this.loadDashboardData();
        } else if (targetSectionId === 'master') {
          // Delegate to master module — default based on role
          const role = this.currentUser ? this.currentUser.role : '';
          const defaultSub = (role === 'mandor' || role === 'tpg') ? 'penyadap' : 'bkph';
          if (window.switchMasterTab) switchMasterTab(defaultSub);
        } else if (targetSectionId === 'target-ro') {
          if (window.TargetModule) {
            const btnTarget = document.getElementById('btn-subtab-target');
            const btnRo = document.getElementById('btn-subtab-ro');
            if (btnTarget && btnRo) {
              document.getElementById('target-sub-section').style.display = 'block';
              document.getElementById('ro-sub-section').style.display = 'none';
              btnTarget.classList.add('active');
              btnTarget.classList.remove('btn-secondary');
              btnTarget.classList.add('btn-primary');
              btnRo.classList.remove('active');
              btnRo.classList.add('btn-secondary');
              btnRo.classList.remove('btn-primary');
            }
            window.TargetModule.init();
          } else {
            this.loadTargetROData();
          }
        } else if (targetSectionId === 'realisasi') {
          this.loadRealisasiData();
        } else if (targetSectionId === 'laporan') {
          if (window.LaporanModule) window.LaporanModule.init();
        } else if (targetSectionId === 'panduan') {
          this.switchPanduanTab('guide');
        } else if (targetSectionId === 'pengaturan') {
          if (this.currentUser && this.currentUser.role === 'admin') {
            this.loadUsers();
          }
        }
      });
    });
  }

  /**
   * Helper to display a beautiful self-expiring notification toast.
   */
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Page Data Loaders ---

  async loadDashboardData() {
    console.log('Loading Dashboard Data...');
    
    // Inisialisasi Modul Dashboard Hierarki
    if (window.DashboardModule) {
      await window.DashboardModule.init();
    }

    // Load Progres Kelengkapan Target Tahunan di bagian bawah dashboard
    if (window.TargetModule) {
      try {
        const kel = await window.TargetModule.getTargetKelengkapan(2026);
        const elBkph = document.getElementById('dash-target-bkph');
        const elRph = document.getElementById('dash-target-rph');
        const elTpg = document.getElementById('dash-target-tpg');
        const elMdr = document.getElementById('dash-target-mandor');
        const elPnd = document.getElementById('dash-target-penyadap');

        if (elBkph) {
          elBkph.innerText = kel.bkph;
          elBkph.style.color = kel.bkph.includes('✔') ? 'var(--primary)' : 'var(--warning)';
        }
        if (elRph) {
          elRph.innerText = kel.rph;
          elRph.style.color = kel.rph.includes('✔') ? 'var(--primary)' : (kel.rph.includes('🔴') ? 'var(--danger)' : 'var(--warning)');
        }
        if (elTpg) {
          elTpg.innerText = kel.tpg;
          elTpg.style.color = kel.tpg.includes('✔') ? 'var(--primary)' : (kel.tpg.includes('🔴') ? 'var(--danger)' : 'var(--warning)');
        }
        if (elMdr) {
          elMdr.innerText = kel.mandor;
          elMdr.style.color = kel.mandor.includes('✔') ? 'var(--primary)' : (kel.mandor.includes('🔴') ? 'var(--danger)' : 'var(--warning)');
        }
        if (elPnd) {
          elPnd.innerText = kel.penyadap;
          elPnd.style.color = kel.penyadap.includes('100%') ? 'var(--primary)' : 'var(--warning)';
        }
      } catch (err) {
        console.error('Error loading target status on dashboard', err);
      }
    }
  }

  async loadMasterData() {
    console.log('Loading Master Data...');
    const penyadap = await window.db.getAll('penyadap');
    const areas = await window.db.getAll('areal_sadap');

    const tableBody = document.getElementById('master-table-body');
    if (!tableBody) return;

    if (penyadap.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Data penyadap kosong</td></tr>`;
      return;
    }

    tableBody.innerHTML = '';
    penyadap.forEach((pnd) => {
      const area = areas.find(a => a.id === pnd.areal_id);
      const areaName = area ? area.name : 'Belum ditugaskan';
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${pnd.id.toUpperCase()}</strong></td>
        <td>${pnd.name}</td>
        <td>${areaName}</td>
        <td><span class="badge ${pnd.active ? 'badge-success' : 'badge-danger'}">${pnd.active ? 'Aktif' : 'Nonaktif'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="app.editPenyadap('${pnd.id}')">Edit</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  async loadTargetROData() {
    console.log('Loading Target & RO Data...');
    const user = this.currentUser;
    const role = user ? user.role : '';
    const scopeTpgId = user ? user.scope : '';

    // Langsung atur visibilitas tombol "+ Susun RO Baru" sebelum query DB
    // Mandor Sadap, Mandor TPG, dan Admin berwenang input RO
    const addRoBtn = document.getElementById('btn-add-ro');
    if (addRoBtn) {
      const hasWrite = (role === 'admin' || role === 'mandor' || role === 'tpg');
      addRoBtn.style.display = hasWrite ? 'inline-flex' : 'none';
    }

    const ros = await window.db.getAllActive('ro');
    const allPnd = await window.db.getAllActive('penyadap_master');
    const allAP = await window.db.getAllActive('anak_petak');
    const allPetak = await window.db.getAllActive('petak');

    const tableBody = document.getElementById('ro-table-body');
    if (!tableBody) return;

    // Filter ROs based on Mandor's assigned TPG
    let filteredROs = ros;
    if (role === 'mandor' || role === 'tpg') {
      if (scopeTpgId) {
        // Hanya tampilkan RO yang anak petaknya di bawah TPG mandor
        const apIds = allAP.filter(ap => ap.tpg_id === scopeTpgId).map(ap => ap.id);
        filteredROs = ros.filter(ro => apIds.includes(ro.areal_id));
      }
    }

    if (filteredROs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Rencana Operasional kosong</td></tr>`;
      return;
    }

    // Sort by tahun descending, bulan descending, periode descending
    filteredROs.sort((a, b) => b.tahun - a.tahun || b.bulan - a.bulan || b.periode - a.periode);

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    tableBody.innerHTML = '';
    filteredROs.forEach((ro) => {
      const pnd = allPnd.find(p => p.id === ro.penyadap_id);
      const ap = allAP.find(a => a.id === ro.areal_id);
      const petak = ap ? allPetak.find(p => p.id === ap.petak_id) : null;
      
      const petakLabel = ap && petak ? `Petak ${petak.nomor}${ap.huruf}` : 'Unknown';
      const monthLabel = monthNames[ro.bulan - 1] || ro.bulan;

      const row = document.createElement('tr');
      
      // Control edit/delete actions
      const canEdit = (role === 'admin' || role === 'mandor' || role === 'tpg');
      const actionHtml = canEdit ? `
        <div class="action-btns">
          <button class="btn btn-secondary btn-xs" onclick="TargetModule.openEditRO('${ro.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-xs" onclick="TargetModule.confirmDeleteRO('${ro.id}')">🗑️</button>
        </div>
      ` : `<span class="text-muted-sm">—</span>`;

      row.innerHTML = `
        <td><strong>${monthLabel} ${ro.tahun} - Periode ${ro.periode}</strong></td>
        <td><strong>${pnd ? pnd.nama : 'Unknown'}</strong><div class="text-muted-sm">No: ${pnd ? pnd.nomor : '—'}</div></td>
        <td>${petakLabel}</td>
        <td><strong>${ro.kesanggupan.toLocaleString('id-ID')} kg</strong></td>
        <td><span class="badge badge-success">${ro.status.toUpperCase()}</span></td>
        <td>
          <span class="badge ${ro.sync_status === 'synced' ? 'badge-success' : 'badge-warning'}">
            ${ro.sync_status === 'synced' ? 'Tersinkron' : 'Lokal'}
          </span>
        </td>
        <td>${actionHtml}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  async loadRealisasiData() {
    console.log('Loading Realisasi Data via RealisasiModule...');
    if (window.RealisasiModule) {
      await window.RealisasiModule.render();
    }
  }

  editPenyadap(id) {
    this.showToast(`Mengedit penyadap ${id} (Modul berikutnya)`, 'warning');
  }

  /**
   * Backs up the entire IndexedDB database into a single JSON file.
   */
  async backupDatabase() {
    try {
      this.showToast('Memulai pencadangan data...', 'info');
      
      const stores = [
        'meta', 'users', 'bkph', 'rph', 'tpg', 'petak', 'anak_petak',
        'penyadap_master', 'penugasan', 'ro', 'realisasi', 'kehadiran',
        'monitoring'
      ];
      
      const backupData = {};
      
      for (const store of stores) {
        backupData[store] = await window.db.getAll(store);
      }
      
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_sipena_lite_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showToast('Cadangan database berhasil diunduh!', 'success');
    } catch (err) {
      console.error('[Backup Error]', err);
      this.showToast('Gagal mencadangkan data: ' + err.message, 'danger');
    }
  }

  /**
   * Restores the database from a single JSON backup file.
   */
  async restoreDatabase(file) {
    if (!file) return;
    
    if (!confirm('Apakah Anda yakin ingin memulihkan seluruh data dari file ini?\nSemua data lokal Anda saat ini akan dihapus dan digantikan oleh isi file cadangan.')) {
      return;
    }
    
    try {
      this.showToast('Membaca file cadangan...', 'info');
      
      const text = await file.text();
      const backupData = JSON.parse(text);
      
      // Basic validation: check if it has the required stores as keys
      const requiredStores = ['users', 'rph', 'tpg', 'petak'];
      const isValid = requiredStores.every(store => Array.isArray(backupData[store]));
      
      if (!isValid) {
        throw new Error('Format file cadangan tidak valid atau data tidak lengkap.');
      }
      
      this.showToast('Membersihkan database lama...', 'info');
      
      const stores = [
        'meta', 'users', 'bkph', 'rph', 'tpg', 'petak', 'anak_petak',
        'penyadap_master', 'penugasan', 'ro', 'realisasi', 'kehadiran',
        'monitoring'
      ];
      
      for (const store of stores) {
        await window.db.clearStore(store);
      }
      
      this.showToast('Menulis data cadangan...', 'info');
      
      for (const store of Object.keys(backupData)) {
        if (stores.includes(store) && Array.isArray(backupData[store])) {
          if (backupData[store].length > 0) {
            await window.db.putMany(store, backupData[store]);
          }
        }
      }
      
      localStorage.setItem('sipena_skip_seed', '1');
      
      alert('Pemulihan database berhasil! Aplikasi akan memuat ulang.');
      location.reload();
    } catch (err) {
      console.error('[Restore Error]', err);
      this.showToast('Gagal memulihkan database: ' + err.message, 'danger');
    }
  }

  /**
   * Switch between sub-tabs in Panduan & Tentang page
   */
  switchPanduanTab(tab) {
    const btnGuide = document.getElementById('btn-panduan-guide');
    const btnAbout = document.getElementById('btn-panduan-about');
    const tabGuide = document.getElementById('panduan-tab-guide');
    const tabAbout = document.getElementById('panduan-tab-about');

    if (!btnGuide || !btnAbout || !tabGuide || !tabAbout) return;

    if (tab === 'guide') {
      btnGuide.classList.add('active');
      btnAbout.classList.remove('active');
      tabGuide.classList.add('active');
      tabAbout.classList.remove('active');
    } else {
      btnGuide.classList.remove('active');
      btnAbout.classList.add('active');
      tabGuide.classList.remove('active');
      tabAbout.classList.add('active');
    }
  }

  /**
   * Toggle accordion items in Panduan page
   */
  togglePanduanAccordion(id) {
    const item = document.getElementById(id);
    if (!item) return;

    const isOpen = item.classList.contains('open');
    
    // Close other items
    document.querySelectorAll('.panduan-item').forEach(el => {
      el.classList.remove('open');
    });

    if (!isOpen) {
      item.classList.add('open');
    }
  }
}

// Instantiate globally
window.app = new SipenaApp();
window.addEventListener('DOMContentLoaded', () => window.app.init());
