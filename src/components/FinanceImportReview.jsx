import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { saveSetting } from '../lib/settingsSync';
import { saveImportDraft, clearImportDraft } from '../lib/financeSync';
import { getCurrentUser } from '../lib/supabaseClient';
import { incomeCategories, expenseCategories, expenseClasses, sources } from '../pages/Finance';
import { 
  X, Upload, Check, EyeOff, Trash2, AlertTriangle, 
  HelpCircle, Settings, Play, Save, FileText, CheckCircle, 
  TrendingUp, TrendingDown, RefreshCw, Plus, Filter, Info, Download
} from 'lucide-react';
import { formatCurrency, getToday } from '../utils/helpers';

// Default rules for the pre-processing engine
const DEFAULT_RULES = [
  { id: 'rule_ebanx', pattern: 'EBANX', field: 'reviewStatus', value: 'needs_review', notes: 'EBANX exige conciliação posterior manual' },
  { id: 'rule_cdb', pattern: 'RESGATE CDB', field: 'type', value: 'ignore', notes: 'Resgate de investimento' },
  { id: 'rule_cofrinhos', pattern: 'COFRINHOS', field: 'type', value: 'ignore', notes: 'Movimentação de cofrinho' },
  { id: 'rule_transf', pattern: 'TRANSFERENCIA', field: 'type', value: 'ignore', notes: 'Transferência interna' },
  { id: 'rule_transf_abbrev', pattern: 'TRANSF', field: 'type', value: 'ignore', notes: 'Transferência interna' },
  { id: 'rule_pix_int', pattern: 'PIX Transf', field: 'type', value: 'ignore', notes: 'Transferência interna via Pix' }
];

