const express = require('express');
const knex = require('../db');
// Oprava importu: Používame naše custom middleware funkcie
const { protect, shelterManager } = require('../middleware/auth'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// PRIDANIE IMPORTU CONTROLLERU
const dogController = require('../controllers/dog.controller'); 

const router = express.Router();

// --- Konfigurácia Multer pre nahrávanie súborov ---

// Zabezpečí, že adresár 'uploads' existuje
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Nastavenie úložiska: ukladá do /uploads s unikátnym názvom súboru
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // Vytvoríme unikátne meno súboru
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({ storage });

// ---------------------------------------------------

// Public: list adoptable dogs (only from active shelters)
router.get('/', async (req, res) => {
  try {
    const rows = await knex('dogs')
      .join('shelters', 'dogs.shelter_id', 'shelters.id')
      .where('shelters.active', true)
      .select('dogs.*');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Public: get dog detail
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const d = await knex('dogs').where({ id }).first();
    if (!d) return res.status(404).json({ error: 'Not found' });
    const attachments = await knex('attachments').where({ dog_id: id });
    res.json({ ...d, attachments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// --- RUTA PRE PRIDANIE PSA (KROK 1: Textové dáta) ---
// Používame dogController.addDog na spracovanie a vrátenie nového ID psa.
router.post('/create', protect, shelterManager, dogController.addDog);


// --- RUTA PRE NAHRÁVANIE PRÍLOHY (KROK 2: Fotka) ---
// Upload attachment for dog (multipart/form-data) - VRÁTI ID PRÍLOHY
router.post('/:id/attachments', protect, upload.single('file'), async (req, res) => {
  const dogId = parseInt(req.params.id, 10);
  
  // Kontrola, či existuje súbor
  if (!req.file) return res.status(400).json({ error: 'Súbor je povinný.' });
  
  // Kontrola, či ID psa existuje
  if (isNaN(dogId)) return res.status(400).json({ error: 'Neplatné ID psa.' });

  // URL súboru, ktorý sa bude servírovať staticky
  const url = `/uploads/${req.file.filename}`; 
  
  try {
    // 1. Vloženie záznamu prílohy do tabuľky 'attachments'
    const [aid] = await knex('attachments').insert({ dog_id: dogId, url, filename: req.file.originalname }).returning('id');
    const attach = await knex('attachments').where({ id: aid }).first();
    
    // 2. KĽÚČOVÁ ZMENA: Aktualizácia hlavnej image_url pre psa
    // Vždy, keď je nahraná nová príloha, nastavíme ju ako hlavný obrázok psa.
    const success = await dogController.updateDogImageUrl(dogId, url); 
    
    if (!success) {
      // Toto by nemalo nastať, ak databáza funguje
      console.warn('Nepodarilo sa aktualizovať hlavný obrázok psa, ale príloha bola uložená.');
    }

    res.json(attach);
  } catch (err) {
    console.error('Chyba pri nahrávaní prílohy:', err);
    // Odstránenie súboru, ak zlyhá DB operácia (dobrý zvyk)
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: 'Nahrávanie zlyhalo.' });
  }
});

module.exports = router;
