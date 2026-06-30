import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Helper para verificar autenticação
function checkAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === 'oh-my-dog-session-approved';
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    const serialized = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      promotionalPrice: p.promotionalPrice ? p.promotionalPrice.toString() : null,
      imageUrl: p.imageUrl,
      category: p.category,
      active: p.active
    }));

    return NextResponse.json({ products: serialized });
  } catch (error) {
    console.error('[Admin Products GET Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { name, description, price, promotionalPrice, imageUrl, category, active } = await req.json();

    if (!name || !description || price === undefined || !category) {
      return NextResponse.json({ message: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        promotionalPrice: promotionalPrice ? parseFloat(promotionalPrice) : null,
        imageUrl,
        category,
        active: active !== undefined ? active : true
      }
    });

    return NextResponse.json({
      product: {
        ...product,
        price: product.price.toString(),
        promotionalPrice: product.promotionalPrice ? product.promotionalPrice.toString() : null
      }
    });
  } catch (error) {
    console.error('[Admin Products POST Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id, name, description, price, promotionalPrice, imageUrl, category, active } = await req.json();

    if (!id || !name || !description || price === undefined || !category) {
      return NextResponse.json({ message: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: parseFloat(price),
        promotionalPrice: promotionalPrice ? parseFloat(promotionalPrice) : null,
        imageUrl,
        category,
        active: active !== undefined ? active : true
      }
    });

    return NextResponse.json({
      product: {
        ...product,
        price: product.price.toString(),
        promotionalPrice: product.promotionalPrice ? product.promotionalPrice.toString() : null
      }
    });
  } catch (error) {
    console.error('[Admin Products PUT Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 5500 });
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

    await prisma.product.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Products DELETE Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
