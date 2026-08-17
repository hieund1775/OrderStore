-- Google identity is keyed by user_identities.provider/provider_subject. A
-- customer created from Google can therefore have no phone number initially.
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
