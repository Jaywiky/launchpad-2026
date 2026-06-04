CREATE TABLE
    IF NOT EXISTS launchpad.manifest_state (
        id int PRIMARY KEY DEFAULT 1,
        version int NOT NULL,
        manifest jsonb NOT NULL,
        built_at timestamptz NOT NULL DEFAULT now ()
    );

CREATE TABLE
    IF NOT EXISTS launchpad.manifest_blobs (
        hash text PRIMARY KEY,
        body text NOT NULL,
        built_at timestamptz NOT NULL DEFAULT now ()
    );