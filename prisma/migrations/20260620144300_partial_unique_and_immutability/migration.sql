-- Invariantes que el schema declarativo de Prisma no expresa y se definen en SQL.

-- 1) Un único acreditado de bienvenida por organización.
--    El cupo gratis es un saldo finito por cuenta: aunque el registro se reintente
--    o se creen varios proyectos, este índice parcial impide un segundo grant.
CREATE UNIQUE INDEX "credit_ledger_welcome_grant_unique"
  ON "credit_ledger" ("organizationId")
  WHERE "reason" = 'welcome_grant';

-- 2) Inmutabilidad append-only de las tablas de auditoría/telemetría.
--    La traza de acciones admin y el consumo de IA no deben poder alterarse ni
--    borrarse: una función de trigger bloquea UPDATE y DELETE a nivel de base de
--    datos (defensa que no depende de que el código de aplicación se porte bien).
CREATE OR REPLACE FUNCTION "habiteka_block_mutation"()
  RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % no admite % en la tabla %',
    TG_TABLE_NAME, TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_append_only"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "habiteka_block_mutation"();

CREATE TRIGGER "usage_event_append_only"
  BEFORE UPDATE OR DELETE ON "usage_event"
  FOR EACH ROW EXECUTE FUNCTION "habiteka_block_mutation"();
