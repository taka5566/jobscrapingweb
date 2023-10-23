require('dotenv').config();

const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

const connectionStringSecond = `postgresql://${process.env.DB_USER_SECOND}:${process.env.DB_PASSWORD_SECOND}@${process.env.DB_HOST_SECOND}:${process.env.DB_PORT_SECOND}/${process.env.DB_DATABASE_SECOND}`;

const pool = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL : connectionString
});

const poolSecond = new Pool({
  connectionString: isProduction ? process.env.DATABASE_URL_SECOND : connectionStringSecond
});

module.exports = { pool, poolSecond };