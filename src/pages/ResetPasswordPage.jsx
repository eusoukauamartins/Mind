import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const LyriaIcon = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s5-3 5-8-5-10-5-10-5 5-5 10 5 8 5 8z" />
    <path d="M12 22s8-3 8-10c0-4-3-6-3-6s-1 4-5 6" />
    <path d="M12 22s-8-3-8-10c0-4 3-6 3-6s1 4 5 6" />
  </svg>
);

export default function ResetPasswordPage() {
  const { loading: authLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'invalid' | 'success'
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setStatus('invalid');
      setErrorMessage('Supabase não configurado.');
      return;
    }

    let isMounted = true;

    // 1. Inspect URL hash and query string for explicit Supabase errors
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);

    const urlError = hashParams.get('error') || searchParams.get('error');
    const urlErrorCode = hashParams.get('error_code') || searchParams.get('error_code');
    const urlErrorDesc = hashParams.get('error_description') || searchParams.get('error_description');

    if (urlError) {
      if (urlErrorCode === 'otp_expired' || urlErrorDesc?.toLowerCase().includes('expired')) {
        setErrorMessage('O link de recuperação expirou ou já foi utilizado. Solicite um novo link para continuar.');
      } else {
        const decoded = urlErrorDesc ? decodeURIComponent(urlErrorDesc.replace(/\+/g, ' ')) : 'Link de recuperação inválido ou expirado.';
        setErrorMessage(decoded);
      }
      setStatus('invalid');
      return;
    }

    // 2. Listen to onAuthStateChange for recovery session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || (newSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))) {
        setStatus('ready');
      }
    });

    // 3. Do not immediately classify as invalid: wait for auth initialization first
    if (!authLoading) {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!isMounted) return;

        if (error) {
          setStatus('invalid');
          setErrorMessage('Erro ao verificar sessão de recuperação. Solicite um novo link.');
          return;
        }

        if (session) {
          setStatus('ready');
          return;
        }

        // Check if there are tokens in the URL that Supabase might still be processing
        const hasRecoveryHash = (hashParams.has('access_token') || hash.includes('access_token=')) &&
          (hashParams.get('type') === 'recovery' || hash.includes('type=recovery'));
        const hasCode = searchParams.has('code');

        if (!hasRecoveryHash && !hasCode) {
          setStatus('invalid');
          setErrorMessage('Nenhum link ou sessão de recuperação válido encontrado. Solicite um novo link para redefinir sua senha.');
        } else {
          // Tokens are present in URL; allow a short grace period for Supabase to finish restoring
          const timer = setTimeout(() => {
            if (!isMounted) return;
            supabase.auth.getSession().then(({ data: { session: delayedSession } }) => {
              if (!isMounted) return;
              if (delayedSession) {
                setStatus('ready');
              } else {
                setStatus('invalid');
                setErrorMessage('O link de recuperação expirou ou é inválido. Solicite um novo link.');
              }
            });
          }, 2500);

          return () => clearTimeout(timer);
        }
      });
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [authLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldError('');

    // Frontend validation aligned with project & Supabase requirements
    if (!newPassword) {
      setFieldError('Informe a nova senha.');
      return;
    }

    if (newPassword.length < 6) {
      setFieldError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFieldError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setFieldError(translateError(error.message));
        setSubmitting(false);
        return;
      }

      setStatus('success');
      setSubmitting(false);

      // Sign out the recovery session so user starts fresh at the login screen
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('[ResetPassword] Sign out notification:', signOutErr);
      }

      // Automatically redirect to the Lyria login screen
      setTimeout(() => {
        window.location.href = '/';
      }, 2500);
    } catch (err) {
      setFieldError('Erro inesperado ao redefinir a senha. Tente novamente.');
      setSubmitting(false);
    }
  };

  const handleGoToLogin = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      // ignore
    }
    window.location.href = '/';
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
            Redefinição de senha
          </p>
        </div>

        {/* Card Content */}
        <div className="card" style={{
          padding: 'var(--sp-8)',
          background: 'rgba(30, 20, 50, 0.6)',
          border: '1px solid rgba(168, 85, 247, 0.15)',
          backdropFilter: 'blur(20px)',
        }}>
          {/* 1. Checking Status */}
          {status === 'checking' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--sp-4)',
              padding: 'var(--sp-4) 0',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-sm)',
            }}>
              <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent)' }} />
              <span>Verificando sessão de recuperação...</span>
            </div>
          )}

          {/* 2. Success Status */}
          {status === 'success' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 'var(--sp-4)',
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(52, 211, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
              }}>
                <CheckCircle2 size={30} />
              </div>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--sp-2)',
                }}>
                  Senha alterada com sucesso!
                </h2>
                <p style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  Sua senha foi redefinida. Redirecionando para a tela de login...
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGoToLogin}
                style={{
                  width: '100%',
                  marginTop: 'var(--sp-3)',
                  padding: 'var(--sp-3)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--sp-2)',
                }}
              >
                <span>Ir para o login agora</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* 3. Invalid or Expired Status */}
          {status === 'invalid' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 'var(--sp-4)',
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(255, 107, 107, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger)',
              }}>
                <AlertCircle size={30} />
              </div>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--sp-2)',
                }}>
                  Link inválido ou expirado
                </h2>
                <p style={{
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  {errorMessage || 'Este link de recuperação expirou ou é inválido. Por motivos de segurança, solicite um novo link de recuperação.'}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGoToLogin}
                style={{
                  width: '100%',
                  marginTop: 'var(--sp-3)',
                  padding: 'var(--sp-3)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--sp-2)',
                }}
              >
                <span>Voltar ao login / Recuperar senha</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* 4. Ready Status — Form */}
          {status === 'ready' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-2)' }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: '0 0 var(--sp-1) 0',
                }}>
                  Crie sua nova senha
                </h2>
                <p style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}>
                  Informe e confirme a nova senha de acesso à sua conta.
                </p>
              </div>

              {/* Nova senha */}
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Nova senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    style={{ paddingLeft: 36, background: 'var(--bg-input)' }}
                  />
                </div>
              </div>

              {/* Confirmar nova senha */}
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 'var(--sp-1)' }}>
                  Confirmar nova senha
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    style={{ paddingLeft: 36, background: 'var(--bg-input)' }}
                  />
                </div>
              </div>

              {/* Error Message */}
              {fieldError && (
                <div style={{
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 500,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: 'var(--danger)',
                }}>
                  {fieldError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: 'var(--sp-3)',
                  fontWeight: 600,
                  fontSize: 'var(--fs-base)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--sp-2)',
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? (
                  <span>Salvando nova senha...</span>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Redefinir senha</span>
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: 'var(--sp-2)' }}>
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    fontSize: 'var(--fs-xs)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Cancelar e voltar ao login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function translateError(msg) {
  const map = {
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'New password should be different from the old password.': 'A nova senha deve ser diferente da senha anterior.',
    'Auth session missing!': 'Sessão de recuperação expirada. Solicite um novo link.',
    'User from sub claim in JWT does not exist': 'Usuário não encontrado ou link expirado.',
    'Email link is invalid or has expired': 'Este link de recuperação expirou ou é inválido.',
    'Token has expired or is invalid': 'Este link de recuperação expirou ou é inválido.',
  };
  return map[msg] || msg || 'Erro ao redefinir a senha. Tente novamente.';
}
