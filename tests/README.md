# Testing & Bukti — Fase 3

## Skenario Pengujian

### Skenario 1: Pipeline Menolak (Insecure Config)
File `insecure-test.js` sengaja berisi:
- Hardcoded API key / password
- Hardcoded GitHub token (ghp_...)
- Kerentanan XSS
- Kerentanan SQL Injection

**Hasil yang diharapkan:** Pipeline GAGAL di step Secret Scanning / SAST

### Skenario 2: Pipeline Lolos (Setelah Fix)
File `secure-test.js` berisi versi yang sudah diperbaiki:
- Secret dari environment variables
- Parameterized query (anti SQL Injection)
- Input sanitization (anti XSS)

**Hasil yang diharapkan:** Pipeline LOLOS semua scan

## Cara Menjalankan Pengujian

### Local (dengan Semgrep):
```bash
pip install semgrep
# Test insecure (harus error):
semgrep --config=p/javascript tests/insecure-test.js
# Test secure (harus lolos):
semgrep --config=p/javascript tests/secure-test.js
```

### Via GitHub Actions:
1. Push `insecure-test.js` ke branch ? pipeline GAGAL
2. Push `secure-test.js` ? pipeline LOLOS
