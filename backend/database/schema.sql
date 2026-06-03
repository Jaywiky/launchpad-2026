CREATE SCHEMA IF NOT EXISTS launchpad;

SET search_path TO launchpad;

CREATE TABLE IF NOT EXISTS resources (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'food_bank',
            'toilet',
            'library',
            'recycling',
            'green_space'
        )
    ),
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    address TEXT NOT NULL DEFAULT 'Address unavailable',
    opening_hours TEXT,
    notes TEXT,
    source VARCHAR(50) NOT NULL CHECK (source IN ('givefood', 'overpass')),
    extended JSONB NOT NULL DEFAULT '{}',
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resources_type ON resources (type);
CREATE INDEX IF NOT EXISTS idx_resources_source ON resources (source);


CREATE TABLE IF NOT EXISTS data_translations (
    hash VARCHAR(64) PRIMARY KEY, 
    translations JSONB NOT NULL DEFAULT '{"en": ""}'::jsonb,
    used_in_types TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_data_translations_types ON data_translations USING GIN (used_in_types);


CREATE TABLE IF NOT EXISTS ui_translations (
    id SERIAL PRIMARY KEY,
    language_code VARCHAR(10) NOT NULL,
    translation_key VARCHAR(255) NOT NULL,
    translated_text TEXT NOT NULL,
    UNIQUE (language_code, translation_key)
);


CREATE TABLE IF NOT EXISTS manifest_state (
    id int PRIMARY KEY DEFAULT 1,
    version int NOT NULL,
    manifest jsonb NOT NULL,
    built_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS manifest_blobs (
    hash text PRIMARY KEY,
    body text NOT NULL,
    built_at timestamptz NOT NULL DEFAULT now()
);