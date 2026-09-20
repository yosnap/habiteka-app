CREATE TABLE "ai_model_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "configurations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_model_profile_name_key" ON "ai_model_profile"("name");
