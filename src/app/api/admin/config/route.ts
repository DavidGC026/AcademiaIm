import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

interface ConfigRow extends RowDataPacket {
  clave: string;
  valor: string;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.roleName !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [rows] = await pool.execute<ConfigRow[]>('SELECT clave, valor FROM configuracion');

    const configMap: Record<string, string> = {};
    rows.forEach((row) => {
      configMap[row.clave] = row.valor;
    });

    const provider = process.env.OPENAI_API_KEY ? 'openai' : configMap['ia_provider'] || 'openai';
    const apiKey = configMap['ia_api_key'] || '';
    const model = process.env.OPENAI_MODEL || configMap['ia_model'] || 'gpt-5.6-luna';
    const hasStoredKey = Boolean(apiKey && apiKey !== 'mock_api_key');

    // El cliente sólo necesita saber si puede conservar la clave existente.
    const maskedKey = hasStoredKey ? '••••••••' : '';

    return NextResponse.json({
      provider,
      model,
      apiKey: maskedKey,
      hasKey: hasStoredKey || (provider === 'openai' && Boolean(process.env.OPENAI_API_KEY)),
      managedByEnvironment: provider === 'openai' && Boolean(process.env.OPENAI_API_KEY),
      modelManagedByEnvironment: Boolean(process.env.OPENAI_MODEL),
    });
  } catch (error: unknown) {
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

    const { provider, apiKey, model } = await request.json();

    const allowedProviders = new Set(['openai', 'gemini', 'grok']);
    const allowedOpenAIModels = new Set(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol']);
    if (!allowedProviders.has(provider)) {
      return NextResponse.json({ error: 'Proveedor no válido' }, { status: 400 });
    }
    if (provider === 'openai' && !allowedOpenAIModels.has(model || 'gpt-5.6-luna')) {
      return NextResponse.json({ error: 'Modelo de OpenAI no válido' }, { status: 400 });
    }

    if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 1024)) {
      return NextResponse.json({ error: 'Clave no válida' }, { status: 400 });
    }

    if (process.env.OPENAI_API_KEY && provider !== 'openai') {
      return NextResponse.json({ error: 'La conexión se administra como OpenAI en el servidor.' }, { status: 400 });
    }
    if (process.env.OPENAI_MODEL && model && model !== process.env.OPENAI_MODEL) {
      return NextResponse.json({ error: 'El modelo se administra en el servidor.' }, { status: 400 });
    }
    const hasNewKey = Boolean(apiKey && apiKey !== '••••••••' && !apiKey.includes('...'));
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [currentRows] = await connection.execute<ConfigRow[]>(
        "SELECT clave, valor FROM configuracion WHERE clave IN ('ia_provider', 'ia_api_key') FOR UPDATE"
      );
      const current = Object.fromEntries(currentRows.map(row => [row.clave, row.valor]));
      if (current.ia_provider && current.ia_provider !== provider && !hasNewKey && !process.env.OPENAI_API_KEY) {
        await connection.rollback();
        return NextResponse.json({ error: 'Al cambiar de proveedor, introduce una clave propia del nuevo proveedor.' }, { status: 400 });
      }
      // Guardar proveedor, modelo y clave de forma indivisible.
      await connection.execute(
        `INSERT INTO configuracion (clave, valor) VALUES ('ia_provider', ?)
         ON DUPLICATE KEY UPDATE valor = ?`,
        [provider, provider]
      );

      if (provider === 'openai' && model) {
        await connection.execute(
          `INSERT INTO configuracion (clave, valor) VALUES ('ia_model', ?)
           ON DUPLICATE KEY UPDATE valor = ?`,
          [model, model]
        );
      }

      // Actualizar API Key solo si el usuario ingresó una nueva
      if (hasNewKey) {
        await connection.execute(
          `INSERT INTO configuracion (clave, valor) VALUES ('ia_api_key', ?)
           ON DUPLICATE KEY UPDATE valor = ?`,
          [apiKey, apiKey]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error al actualizar configuración:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
