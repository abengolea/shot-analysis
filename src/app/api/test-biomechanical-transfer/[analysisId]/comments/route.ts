import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { CommentRequest } from '@/lib/timeline-types';

const SNAP_TOLERANCE_MS = 80; // Tolerancia para ajustar a keyframe cercano

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { tMs, text, tag, anchor } = await request.json() as CommentRequest;
    const { analysisId } = await params;

    if (!tMs || typeof tMs !== 'number' || tMs < 0) {
      return NextResponse.json(
        { error: 'tMs debe ser un número positivo' },
        { status: 400 }
      );
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'text es requerido y no puede estar vacío' },
        { status: 400 }
      );
    }

    // 1. Obtener timeline existente
    const timelineRef = adminDb.collection('biomech_timelines').doc(analysisId);
    const timelineDoc = await timelineRef.get();

    if (!timelineDoc.exists) {
      return NextResponse.json(
        { error: 'Análisis no encontrado' },
        { status: 404 }
      );
    }

    const timeline = timelineDoc.data() as any;
    const keyframes = timeline.keyframes || [];

    // 2. Buscar keyframe cercano (tolerancia ±80ms)
    let keyframe = keyframes.find((kf: any) => 
      Math.abs(kf.tMs - tMs) <= SNAP_TOLERANCE_MS
    );

    // 3. Si no existe, crear nuevo keyframe
    if (!keyframe) {
      keyframe = {
        id: uuidv4(),
        tMs: Math.round(tMs),
        thumbUrl: '', // Se generará después si es necesario
        notes: [],
        eventType: 'manual',
      };
      keyframes.push(keyframe);
    }

    // 4. Agregar nota
    const note = {
      id: uuidv4(),
      author: 'user', // TODO: obtener de auth
      text: text.trim(),
      tags: tag ? [tag] : [],
      createdAt: new Date().toISOString(),
      anchor: anchor || 'none',
    };

    keyframe.notes.push(note);

    // 5. Ordenar keyframes por tMs
    keyframes.sort((a: any, b: any) => a.tMs - b.tMs);

    // 6. Actualizar timeline
    await timelineRef.update({
      keyframes,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      keyframe: {
        id: keyframe.id,
        tMs: keyframe.tMs,
        notes: keyframe.notes,
      },
      note,
    });

  } catch (error: any) {
    console.error('Error agregando comentario:', error);
    return NextResponse.json(
      {
        error: 'Error al agregar comentario',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;

    const timelineRef = adminDb.collection('biomech_timelines').doc(analysisId);
    const timelineDoc = await timelineRef.get();

    if (!timelineDoc.exists) {
      return NextResponse.json(
        { error: 'Análisis no encontrado' },
        { status: 404 }
      );
    }

    const timeline = timelineDoc.data();

    return NextResponse.json({
      success: true,
      timeline,
    });

  } catch (error: any) {
    console.error('Error obteniendo timeline:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener timeline',
        details: error.message,
      },
      { status: 500 }
    );
  }
}


