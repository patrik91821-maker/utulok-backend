// Cloudinary Konfigurácia pre Node.js Backend

// 1. Načítanie dotenv (iba lokálne)
// Ak bežíš na Rendere, Render už premenné nastavil, takže táto časť má zmysel len lokálne.
// Ak máš načítanie .env už v hlavnom súbore (napr. server.js), túto sekciu nepotrebuješ.
// try {
//     require('dotenv').config();
// } catch (error) {
//     // Chyba pri načítaní .env súboru, predpokladá sa produkčné prostredie (Render)
// }

// 2. Import Cloudinary knižnice
const cloudinary = require('cloudinary').v2;

// 3. Konfigurácia Cloudinary
// Všetky tri kľúče (cloud_name, api_key, api_secret) sa načítajú z process.env.
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
    secure: true // Odporúča sa pre bezpečné HTTPS URL
});

// Export konfigurovaného objektu Cloudinary
module.exports = cloudinary;

console.log("Cloudinary konfigurovaný pre cloud:", process.env.CLOUDINARY_CLOUD_NAME);