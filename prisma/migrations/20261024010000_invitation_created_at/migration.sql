-- Better Auth 1.7 registra la fecha de creación de las invitaciones de su
-- plugin de organizaciones. Las existentes toman la fecha de la migración.
ALTER TABLE "invitation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
