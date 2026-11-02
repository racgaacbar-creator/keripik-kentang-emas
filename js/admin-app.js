// ============================================================
// admin-app.js — Main Admin Application Controller
// Handles: Auth Guard, Navigation, Global UI, Dashboard Stats
// ============================================================
import { auth, db, rtdb } from './firebase-config.js';
import {
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc, getDoc, collection, query, where,
    orderBy, limit, getDocs, onSnapshot,
    getCountFromServer, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    ref as rtRef, set as rtSet, onValue,
    onDisconnect, serverTimestamp as rtServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Import Sub-modules ──
import { initProducts, loadProducts } from './admin-products.js';
import { initStock, loadStock } from './admin-stock.js';
import { initUsers, loadUsers } from './admin-users.js';
import { initLogs, loadLogs } from './admin-logs.js';
import { initContact, loadContact } from './admin-contact.js';

// ── State ──
let currentAdmin = null;
let currentSection = 'dashboard';
const MIN_STOCK = 10;

// ── Global helpers (accessible from HTML inline handlers) ──
window.navigateTo = navigateTo;
window.closeModal = closeModal;
window.showToast = showToast;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupTopbar();
    setupNavigation();
    setupLogout();
    initProducts();
    initStock();
    initUsers();
    initLogs();
    initContact();

    // Auth Guard
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') {
            await signOut(auth);
            window.location.href = 'login.html';
            return;
        }
        currentAdmin = { uid: user.uid, ...userDoc.data(), email: user.email };
        setupAdminProfile(currentAdmin);
        setupPresence(user.uid);
        await recordLoginLog(user);
        loadDashboard();
    });
});

// ============================================================
// ADMIN PROFILE UI
// ============================================================
function setupAdminProfile(admin) {
    const initial = (admin.nama || admin.email || 'A')[0].toUpperCase();
    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileAvatarLg').textContent = initial;
    document.getElementById('profileName').textContent = admin.nama || 'Admin';
    document.getElementById('pdName').textContent = admin.nama || 'Admin';
    document.getElementById('pdEmail').textContent = admin.email || '';
}

// ============================================================
// FIREBASE PRESENCE (Realtime Database)
// ============================================================
function setupPresence(uid) {
    const presenceRef = rtRef(rtdb, `presence/${uid}`);
    const connectedRef = rtRef(rtdb, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            rtSet(presenceRef, { status: 'online', lastSeen: rtServerTimestamp() });
            onDisconnect(presenceRef).set({ status: 'offline', lastSeen: rtServerTimestamp() });
        }
    });
}

// ============================================================
// LOGIN LOG RECORDING
// ============================================================
async function recordLoginLog(user) {
    try {
        const { addDoc, collection: col, serverTimestamp } =
            await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const nama = userDoc.exists() ? userDoc.data().nama : user.email;
        // Only record once per session (check sessionStorage)
        if (!sessionStorage.getItem('loginLogged')) {
            await addDoc(col(db, 'loginLogs'), {
                uid: user.uid, email: user.email,
                nama: nama || user.email,
                loginAt: serverTimestamp(),
                eventType: 'login'
            });
            sessionStorage.setItem('loginLogged', '1');
        }
    } catch (e) { /* silent */ }
}

// ============================================================
// SIDEBAR
// ============================================================
function setupSidebar() {
    const hamburger = document.getElementById('hamburgerBtn');
    const closeBtn = document.getElementById('sidebarCloseBtn');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    const openSidebar = () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    };
    const closeSidebar = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    };

    hamburger?.addEventListener('click', openSidebar);
    closeBtn?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);
}

// ============================================================
// TOPBAR DROPDOWNS
// ============================================================
function setupTopbar() {
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');

    profileBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('open');
        notifDropdown?.classList.remove('open');
    });
    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown?.classList.toggle('open');
        profileDropdown?.classList.remove('open');
    });
    document.addEventListener('click', () => {
        profileDropdown?.classList.remove('open');
        notifDropdown?.classList.remove('open');
    });
}

// ============================================================
// NAVIGATION
// ============================================================
const sectionTitles = {
    'dashboard': 'Dashboard',
    'products': 'Daftar Produk',
    'add-product': 'Tambah Produk',
    'stock': 'Manajemen Stok',
    'users': 'Manajemen Pengguna',
    'login-logs': 'Riwayat Login',
    'contact': 'Pengaturan Kontak',
    'store-settings': 'Pengaturan Toko',
};

function setupNavigation() {
    document.querySelectorAll('.nav-item[data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.section);
            // Close mobile sidebar
            document.getElementById('sidebar')?.classList.remove('open');
            document.getElementById('sidebarOverlay')?.classList.remove('show');
        });
    });
}

