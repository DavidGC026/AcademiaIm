import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.roleName !== 'maestro' && session.roleName !== 'administrador')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Asegurar directorio public/uploads
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Nombre único
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `recurso-${Date.now()}.${fileExtension}`;
    const filePath = join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);
    await access(filePath);

    const fileUrl = `/uploads/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      name: file.name,
      url: fileUrl,
    });
  } catch (error: any) {
    console.error('Error al subir recurso:', error);
    return NextResponse.json({ error: 'Error del servidor al subir el archivo' }, { status: 500 });
  }
}
export const runtime = 'nodejs';
