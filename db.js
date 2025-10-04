require('dotenv').config();
const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const config = require('./knexfile')[environment];
const knex = require('knex')(config);
module.exports = knex;
