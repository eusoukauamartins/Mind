import { createClient } from '@supabase/supabase-js';

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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-project-url') {
      return res.status(500).json({ error: 'Database service is not configured.' });
    }

    // 4. Token validation via Supabase
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }

    // Check if API keys exist on the server
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasXAI = !!process.env.XAI_API_KEY;

    return res.status(200).json({
      providers: {
        gemini: {
          configured: hasGemini,
          implemented: true,
          imageInput: true,
          audioInput: true
        },
        openai: {
          configured: hasOpenAI,
          implemented: true,
          models: ["gpt-4o", "gpt-4o-mini"],
          defaultModel: "gpt-4o",
          imageInput: true,
          audioInput: false
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
