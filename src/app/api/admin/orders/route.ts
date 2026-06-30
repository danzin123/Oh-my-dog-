import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

function checkAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === 'oh-my-dog-session-approved';
}

export async function PUT(req: NextRequest) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { id, orderStatus, paymentStatus } = await req.json();

    if (!id) {
      return NextResponse.json({ message: 'ID do pedido ausente' }, { status: 400 });
    }

    const updateData: { orderStatus?: string; paymentStatus?: string } = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    const order = await prisma.order.update({
      where: { id },
      data: updateData
    });

    // Se o status do pagamento for atualizado para PAID manualmente, enviar para fila de impressão
    if (paymentStatus === 'PAID') {
      const existsInQueue = await prisma.printQueue.findUnique({
        where: { orderId: id }
      });
      if (!existsInQueue) {
        await prisma.printQueue.create({
          data: { orderId: id }
        });
      }
    }

    // Disparar notificações de WhatsApp com base no status do preparo
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    if (orderStatus === 'READY' && order.deliveryType === 'WITHDRAWAL') {
      const text = `Olá, ${order.clientName}! Seu Oh my Dog está pronto e te aguardando no balcão! Pode vir buscar seu lanche quentinho! 🌭📦✨\n\nAcompanhe seu pedido aqui: ${appUrl}/order/${order.id}`;
      await sendWhatsAppMessage(order.clientPhone, text);
    } else if (orderStatus === 'DISPATCHED' && order.deliveryType === 'DELIVERY') {
      const text = `Olá, ${order.clientName}! Seu Oh my Dog acabou de sair para entrega! O motoboy está a caminho do seu endereço: ${order.addressStreet}, ${order.addressNumber} (${order.neighborhoodName}). 🏍️🌭🔥\n\nAcompanhe o trajeto aqui: ${appUrl}/order/${order.id}`;
      await sendWhatsAppMessage(order.clientPhone, text);
    } else if (orderStatus === 'DELIVERED') {
      const text = `Olá, ${order.clientName}! Seu Oh my Dog foi entregue com sucesso! 🎉 Esperamos que goste do lanche! Bom apetite! 🌭😋\n\nAcompanhe os detalhes: ${appUrl}/order/${order.id}`;
      await sendWhatsAppMessage(order.clientPhone, text);
    }

    return NextResponse.json({
      order: {
        ...order,
        total: order.total.toString()
      }
    });

  } catch (error) {
    console.error('[Admin Orders PUT Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 5500 });
  }
}
