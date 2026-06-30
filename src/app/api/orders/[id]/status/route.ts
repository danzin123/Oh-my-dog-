import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ message: 'Pedido não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      status: order.paymentStatus,
      orderStatus: order.orderStatus
    });

  } catch (error) {
    console.error('[Order Status API Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
