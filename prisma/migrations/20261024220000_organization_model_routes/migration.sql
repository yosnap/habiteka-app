-- Cada organización elige sus modelos por uso; sin elección usa los recomendados del panel.
CREATE TABLE "organization_model_route" (
    "organizationId" TEXT NOT NULL,
    "action" "ModelAction" NOT NULL,
    "position" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_model_route_pkey" PRIMARY KEY ("organizationId","action","position")
);

ALTER TABLE "organization_model_route" ADD CONSTRAINT "organization_model_route_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
