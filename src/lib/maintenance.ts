import { adminDb } from '@/lib/firebase-admin';

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  updatedAt: string;
  updatedBy: string;
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
        updatedBy: 'system'
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

