import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// GET - Obtener estado de mantenimiento
export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin DB no inicializado' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const shotType = searchParams.get('shotType'); // Opcional: verificar por tipo de tiro específico

    const configDoc = await adminDb.collection('system_config').doc('maintenance').get();
    
    if (!configDoc.exists) {
      // Si no existe, crear con valores por defecto
      const defaultConfig = {
        enabled: false,
        title: '🔧 SITIO EN MANTENIMIENTO',
        message: 'Estamos ajustando variables importantes del sistema.\n\nEl análisis de lanzamientos está temporalmente deshabilitado.\n\nVolveremos pronto con mejoras. ¡Gracias por tu paciencia!',
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
        shotTypesMaintenance: {
          tres: false,
          media: false,
          libre: true // Tiro libre en mantenimiento por defecto
        }
      };
      
      await adminDb.collection('system_config').doc('maintenance').set(defaultConfig);
      
      // Si se solicita un tipo específico, responder si está en mantenimiento
      if (shotType) {
        const normalized = shotType.toLowerCase();
        let isInMaintenance = false;
        if (normalized.includes('libre') || normalized.includes('free') || normalized.includes('ft')) {
          isInMaintenance = defaultConfig.shotTypesMaintenance.libre;
        } else if (normalized.includes('media') || normalized.includes('jump')) {
          isInMaintenance = defaultConfig.shotTypesMaintenance.media;
        } else {
          isInMaintenance = defaultConfig.shotTypesMaintenance.tres;
        }
        return NextResponse.json({ inMaintenance: isInMaintenance || defaultConfig.enabled, config: defaultConfig });
      }
      
      return NextResponse.json(defaultConfig);
    }

    const config = configDoc.data() as any;
    
    // Si se solicita un tipo específico, responder si está en mantenimiento
    if (shotType) {
      const normalized = shotType.toLowerCase();
      let isInMaintenance = false;
      let typeKey: 'tres' | 'media' | 'libre' = 'tres';
      
      if (normalized.includes('libre') || normalized.includes('free') || normalized.includes('ft')) {
        isInMaintenance = config.shotTypesMaintenance?.libre || false;
        typeKey = 'libre';
      } else if (normalized.includes('media') || normalized.includes('jump')) {
        isInMaintenance = config.shotTypesMaintenance?.media || false;
        typeKey = 'media';
      } else {
        isInMaintenance = config.shotTypesMaintenance?.tres || false;
        typeKey = 'tres';
      }
      
      // Si está en mantenimiento, generar mensaje específico con tipos disponibles
      if (isInMaintenance || config.enabled) {
        const availableTypes: string[] = [];
        if (!config.enabled) {
          if (!config.shotTypesMaintenance?.tres) availableTypes.push('Lanzamiento de Tres');
          if (!config.shotTypesMaintenance?.media) availableTypes.push('Lanzamiento de Media Distancia');
          if (!config.shotTypesMaintenance?.libre) availableTypes.push('Tiro Libre');
        }
        
        let message = config.message;
        if (availableTypes.length > 0) {
          message = `El análisis de ${shotType} está actualmente en mantenimiento.\n\n` +
                   `Los siguientes tipos de análisis están disponibles:\n` +
                   availableTypes.map(t => `• ${t}`).join('\n') +
                   `\n\n💡 Recomendación: Seleccioná uno de los tipos disponibles para continuar.`;
        } else if (!config.enabled && availableTypes.length === 0) {
          message = `El análisis de ${shotType} está actualmente en mantenimiento.\n\n` +
                   `Por favor, vuelve más tarde cuando este tipo de análisis esté disponible.`;
        }
        
        return NextResponse.json({ 
          inMaintenance: true,
          config: {
            ...config,
            message,
            title: config.enabled ? config.title : '🚧 Análisis en Mantenimiento'
          }
        });
      }
      
      return NextResponse.json({ 
        inMaintenance: false,
        config: config 
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error obteniendo configuración de mantenimiento:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Actualizar estado de mantenimiento
export async function POST(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin DB no inicializado' }, { status: 500 });
    }

    const body = await request.json();
    const { enabled, title, message, updatedBy, shotTypesMaintenance } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled debe ser boolean' }, { status: 400 });
    }

    // Obtener configuración actual para mantener shotTypesMaintenance si no se envía
    const currentDoc = await adminDb.collection('system_config').doc('maintenance').get();
    const currentData = currentDoc.exists ? currentDoc.data() : null;

    const config = {
      enabled,
      title: title || '🔧 SITIO EN MANTENIMIENTO',
      message: message || 'El análisis de lanzamientos está temporalmente deshabilitado.',
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'admin',
      shotTypesMaintenance: shotTypesMaintenance || currentData?.shotTypesMaintenance || {
        tres: false,
        media: false,
        libre: true
      }
    };

    await adminDb.collection('system_config').doc('maintenance').set(config);

    return NextResponse.json({ 
      success: true, 
      message: `Mantenimiento ${enabled ? 'habilitado' : 'deshabilitado'} correctamente`,
      config 
    });
  } catch (error) {
    console.error('Error actualizando configuración de mantenimiento:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

