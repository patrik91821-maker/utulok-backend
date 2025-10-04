const express = require('express');
const knex = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const router = express.Router();

// Get all shelters (admin)
router.get('/shelters', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await knex('shelters').orderBy('created_at', 'desc');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// Force deactivate shelter
router.post('/shelters/:id/deactivate', authMiddleware, adminOnly, async (req, res) => {
  const id = req.params.id;
  try {
    await knex('shelters').where({ id }).update({ active: false });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// list payments
router.get('/payments', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = await knex('payments').orderBy('created_at', 'desc');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
