# CATATAN SIMULASI TABLETOP TANGGAP INSIDEN
## Skenario: Serangan Kombinasi Brute Force & Stored XSS pada Web Kentang Emas
**Standar Pelaksanaan:** NIST SP 800-61 Rev. 3 & NIST CSF 2.0  

---

### 1. INFORMASI SIMULASI
* **Waktu Latihan:** November 2026
* **Tipe Latihan:** Tabletop Exercise (TTX) & Live Verification Lab
* **Peserta:** Seluruh Anggota Tim Mahasiswa Kelompok Keripik Kentang Emas
* **Fasilitator / Dosen:** Hendra Kurniawan, Ph.D

---

### 2. KRONOLOGI SKENARIO & RESPON TIM

| Timestamp | Inject / Peristiwa Insiden | Respon Tim (Blue Team) | Status Pengendalian |
| :---: | :--- | :--- | :---: |
| **T+00:00** | Penyerang mengirimkan 20 percobaan login cepat dengan password umum ke akun admin. | SIEM Alert `ALT-1092` terpicu (Rule `RULE-01`). Model AI Isolation Forest mendeteksi lonjakan anomali score (0.78). | **DETECTED** |
| **T+00:03** | Penyerang gagal menembus login dan beralih ke form kontak, menyisipkan payload `<script>alert('POC')</script>`. | SIEM Alert `ALT-1091` terpicu (Rule `RULE-02`). Karakter berbahaya ditandai oleh input validator. | **FLAGGED** |
| **T+00:06** | Analis keamanan memverifikasi log di `section-siem-center` dan `admin-logs.js`. | Incident Commander menginstruksikan isolasi IP penyerang dan memverifikasi integritas database. | **CONTAINED** |
| **T+00:10** | Verifikasi integritas: Tidak ada kredensial yang bocor dan pesan form kontak ter-sanitasi dengan aman (`textContent`). | Database dinyatakan aman. Tidak ada peretasan yang berhasil. | **ERADICATED** |
| **T+00:15** | Simulasi selesai. Tim menyusun laporan insiden dan bukti penutupan celah (*remediation closure*). | Seluruh temuan ditutup dengan status aman. | **CLOSED** |

---

### 3. BUKTI PENUTUPAN TEMUAN (REMEDIATION CLOSURE EVIDENCE)

1. **Penutupan Brute Force:**
   - Telah ditambahkan aturan deteksi `RULE-01` di `js/admin-siem.js`.
   - Penerapan progressive lockout pada level client dan alerting di level SIEM.
2. **Penutupan XSS:**
   - Seluruh rendering DOM di `admin-contact.js` dan antarmuka web dialihkan ke `textContent` dan sanitasi regex.
   - Header `Content-Security-Policy` di Nginx aktif memblokir skrip eksternal liar.
3. **Kesimpulan Kesiapan:**
   - Tim telah memiliki prosedur tanggap insiden yang teruji, reproducible, dan terdokumentasi sesuai standar industri.
