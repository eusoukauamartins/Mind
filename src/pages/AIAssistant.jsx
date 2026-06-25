import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { validateAndSanitizeAction } from '../lib/aiActionExecutor';
import { buildAIContext } from '../lib/aiContextBuilder';
import { detectIntent } from '../../lib/aiIntentRouter.js';
import { 
  Sparkles, Send, Bot, Trash2, Check, AlertCircle, Info, RefreshCw, 
  X, RotateCcw, AlertTriangle, Eye, Paperclip, Shield, Activity, 
  Layers, ChevronRight, Mic, History, Pin, Archive, Edit2 
} from 'lucide-react';
import { getToday } from '../utils/helpers';

const PROVIDER_MODELS = {
  gemini: ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  openai: ['gpt-4o'],
  anthropic: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  xai: ['grok-4.3']
};

const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Em Breve)',
  xai: 'xAI Grok (Em Breve)'
};

function inferTitleFromMessage(messageText) {
  if (!messageText) return 'Nova Conversa';
  const text = messageText.trim().toLowerCase();
  
  if (text.includes('tarefa') || text.includes('todo') || text.includes('fazer') || text.includes('rotina')) {
    return 'Organização de Tarefas';
  }
  if (text.includes('finança') || text.includes('gasto') || text.includes('despesa') || text.includes('receita') || text.includes('lançar') || text.includes('dinheiro')) {
    return 'Planejamento Financeiro';
  }
  if (text.includes('projeto') || text.includes('campanha') || text.includes('ads')) {
    return 'Planejamento de Projeto';
  }
  if (text.includes('ideia') || text.includes('conteúdo') || text.includes('criar') || text.includes('escrever')) {
    return 'Ideias para Conteúdo';
  }
  if (text.includes('estudo') || text.includes('aprender') || text.includes('curso')) {
    return 'Estudos e Aprendizados';
  }
  
  const words = messageText.trim().split(/\s+/);
  if (words.length <= 4) {
    return messageText.trim();
  }
  return words.slice(0, 4).join(' ') + '...';
}

