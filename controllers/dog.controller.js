const knex = require('../db'); // Knex inštancia je správne importovaná

// ====================================================================
// 1. Vytvorenie nového psa (IBA pre Shelter Manager)
// ====================================================================
exports.addDog = async (req, res) => {
    // req.user je nastavené middlewarem, keď je užívateľ Shelter Manager.
    // Získame ID útulku (shelter_id) z autentifikačného tokenu.
    const shelterId = req.user.shelter_id || req.user.id; 

    // Kontrola, či Shelter Manager poslal potrebné dáta
    const { name, breed, description, age, gender, status, image_url } = req.body;

    if (!name || !age || !gender || !description) {
        return res.status(400).json({ message: "Chýbajú povinné polia (meno, vek, pohlavie, popis)." });
    }

    try {
        const dogData = {
            shelter_id: shelterId, // Priradíme psa k útulku
            name,
            breed,
            description,
            age: parseInt(age),
            gender,
            status: status || 'Available', // Predvolený stav
            image_url: image_url || 'https://placehold.co/600x400/FFC0CB/555555?text=Novy+pes',
            created_at: new Date(),
            updated_at: new Date(),
        };

        // Knex - Vložíme dáta do tabuľky 'dogs'
        // Používame .returning('id') pre získanie nového ID záznamu
        const [newDogId] = await knex('dogs').insert(dogData).returning('id');

        res.status(201).json({ 
            message: "Pes bol úspešne pridaný.", 
            id: newDogId,
            dog: dogData
        });

    } catch (error) {
        console.error("Chyba pri vytváraní psa:", error);
        // Pošleme viac detailov chyby len pre debug
        res.status(500).json({ 
            message: "Interná chyba servera pri ukladaní psa. Skontrolujte schému DB.",
            error_details: error.message 
        });
    }
};

// ====================================================================
// Dočasné dummy funkcie pre úspešné spustenie rout
// ====================================================================

exports.getAllDogs = (req, res) => res.status(501).json({ message: "Not Implemented: getAllDogs" });
exports.getDogById = (req, res) => res.status(501).json({ message: "Not Implemented: getDogById" });
exports.updateDog = (req, res) => res.status(501).json({ message: "Not Implemented: updateDog" });
exports.deleteDog = (req, res) => res.status(501).json({ message: "Not Implemented: deleteDog" });


// Export všetkých funkcií
module.exports = {
    addDog: exports.addDog,
    getAllDogs: exports.getAllDogs,
    getDogById: exports.getDogById,
    updateDog: exports.updateDog,
    deleteDog: exports.deleteDog,
};
