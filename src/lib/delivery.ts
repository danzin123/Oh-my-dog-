import { prisma } from '@/lib/db';

let cachedAddress = '';
let cachedLat = -22.9228816;
let cachedLon = -46.5451430;

async function getStoreCoordinates(address: string): Promise<{ lat: number; lon: number }> {
  if (address === cachedAddress) {
    return { lat: cachedLat, lon: cachedLon };
  }

  if (!address || address.includes('Rua da Tecnologia, 536')) {
    cachedAddress = address;
    cachedLat = -22.9228816;
    cachedLon = -46.5451430;
    return { lat: cachedLat, lon: cachedLon };
  }

  try {
    const query = `${address}, Bragança Paulista, SP`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'OhMyDogDeliveryService/1.0 (suporte@ohmydog.com.br)'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        cachedAddress = address;
        cachedLat = parseFloat(data[0].lat);
        cachedLon = parseFloat(data[0].lon);
        console.log(`[Store Geocoding] Endereço da loja atualizado para: ${address} (${cachedLat}, ${cachedLon})`);
        return { lat: cachedLat, lon: cachedLon };
      }
    }
  } catch (err) {
    console.error('[Store Geocoding Error] Falha ao geocodificar endereço da loja:', err);
  }

  return { lat: -22.9228816, lon: -46.5451430 };
}

export async function getDeliveryFee(
  street: string,
  number: string,
  neighborhoodName: string
): Promise<{
  fee: number;
  distanceKm: number | null;
  source: string;
  maxDistanceExceeded: boolean;
  maxDistanceKm: number;
}> {
  // Buscar configurações da loja
  const settings = await prisma.storeSettings.findUnique({
    where: { id: 'singleton' }
  });

  const baseFee = settings ? parseFloat(settings.deliveryBaseFee.toString()) : 5.00;
  const feePerKm = settings ? parseFloat(settings.deliveryFeePerKm.toString()) : 1.50;
  const maxDistanceKm = settings ? parseFloat(settings.deliveryMaxDistanceKm.toString()) : 10.00;
  const storeAddress = settings?.storeAddress || 'Rua da Tecnologia, 536, Bragança Paulista, SP';

  const storeCoords = await getStoreCoordinates(storeAddress);
  const storeLat = storeCoords.lat;
  const storeLon = storeCoords.lon;

  let deliveryFee = 0;
  let distanceCalculated = false;
  let distanceKm: number | null = null;
  let source = 'unknown';

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Tentar com Google Maps API (Se a chave estiver configurada)
  if (apiKey && street && number) {
    try {
      const origin = storeAddress;
      const destination = `${street}, ${number}, ${neighborhoodName || ''}, Bragança Paulista, SP`;
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const distanceMeters = data.rows[0].elements[0].distance.value;
        distanceKm = distanceMeters / 1000;
        
        const calculatedFee = baseFee + (distanceKm * feePerKm);
        deliveryFee = Math.round(calculatedFee * 2) / 2;
        distanceCalculated = true;
        source = 'google-maps';
      }
    } catch (err) {
      console.error('[Google Maps API Error]', err);
    }
  }

  // 2. Tentar com OpenStreetMap (Nominatim + OSRM) - Grátis, sem chaves e real!
  if (!distanceCalculated && street) {
    try {
      const query = `${street}, ${number || ''}, Bragança Paulista, SP`;
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      
      const geoRes = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'OhMyDogDeliveryService/1.0 (suporte@ohmydog.com.br)'
        }
      });
      
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          const clientLat = parseFloat(geoData[0].lat);
          const clientLon = parseFloat(geoData[0].lon);
          
          const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${storeLon},${storeLat};${clientLon},${clientLat}?overview=false`;
          const osrmRes = await fetch(osrmUrl);
          
          if (osrmRes.ok) {
            const osrmData = await osrmRes.json();
            if (osrmData && osrmData.routes && osrmData.routes[0]) {
              const distanceMeters = osrmData.routes[0].distance;
              distanceKm = distanceMeters / 1000;
              
              const calculatedFee = baseFee + (distanceKm * feePerKm);
              deliveryFee = Math.round(calculatedFee * 2) / 2;
              distanceCalculated = true;
              source = 'openstreetmap-osrm';
            }
          }
        }
      }
    } catch (err) {
      console.error('[OpenStreetMap Geocoding/Routing Error]', err);
    }
  }

  // 3. Fallback para correspondência de Bairro no Banco
  if (!distanceCalculated && neighborhoodName) {
    try {
      const matched = await prisma.neighborhood.findFirst({
        where: {
          name: { contains: neighborhoodName.trim() },
          active: true
        }
      });
      if (matched) {
        deliveryFee = parseFloat(matched.deliveryFee.toString());
        distanceCalculated = true;
        source = 'neighborhood-db-fallback';
      }
    } catch (err) {
      console.error('[DB Neighborhood Fallback Error]', err);
    }
  }

  // 4. Fallback Geral (Garante uma taxa básica se falhar tudo)
  if (!distanceCalculated) {
    deliveryFee = baseFee;
    source = 'general-fallback-flat';
  }

  // Validar se excede a distância máxima
  const maxDistanceExceeded = distanceKm !== null && distanceKm > maxDistanceKm;

  return {
    fee: deliveryFee,
    distanceKm,
    source,
    maxDistanceExceeded,
    maxDistanceKm
  };
}
