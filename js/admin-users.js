// ============================================================
// admin-users.js — User Management Module
// ============================================================
import { db, rtdb } from './firebase-config.js';
import {
    collection, doc, getDocs, updateDoc,
    query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    ref as rtRef, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let allUsers = [];
let filteredUsers = [];
let onlineStatuses = {};
let currentPage = 1;
const PER_PAGE = 15;

// ============================================================
// INIT
// ============================================================
export function initUsers() {
    setupUserFilters();
    listenPresence();
}

function listenPresence() {
    const presRef = rtRef(rtdb, 'presence');
    onValue(presRef, (snap) => {
        onlineStatuses = {};
        snap.forEach(child => {
            onlineStatuses[child.key] = child.val().status;
        });
        // Re-render if users table is visible
        if (document.getElementById('section-users')?.classList.contains('active')) {
            renderUsersTable();
        }
    });
}

// ============================================================
// LOAD USERS
// ============================================================
export async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-light)"><i class="fa-solid fa-spinner fa-spin"></i> Memuat pengguna...</td></tr>';

    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        allUsers = [];
        snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        applyUserFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--red)">Gagal memuat: ${e.message}</td></tr>`;
    }
}

function setupUserFilters() {
    ['userSearch', 'filterUserStatus', 'filterOnline', 'sortUsers'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            currentPage = 1; applyUserFilters();
        });
    });
}