function navigateTo(section) {
    if (currentSection === section && section !== 'add-product') return;
    currentSection = section;

    // Hide all sections
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    // Show target
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');

    // Update breadcrumb
    document.getElementById('breadcrumbCurrent').textContent = sectionTitles[section] || section;

    // Load section data
    loadSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadSection(section) {
    switch (section) {
        case 'dashboard': loadDashboard(); break;
        case 'products': loadProducts(); break;
        case 'add-product': window.prepareProductForm?.('add'); break;
        case 'stock': loadStock(); break;
        case 'users': loadUsers(); break;
        case 'login-logs': loadLogs(); break;
        case 'contact': loadContact(); break;
        case 'store-settings': loadStoreSettings(); break;
    }
}

// ============================================================
// LOGOUT
// ============================================================
function setupLogout() {
    const doLogout = async () => {
        try {
            if (currentAdmin?.uid) {
                const { addDoc, collection: col, serverTimestamp } =
                    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                await addDoc(col(db, 'loginLogs'), {
                    uid: currentAdmin.uid, email: currentAdmin.email,
                    nama: currentAdmin.nama || currentAdmin.email,
                    loginAt: serverTimestamp(), eventType: 'logout'
                });
                // Update presence
                const presenceRef = rtRef(rtdb, `presence/${currentAdmin.uid}`);
                await rtSet(presenceRef, { status: 'offline', lastSeen: rtServerTimestamp() });
            }
            sessionStorage.removeItem('loginLogged');
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (e) {
            showToast('Gagal logout: ' + e.message, 'error');
        }
    };
    document.getElementById('btnLogout')?.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
    document.getElementById('btnLogout2')?.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
    loadDashboardStats();
    loadRecentProducts();
    loadLowStockWarning();
    loadRecentActivity();
}

async function loadDashboardStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTs = Timestamp.fromDate(today);

        // Products
        const prodSnap = await getDocs(collection(db, 'products'));
        let totalProduk = 0, totalStok = 0, stokMenipis = 0, totalVarian = 0;
        prodSnap.forEach(d => {
            totalProduk++;
            const data = d.data();
            if (data.variants) {
                data.variants.forEach(v => {
                    totalStok += (v.stok || 0);
                    totalVarian++;
                    if ((v.stok || 0) > 0 && (v.stok || 0) <= MIN_STOCK) stokMenipis++;
                });
            }
        });

        // Users
        const usersSnap = await getDocs(collection(db, 'users'));
        let totalUsers = 0, newToday = 0;
        usersSnap.forEach(d => {
            totalUsers++;
            const data = d.data();
            if (data.createdAt && data.createdAt.toDate() >= today) newToday++;
        });

        // Online users (Realtime DB)
        const presRef = rtRef(rtdb, 'presence');
        onValue(presRef, (snap) => {
            let online = 0;
            snap.forEach(child => { if (child.val().status === 'online') online++; });
            document.getElementById('statOnlineUsers').textContent = online;
        }, { onlyOnce: false });

        // Login today
        const loginQ = query(collection(db, 'loginLogs'),
            where('loginAt', '>=', todayTs),
            where('eventType', '==', 'login'));
        const loginSnap = await getDocs(loginQ);

        // Update UI
        document.getElementById('statTotalProduk').textContent = totalProduk;
        document.getElementById('statTotalStok').textContent = totalStok.toLocaleString('id-ID');
        document.getElementById('statStokMenipis').textContent = stokMenipis;
        document.getElementById('statVarian').textContent = totalVarian;
        document.getElementById('statTotalUsers').textContent = totalUsers;
        document.getElementById('statNewUsers').textContent = newToday;
        document.getElementById('statLoginToday').textContent = loginSnap.size;

    } catch (e) {
        console.error('Dashboard stats error:', e);
    }
}

async function loadRecentProducts() {
    const container = document.getElementById('recentProductsList');
    try {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        if (snap.empty) {
            container.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-light);font-size:.85rem">Belum ada produk</p>';
            return;
        }
        container.innerHTML = '';
        snap.forEach(d => {
            const p = d.data();
            const minHarga = p.variants?.length ? Math.min(...p.variants.map(v => v.harga || 0)) : 0;
            container.innerHTML += `
            <div class="item-list-row">
                <img src="${p.imageUrl || 'https://via.placeholder.com/44x44?text=P'}" 
                     class="item-list-img" alt="${p.name}" onerror="this.src='https://via.placeholder.com/44x44?text=P'">
                <div class="item-list-info">
                    <div class="item-list-name">${p.name}</div>
                    <div class="item-list-sub">${p.sku || '—'} • ${p.variants?.length || 0} varian</div>
                </div>
                <div class="item-list-value">${formatRupiah(minHarga)}</div>
            </div>`;
        });
    } catch (e) {
        container.innerHTML = '<p style="padding:16px;color:var(--text-light);font-size:.85rem">Gagal memuat produk</p>';
    }
}

