import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { validateAndSanitizeAction } from '../lib/aiActionExecutor';
import { buildAIContext } from '../lib/aiContextBuilder';
import { 
  Sparkles, Send, Bot, Trash2, Check, AlertCircle, Info, RefreshCw, 
  X, RotateCcw, AlertTriangle, Eye, Paperclip, Shield, Activity, 
  Layers, ChevronRight, Mic 
} from 'lucide-react';
import { getToday } from '../utils/helpers';

const PROVIDER_MODELS = {
  gemini: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  openai: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini'],
  anthropic: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  xai: ['grok-4.3']
};

const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  openai: 'OpenAI (Em Breve)',
  anthropic: 'Anthropic (Em Breve)',
  xai: 'xAI Grok (Em Breve)'
};

export default function AIAssistant() {
  const { session, isAuthenticated } = useAuth();
  const appState = useApp();
  const { createItem, deleteItem, refreshAll } = appState;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('cp_ai_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [actionLogs, setActionLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('cp_ai_action_log');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [providerSettings, setProviderSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('cp_ai_provider_settings');
      return saved ? JSON.parse(saved) : { provider: 'gemini', model: 'gemini-3.1-pro-preview' };
    } catch (e) {
      return { provider: 'gemini', model: 'gemini-3.1-pro-preview' };
    }
  });

  const [statusData, setStatusData] = useState(null);
  const [attachments, setAttachments] = useState([]); // [{ name, type, size, data (base64) }]
  
  // Audio state variables
  const [isRecording, setIsRecording] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null); // { name, type, size, durationSeconds, blobUrl, base64Data }
  const [transcriptionStatus, setTranscriptionStatus] = useState('idle'); // idle, transcribing, completed, error
  const [transcribedText, setTranscribedText] = useState('');

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Audio recording Refs
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const audioDurationRef = useRef(0);

  // Modal / Editing states for applying actions
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { messageId, action }
  const [editedPayloadStr, setEditedPayloadStr] = useState('');
  const [payloadError, setPayloadError] = useState(null);
  const [parsedPayload, setParsedPayload] = useState(null);

  // Load configured providers status on mount
  useEffect(() => {
    if (!isAuthenticated || !session?.access_token) return;
    fetch('/api/lyria-ai-status', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    })
      .then(res => res.json())
      .then(data => setStatusData(data))
      .catch(err => console.error('[Lyria AI Status] Error loading status:', err));
  }, [isAuthenticated, session]);

  // Clean up media recorder stream tracks on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('cp_ai_provider_settings', JSON.stringify(providerSettings));
  }, [providerSettings]);

  // Persist chat history
  useEffect(() => {
    localStorage.setItem('cp_ai_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Persist action logs
  useEffect(() => {
    localStorage.setItem('cp_ai_action_log', JSON.stringify(actionLogs));
  }, [actionLogs]);

  // Validate edited JSON payload on the fly
  useEffect(() => {
    if (!showConfirmModal || !confirmTarget) return;
    try {
      const parsed = JSON.parse(editedPayloadStr);
      setParsedPayload(parsed);
      validateAndSanitizeAction(confirmTarget.action.module, parsed);
      setPayloadError(null);
    } catch (err) {
      setPayloadError(err.message || 'JSON inválido.');
      setParsedPayload(null);
    }
  }, [editedPayloadStr, showConfirmModal, confirmTarget]);

  // Selected provider configuration status
  const currentProviderConfig = statusData?.providers?.[providerSettings.provider];

  // Dynamic AI Status badge
  const aiStatusLabel = useMemo(() => {
    if (!isAuthenticated) return { text: 'Sessão necessária', class: 'status-badge-error' };
    if (error) return { text: 'Erro na IA', class: 'status-badge-error' };
    
    if (statusData) {
      const geminiConfigured = statusData?.providers?.gemini?.configured;
      if (!geminiConfigured) {
        return { text: 'Configuração pendente', class: 'status-badge-warn' };
      }
    }
    return { text: 'Online', class: 'status-badge-success' };
  }, [isAuthenticated, error, statusData]);

  // Context Build Snapshot Data Info
  const contextSnapshot = useMemo(() => {
    return {
      tasksCount: Array.isArray(appState.tasks) ? appState.tasks.filter(t => t.status !== 'concluída' && t.status !== 'excluída').length : 0,
      financeCount: Array.isArray(appState.finance) ? appState.finance.length : 0,
      projectsCount: Array.isArray(appState.projects) ? appState.projects.filter(p => p.status === 'ativo').length : 0,
      rewardsCount: Array.isArray(appState.rewards) ? appState.rewards.length : 0,
      learningsCount: Array.isArray(appState.learnings) ? appState.learnings.length : 0,
      experimentsCount: Array.isArray(appState.experiments) ? appState.experiments.length : 0,
    };
  }, [appState]);

  // Suggestions List
  const suggestions = [
    { text: 'Com base nas minhas tarefas, o que devo priorizar hoje?', label: 'Prioridades' },
    { text: 'Crie uma tarefa hoje às 15:00 para revisar campanha.', label: 'Agendar Tarefa' },
    { text: 'Registre uma despesa de R$120 com gasolina hoje.', label: 'Lançar Finanças' },
    { text: 'Analise esta imagem e me diga se devo criar alguma tarefa.', label: 'Análise de Imagem' }
  ];

  const handleProviderChange = (e) => {
    const p = e.target.value;
    const defaultModel = PROVIDER_MODELS[p][0];
    setProviderSettings({ provider: p, model: defaultModel });
  };

  const handleModelChange = (e) => {
    setProviderSettings(prev => ({ ...prev, model: e.target.value }));
  };

  // Image Upload handler
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (attachments.length + files.length > 3) {
      alert('Limite máximo de 3 imagens por mensagem.');
      return;
    }

    files.forEach(file => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        alert(`Tipo de arquivo não suportado: ${file.type}. Apenas PNG, JPEG e WEBP são permitidos.`);
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        alert(`Arquivo muito grande: ${file.name}. Limite máximo de 4 MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64Data
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  // Voice recording helper functions
  const formatTimer = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    setError(null);
    setRecordedAudio(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setError('Gravação de áudio não suportada ou desativada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      // Feature-detect best format supported
      let mimeType = '';
      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav'
      ];
      for (const f of formats) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(f)) {
          mimeType = f;
          break;
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks immediately to clean up the mic active indicator in browser
        stream.getTracks().forEach(track => track.stop());
        if (audioStreamRef.current === stream) {
          audioStreamRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const size = audioBlob.size;

        if (size > 10 * 1024 * 1024) {
          setError('O arquivo de áudio excede o limite máximo de 10 MB.');
          return;
        }

        const duration = audioDurationRef.current;
        const extension = (recorder.mimeType || 'audio/webm').split(';')[0].split('/')[1] || 'webm';
        const name = `voice-message-${Date.now()}.${extension}`;
        const blobUrl = URL.createObjectURL(audioBlob);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result.split(',')[1];
          const audioObj = {
            name,
            type: audioBlob.type,
            size,
            durationSeconds: duration,
            blobUrl,
            base64Data
          };
          setRecordedAudio(audioObj);
          setTranscribedText('');
          handleTranscribeAudio(audioObj);
        };
        reader.readAsDataURL(audioBlob);
      };

      setAudioDuration(0);
      audioDurationRef.current = 0;
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setAudioDuration(prev => {
          const next = prev + 1;
          audioDurationRef.current = next;
          if (next >= 180) { // 3 minutes limit
            stopRecording();
            setError('Limite de tempo de gravação de 3 minutos atingido.');
          }
          return next;
        });
      }, 1000);

      recorder.start();
    } catch (err) {
      console.error('[Lyria AI Audio] Recording startup error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permissão de microfone negada. Ative o microfone no navegador para gravar áudio.');
      } else {
        setError(`Falha ao acessar microfone: ${err.message || err}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const removeRecordedAudio = () => {
    if (recordedAudio?.blobUrl) {
      URL.revokeObjectURL(recordedAudio.blobUrl);
    }
    setRecordedAudio(null);
    setTranscriptionStatus('idle');
    setTranscribedText('');
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  };

  const handleTranscribeAudio = async (audioToTranscribe) => {
    const audioObj = audioToTranscribe || recordedAudio;
    if (!audioObj || !audioObj.base64Data) return;

    setTranscriptionStatus('transcribing');
    setError(null);

    if (!session || !session.access_token) {
      setError('Sessão expirada. Faça login novamente para transcrever.');
      setTranscriptionStatus('error');
      return;
    }

    try {
      const response = await fetch('/api/lyria-ai-transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          audio: {
            name: audioObj.name,
            type: audioObj.type,
            size: audioObj.size,
            durationSeconds: audioObj.durationSeconds,
            data: audioObj.base64Data
          }
        })
      });

      if (response.status === 401) {
        setError('Sessão expirada. Faça login novamente.');
        setTranscriptionStatus('error');
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        setError(errJson.error || 'Não foi possível transcrever o áudio. Tente gravar novamente.');
        setTranscriptionStatus('error');
        return;
      }

      const data = await response.json();
      if (data.transcript) {
        setInput(data.transcript);
        setTranscribedText(data.transcript);
        setTranscriptionStatus('completed');
        // Clear base64 raw data from state as much as possible after successful transcription
        setRecordedAudio(prev => prev ? {
          ...prev,
          base64Data: undefined // remove base64 payload from state
        } : null);
      } else {
        setError('Não foi possível obter uma transcrição válida. Tente gravar novamente.');
        setTranscriptionStatus('error');
      }

    } catch (err) {
      console.error('[Lyria AI Audio] Transcription request error:', err);
      setError('Erro de conexão ao transcrever o áudio.');
      setTranscriptionStatus('error');
    }
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text && attachments.length === 0) return;
    if (loading) return;

    if (!session || !session.access_token) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }

    setError(null);
    setInput('');
    
    // Save only metadata for attachments/audio (prevent localStorage bloating)
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      attachments: attachments.map(att => ({
        name: att.name,
        type: att.type,
        size: att.size
      })),
      audio: recordedAudio ? {
        type: 'audio',
        name: recordedAudio.name,
        mimeType: recordedAudio.type,
        size: recordedAudio.size,
        durationSeconds: recordedAudio.durationSeconds
      } : undefined,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const attachmentsToSend = [...attachments];

    setAttachments([]); // Clear previews
    removeRecordedAudio(); // Clear recorded voice file & free up mic stream

    try {
      const messageHistory = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content
      }));

      let contextPayload = {
        currentDate: getToday(),
        locale: 'pt-BR',
        summary: {}
      };

      try {
        contextPayload = buildAIContext(appState);
      } catch (ctxErr) {
        console.error('[Lyria AI Assistant] Context builder failed:', ctxErr);
      }

      const response = await fetch('/api/lyria-ai-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: text,
          context: contextPayload,
          history: messageHistory,
          provider: providerSettings.provider,
          model: providerSettings.model,
          attachments: attachmentsToSend.map(att => ({
            name: att.name,
            type: att.type,
            size: att.size,
            data: att.data
          }))
          // audio is omitted: we only send the transcribed/edited text message
        })
      });

      if (response.status === 401) {
        setError('Sessão expirada. Faça login novamente.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        setError(errJson.error || 'Erro ao processar mensagem. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || 'Não consegui obter uma resposta.',
        actions: Array.isArray(data.actions) ? data.actions.map(a => ({
          ...a,
          id: crypto.randomUUID(),
          status: 'pending', // pending, applied, reverted
          createdItemId: null
        })) : [],
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, assistantMessage]);

    } catch (err) {
      console.error('[Lyria AI Assistant] Request failure:', err);
      setError('Erro de conexão com o servidor. Verifique sua rede e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja realmente limpar o histórico de mensagens local?')) {
      setMessages([]);
      localStorage.removeItem('cp_ai_chat_history');
      setError(null);
    }
  };

  const openConfirmModal = (messageId, action) => {
    setConfirmTarget({ messageId, action });
    setEditedPayloadStr(JSON.stringify(action.payload, null, 2));
    setPayloadError(null);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmTarget(null);
    setEditedPayloadStr('');
    setPayloadError(null);
    setParsedPayload(null);
  };

  const handleApplyAction = () => {
    if (payloadError || !parsedPayload || !confirmTarget) return;

    const { messageId, action } = confirmTarget;
    
    try {
      const sanitizedPayload = validateAndSanitizeAction(action.module, parsedPayload);
      const createdItem = createItem(action.module, sanitizedPayload);

      if (!createdItem || !createdItem.id) {
        throw new Error('Falha ao obter ID do item criado pelo banco local.');
      }

      const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        status: 'applied', // applied, reverted
        actionType: 'create',
        module: action.module,
        summary: action.summary,
        payload: sanitizedPayload,
        createdItemId: createdItem.id
      };

      setActionLogs((prev) => [logEntry, ...prev]);

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.actions) {
            return {
              ...msg,
              actions: msg.actions.map((act) => {
                if (act.id === action.id) {
                  return { ...act, status: 'applied', createdItemId: createdItem.id, payload: sanitizedPayload };
                }
                return act;
              })
            };
          }
          return msg;
        })
      );

      if (refreshAll) refreshAll();
      closeConfirmModal();

    } catch (err) {
      console.error('[Lyria AI Assistant] Apply action failed:', err);
      alert(`Falha ao aplicar ação: ${err.message}`);
    }
  };

  const handleRevertAction = (module, createdItemId, logId, actionIdInChat = null) => {
    if (!createdItemId) {
      alert('Erro: ID do item criado está ausente.');
      return;
    }

    const logToRevert = logId 
      ? actionLogs.find(l => l.id === logId) 
      : actionLogs.find(l => l.createdItemId === createdItemId);

    if (logToRevert && logToRevert.status === 'reverted') {
      alert('Esta ação já foi revertida.');
      return;
    }

    if (!window.confirm('Deseja realmente reverter esta criação? O item correspondente será excluído permanentemente do Lyria.')) {
      return;
    }

    try {
      deleteItem(module, createdItemId);

      setActionLogs((prev) =>
        prev.map((log) => (log.id === (logId || (logToRevert && logToRevert.id)) ? { ...log, status: 'reverted' } : log))
      );

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.actions) {
            return {
              ...msg,
              actions: msg.actions.map((act) => {
                if (act.createdItemId === createdItemId || (actionIdInChat && act.id === actionIdInChat)) {
                  return { ...act, status: 'reverted' };
                }
                return act;
              })
            };
          }
          return msg;
        })
      );

      if (refreshAll) refreshAll();
      alert('Ação revertida com sucesso. O item foi removido do Lyria.');
    } catch (err) {
      console.error('[Lyria AI Assistant] Revert action failed:', err);
      alert(`Falha ao reverter ação: ${err.message}`);
    }
  };

  const handleIgnoreAction = (messageId, actionId) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.actions) {
          return {
            ...msg,
            actions: msg.actions.filter((act) => act.id !== actionId)
          };
        }
        return msg;
      })
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: 'var(--sp-6)' }}>
          <AlertCircle size={40} color="var(--danger)" style={{ marginBottom: 'var(--sp-3)' }} />
          <h3>Acesso Restrito</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-1)' }}>
            Faça login em sua conta do Lyria para conversar com o assistente de IA.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      
      {/* Styles for grid controls & blink animation */}
      <style>{`
        .ai-hub-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: var(--sp-4);
          width: 100%;
        }
        @media (max-width: 960px) {
          .ai-hub-grid {
            grid-template-columns: 1fr;
          }
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 9999px;
        }
        .status-badge-success {
          background: rgba(46, 204, 113, 0.1);
          color: #2ecc71;
        }
        .status-badge-warn {
          background: rgba(241, 196, 15, 0.1);
          color: #f1c40f;
        }
        .status-badge-error {
          background: rgba(231, 76, 60, 0.1);
          color: #e74c3c;
        }
        .sidebar-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-tertiary);
          letter-spacing: 0.05em;
          margin-bottom: var(--sp-2);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .form-select-custom {
          width: 100%;
          background: var(--bg-primary);
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          padding: 8px 12px;
          font-size: var(--fs-xs);
          outline: none;
          margin-bottom: var(--sp-2);
        }
        .form-select-custom option {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }
        .sidebar-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-soft);
          border-radius: var(--radius-md);
          padding: var(--sp-4);
          display: flex;
          flex-direction: column;
          gap: var(--sp-3);
        }
        .blink-anim {
          animation: blink 1s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Sparkles size={24} color="var(--accent)" /> Lyria AI Assistant
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Converse, planeje e execute ações com segurança dentro do seu sistema.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span className={`status-badge ${aiStatusLabel.class}`}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
            {aiStatusLabel.text}
          </span>
          {messages.length > 0 && (
            <button className="btn-icon" onClick={handleClearHistory} title="Limpar Histórico" style={{ color: 'var(--danger)', padding: '8px' }}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Responsive Layout */}
      <div className="ai-hub-grid">
        
        {/* Left Side: Chat Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', minWidth: 0 }}>
          
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', minHeight: '520px' }}>
            
            {/* Scrollable Message Box */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--sp-6)', margin: 'auto 0' }}>
                  <Bot size={48} color="var(--accent)" style={{ opacity: 0.8, marginBottom: 'var(--sp-3)' }} />
                  <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Lyria AI Agent V1</h3>
                  <p style={{ maxWidth: '420px', fontSize: 'var(--fs-xs)', marginTop: '4px', color: 'var(--text-tertiary)' }}>
                    Como posso organizar sua rotina hoje? Você pode propor tarefas, lançamentos financeiros, ou pedir análises estratégicas.
                  </p>

                  {/* Suggestions command list */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-2)', width: '100%', maxWidth: '640px', marginTop: 'var(--sp-5)' }}>
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (sug.text.includes('imagem')) {
                            setInput(sug.text);
                            fileInputRef.current?.click();
                          } else {
                            handleSend(sug.text);
                          }
                        }}
                        className="card"
                        style={{
                          padding: 'var(--sp-3)',
                          textAlign: 'left',
                          fontSize: 'var(--fs-xs)',
                          cursor: 'pointer',
                          border: '1px solid var(--border-soft)',
                          background: 'var(--bg-tertiary)',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 'var(--sp-1)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-soft)'}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '10px', textTransform: 'uppercase' }}>{sug.label}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>"{sug.text}"</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      
                      {/* Message Bubble container */}
                      <div
                        style={{
                          padding: 'var(--sp-3) var(--sp-4)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 'var(--fs-sm)',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                          color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                          border: msg.role === 'user' ? 'none' : '1px solid var(--border-soft)'
                        }}
                      >
                        {msg.content}

                        {/* Render audio metadata in message bubbles */}
                        {msg.audio && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: msg.role === 'user' ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-primary)', color: msg.role === 'user' ? '#fff' : 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', marginTop: '6px', border: '1px solid var(--border-soft)', width: 'fit-content' }}>
                            <span>🎙️</span>
                            <span>Mensagem de Voz ({msg.audio.durationSeconds}s)</span>
                            <span style={{ opacity: 0.6 }}>({Math.round(msg.audio.size / 1024)} KB)</span>
                          </div>
                        )}

                        {/* Render attachment badges in message bubbles (metadata only) */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                            {msg.attachments.map((att, idx) => (
                              <div 
                                key={idx} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  background: msg.role === 'user' ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-primary)', 
                                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)', 
                                  padding: '2px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '10px', 
                                  border: '1px solid var(--border-soft)' 
                                }}
                              >
                                <span style={{ opacity: 0.8 }}>📎</span>
                                <span>{att.name}</span>
                                <span style={{ opacity: 0.6 }}>({Math.round(att.size / 1024)} KB)</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Proposed Card */}
                      {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-1)' }}>
                          {msg.actions.map((act) => {
                            const matchingLog = actionLogs.find(l => l.createdItemId === act.createdItemId || (act.status === 'applied' && l.module === act.module && l.createdItemId === act.createdItemId));
                            const logId = matchingLog?.id;
                            
                            return (
                              <div
                                key={act.id}
                                className="card"
                                style={{
                                  padding: 'var(--sp-4)',
                                  border: '1px solid var(--border-soft)',
                                  background: 'var(--bg-primary)',
                                  borderRadius: 'var(--radius-md)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 'var(--sp-2)',
                                  opacity: act.status === 'reverted' ? 0.7 : 1
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                                  <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                    <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                                      {act.module}
                                    </span>
                                    <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', textTransform: 'lowercase' }}>
                                      {act.type}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                                    Confiança: {Math.round(act.confidence * 100)}%
                                  </span>
                                </div>

                                <div style={{ fontWeight: 500, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', margin: '4px 0' }}>
                                  {act.summary}
                                </div>

                                {act.module === 'finance' && (
                                  <div style={{ fontSize: 'var(--fs-xs)', background: '#ffeaa722', border: '1px solid #ffeaa7aa', color: '#e17055', padding: '6px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <AlertTriangle size={12} />
                                    <span>Lançamento financeiro. Impactará diretamente os saldos reais no Lyria.</span>
                                  </div>
                                )}

                                <details style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 'var(--sp-2)', borderRadius: '4px', cursor: 'pointer' }}>
                                  <summary style={{ outline: 'none', fontWeight: 500, color: 'var(--text-tertiary)' }}>Visualizar Payload Proposto</summary>
                                  <pre style={{ marginTop: 'var(--sp-2)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)' }}>
                                    {JSON.stringify(act.payload, null, 2)}
                                  </pre>
                                </details>

                                <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)', alignItems: 'center' }}>
                                  {act.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => openConfirmModal(msg.id, act)}
                                        className="btn-primary"
                                        style={{ padding: '6px 12px', fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}
                                      >
                                        <Check size={12} /> Aplicar no Lyria
                                      </button>
                                      <button
                                        onClick={() => handleIgnoreAction(msg.id, act.id)}
                                        className="btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: 'var(--fs-xs)', background: 'transparent', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)' }}
                                      >
                                        Ignorar
                                      </button>
                                    </>
                                  )}

                                  {act.status === 'applied' && (
                                    <>
                                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Check size={14} /> Aplicado com sucesso
                                      </span>
                                      <button
                                        onClick={() => handleRevertAction(act.module, act.createdItemId, logId, act.id)}
                                        className="btn-secondary"
                                        style={{ padding: '4px 10px', fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                      >
                                        <RotateCcw size={12} /> Reverter
                                      </button>
                                    </>
                                  )}

                                  {act.status === 'reverted' && (
                                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>
                                      Ação Desfeita / Revertida
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <RefreshCw size={14} className="spin" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent)' }} />
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Lyria está pensando...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error Message Panel */}
            {error && (
              <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--danger-subtle)', borderTop: '1px solid var(--border-soft)', color: 'var(--danger)', fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{error}</span>
              </div>
            )}

            {/* Selected image previews */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '8px var(--sp-4)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-soft)' }}>
                {attachments.map((att, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-soft)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>
                    <span>🖼️ {att.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Voice Preview Player Bar */}
            {recordedAudio && (
              <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', padding: '10px var(--sp-4)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-xs)', color: 'var(--text-primary)' }}>
                  <span>🎙️ Áudio:</span>
                  <strong>{recordedAudio.name}</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>({recordedAudio.durationSeconds}s)</span>
                </div>
                <audio src={recordedAudio.blobUrl} controls style={{ height: '28px', flex: 1, minWidth: '160px', outline: 'none' }} />
                
                {/* Transcription Status and Retry */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {transcriptionStatus === 'transcribing' && (
                    <span style={{ fontSize: '11px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={12} className="spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                      Transcrevendo...
                    </span>
                  )}
                  {transcriptionStatus === 'completed' && (
                    <>
                      <span style={{ fontSize: '11px', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} />
                        Transcrição concluída
                      </span>
                      {transcribedText && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setInput(transcribedText)}
                          style={{ padding: '2px 8px', fontSize: '10px', background: 'transparent' }}
                          title="Recopiar a transcrição para a caixa de texto"
                        >
                          Usar transcrição
                        </button>
                      )}
                    </>
                  )}
                  {transcriptionStatus === 'error' && (
                    <>
                      <span style={{ fontSize: '11px', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} />
                        Erro ao transcrever
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleTranscribeAudio(recordedAudio)}
                        style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--accent)', borderColor: 'var(--accent)' }}
                      >
                        Transcrever áudio
                      </button>
                    </>
                  )}
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      removeRecordedAudio();
                      startRecording();
                    }}
                    style={{ padding: '4px 10px', fontSize: 'var(--fs-xs)', color: 'var(--accent)', borderColor: 'var(--accent)', background: 'transparent' }}
                  >
                    Regravar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={removeRecordedAudio}
                    style={{ padding: '4px 10px', fontSize: 'var(--fs-xs)', color: 'var(--danger)', borderColor: 'var(--danger)', background: 'transparent' }}
                  >
                    Remover áudio
                  </button>
                </div>
              </div>
            )}

            {/* Input Text Area Box */}
            {isRecording ? (
              <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: 'var(--fs-sm)', fontWeight: 600, flex: 1 }}>
                  <span className="blink-anim" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
                  <span>Gravando... ({formatTimer(audioDuration)})</span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={stopRecording}
                  style={{ padding: '6px 16px', fontSize: 'var(--fs-xs)', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
                >
                  Parar
                </button>
              </div>
            ) : (
              <div style={{ padding: 'var(--sp-3)', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexShrink: 0 }}>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp"
                  multiple
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || attachments.length >= 3}
                  title="Anexar imagem (PNG, JPEG, WEBP — Max 3)"
                  style={{ padding: '8px', color: 'var(--text-secondary)' }}
                >
                  <Paperclip size={18} />
                </button>

                {/* Microphone Recording Button */}
                <button
                  type="button"
                  className="btn-icon"
                  onClick={startRecording}
                  disabled={loading || !!recordedAudio}
                  title="Gravar áudio de voz (Max 3 min)"
                  style={{ padding: '8px', color: 'var(--text-secondary)' }}
                >
                  <Mic size={18} />
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={recordedAudio ? "Envie seu áudio gravado..." : "Dite um comando aqui... (ex: 'Lançar despesa de R$50 hoje')"}
                  disabled={loading}
                  rows={1}
                  style={{
                    flex: 1,
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '10px 12px',
                    fontSize: 'var(--fs-sm)',
                    resize: 'none',
                    height: '40px',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || (!input.trim() && attachments.length === 0 && !recordedAudio)}
                  className="btn-primary"
                  style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', padding: 0, flexShrink: 0 }}
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Control & Configuration Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          
          {/* AI Settings panel */}
          <div className="sidebar-card">
            <h4 className="sidebar-section-title">
              <Activity size={14} color="var(--accent)" /> Conexão & Modelo
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>PROVEDOR:</label>
                <select 
                  value={providerSettings.provider} 
                  onChange={handleProviderChange}
                  className="form-select-custom"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI (Indisponível)</option>
                  <option value="anthropic">Anthropic (Indisponível)</option>
                  <option value="xai">xAI Grok (Indisponível)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>MODELO DE IA:</label>
                <select 
                  value={providerSettings.model} 
                  onChange={handleModelChange}
                  className="form-select-custom"
                >
                  {PROVIDER_MODELS[providerSettings.provider].map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
              </div>

              {/* Server connection status details */}
              <div style={{ fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border-soft)', padding: '8px 10px', borderRadius: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status no Servidor:</span>
                  <span style={{ fontWeight: 600, color: currentProviderConfig?.configured ? '#2ecc71' : '#e74c3c' }}>
                    {currentProviderConfig?.configured ? 'Configurado' : 'Não Configurado'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status Impl.:</span>
                  <span style={{ fontWeight: 600, color: currentProviderConfig?.implemented ? '#2ecc71' : 'var(--text-tertiary)' }}>
                    {currentProviderConfig?.implemented ? 'Pronto (V1)' : 'Indisponível'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Entrada de Imagem:</span>
                  <span style={{ fontWeight: 600, color: currentProviderConfig?.implemented && currentProviderConfig?.imageInput ? '#2ecc71' : 'var(--text-tertiary)' }}>
                    {currentProviderConfig?.implemented && currentProviderConfig?.imageInput ? 'Suportado' : 'Não Suportado'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Entrada de Áudio:</span>
                  <span style={{ fontWeight: 600, color: currentProviderConfig?.implemented && currentProviderConfig?.audioInput ? '#2ecc71' : 'var(--text-tertiary)' }}>
                    {currentProviderConfig?.implemented && currentProviderConfig?.audioInput ? 'Suportado' : 'Não Suportado'}
                  </span>
                </div>
              </div>
              
              {/* controlled warning for unimplemented providers/models */}
              {providerSettings.provider !== 'gemini' && (
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', background: 'rgba(231, 76, 60, 0.05)', border: '1px solid rgba(231, 76, 60, 0.2)', color: '#e74c3c', padding: '8px', borderRadius: '4px', marginTop: '4px' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>Este modelo ainda não está implementado no servidor. O endpoint retornará erro controlado se usado.</span>
                </div>
              )}
            </div>
          </div>

          {/* Safety Control Panel */}
          <div className="sidebar-card">
            <h4 className="sidebar-section-title">
              <Shield size={14} color="var(--accent)" /> Segurança de Execução
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ações Automáticas</span>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>DESLIGADO</span>
              </div>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Exigir Confirmação</span>
                <span style={{ color: '#2ecc71', fontWeight: 600 }}>ATIVO</span>
              </div>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Reversão de Ações</span>
                <span style={{ color: '#2ecc71', fontWeight: 600 }}>ATIVO</span>
              </div>
              <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Alerta Financeiro</span>
                <span style={{ color: '#2ecc71', fontWeight: 600 }}>ATIVO</span>
              </div>
            </div>
          </div>

          {/* Context Snapshot Panel */}
          <div className="sidebar-card">
            <h4 className="sidebar-section-title">
              <Layers size={14} color="var(--accent)" /> Estado de Contexto
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tarefas Pendentes:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contextSnapshot.tasksCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Registros Financeiros:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contextSnapshot.financeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Projetos Ativos:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{contextSnapshot.projectsCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Aprendizados / Exp.:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {contextSnapshot.learningsCount} / {contextSnapshot.experimentsCount}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-soft)', paddingTop: '6px', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status do Snapshot:</span>
                <span style={{ color: '#2ecc71', fontWeight: 600 }}>Compactado (Ok)</span>
              </div>
            </div>
          </div>

          {/* Recent Action Feed sidebar section */}
          {actionLogs.length > 0 && (
            <div className="sidebar-card" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              <h4 className="sidebar-section-title">
                <Eye size={14} color="var(--accent)" /> Histórico Recente
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {actionLogs.slice(0, 4).map((log) => (
                  <div 
                    key={log.id} 
                    style={{ 
                      fontSize: '11px', 
                      background: 'var(--bg-primary)', 
                      border: '1px solid var(--border-soft)', 
                      padding: '8px', 
                      borderRadius: '4px',
                      opacity: log.status === 'reverted' ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 600 }}>
                      <span style={{ textTransform: 'uppercase', color: 'var(--accent)' }}>{log.module}</span>
                      <span style={{ color: log.status === 'reverted' ? 'var(--text-tertiary)' : '#2ecc71' }}>
                        {log.status === 'applied' ? 'Aplicado' : 'Revertido'}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '6px', fontSize: '10px' }}>
                      {log.summary}
                    </div>
                    {log.status === 'applied' && (
                      <button
                        onClick={() => handleRevertAction(log.module, log.createdItemId, log.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--danger)',
                          color: 'var(--danger)',
                          padding: '2px 8px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          width: '100%',
                          justifyContent: 'center'
                        }}
                      >
                        <RotateCcw size={10} /> Reverter Criação
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--sp-4)'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-4)',
            overflow: 'hidden',
            padding: 'var(--sp-5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: 'var(--sp-2)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent)" /> Confirmar e Aplicar Ação
              </h3>
              <button className="btn-icon" onClick={closeConfirmModal} style={{ padding: 0 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ fontSize: 'var(--fs-sm)' }}>
                Você está prestes a criar este item no Lyria. Você pode revisar e alterar o payload JSON proposto abaixo antes de confirmar.
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp-3)', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '4px', fontSize: 'var(--fs-xs)', alignItems: 'center' }}>
                <div><strong>Módulo:</strong> <span style={{ textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>{confirmTarget.action.module}</span></div>
                <div><strong>Ação:</strong> <span style={{ textTransform: 'lowercase' }}>{confirmTarget.action.type}</span></div>
              </div>

              {confirmTarget.action.module === 'finance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255, 118, 117, 0.1)', border: '1px solid var(--danger)', padding: '12px', borderRadius: '4px', color: 'var(--danger)', fontSize: 'var(--fs-xs)' }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> ALERTA DE SEGURANÇA FINANCEIRA
                  </div>
                  <div>Esta ação irá lançar um registro financeiro real e alterar seus saldos e relatórios de fluxo de caixa. Verifique o valor, tipo (entrada/saída) e a data antes de aplicar.</div>
                </div>
              )}

              {payloadError ? (
                <div style={{ background: 'rgba(255, 118, 117, 0.1)', border: '1px solid var(--danger)', padding: '8px 12px', borderRadius: '4px', color: 'var(--danger)', fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>Erro de Validação: {payloadError}</span>
                </div>
              ) : (
                <div style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid var(--success)', padding: '8px 12px', borderRadius: '4px', color: 'var(--success)', fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} style={{ flexShrink: 0 }} />
                  <span>Payload válido e pronto para aplicar.</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>Payload da Ação (Editável):</label>
                <textarea
                  value={editedPayloadStr}
                  onChange={(e) => setEditedPayloadStr(e.target.value)}
                  rows={10}
                  style={{
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${payloadError ? 'var(--danger)' : 'var(--border-soft)'}`,
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '10px',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)', borderTop: '1px solid var(--border-soft)', paddingTop: 'var(--sp-3)' }}>
              <button className="btn-secondary" onClick={closeConfirmModal} style={{ padding: '8px 16px' }}>
                Cancelar
              </button>
              <button
                disabled={!!payloadError || !parsedPayload}
                className="btn-primary"
                onClick={handleApplyAction}
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: (payloadError || !parsedPayload) ? 0.5 : 1,
                  cursor: (payloadError || !parsedPayload) ? 'not-allowed' : 'pointer'
                }}
              >
                <Check size={14} /> Confirmar e aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
