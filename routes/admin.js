const express = require('express');
const router = express.Router();

// 1. Importujeme všetky potrebné funkcie z kontroléra
const adminController = require('../controllers/admin.controller');
// 2. Importujeme správne pomenované middleware funkcie
const { protect, adminOnly } = require('../middleware/auth'); 

// GET /admin/shelters - Získa zoznam všetkých útulkov (Admin)
router.get('/shelters', protect, adminOnly, adminController.fetchAllShelters);

// POST /admin/shelters/:id/deactivate - Násilná deaktivácia útulku (Admin)
router.post('/shelters/:id/deactivate', protect, adminOnly, adminController.deactivateShelter);

// GET /admin/payments - Získa zoznam všetkých platieb (Admin)
router.get('/payments', protect, adminOnly, adminController.fetchAllPayments);

module.exports = router;
