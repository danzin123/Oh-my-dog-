import { prisma } from '@/lib/db';

export async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  try {
    // Buscar configurações do WhatsApp do banco de dados (singleton)
    const settings = await prisma.storeSettings.findUnique({
      where: { id: 'singleton' }
    });

    const apiUrl = settings?.whatsappApiUrl || process.env.WHATSAPP_API_URL;
    const apiToken = settings?.whatsappApiToken || process.env.WHATSAPP_API_TOKEN;
    const instanceName = settings?.whatsappInstance || process.env.WHATSAPP_INSTANCE;


    // Limpar o número do telefone (manter apenas números)
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Se o número não começar com o código do país (55 para Brasil), adicionar 55
    if (cleanPhone.length > 0 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    // Verificar se a API está configurada
    const isConfigured = apiUrl && apiToken && instanceName && !apiUrl.includes('your-whatsapp-url');

    if (!isConfigured) {
      // Simulação em console para desenvolvimento
      console.log('\n==================================================================');
      console.log(`[SIMULAÇÃO WHATSAPP] Notificação disparada para: ${cleanPhone}`);
      console.log(`Mensagem: "${text}"`);
      console.log('==================================================================\n');
      return true;
    }

    // Chamada real para Evolution API ou Z-API (compatível com Evolution API v1/v2)
    const url = `${apiUrl}/message/sendText/${instanceName}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiToken
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: text,
        delay: 1200, // atraso de 1.2 segundos para parecer humano
        linkPreview: false
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`[WhatsApp API] Mensagem enviada com sucesso para ${cleanPhone}`);
      return true;
    } else {
      console.error(`[WhatsApp API Error] Falha ao enviar para ${cleanPhone}:`, data);
      return false;
    }

  } catch (error: any) {
    console.error('[WhatsApp Helper Error]', error.message);
    return false;
  }
}
