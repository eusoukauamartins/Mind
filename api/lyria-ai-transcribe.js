import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  const clean = value.trim();
  if (
    clean === '' ||
    clean.startsWith('your-') ||
    clean === 'placeholder'
  ) {
    return null;
  }
  return clean;
}

export default async function handler(req, res) {
  // 1. Method Validation
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Auth Header Check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }
  const token = authHeader.split(' ')[1];

  // 3. Supabase client initialization
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Lyria AI Transcribe] Supabase URL/Key is not configured.');
    return res.status(500).json({ error: 'Database service is not configured.' });
  }

  // 4. Token validation via Supabase (validate JWT before processing audio)
  try {
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }
  } catch (err) {
    console.error('[Lyria AI Transcribe] Supabase JWT verification error:', err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }

  // 5. Audio parameter extraction and structure verification
  const { audio } = req.body || {};
  if (!audio || typeof audio !== 'object' || !audio.data || !audio.type) {
    return res.status(400).json({ error: 'Estrutura de áudio inválida.' });
  }

  // 6. MIME Type validation
  const allowedAudioTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
  const cleanAudioType = audio.type.split(';')[0].trim().toLowerCase();
  if (!allowedAudioTypes.includes(cleanAudioType)) {
    return res.status(400).json({ error: `Tipo de áudio não suportado: "${audio.type}".` });
  }

  // 7. Reject invalid base64 characters
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  const base64Clean = audio.data.replace(/\s/g, '');
  if (!base64Regex.test(base64Clean)) {
    return res.status(400).json({ error: 'Base64 de áudio inválido.' });
  }

  // 8. Size limit validation (Max 10 MB)
  const audioSizeInBytes = (base64Clean.length * 3) / 4;
  if (audioSizeInBytes > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Áudio muito grande. Limite máximo de 10 MB.' });
  }

  // 9. API key verification — prefer Gemini, fallback to OpenAI Whisper
  const geminiApiKey = getEnv('GEMINI_API_KEY');
  const openaiApiKey = getEnv('OPENAI_API_KEY');

  if (!geminiApiKey && !openaiApiKey) {
    return res.status(400).json({ error: 'Nenhum provedor de transcrição configurado no servidor (GEMINI_API_KEY ou OPENAI_API_KEY).' });
  }

  // --- Gemini Transcription (preferred) ---
  if (geminiApiKey) {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const promptContents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: cleanAudioType,
              data: base64Clean
            }
          },
          {
            text: 'Transcreva o áudio fornecido para texto em português do Brasil limpo. Preserve o significado original, não faça resumos, não responda ao usuário e não crie ações. Retorne obrigatoriamente um JSON no formato: { "transcript": "texto transcrito" }'
          }
        ]
      }
    ];

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: promptContents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.0
          }
        })
      });

      if (!response.ok) {
        console.error('[Lyria AI Transcribe] Gemini API error status:', response.status);
        return res.status(400).json({ error: 'Não foi possível transcrever o áudio. Tente gravar novamente.' });
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.error('[Lyria AI Transcribe] Empty response from Gemini API');
        return res.status(400).json({ error: 'Não foi possível transcrever o áudio. Tente gravar novamente.' });
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(rawText.trim());
      } catch (parseErr) {
        console.error('[Lyria AI Transcribe] JSON parse failure on text:', rawText, parseErr);
        return res.status(400).json({ error: 'Não foi possível interpretar a resposta da transcrição. Tente gravar novamente.' });
      }

      const transcript = parsedResult.transcript;
      if (typeof transcript !== 'string') {
        return res.status(400).json({ error: 'Não foi possível obter uma transcrição válida. Tente gravar novamente.' });
      }

      return res.status(200).json({
        transcript: transcript.trim()
      });

    } catch (err) {
      console.error('[Lyria AI Transcribe] Error calling Gemini API:', err);
      return res.status(500).json({ error: 'Não foi possível transcrever o áudio. Tente gravar novamente.' });
    }
  }

  // --- OpenAI Whisper Fallback ---
  if (openaiApiKey) {
    try {
      const audioBuffer = Buffer.from(base64Clean, 'base64');

      // Determine file extension from mime type
      const extMap = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/m4a': 'm4a' };
      const ext = extMap[cleanAudioType] || 'webm';
      const fileName = `audio.${ext}`;

      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer], { type: cleanAudioType }), fileName);
      formData.append('model', 'whisper-1');
      formData.append('language', 'pt');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[Lyria AI Transcribe] OpenAI Whisper error:', response.status, errBody);
        return res.status(400).json({ error: 'Não foi possível transcrever o áudio via OpenAI. Tente gravar novamente.' });
      }

      const result = await response.json();
      if (!result.text || typeof result.text !== 'string') {
        return res.status(400).json({ error: 'Não foi possível obter uma transcrição válida. Tente gravar novamente.' });
      }

      return res.status(200).json({
        transcript: result.text.trim()
      });

    } catch (err) {
      console.error('[Lyria AI Transcribe] Error calling OpenAI Whisper:', err);
      return res.status(500).json({ error: 'Não foi possível transcrever o áudio. Tente gravar novamente.' });
    }
  }

  return res.status(400).json({ error: 'Nenhum provedor de transcrição disponível.' });
}
