// =====================================================
// FIREBASE CONFIGURATION - Keripik Kentang / KentangEmas
// Project: keripik-kentang-1826e
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8IPUinVUOGbNYv5HR6BBigBuo6oSfSuU",
    authDomain: "keripik-kentang-1826e.firebaseapp.com",
    projectId: "keripik-kentang-1826e",
    storageBucket: "keripik-kentang-1826e.firebasestorage.app",
    messagingSenderId: "593874965132",
    appId: "1:593874965132:web:0c61f8147148d5a2dee1a9",
    databaseURL: "https://keripik-kentang-1826e-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export default app;
