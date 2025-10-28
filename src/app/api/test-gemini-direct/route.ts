import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🧪 Probando Gemini directamente...');
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'No se encontró GEMINI_API_KEY' }, { status: 500 });
    }

    // Test 1: Texto simple
    console.log('📝 Test 1: Texto simple');
    const textResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Responde solo: HOLA'
          }]
        }]
      })
    });

    const textData = await textResponse.json();
        // Test 2: Video URL simple
    console.log('🎬 Test 2: Video URL simple');
    const videoResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Describe exactamente lo que ves en este video: https://storage.googleapis.com/shotanalisys.firebasestorage.app/test-videos/12fps-combined-123.mp4'
          }]
        }]
      })
    });

    const videoData = await videoResponse.json();
        // Test 3: Video con formato específico
        const specificResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Responde EXACTAMENTE lo que ves en este video de baloncesto. Si no ves algo, di "no visible". No inventes nada. Video: https://storage.googleapis.com/shotanalisys.firebasestorage.app/test-videos/12fps-combined-123.mp4'
          }]
        }]
      })
    });

    const specificData = await specificResponse.json();
        return NextResponse.json({
      success: true,
      message: 'Tests de Gemini completados',
      results: {
        test1_texto: textData,
        test2_video_url: videoData,
        test3_video_especifico: specificData
      },
      api_key_status: {
        found: true,
        length: apiKey.length,
        masked: apiKey.slice(0, 4) + '***' + apiKey.slice(-4)
      }
    });

  } catch (error: any) {
    console.error('❌ Error en tests de Gemini:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en tests de Gemini',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}





