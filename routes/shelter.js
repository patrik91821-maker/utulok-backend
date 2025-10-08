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


// =========================================================================
// VEREJNÉ ROUTY ÚTULKOV
// =========================================================================

// Zoznam všetkých útulkov pre výber pri darovaní / kontaktovaní
// GET /api/shelters/all
router.get('/all', async (req, res) => {
    try {
        // Konsistentne zobrazujeme VŠETKY útulky, ak filter active: true nie je použitý
        const shelters = await knex('shelters')
            .select('id', 'name', 'location', 'description', 'active');
        
        // Obalenie výsledku do JSON objektu pre lepšiu konzistentnosť
        res.json({ shelters }); 
    } catch (err) {
        console.error('Chyba pri načítaní útulkov:', err);
        res.status(500).json({ error: 'Nepodarilo sa načítať útulky.' });
    }
});

// Registrácia útulku (AUTOMATICKY vytvára používateľa s rolou 'shelter')
// POST /api/shelters/register
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

        // DÔLEŽITÉ: Pridať shelterId do tokenu pre middleware shelterManager
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, shelterId: shelterId },
            JWT_SECRET, 
            { expiresIn: '30d' }
        );
        
        res.json({ 
            token, 
            user: { 
                 id: user.id,
                 email: user.email,
                 name: user.name,
                 role: user.role,
                 // Posielame shelterId aj v objekte user pre rýchlu dostupnosť na frontend
                 shelterId: shelterId, 
            },
            shelter: {
                id: shelterId,
                name: name,
                description: description,
                address: address,
                location: location,
                phone: phone
            }
        });

    } catch (err) {
        console.error('Chyba pri registrácii útulku:', err);
        res.status(500).json({ error: 'Registrácia útulku zlyhala.' });
    }
});

// Získanie kontaktných údajov útulku podľa ID
// GET /api/shelters/:id/contact
router.get('/:id/contact', async (req, res) => {
    const { id } = req.params;
    try {
        // Spojenie shelters a users pre získanie emailu a telefónu
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
            // OPRAVA 404 CHYBY: Odstránili sme filter na aktivitu,
            // aby bolo možné kontaktovať všetky útulky, ktoré vidí /all endpoint.
            // .where('shelters.active', true); 
            
        if (!shelter) return res.status(404).json({ error: 'Útulok nenájdený' });
        
        // Nastavenie aliasu 'recipientEmail' pre konzistentnosť s emailService
        res.json({
            id: shelter.id,
            name: shelter.name,
            recipientEmail: shelter.email, // Pridaný alias
            email: shelter.email,
            phone: shelter.phone,
            address: shelter.address,
            location: shelter.location
        });
    } catch (err) {
        console.error('Chyba pri získavaní kontaktu útulku:', err);
        res.status(500).json({ error: 'Chyba databázy' });
    }
});

// Odoslanie správy útulku (Používa emailService)
// POST /api/shelters/send-message
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
            // Chyba na strane Nodemailer/konfigurácie
            console.error('EmailService zlyhal, ale nevyniesol chybu (možno zlá konfigurácia/limit).');
            res.status(500).json({ success: false, error: 'Chyba pri odosielaní správy cez emailService. Skontrolujte logy Nodemailer.' });
        }

    } catch (err) {
        console.error('Chyba v POST /send-message:', err);
        res.status(500).json({ success: false, error: 'Interná chyba servera pri spracovaní správy.' });
    }
});

// =========================================================================
// ROUTY PRE DASHBOARD ÚTULKU (Vyžaduje 'shelter' rolu a shelterId v tokene)
// =========================================================================

// Načíta zoznam psov, ktoré patria prihlásenému útulku
// GET /api/shelters/me/dogs
router.get('/me/dogs', protect, shelterManager, async (req, res) => {
    const shelterId = req.user.shelterId; // Získané z JWT

    try {
        const dogs = await knex('dogs')
            .where({ shelter_id: shelterId })
            .select('*') 
            .orderBy('created_at', 'desc');

        // Obalenie výsledku do JSON objektu
        res.json({ dogs }); 
    } catch (err) {
        console.error('Chyba pri načítaní psov pre útulok:', err);
        res.status(500).json({ error: 'Chyba servera pri načítaní psov.' });
    }
});

// Načíta zoznam donácií pre prihlásený útulok
// GET /api/shelters/me/payments
router.get('/me/payments', protect, shelterManager, async (req, res) => {
    const shelterId = req.user.shelterId; // Získané z JWT

    try {
        // Načítame všetky platby priradené k tomuto útulku
        const payments = await knex('payments')
            .where({ shelter_id: shelterId })
            .select('*') 
            .orderBy('created_at', 'desc');

        // Obalenie výsledku do JSON objektu
        res.json({ payments }); 
    } catch (err) {
        console.error('Chyba pri načítaní platieb pre útulok:', err);
        res.status(500).json({ error: 'Chyba servera pri načítaní platieb.' });
    }
});

module.exports = router;
