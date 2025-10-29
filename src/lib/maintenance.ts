import { adminDb } from '@/lib/firebase-admin';

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  updatedAt: string;
  updatedBy: string;
  // Mantenimiento por tipo de tiro
  shotTypesMaintenance?: {
    tres: boolean;
    media: boolean;
    libre: boolean;
  };
}

/**
 * Verifica si el sistema está en modo mantenimiento
 * @returns Promise<MaintenanceConfig | null> - La configuración de mantenimiento o null si hay error
 */
export async function getMaintenanceConfig(): Promise<MaintenanceConfig | null> {
  try {
    if (!adminDb) {
      console.error('Admin DB no inicializado');
      return null;
    }

    const configDoc = await adminDb.collection('system_config').doc('maintenance').get();
    
    if (!configDoc.exists) {
      // Si no existe, crear con valores por defecto (mantenimiento deshabilitado)
      const defaultConfig: MaintenanceConfig = {
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
      return defaultConfig;
    }

    return configDoc.data() as MaintenanceConfig;
  } catch (error) {
    console.error('Error obteniendo configuración de mantenimiento:', error);
    return null;
  }
}

/**
 * Verifica si el sistema está en modo mantenimiento
 * @returns Promise<boolean> - true si está en mantenimiento, false si no
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const config = await getMaintenanceConfig();
  return config?.enabled || false;
}

/**
 * Verifica si un tipo de tiro específico está en mantenimiento
 * @param shotType - Tipo de tiro a verificar ('tres', 'media', 'libre')
 * @returns Promise<boolean> - true si está en mantenimiento, false si no
 */
export async function isShotTypeInMaintenance(shotType: 'tres' | 'media' | 'libre'): Promise<boolean> {
  // En desarrollo local, permitir siempre el análisis de tiro libre para testing
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment && shotType === 'libre') {
    console.log('🔓 [DEV] Tiro libre permitido en desarrollo local');
    return false;
  }
  
  const config = await getMaintenanceConfig();
  
  // Si el mantenimiento general está activado, todos los tipos están en mantenimiento
  if (config?.enabled) {
    return true;
  }
  
  // Verificar mantenimiento específico del tipo de tiro
  return config?.shotTypesMaintenance?.[shotType] || false;
}

/**
 * Normaliza el nombre del tipo de tiro a la clave usada en la configuración
 */
export function normalizeShotType(shotType: string): 'tres' | 'media' | 'libre' {
  const normalized = shotType.toLowerCase();
  if (normalized.includes('libre') || normalized.includes('free') || normalized.includes('ft')) {
    return 'libre';
  }
  if (normalized.includes('media') || normalized.includes('jump')) {
    return 'media';
  }
  return 'tres'; // Por defecto
}

