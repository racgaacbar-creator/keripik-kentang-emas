// =====================================================
// FILE INI ADALAH VERSI AMAN (setelah diperbaiki)
// Tujuan: membuktikan pipeline LOLOS setelah fix
// =====================================================

// ? GOOD: Secret dari environment variable, BUKAN hardcoded
const DB_PASSWORD = process.env.DB_PASSWORD;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// ? GOOD: Parameterized query (anti SQL Injection)
function getUserData(userId) {
    // Gunakan prepared statement
    const query = "SELECT * FROM users WHERE id = ?";
    return { query, params: [userId] };
}

// ? GOOD: Sanitasi input sebelum ditampilkan (anti XSS)
function displayUserInput(input) {
    const sanitized = input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    document.getElementById("output").textContent = sanitized;
}

console.log("Application started securely");
