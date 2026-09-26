import { NextResponse } from 'next/server';

function estructurarLocalmente(texto: string, tipoServicio?: string): string {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const principal = lineas[0] || texto;
  const secundario = lineas.slice(1).join('. ') || 'Sin observaciones adicionales reportadas.';

  return [
    `• Síntoma reportado: ${principal}`,
    `• Condiciones de fallo: Detectado durante recepción para servicio de ${tipoServicio || 'revisión'}. ${secundario}`,
    `• Elemento sugerido a inspeccionar: Componentes asociados al síntoma y revisión de seguridad en elevador.`
  ].join('\n');
}

export async function POST(req: Request) {
  let texto = '';
  let tipo_servicio = 'mantencion';

  try {
    const body = await req.json();
    texto = body.texto || '';
    tipo_servicio = body.tipo_servicio || 'mantencion';

    if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
      return NextResponse.json(
        { error: 'El texto descriptivo es requerido.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        texto_ordenado: estructurarLocalmente(texto, tipo_servicio)
      });
    }

    // 1. Detectar el modelo activo disponible para tu clave
    let modeloElegido = '';
    try {
      const listRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        cache: 'no-store'
      });

      if (listRes.ok) {
        const listData = await listRes.json();
        const modelos: string[] = (listData.data || []).map((m: { id: string }) => m.id);

        // Buscar el primer modelo compatible disponible
        const preferido = modelos.find(m =>
          !m.includes('whisper') &&
          !m.includes('vision') &&
          !m.includes('guard') &&
          (m.includes('llama') || m.includes('mixtral') || m.includes('gemma'))
        );

        if (preferido) {
          modeloElegido = preferido;
        }
      }
    } catch (e) {
      console.warn('No se pudo listar modelos dinámicamente:', e);
    }

    // Si no se encontró un modelo dinámico, usar el identificador base de Groq
    if (!modeloElegido) {
      modeloElegido = 'llama-3.1-8b-instant';
    }

    // 2. Llamada a la API de Groq
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modeloElegido,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'Eres un asesor técnico automotriz senior de Visú. Toma notas desordenadas o dictadas por un mecánico y reescríbelas en un informe conciso para la Orden de Trabajo. Responde únicamente con viñetas limpias: Síntoma reportado, Condiciones de fallo y Elemento sugerido a inspeccionar. Máximo 4 líneas, sin introducciones ni despedidas.'
          },
          {
            role: 'user',
            content: `Modalidad: ${tipo_servicio || 'reparacion'}. Notas: ${texto}`
          }
        ]
      })
    });

    if (!groqRes.ok) {
      console.warn(`Groq respondió con status ${groqRes.status}. Usando formateador de respaldo.`);
      return NextResponse.json({
        texto_ordenado: estructurarLocalmente(texto, tipo_servicio)
      });
    }

    const groqData = await groqRes.json();
    const textoResultado = groqData.choices?.[0]?.message?.content || estructurarLocalmente(texto, tipo_servicio);

    return NextResponse.json({ texto_ordenado: textoResultado });
  } catch (error: unknown) {
    console.error('Error general en estructuración:', error);
    return NextResponse.json({
      texto_ordenado: estructurarLocalmente(texto, tipo_servicio)
    });
  }
}