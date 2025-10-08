const knex = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

/**
 * 1. Ochranná funkcia (protect)
 * Overí JWT token a pridelí informácie o užívateľovi do req.user.
 */
function protect(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Bad token format' });
    
    const token = parts[1];
    
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload; // Pridá info o užívateľovi (vrátane role a shelterId)
        next();
    } catch (e) {
        // Napr. token vypršal
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * 2. Overenie pre manažérov útulkov (shelterManager)
 * Vyžaduje, aby bola rola 'shelter' A aby bol používateľ priradený k útulku (mal shelterId).
 */
function shelterManager(req, res, next) {
    // protect musí byť zavolaný predtým
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const role = req.user.role;
    // KRITICKÁ ZMENA: Kontrolujeme aj shelterId, ktoré je z tokenu
    const shelterId = req.user.shelterId; 
    
    // Kontrola, či je používateľ manažér útulku A je priradený k útulku
    if (role !== 'shelter' || !shelterId) {
        // Táto chyba už bude v middleware, kde patrí
        return res.status(403).json({ error: 'Chyba autorizácie: Nie ste priradený k žiadnemu útulku.' });
    }
    
    next();
}


/**
 * 3. Overenie pre admina (adminOnly)
 * Vyžaduje rolu 'platform_admin'.
 */
function adminOnly(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role !== 'platform_admin') return res.status(403).json({ error: 'Len pre platform admina.' });
    next();
}

// Export všetkých potrebných funkcií pod správnymi názvami pre routy
module.exports = {
    protect,          
    adminOnly,
    shelterManager,   
};
