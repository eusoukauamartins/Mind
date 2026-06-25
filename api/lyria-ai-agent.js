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
    console.error('[Lyria AI Endpoint] Supabase URL/Key is not configured.');
    return res.status(500).json({ error: 'Database service is not configured.' });
  }

  // 4. Token validation via Supabase
  let user = null;
  try {
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session token' });
    }
    user = data.user;
  } catch (err) {
    console.error('[Lyria AI Endpoint] Supabase JWT verification error:', err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }

  // 5. Request body validation
  const { message, context, history, provider = 'gemini', model = 'gemini-3.1-pro-preview', attachments = [], audio } = req.body || {};
  
  const hasMessage = message && typeof message === 'string' && message.trim();
  const hasAudio = audio && typeof audio === 'object' && audio.data && audio.type;

  if (!hasMessage && !hasAudio) {
    return res.status(400).json({ error: 'Bad Request: Message or Audio prompt is required.' });
  }
  if (message && typeof message === 'string' && message.length > 4000) {
    return res.status(400).json({ error: 'Bad Request: Message exceeds limit of 4000 characters.' });
  }

  // Defensive body size limit (adjusted to 15MB for base64 images support)
  try {
    const bodySize = JSON.stringify(req.body || {}).length;
    if (bodySize > 15000000) {
      return res.status(400).json({ error: 'Bad Request: Payload too large.' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Bad Request: Invalid JSON body.' });
  }

  // Allowlist validation
  const ALLOWED_PROVIDERS = ['gemini', 'openai', 'anthropic', 'xai'];
  const PROVIDER_MODELS = {
    gemini: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini'],
    anthropic: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    xai: ['grok-4.3']
  };

  if (!ALLOWED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: `Provedor não suportado: "${provider}".` });
  }

  const allowedModels = PROVIDER_MODELS[provider];
  if (!allowedModels.includes(model)) {
    return res.status(400).json({ error: `Modelo não suportado para o provedor ${provider}: "${model}".` });
  }

  // Real backend implementation check
  if (provider !== 'gemini' && provider !== 'openai') {
    if (hasAudio) {
      return res.status(400).json({ error: `Áudio ainda não está implementado para este provedor.` });
    }
    return res.status(400).json({ error: `Este provedor ainda não está implementado no servidor.` });
  }

  // Provider specific validation
  if (provider === 'openai') {
    if (hasAudio) {
      return res.status(400).json({ error: `Áudio ainda não está implementado para este provedor.` });
    }
    const implementedOpenAIModels = ['gpt-4o', 'gpt-4o-mini'];
    if (!implementedOpenAIModels.includes(model)) {
      return res.status(400).json({ error: 'Este modelo OpenAI ainda não está implementado no servidor.' });
    }
    const openAIApiKey = getEnv('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return res.status(400).json({ error: `Este provedor ainda não está configurado no servidor.` });
    }
  }

  const geminiApiKey = getEnv('GEMINI_API_KEY');
  if (provider === 'gemini' && !geminiApiKey) {
    return res.status(400).json({ error: `Este provedor ainda não está configurado no servidor.` });
  }

  // Audio validation
  if (audio) {
    if (typeof audio !== 'object' || !audio.data || !audio.type) {
      return res.status(400).json({ error: 'Estrutura de áudio inválida.' });
    }
    const allowedAudioTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    const cleanAudioType = audio.type.split(';')[0].trim().toLowerCase();
    if (!allowedAudioTypes.includes(cleanAudioType)) {
      return res.status(400).json({ error: `Tipo de áudio não suportado: "${audio.type}".` });
    }
    
    // Reject invalid base64
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    const base64Clean = audio.data.replace(/\s/g, '');
    if (!base64Regex.test(base64Clean)) {
      return res.status(400).json({ error: 'Base64 de áudio inválido.' });
    }

    const audioSizeInBytes = (base64Clean.length * 3) / 4;
    if (audioSizeInBytes > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Áudio muito grande. Limite máximo de 10 MB.' });
    }
  }

  // Attachment validation
  if (Array.isArray(attachments)) {
    if (attachments.length > 3) {
      return res.status(400).json({ error: 'Máximo de 3 imagens por mensagem.' });
    }
    for (const att of attachments) {
      if (!att || !att.data || !att.type) {
        return res.status(400).json({ error: 'Estrutura de anexo inválida.' });
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(att.type)) {
        return res.status(400).json({ error: `Tipo de anexo não suportado: "${att.type}". Apenas PNG, JPEG e WEBP são permitidos.` });
      }
      const sizeInBytes = (att.data.length * 3) / 4;
      if (sizeInBytes > 4 * 1024 * 1024) {
        return res.status(400).json({ error: `Arquivo ${att.name || 'anexo'} excede o limite de 4 MB.` });
      }
    }
  }

  // 7. Limit history context to last 10 messages for token usage safety
  const trimmedHistory = Array.isArray(history) ? history.slice(-10) : [];

  // 8. Build Prompt & System Instructions
  const systemInstruction = `Você é o assistente inteligente integrado do aplicativo Lyria, um organizador pessoal focado em produtividade, finanças e foco estratégico.
 Você opera em três modos distintos:

1. MODO CONVERSA (Conversational Mode):
   - Ativado para mensagens genéricas, bate-papo, saudações, perguntas sobre o histórico, dúvidas ou pedidos de explicação.
   - Exemplos: "teste", "oi", "me ajuda", "você lembra minha mensagem anterior?", "o que você consegue fazer?", "explique isso", "resuma isso", "consegue modificar coisas dentro do meu app?", "analise essa ideia".
   - Responda amigavelmente no campo "reply" e retorne "actions": []. NUNCA proponha ações de criação neste modo.
   - Para perguntas sobre a mensagem anterior (ex: "você lembra minha mensagem anterior?"), use o histórico fornecido para responder com precisão baseando-se nas mensagens passadas (ex: "Sim. Sua mensagem anterior foi: '...'").

2. MODO PROPOSTA DE AÇÃO (Action Proposal Mode):
   - Ativado APENAS quando o usuário solicitar explicitamente a criação de algum item (tarefa, lançamento financeiro, projeto, recompensa, aprendizado ou experimento).
   - Exemplos: "lança uma despesa de R$120 com gasolina hoje", "registra receita de R$500 da mentoria", "adiciona gasto de R$80 no mercado", "cria uma transação de R$200".
   - REGRA DE CONFIANÇA ESTRITA: Proponha a ação apenas se a confiança for >= 90% E o usuário explicitamente pediu a ação. Caso contrário, permaneça no Modo Conversa, dê uma resposta natural ou peça esclarecimento.
   - SEM INVENÇÃO DE VALORES: Nunca invente valores como valores financeiros ("R$120"), descrições ("gasolina"), datas, categorias, contas ou tipos de transação se eles não foram explicitamente fornecidos pelo usuário. Se faltarem informações essenciais para a ação, responda pedindo esclarecimento no campo "reply" em vez de propor uma ação com payload incompleto ou fictício.

3. MODO ANÁLISE FINANCEIRA (Financial Analysis Mode):
   - Ativado para qualquer pergunta sobre relatórios, saldos, receitas, despesas, lucros, gastos por categorias, balanço mensal, ou comparações entre períodos.
   - REGRA DE NÃO-ALUCINAÇÃO ABSOLUTA: O modelo NUNCA deve inventar, estimar, presumir ou alucinar valores, totais, saldos ou transações financeiras.
   - O modelo deve basear-se ESTREITAMENTE nos dados financeiros reais fornecidos no contexto estruturado sob `summary.finance.requestedMonthsData`.
   - Se `summary.finance.financeDataAccessible` for falso, você deve obrigatoriamente responder com o seguinte texto exato: "Não consegui acessar seus dados financeiros reais agora. Não vou estimar valores para evitar erro." no campo "reply".
   - Se não existirem transações ou dados para o período solicitado no contexto, responda claramente dizendo que não há lançamentos registrados para esse período, sem inventar valores.
   - Quando os dados reais estiverem disponíveis, responda em português no campo "reply" contendo claramente: o período analisado, o total de receitas (entrada), o total de despesas (saída), o saldo/lucro e a quantidade de transações. Você também pode mencionar as principais categorias/valores.
   - NUNCA repita ou use valores financeiros fictícios de respostas ou perguntas anteriores.

Você deve retornar obrigatoriamente um objeto JSON com a seguinte estrutura:
{
  "reply": "Sua resposta natural em português, explicando o que você propõe ou interagindo amigavelmente.",
  "actions": [
    {
      "type": "create",
      "module": "tasks | finance | projects | rewards | learnings | experiments",
      "payload": { ... },
      "confidence": 0.95,
      "requiresConfirmation": true,
      "summary": "Descrição breve em português da ação."
    }
  ]
}

Regras de Schemas de payloads permitidos para ações "create":

Módulo "tasks":
- title: string (obrigatório, título da tarefa)
- description: string (opcional)
- priority: string (opcional, valores permitidos: 'baixa', 'média', 'alta')
- estimatedHours: string (opcional, horas estimadas)
- status: string (opcional, valor padrão 'pendente', valores permitidos: 'pendente', 'em_andamento', 'concluída')
- dueDate: string (opcional, data de vencimento no formato YYYY-MM-DD)
- scheduledDate: string (opcional, data agendada no formato YYYY-MM-DD)
- scheduledTime: string (opcional, hora no formato HH:mm)
- category: string (opcional, valores recomendados: 'Marketing', 'Conteúdo', 'Produto', 'Operações', 'Estratégia', 'Pessoal', 'Outro')
- recurrence: string (opcional, valores permitidos: 'única', 'diária', 'semanal', 'mensal')
- recurrenceDay: string (opcional)
- completedDates: array de strings (opcional, padrão [])

Módulo "finance":
- type: string (obrigatório, valores permitidos: 'entrada' ou 'saída')
- amount: number (obrigatório, valor monetário positivo, ex: 120.00. IMPORTANTE: Se o usuário não fornecer explicitamente o valor/quantia da transação, NÃO proponha nenhuma ação, deixe 'actions' vazio como [] e use 'reply' para pedir o valor da despesa/receita)
- originalDescription: string (obrigatório. Título ou nome legível por humanos que descreve sobre o que é a transação, ex: "Gasolina", "iFood", "Aluguel", "Supermercado". Se o usuário não disser ou não for possível identificar claramente sobre o que é o gasto/receita, NÃO proponha nenhuma ação, deixe 'actions' vazio como [] e use 'reply' para pedir uma descrição)
- category: string (obrigatório. Se type for 'entrada': 'Vendas', 'Serviços', 'Investimentos', 'Outros'. Se type for 'saída', use rigorosamente uma das seguintes categorias permitidas no aplicativo: 'Marketing', 'Ferramentas', 'Operações', 'Pessoal', 'Educação', 'Impostos', 'Transporte', 'Carro', 'Combustível', 'Alimentação', 'Mercado', 'Restaurante', 'Moradia', 'Contas', 'Saúde', 'Assinaturas', 'Lazer', 'Outros'.
  Regras rígidas de mapeamento de categorias para saídas:
  * gasolina, combustível, uber, 99, ônibus, metrô, estacionamento, pedágio -> Transporte, Carro ou Combustível (escolha um desses, nunca use 'Outros').
  * mercado, supermercado, feira, alimentação básica -> Alimentação ou Mercado.
  * restaurante, ifood, delivery, lanche -> Alimentação ou Restaurante.
  * aluguel, condomínio, água, luz, internet -> Moradia ou Contas.
  * remédio, farmácia, consulta, exame -> Saúde.
  * assinatura, software, ferramenta, app -> Assinaturas ou Ferramentas.
  * mentoria, curso, livro -> Educação.
  * presente, roupa, lazer -> Lazer ou Pessoal.
  * Use 'Outros' apenas quando nenhuma categoria acima for adequada. Nunca mapeie os termos anteriores para 'Outros'.)
- expenseClass: string (obrigatório apenas se type for 'saída'. Valores permitidos de forma conservadora: 'Essencial', 'Fixo', 'Variável', 'Estratégico', 'Investimento', 'Supérfluo'.
  Regras de preenchimento conservador:
  * gasolina, combustível, aluguel, condomínio, água, luz, internet, remédio, farmácia, consulta, exame -> Essencial ou Fixo.
  * delivery, restaurante, lanche, ifood, presente, roupa, lazer -> Variável ou Supérfluo.)
- subcategory: string (opcional, subcategoria livre para detalhar, ex: "Combustível", "iFood", "Aluguel")
- source: string (opcional, valores recomendados: 'dropshipping', 'conteúdo', 'serviços', 'ferramentas', 'marketing', 'operações', 'pessoal', 'outro')
- date: string (obrigatório, formato YYYY-MM-DD. Se a data de hoje for omitida, você só pode usar a data de hoje se o usuário disser "hoje" ou se o app aceitar o default do dia atual fornecido no contexto)
- notes: string (opcional)
- sourceBank: string (opcional, ex: 'Nubank')
- accountName: string (opcional)
- reviewStatus: string (opcional, padrão 'approved')
- periodKey: string (opcional, formato YYYY-MM)

Módulo "projects":
- title: string (obrigatório)
- description: string (opcional)
- status: string (opcional, padrão 'ativo', valores permitidos: 'ativo', 'pausado', 'concluído')
- category: string (opcional, valores recomendados: 'Conteúdo', 'Negócios', 'Estudos', 'Produto')
- startDate: string (opcional, formato YYYY-MM-DD)
- targetDate: string (opcional, formato YYYY-MM-DD)
- subtasks: array de objetos subtarefa (opcional, padrão [])

Módulo "rewards":
- title: string (obrigatório)
- description: string (opcional)
- category: string (opcional, valores recomendados: 'Trabalho', 'Financeiro', 'Saúde', 'Casa', 'Estudos', 'Lazer', 'Pessoal', 'Outro')
- estimatedValue: number (opcional, valor estimado)
- deadline: string (opcional, formato YYYY-MM-DD)
- priority: string (opcional, valores permitidos: 'baixa', 'média', 'alta')
- status: string (opcional, padrão 'em_andamento', valores permitidos: 'em_andamento', 'desbloqueada')
- conditions: array de objetos { id, text, completed, completedAt } (opcional, padrão [])
- notes: string (opcional)
- financialTargetAmount: number (opcional, ou null)
- financialCurrentAmount: number (opcional, ou null)
- showOnDashboard: boolean (opcional, padrão false)

Módulo "learnings":
- content: string (obrigatório, conteúdo do aprendizado)
- source: string (opcional, fonte do aprendizado)
- tags: array de strings (opcional, padrão [])
- isFavorite: boolean (opcional, padrão false)
- date: string (opcional, formato YYYY-MM-DD)

Módulo "experiments":
- title: string (obrigatório)
- category: string (obrigatório, valores permitidos: 'ads', 'conteúdo', 'negócio', 'operacional', 'produtividade', 'estratégia', 'outro')
- context: string (opcional)
- whatWasTested: string (opcional)
- result: string (opcional)
- mainError: string (opcional)
- lessonLearned: string (opcional)
- repeatThis: string (opcional, valores permitidos: 'sim', 'não')
- date: string (opcional, formato YYYY-MM-DD)
- notes: string (opcional)
- tags: array de strings (opcional, padrão [])

IMPORTANTE: Retorne APENAS o JSON puro. Não utilize marcações markdown ou blocos de código em sua resposta.`;

  let rawText = '';

  try {
    if (provider === 'openai') {
      const openAIApiKey = getEnv('OPENAI_API_KEY');
      const inputPayload = [];
      
      // Add history to model context
      trimmedHistory.forEach(h => {
        if (!h.role) return;
        const role = h.role.trim().toLowerCase();
        if (role === 'assistant') {
          inputPayload.push({
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: h.content || ''
              }
            ]
          });
        } else if (role === 'user') {
          inputPayload.push({
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: h.content || ''
              }
            ]
          });
        }
      });

      const dateInfo = context?.currentDate ? `Data atual de referência: ${context.currentDate}.` : '';
      const contextSummary = context?.summary ? `Resumo do estado atual: ${JSON.stringify(context.summary)}.` : '';
      const messageText = message && typeof message === 'string' && message.trim() ? message : 'Comando recebido.';
      const userPrompt = `Mensagem do Usuário: "${messageText}"\n${dateInfo}\n${contextSummary}`;

      const userContent = [{ type: 'input_text', text: userPrompt }];

      // Add image attachments
      if (Array.isArray(attachments)) {
        attachments.forEach(att => {
          userContent.push({
            type: 'input_image',
            image_url: `data:${att.type};base64,${att.data}`
          });
        });
      }

      inputPayload.push({
        role: 'user',
        content: userContent
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAIApiKey}`
          },
          body: JSON.stringify({
            model,
            instructions: systemInstruction,
            input: inputPayload,
            max_output_tokens: 2500,
            temperature: 0.4,
            text: {
              format: {
                type: 'json_object'
              }
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const statusCode = response.status;
          let errMessage = 'Ocorreu um erro ao comunicar com a API do provedor OpenAI.';
          let errType = '';
          try {
            const errorJson = await response.json();
            if (errorJson.error) {
              if (errorJson.error.message) {
                errMessage = errorJson.error.message;
              }
              if (errorJson.error.type) {
                errType = errorJson.error.type;
              }
            }
          } catch (e) {}
          console.error(`[Lyria AI Endpoint] OpenAI API error status: ${statusCode}, message: ${errMessage}, type: ${errType}`);
          const formattedError = `Erro da OpenAI (Status ${statusCode}${errType ? `, Tipo: ${errType}` : ''}): ${errMessage}`;
          return res.status(statusCode || 500).json({ error: formattedError });
        }

      const resJson = await response.json();
      
      // Parse output from Responses API structure
      if (typeof resJson.output_text === 'string' && resJson.output_text.trim()) {
        rawText = resJson.output_text;
      } else if (Array.isArray(resJson.output)) {
        let refusalText = '';
        let textParts = [];
        for (const item of resJson.output) {
          if (Array.isArray(item.content)) {
            for (const content of item.content) {
              if (content.type === 'output_text' && typeof content.text === 'string') {
                textParts.push(content.text);
              } else if (content.type === 'text' && typeof content.text === 'string') {
                textParts.push(content.text);
              } else if (content.type === 'refusal') {
                const ref = content.text || content.refusal || '';
                if (ref) {
                  refusalText = ref;
                }
              }
            }
          }
        }
        if (textParts.length > 0) {
          rawText = textParts.join('');
        } else if (refusalText) {
          rawText = refusalText;
        }
      }

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return res.status(400).json({ error: 'A OpenAI demorou para responder. Tente novamente.' });
      }
      console.error('[Lyria AI Endpoint] Error calling OpenAI API:', err);
      return res.status(500).json({ error: 'Não foi possível obter resposta da OpenAI. Tente novamente.' });
    }

  } else {
    // Call the real model ID directly as requested
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const promptContents = [];
    
    // Add history to model context
    trimmedHistory.forEach(h => {
      promptContents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content || '' }]
      });
    });

    // Prepare current context metadata for prompt
    const dateInfo = context?.currentDate ? `Data atual de referência: ${context.currentDate}.` : '';
    const contextSummary = context?.summary ? `Resumo do estado atual: ${JSON.stringify(context.summary)}.` : '';
    
    // Handle empty message text when only audio is sent
    const messageText = message && typeof message === 'string' && message.trim() ? message : 'Comando de voz recebido.';
    const userPrompt = `Mensagem do Usuário: "${messageText}"\n${dateInfo}\n${contextSummary}`;

    const userParts = [{ text: userPrompt }];

    // Add image attachments
    if (Array.isArray(attachments)) {
      attachments.forEach(att => {
        userParts.push({
          inlineData: {
            mimeType: att.type,
            data: att.data
          }
        });
      });
    }

    // Add audio prompt
    if (audio && audio.data && audio.type) {
      const cleanMimeType = audio.type.split(';')[0].trim().toLowerCase();
      userParts.push({
        inlineData: {
          mimeType: cleanMimeType,
          data: audio.data.replace(/\s/g, '')
        }
      });
    }

    promptContents.push({
      role: 'user',
      parts: userParts
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: promptContents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        let errMessage = 'Ocorreu um erro ao comunicar com a API do provedor de IA.';
        try {
          const errorJson = await response.json();
          if (errorJson.error && errorJson.error.message) {
            if (errorJson.error.message.includes('not found') || errorJson.error.message.includes('404')) {
              errMessage = `Este modelo ainda não está implementado no servidor.`;
            } else {
              errMessage = `Erro do Provedor: ${errorJson.error.message}`;
            }
          }
        } catch (e) {}
        console.error('[Lyria AI Endpoint] Provider API error status:', response.status);
        return res.status(500).json({ error: errMessage });
      }

      const resJson = await response.json();
      rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } catch (err) {
      console.error('[Lyria AI Endpoint] Error calling Gemini API:', err);
      return res.status(500).json({ error: 'Server encountered an error invoking the AI model.' });
    }
  }

    // 9. Parsing and Normalization
    let parsedResult;
    try {
      parsedResult = JSON.parse(rawText.trim());
    } catch (parseErr) {
      console.error('[Lyria AI Endpoint] JSON parse failure on text:', rawText, parseErr);
      return res.status(200).json({
        reply: 'Não consegui interpretar a resposta da IA com segurança. Tente novamente de forma mais objetiva.',
        actions: []
      });
    }

    const reply = typeof parsedResult.reply === 'string' ? parsedResult.reply : 'Processado com sucesso.';
    const actions = Array.isArray(parsedResult.actions) ? parsedResult.actions : [];

    const allowedModules = ['tasks', 'finance', 'projects', 'rewards', 'learnings', 'experiments'];
    const sanitizedActions = actions
      .filter(action => {
        // Validate V1 create action properties and confidence >= 0.90
        const conf = typeof action.confidence === 'number' ? action.confidence : 0.95;
        return (
          action &&
          action.type === 'create' &&
          allowedModules.includes(action.module) &&
          action.payload &&
          typeof action.payload === 'object' &&
          conf >= 0.90
        );
      })
      .map(action => {
        // Strip auto-generated keys to prevent frontend/backend collisions
        const cleanPayload = { ...action.payload };
        delete cleanPayload.id;
        delete cleanPayload.createdAt;
        delete cleanPayload.created_at;
        delete cleanPayload.order;
        delete cleanPayload.list_order;

        return {
          type: 'create',
          module: action.module,
          payload: cleanPayload,
          confidence: typeof action.confidence === 'number' ? action.confidence : 0.9,
          requiresConfirmation: true,
          summary: typeof action.summary === 'string' ? action.summary : `Criar novo item em ${action.module}`
        };
      });

    return res.status(200).json({
      reply,
      actions: sanitizedActions
    });

  } catch (err) {
    console.error('[Lyria AI Endpoint] Error calling AI provider:', err);
    return res.status(500).json({ error: 'Server encountered an error invoking the AI model.' });
  }
}
