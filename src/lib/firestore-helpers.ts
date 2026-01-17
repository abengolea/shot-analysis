import { onSnapshot, Unsubscribe } from "firebase/firestore";
import { Query } from "firebase/firestore";

/**
 * Wrapper robusto para onSnapshot que maneja errores automáticamente
 * y previene errores internos de Firestore
 */
export function safeOnSnapshot<T = any>(
  query: Query,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void
): Unsubscribe {
  let isActive = true;
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 1000; // 1 segundo

  const handleError = (error: any) => {
    console.error('Error en listener de Firestore:', error);
    
    if (onError) {
      onError(error);
    }

    // Solo reintentar si es un error interno y no hemos excedido los reintentos
    if (error?.code === 'internal' && retryCount < maxRetries && isActive) {
      retryCount++;
      console.log(`Reintentando conexión a Firestore (intento ${retryCount}/${maxRetries})...`);
      
      setTimeout(() => {
        if (isActive) {
          // Crear nuevo listener
          const newUnsubscribe = onSnapshot(query, onNext, handleError);
          // Reemplazar la función de unsubscribe
          unsubscribe = newUnsubscribe;
        }
      }, retryDelay * retryCount); // Backoff exponencial
    }
  };

  let unsubscribe = onSnapshot(query, onNext, handleError);

  // Función de cleanup mejorada
  return () => {
    isActive = false;
    unsubscribe();
  };
}

/**
 * Función para verificar la conectividad antes de hacer consultas
 */
export function checkFirestoreConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Verificar si estamos en el navegador
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      // Verificar conectividad básica
      if (!navigator.onLine) {
        resolve(false);
        return;
      }

      resolve(true);
    } catch (error) {
      console.error('Error verificando conectividad:', error);
      resolve(false);
    }
  });
}
