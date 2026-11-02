// ============================================================
// admin-products.js — Product CRUD Module
// ============================================================
import { db, storage } from './firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, getDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    ref as storageRef, uploadBytesResumable,
    getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── State ──
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const PER_PAGE = 10;
let selectedImageFile = null;
let currentImageUrl = '';
let currentImagePath = '';
let variantCount = 0;
let pendingDeleteId = null;
let pendingDeleteImagePath = null;

const VARIAN_OPTIONS = ['Original', 'Balado', 'Barbeque', 'Keju', 'Pedas', 'Jagung Bakar', 'Lainnya'];

// ============================================================
// INIT
// ============================================================
export function initProducts() {
    setupProductForm();
    setupImageUpload();
    setupProductFilters();
    document.getElementById('addVariantBtn')?.addEventListener('click', addVariantRow);
    document.getElementById('btnResetForm')?.addEventListener('click', resetProductForm);
}

// ============================================================
// LOAD PRODUCTS LIST
// ============================================================
export async function loadProducts() {
    const tbody = document.getElementById('productsTableBody');
    const emptyEl = document.getElementById('productsEmpty');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-light)"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</td></tr>';

    try {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        applyProductFilters();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--red)">Gagal memuat: ${e.message}</td></tr>`;
    }
}

function applyProductFilters() {
    const search = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const filterV = document.getElementById('filterVarian')?.value || '';
    const filterS = document.getElementById('filterStok')?.value || '';
    const sort = document.getElementById('sortProduk')?.value || 'newest';
    const MIN_STOCK = parseInt(document.getElementById('minStokInput')?.value || 10);

    filteredProducts = allProducts.filter(p => {
        const matchSearch = !search ||
            p.name?.toLowerCase().includes(search) ||
            p.sku?.toLowerCase().includes(search);
        const matchVarian = !filterV ||
            p.variants?.some(v => v.rasa === filterV);
        const totalStok = p.variants?.reduce((sum, v) => sum + (v.stok || 0), 0) || 0;
        const matchStok = !filterS ||
            (filterS === 'tersedia' && totalStok > MIN_STOCK) ||
            (filterS === 'menipis' && totalStok > 0 && totalStok <= MIN_STOCK) ||
            (filterS === 'habis' && totalStok === 0);
        return matchSearch && matchVarian && matchStok;
    });

    // Sort
    filteredProducts.sort((a, b) => {
        if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sort === 'price-asc') return minHarga(a) - minHarga(b);
        if (sort === 'price-desc') return minHarga(b) - minHarga(a);
        if (sort === 'stock-asc') return totalStok(a) - totalStok(b);
        // newest
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

    renderProductsTable();
}

function minHarga(p) { return p.variants?.length ? Math.min(...p.variants.map(v => v.harga || 0)) : 0; }
function totalStok(p) { return p.variants?.reduce((s, v) => s + (v.stok || 0), 0) || 0; }

function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    const emptyEl = document.getElementById('productsEmpty');
    const countEl = document.getElementById('productsCountText');
    const paginEl = document.getElementById('productsPagination');

    if (!filteredProducts.length) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        countEl.textContent = '0 produk';
        return;
    }
    emptyEl.style.display = 'none';

    const start = (currentPage - 1) * PER_PAGE;
    const pageData = filteredProducts.slice(start, start + PER_PAGE);
    countEl.textContent = `${filteredProducts.length} produk`;

    tbody.innerHTML = '';
    pageData.forEach((p, i) => {
        const stok = totalStok(p);
        const MIN_STOCK = 10;
        const stokBadge = stok === 0
            ? '<span class="badge badge-red">Habis</span>'
            : stok <= MIN_STOCK
                ? `<span class="badge badge-orange">${stok}</span>`
                : `<span class="badge badge-green">${stok}</span>`;

        const statusBadge = p.isActive !== false
            ? '<span class="badge badge-green">Aktif</span>'
            : '<span class="badge badge-gray">Nonaktif</span>';

        const varianList = p.variants?.map(v => `<span class="badge badge-blue" style="margin:1px">${v.rasa}</span>`).join('') || '—';

        tbody.innerHTML += `
        <tr>
            <td>${start + i + 1}</td>
            <td><img src="${p.imageUrl || 'https://via.placeholder.com/44?text=P'}" class="table-img"
                     onerror="this.src='https://via.placeholder.com/44?text=P'" alt="${p.name}"></td>
            <td><strong>${p.name}</strong></td>
            <td><code style="font-size:.78rem;background:var(--bg);padding:2px 6px;border-radius:4px">${p.sku || '—'}</code></td>
            <td>${varianList}</td>
            <td>${formatRupiah(minHarga(p))}</td>
            <td>${stokBadge}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-icon-blue" title="Detail" onclick="window.openProductDetail('${p.id}')">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-icon-gold" title="Edit" onclick="window.editProduct('${p.id}')">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="btn-icon btn-icon-red" title="Hapus" onclick="window.deleteProduct('${p.id}','${(p.imagePath||'').replace(/'/g,"\\'")}','${(p.name||'').replace(/'/g,"\\'")}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    });

    window.createPagination(paginEl, filteredProducts.length, currentPage, PER_PAGE, (p) => {
        currentPage = p; renderProductsTable();
    });
}

function setupProductFilters() {
    ['productSearch', 'filterVarian', 'filterStok', 'sortProduk'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            currentPage = 1; applyProductFilters();
        });
    });
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================
window.openProductDetail = async function(id) {
    const p = allProducts.find(x => x.id === id);
    if (!p) return;
    const content = document.getElementById('productDetailContent');
    content.innerHTML = `
    <div class="product-detail-grid">
        <div>
            <img src="${p.imageUrl || 'https://via.placeholder.com/300x250?text=Produk'}" 
                 class="product-detail-img" alt="${p.name}"
                 onerror="this.src='https://via.placeholder.com/300x250?text=Produk'">
        </div>
        <div class="product-detail-info">
            <h3 style="margin-bottom:12px">${p.name}</h3>
            <p><strong>SKU:</strong> ${p.sku || '—'}</p>
            <p><strong>Status:</strong> ${p.isActive !== false ? '✅ Aktif' : '❌ Nonaktif'}</p>
            <p><strong>Dibuat:</strong> ${formatDateTime(p.createdAt)}</p>
            <p><strong>Diperbarui:</strong> ${formatDateTime(p.updatedAt)}</p>
            ${p.description ? `<p style="margin-top:12px"><strong>Deskripsi:</strong><br>${p.description}</p>` : ''}
        </div>
    </div>
    <h4 style="margin:20px 0 10px">Varian Rasa</h4>
    <table class="variants-table">
        <thead>
            <tr><th>Varian</th><th>Harga</th><th>Berat</th><th>Stok</th><th>Status</th></tr>
        </thead>
        <tbody>
            ${(p.variants || []).map(v => `
            <tr>
                <td>${v.rasa}</td>
                <td>${formatRupiah(v.harga)}</td>
                <td>${v.berat || 0} gram</td>
                <td>${v.stok || 0} unit</td>
                <td>${v.stok > 0 ? '<span class="badge badge-green">Tersedia</span>' : '<span class="badge badge-red">Habis</span>'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
    window.openModal('modalProductDetail');
};

// ============================================================
// PRODUCT FORM (Add / Edit)
// ============================================================
function setupProductForm() {
    const form = document.getElementById('productForm');
    if (!form) return;
    form.addEventListener('submit', handleProductSubmit);
}

window.prepareProductForm = function(mode, productId = null) {
    resetProductForm();
    if (mode === 'add') {
        document.getElementById('productFormTitle').textContent = 'Tambah Produk Baru';
        document.getElementById('productFormSubtitle').textContent = 'Isi detail produk di bawah ini';
        document.getElementById('btnSaveText').textContent = 'Simpan Produk';
        document.getElementById('editProductId').value = '';
        addVariantRow(); // Add one default variant
    }
};

window.editProduct = async function(id) {
    window.navigateTo('add-product');
    await new Promise(r => setTimeout(r, 100)); // Wait for section to show

    const p = allProducts.find(x => x.id === id) ||
              (await getDoc(doc(db, 'products', id))).data();
    if (!p) return;

    document.getElementById('productFormTitle').textContent = 'Edit Produk';
    document.getElementById('productFormSubtitle').textContent = `Mengedit: ${p.name || ''}`;
    document.getElementById('btnSaveText').textContent = 'Simpan Perubahan';
    document.getElementById('editProductId').value = id;
    document.getElementById('prodNama').value = p.name || '';
    document.getElementById('prodSKU').value = p.sku || '';
    document.getElementById('prodDeskripsi').value = p.description || '';
    document.getElementById('prodStatus').value = p.isActive !== false ? 'true' : 'false';

    currentImageUrl = p.imageUrl || '';
    currentImagePath = p.imagePath || '';

    if (p.imageUrl) {
        document.getElementById('imagePreview').src = p.imageUrl;
        document.getElementById('imagePreviewWrap').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    }

    // Variants
    document.getElementById('variantsList').innerHTML = '';
    variantCount = 0;
    (p.variants || []).forEach(v => addVariantRow(v));
};

function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('variantsList').innerHTML = '';
    variantCount = 0;
    selectedImageFile = null;
    currentImageUrl = '';
    currentImagePath = '';
    document.getElementById('imagePreviewWrap').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'flex';
    document.getElementById('uploadProgressWrap').style.display = 'none';
    document.getElementById('errNama').textContent = '';
    document.getElementById('errSKU').textContent = '';
    document.getElementById('errVariants').textContent = '';
    addVariantRow(); // one default
}

// ── Image Upload ──
function setupImageUpload() {
    const zone = document.getElementById('imageUploadZone');
    const input = document.getElementById('productImageInput');
    const removeBtn = document.getElementById('removeImageBtn');

    zone?.addEventListener('click', () => input?.click());
    zone?.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = 'var(--gold)'; });
    zone?.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone?.addEventListener('drop', (e) => {
        e.preventDefault(); zone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file) handleImageSelect(file);
    });

    input?.addEventListener('change', (e) => {
        if (e.target.files[0]) handleImageSelect(e.target.files[0]);
    });

    removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedImageFile = null;
        currentImageUrl = '';
        document.getElementById('imagePreviewWrap').style.display = 'none';
        document.getElementById('uploadPlaceholder').style.display = 'flex';
        input.value = '';
    });
}

function handleImageSelect(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
        window.showToast('Format tidak didukung. Gunakan JPG, PNG, atau WEBP.', 'error'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
        window.showToast('Ukuran file maksimal 5MB.', 'error'); return;
    }
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreviewWrap').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function uploadImage(file, productId) {
    return new Promise((resolve, reject) => {
        const path = `products/${productId}_${Date.now()}.${file.name.split('.').pop()}`;
        const sRef = storageRef(storage, path);
        const task = uploadBytesResumable(sRef, file);

        document.getElementById('uploadProgressWrap').style.display = 'flex';

        task.on('state_changed',
            (snap) => {
                const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                document.getElementById('uploadProgressFill').style.width = pct + '%';
                document.getElementById('uploadProgressText').textContent = pct + '%';
            },
            (err) => reject(err),
            async () => {
                const url = await getDownloadURL(task.snapshot.ref);
                document.getElementById('uploadProgressWrap').style.display = 'none';
                resolve({ url, path });
            }
        );
    });
}

// ── Variant Rows ──
function addVariantRow(data = {}) {
    variantCount++;
    const idx = variantCount;
    const container = document.getElementById('variantsList');
    const div = document.createElement('div');
    div.className = 'variant-item';
    div.id = `variant-${idx}`;
    div.innerHTML = `
    <div class="variant-header">
        <span class="variant-title">Varian #${idx}</span>
        <button type="button" class="remove-variant-btn" onclick="removeVariant(${idx})" title="Hapus varian">
            <i class="fa-solid fa-xmark"></i>
        </button>
    </div>
    <div class="variant-grid">
        <div class="form-group">
            <label>Rasa <span class="req">*</span></label>
            <select class="var-rasa">
                ${VARIAN_OPTIONS.map(o => `<option value="${o}" ${data.rasa === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Harga (Rp) <span class="req">*</span></label>
            <input type="number" class="var-harga" min="0" placeholder="15000" value="${data.harga || ''}">
        </div>
        <div class="form-group">
            <label>Berat (gram)</label>
            <input type="number" class="var-berat" min="0" placeholder="100" value="${data.berat || ''}">
        </div>
        <div class="form-group">
            <label>Stok (unit)</label>
            <input type="number" class="var-stok" min="0" placeholder="0" value="${data.stok || ''}">
        </div>
    </div>`;
    container.appendChild(div);
}

window.removeVariant = function(idx) {
    document.getElementById(`variant-${idx}`)?.remove();
};

function collectVariants() {
    const variants = [];
    document.querySelectorAll('.variant-item').forEach(item => {
        const rasa = item.querySelector('.var-rasa')?.value;
        const harga = parseInt(item.querySelector('.var-harga')?.value) || 0;
        const berat = parseInt(item.querySelector('.var-berat')?.value) || 0;
        const stok = parseInt(item.querySelector('.var-stok')?.value) || 0;
        if (rasa) variants.push({ rasa, harga, berat, stok });
    });
    return variants;
}

// ── Submit ──
async function handleProductSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveProduct');

    // Validate
    const nama = document.getElementById('prodNama').value.trim();
    const sku = document.getElementById('prodSKU').value.trim();
    const variants = collectVariants();
    let valid = true;

    if (!nama) { document.getElementById('errNama').textContent = 'Nama produk wajib diisi'; valid = false; }
    else document.getElementById('errNama').textContent = '';
    if (!sku) { document.getElementById('errSKU').textContent = 'SKU wajib diisi'; valid = false; }
    else document.getElementById('errSKU').textContent = '';
    if (!variants.length) { document.getElementById('errVariants').textContent = 'Tambahkan minimal 1 varian rasa'; valid = false; }
    else document.getElementById('errVariants').textContent = '';

    if (!valid) return;

    btn.disabled = true;
    document.getElementById('btnSaveText').textContent = 'Menyimpan...';
    window.showLoading('Menyimpan produk...');

    try {
        const editId = document.getElementById('editProductId').value;
        const isEdit = !!editId;
        const docId = isEdit ? editId : doc(collection(db, 'products')).id;

        // Upload image if new file selected
        let imageUrl = currentImageUrl;
        let imagePath = currentImagePath;
        if (selectedImageFile) {
            // Delete old image
            if (currentImagePath) {
                try { await deleteObject(storageRef(storage, currentImagePath)); } catch (_) {}
            }
            const uploaded = await uploadImage(selectedImageFile, docId);
            imageUrl = uploaded.url;
            imagePath = uploaded.path;
        }

        const data = {
            name: nama, sku, description: document.getElementById('prodDeskripsi').value,
            imageUrl, imagePath, variants,
            isActive: document.getElementById('prodStatus').value === 'true',
            updatedAt: serverTimestamp()
        };

        if (isEdit) {
            await updateDoc(doc(db, 'products', editId), data);
            window.showToast('Produk berhasil diperbarui', 'success');
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, 'products'), data);
            window.showToast('Produk berhasil ditambahkan', 'success');
        }

        window.navigateTo('products');
    } catch (err) {
        window.showToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
        window.hideLoading();
        btn.disabled = false;
        document.getElementById('btnSaveText').textContent = 'Simpan Produk';
    }
}

// ============================================================
// DELETE PRODUCT
// ============================================================
window.deleteProduct = function(id, imagePath, name) {
    pendingDeleteId = id;
    pendingDeleteImagePath = imagePath;
    document.getElementById('deleteConfirmMsg').textContent =
        `Hapus "${name}"? Tindakan ini tidak dapat dibatalkan.`;
    window.openModal('modalDelete');

    document.getElementById('confirmDeleteBtn').onclick = async () => {
        window.closeModal('modalDelete');
        window.showLoading('Menghapus produk...');
        try {
            if (pendingDeleteImagePath) {
                try { await deleteObject(storageRef(storage, pendingDeleteImagePath)); } catch (_) {}
            }
            await deleteDoc(doc(db, 'products', pendingDeleteId));
            allProducts = allProducts.filter(p => p.id !== pendingDeleteId);
            applyProductFilters();
            window.showToast('Produk berhasil dihapus', 'success');
        } catch (err) {
            window.showToast('Gagal menghapus: ' + err.message, 'error');
        } finally {
            window.hideLoading();
        }
    };
};

// ── Helpers ──
function formatRupiah(n) { return 'Rp ' + (n || 0).toLocaleString('id-ID'); }
function formatDateTime(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
