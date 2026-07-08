ALTER TABLE extracted_data
    ADD COLUMN IF NOT EXISTS contract_value_original DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS contract_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS exchange_rate_to_inr DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS exchange_rate_date VARCHAR(20);

UPDATE extracted_data
SET
    contract_value_original = COALESCE(contract_value_original, contract_value),
    contract_currency = COALESCE(contract_currency, 'INR'),
    exchange_rate_to_inr = COALESCE(exchange_rate_to_inr, 1.0)
WHERE contract_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_extracted_data_party_name ON extracted_data(party_name);
