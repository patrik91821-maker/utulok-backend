const express = require('express');
const knex = require('../db');
// Oprava importu: Používame naše custom middleware funkcie
const { protect, shelterManager } = require('../middleware/auth'); 
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Predpokladáme, že máte funkciu addDog v tomto súbore:
const dogController = require('../controllers/dog.controller'); 

const router = express.Router();

// uploads dir
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({ storage });

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

// --- RUTA PRE PRIDANIE PSA (NOVÁ A ZJEDNODUŠENÁ) ---
// Používame middleware na overenie, či je užívateľ manažér útulku.
// dogController.addDog spracuje validáciu a vloženie do DB, pričom 
// použije shelter_id z req.user.
router.post('/create', protect, shelterManager, dogController.addDog);


// Upload attachment for dog (multipart/form-data) - returns attachment record
router.post('/:id/attachments', protect, upload.single('file'), async (req, res) => {
  const dogId = req.params.id;
  // Kontrola vlastníctva by mala byť pridaná tu! (Nie je to súčasťou pôvodnej logiky, ale je dôležitá)
  if (!req.file) return res.status(400).json({ error: 'File required' });
  const url = `/uploads/${req.file.filename}`; // served statically
  try {
    const [aid] = await knex('attachments').insert({ dog_id: dogId, url, filename: req.file.originalname }).returning('id');
    const attach = await knex('attachments').where({ id: aid }).first();
    res.json(attach);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
