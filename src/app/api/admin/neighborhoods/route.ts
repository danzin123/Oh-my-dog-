import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function checkAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === 'oh-my-dog-session-approved';
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const neighborhoods = await prisma.neighborhood.findMany({
      orderBy: { name: 'asc' }
    });

    const serialized = neighborhoods.map(n => ({
      id: n.id,
      name: n.name,
      deliveryFee: n.deliveryFee.toString(),
      active: n.active
    }));

    return NextResponse.json({ neighborhoods: serialized });
  } catch (error) {
    console.error('[Admin Neighborhoods GET Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { name, deliveryFee, active } = await req.json();

    if (!name || deliveryFee === undefined) {
      return NextResponse.json({ message: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const neighborhood = await prisma.neighborhood.create({
      data: {
        name,
        deliveryFee: parseFloat(deliveryFee),
        active: active !== undefined ? active : true
      }
    });

    return NextResponse.json({
      neighborhood: {
        ...neighborhood,
        deliveryFee: neighborhood.deliveryFee.toString()
      }
    });
  } catch (error) {
    console.error('[Admin Neighborhoods POST Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id, name, deliveryFee, active } = await req.json();

    if (!id || !name || deliveryFee === undefined) {
      return NextResponse.json({ message: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const neighborhood = await prisma.neighborhood.update({
      where: { id },
      data: {
        name,
        deliveryFee: parseFloat(deliveryFee),
        active: active !== undefined ? active : true
      }
    });

    return NextResponse.json({
      neighborhood: {
        ...neighborhood,
        deliveryFee: neighborhood.deliveryFee.toString()
      }
    });
  } catch (error) {
    console.error('[Admin Neighborhoods PUT Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'ID ausente' }, { status: 400 });
    }

    await prisma.neighborhood.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Neighborhoods DELETE Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
