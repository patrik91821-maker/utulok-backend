const knex = require('../db');

/**
 * Získa zoznam všetkých psov z databázy.
 * Vrátane stĺpca 'image_url', 'adoption_fee' a 'donation_goal'.
 * @route GET /api/dogs
 */
async function getAllDogs(req, res) {
    try {
        const dogs = await knex('dogs')
            .select(
                'id', 
                'name', 
                'breed', 
                'age', 
                'gender', 
                'description', 
                'adoptable', 
                'status',
                'image_url', 
                'shelter_id',
                'adoption_fee', // PRIDANÉ: Poplatok za adopciu
                'donation_goal' // PRIDANÉ: Cieľ darovania
            )
            .orderBy('id', 'desc'); 

        res.status(200).json(dogs);
    } catch (err) {
        console.error('Chyba pri načítavaní všetkých psov:', err);
        res.status(500).json({ error: 'Chyba servera pri načítavaní zoznamu psov.', error_details: err.stack });
    }
}

/**
 * Získa jedného psa podľa ID.
 * @route GET /api/dogs/:id
 */
async function getDogById(req, res) {
    const dogId = parseInt(req.params.id, 10);
    if (isNaN(dogId)) return res.status(400).json({ error: 'Neplatné ID psa.' });

    try {
        // select('*') vyberie aj nové stĺpce 'adoption_fee' a 'donation_goal'
        const dog = await knex('dogs')
            .where({ id: dogId })
            .select('*') 
            .first();

        if (!dog) {
            return res.status(404).json({ error: 'Pes nebol nájdený.' });
        }

        res.status(200).json(dog);

    } catch (err) {
        console.error(`Chyba pri načítavaní psa (ID: ${dogId}):`, err);
        res.status(500).json({ error: 'Chyba servera pri načítavaní záznamu.', error_details: err.stack });
    }
}


/**
 * Pridá nového psa do databázy.
 * Rozšírené o adopčný poplatok a cieľ darovania.
 * @route POST /api/dogs
 */
async function addDog(req, res) {
    const { 
        name, 
        breed, 
        age, 
        description, 
        gender,
        status, 
        // --- NOVÉ POLIA ---
        adoptionFee, 
        donationGoal, 
        // ------------------
    } = req.body;
    
    const shelterId = req.user.shelterId; 

    // Základná validácia
    if (!name || !gender || !description) { 
        return res.status(400).json({ error: 'Meno, pohlavie a popis sú povinné polia.' });
    }
    
    const defaultImageUrl = 'https://placehold.co/600x400/FFC0CB/555555?text=Novy+pes';

    try {
        const dogData = {
            shelter_id: shelterId,
            name: name,
            breed: breed || null, 
            age: parseInt(age, 10) || null, 
            description: description,
            gender: gender,
            status: status || 'Prijatý', 
            image_url: defaultImageUrl, 
            
            // --- MAPOVANIE NOVÝCH POLÍ ---
            // Konvertujeme na float a ak je hodnota neplatná (napr. prázdny string), použijeme 0
            adoption_fee: parseFloat(adoptionFee) || 0, 
            donation_goal: parseFloat(donationGoal) || 0, 
            // ------------------------------

            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        };

        const [insertedObjectOrId] = await knex('dogs').insert(dogData).returning('id');
        const newDogId = insertedObjectOrId.id || insertedObjectOrId;
        
        const newDog = await knex('dogs').where({ id: newDogId }).first();

        res.status(201).json(newDog);

    } catch (err) {
        console.error('Chyba pri pridávaní psa:', err);
        res.status(500).json({ error: 'Chyba servera pri vkladaní záznamu.', error_details: err.stack });
    }
}

/**
 * Všeobecná aktualizácia záznamu psa.
 * Rozšírené o adopčný poplatok a cieľ darovania.
 * @route PUT /api/dogs/:id
 */
