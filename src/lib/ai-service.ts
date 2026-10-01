import pool from './db';

const SYSTEM_PROMPT = `
Actúas como un Asistente Académico experto de la Academia IMCYC, especializado en diplomados sobre tecnología del cemento, concreto, aditivos, dosificación, resistencia de materiales, patologías del concreto y control de calidad estructural en la construcción.
Responde de manera clara, concisa y profesional en español. Tus respuestas deben ser técnicamente precisas y basarse en las mejores prácticas de la ingeniería civil y de la industria del concreto.
`;

export async function askAI(userMessage: string, history: Array<{ role: 'user' | 'model', content: string }> = []): Promise<string> {
  try {
    // 1. Obtener la configuración actual de la Base de Datos
    const [rows] = await pool.execute(
      'SELECT clave, valor FROM configuracion WHERE clave IN (\'ia_provider\', \'ia_api_key\')'
    ) as any[];

    const configMap: Record<string, string> = {};
    rows.forEach((row: any) => {
      configMap[row.clave] = row.valor;
    });

    const provider = configMap['ia_provider'] || 'gemini';
    const apiKey = configMap['ia_api_key'] || '';

    // Fallback: Si no hay clave configurada o es de prueba, simular la respuesta
    if (!apiKey || apiKey === 'mock_api_key') {
      return getSimulatedResponse(provider, userMessage);
    }

    // 2. Ejecutar la llamada al proveedor de IA correspondiente
    if (provider === 'gemini') {
      return await callGemini(apiKey, userMessage, history);
    } else if (provider === 'openai') {
      return await callOpenAI(apiKey, userMessage, history);
    } else if (provider === 'grok') {
      return await callGrok(apiKey, userMessage, history);
    }

    return 'Proveedor de IA no configurado o desconocido.';
  } catch (error: any) {
    console.error('Error en servicio de IA:', error);
    return `Error al conectar con el asistente de IA: ${error.message}`;
  }
}

async function callGemini(apiKey: string, prompt: string, history: any[]): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  // Construir historial de mensajes
  const contents = [
    {
      role: 'user',
      parts: [{ text: `${SYSTEM_PROMPT}\n\nPregunta del estudiante:\n${prompt}` }]
    }
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API respondió con código ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'No se recibió respuesta de Gemini.';
}

async function callOpenAI(apiKey: string, prompt: string, history: any[]): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    })),
    { role: 'user', content: prompt }
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API respondió con código ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return text || 'No se recibió respuesta de OpenAI.';
}

async function callGrok(apiKey: string, prompt: string, history: any[]): Promise<string> {
  const url = 'https://api.x.ai/v1/chat/completions';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
    })),
    { role: 'user', content: prompt }
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-2-1212',
      messages,
      temperature: 0.7
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`xAI Grok API respondió con código ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return text || 'No se recibió respuesta de Grok.';
}

function getSimulatedResponse(provider: string, message: string): string {
  const normalized = message.toLowerCase();
  
  let answer = 'Entendido. Como asistente de la Academia IMCYC, te sugiero consultar la bibliografía sobre concreto y aditivos.';

  if (normalized.includes('cemento') || normalized.includes('hidratacion')) {
    answer = 'El cemento Portland se hidrata al reaccionar con el agua. Los componentes principales son el Silicato Tricálcico (Alita) y el Silicato Dicálcico (Belita), los cuales forman el gel de silicato de calcio hidratado (C-S-H), responsable de la resistencia mecánica del concreto.';
  } else if (normalized.includes('aditivo') || normalized.includes('plastificante')) {
    answer = 'Los aditivos plastificantes y superplastificantes son agentes tensioactivos que se adicionan al concreto. Su función principal es dispersar los granos de cemento por repulsión electrostática o impedimento estérico, aumentando la fluidez de la mezcla sin agregar agua adicional.';
  } else if (normalized.includes('resistencia') || normalized.includes('compresion') || normalized.includes('f\'c') || normalized.includes('fc')) {
    answer = 'La resistencia a la compresión del concreto (f\'c) se mide comúnmente ensayando cilindros normalizados de 15x30 cm a los 28 días, bajo la norma mexicana NMX-C-083-ONNCCE. Factores como la relación agua/cemento, la calidad de los agregados y el curado adecuado definen esta propiedad.';
  } else if (normalized.includes('curado')) {
    answer = 'El curado del concreto es el proceso de mantener la humedad y temperatura idóneas para permitir la hidratación continua del cemento. Un curado deficiente durante los primeros 7 días puede reducir la resistencia final hasta en un 50% y provocar agrietamientos por contracción plástica.';
  }

  return `[Simulación de ${provider.toUpperCase()}] ${answer}\n\n*Nota: Para obtener respuestas reales de IA, ingresa una API Key válida en el panel administrativo.*`;
}
