const knex = require('../db');

/**
 * Získa zoznam všetkých útulkov v systéme.
 * Prístupné len pre Admina (overené middleware).
 */
async function fetchAllShelters(req, res) {
    try {
        // Používame join s users, aby sme dostali email, phone, location
        const shelters = await knex('shelters')
            .join('users', 'shelters.user_id', 'users.id')
            .select(
                'shelters.id', 
                'shelters.name', 
                'users.email', 
                'users.phone', 
                'shelters.address as location', 
                'shelters.description',
                'shelters.active' // Dôležité pre admina
                // Nezahrňte citlivé dáta ako password_hash!
            ).orderBy('shelters.created_at', 'desc');
        res.json({ shelters });
    } catch (err) {
        console.error('Chyba pri načítaní všetkých útulkov (Admin):', err);
        res.status(500).json({ error: 'Chyba servera pri načítaní útulkov.' });
    }
}

/**
 * Získa zoznam všetkých platieb/donácií v systéme.
 * Prístupné len pre Admina.
 */
async function fetchAllPayments(req, res) {
    try {
        // Predpokladáme, že máte tabuľku 'payments'
        const payments = await knex('payments')
            .select('*')
            .orderBy('created_at', 'desc');

        res.json({ payments });
    } catch (err) {
        console.error('Chyba pri načítaní všetkých platieb (Admin):', err);
        res.status(500).json({ error: 'Chyba servera pri načítaní platieb.' });
    }
}

/**
 * Násilne deaktivuje útulok (admin akcia).
 */
async function deactivateShelter(req, res) {
    const { id } = req.params;
    try {
        // Vrátime počet aktualizovaných riadkov (1 alebo 0)
        const updatedCount = await knex('shelters').where({ id }).update({ active: false });
        
        if (updatedCount === 0) {
            return res.status(404).json({ error: 'Útulok nenájdený alebo už je neaktívny.' });
        }
        
        res.json({ success: true, message: `Útulok s ID ${id} bol deaktivovaný.` });
    } catch (err) {
        console.error('Chyba pri deaktivácii útulku:', err);
        res.status(500).json({ error: 'Chyba servera pri deaktivácii útulku.' });
    }
}

module.exports = {
    fetchAllShelters,
    fetchAllPayments,
    deactivateShelter,
    // ... ďalšie admin funkcie ...
};
