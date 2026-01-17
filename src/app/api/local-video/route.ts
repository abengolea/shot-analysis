import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return new Response('No disponible en producción', { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';
    const safeName = path.basename(name);

    if (!safeName || safeName !== name || !safeName.endsWith('.mp4')) {
      return new Response('Nombre de archivo inválido', { status: 400 });
    }

    const tempDir = path.join(process.cwd(), 'temp');
    const filePath = path.join(tempDir, safeName);

    if (!fs.existsSync(filePath)) {
      return new Response('Video no encontrado en temp', { status: 404 });
    }

    const stream = fs.createReadStream(filePath);
    return new Response(stream as any, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error sirviendo video local:', error);
    return new Response('Error interno', { status: 500 });
  }
}
