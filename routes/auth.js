const express = require('express');
const knex = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { protect } = require('../middleware/auth'); // Iba protect, lebo routy pre login/register sú verejné

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const SALT_ROUNDS = 10;
const router = express.Router();

// --------------------------------------------------------------------------
// POMOCNÁ FUNKCIA: Načíta shelterId pre užívateľa s rolou 'shelter'
// --------------------------------------------------------------------------
async function getShelterIdForUser(userId) {
    const shelter = await knex('shelters')
        .where({ user_id: userId })
        .select('id')
        .first();
    return shelter ? shelter.id : null;
}

// --------------------------------------------------------------------------
// RUTA: REGISTRÁCIA (Bežný používateľ)
// --------------------------------------------------------------------------
router.post('/register', async (req, res) => {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Vyplňte všetky povinné polia.' });
    }
    
    try {
        const existingUser = await knex('users').where({ email }).first();
        if (existingUser) {
            return res.status(400).json({ error: 'Email už je použitý.' });
        }

        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        const userResult = await knex('users').insert({ 
            email, 
            password_hash: hash, 
            name, 
            phone,
            role: 'user' // Predvolená rola
        }).returning('id');

        const userId = Array.isArray(userResult) 
            ? (typeof userResult[0] === 'object' ? userResult[0].id : userResult[0]) 
            : userResult;

        const user = await knex('users').where({ id: userId }).first();

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role }, // ShelterId tu nie je
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
                phone: user.phone,
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registrácia zlyhala.' });
    }
});


// --------------------------------------------------------------------------
// RUTA: PRIHLÁSENIE (Login)
// --------------------------------------------------------------------------
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Vyplňte e-mail a heslo.' });
    }
    
    try {
        const user = await knex('users').where({ email }).first();
        if (!user) {
            return res.status(400).json({ error: 'Neplatné prihlasovacie údaje.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Neplatné prihlasovacie údaje.' });
        }

        let shelterId = null;
        // DÔLEŽITÁ OPRAVA: Ak je rola 'shelter', nájdi príslušné shelterId
        if (user.role === 'shelter') {
            shelterId = await getShelterIdForUser(user.id);
        }

        // Vytvorenie tokenu s pridaným shelterId (ak existuje)
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, shelterId: shelterId },
            JWT_SECRET, 
            { expiresIn: '30d' }
        );

        // Vrátenie kompletného user objektu
        res.json({ 
            token, 
            user: { 
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                phone: user.phone,
                shelterId: shelterId, // KRITICKÉ: Pridané pre Flutter
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Prihlásenie zlyhalo.' });
    }
});


// --------------------------------------------------------------------------
// RUTA: ZÍSKANIE INFO O UŽÍVATEĽOVI (ME)
// --------------------------------------------------------------------------
router.get('/me', protect, async (req, res) => {
    try {
        // ID používateľa z validovaného tokenu
        const userId = req.user.id; 

        // KROK 1: Načítame celý user objekt z databázy pre aktuálne dáta (napr. name, phone)
        const userFromDb = await knex('users')
            .where({ id: userId })
            .select('id', 'email', 'name', 'role', 'phone') // Vyberáme len bezpečné polia
            .first();

        if (!userFromDb) {
            return res.status(404).json({ error: 'Používateľ nebol nájdený v DB.' });
        }

        let shelterId = null;
        
        // KROK 2: Ak je rola 'shelter', nájdeme jeho shelterId
        if (userFromDb.role === 'shelter') {
             shelterId = await getShelterIdForUser(userId);
             if (shelterId === null) {
                // Toto by sa nemalo stať, ak je DB konzistentná, ale pre istotu
                console.error(`Používateľ ${userId} má rolu 'shelter', ale chýba mu shelterId.`);
             }
        }

        // KROK 3: Vrátenie kompletného user objektu pre Flutter
        res.json({ 
            user: { 
                id: userFromDb.id,
                email: userFromDb.email,
                name: userFromDb.name, // Toto pole by malo teraz vždy existovať
                role: userFromDb.role,
                phone: userFromDb.phone,
                shelterId: shelterId, // Pridané ID útulku (null pre bežných userov)
            }
        });
    } catch (err) {
        console.error('Chyba pri /auth/me:', err);
        res.status(500).json({ error: 'Nepodarilo sa načítať užívateľa.' });
    }
});

module.exports = router;