async function loadLowStockWarning() {
    const container = document.getElementById('lowStockList');
    try {
        const snap = await getDocs(collection(db, 'products'));
        let warnings = [];
        snap.forEach(d => {
            const p = d.data();
            if (p.variants) {
                p.variants.forEach(v => {
                    if ((v.stok || 0) <= MIN_STOCK) {
                        warnings.push({ productName: p.name, varian: v.rasa, stok: v.stok || 0 });
                    }
                });
            }
        });
        if (!warnings.length) {
            container.innerHTML = '<div class="item-list-row"><span style="color:var(--green);font-size:.85rem">✅ Semua stok aman</span></div>';
            return;
        }
        container.innerHTML = '';
        warnings.slice(0, 5).forEach(w => {
            const color = w.stok === 0 ? 'var(--red)' : 'var(--orange)';
            container.innerHTML += `
            <div class="item-list-row">
                <div class="item-list-info">
                    <div class="item-list-name">${w.productName}</div>
                    <div class="item-list-sub">${w.varian}</div>
                </div>
                <span class="badge ${w.stok === 0 ? 'badge-red' : 'badge-orange'}">${w.stok === 0 ? 'Habis' : w.stok + ' unit'}</span>
            </div>`;
        });
    } catch (e) {
        container.innerHTML = '<p style="padding:16px;color:var(--text-light);font-size:.85rem">Gagal memuat data</p>';
    }
}

async function loadRecentActivity() {
    const container = document.getElementById('recentActivityList');
    try {
        const q = query(collection(db, 'loginLogs'), orderBy('loginAt', 'desc'), limit(8));
        const snap = await getDocs(q);
        if (snap.empty) {
            container.innerHTML = '<p style="padding:16px;color:var(--text-light);font-size:.85rem">Belum ada aktivitas</p>';
            return;
        }
        container.innerHTML = '';
        snap.forEach(d => {
            const log = d.data();
            const isLogin = log.eventType === 'login';
            const time = log.loginAt?.toDate ? formatRelative(log.loginAt.toDate()) : '—';
            container.innerHTML += `
            <div class="activity-row">
                <div class="activity-dot ${isLogin ? '' : 'out'}"></div>
                <div class="activity-info">
                    <p class="activity-name">${log.nama || log.email} — ${isLogin ? 'Login' : 'Logout'}</p>
                    <p class="activity-time">${time}</p>
                </div>
            </div>`;
        });
    } catch (e) {
        container.innerHTML = '<p style="padding:16px;color:var(--text-light);font-size:.85rem">Gagal memuat aktivitas</p>';
    }
}

// ============================================================
// STORE SETTINGS
// ============================================================
async function loadStoreSettings() {
    try {
        const snap = await getDoc(doc(db, 'storeSettings', 'general'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('setNamaToko').value = d.namaToko || '';
            document.getElementById('setTagline').value = d.tagline || '';
            document.getElementById('setMinStok').value = d.minStok || 10;
            document.getElementById('setStatusToko').value = d.statusToko || 'open';
        }
    } catch (e) { /* skip */ }

    document.getElementById('storeSettingsForm').onsubmit = async (e) => {
        e.preventDefault();
        try {
            const { setDoc, serverTimestamp } =
                await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
            await setDoc(doc(db, 'storeSettings', 'general'), {
                namaToko: document.getElementById('setNamaToko').value,
                tagline: document.getElementById('setTagline').value,
                minStok: parseInt(document.getElementById('setMinStok').value) || 10,
                statusToko: document.getElementById('setStatusToko').value,
                updatedAt: serverTimestamp()
            });
            showToast('Pengaturan toko berhasil disimpan', 'success');
        } catch (err) {
            showToast('Gagal menyimpan: ' + err.message, 'error');
        }
    };
}

// ============================================================
// MODAL HELPERS
// ============================================================
function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

function openModal(id) {
    document.getElementById(id)?.classList.add('open');
}
window.openModal = openModal;

// Close modal on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
    });
});

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'circle-check', error: 'circle-xmark', warning: 'triangle-exclamation', info: 'circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid fa-${icons[type] || 'circle-info'}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastIn .3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================
// LOADING OVERLAY
// ============================================================
window.showLoading = (text = 'Memuat...') => {
    const el = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text;
    el.style.display = 'flex';
};
window.hideLoading = () => {
    document.getElementById('loadingOverlay').style.display = 'none';
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
window.formatRupiah = function(angka) {
    return 'Rp ' + (angka || 0).toLocaleString('id-ID');
};

window.formatDate = function(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

window.formatDateTime = function(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

function formatRelative(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    return Math.floor(diff / 86400) + ' hari lalu';
}

window.createPagination = function(container, total, page, perPage, onPage) {
    const totalPages = Math.ceil(total / perPage);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const prev = document.createElement('button');
    prev.className = 'page-btn'; prev.innerHTML = '‹';
    prev.disabled = page === 1;
    prev.onclick = () => onPage(page - 1);
    container.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === page ? ' active' : '');
        btn.textContent = i;
        btn.onclick = () => onPage(i);
        container.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn'; next.innerHTML = '›';
    next.disabled = page === totalPages;
    next.onclick = () => onPage(page + 1);
    container.appendChild(next);
};
