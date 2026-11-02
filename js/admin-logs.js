// ============================================================
// admin-logs.js — Login History Module
// ============================================================
import { db } from './firebase-config.js';
import {
    collection, query, orderBy, getDocs, where,
    limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
const PER_PAGE = 20;

// ============================================================
// INIT
// ============================================================
export function initLogs() {
    setupLogFilters();
}

function setupLogFilters() {
    ['logSearch', 'logDateFrom', 'logDateTo', 'filterLogEvent'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            currentPage = 1; applyLogFilters();
        });
        document.getElementById(id)?.addEventListener('change', () => {
            currentPage = 1; applyLogFilters();
        });
    });
}

// ============================================================
// LOAD LOGS
// ============================================================
export async function loadLogs() {
    const tbody = document.getElementById('loginLogsBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-light)"><i class="fa-solid fa-spinner fa-spin"></i> Memuat riwayat...</td></tr>';

    try {
        const q = query(collection(db, 'loginLogs'), orderBy('loginAt', 'desc'), limit(200));
        const snap = await getDocs(q);
        allLogs = [];
        snap.forEach(d => allLogs.push({ id: d.id, ...d.data() }));
        applyLogFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--red)">Gagal memuat: ${e.message}</td></tr>`;
    }
}

function applyLogFilters() {
    const search = document.getElementById('logSearch')?.value.toLowerCase() || '';
    const dateFrom = document.getElementById('logDateFrom')?.value;
    const dateTo = document.getElementById('logDateTo')?.value;
    const eventFilter = document.getElementById('filterLogEvent')?.value || '';

    filteredLogs = allLogs.filter(log => {
        const matchSearch = !search ||
            (log.email || '').toLowerCase().includes(search) ||
            (log.nama || '').toLowerCase().includes(search);

        const logDate = log.loginAt?.toDate ? log.loginAt.toDate() : null;
        const matchFrom = !dateFrom || !logDate || logDate >= new Date(dateFrom);
        const matchTo = !dateTo || !logDate || logDate <= new Date(dateTo + 'T23:59:59');
        const matchEvent = !eventFilter || log.eventType === eventFilter;

        return matchSearch && matchFrom && matchTo && matchEvent;
    });

    renderLogsTable();
}

function renderLogsTable() {
    const tbody = document.getElementById('loginLogsBody');
    const emptyEl = document.getElementById('logsEmpty');
    const countEl = document.getElementById('logsCountText');
    const paginEl = document.getElementById('logsPagination');

    if (!filteredLogs.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        countEl.textContent = '0 aktivitas';
        if (paginEl) paginEl.innerHTML = '';
        return;
    }
    emptyEl.style.display = 'none';

    const start = (currentPage - 1) * PER_PAGE;
    const pageData = filteredLogs.slice(start, start + PER_PAGE);
    countEl.textContent = `${filteredLogs.length} aktivitas`;

    tbody.innerHTML = '';
    pageData.forEach((log, i) => {
        const isLogin = log.eventType === 'login';
        const eventBadge = isLogin
            ? '<span class="badge badge-green"><i class="fa-solid fa-right-to-bracket" style="margin-right:4px"></i>Login</span>'
            : '<span class="badge badge-gray"><i class="fa-solid fa-right-from-bracket" style="margin-right:4px"></i>Logout</span>';
        const initial = (log.nama || log.email || '?')[0].toUpperCase();

        tbody.innerHTML += `
        <tr>
            <td>${start + i + 1}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:32px;height:32px;border-radius:6px;background:linear-gradient(135deg,var(--gold),var(--orange));color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;flex-shrink:0">${initial}</div>
                    <span style="font-weight:500;font-size:.875rem">${log.nama || '—'}</span>
                </div>
            </td>
            <td style="font-size:.85rem;color:var(--text-med)">${log.email || '—'}</td>
            <td style="font-size:.82rem">${formatDateTime(log.loginAt)}</td>
            <td>${eventBadge}</td>
        </tr>`;
    });

    window.createPagination(paginEl, filteredLogs.length, currentPage, PER_PAGE, (p) => {
        currentPage = p; renderLogsTable();
    });
}

function formatDateTime(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
