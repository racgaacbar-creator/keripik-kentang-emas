# LAPORAN MILESTONE FASE 4
## Adversarial Validation, NDR/SIEM, AI-Driven Detection, and Incident Response pada Web E-Commerce Keripik Kentang (Kentang Emas)

**Anggota Kelompok :**
* Raga Akbar (2301020062)
* Philip Damian Samosir (2301020060)
* Muhammad Hafizd (2301020061)
* Aspin Ariansah (2301020072)
* Gabriel Saputra Sihombing (2301020102)

**TEKNIK INFORMATIKA**  
**FAKULTAS TEKNIK DAN TEKNOLOGI KEMARITIMAN**  
**UNIVERSITAS MARITIM RAJA ALI HAJI**  
**2026**

---

## RINGKASAN EKSEKUTIF FASE 4

Laporan Milestone Fase 4 ini merupakan dokumentasi implementasi pengujian ofensif terkontrol (*Adversarial Validation*), pembangunan telemetri keamanan sentral (*NDR / SIEM*), perancangan model kecerdasan buatan untuk deteksi ancaman (*AI-Driven Threat Detection*), serta penyusunan prosedur tanggap insiden (*Incident Response*) dan remediasi pada aplikasi web e-commerce "Kentang Emas" (Keripik Kentang Premium). Fase ini bertujuan untuk menguji keandalan pertahanan yang telah dibangun pada fase-fase sebelumnya secara empiris melalui simulasi serangan berbasis standar OWASP Top 10:2025, pemetaan matriks MITRE ATT&CK for Enterprise, serta pedoman tanggap darurat NIST SP 800-61 Rev. 3.

Melalui serangkaian pengujian Red Team dan penguatan sistem Blue Team, tim berhasil:
1. Menemukan dan menutup 5 kerentanan kritis melalui ethical pentest.
2. Membangun dasbor SIEM & Security Center interaktif pada panel admin yang dilengkapi 5 aturan deteksi aktif.
3. Melatih model AI Isolation Forest & Random Forest yang mampu mendeteksi anomali autentikasi dengan akurasi 98.33% dan F1-Score 93.33%.
4. Memvalidasi skenario simulasi insiden (*tabletop drill*) hingga penutupan celah keamanan secara penuh (100% Remediation Closure).

---

## BAB 1. ETHICAL PENETRATION TESTING & VULNERABILITY ASSESSMENT

Pengujian penetrasi dilakukan secara terstruktur dan etis mengacu pada dokumen Rules of Engagement (ROE) serta metodologi OWASP Web Security Testing Guide (WSTG v4.2) dan OWASP ASVS v5.0.0. Pengujian difokuskan pada pengujian fungsi autentikasi, penanganan input pengguna, mekanisme kontrol akses basis data, serta potensi kebocoran informasi konfigurasi.

### 1.1 Rules of Engagement (ROE) & Batasan Pengujian
* **Target Terdefinisi:** Pengujian dibatasi secara ketat pada endpoint aplikasi lokal (`localhost:8080`) dan staging cloud (`keripik-kentang-1826e.web.app`).
* **Batasan Etika:** Dilarang melakukan serangan Denial of Service (DoS), perusakan data permanen, pengujian jaringan kampus UMRAH, atau penargetan akun di luar akun laboratorium.
* **Standar Penilaian Kerentanan:** Setiap temuan dinilai tingkat keparahannya menggunakan standar Common Vulnerability Scoring System (CVSS v3.1).

### 1.2 Temuan Kerentanan & Hasil Validasi Eksploitasi
Berdasarkan pengujian penetrasi otomatis dan manual yang dijalankan menggunakan modul `run-pentest-simulation.js`, ditemukan 5 kerentanan yang telah berhasil diremediasi secara tuntas:

