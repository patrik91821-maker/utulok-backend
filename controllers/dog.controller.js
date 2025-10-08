const knex = require('../db');

/**
 * Získa zoznam všetkých psov z databázy.
 * Vrátane stĺpca 'image_url'.
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
                'image_url', // Získavame image_url
                'shelter_id'
            )
            // Môžeš pridať aj základné zoradenie, napr. podľa ID zostupne
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
    const { id: dogId } = req.params;

    try {
        const dog = await knex('dogs')
            .where({ id: dogId })
            .select('*') // Vyberie všetky stĺpce, vrátane image_url
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
 * Pridá nového psa do databázy (KROK 1: Textové dáta).
 * Predpokladá, že používateľ je overený a je manažér útulku (middleware).
 * Vráti novo vytvorený objekt psa s jeho ID.
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
    } = req.body;
    
    // Získanie shelterId z req.user (pridané overovacím middleware)
    const shelterId = req.user.shelterId; 

    // Základná validácia
    if (!name || !gender || !description) { 
        return res.status(400).json({ error: 'Meno, pohlavie a popis sú povinné polia.' });
    }
    
    // Predvolená URL pre obrázok, kým sa nenahrá prvá fotka (vyžaduje NOT NULL v DB)
    const defaultImageUrl = 'https://placehold.co/600x400/FFC0CB/555555?text=Novy+pes';

    try {
        const dogData = {
            shelter_id: shelterId,
            name: name,
            breed: breed || null, // Ak plemeno chýba
            // Vek konvertujeme na int alebo null. Db schema ho má ako char varying, 
            // ale pre ucelenosť vkladaných dát použijeme to čo je najvhodnejšie
            age: parseInt(age, 10) || null, 
            description: description,
            gender: gender,
            status: status || 'Prijatý', // Použijeme status 'Prijatý' z DB defaultu 
            image_url: defaultImageUrl, // Vďaka tomuto splníme NOT NULL podmienku
            created_at: knex.fn.now(),
            updated_at: knex.fn.now(),
        };

        const [{ id: newDogId }] = await knex('dogs').insert(dogData).returning('id');

        const newDog = await knex('dogs').where({ id: newDogId }).first();

        res.status(201).json(newDog);

    } catch (err) {
        console.error('Chyba pri pridávaní psa:', err);
        res.status(500).json({ error: 'Chyba servera pri vkladaní záznamu.', error_details: err.stack });
    }
}

/**
 * Všeobecná aktualizácia záznamu psa, vrátane možnosti zmeny image_url.
 * @route PUT /api/dogs/:id
 */
async function updateDog(req, res) {
    const { id: dogId } = req.params;
    const { name, breed, age, description, gender, status, adoptable, image_url } = req.body;

    // Príprava dát na aktualizáciu. updated_at je vždy aktualizované.
    const updateData = { updated_at: knex.fn.now() };

    // Dynamicky pridávame len polia, ktoré boli v požiadavke poslané
    if (name !== undefined) updateData.name = name;
    if (breed !== undefined) updateData.breed = breed;
    // Pre vek respektujeme, že musí byť celé číslo alebo null
    if (age !== undefined) updateData.age = parseInt(age, 10) || null; 
    if (description !== undefined) updateData.description = description;
    if (gender !== undefined) updateData.gender = gender;
    if (status !== undefined) updateData.status = status;
    if (adoptable !== undefined) updateData.adoptable = adoptable;
    
    // Ak je poslaná nová image_url (buď na nastavenie, alebo napr. null na reset)
    if (image_url !== undefined) {
        updateData.image_url = image_url;
    }

    // Ak nemáme čo aktualizovať, vrátime chybu
    if (Object.keys(updateData).length === 1 && updateData.updated_at) {
        return res.status(400).json({ error: 'Žiadne platné dáta na aktualizáciu.' });
    }

    try {
        const updatedRows = await knex('dogs')
            .where({ id: dogId })
            .update(updateData)
            .returning('*'); // Vráti aktualizovaný záznam

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

/**
 * Odstránenie psa. (Zatiaľ neimplementované)
 * @route DELETE /api/dogs/:id
 */
const deleteDog = (req, res) => res.status(501).json({ message: "Not Implemented: Odstránenie psa zatiaľ neimplementované" });


module.exports = {
    addDog,
    updateDogImageUrl, 
    getAllDogs,
    getDogById,
    updateDog,
    deleteDog,
};
