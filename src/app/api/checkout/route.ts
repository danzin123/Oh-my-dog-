import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { getDeliveryFee } from '@/lib/delivery';

export async function POST(req: NextRequest) {
  try {
    const { 
      clientName, 
      clientPhone, 
      paymentMethod, 
      couponCode, 
      items,
      deliveryType,
      addressNeighborhood,
      addressStreet,
      addressNumber,
      addressReference
    } = await req.json();

    if (!clientName || !clientPhone || !items || items.length === 0) {
      return NextResponse.json({ message: 'Dados inválidos' }, { status: 400 });
    }

    // 1. Validar produtos e calcular subtotal
    let subtotal = 0;
    const orderItemsToCreate = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product || !product.active) {
        return NextResponse.json({ message: `Produto indisponível: ${item.productId}` }, { status: 400 });
      }

      const price = parseFloat(product.promotionalPrice?.toString() || product.price.toString());
      subtotal += price * item.quantity;

      orderItemsToCreate.push({
        productId: product.id,
        productName: product.name,
        productPrice: price,
        quantity: item.quantity
      });
    }

    // 2. Validar cupom de desconto se houver
    let discount = 0;
    let validatedCoupon = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase() }
      });

      if (coupon && coupon.active) {
        const minVal = coupon.minOrderValue ? parseFloat(coupon.minOrderValue.toString()) : 0;
        if (subtotal >= minVal) {
          validatedCoupon = coupon;
          discount = coupon.discountType === 'PERCENTAGE'
            ? subtotal * (parseFloat(coupon.value.toString()) / 100)
            : parseFloat(coupon.value.toString());
        }
      }
    }

    // 3. Validar taxa de entrega
    let deliveryFee = 0;
    let neighborhoodName = null;

    if (deliveryType === 'DELIVERY') {
      if (!addressNeighborhood || !addressNeighborhood.trim()) {
        return NextResponse.json({ message: 'Preencha o bairro para a entrega' }, { status: 400 });
      }
      
      neighborhoodName = addressNeighborhood.trim();
      const calcResult = await getDeliveryFee(addressStreet, addressNumber, neighborhoodName);
      
      if (calcResult.maxDistanceExceeded) {
        return NextResponse.json({ 
          message: `Desculpe, seu endereço fica a ${calcResult.distanceKm?.toFixed(1)} km de distância, o que ultrapassa nosso raio de entrega limite de ${calcResult.maxDistanceKm} km.` 
        }, { status: 400 });
      }

      deliveryFee = calcResult.fee;
      console.log(`[Checkout API] Taxa de entrega calculada para "${addressStreet}, ${addressNumber} - ${neighborhoodName}": R$ ${deliveryFee} (via ${calcResult.source})`);
    }

    // Total = Subtotal - Desconto + Taxa de Entrega
    const total = Math.max(0, subtotal - discount + deliveryFee);

    // 4. Criar pedido no Banco de Dados
    const order = await prisma.order.create({
      data: {
        clientName,
        clientPhone,
        notes: items[0]?.notes || '',
        paymentStatus: 'PENDING',
        orderStatus: 'RECEIVED',
        total: total,
        paymentMethod,
        deliveryType: deliveryType || 'WITHDRAWAL',
        deliveryFee: deliveryFee,
        neighborhoodName,
        addressStreet,
        addressNumber,
        addressReference,
        items: {
          create: orderItemsToCreate
        }
      }
    });

    // 5. Integração com Stone/Pagar.me
    const apiKey = process.env.PAGARME_API_KEY;
    const isMock = !apiKey || apiKey === 'ak_test_your_key';

    if (paymentMethod === 'PIX') {
      if (isMock) {
        console.log(`[Pagar.me Mock] Criando cobrança Pix simulada para pedido ${order.id}`);
        const mockPixCode = `00020101021226870014br.gov.bcb.pix2565ohmydogpixmock${order.id}5204000053039865406${total.toFixed(2)}5802BR5910OhMyDogPix6009SaoPaulo62070503***6304`;
        const mockQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockPixCode)}`;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            qrcodeUrl: mockQrCodeUrl,
            qrcodeCopyPaste: mockPixCode
          }
        });

        // Automatizar a aprovação do pagamento em modo testes depois de 8 segundos
        setTimeout(async () => {
          try {
            await prisma.$transaction(async (tx) => {
              const updatedOrder = await tx.order.findUnique({ where: { id: order.id } });
              if (updatedOrder && updatedOrder.paymentStatus === 'PENDING') {
                await tx.order.update({
                  where: { id: order.id },
                  data: { paymentStatus: 'PAID' }
                });
                await tx.printQueue.create({
                  data: { orderId: order.id }
                });
                console.log(`[Pagar.me Mock] Pedido ${order.id} pago e enviado para fila de impressão.`);
                
                // Disparar WhatsApp de Confirmação de Pagamento
                const text = `Olá, ${order.clientName}! Oba, recebemos seu pagamento de R$ ${total.toFixed(2)}! Seu pedido #${order.id.slice(-6).toUpperCase()} já foi confirmado e já está na chapa! 🌭🔥`;
                await sendWhatsAppMessage(order.clientPhone, text);
              }
            });
          } catch (err) {
            console.error('Erro ao aprovar pedido simulado:', err);
          }
        }, 8000);

        return NextResponse.json({
          orderId: order.id,
          pixQrCode: mockQrCodeUrl,
          pixCopyPaste: mockPixCode
        });
      } else {
        // Chamada real para a API V5 do Pagar.me
        const cleanPhone = clientPhone.replace(/\D/g, '');
        const areaCode = cleanPhone.slice(0, 2) || '11';
        const phoneNumber = cleanPhone.slice(2) || '999999999';

        const pagarmePayload = {
          code: order.id,
          items: orderItemsToCreate.map(item => ({
            amount: Math.round(item.productPrice * 100),
            description: item.productName,
            quantity: item.quantity,
            code: item.productId
          })),
          customer: {
            name: clientName,
            type: 'individual',
            email: 'cliente@ohmydog.com.br',
            document: '11111111111',
            phones: {
              mobile_phone: {
                country_code: '55',
                area_code: areaCode,
                number: phoneNumber
              }
            }
          },
          payments: [
            {
              payment_method: 'pix',
              pix: {
                expires_in: 3600,
                additional_information: [
                  {
                    name: 'Estabelecimento',
                    value: 'Oh My Dog'
                  },
                  {
                    name: 'Pedido',
                    value: order.id.slice(-6).toUpperCase()
                  }
                ]
              }
            }
          ]
        };

        const authHeader = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64');

        const response = await fetch('https://api.pagar.me/core/v5/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(pagarmePayload)
        });

        const data = await response.json();

        if (!response.ok) {
          console.error('[Pagar.me Error]', data);
          return NextResponse.json({ message: 'Erro na API de pagamentos da Stone' }, { status: 500 });
        }

        const charge = data.charges?.[0];
        const qrCodeUrl = charge?.last_transaction?.qr_code_url;
        const qrCodeCopyPaste = charge?.last_transaction?.qr_code;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            pagarmeTransactionId: data.id,
            qrcodeUrl: qrCodeUrl,
            qrcodeCopyPaste: qrCodeCopyPaste
          }
        });

        return NextResponse.json({
          orderId: order.id,
          pixQrCode: qrCodeUrl,
          pixCopyPaste: qrCodeCopyPaste
        });
      }
    } else {
      // Cartão de Crédito (Simulado)
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID' }
      });
      await prisma.printQueue.create({
        data: { orderId: order.id }
      });

      // Disparar WhatsApp de Confirmação de Pagamento
      const text = `Olá, ${order.clientName}! Oba, recebemos seu pagamento de R$ ${total.toFixed(2)} no Cartão! Seu pedido #${order.id.slice(-6).toUpperCase()} já foi confirmado e já está na chapa! 🌭🔥`;
      await sendWhatsAppMessage(order.clientPhone, text);

      return NextResponse.json({
        orderId: order.id,
        message: 'Pagamento em cartão aprovado'
      });
    }

  } catch (error) {
    console.error('[Checkout API Error]', error);
    return NextResponse.json({ message: 'Erro interno ao processar pedido' }, { status: 5500 });
  }
}
