-- Create status_checks table
CREATE TABLE IF NOT EXISTS status_checks (
    id VARCHAR(255) PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);
