# INCIDENT RESPONSE PLAYBOOK
## Berdasarkan Standar NIST SP 800-61 Rev. 3 & NIST CSF 2.0 (Respond & Recover)
**Target:** Aplikasi Web E-Commerce Keripik Kentang (Kentang Emas)  
**Mata Kuliah:** Perancangan Keamanan Sistem dan Jaringan (INF11022) - Fase 4  

---

## 1. STRUKTUR & SIKLUS TANGGAP INSIDEN (NIST SP 800-61r3)

Siklus tanggap insiden pada platform Kentang Emas dibagi menjadi 5 fase berurutan:

```
[ 1. Preparation ] ──> [ 2. Detection & Analysis ] ──> [ 3. Containment ] ──> [ 4. Eradication & Recovery ] ──> [ 5. Post-Incident Activity ]
```

### Tim Tanggap Insiden (CSIRT / Blue Team):
* **Incident Commander:** Raga Akbar
* **Lead Detection Analyst:** Philip Damian Samosir
* **Containment & Remediation Engineer:** Muhammad Hafizd & Aspin Ariansah
* **Forensic & Documentation Lead:** Gabriel Saputra Sihombing

---

## 2. PLAYBOOK INSIDEN SPESIFIK

### PLAYBOOK-01: Serangan Brute Force & Credential Stuffing (MITRE ATT&CK T1110)

#### FASE 1: Deteksi & Analisis (Detection & Analysis)
* **Indikator Serangan (IoC):**
  - SIEM Rule `RULE-01` terpicu pada dashboard admin (`admin-siem.js`).
  - Terdeteksi >= 3 percobaan login gagal dari alamat IP yang sama dalam durasi < 5 menit.
  - Model AI Isolation Forest menandai skor anomali > 0.65 pada log autentikasi.
* **Tindakan Verifikasi:**
  - Buka Firestore collection `loginLogs`.
  - Filter `event: 'login'` dan status gagal. Periksa pola username yang dicoba (apakah *admin*, *root*, atau variasi nama pelanggan).

#### FASE 2: Penahanan (Containment)
* **Penahanan Jangka Pendek (Immediate):**
  - Kunci sesi login akun target sementara selama 15 menit menggunakan progressive rate-limiting.
  - Masukkan alamat IP penyerang ke daftar blokir firewall / Nginx `deny <IP_ADDRESS>;`.
* **Penahanan Jangka Panjang:**
  - Terapkan reCAPTCHA / bot challenge pada form `login-unified.html`.

#### FASE 3: Eradikasi (Eradication)
* Verifikasi apakah ada akun yang berhasil ditembus sebelum IP diblokir.
* Jika terindikasi ada login sukses yang mencurigakan, paksa *Sign Out* dari semua perangkat (`signOut(auth)`) dan lakukan reset password wajib.

#### FASE 4: Pemulihan (Recovery)
* Kembalikan akses pengguna sah setelah verifikasi kepemilikan email/MFA.
* Pantau log autentikasi selama 24 jam untuk mendeteksi percobaan ulang dari subnet IP lain.

#### FASE 5: Pembelajaran Pasca-Insiden (Post-Incident Activity)
* Catat durasi *Mean Time to Detect (MTTD)* dan *Mean Time to Respond (MTTR)*.
* Perbarui model AI Anomaly Detector dengan pola serangan terbaru.

---

### PLAYBOOK-02: Serangan Web Injection / Stored XSS (MITRE ATT&CK T1059.007)

#### FASE 1: Deteksi & Analisis
* **Indikator Serangan (IoC):**
  - Rule `RULE-02` terpicu di SIEM Center.
  - Ditemukan karakter berbahaya `<script>`, `onerror=`, atau `javascript:` pada input form kontak (`admin-contact.js`) atau ulasan produk.
* **Verifikasi:**
  - Periksa dokumen Firestore `contactMessages` atau `productReviews`.
  - Pastikan apakah payload tersimpan dalam bentuk raw text atau sudah ter-encode.

#### FASE 2: Penahanan
* Nonaktifkan sementara rendering pesan publik dari pengirim yang dicurigai.
* Aktifkan strict Content-Security-Policy (CSP) di `nginx.conf` untuk memblokir `unsafe-inline` scripts.

#### FASE 3: Eradikasi & Remediasi
* Hapus record pesan berbahaya dari database.
* Terapkan sanitasi input di sisi klien dan server:
  ```javascript
  const sanitized = input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  ```
* Gunakan `element.textContent` sebagai pengganti `element.innerHTML`.

#### FASE 4: Pemulihan & Penutupan
* Verifikasi bahwa form input tidak lagi dapat mengeksekusi skrip payload uji coba.
* Tandai status insiden sebagai **REMEDIATED & CLOSED**.
