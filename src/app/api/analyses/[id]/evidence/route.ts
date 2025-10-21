import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const paramId = searchParams.get('param');
    
    if (!paramId) {
      return NextResponse.json({ error: 'Parámetro requerido' }, { status: 400 });
    }

    // Para la página de prueba, simulamos evidencias basadas en el paramId
    // En producción, esto vendría de la base de datos
    const mockEvidence = generateMockEvidence(paramId);
    
    return NextResponse.json(mockEvidence);

  } catch (error: any) {
    console.error('Error al obtener evidencias:', error);
    return NextResponse.json(
      { error: 'Error al obtener evidencias' },
      { status: 500 }
    );
  }
}

function generateMockEvidence(paramId: string) {
  // Generar evidencias simuladas basadas en el parámetro
  const evidenceMap: Record<string, any[]> = {
    'alineacion_pies': [
      {
        frameId: '3',
        label: 'preparacion',
        angle: 'frontal',
        note: 'Pies alineados con el aro',
        imageUrl: '/api/placeholder/400/300?text=Pies+alineados'
      },
      {
        frameId: '4',
        label: 'preparacion',
        angle: 'frontal', 
        note: 'Posición inicial correcta'
      }
    ],
    'set_point': [
      {
        frameId: '8',
        label: 'set_point',
        angle: 'lateral',
        note: 'Balón en posición alta, codo alineado'
      },
      {
        frameId: '9',
        label: 'set_point',
        angle: 'lateral',
        note: 'Mano dominante en posición correcta'
      }
    ],
    'tiro_un_solo_tiempo': [
      {
        frameId: '6',
        label: 'ascenso',
        angle: 'frontal',
        note: 'Movimiento fluido sin pausas'
      },
      {
        frameId: '7',
        label: 'ascenso',
        angle: 'frontal',
        note: 'Transición continua del balón'
      },
      {
        frameId: '10',
        label: 'liberacion',
        angle: 'lateral',
        note: 'Liberación en un solo tiempo'
      }
    ],
    'extension_completa_brazo': [
      {
        frameId: '11',
        label: 'follow_through',
        angle: 'lateral',
        note: 'Brazo completamente extendido'
      },
      {
        frameId: '12',
        label: 'follow_through',
        angle: 'lateral',
        note: 'Mano en posición final correcta'
      }
    ]
  };

  return evidenceMap[paramId] || [
    {
      frameId: '5',
      label: 'general',
      angle: 'frontal',
      note: 'Evidencia visual disponible',
      imageUrl: '/api/placeholder/400/300?text=Evidencia+Visual'
    }
  ];
}

