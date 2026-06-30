import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryFee } from '@/lib/delivery';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const street = searchParams.get('street') || '';
    const number = searchParams.get('number') || '';
    const neighborhoodName = searchParams.get('neighborhood') || '';

    if (!street || !neighborhoodName) {
      return NextResponse.json({ fee: 0 });
    }

    const { fee, distanceKm, source } = await getDeliveryFee(street, number, neighborhoodName);
    console.log(`[Preview Fee API] Calc para "${street}, ${number} - ${neighborhoodName}": R$ ${fee} (${distanceKm ? distanceKm.toFixed(2) + 'km' : 'N/A'} via ${source})`);
    
    return NextResponse.json({ fee });

  } catch (error) {
    console.error('[Preview Fee API Error]', error);
    return NextResponse.json({ fee: 8.00 });
  }
}
