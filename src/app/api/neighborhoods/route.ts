import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const neighborhoods = await prisma.neighborhood.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });

    const serialized = neighborhoods.map(n => ({
      id: n.id,
      name: n.name,
      deliveryFee: n.deliveryFee.toString()
    }));

    return NextResponse.json({ neighborhoods: serialized });
  } catch (error) {
    console.error('[Neighborhoods GET Error]', error);
    return NextResponse.json({ message: 'Erro interno ao buscar bairros' }, { status: 5500 });
  }
}
