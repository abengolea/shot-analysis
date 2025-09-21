import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// GET - Obtener estado de mantenimiento
export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Admin DB no inicializado' }, { status: 500 });
    }

    const configDoc = await adminDb.collection('system_config').doc('maintenance').get();
    
    if (!configDoc.exists) {
      // Si no existe, crear con valores por defecto
      const defaultConfig = {
        enabled: false,
        title: '🔧 SITIO EN MANTENIMIENTO',
        message: 'Estamos ajustando variables importantes del sistema.\n\nEl análisis de lanzamientos está temporalmente deshabilitado.\n\nVolveremos pronto con mejoras. ¡Gracias por tu paciencia!',
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      };
      
      await adminDb.collection('system_config').doc('maintenance').set(defaultConfig);
      return NextResponse.json(defaultConfig);
    }

    return NextResponse.json(configDoc.data());
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
    const { enabled, title, message, updatedBy } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled debe ser boolean' }, { status: 400 });
    }

    const config = {
      enabled,
      title: title || '🔧 SITIO EN MANTENIMIENTO',
      message: message || 'El análisis de lanzamientos está temporalmente deshabilitado.',
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'admin'
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

