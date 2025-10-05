const express = require('express');
const knex = require('../db');
require('dotenv').config();

const { sendShelterContactMessage } = require('../utils/emailService'); // NOVÝ IMPORT

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

// Získanie kontaktných údajov útulku podľa ID (Používa Flutter formulár)
router.get('/:id/contact', async (req, res) => {
  const { id } = req.params;
  try {
    const shelter = await knex('shelters').where({ id }).first();
    if (!shelter) return res.status(404).json({ error: 'Útulok nenájdený' });
    
    // Odosielame dáta, ktoré Flutter potrebuje
    res.json({
      id: shelter.id,
      name: shelter.name,
      email: shelter.email,
      phone: shelter.phone,
      address: shelter.address,
      location: shelter.location
    });
  } catch (err) {
    res.status(500).json({ error: 'Chyba databázy' });
  }
});

// --- NOVÁ RUTA: ODOSLANIE SPRÁVY ÚTULKU ---
router.post('/send-message', async (req, res) => {
    // Dáta, ktoré prichádzajú z Flutter:
    const { recipientEmail, subject, body, senderEmail } = req.body;

    if (!recipientEmail || !subject || !body || !senderEmail) {
        return res.status(400).json({ success: false, error: 'Chýbajú povinné polia pre odoslanie správy.' });
    }

    try {
        // Volanie nášho servisu pre odoslanie e-mailu
        const success = await sendShelterContactMessage({
            toEmail: recipientEmail,
            subject: subject,
            body: body,
            replyTo: senderEmail,
        });

        if (success) {
            res.status(200).json({ success: true, message: 'Správa bola úspešne odoslaná.' });
        } else {
            res.status(500).json({ success: false, error: 'Chyba pri odosielaní správy cez Nodemailer.' });
        }

    } catch (err) {
        console.error('Chyba v POST /send-message:', err);
        res.status(500).json({ success: false, error: 'Interná chyba servera pri spracovaní správy.' });
    }
});

module.exports = router;
