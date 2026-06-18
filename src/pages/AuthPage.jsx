// AuthPage — Login, Register, Password Reset
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, User, ArrowRight, KeyRound } from 'lucide-react';

const LyriaIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s5-3 5-8-5-10-5-10-5 5-5 10 5 8 5 8z" />
    <path d="M12 22s8-3 8-10c0-4-3-6-3-6s-1 4-5 6" />
    <path d="M12 22s-8-3-8-10c0-4 3-6 3-6s1 4 5 6" />
  </svg>
);

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'error' | 'success', text: '...' }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setMessage({ type: 'error', text: translateError(error.message) });
        }
      } else if (mode === 'register') {
        if (password.length < 6) {
          setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, displayName);
        if (error) {
          setMessage({ type: 'error', text: translateError(error.message) });
        } else {
          setMessage({ type: 'success', text: 'Conta criada com sucesso! Você já pode usar o Lyria.' });
          // Auto-login happens via onAuthStateChange
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setMessage({ type: 'error', text: translateError(error.message) });
        } else {
          setMessage({ type: 'success', text: 'E-mail de recuperação enviado. Verifique sua caixa de entrada.' });
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro inesperado. Tente novamente.' });
    }
    setLoading(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setMessage(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: 'var(--sp-4)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Atmospheric Background */}
      <div className="atmospheric-container">
        <div className="atmospheric-glow-1" />
        <div className="atmospheric-glow-2" />
      </div>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 'var(--sp-8)',
          gap: 'var(--sp-3)',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <LyriaIcon size={32} />
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Lyria
          </h1>
          <p style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-secondary)',
            margin: 0,
            textAlign: 'center',
          }}>
            {mode === 'login' && 'Entre na sua conta para continuar'}
            {mode === 'register' && 'Crie sua conta e comece a usar'}
            {mode === 'reset' && 'Recupere o acesso à sua conta'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="card" style={{
          padding: 'var(--sp-8)',
          background: 'rgba(30, 20, 50, 0.6)',
          border: '1px solid rgba(168, 85, 247, 0.15)',
          backdropFilter: 'blur(20px)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

            {/* Display Name — Register Only */}
            {mode === 'register' && (
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Nome
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Seu nome"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{ paddingLeft: 36, background: 'var(--bg-input)' }}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 'var(--sp-1)' }}>
                E-mail
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  type="email"
                  className="form-input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ paddingLeft: 36, background: 'var(--bg-input)' }}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password — Login & Register Only */}
            {mode !== 'reset' && (
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="password"
                    className="form-input"
                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 6 : undefined}
                    style={{ paddingLeft: 36, background: 'var(--bg-input)' }}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  />
                </div>
              </div>
            )}

            {/* Forgot Password Link — Login Only */}
            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 'var(--fs-xs)',
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {/* Message */}
            {message && (
              <div style={{
                padding: 'var(--sp-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                background: message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(16, 185, 129, 0.1)',
                border: `1px solid ${message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(16, 185, 129, 0.2)'}`,
                color: message.type === 'error' ? 'var(--danger)' : 'var(--success)',
              }}>
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                padding: 'var(--sp-3)',
                fontWeight: 600,
                fontSize: 'var(--fs-base)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--sp-2)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span>Aguarde...</span>
              ) : (
                <>
                  {mode === 'login' && <><ArrowRight size={16} /> Entrar</>}
                  {mode === 'register' && <><Sparkles size={16} /> Criar Conta</>}
                  {mode === 'reset' && <><KeyRound size={16} /> Enviar E-mail</>}
                </>
              )}
            </button>
          </form>

          {/* Mode Switch */}
          <div style={{
            marginTop: 'var(--sp-6)',
            textAlign: 'center',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-2)',
          }}>
            {mode === 'login' && (
              <span>
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                >
                  Criar conta
                </button>
              </span>
            )}
            {mode === 'register' && (
              <span>
                Já tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                >
                  Entrar
                </button>
              </span>
            )}
            {mode === 'reset' && (
              <span>
                Lembrou a senha?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 'inherit' }}
                >
                  Voltar ao login
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Translate common Supabase auth error messages to pt-BR
 */
function translateError(msg) {
  const map = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Signup requires a valid password': 'Informe uma senha válida.',
    'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
    'For security purposes, you can only request this once every 60 seconds': 'Aguarde 60 segundos antes de tentar novamente.',
  };
  return map[msg] || msg || 'Erro desconhecido.';
}
