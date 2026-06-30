import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const subtotalStr = searchParams.get('subtotal');

    if (!code || !subtotalStr) {
      return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 });
    }

    const subtotal = parseFloat(subtotalStr);

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon || !coupon.active) {
      return NextResponse.json({ message: 'Cupom não encontrado ou inativo' }, { status: 404 });
    }

    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      return NextResponse.json({ message: 'Cupom expirado' }, { status: 400 });
    }

    const minVal = coupon.minOrderValue ? parseFloat(coupon.minOrderValue.toString()) : 0;
    if (subtotal < minVal) {
      return NextResponse.json({
        message: `Valor mínimo para este cupom é R$ ${minVal.toFixed(2)}`
      }, { status: 400 });
    }

    return NextResponse.json({
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value.toString(),
        minOrderValue: coupon.minOrderValue ? coupon.minOrderValue.toString() : null
      }
    });

  } catch (error) {
    console.error('[Coupon Validation Error]', error);
    return NextResponse.json({ message: 'Erro interno ao validar cupom' }, { status: 500 });
  }
}
