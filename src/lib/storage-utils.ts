/**
 * Utilidades para subir y manejar archivos en Firebase Storage
 */

import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

export interface UploadOptions {
  maxSeconds?: number;
  contentType?: string;
}

/**
 * Sube un video a Firebase Storage
 * @param file - Archivo de video (File o Buffer)
 * @param userId - ID del usuario
 * @param options - Opciones de subida
 * @returns URL del video subido
 */
export async function uploadVideoToStorage(
  file: File | Buffer,
  userId: string,
  options: UploadOptions = {}
): Promise<string> {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const fileName = `videos/${userId}/${timestamp}-${uniqueId}.mp4`;

    // Convertir File a Buffer si es necesario
    let buffer: Buffer;
    if (file instanceof Buffer) {
      buffer = file;
    } else if (typeof (file as File).arrayBuffer === 'function') {
      // Si es un File del navegador, convertir a Buffer
      const arrayBuffer = await (file as File).arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error('Archivo inválido para subir a Storage');
    }

    // Subir el archivo
    const fileRef = bucket.file(fileName);
    await fileRef.save(buffer, {
      metadata: {
        contentType: options.contentType || 'video/mp4',
        metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Generar URL firmada con expiración de 7 días
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    return signedUrl;
  } catch (error) {
    console.error('Error al subir video a Storage:', error);
    throw new Error(`No se pudo subir el video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  }
}

/**
 * Elimina un video de Firebase Storage
 * @param videoUrl - URL del video a eliminar
 */
export async function deleteVideoFromStorage(videoUrl: string): Promise<void> {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();

    // Extraer el path del archivo de la URL
    const url = new URL(videoUrl);
    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
    if (!pathMatch) {
      throw new Error('No se pudo extraer el path del archivo');
    }

    const filePath = decodeURIComponent(pathMatch[1]);
    const fileRef = bucket.file(filePath);

    await fileRef.delete();
      } catch (error) {
    console.error('Error al eliminar video de Storage:', error);
    // No lanzar error, solo loguear
  }
}

/**
 * Obtiene metadata de un video en Storage
 */
export async function getVideoMetadata(videoPath: string) {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file(videoPath);

    const [metadata] = await fileRef.getMetadata();
    return metadata;
  } catch (error) {
    console.error('Error al obtener metadata del video:', error);
    return null;
  }
}