export default function AIAssistant() {
  const { session, isAuthenticated } = useAuth();
  const appState = useApp();
  const { createItem, deleteItem, refreshAll } = appState;

  const [conversations, setConversations] = useState(() => {
    const migrated = localStorage.getItem('cp_ai_history_migrated');
    const oldHistoryStr = localStorage.getItem('cp_ai_chat_history');
    
    if (!migrated && oldHistoryStr) {
      try {
        const oldHistory = JSON.parse(oldHistoryStr);
        if (Array.isArray(oldHistory) && oldHistory.length > 0) {
          const migratedConv = {
            id: crypto.randomUUID(),
            title: 'Conversa Anterior',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: oldHistory,
            provider: 'openai',
            model: 'gpt-4o',
            messageCount: oldHistory.length,
            pinned: false,
            archived: false
          };
          localStorage.setItem('cp_ai_conversations', JSON.stringify([migratedConv]));
          localStorage.setItem('cp_ai_current_conversation_id', migratedConv.id);
          localStorage.setItem('cp_ai_history_migrated', 'true');
          return [migratedConv];
        }
      } catch (e) {
        console.error('Failed to migrate history:', e);
      }
    }
    
    try {
      const saved = localStorage.getItem('cp_ai_conversations');
      const list = saved ? JSON.parse(saved) : [];
      if (list.length > 0) {
        return list.map(c => c && c.model === 'gpt-4o-mini' ? { ...c, model: 'gpt-4o' } : c);
      }
    } catch (e) {
      console.error('Failed to parse conversations:', e);
    }
    
    const firstConv = {
      id: crypto.randomUUID(),
      title: 'Nova Conversa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      provider: 'openai',
      model: 'gpt-4o',
      messageCount: 0,
      pinned: false,
      archived: false
    };
    return [firstConv];
  });

  const [currentConversationId, setCurrentConversationId] = useState(() => {
    const savedId = localStorage.getItem('cp_ai_current_conversation_id');
    return savedId || '';
  });

  useEffect(() => {
    if (conversations.length > 0) {
      const exists = conversations.some(c => c.id === currentConversationId);
      if (!exists) {
        const nonArchived = conversations.find(c => !c.archived);
        setCurrentConversationId(nonArchived ? nonArchived.id : conversations[0].id);
      }
    }
  }, [conversations, currentConversationId]);

  const currentConversation = useMemo(() => {
    return conversations.find(c => c.id === currentConversationId) || conversations[0] || null;
  }, [conversations, currentConversationId]);

  const messages = currentConversation?.messages || [];

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
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && (parsed.provider === 'gemini' || parsed.provider === 'xai' || parsed.model === 'gpt-4o-mini')) {
        return { provider: 'openai', model: 'gpt-4o' };
      }
      return parsed || { provider: 'openai', model: 'gpt-4o' };
    } catch (e) {
      return { provider: 'openai', model: 'gpt-4o' };
    }
  });

  // History panel related states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(25);

  const visibleMessages = useMemo(() => {
    return messages.slice(-visibleMessagesCount);
  }, [messages, visibleMessagesCount]);

  const [statusData, setStatusData] = useState(null);
  const [statusError, setStatusError] = useState(null);
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
      .then(res => {
        if (!res.ok) {
          throw new Error('Não foi possível carregar status dos provedores.');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.providers) {
          setStatusData(data);
          setStatusError(null);
        } else if (data && data.error) {
          throw new Error(data.error);
        }
      })
      .catch(err => {
        console.error('[Lyria AI Status] Error loading status:', err);
        setStatusError('Não foi possível carregar status dos provedores.');
      });
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

  // Reset visible messages count when active conversation switches
  useEffect(() => {
    setVisibleMessagesCount(25);
  }, [currentConversationId]);

  // Persist conversations list to localStorage
  useEffect(() => {
    localStorage.setItem('cp_ai_conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Persist active conversation ID to localStorage
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('cp_ai_current_conversation_id', currentConversationId);
    }
  }, [currentConversationId]);

  // Update provider/model settings when switching conversations
  useEffect(() => {
    if (currentConversation) {
      const p = currentConversation.provider || 'openai';
      const m = currentConversation.model || 'gpt-4o';
      
      const supportedProviders = ['openai', 'anthropic'];
      const isSupported = supportedProviders.includes(p);
      const isModelValid = PROVIDER_MODELS[p]?.includes(m);
      
      if (isSupported && isModelValid) {
        setProviderSettings({ provider: p, model: m });
      } else {
        setProviderSettings({ provider: 'openai', model: 'gpt-4o' });
      }
    }
  }, [currentConversationId]);

  // Helper to update active conversation's messages and trigger auto-title inference
  const updateActiveConversationMessages = (newMessages) => {
    setConversations(prev => prev.map(c => {
      if (c.id === currentConversationId) {
        let title = c.title;
        if (c.messages.length === 0 && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg && (c.title === 'Nova Conversa' || !c.title)) {
            title = inferTitleFromMessage(firstUserMsg.content);
          }
        }
        return {
          ...c,
          messages: newMessages,
          messageCount: newMessages.length,
          title,
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    }));
  };

  // Helper to generate a relative/friendly date label
  const getRelativeDateLabel = (dateString) => {
    if (!dateString) return 'Sem data';
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Hoje';
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return `${diffDays} dias atrás`;
      
      return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    } catch (e) {
      return 'Sem data';
    }
  };

  // Create a new empty conversation and set it as active
  const handleNewConversation = () => {
    const newId = crypto.randomUUID();
    const newConv = {
      id: newId,
      title: 'Nova Conversa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      provider: providerSettings.provider,
      model: providerSettings.model,
      messageCount: 0,
      pinned: false,
      archived: false
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newId);
    setIsHistoryOpen(false);
  };

  // Rename conversation inline
  const handleRenameConversation = (id, newTitle) => {
    if (!newTitle || !newTitle.trim()) return;
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() };
      }
      return c;
    }));
  };

  // Pin/Unpin conversation
  const handleTogglePin = (id) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, pinned: !c.pinned, updatedAt: new Date().toISOString() };
      }
      return c;
    }));
  };

  // Archive/Unarchive conversation
  const handleToggleArchive = (id) => {
    setConversations(prev => prev.map(c => {
      if (c.id === id) {
        const toggledArchive = !c.archived;
        if (toggledArchive && currentConversationId === id) {
          setTimeout(() => {
            setConversations(latest => {
              const nonArchived = latest.find(x => x.id !== id && !x.archived);
              if (nonArchived) {
                setCurrentConversationId(nonArchived.id);
              }
              return latest;
            });
          }, 0);
        }
        return { ...c, archived: toggledArchive, updatedAt: new Date().toISOString() };
      }
      return c;
    }));
  };

  // Delete conversation with confirmation
  const handleDeleteConversation = (id) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    if (window.confirm(`Deseja realmente excluir a conversa "${conv.title}"?`)) {
      setConversations(prev => {
        const remaining = prev.filter(c => c.id !== id);
        if (currentConversationId === id) {
          if (remaining.length > 0) {
            const nonArchived = remaining.find(x => !x.archived) || remaining[0];
            setCurrentConversationId(nonArchived.id);
          } else {
            const firstConv = {
              id: crypto.randomUUID(),
              title: 'Nova Conversa',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: [],
              provider: providerSettings.provider,
              model: providerSettings.model,
              messageCount: 0,
              pinned: false,
              archived: false
            };
            setCurrentConversationId(firstConv.id);
            return [firstConv];
          }
        }
        return remaining;
      });
    }
  };

  // Sort list for history panel: Pinned first, then sorted by updatedAt descending
  const sortedConversations = useMemo(() => {
    const filtered = conversations.filter(c => showArchived ? c.archived : !c.archived);
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [conversations, showArchived]);

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
      const openaiConfigured = statusData?.providers?.openai?.configured;
      if (!openaiConfigured) {
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

    setConversations((latestConvs) => latestConvs.map(c => {
      if (c.id === currentConversationId) {
        const updatedMessages = [...c.messages, userMessage];
        let title = c.title;
        if (c.messages.length === 0 && updatedMessages.length > 0) {
          const firstUserMsg = updatedMessages.find(m => m.role === 'user');
          if (firstUserMsg && (c.title === 'Nova Conversa' || !c.title)) {
            title = inferTitleFromMessage(firstUserMsg.content);
          }
        }
        return {
          ...c,
          messages: updatedMessages,
          messageCount: updatedMessages.length,
          title,
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    }));
    setLoading(true);

    const attachmentsToSend = [...attachments];

    setAttachments([]); // Clear previews
    removeRecordedAudio(); // Clear recorded voice file & free up mic stream

    try {
      const { intent } = detectIntent(text);
      const historyLimit = intent === 'chat' ? 10 : 4;
      const messageHistory = messages.slice(-historyLimit).map((m) => ({
        role: m.role,
        content: m.content
      }));

      let contextPayload = {
        currentDate: getToday(),
        locale: 'pt-BR',
        summary: {}
      };

      try {
        contextPayload = buildAIContext(appState, text, messageHistory);
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
          intent,
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

      setConversations((latestConvs) => latestConvs.map(c => {
        if (c.id === currentConversationId) {
          const updatedMessages = [...c.messages, assistantMessage];
          return {
            ...c,
            messages: updatedMessages,
            messageCount: updatedMessages.length,
            updatedAt: new Date().toISOString()
          };
        }
        return c;
      }));

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
      updateActiveConversationMessages([]);
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

      const updatedMessages = messages.map((msg) => {
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
      });
      updateActiveConversationMessages(updatedMessages);

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

      const updatedMessages = messages.map((msg) => {
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
      });
      updateActiveConversationMessages(updatedMessages);

      if (refreshAll) refreshAll();
      alert('Ação revertida com sucesso. O item foi removido do Lyria.');
    } catch (err) {
      console.error('[Lyria AI Assistant] Revert action failed:', err);
      alert(`Falha ao reverter ação: ${err.message}`);
    }
  };

  const handleIgnoreAction = (messageId, actionId) => {
    const updatedMessages = messages.map((msg) => {
      if (msg.id === messageId && msg.actions) {
        return {
          ...msg,
          actions: msg.actions.filter((act) => act.id !== actionId)
        };
      }
      return msg;
    });
    updateActiveConversationMessages(updatedMessages);
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
          height: calc(100vh - 190px);
          min-height: 520px;
        }
        @media (max-width: 960px) {
          .ai-hub-grid {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 0;
          }
        }
        .ai-chat-workspace {
          display: flex;
          flex-direction: column;
          gap: var(--sp-4);
          min-width: 0;
          height: 100%;
        }
        @media (max-width: 960px) {
          .ai-chat-workspace {
            height: calc(100vh - 200px);
            min-height: 480px;
          }
        }
        @media (max-width: 768px) {
          .ai-chat-workspace {
            height: calc(100vh - 240px);
            min-height: 400px;
          }
        }
        .ai-config-sidebar {
          display: flex;
          flex-direction: column;
          gap: var(--sp-4);
          height: 100%;
          overflow-y: auto;
          padding-right: 4px;
        }
        @media (max-width: 960px) {
          .ai-config-sidebar {
            height: auto;
            overflow-y: visible;
            padding-right: 0;
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
        .history-sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1000;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .history-sidebar-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }
        .history-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 320px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-soft);
          z-index: 1001;
          display: flex;
          flex-direction: column;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: var(--shadow-lg);
        }
        .history-sidebar.active {
          transform: translateX(0);
        }
        @media (max-width: 767px) {
          .history-sidebar {
            width: 100% !important;
            border-right: none;
          }
        }
        .history-item-card {
          padding: var(--sp-3);
          border-radius: var(--radius-sm);
          background: var(--bg-primary);
          border: 1px solid var(--border-soft);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: var(--sp-1);
          position: relative;
        }
        .history-item-card:hover {
          border-color: var(--accent);
          background: var(--bg-tertiary);
        }
        .history-item-card.active {
          border-color: var(--accent);
          background: var(--accent-subtle);
        }
        .history-item-actions {
          display: flex;
          gap: 8px;
          position: absolute;
          right: var(--sp-3);
          top: var(--sp-3);
          opacity: 0;
          transition: opacity 0.2s;
          background: var(--bg-primary);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--border-soft);
        }
        .history-item-card:hover .history-item-actions {
          opacity: 1;
        }
        .history-item-action-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .history-item-action-btn:hover {
          color: var(--accent);
        }
        .history-item-action-btn.delete:hover {
          color: var(--danger);
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
          <button 
            className="btn-icon" 
            onClick={() => setIsHistoryOpen(true)} 
            title="Histórico de Conversas" 
            style={{ color: 'var(--text-secondary)', padding: '8px' }}
          >
            <History size={16} />
          </button>
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
        <div className="ai-chat-workspace">
          
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, border: '1px solid var(--border-soft)', background: 'var(--bg-secondary)', minHeight: 0 }}>
            
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
                <>
                  {messages.length > visibleMessagesCount && (
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 'var(--sp-2)' }}>
                      <button
                        onClick={() => setVisibleMessagesCount(prev => prev + 25)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 'var(--fs-xs)', background: 'var(--bg-tertiary)' }}
                      >
                        Carregar mensagens anteriores ({messages.length - visibleMessagesCount} restantes)
                      </button>
                    </div>
                  )}
                  {visibleMessages.map((msg) => (
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
                ))}
              </>
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
        <div className="ai-config-sidebar">
          
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
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Indisponível)</option>
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
                {statusError ? (
                  <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                    <AlertCircle size={12} />
                    <span>{statusError}</span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              
              {/* controlled warning for unimplemented providers/models */}
              {providerSettings.provider !== 'openai' && (
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

      {/* Slide-over/Modal History Panel */}
      <div 
        className={`history-sidebar-overlay ${isHistoryOpen ? 'active' : ''}`} 
        onClick={() => setIsHistoryOpen(false)}
      />
      <div className={`history-sidebar ${isHistoryOpen ? 'active' : ''}`}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-4)', borderBottom: '1px solid var(--border-soft)' }}>
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--accent)" /> Histórico
          </h3>
          <button className="btn-icon" onClick={() => setIsHistoryOpen(false)} style={{ padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Action button "Nova Conversa" */}
        <div style={{ padding: 'var(--sp-4) var(--sp-4) var(--sp-2)' }}>
          <button
            onClick={handleNewConversation}
            className="btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: 'var(--fs-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Sparkles size={14} /> Nova Conversa
          </button>
        </div>

        {/* Filter Toggle for Archived */}
        <div style={{ padding: '0 var(--sp-4)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)', marginBottom: 'var(--sp-3)' }}>
            <button
              onClick={() => setShowArchived(false)}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: 'var(--fs-xs)',
                fontWeight: !showArchived ? 600 : 400,
                color: !showArchived ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: !showArchived ? '2px solid var(--accent)' : 'none',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Ativas
            </button>
            <button
              onClick={() => setShowArchived(true)}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: 'var(--fs-xs)',
                fontWeight: showArchived ? 600 : 400,
                color: showArchived ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: showArchived ? '2px solid var(--accent)' : 'none',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Arquivadas
            </button>
          </div>
        </div>

        {/* List of Conversations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', overflowY: 'auto', flex: 1, padding: '0 var(--sp-4) var(--sp-4)' }}>
          {sortedConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
              Nenhuma conversa encontrada.
            </div>
          ) : (
            sortedConversations.map(c => {
              const isRenaming = renamingId === c.id;
              const isCurrent = currentConversationId === c.id;
              
              return (
                <div
                  key={c.id}
                  className={`history-item-card ${isCurrent ? 'active' : ''}`}
                  onClick={() => {
                    if (!isRenaming) {
                      setCurrentConversationId(c.id);
                      setIsHistoryOpen(false);
                    }
                  }}
                  style={{ position: 'relative' }}
                >
                  {isRenaming ? (
                    <div style={{ display: 'flex', gap: '4px', width: '100%' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={renameTitle}
                        onChange={e => setRenameTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleRenameConversation(c.id, renameTitle);
                            setRenamingId(null);
                          } else if (e.key === 'Escape') {
                            setRenamingId(null);
                          }
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: '4px',
                          color: 'var(--text-primary)',
                          fontSize: 'var(--fs-xs)',
                          padding: '4px 8px',
                          outline: 'none'
                        }}
                      />
                      <button
                        className="btn-primary"
                        onClick={() => {
                          handleRenameConversation(c.id, renameTitle);
                          setRenamingId(null);
                        }}
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Title & Pin indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', paddingRight: '70px' }}>
                        {c.pinned && <span style={{ color: 'var(--accent)' }}>📌</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title || 'Nova Conversa'}
                        </span>
                      </div>
                      
                      {/* Sub-info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)' }}>
                        <span>{getRelativeDateLabel(c.updatedAt)}</span>
                        <span>{c.messageCount} {c.messageCount === 1 ? 'msg' : 'msgs'}</span>
                      </div>
                      
                      {/* Provider & Model Badges */}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                        <span style={{ fontSize: '9px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '3px' }}>
                          {PROVIDER_LABELS[c.provider] || c.provider}
                        </span>
                        <span style={{ fontSize: '9px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', padding: '1px 5px', borderRadius: '3px' }}>
                          {c.model}
                        </span>
                      </div>

                      {/* Hover actions */}
                      <div className="history-item-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="history-item-action-btn"
                          title={c.pinned ? "Desfixar" : "Fixar"}
                          onClick={() => handleTogglePin(c.id)}
                          style={{ color: c.pinned ? 'var(--accent)' : 'inherit' }}
                        >
                          <Pin size={12} style={{ transform: c.pinned ? 'rotate(45deg)' : 'none' }} />
                        </button>
                        <button
                          className="history-item-action-btn"
                          title={c.archived ? "Desarquivar" : "Arquivar"}
                          onClick={() => handleToggleArchive(c.id)}
                        >
                          <Archive size={12} />
                        </button>
                        <button
                          className="history-item-action-btn"
                          title="Renomear"
                          onClick={() => {
                            setRenamingId(c.id);
                            setRenameTitle(c.title || '');
                          }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="history-item-action-btn delete"
                          title="Excluir"
                          onClick={() => handleDeleteConversation(c.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
