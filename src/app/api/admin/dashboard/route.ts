import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Verificar autenticação pelo cookie
    const token = req.cookies.get('admin_token')?.value;
    if (token !== 'oh-my-dog-session-approved') {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    // 1.1. Obter período selecionado
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'ALL'; // TODAY, YESTERDAY, LAST_7, MONTH, ALL

    let dateQuery: any = undefined;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    if (period === 'TODAY') {
      const todaySPStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
      const startUTC = new Date(`${todaySPStr}T00:00:00.000-03:00`);
      dateQuery = { gte: startUTC };
    } else if (period === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdaySPStr = yesterday.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
      const startUTC = new Date(`${yesterdaySPStr}T00:00:00.000-03:00`);
      const endUTC = new Date(`${yesterdaySPStr}T23:59:59.999-03:00`);
      dateQuery = { gte: startUTC, lte: endUTC };
    } else if (period === 'LAST_7') {
      const last7 = new Date(now);
      last7.setDate(last7.getDate() - 7);
      const last7SPStr = last7.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
      const startUTC = new Date(`${last7SPStr}T00:00:00.000-03:00`);
      dateQuery = { gte: startUTC };
    } else if (period === 'MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartSPStr = monthStart.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
      const startUTC = new Date(`${monthStartSPStr}T00:00:00.000-03:00`);
      dateQuery = { gte: startUTC };
    }

    const metricsWhere: any = { paymentStatus: 'PAID' };
    if (dateQuery) {
      metricsWhere.createdAt = dateQuery;
    }

    // 2. Calcular métricas via agregações rápidas no banco
    const aggregations = await prisma.order.aggregate({
      _sum: {
        total: true
      },
      _count: {
        _all: true
      },
      where: metricsWhere
    });

    const totalRevenue = aggregations._sum.total ? parseFloat(aggregations._sum.total.toString()) : 0;
    const totalOrders = aggregations._count._all;
    const ticketMedio = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 3. Buscar os pedidos recentes (qualquer status)
    const recentOrdersWhere: any = {};
    if (dateQuery) {
      recentOrdersWhere.createdAt = dateQuery;
    }
    const recentOrders = await prisma.order.findMany({
      where: recentOrdersWhere,
      take: period === 'ALL' ? 20 : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: true
      }
    });

    // 3.1. Calcular taxa de entrega acumulada para motoboy no período
    const motoboyWhere: any = {
      deliveryType: 'DELIVERY',
      paymentStatus: 'PAID'
    };
    if (dateQuery) {
      motoboyWhere.createdAt = dateQuery;
    } else {
      // Se for "ALL", calcula apenas para hoje por padrão para manter o card limpo
      const todaySPStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
      const startUTC = new Date(`${todaySPStr}T00:00:00.000-03:00`);
      motoboyWhere.createdAt = { gte: startUTC };
    }

    const motoboyOrdersToday = await prisma.order.findMany({
      where: motoboyWhere,
      orderBy: { createdAt: 'desc' }
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
