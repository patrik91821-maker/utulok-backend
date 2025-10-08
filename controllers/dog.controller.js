const knex = require('../db');

/**
 * Pridá nového psa do databázy (KROK 1: Textové dáta).
 * Predpokladá, že používateľ je overený a je manažér útulku (middleware).
 * Vráti novo vytvorený objekt psa s jeho ID.
 */
async function addDog(req, res) {
    const { 
        name, 
        breed, 
        age, 
        description, 
        gender,
        status, 
    } = req.body;
    
    // OPRAVA: Získame shelterId (CamelCase) z req.user, ktoré je tam pridané v middleware/auth.js
    const shelterId = req.user.shelterId; // Správny kľúč je 'shelterId', nie 'shelter_id'

    // Poznámka: Kontrola (!shelterId) už nemusí byť tak prísna, pretože to overil middleware shelterManager.
    // Ak sa sem kód dostal, shelterId by malo byť prítomné a platné.
    
    // Základná validácia
    if (!name || !gender || !description) { // Vek nie je povinný
        return res.status(400).json({ error: 'Meno, pohlavie a popis sú povinné polia.' });
    }
    
    // Predvolená URL pre obrázok, kým sa nenahrá prvá fotka
    const defaultImageUrl = 'https://placehold.co/600x400/FFC0CB/555555?text=Novy+pes';

    try {
        const dogData = {
            shelter_id: shelterId, // Tu používame shelter_id pre databázový stĺpec
            name: name,
            breed: breed,
            // Vek konvertujeme na int alebo null, ak chýba
            age: parseInt(age, 10) || null, 
            description: description,
            gender: gender,
            status: status || 'Available', // Predvolený stav
            image_url: defaultImageUrl, // Nastavíme predvolený obrázok
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        };

        // Vloženie nového psa do databázy a získanie ID
        const [newDogId] = await knex('dogs').insert(dogData).returning('id');

        // Získanie celého nového záznamu pre vrátenie klientovi
        const newDog = await knex('dogs').where({ id: newDogId }).first();

        // Vrátime celý objekt psa, aby Flutter poznal jeho ID pre ďalší krok (nahrávanie fotky)
        res.status(201).json(newDog);

    } catch (err) {
        console.error('Chyba pri pridávaní psa:', err);
        res.status(500).json({ error: 'Chyba servera pri vkladaní záznamu.', error_details: err.message });
    }
}

/**
 * Aktualizuje image_url pre daného psa. (KROK 2: Po úspešnom nahratí fotky)
 * Túto funkciu volá dog.routes.js po úspešnom uložení súboru na disk.
 */
async function updateDogImageUrl(dogId, imageUrl) {
    try {
        // Aktualizujeme len image_url pre hlavnú kartu psa
        await knex('dogs').where({ id: dogId }).update({
            image_url: imageUrl,
            updated_at: knex.fn.now(),
        });
        return true;
    } catch (err) {
        console.error('Chyba pri aktualizácii URL obrázku psa:', err);
        return false;
    }
}

// Dočasné dummy funkcie pre úspešné spustenie rout
const dummyNotImplemented = (req, res) => res.status(501).json({ message: "Not Implemented: funkcia zatiaľ neimplementovaná" });


module.exports = {
    addDog,
    updateDogImageUrl, // Kľúčové pre nahrávanie fotiek
    getAllDogs: dummyNotImplemented,
    getDogById: dummyNotImplemented,
    updateDog: dummyNotImplemented,
    deleteDog: dummyNotImplemented,
};
