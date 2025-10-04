const express = require('express');
const knex = require('../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Create dog (only shelter_admin). body must contain shelter_id that belongs to user.
router.post('/create', authMiddleware, async (req, res) => {
  const { shelter_id, name, breed, age, gender, description } = req.body;
  try {
    // check ownership
    const shelter = await knex('shelters').where({ id: shelter_id }).first();
    if (!shelter) return res.status(400).json({ error: 'Shelter not found' });
    if (shelter.user_id !== req.user.id && req.user.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Not allowed' });
    }
    const [id] = await knex('dogs').insert({
      shelter_id, name, breed, age, gender, description
    }).returning('id');
    const dog = await knex('dogs').where({ id }).first();
    res.status(201).json(dog);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cannot create dog' });
  }
});

// Upload attachment for dog (multipart/form-data) - returns attachment record
router.post('/:id/attachments', authMiddleware, upload.single('file'), async (req, res) => {
  const dogId = req.params.id;
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
