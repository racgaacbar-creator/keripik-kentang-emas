// ============================================================
// admin-stock.js — Stock Management Module
// ============================================================
import { db } from './firebase-config.js';
import {
    collection, doc, getDocs, updateDoc, addDoc,
    query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allStockItems = [];
let stockLogs = [];
let MIN_STOCK = 10;

// ============================================================
// INIT
// ============================================================
export function initStock() {
    document.getElementById('minStokInput')?.addEventListener('change', (e) => {
        MIN_STOCK = parseInt(e.target.value) || 10;
        renderStockTable();
        updateStockStats();
    });

    document.getElementById('stockSearch')?.addEventListener('input', () => {
        renderStockTable();
    });

    // Stock modal confirm
    document.getElementById('confirmStockBtn')?.addEventListener('click', handleStockUpdate);
}

// ============================================================
// LOAD STOCK
// ============================================================
export async function loadStock() {
    renderStockLoading();
    try {
        const snap = await getDocs(collection(db, 'products'));
        allStockItems = [];
        snap.forEach(d => {
            const p = d.data();
            if (p.variants) {
                p.variants.forEach((v, i) => {
                    allStockItems.push({
                        productId: d.id,
                        productName: p.name || '—',
                        varianIndex: i,
                        rasa: v.rasa || '—',
                        harga: v.harga || 0,
                        stok: v.stok || 0,
                        allVariants: p.variants
                    });
                });
            }
        });

        await loadStockLogs();
        updateStockStats();
        renderStockTable();
    } catch (e) {
        window.showToast('Gagal memuat stok: ' + e.message, 'error');
    }
}

function renderStockLoading() {
    document.getElementById('stockTableBody').innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-light)"><i class="fa-solid fa-spinner fa-spin"></i> Memuat stok...</td></tr>';
}

function updateStockStats() {
    let total = 0, low = 0, empty = 0;
    allStockItems.forEach(item => {
        total += item.stok;
        if (item.stok === 0) empty++;
        else if (item.stok <= MIN_STOCK) low++;
    });
    document.getElementById('ssTotal').textContent = total.toLocaleString('id-ID');
    document.getElementById('ssLow').textContent = low;
    document.getElementById('ssEmpty').textContent = empty;
    // Also update main stock stat on dashboard
    document.getElementById('statTotalStok') && (document.getElementById('statTotalStok').textContent = total.toLocaleString('id-ID'));
    document.getElementById('statStokMenipis') && (document.getElementById('statStokMenipis').textContent = low);
}