function applyUserFilters() {
    const search = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const filterStatus = document.getElementById('filterUserStatus')?.value || '';
    const filterOnline = document.getElementById('filterOnline')?.value || '';
    const sort = document.getElementById('sortUsers')?.value || 'newest';

    filteredUsers = allUsers.filter(u => {
        const matchSearch = !search ||
            u.nama?.toLowerCase().includes(search) ||
            u.email?.toLowerCase().includes(search) ||
            u.id?.toLowerCase().includes(search);
        const matchStatus = !filterStatus ||
            (filterStatus === 'active' && u.isActive !== false) ||
            (filterStatus === 'inactive' && u.isActive === false);
        const isOnline = onlineStatuses[u.id] === 'online';
        const matchOnline = !filterOnline ||
            (filterOnline === 'online' && isOnline) ||
            (filterOnline === 'offline' && !isOnline);
        return matchSearch && matchStatus && matchOnline;
    });

    filteredUsers.sort((a, b) => {
        if (sort === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        if (sort === 'lastLogin') return (b.lastLoginAt?.seconds || 0) - (a.lastLoginAt?.seconds || 0);
        if (sort === 'name') return (a.nama || '').localeCompare(b.nama || '');
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

    renderUsersTable();
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const emptyEl = document.getElementById('usersEmpty');
    const countEl = document.getElementById('usersCountText');
    const paginEl = document.getElementById('usersPagination');

    if (!filteredUsers.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        countEl.textContent = '0 pengguna';
        if (paginEl) paginEl.innerHTML = '';
        return;
    }
    emptyEl.style.display = 'none';

    const start = (currentPage - 1) * PER_PAGE;
    const pageData = filteredUsers.slice(start, start + PER_PAGE);
    countEl.textContent = `${filteredUsers.length} pengguna`;

    tbody.innerHTML = '';
    pageData.forEach((u, i) => {
        const initial = (u.nama || u.email || '?')[0].toUpperCase();
        const isOnline = onlineStatuses[u.id] === 'online';
        const statusBadge = u.isActive !== false
            ? '<span class="badge badge-green">Aktif</span>'
            : '<span class="badge badge-red">Nonaktif</span>';
        const onlineDot = isOnline
            ? '<span class="status-dot online">Online</span>'
            : '<span class="status-dot offline">Offline</span>';
        const roleText = u.role === 'admin'
            ? '<span class="badge badge-orange">Admin</span>'
            : '<span class="badge badge-blue">User</span>';

        tbody.innerHTML += `
        <tr>
            <td>${start + i + 1}</td>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--gold),var(--orange));color:white;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${initial}</div>
                    <div>
                        <div style="font-weight:600;font-size:.875rem">${u.nama || '—'}</div>
                        <div>${roleText}</div>
                    </div>
                </div>
            </td>
            <td style="font-size:.85rem">${u.email || '—'}</td>
            <td>
                <code style="font-size:.7rem;background:var(--bg);padding:2px 6px;border-radius:4px;color:var(--text-light)">${u.id.substring(0, 12)}...</code>
            </td>
            <td style="font-size:.82rem">${formatDate(u.createdAt)}</td>
            <td style="font-size:.82rem">${u.lastLoginAt ? formatDate(u.lastLoginAt) : '—'}</td>
            <td>${statusBadge}</td>
            <td>${onlineDot}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-icon-blue" title="Detail" onclick="window.openUserDetail('${u.id}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    ${u.role !== 'admin' ? `
                    <button class="btn-icon ${u.isActive !== false ? 'btn-icon-orange' : 'btn-icon-green'}" 
                        title="${u.isActive !== false ? 'Nonaktifkan' : 'Aktifkan'}"
                        onclick="window.toggleUserStatus('${u.id}', ${u.isActive !== false}, '${(u.nama || u.email || '').replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-${u.isActive !== false ? 'user-slash' : 'user-check'}"></i>
                    </button>` : ''}
                </div>
            </td>
        </tr>`;
    });

    window.createPagination(paginEl, filteredUsers.length, currentPage, PER_PAGE, (p) => {
        currentPage = p; renderUsersTable();
    });
}

// ============================================================
// USER DETAIL MODAL
// ============================================================
window.openUserDetail = function(uid) {
    const u = allUsers.find(x => x.id === uid);
    if (!u) return;
    const isOnline = onlineStatuses[uid] === 'online';
    const initial = (u.nama || u.email || '?')[0].toUpperCase();

    document.getElementById('userDetailContent').innerHTML = `
    <div class="user-detail-header">
        <div class="user-detail-avatar">${initial}</div>
        <div>
            <h3 style="margin-bottom:4px">${u.nama || '—'}</h3>
            <p style="color:var(--text-light);font-size:.875rem">${u.email}</p>
            <div style="margin-top:4px">${isOnline ? '<span class="status-dot online">Online</span>' : '<span class="status-dot offline">Offline</span>'}</div>
        </div>
    </div>
    <div class="user-detail-info-grid">
        <div class="user-info-item">
            <p>UID</p>
            <strong style="font-size:.75rem;word-break:break-all">${u.id}</strong>
        </div>
        <div class="user-info-item">
            <p>Peran</p>
            <strong>${u.role === 'admin' ? '🛡️ Administrator' : '👤 Pengguna Biasa'}</strong>
        </div>
        <div class="user-info-item">
            <p>Status Akun</p>
            <strong>${u.isActive !== false ? '✅ Aktif' : '❌ Nonaktif'}</strong>
        </div>
        <div class="user-info-item">
            <p>Tanggal Daftar</p>
            <strong>${formatDate(u.createdAt)}</strong>
        </div>
        <div class="user-info-item">
            <p>Login Terakhir</p>
            <strong>${u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</strong>
        </div>
        <div class="user-info-item">
            <p>Status Kehadiran</p>
            <strong>${isOnline ? '🟢 Sedang Online' : '⚫ Offline'}</strong>
        </div>
    </div>`;
    window.openModal('modalUserDetail');
};

// ============================================================
// TOGGLE USER STATUS
// ============================================================
window.toggleUserStatus = function(uid, currentActive, name) {
    const willDeactivate = currentActive;
    const title = willDeactivate ? 'Nonaktifkan Pengguna?' : 'Aktifkan Pengguna?';
    const msg = willDeactivate
        ? `Akun "${name}" akan dinonaktifkan. Pengguna tidak dapat login.`
        : `Akun "${name}" akan diaktifkan kembali.`;

    document.getElementById('userStatusModalTitle').textContent = title;
    document.getElementById('userStatusModalMsg').textContent = msg;
    document.getElementById('confirmUserStatusBtn').className = willDeactivate ? 'btn-warning' : 'btn-primary';
    document.getElementById('confirmUserStatusBtn').textContent = willDeactivate ? 'Nonaktifkan' : 'Aktifkan';

    window.openModal('modalUserStatus');
    document.getElementById('confirmUserStatusBtn').onclick = async () => {
        window.closeModal('modalUserStatus');
        window.showLoading('Memperbarui status...');
        try {
            await updateDoc(doc(db, 'users', uid), {
                isActive: !currentActive,
                updatedAt: serverTimestamp()
            });
            const u = allUsers.find(x => x.id === uid);
            if (u) u.isActive = !currentActive;
            applyUserFilters();
            window.showToast(
                willDeactivate ? `Akun ${name} berhasil dinonaktifkan` : `Akun ${name} berhasil diaktifkan`,
                willDeactivate ? 'warning' : 'success'
            );
        } catch (err) {
            window.showToast('Gagal memperbarui: ' + err.message, 'error');
        } finally {
            window.hideLoading();
        }
    };
};

// ── Helpers ──
function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
