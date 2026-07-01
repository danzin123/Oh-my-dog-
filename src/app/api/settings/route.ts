import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET público — cardápio usa para checar horário e status da loja
export async function GET() {
  try {
    const settings = await prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
