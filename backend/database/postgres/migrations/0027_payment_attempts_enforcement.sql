-- P1 / phase 0027: enforce the payment-attempt invariants already respected
-- by the 0026/P1 runtime. This migration never removes legacy mirrors or
-- rewrites historical rows. Every preflight failure aborts before enforcement.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payment_attempts pa
    WHERE NOT (
      (pa.target_type = 'order' AND pa.order_id IS NOT NULL AND pa.checkout_group_id IS NULL)
      OR (pa.target_type = 'checkout_group' AND pa.checkout_group_id IS NOT NULL AND pa.order_id IS NULL)
    )
  ) THEN RAISE EXCEPTION '0027 preflight failed: invalid payment_attempt target shape'; END IF;

  IF EXISTS (
    SELECT 1 FROM payment_attempts pa
    JOIN orders o ON o.id = pa.order_id
    WHERE pa.target_type = 'order' AND o.checkout_group_id IS NOT NULL
  ) THEN RAISE EXCEPTION '0027 preflight failed: grouped child owns a direct payment attempt'; END IF;

  IF EXISTS (SELECT 1 FROM orders WHERE checkout_group_id IS NOT NULL AND current_payment_attempt_id IS NOT NULL) THEN
    RAISE EXCEPTION '0027 preflight failed: grouped child has current payment attempt pointer';
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders o LEFT JOIN payment_attempts pa ON pa.id = o.current_payment_attempt_id
    WHERE o.current_payment_attempt_id IS NOT NULL
      AND (pa.id IS NULL OR pa.target_type <> 'order' OR pa.order_id <> o.id OR pa.checkout_group_id IS NOT NULL)
  ) THEN RAISE EXCEPTION '0027 preflight failed: order current payment attempt pointer mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM checkout_groups cg LEFT JOIN payment_attempts pa ON pa.id = cg.current_payment_attempt_id
    WHERE cg.current_payment_attempt_id IS NOT NULL
      AND (pa.id IS NULL OR pa.target_type <> 'checkout_group' OR pa.checkout_group_id <> cg.id OR pa.order_id IS NOT NULL)
  ) THEN RAISE EXCEPTION '0027 preflight failed: checkout group current payment attempt pointer mismatch'; END IF;

  IF EXISTS (
    SELECT 1 FROM payment_attempts
    WHERE target_type = 'order' AND status = 'creating'
    GROUP BY order_id HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM payment_attempts
    WHERE target_type = 'checkout_group' AND status = 'creating'
    GROUP BY checkout_group_id HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION '0027 preflight failed: target has duplicate creating attempts'; END IF;

  IF EXISTS (
    SELECT 1 FROM payment_attempts WHERE provider_order_code IS NOT NULL
    GROUP BY provider, payment_profile_code, provider_order_code HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM payment_attempts WHERE provider_payment_link_id IS NOT NULL
    GROUP BY provider, payment_profile_code, provider_payment_link_id HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION '0027 preflight failed: provider identity collision within profile'; END IF;

  IF EXISTS (
    SELECT 1 FROM payment_events
    WHERE payment_profile_code IS NOT NULL AND provider_payment_identity IS NOT NULL
    GROUP BY provider, payment_profile_code, provider_payment_identity HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION '0027 preflight failed: provider event identity collision'; END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'payment_attempts'::regclass AND conname = 'chk_payment_attempts_exactly_one_target') THEN
    ALTER TABLE payment_attempts ADD CONSTRAINT chk_payment_attempts_exactly_one_target CHECK (
      (target_type = 'order' AND order_id IS NOT NULL AND checkout_group_id IS NULL)
      OR (target_type = 'checkout_group' AND checkout_group_id IS NOT NULL AND order_id IS NULL)
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'orders'::regclass AND conname = 'fk_orders_current_payment_attempt') THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_current_payment_attempt
      FOREIGN KEY (current_payment_attempt_id) REFERENCES payment_attempts(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'checkout_groups'::regclass AND conname = 'fk_checkout_groups_current_payment_attempt') THEN
    ALTER TABLE checkout_groups ADD CONSTRAINT fk_checkout_groups_current_payment_attempt
      FOREIGN KEY (current_payment_attempt_id) REFERENCES payment_attempts(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE payment_attempts VALIDATE CONSTRAINT chk_payment_attempts_exactly_one_target;
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_current_payment_attempt;
ALTER TABLE checkout_groups VALIDATE CONSTRAINT fk_checkout_groups_current_payment_attempt;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_creating_order
  ON payment_attempts(order_id)
  WHERE target_type = 'order' AND status = 'creating';
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_creating_group
  ON payment_attempts(checkout_group_id)
  WHERE target_type = 'checkout_group' AND status = 'creating';
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_provider_profile_order_code
  ON payment_attempts(provider, payment_profile_code, provider_order_code)
  WHERE provider_order_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_provider_profile_link_id
  ON payment_attempts(provider, payment_profile_code, provider_payment_link_id)
  WHERE provider_payment_link_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_events_provider_profile_identity
  ON payment_events(provider, payment_profile_code, provider_payment_identity)
  WHERE payment_profile_code IS NOT NULL AND provider_payment_identity IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_payment_attempt_target_0027()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE parent_group_id BIGINT;
BEGIN
  IF NEW.target_type = 'order' THEN
    SELECT checkout_group_id INTO parent_group_id FROM orders WHERE id = NEW.order_id FOR KEY SHARE;
    IF NOT FOUND OR parent_group_id IS NOT NULL THEN
      RAISE EXCEPTION 'payment attempt order target must exist and cannot be a grouped child';
    END IF;
  ELSIF NEW.target_type = 'checkout_group' THEN
    PERFORM 1 FROM checkout_groups WHERE id = NEW.checkout_group_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'payment attempt checkout group target must exist'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_payment_attempt_immutable_0027()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.target_type IS DISTINCT FROM NEW.target_type
      OR OLD.order_id IS DISTINCT FROM NEW.order_id
      OR OLD.checkout_group_id IS DISTINCT FROM NEW.checkout_group_id
      OR OLD.provider IS DISTINCT FROM NEW.provider
      OR OLD.payment_profile_code IS DISTINCT FROM NEW.payment_profile_code
      OR OLD.payment_profile_version IS DISTINCT FROM NEW.payment_profile_version
      OR OLD.amount IS DISTINCT FROM NEW.amount
      OR OLD.currency IS DISTINCT FROM NEW.currency
      OR OLD.provider_order_code IS DISTINCT FROM NEW.provider_order_code THEN
      RAISE EXCEPTION 'payment attempt target and provider snapshot are immutable';
    END IF;
    IF OLD.activated_at IS NOT NULL AND (
      OLD.provider_payment_link_id IS DISTINCT FROM NEW.provider_payment_link_id
      OR OLD.checkout_url IS DISTINCT FROM NEW.checkout_url
      OR OLD.qr_code IS DISTINCT FROM NEW.qr_code
      OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
      OR OLD.activated_at IS DISTINCT FROM NEW.activated_at
    ) THEN RAISE EXCEPTION 'activated payment attempt artifacts are immutable'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_order_current_attempt_0027()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.checkout_group_id IS NOT NULL AND NEW.current_payment_attempt_id IS NOT NULL THEN
    RAISE EXCEPTION 'grouped child order cannot have a current payment attempt';
  END IF;
  IF NEW.current_payment_attempt_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_attempts pa
    WHERE pa.id = NEW.current_payment_attempt_id
      AND pa.target_type = 'order' AND pa.order_id = NEW.id AND pa.checkout_group_id IS NULL
  ) THEN RAISE EXCEPTION 'order current payment attempt must belong to this order'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_checkout_group_current_attempt_0027()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_payment_attempt_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_attempts pa
    WHERE pa.id = NEW.current_payment_attempt_id
      AND pa.target_type = 'checkout_group' AND pa.checkout_group_id = NEW.id AND pa.order_id IS NULL
  ) THEN RAISE EXCEPTION 'checkout group current payment attempt must belong to this checkout group'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_attempt_target_0027 ON payment_attempts;
CREATE TRIGGER trg_payment_attempt_target_0027
  BEFORE INSERT OR UPDATE OF target_type, order_id, checkout_group_id ON payment_attempts
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_attempt_target_0027();
DROP TRIGGER IF EXISTS trg_payment_attempt_immutable_0027 ON payment_attempts;
CREATE TRIGGER trg_payment_attempt_immutable_0027
  BEFORE UPDATE ON payment_attempts
  FOR EACH ROW EXECUTE FUNCTION enforce_payment_attempt_immutable_0027();
DROP TRIGGER IF EXISTS trg_order_current_attempt_0027 ON orders;
CREATE TRIGGER trg_order_current_attempt_0027
  BEFORE INSERT OR UPDATE OF current_payment_attempt_id, checkout_group_id ON orders
  FOR EACH ROW EXECUTE FUNCTION enforce_order_current_attempt_0027();
DROP TRIGGER IF EXISTS trg_checkout_group_current_attempt_0027 ON checkout_groups;
CREATE TRIGGER trg_checkout_group_current_attempt_0027
  BEFORE INSERT OR UPDATE OF current_payment_attempt_id ON checkout_groups
  FOR EACH ROW EXECUTE FUNCTION enforce_checkout_group_current_attempt_0027();
