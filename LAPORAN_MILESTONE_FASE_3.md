# LAPORAN MILESTONE FASE 3
## Implementasi Keamanan Aplikasi Web — Keripik Kentang Emas

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

## RINGKASAN EKSEKUTIF PROYEK

Aplikasi web e-commerce "Kentang Emas" (Keripik Kentang Premium) merupakan platform perdagangan digital berbasis cloud yang melayani transaksi pemesanan produk secara daring. Pada era modern di mana ancaman siber terhadap platform transaksi semakin masif dan kompleks, keandalan fungsional saja tidak mencukupi tanpa adanya pertahanan keamanan berlapis (*Defense-in-Depth*). Laporan Milestone Fase 3 ini mendokumentasikan implementasi holistik pengamanan sistem yang mencakup empat pilar fundamental: **Cloud Infrastructure Security**, **Containerization Hardening (Docker & Kubernetes)**, **DevSecOps Automated CI/CD Pipeline**, serta **Verifikasi Empiris Pengujian Keamanan (Security Testing & Verification)**.

Seluruh arsitektur dibangun dengan mematuhi standar industri global seperti OWASP Top 10 Web Application Security Risks, Center for Internet Security (CIS) Benchmarks for Docker & Kubernetes, serta prinsip Zero Trust Network Architecture. Melalui laporan ini, tim memaparkan rincian teknis konfigurasi, mekanisme mitigasi ancaman, alur otomatisasi scanning, hingga pengujian skenario injeksi celah keamanan riil untuk membuktikan ketangguhan sistem.

---

## BAB 1. CLOUD SECURITY (KEAMANAN SERVER & CLOUD)

Pilar pertama difokuskan pada pengamanan aset cloud, kontrol akses pengguna, pengerasan lapisan web server, manajemen rahasia terpusat, dan pemantauan jejak digital secara berkelanjutan.

### 1.1 Latar Belakang & Model Ancaman Cloud (Threat Modeling)
Sebagai aplikasi e-commerce, ancaman siber utama yang berpotensi menyerang platform Kentang Emas meliputi:
1. **Broken Access Control:** Penyerang berusaha mengakses atau memanipulasi pesanan pengguna lain tanpa izin.
2. **Privilege Escalation:** Akun pelanggan biasa mencoba menaikkan hak akses menjadi Administrator untuk memanipulasi katalog harga atau data pembayaran.
3. **Unrestricted File Upload:** Penyerang berupaya mengunggah web shell atau malware ke media storage produk.
4. **Cross-Site Scripting (XSS) & Clickjacking:** Menargetkan pencurian sesi otentikasi browser pelanggan atau manipulasi klik antarmuka.

### 1.2 Pengaturan Hak Akses: Role-Based Access Control (RBAC) pada Firestore Database
Pada aplikasi modern berbasis Serverless NoSQL Database (Google Cloud Firestore), keamanan data tidak diserahkan pada logika frontend karena kode JavaScript sisi klien dapat dimodifikasi oleh penyerang. Oleh karena itu, otorisasi data diproteksi langsung di tingkat basis data cloud menggunakan Firestore Security Rules (`firestore.rules`) dengan versi rule engine v2:

* **Otentikasi Berbasis Token JWT:** Setiap request diperiksa validitas tokennya melalui `request.auth != null`. Request anonim yang tidak memiliki payload token otentikasi langsung ditolak di gerbang database.
* **Pemisahan Peran Pengguna (RBAC):** Fungsi helper `isAdmin()` melakukan pengecekan ke dokumen `/users/$(request.auth.uid)` untuk memastikan bahwa role yang terdaftar benar-benar bernilai `'admin'` sebelum mengizinkan modifikasi katalog produk atau pengelolaan transaksi global.
* **Prinsip Kepemilikan Data (Data Ownership):** Fungsi `isOwner(uid)` menjamin bahwa pelanggan hanya dapat membaca, mengedit profil, serta melihat riwayat pesanan miliknya sendiri.
* **Mitigasi Anti-Privilege Escalation:** Fungsi `noSensitiveFieldChanged()` menggunakan operator `diff(resource.data).affectedKeys()` untuk mendeteksi perubahan atribut. Jika pelanggan mencoba menyisipkan payload yang mengubah field `'role'`, `'isActive'`, `'createdAt'`, atau `'uid'`, mutasi data tersebut langsung digagalkan.
* **Integritas Skema Data:** Seluruh data transaksi, ulasan produk, dan keranjang belanja divalidasi tipe datanya (string, integer, timestamp) serta batas panjang karakternya guna mencegah *database poisoning* dan *bloating*.

