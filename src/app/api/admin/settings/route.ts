import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

async function isAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_token')?.value === 'oh-my-dog-session-approved';
}

// GET — buscar configurações atuais
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
  }

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

// PUT — salvar configurações
export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();

    const settings = await prisma.storeSettings.upsert({
      where: { id: 'singleton' },
      update: {
        storeName:             body.storeName            ?? undefined,
        storePhone:            body.storePhone           ?? undefined,
        storeAddress:          body.storeAddress         ?? undefined,
        storeInstagram:        body.storeInstagram       ?? undefined,
        isForceClose:          body.isForceClose         ?? undefined,
        openTime:              body.openTime             ?? undefined,
        closeTime:             body.closeTime            ?? undefined,
        openDays:              body.openDays             ?? undefined,
        deliveryEnabled:       body.deliveryEnabled      ?? undefined,
        withdrawalEnabled:     body.withdrawalEnabled    ?? undefined,
        deliveryBaseFee:       body.deliveryBaseFee      ?? undefined,
        deliveryFeePerKm:      body.deliveryFeePerKm     ?? undefined,
        deliveryMaxDistanceKm: body.deliveryMaxDistanceKm ?? undefined,
        estimatedDeliveryTime: body.estimatedDeliveryTime ?? undefined,
      },
      create: {
        id: 'singleton',
        storeName:             body.storeName            ?? 'Oh my Dog!',
        storePhone:            body.storePhone           ?? '',
        storeAddress:          body.storeAddress         ?? '',
        storeInstagram:        body.storeInstagram       ?? '',
        isForceClose:          body.isForceClose         ?? false,
        openTime:              body.openTime             ?? '17:30',
        closeTime:             body.closeTime            ?? '23:00',
        openDays:              body.openDays             ?? '0,2,3,4,5,6',
        deliveryEnabled:       body.deliveryEnabled      ?? true,
        withdrawalEnabled:     body.withdrawalEnabled    ?? true,
        deliveryBaseFee:       body.deliveryBaseFee      ?? 5.00,
        deliveryFeePerKm:      body.deliveryFeePerKm     ?? 1.50,
        deliveryMaxDistanceKm: body.deliveryMaxDistanceKm ?? 10.00,
        estimatedDeliveryTime: body.estimatedDeliveryTime ?? 40,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
  }
}