export default function FinanceImportReview({ onClose }) {
  const { finance, createItem } = useApp();
  const fileInputRef = useRef(null);

  // Core reconciliation states
  const [transactions, setTransactions] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importDate, setImportDate] = useState('');
  
  // Rules engine state
  const [rules, setRules] = useState([]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', field: 'type', value: 'ignore', notes: '' });
  
  // UI states
  const [activeFilter, setActiveFilter] = useState('all'); // all, approved, ignored, needs_review, duplicate
  const [hasDraft, setHasDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null);

  // Initialize rules and check for existing draft
  useEffect(() => {
    // Load rules from localStorage or seed with empty array for new user isolation
    const storedRules = localStorage.getItem('cp_finance_import_rules');
    if (storedRules) {
      try {
        const parsedRules = JSON.parse(storedRules);
        setRules(Array.isArray(parsedRules) ? parsedRules : []);
        if (!Array.isArray(parsedRules)) {
          console.warn('[Lyria Finance Import] cp_finance_import_rules não é um array. Usando [].');
        }
      } catch (e) {
        console.error('[Lyria Finance Import] Falha ao ler cp_finance_import_rules. Usando [].', e);
        setRules([]);
      }
    } else {
      setRules([]);
      saveSetting('cp_finance_import_rules', []);
    }

    // Check for draft
    const storedDraft = localStorage.getItem('cp_finance_import_draft');
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        if (draft && draft.rawData && draft.rawData.length > 0) {
          setHasDraft(true);
          setDraftInfo(draft.metadata);
        }
      } catch (e) {
        console.error('Failed to parse import draft', e);
      }
    }
  }, []);

  // Helper: Detect internal transfer patterns
  const isInternalTransfer = (description) => {
    const desc = String(description || '').toLowerCase();
    const transferKeywords = ['transferência', 'transferencia', 'transf', 'ted', 'doc', 'pix', 'movimentação', 'movimentacao', 'transfer'];
    const bankKeywords = ['itaú', 'itau', 'nubank', 'nu bank', 'mercado pago', 'mercado_pago', 'bradesco', 'santander', 'banco do brasil', 'bb', 'caixa', 'inter', 'c6'];
    
    const hasTransfer = transferKeywords.some(kw => desc.includes(kw));
    const hasBank = bankKeywords.some(kw => desc.includes(kw));
    
    return hasTransfer && hasBank;
  };

  // Helper: Normalize description for duplicate checking
  const cleanText = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // Helper: Generate deterministic duplicateKey
  const generateDupKey = (t) => {
    const cleanDesc = cleanText(t.description);
    const cleanBank = cleanText(t.sourceBank);
    const amountStr = parseFloat(String(t.amount || '0')).toFixed(2);
    return `${t.date}_${amountStr}_${cleanDesc}_${cleanBank}`;
  };

  // Pre-process transactions through rules and duplicate checks
  const preProcessTransactions = (parsedList) => {
    return parsedList.map(t => {
      // 1. Basic sanitization
      let amount = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount || '0').replace(',', '.'));
      if (isNaN(amount)) amount = 0;

      let type = t.type || 'saída';
      if (type === 'receita' || type === 'entrada') type = 'entrada';
      if (type === 'despesa' || type === 'saída') type = 'saída';

      let trans = {
        id: t.id || crypto.randomUUID(),
        date: t.date || getToday(),
        sourceBank: t.sourceBank || t.banco || 'Importado',
        accountName: t.accountName || t.conta || '',
        description: t.description || t.descricao || 'Transação Importada',
        amount: Math.abs(amount),
        type: type,
        category: t.suggestedCategory || t.categoria || '',
        source: t.suggestedSource || t.fonte || '',
        expenseClass: t.suggestedExpenseClass || t.classificacao || '',
        notes: t.notes || t.observacoes || '',
        reviewStatus: t.reviewStatus || 'pending'
      };

      // 2. Run internal transfer checks
      if (isInternalTransfer(trans.description)) {
        trans.type = 'ignore';
        trans.reviewStatus = 'ignore';
        trans.notes = 'Identificado como transferência interna';
      }

      // 3. Apply custom Rules Engine
      rules.forEach(rule => {
        const pattern = String(rule.pattern || '').toUpperCase();
        if (trans.description.toUpperCase().includes(pattern)) {
          if (rule.field === 'type') {
            trans.type = rule.value;
            if (rule.value === 'ignore') {
              trans.reviewStatus = 'ignore';
            }
          } else if (rule.field === 'reviewStatus') {
            trans.reviewStatus = rule.value;
          }
          if (rule.notes && !trans.notes) {
            trans.notes = rule.notes;
          }
        }
      });

      // 4. Generate duplicate key
      trans.duplicateKey = t.duplicateKey || generateDupKey(trans);

      // 5. Query local database history for potential duplicate
      const isDup = finance.some(existing => {
        if (existing.duplicateKey && existing.duplicateKey === trans.duplicateKey) return true;
        
        // Dynamic key generation for legacy manually-created transactions
        const existingKey = existing.duplicateKey || `${existing.date}_${parseFloat(existing.amount).toFixed(2)}_${cleanText(existing.source)}_${cleanText(existing.sourceBank)}`;
        if (existingKey === trans.duplicateKey) return true;

        // Loose field comparison fallback
        const sameDate = existing.date === trans.date;
        const sameAmount = Math.abs(existing.amount - trans.amount) < 0.01;
        const matchDesc = cleanText(existing.source).includes(cleanText(trans.description)) || cleanText(trans.description).includes(cleanText(existing.source));
        return sameDate && sameAmount && matchDesc;
      });

      if (isDup) {
        trans.isPossibleDuplicate = true;
        trans.reviewStatus = 'needs_review';
        trans.notes = '[Duplicada Potencial] Transação correspondente já existe no Finance.';
      } else {
        trans.isPossibleDuplicate = false;
      }

      // 6. Ensure default categories if empty
      if (!trans.category) {
        trans.category = trans.type === 'entrada' ? 'Outros' : 'Outros';
      }
      if (!trans.expenseClass && trans.type === 'saída') {
        trans.expenseClass = 'Variável';
      }

      // 7. Strict Safety Rule: If it requires review or is a possible duplicate, reviewStatus can NEVER be auto-approved
      if (trans.reviewStatus === 'approved' && (trans.isPossibleDuplicate || trans.reviewStatus === 'needs_review')) {
        trans.reviewStatus = 'needs_review';
      }

      return trans;
    });
  };

  // Parsing CSV File format
  const parseCSVText = (text) => {
    // Detect delimiter
    const firstLine = text.split('\n')[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const delimiter = semicolons > commas ? ';' : ',';

    const rows = [];
    let currentRow = [''];
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuote) {
        if (char === '"') {
          if (nextChar === '"') {
            currentRow[currentRow.length - 1] += '"';
            i++;
          } else {
            insideQuote = false;
          }
        } else {
          currentRow[currentRow.length - 1] += char;
        }
      } else {
        if (char === '"') {
          insideQuote = true;
        } else if (char === delimiter) {
          currentRow.push('');
        } else if (char === '\r' || char === '\n') {
          if (char === '\r' && nextChar === '\n') i++;
          rows.push(currentRow);
          currentRow = [''];
        } else {
          currentRow[currentRow.length - 1] += char;
        }
      }
    }
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map(h => cleanText(h));
    const dataList = [];

    // Map headers to supported parameters
    const headerMap = {
      id: ['id'],
      sourceBank: ['sourcebank', 'banco', 'origem', 'bank'],
      accountName: ['accountname', 'conta', 'account'],
      date: ['date', 'data', 'vencimento'],
      description: ['description', 'descricao', 'descrição', 'historico', 'detalhe'],
      amount: ['amount', 'valor', 'quantia'],
      type: ['type', 'tipo', 'operacao'],
      suggestedCategory: ['suggestedcategory', 'categoria', 'category'],
      suggestedSource: ['suggestedsource', 'fonte', 'atividade', 'source'],
      suggestedExpenseClass: ['suggestedexpenseclass', 'classificacao', 'classificação', 'classe'],
      notes: ['notes', 'observacoes', 'observações', 'nota'],
      duplicateKey: ['duplicatekey', 'chave_duplicada'],
      reviewStatus: ['reviewstatus', 'status']
    };

    const getHeaderIndex = (fields) => {
      return headers.findIndex(h => fields.includes(h));
    };

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
      
      const obj = {};
      Object.keys(headerMap).forEach(key => {
        const idx = getHeaderIndex(headerMap[key]);
        if (idx !== -1 && row[idx] !== undefined) {
          obj[key] = row[idx].trim();
        }
      });
      dataList.push(obj);
    }

    return dataList;
  };

  // Handle file import upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportDate(new Date().toLocaleString('pt-BR'));

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;

      try {
        let parsed = [];
        if (file.name.endsWith('.json')) {
          const loaded = JSON.parse(text);
          if (Array.isArray(loaded)) {
            parsed = loaded;
          } else if (loaded.transactions && Array.isArray(loaded.transactions)) {
            parsed = loaded.transactions;
          } else if (loaded.finance && Array.isArray(loaded.finance)) {
            parsed = loaded.finance;
          } else {
            alert('Formato de arquivo JSON inválido. Deve ser um array de transações ou conter a chave "transactions".');
            return;
          }
        } else {
          parsed = parseCSVText(text);
        }

        if (parsed.length === 0) {
          alert('Nenhuma transação encontrada no arquivo.');
          return;
        }

        const processed = preProcessTransactions(parsed);
        setTransactions(processed);
        setHasDraft(false); // Reset draft notification
      } catch (err) {
        console.error(err);
        alert('Erro ao processar o arquivo. Verifique a estrutura.');
      }
    };
    reader.readAsText(file);
  };

  // Draft handlers
  const loadDraft = () => {
    const storedDraft = localStorage.getItem('cp_finance_import_draft');
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft);
        if (!draft || !Array.isArray(draft.rawData)) {
          alert('Rascunho de importação inválido. Ele será ignorado.');
          localStorage.removeItem('cp_finance_import_draft');
          setHasDraft(false);
          setDraftInfo(null);
          return;
        }
        setTransactions(draft.rawData);
        setFileName(draft.metadata?.uploadedFileName || '');
        setImportDate(draft.metadata?.importDate || '');
        setHasDraft(false);
      } catch (e) {
        console.error('[Lyria Finance Import] Falha ao ler rascunho. Removendo.', e);
        localStorage.removeItem('cp_finance_import_draft');
        setHasDraft(false);
        setDraftInfo(null);
      }
    }
  };

  const discardDraft = () => {
    localStorage.removeItem('cp_finance_import_draft');
    const user = getCurrentUser();
    if (user) {
      clearImportDraft(user);
    }
    setHasDraft(false);
    setDraftInfo(null);
  };

  const saveDraft = () => {
    if (transactions.length === 0) return;

    const metadata = {
      uploadedFileName: fileName,
      importDate: importDate,
      totalRows: transactions.length,
      approvedRows: transactions.filter(t => t.reviewStatus === 'approved').length,
      ignoredRows: transactions.filter(t => t.reviewStatus === 'ignore' || t.type === 'ignore').length,
      duplicateRows: transactions.filter(t => t.isPossibleDuplicate).length,
      reviewProgressPercentage: Math.round(
        ((transactions.filter(t => t.reviewStatus === 'approved' || t.reviewStatus === 'ignore').length) / transactions.length) * 100
      )
    };

    const draft = {
      metadata,
      rawData: transactions
    };

    localStorage.setItem('cp_finance_import_draft', JSON.stringify(draft));
    const user = getCurrentUser();
    if (user) {
      saveImportDraft(user, draft);
    }
    alert('Rascunho de conciliação salvo com sucesso!');
  };

  // Apply imports safely
  const handleFinalImport = () => {
    const approved = transactions.filter(t => t.reviewStatus === 'approved' && t.type !== 'ignore');
    
    if (approved.length === 0) {
      alert('Nenhuma transação aprovada para importação.');
      return;
    }

    const confirmMsg = `Deseja importar ${approved.length} transações aprovadas para o histórico de Finanças?`;
    if (!confirm(confirmMsg)) return;

    approved.forEach(t => {
      const entry = {
        type: t.type, // entrada or saída
        amount: parseFloat(t.amount),
        category: t.category,
        expenseClass: t.type === 'saída' ? t.expenseClass : '',
        subcategory: 'Conciliação',
        source: t.source || t.description,
        date: t.date,
        notes: t.notes,
        // Import Metadata
        originalDescription: t.description,
        sourceBank: t.sourceBank,
        accountName: t.accountName,
        duplicateKey: t.duplicateKey,
        importedFrom: `Import Review - ${getToday()}`
      };
      
      createItem('finance', entry);
    });

    // Clear draft and exit
    localStorage.removeItem('cp_finance_import_draft');
    const user = getCurrentUser();
    if (user) {
      clearImportDraft(user);
    }
    alert(`${approved.length} transações importadas com sucesso!`);
    onClose();
  };

  // Row inline edit helper
  const updateRow = (id, field, value) => {
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t;

      let updated = { ...t, [field]: value };
      
      // Auto-update category selections if switching Type
      if (field === 'type') {
        if (value === 'ignore') {
          updated.reviewStatus = 'ignore';
        } else if (updated.reviewStatus === 'ignore') {
          updated.reviewStatus = 'pending';
        }

        // Adjust category presets
        if (value === 'entrada') {
          updated.category = 'Outros';
          updated.expenseClass = '';
        } else if (value === 'saída') {
          updated.category = 'Outros';
          updated.expenseClass = 'Variável';
        }
      }

      // If user manually changes status to approved
      if (field === 'reviewStatus' && value === 'approved') {
        if (updated.type === 'ignore') {
          updated.type = 'saída'; // default back to despesa
        }
      }

      return updated;
    }));
  };

  const deleteRow = (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Bulk operations
  const approveAllDuplicates = () => {
    setTransactions(prev => prev.map(t => 
      t.isPossibleDuplicate ? { ...t, reviewStatus: 'approved' } : t
    ));
  };

  const ignoreAllDuplicates = () => {
    setTransactions(prev => prev.map(t => 
      t.isPossibleDuplicate ? { ...t, reviewStatus: 'ignore', type: 'ignore' } : t
    ));
  };

  const approveAllClean = () => {
    setTransactions(prev => prev.map(t => 
      (!t.isPossibleDuplicate && t.reviewStatus !== 'needs_review' && t.type !== 'ignore')
        ? { ...t, reviewStatus: 'approved' } 
        : t
    ));
  };

  // Live summaries calculations
  const metrics = useMemo(() => {
    const total = transactions.length;
    const approved = transactions.filter(t => t.reviewStatus === 'approved').length;
    const ignored = transactions.filter(t => t.reviewStatus === 'ignore' || t.type === 'ignore').length;
    const needsReview = transactions.filter(t => t.reviewStatus === 'needs_review').length;
    const duplicates = transactions.filter(t => t.isPossibleDuplicate).length;

    // Financial totals of APPROVED items
    const approvedIncome = transactions
      .filter(t => t.reviewStatus === 'approved' && t.type === 'entrada')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const approvedExpense = transactions
      .filter(t => t.reviewStatus === 'approved' && t.type === 'saída')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    return { total, approved, ignored, needsReview, duplicates, approvedIncome, approvedExpense };
  }, [transactions]);

  // Filtering list
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (activeFilter === 'approved') return t.reviewStatus === 'approved';
      if (activeFilter === 'ignored') return t.reviewStatus === 'ignore' || t.type === 'ignore';
      if (activeFilter === 'needs_review') return t.reviewStatus === 'needs_review';
      if (activeFilter === 'duplicate') return t.isPossibleDuplicate;
      return t.reviewStatus !== 'ignore' && t.type !== 'ignore'; // 'all' = tudo que ainda precisa de atenção
    });
  }, [transactions, activeFilter]);

  // Custom rules handlers
  const handleAddRule = () => {
    if (!newRule.pattern) return;
    const rule = {
      id: crypto.randomUUID(),
      pattern: newRule.pattern,
      field: newRule.field,
      value: newRule.value,
      notes: newRule.notes || `Configurado: ${newRule.pattern}`
    };

    const updated = [...rules, rule];
    setRules(updated);
    saveSetting('cp_finance_import_rules', updated);
    setNewRule({ pattern: '', field: 'type', value: 'ignore', notes: '' });
  };

  const handleDeleteRule = (id) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    saveSetting('cp_finance_import_rules', updated);
  };

  const handleDownloadAISample = () => {
    const sample = {
      initialBalance: 5000.00,
      importRules: [
        {
          id: "rule_ebanx",
          pattern: "EBANX",
          field: "reviewStatus",
          value: "needs_review",
          notes: "EBANX exige conciliação posterior manual"
        },
        {
          id: "rule_cdb",
          pattern: "RESGATE CDB",
          field: "type",
          value: "ignore",
          notes: "Resgate de investimento"
        },
        {
          id: "rule_cofrinhos",
          pattern: "COFRINHOS",
          field: "type",
          value: "ignore",
          notes: "Movimentação de cofrinho"
        },
        {
          id: "rule_transf",
          pattern: "TRANSFERENCIA",
          field: "type",
          value: "ignore",
          notes: "Transferência interna"
        }
      ],
      fixedCosts: [
        {
          id: "fc_rent_2026",
          title: "Aluguel Residencial",
          amount: 1200.00,
          recurrence: "mensal",
          dueDay: "10",
          category: "Moradia",
          notes: "Pago via transferência",
          paidPeriods: ["2026-05", "2026-06"],
          skippedPeriods: ["2026-04"]
        }
      ],
      transactions: [
        {
          id: "tx_abc_123",
          type: "saída",
          amount: 45.90,
          category: "Alimentação",
          expenseClass: "Variável",
          subcategory: "Restaurante",
          source: "iFood Delivery",
          date: "2026-06-15",
          notes: "Jantar de confraternização",
          originalDescription: "IFOOD *RESTAURANTE SAO PAULO",
          sourceBank: "Nubank",
          accountName: "Conta Corrente",
          duplicateKey: "2026-06-15_45.90_iFood_Nubank",
          importedFrom: "nubank_extrato.json",
          reviewStatus: "approved"
        },
        {
          id: "tx_xyz_987",
          type: "entrada",
          amount: 3500.00,
          category: "Receita",
          expenseClass: "",
          subcategory: "Salário",
          source: "Google DeepMind",
          date: "2026-06-01",
          notes: "Salário mensal",
          originalDescription: "TED RECEBIDA GOOGLE DEEPMIND",
          sourceBank: "Itaú",
          accountName: "Conta Salário",
          duplicateKey: "2026-06-01_3500.00_Google_Itau",
          importedFrom: "itau_extrato.csv",
          reviewStatus: "approved"
        }
      ]
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_importacao_financeira.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMyRules = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minhas_regras_importacao.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportRulesFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed)) {
          alert('Arquivo de regras inválido. O arquivo deve conter um array JSON de regras.');
          return;
        }
        
        // Validate and clean each rule
        const validated = parsed.map((rule, idx) => {
          if (!rule.pattern) {
            throw new Error(`Regra #${idx + 1} não contém o campo "pattern".`);
          }
          return {
            id: rule.id || `imported_${crypto.randomUUID()}_${idx}`,
            pattern: String(rule.pattern),
            field: rule.field === 'reviewStatus' ? 'reviewStatus' : 'type',
            value: String(rule.value),
            notes: rule.notes ? String(rule.notes) : ''
          };
        });

        setRules(validated);
        saveSetting('cp_finance_import_rules', validated);
        alert(`${validated.length} regras importadas com sucesso!`);
      } catch (err) {
        alert(`Erro ao ler arquivo de regras: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleDownloadAIImportExample = () => {
    const example = {
      _metadata: {
        app: "Lyria",
        exportado_em: new Date().toISOString(),
        versao_backup: "1.0"
      },
      initialBalance: 15000.00,
      importRules: [
        {
          id: "rule_example_1",
          pattern: "META ADS",
          field: "reviewStatus",
          value: "approved",
          notes: "Auto-aprovar anúncios recorrentes"
        }
      ],
      fixedCosts: [
        {
          id: "fixed_example_1",
          title: "Aluguel",
          amount: 2500.00,
          recurrence: "mensal",
          dueDay: 5,
          category: "Aluguel",
          notes: "Aluguel do escritório",
          paidPeriods: ["2026-05", "2026-06"],
          skippedPeriods: []
        }
      ],
      transactions: [
        {
          id: "trans_example_1",
          type: "saída",
          amount: 120.50,
          category: "Marketing",
          expenseClass: "Variável",
          subcategory: "Tráfego Pago",
          source: "Anúncios Meta",
          date: "2026-06-15",
          notes: "Compra de tráfego para campanha",
          originalDescription: "PGTO META ADS 12345",
          sourceBank: "Nubank",
          accountName: "Corrente",
          duplicateKey: "2026-06-15_120.50_pgtometaads12345_nubank",
          importedFrom: "nubank_statement.csv",
          reviewStatus: "approved"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(example, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exemplo_importacao_financeira.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="import-review-overlay">
      <div className="import-review-container">
        
        {/* Header */}
        <div className="import-review-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--fs-lg)', color: 'var(--text-primary)', margin: 0 }}>
              <FileText size={20} className="text-accent" />
              Conciliação e Importação Financeira
            </h2>
            {fileName && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                Arquivo: <strong>{fileName}</strong> carregado em {importDate}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleDownloadAIImportExample} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> Baixar JSON de exemplo para IA
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRulesModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Settings size={14} /> Regras
            </button>
            <button className="btn-icon btn-ghost" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="import-review-body">
          {transactions.length === 0 ? (
            /* Upload View / Draft Recovery */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 'var(--sp-6)',
              textAlign: 'center',
              padding: 'var(--sp-12)'
            }}>
              
              {hasDraft && draftInfo && (
                <div style={{
                  background: 'linear-gradient(145deg, var(--bg-secondary), rgba(77, 141, 255, 0.02))',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--sp-5) var(--sp-6)',
                  maxWidth: '560px',
                  width: '100%',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                }}>
                  <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
                    <Info size={16} className="text-accent" />
                    Rascunho de Conciliação Pendente
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    <div>Arquivo: <strong style={{ color: 'var(--text-primary)' }}>{draftInfo.uploadedFileName}</strong></div>
                    <div>Data do rascunho: <span>{draftInfo.importDate}</span></div>
                    <div>Total de transações: <span>{draftInfo.totalRows}</span></div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span className="text-success">Aprovadas: {draftInfo.approvedRows}</span>
                      <span className="text-secondary">Ignoradas: {draftInfo.ignoredRows}</span>
                      <span className="text-warning">Duplicadas: {draftInfo.duplicateRows}</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${draftInfo.reviewProgressPercentage}%`, height: '100%', background: 'var(--accent)' }} />
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10px' }}>Progresso da revisão: {draftInfo.reviewProgressPercentage}%</div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={discardDraft} style={{ color: 'var(--danger)' }}>
                      Descartar Rascunho
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={loadDraft}>
                      Retomar Revisão
                    </button>
                  </div>
                </div>
              )}

              <div style={{
                border: '2px dashed var(--border-strong)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--sp-10)',
                maxWidth: '480px',
                width: '100%',
                cursor: 'pointer',
                background: 'rgba(25, 30, 40, 0.2)',
                transition: 'border-color var(--transition-base)'
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const event = { target: { files: [file] } };
                  handleFileUpload(event);
                }
              }}>
                <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-4)', marginInline: 'auto' }} />
                <h4 style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Arraste seu extrato bancário aqui
                </h4>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-4)' }}>
                  Suporta arquivos formatados em <strong>.JSON</strong> ou <strong>.CSV</strong> pré-processados.
                </p>
                <button className="btn btn-secondary btn-sm" style={{ pointerEvents: 'none' }}>
                  Selecionar Arquivo
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".json,.csv" 
                  style={{ display: 'none' }} 
                />
              </div>

            </div>
          ) : (
            /* Review Workspace */
            <>
              {/* Dynamic Live Summary Grid */}
              <div className="import-summary-grid">
                <div className="import-summary-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total de Linhas</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)' }}>{metrics.total}</span>
                </div>
                <div className="import-summary-card accent-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Aprovados</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--accent)' }}>{metrics.approved}</span>
                </div>
                <div className="import-summary-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Ignorados</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-subtle)' }}>{metrics.ignored}</span>
                </div>
                <div className="import-summary-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Requer Revisão</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: '#74b9ff' }}>{metrics.needsReview}</span>
                </div>
                <div className="import-summary-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Duplicatas</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--warning)' }}>{metrics.duplicates}</span>
                </div>
                <div className="import-summary-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Receitas Aprovadas</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--income)' }}>{formatCurrency(metrics.approvedIncome)}</span>
                </div>
                <div className="import-summary-card">
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Despesas Aprovadas</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--expense)' }}>{formatCurrency(metrics.approvedExpense)}</span>
                </div>
              </div>

              {/* Bulk Actions Panel */}
              {metrics.duplicates > 0 && (
                <div style={{
                  background: 'rgba(246, 196, 83, 0.05)',
                  border: '1px solid rgba(246, 196, 83, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px var(--sp-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} className="text-warning" />
                    <span>Detectamos <strong>{metrics.duplicates} possíveis duplicatas</strong> já presentes no Finance.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={ignoreAllDuplicates} style={{ fontSize: '10px', padding: '4px 10px' }}>
                      Ignorar Todas
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={approveAllDuplicates} style={{ fontSize: '10px', padding: '4px 10px', color: 'var(--warning)', borderColor: 'rgba(246, 196, 83, 0.3)' }}>
                      Aprovar Manualmente
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Filters and Action Control */}
              <div className="import-filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Filter size={12} style={{ color: 'var(--text-tertiary)' }} />
                  <button className={`import-filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
                    Todos ({transactions.length - metrics.ignored})
                  </button>
                  <button className={`import-filter-btn ${activeFilter === 'approved' ? 'active' : ''}`} onClick={() => setActiveFilter('approved')}>
                    Aprovados ({metrics.approved})
                  </button>
                  <button className={`import-filter-btn ${activeFilter === 'ignored' ? 'active' : ''}`} onClick={() => setActiveFilter('ignored')}>
                    Ignorados ({metrics.ignored})
                  </button>
                  <button className={`import-filter-btn ${activeFilter === 'needs_review' ? 'active' : ''}`} onClick={() => setActiveFilter('needs_review')}>
                    Requer Revisão ({metrics.needsReview})
                  </button>
                  <button className={`import-filter-btn ${activeFilter === 'duplicate' ? 'active' : ''}`} onClick={() => setActiveFilter('duplicate')}>
                    Duplicados ({metrics.duplicates})
                  </button>
                </div>
                
                <button className="btn btn-secondary btn-sm" onClick={approveAllClean} style={{ fontSize: '10px', padding: '4px 8px' }}>
                  Aprovar Limpas
                </button>
              </div>

              {/* Editable reconciliation table grid */}
              <div className="import-table-wrapper">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Data</th>
                      <th style={{ width: '100px' }}>Banco</th>
                      <th style={{ width: '220px' }}>Descrição</th>
                      <th style={{ width: '100px' }}>Valor</th>
                      <th style={{ width: '100px' }}>Tipo</th>
                      <th style={{ width: '140px' }}>Categoria</th>
                      <th style={{ width: '120px' }}>Atividade / Fonte</th>
                      <th style={{ width: '120px' }}>Classe</th>
                      <th>Obs</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(row => {
                      let rowClass = 'import-row-normal';
                      if (row.type === 'ignore') rowClass = 'import-row-ignore';
                      else if (row.type === 'entrada') rowClass = 'import-row-receita';
                      else if (row.type === 'saída') rowClass = 'import-row-despesa';

                      if (row.isPossibleDuplicate) rowClass += ' import-row-duplicate';
                      else if (row.reviewStatus === 'needs_review') rowClass += ' import-row-needs-review';

                      const categoriesList = row.type === 'entrada' ? incomeCategories : expenseCategories;

                      return (
                        <tr key={row.id} className={rowClass}>
                          {/* Date */}
                          <td>
                            <input 
                              type="date" 
                              className="import-input-inline" 
                              value={row.date} 
                              onChange={e => updateRow(row.id, 'date', e.target.value)} 
                            />
                          </td>

                          {/* Bank Name */}
                          <td>
                            <input 
                              type="text" 
                              className="import-input-inline" 
                              value={row.sourceBank} 
                              onChange={e => updateRow(row.id, 'sourceBank', e.target.value)} 
                            />
                          </td>

                          {/* Original Description */}
                          <td>
                            <span 
                              style={{ fontWeight: 500, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '210px' }}
                              title={row.description}
                            >
                              {row.description}
                            </span>
                          </td>

                          {/* Amount */}
                          <td>
                            <input 
                              type="number" 
                              step="0.01" 
                              className="import-input-inline" 
                              style={{ fontWeight: 600 }}
                              value={row.amount} 
                              onChange={e => updateRow(row.id, 'amount', parseFloat(e.target.value) || 0)} 
                            />
                          </td>

                          {/* Type */}
                          <td>
                            <select 
                              className="import-input-inline" 
                              value={row.type} 
                              onChange={e => updateRow(row.id, 'type', e.target.value)}
                            >
                              <option value="entrada">Receita</option>
                              <option value="saída">Despesa</option>
                              <option value="ignore">Ignorar</option>
                            </select>
                          </td>

                          {/* Category */}
                          <td>
                            {row.type !== 'ignore' ? (
                              <select 
                                className="import-input-inline" 
                                value={row.category} 
                                onChange={e => updateRow(row.id, 'category', e.target.value)}
                              >
                                <option value="" disabled>Selecione...</option>
                                {categoriesList.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            ) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                          </td>

                          {/* Activity / Source */}
                          <td>
                            {row.type !== 'ignore' ? (
                              <input 
                                className="import-input-inline" 
                                list="import-sources"
                                placeholder="dropshipping"
                                value={row.source} 
                                onChange={e => updateRow(row.id, 'source', e.target.value)}
                              />
                            ) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                          </td>

                          {/* Expense Classification */}
                          <td>
                            {row.type === 'saída' ? (
                              <select 
                                className="import-input-inline" 
                                value={row.expenseClass} 
                                onChange={e => updateRow(row.id, 'expenseClass', e.target.value)}
                              >
                                <option value="" disabled>Selecione...</option>
                                {expenseClasses.map(cls => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            ) : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                          </td>

                          {/* Notes */}
                          <td>
                            <input 
                              type="text" 
                              placeholder="Notas..."
                              className="import-input-inline" 
                              value={row.notes} 
                              onChange={e => updateRow(row.id, 'notes', e.target.value)} 
                            />
                          </td>

                          {/* Actions / Status Indicators */}
                          <td>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              
                              {/* Warning Badge for potential duplicates */}
                              {row.isPossibleDuplicate && row.reviewStatus !== 'approved' && (
                                <span 
                                  title="Transação idêntica encontrada no histórico!" 
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: 'var(--warning)',
                                    marginRight: '4px',
                                    cursor: 'help'
                                  }}
                                >
                                  <AlertTriangle size={14} />
                                </span>
                              )}

                              {/* Approved mark */}
                              <button 
                                className="btn-icon"
                                onClick={() => updateRow(row.id, 'reviewStatus', 'approved')}
                                title="Aprovar"
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  background: row.reviewStatus === 'approved' ? 'var(--success-subtle)' : 'transparent',
                                  color: row.reviewStatus === 'approved' ? 'var(--success)' : 'var(--text-tertiary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Check size={12} />
                              </button>

                              {/* Ignore mark */}
                              <button 
                                className="btn-icon"
                                onClick={() => updateRow(row.id, 'reviewStatus', 'ignore')}
                                title="Ignorar"
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  background: row.reviewStatus === 'ignore' ? 'var(--bg-hover)' : 'transparent',
                                  color: row.reviewStatus === 'ignore' ? 'var(--text-subtle)' : 'var(--text-tertiary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <EyeOff size={12} />
                              </button>

                              {/* Trash/Delete from list */}
                              <button 
                                className="btn-icon"
                                onClick={() => deleteRow(row.id)}
                                title="Remover da Lista"
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  color: 'var(--danger)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={12} />
                              </button>

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Datalists for autocompletes */}
              <datalist id="import-sources">
                {sources.map(s => <option key={s} value={s} />)}
              </datalist>

              {/* Bottom Actions footer bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border-soft)' }}>
                <button className="btn btn-secondary" onClick={() => {
                  if (confirm('Deseja descartar as alterações e fechar? (Você pode salvar um rascunho primeiro)')) onClose();
                }}>
                  Fechar sem Importar
                </button>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <button className="btn btn-secondary" onClick={saveDraft} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={14} /> Salvar Rascunho
                  </button>
                  <button className="btn btn-primary" onClick={handleFinalImport} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={14} /> Importar Selecionados ({metrics.approved})
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preprocessing Rules Manager Sub-Modal */}
      {showRulesModal && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <div className="modal" style={{ maxWidth: 650, width: '100%' }}>
            <div className="modal-header">
              <h2>Regras de Pré-processamento</h2>
              <button className="btn-icon btn-ghost" onClick={() => setShowRulesModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', lineHeight: 1.5, marginBottom: 'var(--sp-2)' }}>
                Regras são aplicadas em ordem sequencial assim que o arquivo é carregado. 
                Use para mapear termos recorrentes do extrato e evitar reclassificações repetidas.
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadAISample} style={{ fontSize: '11px', flex: 1, justifyContent: 'center' }}>
                  Baixar JSON de exemplo para IA
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadMyRules} style={{ fontSize: '11px', flex: 1, justifyContent: 'center' }} disabled={rules.length === 0}>
                  Baixar minhas regras
                </button>
                <label className="btn btn-secondary btn-sm" style={{ fontSize: '11px', flex: 1, justifyContent: 'center', cursor: 'pointer', margin: 0 }}>
                  Importar regras
                  <input type="file" accept=".json" onChange={handleImportRulesFile} style={{ display: 'none' }} />
                </label>
              </div>

              {/* List of active rules */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 220, overflowY: 'auto', paddingRight: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Regras Ativas ({rules.length})</span>
                {rules.map(rule => (
                  <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px var(--sp-3)', background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 'var(--fs-xs)' }}>
                      Se descrição contiver <strong className="text-accent">"{rule.pattern}"</strong> 
                      &nbsp;&rarr;&nbsp; 
                      definir <strong>{rule.field === 'type' ? 'Tipo' : 'Status'}</strong> para <span style={{ color: rule.value === 'ignore' ? 'var(--text-subtle)' : 'var(--accent)' }}>"{rule.value}"</span>
                      {rule.notes && <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{rule.notes}</div>}
                    </div>
                    <button className="btn-icon btn-ghost" onClick={() => handleDeleteRule(rule.id)} style={{ color: 'var(--danger)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ height: '1px', background: 'var(--border-soft)', margin: 'var(--sp-2) 0' }} />

              {/* Add New Rule Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Nova Regra</span>
                
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Termo de Busca (Case-Insensitive)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: EBANX"
                      value={newRule.pattern} 
                      onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} 
                    />
                  </div>
                  <div style={{ width: '130px' }}>
                    <label className="form-label">Campo Alvo</label>
                    <select 
                      className="form-select"
                      value={newRule.field} 
                      onChange={e => setNewRule({ ...newRule, field: e.target.value, value: e.target.value === 'type' ? 'ignore' : 'needs_review' })}
                    >
                      <option value="type">Tipo</option>
                      <option value="reviewStatus">Status</option>
                    </select>
                  </div>
                  <div style={{ width: '140px' }}>
                    <label className="form-label">Ação / Valor</label>
                    <select 
                      className="form-select"
                      value={newRule.value} 
                      onChange={e => setNewRule({ ...newRule, value: e.target.value })}
                    >
                      {newRule.field === 'type' ? (
                        <>
                          <option value="ignore">Ignorar (Transf)</option>
                          <option value="entrada">Forçar Receita</option>
                          <option value="saída">Forçar Despesa</option>
                        </>
                      ) : (
                        <>
                          <option value="needs_review">Requer Inspecionar</option>
                          <option value="approved">Auto-Aprovar</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Observações Opcionais</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: Movimentação interna ou despesa recorrente"
                    value={newRule.notes} 
                    onChange={e => setNewRule({ ...newRule, notes: e.target.value })} 
                  />
                </div>

                <button className="btn btn-primary" onClick={handleAddRule} style={{ display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-end' }}>
                  <Plus size={14} /> Adicionar Regra
                </button>

              </div>

            </div>
            <div className="modal-actions" style={{ padding: 'var(--sp-4) var(--sp-6)', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={() => setShowRulesModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
