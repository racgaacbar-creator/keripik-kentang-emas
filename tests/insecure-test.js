// =====================================================
// FILE INI SENGAJA DIBUAT INSECURE UNTUK PENGUJIAN
// Tujuan: membuktikan pipeline MENOLAK config tidak aman
// =====================================================

// ? BAD: Hardcoded secret/password (pipeline HARUS nolak ini)
const DB_PASSWORD = "supersecret123";
const ADMIN_TOKEN = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ123456";
const PRIVATE_KEY = "AIzaSyA8IPUinVUOGbNYv5HR6BBigBuo6oSfSuU_FAKE";
const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

// ? BAD: SQL Injection vulnerability
function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;  // INSECURE
    return query;
}

// ? BAD: XSS vulnerability  
function displayUserInput(input) {
    document.innerHTML = input;  // INSECURE: tidak di-sanitize
}

console.log("Credentials:", DB_PASSWORD, ADMIN_TOKEN);
