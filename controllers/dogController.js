const knex = require('../db'); // Predpokladáme, že knex je dostupný

// --- FUNKCIA: Pridanie nového psa ---
// Endpoint: POST /api/dogs/create
async function addDog(req, res) {
    // Vďaka middleware 'protect' a 'shelterManager' vieme, že používateľ je manažér útulku.
    const shelterId = req.user.shelter_id; 
    
    // Dáta prichádzajúce z Flutter formulára
    const { name, breed, description, age, gender, image_url } = req.body;

    // Kontrola povinných polí
    if (!name || !description || !age || !gender) {
        return res.status(400).json({ error: 'Chýbajú povinné polia: meno, popis, vek alebo pohlavie.' });
    }
    
    try {
        // Vloženie nového psa do tabuľky 'dogs'
        const result = await knex('dogs').insert({
            shelter_id: shelterId, // DÔLEŽITÉ: Priradenie k útulku prihláseného manažéra
            name,
            // Nastavenie defaultnej hodnoty, ak je plemeno prázdne
            breed: breed || 'Neznáme plemeno', 
            description,
            // Vek konvertujeme na integer. Predpokladáme, že Flutter posiela platné číslo.
            age: parseInt(age, 10), 
            gender, // 'M' alebo 'F'
            image_url: image_url || null,
        }).returning('*'); // Vráti vytvorený záznam

        // Knex vráti buď pole, alebo objekt. Normalizujeme výsledok.
        const newDog = Array.isArray(result) ? (typeof result[0] === 'object' ? result[0] : result[0]) : result;
        
        // Vrátenie úspešnej odpovede (201 Created)
        res.status(201).json({ 
            message: 'Pes bol úspešne pridaný.', 
            dog: newDog 
        });

    } catch (error) {
        console.error('Chyba pri vkladaní nového psa do DB:', error);
        res.status(500).json({ error: 'Interná chyba servera pri pridávaní psa.' });
    }
}

module.exports = {
    addDog,
    // ... ďalšie exporty pre psov
};
