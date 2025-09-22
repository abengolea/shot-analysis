#!/usr/bin/env node

/**
 * Script para configurar CORS en Firebase Storage
 * Este script configura CORS para permitir que los navegadores web accedan a los videos
 */

const { Storage } = require('@google-cloud/storage');

async function setupCors() {
  try {
    // Inicializar el cliente de Google Cloud Storage
    const storage = new Storage({
      projectId: 'shotanalisys',
    });

    const bucketName = 'shotanalisys.firebasestorage.app';
    const bucket = storage.bucket(bucketName);

    // Configuración CORS
    const corsConfig = [
      {
        origin: [
          'http://localhost:3000',
          'http://localhost:9999',
          'http://127.0.0.1:9999',
          'https://shot-analysis--shotanalisys.us-central1.hosted.app',
          'https://shotanalisys.firebaseapp.com',
          'https://shotanalisys.web.app'
        ],
        method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
        responseHeader: [
          'Authorization',
          'Content-Type',
          'Content-Length',
          'User-Agent',
          'X-Requested-With',
          'Accept',
          'Origin',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers',
          'x-goog-*'
        ],
        maxAgeSeconds: 3600
      }
    ];

    console.log('Configurando CORS para el bucket:', bucketName);
    
    // Aplicar configuración CORS
    await bucket.setCorsConfiguration(corsConfig);
    
    console.log('✅ CORS configurado exitosamente!');
    console.log('Orígenes permitidos:', corsConfig[0].origin);
    console.log('Métodos permitidos:', corsConfig[0].method);
    
  } catch (error) {
    console.error('❌ Error configurando CORS:', error.message);
    
    if (error.code === 403) {
      console.error('💡 Sugerencia: Asegúrate de que tienes permisos de administrador en el proyecto Firebase');
      console.error('💡 O ejecuta este comando desde Google Cloud Console:');
      console.error('   gsutil cors set cors.json gs://shotanalisys.firebasestorage.app');
    }
    
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupCors();
}

module.exports = { setupCors };
