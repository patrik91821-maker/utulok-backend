// Routa pre nahrávanie obrázkov na Cloudinary

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import Cloudinary konfigurácie z tvojho config súboru
const cloudinary = require('../config/cloudinaryConfig'); 

// ------------------------------------------
// 1. MULTER KONFIGURÁCIA (Dočasné lokálne ukladanie)
// ------------------------------------------

// Multer nastavíme, aby súbory ukladal do dočasného priečinka 'uploads/'
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        // Vytvorí priečinok, ak neexistuje
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Vytvorí jedinečný názov súboru s originálnou príponou (pre Cloudinary)
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Limit na 10MB
});


// ------------------------------------------
// 2. POST ROUTE PRE NAHRÁVANIE
// ------------------------------------------

// Endpoint: POST /api/uploads
router.post('/', upload.single('image'), async (req, res) => {
    // 'image' musí zodpovedať názvu poľa (form field name) v klientskom formulári
    
    if (!req.file) {
        return res.status(400).json({ error: 'Nenašiel sa žiadny súbor pre nahrávanie.' });
    }

    const tempFilePath = req.file.path;
    
    try {
        // Nahraj súbor do Cloudinary
        const result = await cloudinary.uploader.upload(tempFilePath, {
            folder: 'utulok_dogs', // Konkrétny priečinok v Cloudinary
            // Možeš tu pridať ďalšie možnosti ako transformácie, tags, atď.
        });

        // POZNÁMKA: Čistenie je KĽÚČOVÉ pre správu pamäte!
        // Odstráň dočasný súbor z lokálneho disku po úspešnom nahratí
        fs.unlinkSync(tempFilePath); 

        // Vráť klientovi URL nového obrázka a jeho verejné ID
        res.status(200).json({
            message: 'Súbor bol úspešne nahraný.',
            imageUrl: result.secure_url,
            publicId: result.public_id
        });

    } catch (error) {
        console.error('Chyba pri nahrávaní súboru do Cloudinary:', error);
        
        // Ak nahrávanie zlyhá, uisti sa, že dočasný súbor odstrániš
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath); 
        }

        res.status(500).json({ error: 'Nahrávanie na Cloudinary zlyhalo.', details: error.message });
    }
});

module.exports = router;
