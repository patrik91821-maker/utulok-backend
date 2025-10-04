require('dotenv').config();
const knex = require('./db');

async function init() {
  console.log('Inicializujem DB...');
  // users
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.string('email').unique().notNullable();
      t.string('password_hash');
      t.string('name');
      t.string('phone');
      t.string('role').defaultTo('user'); // user, shelter_admin, platform_admin
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    console.log('Created users');
  }

  // shelters
  if (!(await knex.schema.hasTable('shelters'))) {
    await knex.schema.createTable('shelters', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      t.string('name').notNullable();
      t.text('description');
      t.string('address');
      t.boolean('active').defaultTo(false); // only shown when subscription active
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    console.log('Created shelters');
  }

  // dogs
  if (!(await knex.schema.hasTable('dogs'))) {
    await knex.schema.createTable('dogs', (t) => {
      t.increments('id').primary();
      t.integer('shelter_id').unsigned().references('id').inTable('shelters').onDelete('CASCADE');
      t.string('name');
      t.string('breed');
      t.string('age');
      t.string('gender');
      t.text('description');
      t.boolean('adoptable').defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    console.log('Created dogs');
  }

  // attachments
  if (!(await knex.schema.hasTable('attachments'))) {
    await knex.schema.createTable('attachments', (t) => {
      t.increments('id').primary();
      t.integer('dog_id').unsigned().references('id').inTable('dogs').onDelete('CASCADE');
      t.string('url').notNullable();
      t.string('filename');
      t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    });
    console.log('Created attachments');
  }

  // subscriptions
  if (!(await knex.schema.hasTable('subscriptions'))) {
    await knex.schema.createTable('subscriptions', (t) => {
      t.increments('id').primary();
      t.integer('shelter_id').unsigned().references('id').inTable('shelters').onDelete('CASCADE');
      t.string('provider'); // stripe
      t.string('provider_subscription_id');
      t.integer('amount_cents');
      t.string('status');
      t.timestamp('start_at');
      t.timestamp('end_at');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    console.log('Created subscriptions');
  }

  // payments
  if (!(await knex.schema.hasTable('payments'))) {
    await knex.schema.createTable('payments', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      t.integer('shelter_id').unsigned().references('id').inTable('shelters').onDelete('SET NULL');
      t.integer('dog_id').unsigned().references('id').inTable('dogs').onDelete('SET NULL');
      t.string('provider');
      t.string('provider_payment_id');
      t.integer('amount_cents').notNullable();
      t.string('currency').defaultTo('EUR');
      t.string('purpose'); // donation or subscription
      t.string('status');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
    console.log('Created payments');
  }

  console.log('DB initialization complete');
  process.exit(0);
}

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
