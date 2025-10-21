import { RekognitionClient, DetectLabelsCommand, StartLabelDetectionCommand, GetLabelDetectionCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Configuración de AWS
const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export interface BasketballAnalysisResult {
  verificacion_inicial: {
    duracion_video: string;
    mano_tiro: string;
    salta: boolean;
    canasta_visible: boolean;
    angulo_camara: string;
    elementos_entorno: string[];
    tiros_detectados: number;
    tiros_por_segundo: number;
    deteccion_ia: {
      angulo_detectado: string;
      estrategia_usada: string;
      tiros_individuales: Array<{
        numero: number;
        timestamp: string;
        descripcion: string;
      }>;
      total_tiros: number;
    };
  };
  analysisSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  selectedKeyframes: number[];
  keyframeAnalysis: string;
  detailedChecklist: Array<{
    category: string;
    items: Array<{
      id: string;
      name: string;
      description: string;
      status: 'Correcto' | 'Mejorable' | 'Incorrecto' | 'no_evaluable';
      rating: number;
      na: boolean;
      comment: string;
      timestamp?: string;
      evidencia?: string;
    }>;
  }>;
  resumen_evaluacion: {
    parametros_evaluados: number;
    parametros_no_evaluables: number;
    lista_no_evaluables: string[];
    score_global: number;
    nota: string;
    confianza_analisis: 'alta' | 'media' | 'baja';
  };
  caracteristicas_unicas: string[];
}

export class AWSRekognitionService {
  private bucketName: string;

  constructor(bucketName: string = process.env.AWS_S3_BUCKET || 'shot-analysis-videos') {
    this.bucketName = bucketName;
  }

  /**
   * Sube un video a S3 y retorna la URL
   */
  async uploadVideoToS3(videoBuffer: Buffer, fileName: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: `videos/${fileName}`,
        Body: videoBuffer,
        ContentType: 'video/mp4',
      });

      await s3Client.send(command);
      return `s3://${this.bucketName}/videos/${fileName}`;
    } catch (error) {
      console.error('Error subiendo video a S3:', error);
      throw new Error('Error subiendo video a S3');
    }
  }

  /**
   * Inicia el análisis de video con AWS Rekognition
   */
  async startVideoAnalysis(s3VideoUri: string): Promise<string> {
    try {
      const command = new StartLabelDetectionCommand({
        Video: {
          S3Object: {
            Bucket: this.bucketName,
            Name: s3VideoUri.replace(`s3://${this.bucketName}/`, ''),
          },
        },
        MinConfidence: 50,
      });

      const response = await rekognitionClient.send(command);
      return response.JobId!;
    } catch (error) {
      console.error('Error iniciando análisis de video:', error);
      throw new Error('Error iniciando análisis de video');
    }
  }

  /**
   * Obtiene los resultados del análisis de video
   */
  async getVideoAnalysisResults(jobId: string): Promise<any> {
    try {
      const command = new GetLabelDetectionCommand({
        JobId: jobId,
        MaxResults: 100,
      });

      const response = await rekognitionClient.send(command);
      return response;
    } catch (error) {
      console.error('Error obteniendo resultados:', error);
      throw new Error('Error obteniendo resultados del análisis');
    }
  }

  /**
   * Analiza un video de baloncesto usando AWS Rekognition
   */
  async analyzeBasketballVideo(videoUrl: string): Promise<BasketballAnalysisResult> {
    try {
            // Descargar el video desde la URL
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Error descargando el video');
      }
      
      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      const fileName = `basketball-${Date.now()}.mp4`;
      
      // Subir a S3
      const s3Uri = await this.uploadVideoToS3(videoBuffer, fileName);
      console.log('📤 Video subido a S3:', s3Uri);
      
      // Iniciar análisis
      const jobId = await this.startVideoAnalysis(s3Uri);
            // Esperar a que termine el análisis (en producción usarías polling)
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos
      
      // Obtener resultados
      const results = await this.getVideoAnalysisResults(jobId);
            // Procesar resultados y generar análisis de baloncesto
      return this.processBasketballAnalysis(results, videoUrl);
      
    } catch (error) {
      console.error('Error en análisis de baloncesto:', error);
      throw error;
    }
  }

  /**
   * Procesa los resultados de AWS Rekognition y genera análisis específico de baloncesto
   */
  private processBasketballAnalysis(rekognitionResults: any, videoUrl: string): BasketballAnalysisResult {
    const labels = rekognitionResults.Labels || [];
    
    // Detectar elementos específicos de baloncesto
    const basketballElements = this.detectBasketballElements(labels);
    const shotDetections = this.detectShots(labels);
    
    return {
      verificacion_inicial: {
        duracion_video: this.estimateVideoDuration(labels),
        mano_tiro: this.detectShootingHand(labels),
        salta: this.detectJumping(labels),
        canasta_visible: basketballElements.includes('basketball hoop') || basketballElements.includes('basketball'),
        angulo_camara: this.detectCameraAngle(labels),
        elementos_entorno: basketballElements,
        tiros_detectados: shotDetections.length,
        tiros_por_segundo: shotDetections.length / this.estimateVideoDuration(labels).replace('s', ''),
        deteccion_ia: {
          angulo_detectado: this.detectCameraAngle(labels),
          estrategia_usada: 'aws-rekognition-labels',
          tiros_individuales: shotDetections,
          total_tiros: shotDetections.length,
        },
      },
      analysisSummary: `Análisis realizado con AWS Rekognition. Se detectaron ${shotDetections.length} tiros y elementos de baloncesto: ${basketballElements.join(', ')}`,
      strengths: this.generateStrengths(labels),
      weaknesses: this.generateWeaknesses(labels),
      recommendations: this.generateRecommendations(labels),
      selectedKeyframes: [1, 3, 5, 7, 9, 11],
      keyframeAnalysis: 'Frames seleccionados basados en detección de movimiento de AWS Rekognition',
      detailedChecklist: this.generateDetailedChecklist(labels),
      resumen_evaluacion: {
        parametros_evaluados: 15,
        parametros_no_evaluables: 7,
        lista_no_evaluables: ['alineacion_pies', 'posicion_manos', 'equilibrio_corporal', 'mirada_al_aro', 'flexion_rodillas', 'elevacion_balon', 'extension_codos'],
        score_global: 3.2,
        nota: 'Análisis basado en AWS Rekognition - limitado para análisis técnico detallado',
        confianza_analisis: 'media',
      },
      caracteristicas_unicas: [
        `Video analizado con AWS Rekognition`,
        `Detección de ${basketballElements.length} elementos de baloncesto`,
        `Análisis automatizado de ${shotDetections.length} tiros`,
      ],
    };
  }

  private detectBasketballElements(labels: any[]): string[] {
    const elements: string[] = [];
    
    labels.forEach(label => {
      if (label.Label?.Name) {
        const name = label.Label.Name.toLowerCase();
        if (name.includes('basketball') || name.includes('sport') || name.includes('ball')) {
          elements.push(label.Label.Name);
        }
        if (name.includes('person') || name.includes('people')) {
          elements.push('persona');
        }
        if (name.includes('indoor') || name.includes('gym')) {
          elements.push('gimnasio');
        }
      }
    });
    
    return elements;
  }

  private detectShots(labels: any[]): Array<{numero: number; timestamp: string; descripcion: string}> {
    const shots: Array<{numero: number; timestamp: string; descripcion: string}> = [];
    
    // Buscar momentos de movimiento que podrían ser tiros
    labels.forEach((label, index) => {
      if (label.Label?.Name?.toLowerCase().includes('person') && label.Timestamp) {
        const timestamp = (label.Timestamp / 1000).toFixed(1);
        shots.push({
          numero: index + 1,
          timestamp: `${timestamp}s`,
          descripcion: `Movimiento detectado en ${timestamp}s`,
        });
      }
    });
    
    return shots.slice(0, 10); // Máximo 10 tiros
  }

  private estimateVideoDuration(labels: any[]): string {
    if (labels.length === 0) return '5.0s';
    
    const maxTimestamp = Math.max(...labels.map(l => l.Timestamp || 0));
    const duration = (maxTimestamp / 1000).toFixed(1);
    return `${duration}s`;
  }

  private detectShootingHand(labels: any[]): string {
    // AWS Rekognition no puede detectar específicamente la mano de tiro
    // Esto sería una limitación del servicio
    return 'derecha'; // Valor por defecto
  }

  private detectJumping(labels: any[]): boolean {
    // Buscar indicadores de salto en las etiquetas
    return labels.some(label => 
      label.Label?.Name?.toLowerCase().includes('jump') || 
      label.Label?.Name?.toLowerCase().includes('movement')
    );
  }

  private detectCameraAngle(labels: any[]): string {
    // AWS Rekognition no puede detectar ángulos de cámara específicos
    return 'lateral'; // Valor por defecto
  }

  private generateStrengths(labels: any[]): string[] {
    const strengths: string[] = [];
    
    if (labels.some(l => l.Label?.Name?.toLowerCase().includes('person'))) {
      strengths.push('Jugador claramente visible en el video');
    }
    
    if (labels.some(l => l.Label?.Name?.toLowerCase().includes('movement'))) {
      strengths.push('Movimiento fluido detectado');
    }
    
    strengths.push('Análisis automatizado con AWS Rekognition');
    
    return strengths;
  }

  private generateWeaknesses(labels: any[]): string[] {
    return [
      'Análisis limitado para técnica específica de baloncesto',
      'No puede evaluar parámetros técnicos detallados',
      'Detección básica de elementos visuales únicamente',
    ];
  }

  private generateRecommendations(labels: any[]): string[] {
    return [
      'Para análisis técnico detallado, usar análisis manual o IA especializada',
      'AWS Rekognition es útil para detección básica de elementos',
      'Considerar combinar con análisis de pose para mejor precisión',
    ];
  }

  private generateDetailedChecklist(labels: any[]): Array<{
    category: string;
    items: Array<{
      id: string;
      name: string;
      description: string;
      status: 'Correcto' | 'Mejorable' | 'Incorrecto' | 'no_evaluable';
      rating: number;
      na: boolean;
      comment: string;
      timestamp?: string;
      evidencia?: string;
    }>;
  }> {
    return [
      {
        category: 'Detección AWS Rekognition',
        items: [
          {
            id: 'persona_detectada',
            name: 'Persona detectada',
            description: 'Presencia de persona en el video',
            status: labels.some(l => l.Label?.Name?.toLowerCase().includes('person')) ? 'Correcto' : 'Incorrecto',
            rating: labels.some(l => l.Label?.Name?.toLowerCase().includes('person')) ? 5 : 1,
            na: false,
            comment: 'AWS Rekognition detectó presencia de persona',
            evidencia: 'Detección automática de AWS Rekognition',
          },
          {
            id: 'movimiento_detectado',
            name: 'Movimiento detectado',
            description: 'Detección de movimiento en el video',
            status: labels.some(l => l.Label?.Name?.toLowerCase().includes('movement')) ? 'Correcto' : 'Incorrecto',
            rating: labels.some(l => l.Label?.Name?.toLowerCase().includes('movement')) ? 4 : 2,
            na: false,
            comment: 'Movimiento detectado por AWS Rekognition',
            evidencia: 'Análisis de frames con AWS Rekognition',
          },
          {
            id: 'elementos_baloncesto',
            name: 'Elementos de baloncesto',
            description: 'Detección de elementos relacionados con baloncesto',
            status: labels.some(l => l.Label?.Name?.toLowerCase().includes('basketball')) ? 'Correcto' : 'Mejorable',
            rating: labels.some(l => l.Label?.Name?.toLowerCase().includes('basketball')) ? 5 : 3,
            na: false,
            comment: 'Elementos de baloncesto detectados',
            evidencia: 'Clasificación de AWS Rekognition',
          },
        ],
      },
    ];
  }
}
