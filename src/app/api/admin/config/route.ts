import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [rows] = await pool.execute('SELECT clave, valor FROM configuracion') as any[];
    
    const configMap: Record<string, string> = {};
    rows.forEach((row: any) => {
      configMap[row.clave] = row.valor;
    });

    const provider = configMap['ia_provider'] || 'gemini';
    const apiKey = configMap['ia_api_key'] || '';
    
    // Enmascarar la API Key para el cliente
    const maskedKey = apiKey 
      ? apiKey.length > 8 
        ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
        : '••••••••'
      : '';

    return NextResponse.json({
      provider,
      apiKey: maskedKey,
      hasKey: !!apiKey,
    });
  } catch (error: any) {
    console.error('Error al obtener configuración:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { provider, apiKey } = await request.json();

    if (!provider) {
      return NextResponse.json({ error: 'El proveedor es obligatorio' }, { status: 400 });
    }

    // Actualizar proveedor de IA
    await pool.execute(
      `INSERT INTO configuracion (clave, valor) VALUES ('ia_provider', ?) 
       ON DUPLICATE KEY UPDATE valor = ?`,
      ['ia_provider', provider]
    );

    // Actualizar API Key solo si el usuario ingresó una nueva
    if (apiKey && apiKey !== '••••••••' && !apiKey.includes('...')) {
      await pool.execute(
        `INSERT INTO configuracion (clave, valor) VALUES ('ia_api_key', ?) 
         ON DUPLICATE KEY UPDATE valor = ?`,
        ['ia_api_key', apiKey]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al actualizar configuración:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
