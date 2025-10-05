const express = require('express');
const knex = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// KĽÚČOVÝ IMPORT: Middleware pre autentifikáciu a autorizáciu
const { protect, shelterManager } = require('../middleware/auth'); 
const { sendShelterContactMessage } = require('../utils/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const SALT_ROUNDS = 10;
const router = express.Router();


// Zoznam všetkých útulkov pre výber pri darovaní / kontaktovaní
router.get('/all', async (req, res) => {
    try {
        // Získanie iba verejných informácií
        const shelters = await knex('shelters').select('id', 'name', 'location', 'description', 'active').where({ active: true });
        res.json(shelters);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa načítať útulky.' });
    }
});

// Registrácia útulku (UPRAVENÉ: Pridanie shelterId do JWT)
router.post('/register', async (req, res) => {
    const { name, description, address, location, email, password, phone } = req.body;
    
    if (!name || !description || !address || !location || !email || !password) {
        return res.status(400).json({ error: 'Vyplňte všetky povinné polia.' });
    }
    
    try {
        // KROK 1: Overenie existencie používateľa
        const existingUser = await knex('users').where({ email }).first();
        if (existingUser) {
            return res.status(400).json({ error: 'Email už je použitý iným používateľom alebo útulkom.' });
        }

        // Hashovanie hesla
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        // KROK 2: Vloženie do tabuľky USERS
        const userResult = await knex('users').insert({ 
            email, 
            password_hash: hash, 
            name, 
            phone, 
            role: 'shelter' // Dôležité: nastaviť rolu!
        }).returning('id');

        const userId = Array.isArray(userResult) 
            ? (typeof userResult[0] === 'object' ? userResult[0].id : userResult[0]) 
            : userResult;

        // KROK 3: Vloženie do tabuľky SHELTERS s user_id
        const shelterResult = await knex('shelters').insert({
            user_id: userId, 
            name,
            description,
            address,
            location,
            active: true // Útulok je po registrácii aktívny
        }).returning('id');

        const shelterId = Array.isArray(shelterResult) 
            ? (typeof shelterResult[0] === 'object' ? shelterResult[0].id : shelterResult[0]) 
            : shelterResult;

        // KROK 4: Automatické prihlásenie a vrátenie tokenu
        const user = await knex('users').where({ id: userId }).first();

        // DÔLEŽITÁ OPRAVA: Pridať shelterId do tokenu pre middleware shelterManager
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, shelterId: shelterId },
            JWT_SECRET, 
            { expiresIn: '30d' }
        );
        
        res.json({ 
            token, 
            shelter: {
                id: shelterId,
                name: user.name, 
                description: description,
                address: address,
                location: location,
                email: user.email, 
                phone: user.phone
            }
        });

    } catch (err) {
        console.error('Chyba pri registrácii útulku:', err);
        res.status(500).json({ error: 'Registrácia útulku zlyhala.' });
    }
});

// Získanie kontaktných údajov útulku podľa ID
router.get('/:id/contact', async (req, res) => {
    const { id } = req.params;
    try {
        // Potrebujeme spojiť shelters a users, aby sme získali email a telefón
        const [shelter] = await knex('shelters')
            .join('users', 'shelters.user_id', 'users.id')
            .select(
                'shelters.id', 
                'shelters.name', 
                'shelters.address', 
                'shelters.location',
                'users.email', // Získavame z users
                'users.phone'  // Získavame z users
            )
            .where('shelters.id', id)
            .where('shelters.active', true); // Iba aktívne útulky

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

// --- RUTA: ODOSLANIE SPRÁVY ÚTULKU ---
router.post('/send-message', async (req, res) => {
    const { recipientEmail, subject, body, senderEmail } = req.body;

    if (!recipientEmail || !subject || !body || !senderEmail) {
        return res.status(400).json({ success: false, error: 'Chýbajú povinné polia pre odoslanie správy.' });
    }

    try {
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

// =========================================================================
// NOVÉ ROUTY PRE DASHBOARD ÚTULKU (Shelter Manager)
// =========================================================================

// GET /shelters/me/dogs - Načíta zoznam psov, ktoré patria prihlásenému útulku
// Používa shelterManager, ktorý garantuje, že req.user.shelterId existuje.
router.get('/me/dogs', protect, shelterManager, async (req, res) => {
    const shelterId = req.user.shelterId;

    try {
        const dogs = await knex('dogs')
            .where({ shelter_id: shelterId })
            .select('*') 
            .orderBy('created_at', 'desc');

        res.json(dogs);
    } catch (err) {
        console.error('Chyba pri načítaní psov pre útulok:', err);
        res.status(500).json({ error: 'Chyba servera pri načítaní psov.' });
    }
});

// GET /shelters/me/payments - Načíta zoznam donácií pre prihlásený útulok
// Používa shelterManager, ktorý garantuje, že req.user.shelterId existuje.
router.get('/me/payments', protect, shelterManager, async (req, res) => {
    const shelterId = req.user.shelterId;

    try {
        // Načítame všetky platby priradené k tomuto útulku
        const payments = await knex('payments')
            .where({ shelter_id: shelterId })
            .select('*') 
            .orderBy('created_at', 'desc');

        res.json(payments);
    } catch (err) {
        console.error('Chyba pri načítaní platieb pre útulok:', err);
        res.status(500).json({ error: 'Chyba servera pri načítaní platieb.' });
    }
});

module.exports = router;
