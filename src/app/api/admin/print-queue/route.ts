import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Helper para validar token do Agente de Impressão
function checkPrintAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const expectedToken = process.env.PRINT_AGENT_TOKEN || 'oh-my-dog-print-secret-token-123';
  return authHeader === `Bearer ${expectedToken}`;
}

export async function GET(req: NextRequest) {
  try {
    if (!checkPrintAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    // Buscar itens pendentes de impressão (printed = false)
    const queueItems = await prisma.printQueue.findMany({
      where: { printed: false },
      include: {
        order: {
          include: {
            items: true
          }
        }
      },
      orderBy: { createdAt: 'asc' } // Imprimir em ordem de chegada
    });

    // Formatar retorno dos pedidos
    const formatted = queueItems.map(item => ({
      printQueueId: item.id,
      order: {
        id: item.order.id,
        clientName: item.order.clientName,
        clientPhone: item.order.clientPhone,
        notes: item.order.notes,
        total: item.order.total.toString(),
        createdAt: item.order.createdAt,
        paymentMethod: item.order.paymentMethod,
        items: item.order.items.map(i => ({
          productName: i.productName,
          quantity: i.quantity,
          productPrice: i.productPrice.toString()
        }))
      }
    }));

    return NextResponse.json({ queue: formatted });

  } catch (error) {
    console.error('[Print Queue GET Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkPrintAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { printQueueId } = await req.json();

    if (!printQueueId) {
      return NextResponse.json({ message: 'ID da fila ausente' }, { status: 400 });
    }

    // Marcar como impresso
    await prisma.printQueue.update({
      where: { id: printQueueId },
      data: {
        printed: true,
        printedAt: new Date()
      }
    });

    console.log(`[Print Queue] Pedido da fila ${printQueueId} impresso com sucesso pelo agente local.`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Print Queue POST Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 5500 });
  }
}
