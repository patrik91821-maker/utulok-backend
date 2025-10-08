const express = require('express');
const knex = require('../db');
const { protect, shelterManager } = require('../middleware/auth'); 
const multer = require('multer');
const dogController = require('../controllers/dog.controller'); 

// *** Cloudinary Import a Konfigurácia ***
// Predpokladáme, že Cloudinary environment variables sú nastavené:
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); // Pre nahrávanie bufferu z pamäte

// Knihovňu 'streamifier' je potrebné doinštalovať: npm install streamifier

// Cloudinary konfigurácia sa načíta automaticky z env premenných, 
// ak ich máš definované (napr. v .env súbore). 
// Ak nie, musíš ju nakonfigurovať manuálne:
/*
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
*/

const router = express.Router();

// --- Konfigurácia Multer pre ukladanie do PAMÄTE (BUFFER) ---
// Týmto sa vyhneme ukladaniu súborov lokálne na disk servera.
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // Max 5MB
});

// ---------------------------------------------------

// Public: list adoptable dogs (only from active shelters)
router.get('/', dogController.getAllDogs); // Používam implementovanú funkciu z controlleru
router.get('/:id', dogController.getDogById); // Používam implementovanú funkciu z controlleru

// --- RUTA PRE PRIDANIE PSA (KROK 1: Textové dáta) ---
router.post('/create', protect, shelterManager, dogController.addDog);


/**
 * Cloudinary Upload Service: Pomocná funkcia na nahrávanie bufferu.
 * Vráti Promise, ktorá sa resolvne s URL.
 */
const uploadStream = (buffer, dogId) => {
    return new Promise((resolve, reject) => {
        // Vytvorenie streamu pre nahrávanie
        let stream = cloudinary.uploader.upload_stream({
            // Uložíme ich do priečinka špecifického pre psa/útulok
            folder: `utulok-app/dogs/${dogId}`, 
            tags: ['dog-attachment'],
        }, (error, result) => {
            if (result) {
                resolve(result);
            } else {
                reject(error);
            }
        });

        // Pipe-ovanie bufferu z Multeru do Cloudinary streamu
        streamifier.createReadStream(buffer).pipe(stream);
    });
};


// --- RUTA PRE NAHRÁVANIE PRÍLOHY (KROK 2: Fotka) ---
// Súbor je teraz v req.file.buffer
router.post('/:id/attachments', protect, upload.single('file'), async (req, res) => {
    const dogId = parseInt(req.params.id, 10);
    
    // Kontrola, či existuje súbor (ako buffer v pamäti)
    if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Súbor je povinný.' });
    }
    
    if (isNaN(dogId)) return res.status(400).json({ error: 'Neplatné ID psa.' });

    let cloudinaryResult;
    try {
        // 1. Nahrávanie súboru na Cloudinary
        cloudinaryResult = await uploadStream(req.file.buffer, dogId);
        
        // Získanie URL, ktorú Cloudinary vrátil
        const imageUrl = cloudinaryResult.secure_url; 
        const publicId = cloudinaryResult.public_id;

        // 2. Vloženie záznamu prílohy do tabuľky 'attachments'
        const [aid] = await knex('attachments').insert({ 
            dog_id: dogId, 
            url: imageUrl, 
            filename: req.file.originalname,
            public_id: publicId // Uložíme public ID pre prípadné mazanie z Cloudinary
        }).returning('id');
        
        const attach = await knex('attachments').where({ id: aid }).first();
        
        // 3. KĽÚČOVÁ ZMENA: Aktualizácia hlavnej image_url pre psa
        // Teraz používame URL z Cloudinary!
        const success = await dogController.updateDogImageUrl(dogId, imageUrl); 
        
        if (!success) {
             // Zaznamenanie chyby, ak sa neuloží hlavný obrázok do DB
             console.warn('Nepodarilo sa aktualizovať hlavný obrázok psa, ale príloha bola uložená.');
        }

        res.json(attach);
    } catch (err) {
        console.error('Chyba pri nahrávaní alebo DB operácii:', err);
        // Ak nahrávanie zlyhá, nemusíme mazať lokálny súbor, pretože je v pamäti.
        res.status(500).json({ error: 'Nahrávanie na Cloudinary alebo ukladanie do DB zlyhalo.' });
    }
});

// --- RUTA PRE AKTUALIZÁCIU PSA ---
router.put('/:id', protect, shelterManager, dogController.updateDog);
// --- RUTA PRE ZMAZANIE PSA ---
router.delete('/:id', protect, shelterManager, dogController.deleteDog);

module.exports = router;
