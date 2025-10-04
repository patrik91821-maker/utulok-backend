require('dotenv').config();
module.exports = {
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 }
  },
  development: {
    client: 'sqlite3',
    connection: { filename: process.env.DATABASE_FILE || './data/db.sqlite' },
    useNullAsDefault: true
  }
};
