/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS launchpad;
    SET search_path TO launchpad;

    CREATE TABLE food_banks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL
    );

    CREATE TABLE toilets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL
    );

    CREATE TABLE digital_spaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL
    );

    CREATE TABLE recycling_plants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL
    );

    CREATE TABLE green_spaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL
    );

    CREATE TABLE libraries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude NUMERIC(10, 6) NOT NULL,
        longitude NUMERIC(10, 6) NOT NULL
    );

    CREATE TABLE ui_translations (
        id SERIAL PRIMARY KEY,
        language_code VARCHAR(10) NOT NULL,
        translation_key VARCHAR(255) NOT NULL, 
        translated_text TEXT NOT NULL,
        UNIQUE (language_code, translation_key) 
    );

    CREATE TABLE content_translations (
        id SERIAL PRIMARY KEY,
        resource_id INTEGER NOT NULL, 
        resource_type VARCHAR(50) NOT NULL, 
        language_code VARCHAR(10) NOT NULL, 
        translated_description TEXT NOT NULL
    );

    CREATE TABLE cache_log (
        id SERIAL PRIMARY KEY,
        action_taken VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    SET search_path TO launchpad;
    
    DROP TABLE IF EXISTS cache_log CASCADE;
    DROP TABLE IF EXISTS content_translations CASCADE;
    DROP TABLE IF EXISTS ui_translations CASCADE;
    DROP TABLE IF EXISTS libraries CASCADE;
    DROP TABLE IF EXISTS green_spaces CASCADE;
    DROP TABLE IF EXISTS recycling_plants CASCADE;
    DROP TABLE IF EXISTS digital_spaces CASCADE;
    DROP TABLE IF EXISTS toilets CASCADE;
    DROP TABLE IF EXISTS food_banks CASCADE;
  `);
};