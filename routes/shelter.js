const express = require('express');
const knex = require('../db');
const bcrypt = require('bcrypt'); // Pridaný import bcrypt (pretože sa používa v tejto rutine)
const jwt = require('jsonwebtoken'); // Pridaný import jwt (pre automatické prihlásenie po registrácii)
require('dotenv').config();

const { sendShelterContactMessage } = require('../utils/emailService');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const SALT_ROUNDS = 10;

const router = express.Router();

// Zoznam všetkých útulkov pre výber pri darovaní / kontaktovaní
router.get('/all', async (req, res) => {
    try {
        // Dôležité: Ak sa user_id stane NOT NULL, zmente toto na JOIN s users
        const shelters = await knex('shelters').select('id', 'name', 'location', 'description');
        res.json(shelters);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa načítať útulky.' });
    }
});

// Registrácia útulku (OPRAVENÁ LOGIKA)
router.post('/register', async (req, res) => {
    const { name, description, address, location, email, password, phone } = req.body;
    
    if (!name || !description || !address || !location || !email || !password) {
        return res.status(400).json({ error: 'Vyplňte všetky povinné polia.' });
    }
    
    try {
        // KROK 1: Overenie, či už email neexistuje v primárnej tabuľke users
        const existingUser = await knex('users').where({ email }).first();
        if (existingUser) {
            return res.status(400).json({ error: 'Email už je použitý iným používateľom alebo útulkom.' });
        }

        // Hashovanie hesla
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        // KROK 2: Vloženie do tabuľky USERS s rolou 'shelter'
        const userResult = await knex('users').insert({ 
            email, 
            password_hash: hash, 
            name, 
            phone, 
            role: 'shelter' // Dôležité: nastaviť rolu!
        }).returning('id');

        // Získanie user ID
        const userId = Array.isArray(userResult) 
            ? (typeof userResult[0] === 'object' ? userResult[0].id : userResult[0]) 
            : userResult;

        // KROK 3: Vloženie do tabuľky SHELTERS s user_id
        // POZOR: Stĺpce email, password_hash, phone musia byť z tabuľky shelters odstránené!
        const shelterResult = await knex('shelters').insert({
            user_id: userId, // Prepojenie s tabuľkou users
            name,
            description,
            address,
            location,
            // Email, password_hash a phone už NEUPLATŇUJEME, sú v tabuľke users.
        }).returning('id');

        const shelterId = Array.isArray(shelterResult) 
            ? (typeof shelterResult[0] === 'object' ? shelterResult[0].id : shelterResult[0]) 
            : shelterResult;

        // KROK 4: Automatické prihlásenie a vrátenie tokenu
        // Načítame novo vytvoreného používateľa pre vytvorenie JWT (potrebujeme aj uložené dáta, ak boli defaultné)
        const user = await knex('users').where({ id: userId }).first();

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
        
        // Vrátime token a základné údaje o útulku.
        // OPRAVA: Používame premenné, ktoré máme definované (user a req.body dáta)
        res.json({ 
            token, 
            shelter: {
                id: shelterId,
                name: user.name, // Zoberieme z user, kde je uložené
                description: description,
                address: address,
                location: location,
                email: user.email, // Z user
                phone: user.phone // Z user
            }
        });

    } catch (err) {
        console.error('Chyba pri registrácii útulku:', err);
        res.status(500).json({ error: 'Registrácia útulku zlyhala.' });
    }
});

// Získanie kontaktných údajov útulku podľa ID (Používa Flutter formulár)
router.get('/:id/contact', async (req, res) => {
    const { id } = req.params;
    try {
        // Teraz potrebujeme spojiť shelters a users, aby sme získali email a telefón
        const [shelter] = await knex('shelters')
            .join('users', 'shelters.user_id', 'users.id')
            .select(
                'shelters.id', 
                'shelters.name', 
                'shelters.address', 
                'shelters.location',
                'users.email', // Získavame z users
                'users.phone'  // Získavame z users
            )
            .where('shelters.id', id);

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
