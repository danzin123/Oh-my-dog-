import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD || 'ohmydog123';

    if (password === adminPassword) {
      const response = NextResponse.json({ success: true });
      
      // Definir cookie com validade de 7 dias
      response.cookies.set('admin_token', 'oh-my-dog-session-approved', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 dias
        path: '/'
      });

      return response;
    }

    return NextResponse.json({ message: 'Senha incorreta' }, { status: 401 });
  } catch (error) {
    console.error('[Admin Login API Error]', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  }
}