```javascript
// Implementasi Cuplikan Aturan RBAC & Anti-Escalation (firestore.rules)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function isAdmin() {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    function isOwner(uid) { return isAuthenticated() && request.auth.uid == uid; }
    function noSensitiveFieldChanged() {
      return !request.resource.data.diff(resource.data)
        .affectedKeys().hasAny(['role', 'isActive', 'createdAt', 'uid']);
    }
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow update: if (isOwner(userId) && noSensitiveFieldChanged()) || isAdmin();
    }
  }
}
```

> **[ TEMPAT SCREENSHOT #1: Konfigurasi Firestore Security Rules pada Firebase Console ]**  
> *Panduan Screenshot:* Buka Firebase Console -> Firestore Database -> Tab 'Rules'. Ambil tangkapan layar tampilan editor rules yang menampilkan fungsi otorisasi di atas.

### 1.3 Pengamanan Media Cloud Storage (storage.rules)
Penyimpanan media produk (Firebase Storage) berisiko tinggi terhadap serangan *Unrestricted File Upload* jika penyerang mengunggah skrip berbahaya (misal: .php, .html phishing, atau file biner executable). Pengamanan diterapkan secara terpusat melalui `storage.rules`:
* **Pembatasan MIME Type:** Fungsi `isImageFile()` memverifikasi bahwa header konten wajib berformat gambar resmi (`request.resource.contentType.matches('image/.*')`).
* **Pembatasan Ukuran Payload:** Ukuran unggahan dibatasi secara tegas maksimal 5 Megabyte (`request.resource.size < 5 * 1024 * 1024`) untuk mencegah serangan *Denial of Wallet* atau kehabisan kuota storage.
* **Isolasi Path Terstruktur:** Pengunggahan hanya diizinkan pada direktori `/products/{fileName}` oleh akun yang terotentikasi. Semua direktori lain menerapkan kebijakan *Default Deny* (`allow read, write: if false;`).

> **[ TEMPAT SCREENSHOT #2: Konfigurasi Firebase Storage Security Rules ]**  
> *Panduan Screenshot:* Buka Firebase Console -> Storage -> Tab 'Rules'. Screenshot aturan validasi gambar dan kebijakan penolakan akses global.

### 1.4 Pengerasan Web Server Nginx & HTTP Security Headers
Aplikasi web didistribusikan menggunakan web server Nginx yang telah dikonfigurasi secara khusus (`nginx.conf`) untuk menyematkan header keamanan HTTP mutakhir. Header ini bertindak sebagai instruksi wajib bagi browser klien untuk menolak eksekusi konten yang mencurigakan:
* **Content-Security-Policy (CSP):** Menetapkan whitelist domain sumber eksekusi aset. Skrip dan gaya hanya diizinkan dari domain internal (`'self'`) dan domain terpercaya (Google Fonts, Firebase APIs, GStatic). Hal ini secara efektif melumpuhkan serangan Cross-Site Scripting (XSS) dan injeksi skrip pihak ketiga.
* **X-Frame-Options: SAMEORIGIN:** Melarang situs lain memuat halaman web Kentang Emas ke dalam tag `<iframe>`, `<frame>`, atau `<embed>`, sehingga mematikan teknik serangan Clickjacking dan UI Redressing.
* **X-Content-Type-Options: nosniff:** Menginstruksikan browser untuk selalu mematuhi MIME Type yang dideklarasikan oleh server dan melarang browser melakukan *MIME-sniffing* yang sering dimanfaatkan untuk mengeksekusi payload tersembunyi.
* **X-XSS-Protection: 1; mode=block:** Mengaktifkan filter XSS internal pada peramban web lawas untuk langsung menghentikan render halaman jika terdeteksi injeksi skrip berbahaya.
* **Permissions-Policy:** Menonaktifkan secara permanen akses terhadap modul sensitif perangkat pengguna seperti kamera, mikrofon, dan geolokasi (`geolocation=(), microphone=(), camera=()`).
* **Server Version Masking (`server_tokens off`):** Menyembunyikan informasi spesifik versi Nginx dari respon HTTP Header guna mencegah penyerang melakukan profiling celah keamanan spesifik versi (*vulnerability banner reconnaissance*).
* **Pemblokiran Akses Dotfiles (.git, .env):** Server secara eksplisit mengonfigurasi directive `location ~ /\.(git|env|firebase|dockerignore) { deny all; return 404; }` sehingga file rahasia repositori dan kredensial lingkungan tidak dapat diunduh langsung lewat peramban web.

> **[ TEMPAT SCREENSHOT #3: Verifikasi HTTP Security Headers melalui Browser Developer Tools / curl ]**  
> *Panduan Screenshot:* Buka website di browser -> Tekan F12 -> Tab Network -> Klik request halaman utama -> Tab Headers. Screenshot baris Response Headers yang memuat CSP, X-Frame-Options, dan server_tokens.

### 1.5 Manajemen Rahasia (Secrets Management) dan Logging
Manajemen data rahasia menerapkan pemisahan tegas antara basis kode dan kredensial:
1. **Variabel Lingkungan Lokal:** Menggunakan template `.env.example` yang aman, sedangkan file `.env` dan token SDK JSON dikecualikan dari Git melalui `.gitignore`.
2. **CI/CD Cloud Secrets:** Deployment ke Firebase Hosting memanfaatkan token terenkripsi yang disimpan pada GitHub Actions Secrets (`${{ secrets.FIREBASE_TOKEN }}`).
3. **Logging & Monitoring:** Seluruh request HTTP dicatat ke log Nginx (`access.log` dan `error.log`) dengan rotasi otomatis, serta pemantauan kueri Firestore melalui Google Cloud Monitoring.

---

## BAB 2. DOCKER & KUBERNETES (CONTAINER & ORCHESTRATION HARDENING)

Pilar kedua berfokus pada enkapsulasi aplikasi ke dalam container yang ringan, aman, dan tervendorisasi, serta orkestrasinya pada klaster Kubernetes dengan pengerasan parameter isolasi tingkat tinggi sesuai standar keamanan CIS Benchmarks.

### 2.1 Keamanan Kontainer Docker: Desain dan Hardening Dockerfile
Secara default, container Docker sering kali dijalankan menggunakan user `root`, yang sangat berbahaya karena jika terjadi *container breakout*, penyerang akan langsung mendapatkan hak akses root pada sistem operasi host. Dockerfile proyek Kentang Emas dirancang dengan serangkaian langkah mitigasi proaktif:
* **Penggunaan Base Image Minimal:** Memilih `nginx:1.27-alpine`. Distro Alpine Linux memiliki ukuran yang sangat kecil (~20MB) dan menghilangkan biner/utilitas bawaan yang tidak diperlukan (seperti curl, gcc, bash), sehingga drastis mempersempit surface area kerentanan.
* **Penerapan User Non-Root (Least Privilege):** Membuat user dan grup khusus `appuser:appgroup` dengan UID/GID 1001. Seluruh kepemilikan direktori web, cache, dan log dialihkan ke user ini sebelum deklarasi perintah `USER appuser`.
* **Manajemen PID File Nginx:** Karena user non-root tidak memiliki izin menulis ke direktori default `/var/run`, file PID dibuat dan dialokasikan izin kepemilikannya terlebih dahulu (`touch /var/run/nginx.pid && chown appuser /var/run/nginx.pid`).
* **Eliminasi File Non-Produksi:** Perintah build menghapus file konfigurasi build-time seperti Dockerfile, docker-compose.yml, k8s manifests, dan rules file agar tidak terekspos di dalam container produksi.
* **Pemeriksaan Kesehatan Otomatis (HEALTHCHECK):** Container dilengkapi dengan instruksi pemeriksaan kesehatan otomatis setiap 30 detik menggunakan spider probe HTTP pada port 8080 untuk memastikan kontainer yang mengalami freeze/deadlock dapat dideteksi dan di-restart secara mandiri.

```dockerfile
# Cuplikan Pengerasan Keamanan pada Dockerfile
FROM nginx:1.27-alpine
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*
WORKDIR /usr/share/nginx/html
COPY . .
RUN rm -f Dockerfile docker-compose.yml firestore.rules storage.rules firebase.json
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && chown -R appuser:appgroup /var/run/nginx.pid
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s CMD wget --spider http://localhost:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

> **[ TEMPAT SCREENSHOT #4: Hasil Build Docker Image dan Pemeriksaan Non-Root User ]**  
> *Panduan Screenshot:* Jalankan `docker build -t keripik-kentang:test .` lalu `docker run --rm keripik-kentang:test whoami` (menghasilkan 'appuser'). Screenshot output terminal tersebut.

### 2.2 Orkestrasi dan Pengerasan Klaster Kubernetes (k8s/deployment.yaml)
Orkestrasi kontainer menggunakan Kubernetes tidak hanya mengatur ketersediaan tinggi (*high availability* melalui 2 replika Pod), tetapi juga mengunci batasan hak istimewa kontainer secara ketat:
* **Pod-Level Security Context:** Mengaktifkan `runAsNonRoot: true`, `runAsUser: 1001`, `runAsGroup: 1001`, `fsGroup: 1001`, serta menerapkan profil seccomp `RuntimeDefault` untuk membatasi pemanggilan system calls yang berbahaya ke kernel node host.
* **Container-Level Security Context:** Mengaktifkan `allowPrivilegeEscalation: false` guna memblokir mekanisme eskalasi melalui suid/sgid binary. Seluruh Linux Capabilities dicopot secara total (`drop: [ALL]`) dan hanya menyematkan `NET_BIND_SERVICE`.
* **Read-Only Root Filesystem:** Mengaktifkan `readOnlyRootFilesystem: true`. Seluruh struktur direktori kontainer terkunci permanen. Penyerang yang berhasil menyusup tidak akan dapat mengunduh atau menulis skrip backdoor pada disk kontainer.
* **Penyimpanan Ephemeral Terisolasi (tmpfs):** Untuk direktori dinamis yang mutlak membutuhkan operasi tulis saat Nginx berjalan (`/tmp`, `/var/cache/nginx`, `/var/run`), digunakan volume `emptyDir` berbasis RAM terisolasi.
* **Resource Quotas & Throttling:** Dikonfigurasi limit sumber daya: Request 100m CPU / 64Mi RAM dan Limit 500m CPU / 256Mi RAM. Parameter ini menjamin kontainer tidak akan mengonsumsi memori berlebih yang berpotensi memicu kondisi Out-Of-Memory (OOM) pada node.

### 2.3 Isolasi Jaringan Mikro: Kubernetes Network Policy (k8s/network-policy.yaml)
Secara default, jaringan Kubernetes bersifat flat di mana setiap Pod dapat berkomunikasi bebas dengan Pod lain. Untuk mencegah pergerakan lateral penyerang (*lateral movement*), diimplementasikan Kubernetes NetworkPolicy berbasis Zero Trust:
* **Ingress Traffic Restriction:** Hanya menerima paket data TCP yang ditujukan ke port internal 8080 dari Service LoadBalancer. Seluruh port lain tertutup.
* **Egress Traffic Restriction:** Paket data keluar dari Pod dibatasi secara ketat hanya pada port 443 (HTTPS terenkripsi ke backend Google Cloud / Firebase) dan port 53 (protokol TCP/UDP untuk DNS resolution). Koneksi liar ke jaringan internal klaster lain atau port eksternal non-standar diblokir secara otomatis di level firewall jaringan Kubernetes.

> **[ TEMPAT SCREENSHOT #5: Penerapan Kubernetes Manifest (Deployment, Service, NetworkPolicy) ]**  
> *Panduan Screenshot:* Buka terminal klaster k8s atau VS Code pada folder k8s/ (deployment.yaml dan network-policy.yaml). Screenshot konfigurasi securityContext dan NetworkPolicy.

---

## BAB 3. DEVSECOPS (PIPELINE OTOMASI KEAMANAN CI/CD)

Pilar ketiga mentransformasikan paradigma pengembangan perangkat lunak tradisional menjadi DevSecOps melalui prinsip **"Shift-Left Security"**. Keamanan tidak lagi menjadi tahapan pengujian terpisah di akhir, melainkan diotomatisasi secara ketat pada setiap iterasi kode sebelum proses rilis diizinkan.

### 3.1 Arsitektur Pipeline GitHub Actions (.github/workflows/devsecops.yml)
Pipeline dikonfigurasi menggunakan GitHub Actions yang dieksekusi secara otomatis setiap kali ada event `push` atau `pull_request` ke branch utama (`main`/`master`). Pipeline ini terdiri dari 5 tahapan job yang saling bergantung dengan mekanisme *Fail-Fast Gatekeeper*:

| Tahapan / Job | Tools Keamanan | Kategori Keamanan | Mekanisme Pemindaian & Parameter |
| :--- | :--- | :--- | :--- |
| **Job 1: secret-scan** | TruffleHog v4 | Secret Scanning | Memindai seluruh riwayat commit git dan mendeteksi token/password menggunakan analisis entropy dan verified detector flags. |
| **Job 2: sast-scan** | Semgrep SAST | Static Application Security | Menganalisis kode JavaScript & HTML menggunakan ruleset `p/javascript`, `p/html`, dan `p/owasp-top-ten`. |
| **Job 3: dependency-audit** | NPM Audit | Supply Chain Security | Memeriksa manifest dependensi pihak ketiga terhadap database CVE publik dengan ambang batas `--audit-level=high`. |
| **Job 4: docker-scan** | Aqua Security Trivy | Container Security | Membangun image kontainer dan memindai paket OS Alpine serta dependensi terhadap celah `CRITICAL,HIGH`. |
| **Job 5: deploy** | Firebase CLI | Automated Release | Mengeksekusi `firebase deploy --only hosting` HANYA JIKA Job 1, 2, 3, dan 4 berstatus SUCCESS 100%. |

### 3.2 Analisis Rinci Parameter dan Mekanisme Deteksi Pemindai
* **TruffleHog Secret Scanner:** Mencegah kecerobohan developer yang menaruh kredensial statis pada repositori. TruffleHog memindai hingga ke kedalaman commit terdalam (`fetch-depth: 0`) dan melakukan verifikasi live token untuk memastikan temuan valid.
* **Semgrep SAST Engine:** Bekerja pada level Abstract Syntax Tree (AST). Semgrep mengenali pola semantik kode yang berbahaya, seperti penggabungan string pada kueri SQL (`'SELECT * FROM users WHERE id = ' + input`) dan penulisan DOM langsung tanpa encoding (`document.innerHTML = input`).
* **Aqua Security Trivy:** Memindai basis data kerentanan Common Vulnerabilities and Exposures (CVE). Dengan menyematkan argumen `--ignore-unfixed true`, Trivy memfilter kelemahan yang memang sudah memiliki patch keamanan resmi, sehingga laporan berfokus pada langkah mitigasi yang actionable.
* **Gatekeeper Deployment Logic:** Job deployment didefinisikan dengan `needs: [secret-scan, sast-scan, dependency-audit, docker-scan]`. Apabila salah satu pemindai mendeteksi kerentanan dan mengembalikan non-zero exit code, rantai CI/CD langsung terputus dan proses publikasi ke server hosting dibatalkan secara instan.

> **[ TEMPAT SCREENSHOT #6: Struktur Alur Pipeline DevSecOps pada GitHub Actions ]**  
> *Panduan Screenshot:* Buka GitHub -> Tab Actions -> Workflow 'DevSecOps Pipeline'. Ambil screenshot diagram alur 5 tahapan job yang saling terhubung.

---

## BAB 4. PENGUJIAN DAN BUKTI KEAMANAN (EMPIRICAL VERIFICATION)

Pilar keempat merupakan pembuktian empiris bahwa seluruh mekanisme pengamanan yang dirancang benar-benar berfungsi secara efektif. Pengujian dilakukan melalui metodologi **Dual-Scenario Testing**, yaitu membandingkan respon pipeline terhadap konfigurasi yang sengaja dibuat rentan (*Insecure Test*) melawan konfigurasi yang telah diremediasi (*Secure Test*).

### 4.1 Skenario 1: Pembuktian Penolakan Pipeline terhadap Kode Insecure (tests/insecure-test.js)
Pada tahap pengujian awal, sebuah file pengujian sengaja dibuat tidak aman dengan menyematkan tiga kategori kerentanan kritis yang sering terjadi dalam pengembangan web:
* **Kerentanan Hardcoded Secret:** Menyematkan kredensial statis `DB_PASSWORD = "supersecret123"`, token GitHub `ADMIN_TOKEN = "ghp_..."`, dan private key tiruan langsung di dalam kode program.
* **Kerentanan SQL Injection (CWE-89):** Fungsi `getUserData(userId)` menggabungkan input pengguna secara langsung ke dalam kueri SQL melalui konkatenasi string tanpa validasi atau prepared statement.
* **Kerentanan Cross-Site Scripting / XSS (CWE-79):** Fungsi `displayUserInput(input)` memasukkan konten teks langsung ke dalam properti `document.innerHTML` tanpa melalui fungsi sanitasi atau HTML entity encoding.

```javascript
// Kode Skenario Pengujian 1: Insecure Configuration (tests/insecure-test.js)
const DB_PASSWORD = "supersecret123";
const ADMIN_TOKEN = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456";
const PRIVATE_KEY = "AIzaSyA8IPUinVUOGbNYv5HR6BBigBuo6oSfSuU_FAKE";

function getUserData(userId) {
    return "SELECT * FROM users WHERE id = " + userId; // VULNERABLE TO SQLi
}

function displayUserInput(input) {
    document.innerHTML = input; // VULNERABLE TO XSS
}
```

**Hasil Evaluasi Skenario 1:**  
Ketika commit berisi file `insecure-test.js` di-push ke repositori, TruffleHog langsung mendeteksi signature token GitHub dan password dengan status ERROR. Secara paralel, Semgrep SAST menandai penggunaan innerHTML sebagai kerentanan kritis OWASP Top 10 Injection. Akibatnya, Job Secret-Scan dan Job SAST-Scan menghasilkan status **FAILED (Silang Merah)**. Pipeline CI/CD langsung terhenti, dan Job Deploy secara otomatis **DIBATALKAN / DITOLAK**.

> **[ TEMPAT SCREENSHOT #7: Bukti Pipeline Gagal / Menolak (Insecure Config Triggered) ]**  
> *Panduan Screenshot:* Screenshot halaman GitHub Actions yang menampilkan status FAILED (Silang Merah) pada Job Secret Scan atau SAST saat menguji insecure-test.js.

### 4.2 Skenario 2: Pembuktian Kelolosan Pipeline Setelah Remediasi (tests/secure-test.js)
Setelah pipeline terbukti berhasil mendeteksi dan menolak kode rentan, tahap berikutnya adalah menerapkan teknik remediasi pengkodean aman (*secure coding practices*) pada file `tests/secure-test.js`:
* **Remediasi Secret Management:** Kredensial statis dihapus total dari kode sumber. Nilai rahasia dialihkan menggunakan variabel lingkungan `process.env.DB_PASSWORD` dan `process.env.ADMIN_TOKEN`.
* **Remediasi Anti-SQL Injection:** Fungsi `getUserData(userId)` diubah menggunakan parameterized query dengan prepared statement (`SELECT * FROM users WHERE id = ?`), sehingga input pengguna diperlakukan murni sebagai nilai data, bukan kode yang dapat dieksekusi database.
* **Remediasi Anti-XSS:** Fungsi `displayUserInput(input)` dilengkapi dengan fungsi sanitasi regex yang mengonversi karakter berbahaya menjadi entitas HTML aman (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#x27;`) serta menggunakan manipulasi DOM yang aman melalui `document.getElementById("output").textContent`.

```javascript
// Kode Skenario Pengujian 2: Remediated Configuration (tests/secure-test.js)
const DB_PASSWORD = process.env.DB_PASSWORD; // SECURE: Environment Variable
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = ?"; // SECURE: Parameterized
    return { query, params: [userId] };
}

function displayUserInput(input) {
    const sanitized = input
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    document.getElementById("output").textContent = sanitized; // SECURE: textContent
}
```

**Hasil Evaluasi Skenario 2:**  
Ketika commit yang telah diremediasi di-push, seluruh tahapan pemindai (TruffleHog, Semgrep, NPM Audit, dan Trivy) melaporkan 0 kerentanan aktif. Seluruh job menghasilkan status **SUCCESS (Centang Hijau)**. Kondisi gatekeeper terpenuhi, sehingga Job Deploy ke Firebase Hosting dieksekusi hingga selesai secara otomatis.

> **[ TEMPAT SCREENSHOT #8: Bukti Pipeline Lolos dan Berhasil Deploy (All Checks Green) ]**  
> *Panduan Screenshot:* Screenshot tampilan GitHub Actions saat seluruh 5 job berstatus centang hijau (Passed) dan tahap deploy sukses terpublikasi.

### 4.3 Tabel Perbandingan Komprehensif Hasil Uji Keamanan

| Aspek Evaluasi | Kondisi Sebelum Perbaikan (Insecure) | Kondisi Setelah Perbaikan (Secure) | Tindakan Pipeline CI/CD |
| :--- | :--- | :--- | :--- |
| **Penyimpanan Kredensial** | Hardcoded plain-text token dan password pada script. | Diambil secara dinamis melalui environment variable (`process.env`). | TruffleHog: Blokir pada insecure, Lolos pada secure. |
| **Penanganan Kueri Data** | String concatenation langsung rawan eksploitasi SQLi. | Parameterized query dengan prepared statement (`?` placeholder). | Semgrep SAST: Blokir pada insecure, Lolos pada secure. |
| **Manipulasi Teks DOM** | Direct assignment ke innerHTML tanpa proses pembersihan. | Sanitasi karakter entitas HTML dan penggunaan `textContent`. | Semgrep OWASP: Blokir pada insecure, Lolos pada secure. |
| **Image Kontainer OS** | Potensi kerentanan tinggi jika menggunakan full distro image. | Image Nginx Alpine minimal bebas CVE Critical yang unfixed. | Trivy Scanner: Memastikan keamanan container image. |
| **Otorisasi Deployment** | Dibatalkan secara instan (Deploy stage dilewati/skipped). | Diberikan izin rilis penuh menuju Firebase Hosting live. | Gatekeeper rule: Keamanan terverifikasi sebelum rilis. |

> **[ TEMPAT SCREENSHOT #9: Bukti Aplikasi Web Keripik Kentang Berjalan Normal di Hosting ]**  
> *Panduan Screenshot:* Buka URL website `https://keripik-kentang-1826e.web.app` di browser. Screenshot tampilan halaman utama Kentang Emas yang aktif dan aman.

---

## BAB 5. KESIMPULAN DAN REKOMENDASI PENGEMBANGAN

### 5.1 Kesimpulan Capaian Proyek
Berdasarkan seluruh tahapan perancangan, implementasi, dan pengujian empiris yang telah dilaksanakan pada Milestone Fase 3, dapat disimpulkan bahwa:
1. **Pertahanan Cloud Berlapis:** Keamanan aset cloud telah terpasang kokoh melalui aturan otorisasi desentralisasi pada Firestore & Storage Rules, HTTP Security Headers Nginx, dan proteksi berkas rahasia.
2. **Hardening Kontainer Standar Industri:** Kontainer Docker dan klaster Kubernetes telah mengadopsi prinsip Least Privilege dengan eksekusi non-root, filesystem read-only, kuota sumber daya terukur, serta isolasi lalu lintas mikro via NetworkPolicy.
3. **Otomatisasi DevSecOps Terpadu:** Pipeline CI/CD berhasil mengintegrasikan pemindaian rahasia (TruffleHog), analisis kode statis (Semgrep SAST), audit pustaka (NPM Audit), dan pemindaian kontainer (Trivy) dalam rantai verifikasi otomatis.
4. **Verifikasi Empiris Terbukti:** Pengujian skenario ganda secara nyata membuktikan kemampuan pipeline dalam menolak kode berbahaya dan meloloskan kode yang telah diremediasi secara tepat.

### 5.2 Rekomendasi Pengembangan Lanjutan
Untuk terus meningkatkan postur keamanan aplikasi web Kentang Emas di masa mendatang, tim merekomendasikan:
* **Pengintegrasian DAST:** Mengintegrasikan *Dynamic Application Security Testing* (seperti OWASP ZAP) ke dalam pipeline untuk memindai aplikasi saat runtime.
* **Cloud Runtime Threat Detection:** Menerapkan alat deteksi ancaman waktu-nyata seperti Falco pada klaster Kubernetes.
* **Web Application Firewall (WAF):** Menerapkan WAF berbasis cloud (seperti Cloudflare atau Google Cloud Armor) untuk memitigasi serangan DDoS dan bot scraping.