function renderStockTable() {
    const tbody = document.getElementById('stockTableBody');
    const emptyEl = document.getElementById('stockEmpty');
    const search = document.getElementById('stockSearch')?.value.toLowerCase() || '';

    const filtered = allStockItems.filter(item =>
        !search || item.productName.toLowerCase().includes(search) ||
        item.rasa.toLowerCase().includes(search)
    );

    if (!filtered.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    tbody.innerHTML = '';
    filtered.forEach((item, i) => {
        let statusBadge;
        if (item.stok === 0) statusBadge = '<span class="badge badge-red">Habis</span>';
        else if (item.stok <= MIN_STOCK) statusBadge = `<span class="badge badge-orange">Menipis (≤${MIN_STOCK})</span>`;
        else statusBadge = '<span class="badge badge-green">Tersedia</span>';

        tbody.innerHTML += `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${item.productName}</strong></td>
            <td>${item.rasa}</td>
            <td>${window.formatRupiah(item.harga)}</td>
            <td><strong style="color:${item.stok === 0 ? 'var(--red)' : item.stok <= MIN_STOCK ? 'var(--orange)' : 'var(--text-dark)'}">${item.stok}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn-icon btn-icon-gold" title="Update Stok"
                    onclick="window.openStockModal('${item.productId}', ${item.varianIndex})">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </td>
        </tr>`;
    });
}

// ============================================================
// STOCK MODAL
// ============================================================
window.openStockModal = function(productId, varianIndex) {
    const item = allStockItems.find(x => x.productId === productId && x.varianIndex === varianIndex);
    if (!item) return;

    document.getElementById('stockProductId').value = productId;
    document.getElementById('stockVarianIndex').value = varianIndex;
    document.getElementById('stockModalTitle').textContent = 'Update Stok Produk';
    document.getElementById('stockProductName').textContent = item.productName;
    document.getElementById('stockVarianName').textContent = item.rasa;
    document.getElementById('stockCurrent').textContent = item.stok + ' unit';
    document.getElementById('stockAmount').value = '';
    document.getElementById('stockNote').value = '';
    // Reset radio
    document.querySelector('input[name="stockAction"][value="add"]').checked = true;

    window.openModal('modalStock');
};

async function handleStockUpdate() {
    const productId = document.getElementById('stockProductId').value;
    const varianIndex = parseInt(document.getElementById('stockVarianIndex').value);
    const action = document.querySelector('input[name="stockAction"]:checked')?.value;
    const amount = parseInt(document.getElementById('stockAmount').value);
    const note = document.getElementById('stockNote').value;

    if (isNaN(amount) || amount < 0) {
        window.showToast('Masukkan jumlah yang valid', 'warning'); return;
    }

    const item = allStockItems.find(x => x.productId === productId && x.varianIndex === varianIndex);
    if (!item) return;

    let newStok;
    if (action === 'add') newStok = item.stok + amount;
    else if (action === 'reduce') newStok = Math.max(0, item.stok - amount);
    else newStok = amount; // set

    if (newStok < 0) {
        window.showToast('Stok tidak boleh negatif', 'error'); return;
    }

    window.closeModal('modalStock');
    window.showLoading('Memperbarui stok...');

    try {
        // Get current product
        const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const prodRef = doc(db, 'products', productId);
        const prodSnap = await getDoc(prodRef);
        if (!prodSnap.exists()) throw new Error('Produk tidak ditemukan');

        const variants = [...prodSnap.data().variants];
        const oldStok = variants[varianIndex].stok || 0;
        variants[varianIndex] = { ...variants[varianIndex], stok: newStok };

        await updateDoc(prodRef, { variants, updatedAt: serverTimestamp() });

        // Log the change
        await addDoc(collection(db, 'stockLogs'), {
            productId, productName: item.productName,
            rasa: item.rasa,
            perubahan: newStok - oldStok,
            stokBefore: oldStok,
            stokAfter: newStok,
            action, keterangan: note || '—',
            createdAt: serverTimestamp()
        });

        // Update local state
        item.stok = newStok;
        updateStockStats();
        renderStockTable();

        const changeText = action === 'add' ? `+${amount}` : action === 'reduce' ? `-${amount}` : `=${newStok}`;
        window.showToast(`Stok ${item.rasa} diperbarui: ${changeText} unit → ${newStok} unit`, 'success');

        // Reload logs
        await loadStockLogs();
        renderStockLogs();
    } catch (err) {
        window.showToast('Gagal update stok: ' + err.message, 'error');
    } finally {
        window.hideLoading();
    }
}

// ============================================================
// STOCK LOGS
// ============================================================
async function loadStockLogs() {
    try {
        const q = query(collection(db, 'stockLogs'), orderBy('createdAt', 'desc'), limit(50));
        const snap = await getDocs(q);
        stockLogs = [];
        snap.forEach(d => stockLogs.push({ id: d.id, ...d.data() }));
        renderStockLogs();
    } catch (_) {}
}

function renderStockLogs() {
    const tbody = document.getElementById('stockLogBody');
    const emptyEl = document.getElementById('stockLogEmpty');
    if (!tbody) return;

    if (!stockLogs.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';
    tbody.innerHTML = '';

    stockLogs.forEach(log => {
        const change = log.perubahan > 0 ? `<span style="color:var(--green)">+${log.perubahan}</span>`
                     : log.perubahan < 0 ? `<span style="color:var(--red)">${log.perubahan}</span>`
                     : `<span style="color:var(--text-light)">=${log.stokAfter}</span>`;
        tbody.innerHTML += `
        <tr>
            <td style="font-size:.8rem;color:var(--text-light)">${formatDateTime(log.createdAt)}</td>
            <td>${log.productName}</td>
            <td>${log.rasa}</td>
            <td>${change}</td>
            <td>${log.stokBefore}</td>
            <td><strong>${log.stokAfter}</strong></td>
            <td style="font-size:.8rem;color:var(--text-light)">${log.keterangan || '—'}</td>
        </tr>`;
    });
}

function formatDateTime(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) +
           ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
