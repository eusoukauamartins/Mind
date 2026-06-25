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
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Auth Header Check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // 3. Supabase client initialization
    const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Database service is not configured.' });
    }

    // 4. Token validation via Supabase
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }

    // Check if API keys exist on the server
    const hasGemini = !!getEnv('GEMINI_API_KEY');
    const hasOpenAI = !!getEnv('OPENAI_API_KEY');
    const hasAnthropic = !!getEnv('ANTHROPIC_API_KEY');
    const hasXAI = !!getEnv('XAI_API_KEY');

    return res.status(200).json({
      providers: {
        gemini: {
          configured: hasGemini,
          implemented: true,
          imageInput: true,
          audioInput: hasGemini
        },
        openai: {
          configured: hasOpenAI,
          implemented: true,
          models: ["gpt-4o", "gpt-4o-mini"],
          defaultModel: "gpt-4o",
          imageInput: true,
          audioInput: hasGemini
        },
        anthropic: {
          configured: hasAnthropic,
          implemented: false,
          imageInput: false,
          audioInput: false
        },
        xai: {
          configured: hasXAI,
          implemented: false,
          imageInput: false,
          audioInput: false
        }
      }
    });

  } catch (err) {
    console.error('[Lyria AI Status] Verification error:', err);
    return res.status(500).json({ error: 'Erro interno ao verificar status dos provedores.' });
  }
}