| ID Temuan | Kerentanan & Vektor Serangan | OWASP Category | CVSS | Severity | MITRE ATT&CK | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **FIND-01** | Ketiadaan pembatasan laju percobaan login (Brute Force Authentication). | A07:2021-Auth Failures | 7.5 | **HIGH** | T1110.001 | **REMEDIATED** |
| **FIND-02** | Potensi injeksi script berbahaya pada form pesan kontak & ulasan (Stored/DOM XSS). | A03:2021-Injection | 6.1 | **MEDIUM** | T1059.007 | **REMEDIATED** |
| **FIND-03** | Pengungkapan informasi versi web server Nginx melalui HTTP Response Banner. | A05:2021-Misconfiguration | 3.7 | **LOW** | T1082 | **REMEDIATED** |
| **FIND-04** | Percobaan eskalasi hak akses (Privilege Escalation) dengan memanipulasi parameter role. | A01:2021-Broken Access | 8.1 | **HIGH** | T1078 | **REMEDIATED** |
| **FIND-05** | Pemindaian berkas rahasia repositori dan environment (.env, .git, .dockerignore). | A05:2021-Misconfiguration | 5.3 | **MEDIUM** | T1592 | **REMEDIATED** |

> **[ TEMPAT SCREENSHOT #1: Hasil Eksekusi Skrip Validasi Ethical Pentest (run-pentest-simulation.js) ]**  
> *Panduan:* Buka terminal di folder proyek, jalankan `node pentest/run-pentest-simulation.js`. Screenshot output pengujian 5 test case yang berstatus BLOCKED & REMEDIATED.

> **[ TEMPAT SCREENSHOT #2: Dokumen Rules of Engagement (ROE) & Pentest Report ]**  
> *Panduan:* Buka file `pentest/pentest-plan-roe.md` atau `pentest/pentest-report.md` di VS Code. Screenshot bagian ruang lingkup dan matriks temuan CVSS.

---

## BAB 2. NDR & SIEM CENTRALIZED TELEMETRY (DETECTION ENGINEERING)

Pilar kedua berfokus pada pembangunan telemetri keamanan sentral dan rekayasa deteksi (Detection Engineering) untuk memantau aktivitas sistem secara real-time, mengidentifikasi indikator serangan (IoC), dan memetakannya ke dalam kerangka MITRE ATT&CK.

### 2.1 Arsitektur Telemetri Keamanan & Sentralisasi Log
Data telemetri dikumpulkan dari berbagai lapisan aplikasi:
1. Log autentikasi pengguna dan administrator dicatat ke koleksi Cloud Firestore `loginLogs`.
2. Akses HTTP dan kegagalan kueri dipantau oleh Nginx access/error log.
3. Modul frontend SIEM Center (`admin-siem.js`) mengolah log telemetri secara berkelanjutan untuk mendeteksi anomali.

### 2.2 Katalog Aturan Deteksi (Detection Rules) & Pemetaan MITRE ATT&CK

| Rule ID | Nama Aturan Deteksi | Taktik & Teknik MITRE ATT&CK | Severity | Logika Ambang Batas (Threshold) | Status |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **RULE-01** | Brute Force Authentication Attempt | T1110.001 (Credential Access: Password Guessing) | **HIGH** | >= 3 percobaan gagal login dalam rentang 5 menit dari IP/User sama. | **ACTIVE** |
| **RULE-02** | Suspicious Script / XSS Probe | T1059.007 (Execution: JavaScript Ingestion) | **HIGH** | Mendeteksi string `<script>`, `onerror=`, `javascript:` pada payload form. | **ACTIVE** |
| **RULE-03** | SQL Injection Probe Exploration | T1190 (Initial Access: Exploit Public-Facing App) | **CRITICAL** | Mendeteksi sintaks `UNION SELECT`, `OR 1=1`, `--` pada parameter kueri. | **ACTIVE** |
| **RULE-04** | Privilege Escalation on User Role | T1078 (Privilege Escalation: Valid Accounts) | **CRITICAL** | Upaya penulisan `role` != 'user' dari klien tanpa sesi admin sah. | **ACTIVE** |
| **RULE-05** | Off-Hours Administrative Session | T1078.004 (Defense Evasion: Admin Accounts) | **LOW** | Login administrator pada jam tidak wajar (00:00 - 05:00 WIB). | **ACTIVE** |

> **[ TEMPAT SCREENSHOT #3: Dashboard SIEM & Security Center pada Panel Admin (admin.html) ]**  
> *Panduan:* Buka browser -> Login sebagai Admin -> Buka menu 'SIEM & Security Center'. Screenshot tampilan 4 kartu statistik telemetri dan tombol simulasi serangan.

> **[ TEMPAT SCREENSHOT #4: Tabel Live Security Alerts Feed & Aturan Deteksi MITRE ATT&CK ]**  
> *Panduan:* Masih di menu SIEM & Security Center. Gulir ke bawah untuk menampilkan tabel riwayat alert insiden beserta badge MITRE ATT&CK dan status mitigasinya.

> **[ TEMPAT SCREENSHOT #5: Simulasi Serangan Terdeteksi & Alert Pop-up Toast Keamanan ]**  
> *Panduan:* Klik tombol 'Jalankan Simulasi Deteksi Serangan'. Screenshot saat notifikasi toast peringatan merah/oranye muncul di pojok layar dan tabel alert ter-update otomatis.

---

## BAB 3. AI-DRIVEN THREAT DETECTION & ANOMALY EVALUATION

Sesuai arahan RPS, pilar ketiga mengembangkan prototipe sistem deteksi ancaman cerdas (Machine Learning) untuk mengenali anomali lalu lintas autentikasi yang tidak dapat ditangkap oleh aturan statis berbasis regex konvensional.

### 3.1 Ekstraksi Fitur & Pembentukan Dataset (Feature Engineering)
Sebanyak 1.200 baris rekaman log autentikasi disintesis dari perilaku pengguna nyata dan simulasi serangan: 1.050 data normal (87.5%) dan 150 data serangan (12.5%). Fitur-fitur keamanan yang diekstrak meliputi:
* `login_hour`: Jam login pengguna (0-23)
* `failed_attempts_5m`: Akumulasi kegagalan autentikasi dalam 5 menit
* `request_rate_per_min`: Frekuensi request HTTP per menit (membedakan manusia vs bot script)
* `ip_entropy`: Ukuran entropi pergantian IP
* `payload_risk_score`: Skor indikasi pola karakter berbahaya

### 3.2 Implementasi Model Isolation Forest & Random Forest
* **Isolation Forest (Unsupervised):** Membangun 100 Isolation Trees (iTrees) dengan sub-sampling 256 data. Algoritma mengisolasi titik anomali lebih cepat (*path length* $h(x)$ pendek) dibanding titik normal, menetapkan ambang skor anomali $s(x) \ge$ persentil ke-88.
* **Random Forest (Supervised Baseline):** Digunakan sebagai pembanding terarah (*supervised baseline*) untuk menguji kemampuan model klasifikasi dalam memisahkan pola serangan berdasar label riwayat.

### 3.3 Hasil Evaluasi Kinerja Model (Precision, Recall, F1-Score, False Positives)

| Metrik Evaluasi | Isolation Forest (Unsupervised) | Random Forest (Supervised) | Interpretasi Hasil Kinerja |
| :--- | :---: | :---: | :--- |
| **Akurasi (Accuracy)** | **98.33%** | **99.33%** | Tingkat ketepatan klasifikasi total sangat tinggi pada data uji. |
| **Presisi (Precision)** | **97.22%** | **95.12%** | Dari seluruh prediksi ancaman, hanya sedikit sekali alarm palsu. |
| **Daya Ingat (Recall)** | **89.74%** | **100.00%** | Kemampuan mendeteksi seluruh serangan aktual yang masuk. |
| **F1-Score** | **93.33%** | **97.50%** | Harmoni sempurna antara Presisi dan Recall. |
| **False Positive Rate (FPR)** | **0.38%** | **0.77%** | Tingkat false positive di bawah 1%, menjamin operasional tidak terganggu. |

*Confusion Matrix Isolation Forest pada 300 data uji: True Positive (TP) = 35, False Positive (FP) = 1, True Negative (TN) = 260, False Negative (FN) = 4.*

> **[ TEMPAT SCREENSHOT #6: Grafik Sebaran Deteksi Anomali AI (ai_anomaly_scatter.png) ]**  
> *Panduan:* Buka folder `ai/` -> Buka gambar `ai_anomaly_scatter.png` (menampilkan sebaran titik biru trafik normal vs segitiga merah anomali serangan). Screenshot grafik tersebut.

> **[ TEMPAT SCREENSHOT #7: Diagram Batang Evaluasi Metrik Kinerja AI (ai_metrics_comparison.png) ]**  
> *Panduan:* Buka folder `ai/` -> Buka gambar `ai_metrics_comparison.png` (diagram perbandingan Precision, Recall, F1-Score, Accuracy). Screenshot diagram tersebut.

> **[ TEMPAT SCREENSHOT #8: Jupyter Notebook Deteksi Ancaman AI (ai_threat_detection.ipynb) ]**  
> *Panduan:* Buka file `ai/ai_threat_detection.ipynb` di VS Code (atau Jupyter Lab). Screenshot kode dan output evaluasi metrik model.

---

## BAB 4. INCIDENT RESPONSE PLAYBOOK & TABLETOP SIMULATION

Pilar keempat menerapkan kerangka kerja kesiapan tanggap insiden siber sesuai standar NIST SP 800-61 Rev. 3 dan fungsi Respond-Recover pada NIST CSF 2.0 guna meminimalisasi dampak operasional saat terjadi insiden nyata.

### 4.1 Siklus Tanggap Insiden 5 Fase (NIST SP 800-61r3)
1. **Preparation:** Penyusunan tim Computer Security Incident Response Team (CSIRT), pemetaan kontak darurat, serta penyiapan alat analisis log telemetri.
2. **Detection & Analysis:** Identifikasi anomali melalui alert SIEM Center (RULE-01 s.d. RULE-05) dan skor ancaman model AI.
3. **Containment:** Isolasi langsung terhadap IP penyerang melalui rule firewall Nginx dan penguncian sementara akun yang menjadi target serangan.
4. **Eradication & Recovery:** Pembersihan payload injeksi dari database, penegakan reset kata sandi, dan pemulihan layanan secara aman.
5. **Post-Incident Activity:** Evaluasi Mean Time to Detect (MTTD), Mean Time to Respond (MTTR), serta pembaruan aturan pertahanan.

### 4.2 Bukti Pelaksanaan Latihan Tabletop (Tabletop Exercise / TTX)
Simulasi skenario serangan ganda (Brute Force + Injeksi XSS) dijalankan oleh tim mahasiswa. Dalam durasi 15 menit, alur deteksi berhasil mengenali serangan pada menit ke-0, melakukan pembatasan isolasi pada menit ke-6, dan menuntaskan verifikasi integritas data pada menit ke-10 tanpa ada kebocoran data pelanggan.

> **[ TEMPAT SCREENSHOT #9: Dokumen SOP Incident Response Playbook (playbook-nist-sp800-61r3.md) ]**  
> *Panduan:* Buka file `incident-response/playbook-nist-sp800-61r3.md` di VS Code. Screenshot tahapan penanganan insiden brute force dan XSS.

> **[ TEMPAT SCREENSHOT #10: Catatan Kronologi Tabletop Simulation & Remediation Closure ]**  
> *Panduan:* Buka file `incident-response/tabletop-simulation.md` di VS Code. Screenshot tabel kronologi insiden T+00 hingga T+15 dan bukti penutupan celah.

---

## BAB 5. KESIMPULAN

Implementasi Milestone Fase 4 pada aplikasi web e-commerce Keripik Kentang (Kentang Emas) telah tuntas diselesaikan dengan hasil:
* **Validasi Ofensif Tervalidasi:** Seluruh 5 temuan kerentanan (Brute force, XSS, Info leak, Privilege escalation, Dotfiles) telah berhasil diidentifikasi dan ditutup 100%.
* **Telemetri SIEM Terpusat:** Panel admin kini memiliki SIEM & Security Center dengan 5 detection rules aktif dan pemetaan MITRE ATT&CK for Enterprise.
* **Deteksi Cerdas Berbasis AI:** Model Isolation Forest dan Random Forest berhasil dilatih dengan akurasi 98.33% dan false positive rate sangat rendah (0.38%).
* **Kesiapan Tanggap Insiden:** SOP Incident Response Playbook berbasis NIST SP 800-61r3 telah tersusun dan teruji melalui simulasi tabletop.
