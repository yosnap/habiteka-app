import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';

// Readiness del servicio: el proceso responde Y la base de datos está accesible.
// El proxy de despliegue y el smoke test de CI consumen este endpoint para
// decidir si conmutar tráfico tras un deploy. No incluye dependencias de IA/pagos
// a propósito: un proveedor externo lento no debe marcar la app como caída.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 });
  }
}
