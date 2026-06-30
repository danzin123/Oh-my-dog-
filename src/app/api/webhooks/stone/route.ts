import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('[Stone/Pagar.me Webhook Received]', JSON.stringify(payload, null, 2));

    const eventType = payload.type; // Ex: "order.paid"
    const orderData = payload.data; // Dados do pedido da Stone

    if (!eventType || !orderData) {
      return NextResponse.json({ message: 'Payload inválido' }, { status: 400 });
    }

    // Identificar o pedido pelo nosso código local enviado anteriormente
    const orderId = orderData.code;

    if (!orderId) {
      console.warn('[Stone/Pagar.me Webhook] Webhook sem código de pedido (code)');
      return NextResponse.json({ message: 'Código do pedido não fornecido' }, { status: 400 });
    }

    // Se o pagamento foi aprovado ("order.paid" ou "charge.paid")
    if (eventType === 'order.paid' || eventType === 'charge.paid') {
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        console.error(`[Stone/Pagar.me Webhook] Pedido com ID ${orderId} não encontrado no banco local.`);
        return NextResponse.json({ message: 'Pedido não encontrado' }, { status: 404 });
      }

      // Se o pedido ainda está pendente, atualizar para pago e colocar na fila de impressão
      if (order.paymentStatus === 'PENDING') {
        await prisma.$transaction([
          // 1. Atualizar o status do pagamento
          prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'PAID' }
          }),
          // 2. Colocar na fila de impressão
          prisma.printQueue.create({
            data: { orderId: orderId }
          })
        ]);

        console.log(`[Stone/Pagar.me Webhook] Pedido ${orderId} marcado como PAGO e enviado para a fila de impressão.`);

        // Disparar WhatsApp de Confirmação de Pagamento
        const totalFloat = parseFloat(order.total.toString());
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const text = `Olá, ${order.clientName}! Oba, recebemos seu pagamento de R$ ${totalFloat.toFixed(2)}! Seu pedido #${order.id.slice(-6).toUpperCase()} já foi confirmado e já está na chapa! 🌭🔥\n\nAcompanhe seu preparo em tempo real aqui: ${appUrl}/order/${order.id}`;
        await sendWhatsAppMessage(order.clientPhone, text);

      } else {
        console.log(`[Stone/Pagar.me Webhook] Pedido ${orderId} já estava pago. Ignorando.`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('[Stone/Pagar.me Webhook Error]', error);
    return NextResponse.json({ message: 'Erro ao processar webhook' }, { status: 5500 });
  }
}
