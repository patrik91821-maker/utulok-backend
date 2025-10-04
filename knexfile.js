require('dotenv').config();

module.exports = {
  // --- PRODUKČNÉ PROSTREDIE (production) ---
  production: {
    client: 'pg',
    // ZMENA: Prepneme 'connection' z reťazca na objekt, aby sme pridali konfiguráciu SSL
    connection: {
      connectionString: process.env.DATABASE_URL,
      // Toto je kľúčové nastavenie pre Render a cloudové databázy, ktoré vyžadujú SSL
      ssl: {
        // Hovorí PostgreSQL ovládaču, aby použil SSL
        // a ignoroval chyby overenia certifikátu (čo je typické na Renderi).
        rejectUnauthorized: false,
      },
    },
    pool: { 
      min: 2, 
      max: 10 
    }
  },
  
  // --- LOKÁLNY VÝVOJ (development) ---
  development: {
    client: 'sqlite3',
    connection: { filename: process.env.DATABASE_FILE || './data/db.sqlite' },
    useNullAsDefault: true
  }
};
