import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function checkAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === 'oh-my-dog-session-approved';
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verificar autenticação
    if (!checkAuth(req)) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ message: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Verificar se as credenciais do Supabase estão configuradas
    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-supabase-project')) {
      console.warn('[Supabase Mock Upload] Credenciais ausentes. Retornando imagem placeholder.');
      // Fallback para testes: se não tiver Supabase configurado, retorna uma imagem padrão do Unsplash
      const fallbacks = [
        'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1627059318426-472b777625da?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1541214113241-21578d2d9b62?auto=format&fit=crop&w=600&q=80'
      ];
      const randomImage = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      return NextResponse.json({ imageUrl: randomImage });
    }

    // Inicializar cliente Supabase com a Service Role Key (bypassa políticas RLS para upload)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    // Upload do arquivo para o bucket "menu-photos"
    const { data, error } = await supabase.storage
      .from('menu-photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        duplex: 'half'
      });

    if (error) {
      console.error('[Supabase Upload Error]', error);
      return NextResponse.json({ message: `Erro ao subir arquivo: ${error.message}` }, { status: 500 });
    }

    // Obter URL pública do arquivo
    const { data: { publicUrl } } = supabase.storage
      .from('menu-photos')
      .getPublicUrl(filePath);

    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error) {
    console.error('[Admin Upload API Error]', error);
    return NextResponse.json({ message: 'Erro interno ao processar upload' }, { status: 5500 });
  }
}
