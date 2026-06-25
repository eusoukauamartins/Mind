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

  // 3. Supabase client initialization
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-project-url') {
    return res.status(500).json({ error: 'Database service is not configured.' });
  }

  // 4. Token validation via Supabase
  try {
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }
  } catch (err) {
    console.error('[Lyria AI Status] Supabase JWT verification error:', err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
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
        models: ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
        defaultModel: "gemini-3.1-pro-preview",
        imageInput: true,
        audioInput: true
      },
      openai: {
        configured: hasOpenAI,
        implemented: false,
        models: ["gpt-5.5", "gpt-5.5-pro", "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini"],
        defaultModel: "gpt-5.5",
        imageInput: true,
        audioInput: false
      },
      anthropic: {
        configured: hasAnthropic,
        implemented: false,
        models: ["claude-fable-5", "claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
        defaultModel: "claude-fable-5",
        imageInput: true,
        audioInput: false
      },
      xai: {
        configured: hasXAI,
        implemented: false,
        models: ["grok-4.3"],
        defaultModel: "grok-4.3",
        imageInput: true,
        audioInput: false
      }
    }
  });
}
