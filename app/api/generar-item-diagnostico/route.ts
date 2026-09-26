import { NextResponse } from 'next/server';

interface ItemResponse {
  titulo: string;
  descripcion: string;
}

function estructurarItemLocalmente(texto: string): ItemResponse {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const primeraLinea = lineas[0] || texto.trim();
  
  // Generar un título técnico breve a partir de la primera línea
  let tituloGenerado = primeraLinea.slice(0, 55).trim();
  if (tituloGenerado.length > 50) {
    const lastSpace = tituloGenerado.lastIndexOf(' ');
    if (lastSpace > 20) {
      tituloGenerado = tituloGenerado.substring(0, lastSpace);
    }
  }
  // Capitalizar la primera letra
  if (tituloGenerado) {
    tituloGenerado = tituloGenerado.charAt(0).toUpperCase() + tituloGenerado.slice(1);
  } else {
    tituloGenerado = 'Hallazgo de Inspección Técnica';
  }

  // Generar descripción técnica ordenada en 2-3 líneas concisas
  const resto = lineas.slice(1).join('. ') || 'Observación registrada durante la revisión en elevador.';
  const descripcion = [
    `• Condición: ${primeraLinea}.`,
    `• Diagnóstico: Se detecta anomalía que requiere intervención correctiva. ${resto}`,
    `• Recomendación: Reparación o sustitución según especificaciones del fabricante.`,
  ].join('\n');

  return {
    titulo: tituloGenerado,
    descripcion,
  };
}

export async function POST(req: Request) {
  let texto = '';

  try {
    const body = await req.json();
    texto = body.texto || '';

    if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
      return NextResponse.json(
        { error: 'El texto descriptivo del hallazgo es requerido.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(estructurarItemLocalmente(texto));
    }

    // 1. Detectar el modelo disponible en Groq
    let modeloElegido = '';
    try {
      const listRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });

      if (listRes.ok) {
        const listData = await listRes.json();
        const modelos: string[] = (listData.data || []).map((m: { id: string }) => m.id);

        const preferido = modelos.find(
          (m) =>
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

    if (!modeloElegido) {
      modeloElegido = 'llama-3.1-8b-instant';
    }

    // 2. Llamada a la API de Groq solicitando JSON estricto
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modeloElegido,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Eres un jefe de taller automotriz senior de Visú. Tu tarea es recibir las notas o dictado de un mecánico sobre un hallazgo específico en un vehículo. Debes responder estrictamente en formato JSON válido con dos campos:
{
  "titulo": "Nombre técnico breve del problema o repuesto (ej: Desgaste severo en pastillas delanteras, Fuga en retén de cigüeñal, Rotura de fuelle homocinética)",
  "descripcion": "Descripción técnica ordenada del hallazgo en 2 a 3 líneas concisas."
}
No agregues markdown adicional ni texto fuera del JSON.`,
          },
          {
            role: 'user',
            content: `Notas del mecánico: ${texto}`,
          },
        ],
      }),
    });

    if (!groqRes.ok) {
      console.warn(`Groq respondió con status ${groqRes.status}. Usando formateador de respaldo.`);
      return NextResponse.json(estructurarItemLocalmente(texto));
    }

    const groqData = await groqRes.json();
    const contenido = groqData.choices?.[0]?.message?.content?.trim();

    if (!contenido) {
      return NextResponse.json(estructurarItemLocalmente(texto));
    }

    // Parsear el JSON retornado por el modelo
    try {
      // Limpiar posibles bloques ```json ... ``` si el modelo los incluyó
      const cleanJson = contenido.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.titulo && parsed.descripcion) {
        return NextResponse.json({
          titulo: String(parsed.titulo).trim(),
          descripcion: String(parsed.descripcion).trim(),
        });
      }
    } catch (parseErr) {
      console.warn('Error parseando JSON de Groq:', parseErr);
    }

    return NextResponse.json(estructurarItemLocalmente(texto));
  } catch (error: unknown) {
    console.error('Error general en generar-item-diagnostico:', error);
    return NextResponse.json(estructurarItemLocalmente(texto));
  }
}
