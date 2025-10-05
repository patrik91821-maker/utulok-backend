
const express = require('express');
const knex = require('../db');
require('dotenv').config();

const router = express.Router();

// Zoznam všetkých útulkov pre výber pri darovaní
router.get('/all', async (req, res) => {
  try {
    const shelters = await knex('shelters').select('id', 'name', 'location', 'description');
    res.json(shelters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Nepodarilo sa načítať útulky.' });
  }
});

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
    const result = await knex('shelters').insert({
      name,
      description,
      address,
      location,
      email,
      password_hash: hash,
      phone
    }).returning('id');
    // Podľa verzie knex/pg môže byť result [{id: ...}] alebo [id]
    const shelterId = Array.isArray(result) ? (typeof result[0] === 'object' ? result[0].id : result[0]) : result;
    const shelter = await knex('shelters').where({ id: shelterId }).first();
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
