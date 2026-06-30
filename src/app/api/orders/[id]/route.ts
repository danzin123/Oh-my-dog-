import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: 'ID do pedido ausente' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!order) {
      return NextResponse.json({ message: 'Pedido não encontrado' }, { status: 404 });
    }

    // Retorna apenas dados públicos seguros do pedido para o cliente acompanhar
    return NextResponse.json({
      order: {
        id: order.id,
        clientName: order.clientName,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        deliveryType: order.deliveryType,
        deliveryFee: order.deliveryFee.toString(),
        total: order.total.toString(),
        addressStreet: order.addressStreet,
        addressNumber: order.addressNumber,
        addressReference: order.addressReference,
        neighborhoodName: order.neighborhoodName,
        createdAt: order.createdAt,
        items: order.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity
        }))
      }
    });

  } catch (error) {
    console.error('[Public Order Fetch Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
