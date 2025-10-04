const express = require('express');
const knex = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Register shelter (must be logged-in user)
router.post('/register', authMiddleware, async (req, res) => {
  const { name, description, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [id] = await knex('shelters').insert({
      user_id: req.user.id,
      name, description, address
    }).returning('id');
    const shelter = await knex('shelters').where({ id }).first();
    // Optionally set user role to shelter_admin
    await knex('users').where({ id: req.user.id }).update({ role: 'shelter_admin' });
    res.status(201).json(shelter);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cannot create shelter' });
  }
});

// Get shelter by id
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const s = await knex('shelters').where({ id }).first();
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// List shelters (only active displayed to public)
router.get('/', async (req, res) => {
  try {
    const rows = await knex('shelters').where({ active: true }).orderBy('created_at', 'desc');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
