import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Verificar autenticação pelo cookie
    const token = req.cookies.get('admin_token')?.value;
    if (token !== 'oh-my-dog-session-approved') {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    // 2. Calcular métricas via agregações rápidas no banco
    const aggregations = await prisma.order.aggregate({
      _sum: {
        total: true
      },
      _count: {
        _all: true
      },
      where: {
        paymentStatus: 'PAID'
      }
    });

    const totalRevenue = aggregations._sum.total ? parseFloat(aggregations._sum.total.toString()) : 0;
    const totalOrders = aggregations._count._all;
    const ticketMedio = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 3. Buscar os pedidos recentes (qualquer status, últimos 20)
    const recentOrders = await prisma.order.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    // 3.1. Calcular taxa de entrega acumulada para motoboy hoje (Fuso SP)
    const todaySPString = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const candidateOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startOfYesterday }
      },
      orderBy: { createdAt: 'desc' }
    });

    const motoboyOrdersToday = candidateOrders.filter(o => {
      const orderDateStr = new Date(o.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return o.deliveryType === 'DELIVERY' && o.paymentStatus === 'PAID' && orderDateStr === todaySPString;
    });

    const todayMotoboyRevenue = motoboyOrdersToday.reduce((sum, o) => sum + parseFloat(o.deliveryFee.toString()), 0);
    const todayMotoboyCount = motoboyOrdersToday.length;

    // 4. Faturamento dos últimos 15 dias (para o gráfico) - filtramos apenas os últimos 15 dias para otimização
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const paidOrdersLast15Days = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: fifteenDaysAgo }
      },
      select: {
        total: true,
        createdAt: true
      }
    });

    const last15Days: { date: string; dateObject: Date; revenue: number; ordersCount: number }[] = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      last15Days.push({
        date: dateString,
        dateObject: d,
        revenue: 0,
        ordersCount: 0
      });
    }

    // Agrupar faturamento por dia usando apenas o subset otimizado
    paidOrdersLast15Days.forEach(order => {
      const orderDateStr = new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayData = last15Days.find(d => d.date === orderDateStr);
      if (dayData) {
        dayData.revenue += parseFloat(order.total.toString());
        dayData.ordersCount += 1;
      }
    });

    // Limpar o objeto dateObject para o JSON de retorno
    const chartData = last15Days.map(d => ({
      date: d.date,
      faturamento: parseFloat(d.revenue.toFixed(2)),
      pedidos: d.ordersCount
    }));

    return NextResponse.json({
      metrics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        ticketMedio: parseFloat(ticketMedio.toFixed(2)),
        todayMotoboyRevenue: parseFloat(todayMotoboyRevenue.toFixed(2)),
        todayMotoboyCount
      },
      chartData,
      todayMotoboyDeliveries: motoboyOrdersToday.map(o => ({
        id: o.id,
        clientName: o.clientName,
        neighborhoodName: o.neighborhoodName || 'Não informado',
        deliveryFee: o.deliveryFee.toString(),
        createdAt: o.createdAt,
        orderStatus: o.orderStatus
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        clientName: o.clientName,
        clientPhone: o.clientPhone,
        notes: o.notes,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        total: o.total.toString(),
        createdAt: o.createdAt,
        deliveryType: o.deliveryType,
        deliveryFee: o.deliveryFee.toString(),
        neighborhoodName: o.neighborhoodName,
        addressStreet: o.addressStreet,
        addressNumber: o.addressNumber,
        addressReference: o.addressReference,
        items: o.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          productPrice: item.productPrice.toString()
        }))
      }))
    });

  } catch (error) {
    console.error('[Admin Dashboard API Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 5500 });
  }
}
