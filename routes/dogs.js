const express = require('express');
const router = express.Router();
// Dôležité: Uistite sa, že importujete controller správne
const dogController = require('../controllers/dog.controller'); 
const authMiddleware = require('../middleware/auth.middleware');

// ====================================================================
// Verejné ruty
// ====================================================================

// GET /api/dogs - Získať všetkých dostupných psov
// Predpoklad: dogController.getAllDogs existuje
router.get('/', dogController.getAllDogs);

// GET /api/dogs/:id - Získať detail konkrétneho psa
// Predpoklad: dogController.getDogById existuje
router.get('/:id', dogController.getDogById);


// ====================================================================
// Ruty len pre útulky (Shelter Manager)
// ====================================================================

// POST /api/dogs - Pridať nového psa
router.post(
    '/', 
    authMiddleware.shelterManager, // Kontrola role Shelter Manager
    dogController.createDog         // REFERENCIA na funkciu musí byť definovaná
); 

// PUT /api/dogs/:id - Aktualizovať info o psovi
// Predpoklad: dogController.updateDog existuje
router.put(
    '/:id', 
    authMiddleware.shelterManager, 
    dogController.updateDog
); 

// DELETE /api/dogs/:id - Odstrániť psa
// Predpoklad: dogController.deleteDog existuje
router.delete(
    '/:id', 
    authMiddleware.shelterManager, 
    dogController.deleteDog
);

module.exports = router;
