const Dog = require('../models/Dog'); // Uistite sa, že model je importovaný
const mongoose = require('mongoose');

// ====================================================================
// 1. Vytvorenie nového psa (IBA pre Shelter Manager)
// ====================================================================
exports.createDog = async (req, res) => {
    // userId bol pridaný do req v auth.middleware.js. V tomto prípade je to shelterId.
    const shelterId = req.userId;

    // Kontrola, či Shelter Manager poslal potrebné dáta
    const { name, breed, description, age, gender, status, image_url } = req.body;

    if (!name || !age || !gender || !description) {
        return res.status(400).json({ message: "Chýbajú povinné polia (meno, vek, pohlavie, popis)." });
    }

    try {
        const newDog = new Dog({
            shelter: shelterId, // Automaticky priradíme shelterId
            name,
            breed,
            description,
            age: parseInt(age),
            gender,
            status: status || 'Available', // Predvolený stav
            image_url: image_url || 'https://placehold.co/600x400/FFC0CB/555555?text=Novy+pes',
        });

        await newDog.save();

        res.status(201).json({ 
            message: "Pes bol úspešne pridaný.", 
            dog: newDog 
        });

    } catch (error) {
        console.error("Chyba pri vytváraní psa:", error);
        res.status(500).json({ message: "Interná chyba servera pri ukladaní psa." });
    }
};

// ... Ďalšie kontrolné funkcie ...

// Export všetkých funkcií
module.exports = {
    createDog,
    // ... ďalšie funkcie (napr. getAllDogs, getDogById, updateDog, deleteDog)
};