async function updateDog(req, res) {
    const dogId = parseInt(req.params.id, 10);
    if (isNaN(dogId)) return res.status(400).json({ error: 'Neplatné ID psa.' });
    
    const { 
        name, 
        breed, 
        age, 
        description, 
        gender, 
        status, 
        adoptable, 
        image_url,
        // --- NOVÉ POLIA NA AKTUALIZÁCIU ---
        adoptionFee,
        donationGoal,
        // ------------------------------------
    } = req.body;

    const updateData = { updated_at: knex.fn.now() };

    // Dynamicky pridávame len polia, ktoré boli v požiadavke poslané
    if (name !== undefined) updateData.name = name;
    if (breed !== undefined) updateData.breed = breed;
    if (age !== undefined) updateData.age = parseInt(age, 10) || null; 
    if (description !== undefined) updateData.description = description;
    if (gender !== undefined) updateData.gender = gender;
    if (status !== undefined) updateData.status = status;
    if (adoptable !== undefined) updateData.adoptable = adoptable;
    if (image_url !== undefined) {
        updateData.image_url = image_url;
    }
    
    // --- SPRACUJEME NOVÉ FINANČNÉ POLIA ---
    if (adoptionFee !== undefined) updateData.adoption_fee = parseFloat(adoptionFee) || 0;
    if (donationGoal !== undefined) updateData.donation_goal = parseFloat(donationGoal) || 0;
    // ------------------------------------

    // Ak nemáme čo aktualizovať, vrátime chybu
    if (Object.keys(updateData).length === 1) { 
        return res.status(400).json({ error: 'Žiadne platné dáta na aktualizáciu.' });
    }

    try {
        const updatedRows = await knex('dogs')
            .where({ id: dogId })
            .update(updateData)
            .returning('*'); 

        if (updatedRows.length === 0) {
            return res.status(404).json({ error: 'Pes s daným ID nebol nájdený.' });
        }

        res.status(200).json(updatedRows[0]);

    } catch (err) {
        console.error(`Chyba pri aktualizácii psa (ID: ${dogId}):`, err);
        res.status(500).json({ error: 'Chyba servera pri aktualizácii záznamu.', error_details: err.stack });
    }
}

/**
 * Aktualizuje image_url pre daného psa.
 */
async function updateDogImageUrl(dogId, imageUrl) {
    try {
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

/**
 * Odstránenie psa. (Zatiaľ neimplementované)
 * @route DELETE /api/dogs/:id
 */
/**
 * Odstráni psa podľa ID. Vyžaduje rolu shelter manager.
 * @route DELETE /api/dogs/:id
 */
async function deleteDog(req, res) {
    const dogId = parseInt(req.params.id, 10);
    if (isNaN(dogId)) return res.status(400).json({ error: 'Neplatné ID psa.' });

    try {
        // Skontrolujeme, či pes existuje
        const dog = await knex('dogs').where({ id: dogId }).first();
        if (!dog) {
            return res.status(404).json({ error: 'Pes s daným ID nebol nájdený.' });
        }

        // Skontrolujeme, či má používateľ prístup (iba vlastný shelter)
        // Predpokladáme, že shelterManager middleware už skontroloval rolu
        // Ale môžeme pridať kontrolu, či pes patrí do shelter používateľa
        if (req.user.shelterId !== dog.shelter_id) {
            return res.status(403).json({ error: 'Nemáte oprávnenie vymazať tohto psa.' });
        }

        // Vymažeme psa (attachments sa vymažú automaticky kvôli CASCADE)
        const deletedRows = await knex('dogs').where({ id: dogId }).del();

        if (deletedRows === 0) {
            return res.status(404).json({ error: 'Pes nebol vymazaný.' });
        }

        // TODO: Vymazať obrázky z Cloudinary (voliteľné, pre čistotu)

        res.status(200).json({ message: 'Pes bol úspešne vymazaný.' });

    } catch (err) {
        console.error(`Chyba pri vymazávaní psa (ID: ${dogId}):`, err);
        res.status(500).json({ error: 'Chyba servera pri vymazávaní záznamu.', error_details: err.stack });
    }
}


module.exports = {
    addDog,
    updateDogImageUrl, 
    getAllDogs,
    getDogById,
    updateDog,
    deleteDog,
};
