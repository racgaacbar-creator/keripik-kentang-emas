// ============================================================
// admin-contact.js — Contact & Store Settings Module
// ============================================================
import { db } from './firebase-config.js';
import {
    doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let originalContactData = {};

// ============================================================
// INIT
// ============================================================
export function initContact() {
    document.getElementById('contactForm')?.addEventListener('submit', handleContactSubmit);
    document.getElementById('resetContactBtn')?.addEventListener('click', resetContactForm);
}

// ============================================================
// LOAD CONTACT
// ============================================================
export async function loadContact() {
    try {
        const snap = await getDoc(doc(db, 'storeSettings', 'contact'));
        if (snap.exists()) {
            const data = snap.data();
            originalContactData = data;
            fillContactForm(data);
        } else {
            originalContactData = {};
        }
    } catch (e) {
        window.showToast('Gagal memuat kontak: ' + e.message, 'error');
    }
}

function fillContactForm(data) {
    document.getElementById('konNamaToko').value = data.namaToko || '';
    document.getElementById('konAlamat').value  = data.alamat   || '';
    document.getElementById('konPesan').value   = data.pesanSambutan || '';
    document.getElementById('konInfo').value    = data.infoTambahan  || '';
    document.getElementById('konWhatsapp').value = data.whatsapp  || '';
    document.getElementById('konTelepon').value  = data.telepon   || '';
    document.getElementById('konEmail').value    = data.email     || '';
    document.getElementById('konInstagram').value = data.instagram || '';
    document.getElementById('konFacebook').value  = data.facebook  || '';
    document.getElementById('konTiktok').value    = data.tiktok    || '';
}

function resetContactForm() {
    fillContactForm(originalContactData);
    window.showToast('Form dikembalikan ke data sebelumnya', 'info');
}

// ============================================================
// SAVE CONTACT
// ============================================================
async function handleContactSubmit(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; }
    window.showLoading('Menyimpan kontak...');

    try {
        const whatsappRaw = document.getElementById('konWhatsapp').value.replace(/\D/g, '');
        const data = {
            namaToko:       document.getElementById('konNamaToko').value.trim(),
            alamat:         document.getElementById('konAlamat').value.trim(),
            pesanSambutan:  document.getElementById('konPesan').value.trim(),
            infoTambahan:   document.getElementById('konInfo').value.trim(),
            whatsapp:       whatsappRaw,
            telepon:        document.getElementById('konTelepon').value.trim(),
            email:          document.getElementById('konEmail').value.trim(),
            instagram:      document.getElementById('konInstagram').value.trim().replace('@', ''),
            facebook:       document.getElementById('konFacebook').value.trim(),
            tiktok:         document.getElementById('konTiktok').value.trim().replace('@', ''),
            updatedAt:      serverTimestamp()
        };

        await setDoc(doc(db, 'storeSettings', 'contact'), data, { merge: true });
        originalContactData = { ...data };
        window.showToast('Kontak toko berhasil disimpan ✅', 'success');
    } catch (err) {
        window.showToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
        window.hideLoading();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Kontak';
        }
    }
}
