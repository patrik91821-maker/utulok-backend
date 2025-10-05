const express = require('express');
const knex = require('../db');
require('dotenv').config();

const router = express.Router();

// Registrácia útulku
router.post('/register', async (req, res) => {
  const { name, description, address, location, email, password, phone } = req.body;
  if (!name || !description || !address || !location || !email || !password) {
    return res.status(400).json({ error: 'Vyplňte všetky povinné polia.' });
  }
  try {
    // Overenie, či už existuje útulok s rovnakým emailom
    const existing = await knex('shelters').where({ email }).first();
    if (existing) return res.status(400).json({ error: 'Email už je použitý.' });

    // Hashovanie hesla
    const bcrypt = require('bcrypt');
    const SALT_ROUNDS = 10;
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Vloženie útulku do databázy
    const [id] = await knex('shelters').insert({
      name,
      description,
      address,
      location,
      email,
      password_hash: hash,
      phone
    }).returning('id');

    const shelter = await knex('shelters').where({ id }).first();
    res.json({ shelter: {
      id: shelter.id,
      name: shelter.name,
      description: shelter.description,
      address: shelter.address,
      location: shelter.location,
      email: shelter.email,
      phone: shelter.phone
    }});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registrácia útulku zlyhala.' });
  }
});

module.exports = router;
