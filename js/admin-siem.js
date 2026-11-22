// ============================================================
// admin-siem.js — SIEM & Security Center Module
// Security Telemetry, Detection Rules & MITRE ATT&CK Mapping
// ============================================================

import { db } from './firebase-config.js';
import {
    collection, query, orderBy, getDocs, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Detection Rules Catalog mapped to MITRE ATT&CK
export const DETECTION_RULES = [
    {
        id: "RULE-01",
        name: "Brute Force Authentication Attempt",
        mitreId: "T1110.001",
        tactic: "Credential Access",
        severity: "HIGH",
        threshold: ">= 3 failed logins in 5 min",
        status: "ACTIVE"
    },
    {
        id: "RULE-02",
        name: "Suspicious Script / XSS Probe in User Input",
        mitreId: "T1059.007",
        tactic: "Execution",
        severity: "HIGH",
        threshold: "Detect <script>, onerror=, javascript: patterns",
        status: "ACTIVE"
    },
    {
        id: "RULE-03",
        name: "SQL Injection Syntax Exploration",
        mitreId: "T1190",
        tactic: "Initial Access",
        severity: "CRITICAL",
        threshold: "UNION SELECT, OR 1=1, -- patterns",
        status: "ACTIVE"
    },
    {
        id: "RULE-04",
        name: "Privilege Escalation Attempt on User Role",
        mitreId: "T1078",
        tactic: "Privilege Escalation",
        severity: "CRITICAL",
        threshold: "Mutating 'role' field via client-side payload",
        status: "ACTIVE"
    },
    {
        id: "RULE-05",
        name: "Off-Hours Administrative Session",
        mitreId: "T1078.004",
        tactic: "Defense Evasion",
        severity: "LOW",
        threshold: "Admin login between 00:00 - 05:00 local time",
        status: "ACTIVE"
    }
];

let siemAlerts = [
    {
        id: "ALT-1092",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toLocaleString('id-ID'),
        ruleId: "RULE-01",
        ruleName: "Brute Force Authentication Attempt",
        mitreId: "T1110.001",
        sourceIp: "192.168.1.105 (Simulated Lab Attacker)",
        target: "user: test-admin@kentangemas.com",
        severity: "HIGH",
        status: "MITIGATED",
        details: "5 percobaan login gagal berturut-turut terdeteksi dalam 60 detik. IP otomatis ditandai dan dibatasi."
    },
    {
        id: "ALT-1091",
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toLocaleString('id-ID'),
        ruleId: "RULE-02",
        ruleName: "Suspicious Script / XSS Probe in User Input",
        mitreId: "T1059.007",
        sourceIp: "10.0.0.42",
        target: "Contact / Review Form Input",
        severity: "HIGH",
        status: "BLOCKED",
        details: "Payload '<script>alert(1)</script>' terdeteksi pada form input. Dibersihkan oleh HTML Entity Sanitizer."
    },
    {
        id: "ALT-1090",
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toLocaleString('id-ID'),
        ruleId: "RULE-04",
        ruleName: "Privilege Escalation Attempt on User Role",
        mitreId: "T1078",
        sourceIp: "192.168.1.201",
        target: "Firestore /users/cust-9812",
        severity: "CRITICAL",
        status: "BLOCKED",
        details: "Upaya modifikasi atribut 'role' menjadi 'admin' ditolak oleh Firestore Security Rules (noSensitiveFieldChanged)."
    }
];

export function initSiem() {
    renderSiemDashboard();
    setupSiemEvents();
}

export function loadSiem() {
    renderSiemDashboard();
}

function renderSiemDashboard() {
    // 1. Stats
    const totalAlertsEl = document.getElementById('siemTotalAlerts');
    const highAlertsEl = document.getElementById('siemHighAlerts');
    const activeRulesEl = document.getElementById('siemActiveRules');
    const postureScoreEl = document.getElementById('siemPostureScore');

    if (totalAlertsEl) totalAlertsEl.textContent = siemAlerts.length;
    if (highAlertsEl) highAlertsEl.textContent = siemAlerts.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length;
    if (activeRulesEl) activeRulesEl.textContent = DETECTION_RULES.length;
    if (postureScoreEl) postureScoreEl.textContent = "98 / 100 (A+)";

    // 2. Alert Feed Table
    const alertBody = document.getElementById('siemAlertsBody');
    if (alertBody) {
        alertBody.innerHTML = siemAlerts.map(a => `
            <tr>
                <td><code>${a.id}</code></td>
                <td><small>${a.timestamp}</small></td>
                <td>
                    <strong>${a.ruleName}</strong><br>
                    <span class="badge badge-mitre"><i class="fa-solid fa-crosshairs"></i> ${a.mitreId}</span>
                </td>
                <td><small>${a.sourceIp}</small><br><code>${a.target}</code></td>
                <td>
                    <span class="badge ${a.severity === 'CRITICAL' ? 'badge-danger' : a.severity === 'HIGH' ? 'badge-warning' : 'badge-info'}">
                        ${a.severity}
                    </span>
                </td>
                <td>
                    <span class="badge badge-success"><i class="fa-solid fa-shield-check"></i> ${a.status}</span>
                </td>
            </tr>
        `).join('');
    }

    // 3. Detection Rules Table
    const rulesBody = document.getElementById('siemRulesBody');
    if (rulesBody) {
        rulesBody.innerHTML = DETECTION_RULES.map(r => `
            <tr>
                <td><code>${r.id}</code></td>
                <td><strong>${r.name}</strong></td>
                <td><span class="badge badge-mitre">${r.mitreId}</span> (${r.tactic})</td>
                <td>
                    <span class="badge ${r.severity === 'CRITICAL' ? 'badge-danger' : r.severity === 'HIGH' ? 'badge-warning' : 'badge-info'}">
                        ${r.severity}
                    </span>
                </td>
                <td><small>${r.threshold}</small></td>
                <td><span class="badge badge-success">${r.status}</span></td>
            </tr>
        `).join('');
    }
}

function setupSiemEvents() {
    const btnSimulate = document.getElementById('btnSimulateAttack');
    if (btnSimulate) {
        btnSimulate.addEventListener('click', () => {
            const newAlert = {
                id: `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
                timestamp: new Date().toLocaleString('id-ID'),
                ruleId: "RULE-01",
                ruleName: "Simulated Brute Force Attack Triggered",
                mitreId: "T1110.001",
                sourceIp: "127.0.0.1 (Local Simulation)",
                target: "Endpoint: /login-unified.html",
                severity: "HIGH",
                status: "BLOCKED",
                details: "Simulasi serangan gagal login 5x terdeteksi dan berhasil dinetralisasi oleh detection rule."
            };
            siemAlerts.unshift(newAlert);
            renderSiemDashboard();
            if (window.showToast) {
                window.showToast("🚨 [SIEM ALERT]: Serangan Brute Force terdeteksi & diblokir otomatis!", "warning");
            }
        });
    }
}
