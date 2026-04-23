-- Adiciona coluna `name` em `User` com backfill a partir da parte local do email
-- (ex.: admin@acme.test -> "Admin") antes de aplicar NOT NULL.
ALTER TABLE "User" ADD COLUMN "name" TEXT;

UPDATE "User"
SET "name" = INITCAP(SPLIT_PART("email", '@', 1))
WHERE "name" IS NULL;

ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
