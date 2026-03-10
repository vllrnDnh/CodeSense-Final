import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthScreen';
import type { ExplorerProfile } from './types';

// ── Rank metadata ─────────────────────────────────────────────────────────────
const RANK_META: Record<
  ExplorerProfile['characterType'],
  { icon: string; color: string; desc: string }
> = {
  squire: { icon: '🛡️', color: '#8b949e', desc: 'Beginner path' },
  knight: { icon: '⚔️', color: '#58a6ff', desc: 'Intermediate' },
  duke:   { icon: '👑', color: '#e3b341', desc: 'Advanced' },
  lord:   { icon: '🌟', color: '#a371f7', desc: 'Expert' },
};

// ── Reusable field component ──────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, error, children }) => (
  <div style={{ marginBottom: 20 }}>
    <label style={{
      display: 'block',
      color: '#8b949e',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.6px',
      textTransform: 'uppercase',
      marginBottom: 8,
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {label}
    </label>
    {children}
    {error && (
      <p style={{
        color: '#f85149',
        fontSize: 11,
        marginTop: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: "'IBM Plex Mono', monospace",
      }}>
        <span>⚠</span> {error}
      </p>
    )}
  </div>
);

// ── Input style (always dark, never white) ────────────────────────────────────
const getInputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '11px 14px',
  background: '#0d1117',
  border: `1px solid ${hasError ? '#f85149' : '#30363d'}`,
  borderRadius: 8,
  color: '#e6edf3',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  // Force dark background even on autofill
  WebkitTextFillColor: '#e6edf3',
});

// ── Main component ────────────────────────────────────────────────────────────
export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup, goBack } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    confirmPassword: '',
    characterType: 'squire' as ExplorerProfile['characterType'],
  });

  const [agreedToPrivacy,   setAgreedToPrivacy]   = useState(false);
  const [showPrivacyModal,  setShowPrivacyModal]  = useState(false);
  const [errors,            setErrors]            = useState<Record<string, string>>({});
  const [isLoading,         setIsLoading]         = useState(false);
  const [focusedField,      setFocusedField]      = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!formData.username.trim())
      errs.username = 'Player name is required';
    else if (formData.username.trim().length < 3)
      errs.username = 'Name must be at least 3 characters';

    if (!formData.email.trim())
      errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = 'Please enter a valid email address';

    if (!formData.password)
      errs.password = 'Secret code is required';
    else if (formData.password.length < 8)
      errs.password = 'Code must be at least 8 characters';

    if (!formData.confirmPassword)
      errs.confirmPassword = 'Please confirm your code';
    else if (formData.password !== formData.confirmPassword)
      errs.confirmPassword = 'Codes do not match';

    if (!agreedToPrivacy)
      errs.privacy = 'You must agree to the Data Privacy Policy';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await signup(
        formData.username.trim(),
        formData.password,
        formData.email.trim(),
        formData.characterType,
      );
      navigate('/welcome');
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg === 'USERNAME_TAKEN') {
        setErrors({ username: 'This player name is already taken — try another.' });
      } else if (msg === 'EMAIL_TAKEN') {
        setErrors({ email: 'An account with this email already exists.' });
      } else if (msg === 'SIGNUP_FAILED') {
        setErrors({ submit: 'Sign-up failed. Please try again.' }); //toast message for unregistered users
      } else {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const characters: ExplorerProfile['characterType'][] = ['squire', 'knight', 'duke', 'lord'];

  // Dynamic border on focused input
  const inputStyle = (name: string, hasError: boolean): React.CSSProperties => ({
    ...getInputStyle(hasError),
    borderColor: hasError ? '#f85149' : focusedField === name ? '#58a6ff' : '#30363d',
    boxShadow: focusedField === name && !hasError ? '0 0 0 3px rgba(88,166,255,0.12)' : 'none',
  });

  const focusProps = (name: string) => ({
    onFocus: () => setFocusedField(name),
    onBlur:  () => setFocusedField(null),
  });

  return (
    <>
      {/* Global style to force dark autofill */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0d1117 inset !important;
          -webkit-text-fill-color: #e6edf3 !important;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #e6edf3;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
  minHeight: '100vh',
  width: '100%',
  background: 'radial-gradient(ellipse at 20% 50%, #0d1f12 0%, #0d1117 40%, #111827 100%)',
  display: 'block', 
  overflowY: 'auto', 
  fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
  WebkitOverflowScrolling: 'touch', 
}}>

  <div style={{
    background: 'linear-gradient(160deg, rgba(22,27,34,0.97) 0%, rgba(13,17,23,0.97) 100%)',
    borderRadius: 16,
    padding: '36px 40px',
    width: 'calc(100% - 32px)', 
    maxWidth: 500,
    margin: '40px auto', 
    border: '1px solid #21262d',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
    animation: 'fadeUp 0.3s ease-out',
  }}>

          {/* Back button */}
          <button
            onClick={goBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#484f58',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 28,
              fontFamily: "'IBM Plex Mono', monospace",
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#8b949e')}
            onMouseLeave={e => (e.currentTarget.style.color = '#484f58')}
          >
            ← Back to Home
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>🛡️</div>
            <h1 style={{
              color: '#e6edf3',
              fontSize: 26,
              fontWeight: 800,
              margin: '0 0 8px',
              letterSpacing: '-0.5px',
            }}>
              Begin Your Quest
            </h1>
            <p style={{ color: '#484f58', fontSize: 13, margin: 0 }}>
              Choose your path in CodeSense
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Player Name */}
            <Field label="Player Name" error={errors.username}>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="e.g. CoderKnight"
                autoComplete="username"
                style={inputStyle('username', !!errors.username)}
                {...focusProps('username')}
              />
            </Field>

            {/* Choose Rank */}
            <Field label="Choose Your Rank">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {characters.map(type => {
                  const meta    = RANK_META[type];
                  const active  = formData.characterType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, characterType: type }))}
                      style={{
                        padding: '10px 12px',
                        background: active ? `${meta.color}18` : 'rgba(13,17,23,0.6)',
                        border: `1px solid ${active ? meta.color : '#21262d'}`,
                        borderRadius: 8,
                        color: active ? meta.color : '#484f58',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.borderColor = `${meta.color}66`;
                          e.currentTarget.style.color = meta.color;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.borderColor = '#21262d';
                          e.currentTarget.style.color = '#484f58';
                        }
                      }}
                    >
                      <span>{meta.icon}</span>
                      <span>{type}</span>
                    </button>
                  );
                })}
              </div>
              {/* Rank description */}
              <p style={{
                color: RANK_META[formData.characterType].color,
                fontSize: 11,
                marginTop: 8,
                fontFamily: "'IBM Plex Mono', monospace",
                opacity: 0.8,
              }}>
                {RANK_META[formData.characterType].icon} {RANK_META[formData.characterType].desc} — you can change this later
              </p>
            </Field>

            {/* Email */}
            <Field label="Email Address" error={errors.email}>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="e.g. yourname@gmail.com"
                autoComplete="email"
                style={inputStyle('email', !!errors.email)}
                {...focusProps('email')}
              />
            </Field>

            {/* Secret Code */}
            <Field label="Secret Code (Password)" error={errors.password}>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                style={inputStyle('password', !!errors.password)}
                {...focusProps('password')}
              />
            </Field>

            {/* Confirm Code */}
            <Field label="Confirm Code" error={errors.confirmPassword}>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your code"
                autoComplete="new-password"
                style={inputStyle('confirmPassword', !!errors.confirmPassword)}
                {...focusProps('confirmPassword')}
              />
            </Field>

            {/* Privacy checkbox */}
            <div style={{
              background: errors.privacy ? 'rgba(248,81,73,0.06)' : 'rgba(88,166,255,0.04)',
              border: `1px solid ${errors.privacy ? '#f85149' : '#21262d'}`,
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 20,
              transition: 'border-color 0.2s',
            }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={e => {
                    setAgreedToPrivacy(e.target.checked);
                    if (e.target.checked) setErrors(prev => ({ ...prev, privacy: '' }));
                  }}
                  style={{ marginTop: 2, accentColor: '#58a6ff', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.5 }}>
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(true)}
                    style={{
                      background: 'none', border: 'none',
                      color: '#58a6ff', textDecoration: 'underline',
                      cursor: 'pointer', padding: 0,
                      font: 'inherit', fontSize: 13,
                    }}
                  >
                    Data Privacy Policy
                  </button>
                </span>
              </label>
              {errors.privacy && (
                <p style={{ color: '#f85149', fontSize: 11, margin: '6px 0 0', fontFamily: "'IBM Plex Mono', monospace" }}>
                  ⚠ {errors.privacy}
                </p>
              )}
            </div>

            {/* Submit error */}
            {errors.submit && (
              <div style={{
                background: 'rgba(248,81,73,0.08)',
                border: '1px solid rgba(248,81,73,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                color: '#f85149',
                fontSize: 13,
                textAlign: 'center',
              }}>
                ⚠ {errors.submit}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '13px',
                background: isLoading
                  ? '#21262d'
                  : 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
                color: isLoading ? '#484f58' : 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'IBM Plex Mono', monospace",
                boxShadow: isLoading ? 'none' : '0 4px 14px rgba(35,134,54,0.4)',
              }}
              onMouseEnter={e => {
                if (!isLoading) e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              {isLoading ? '⟳  Creating your account…' : 'START JOURNEY →'}
            </button>

            {/* Sign-in link */}
            <p style={{ textAlign: 'center', marginTop: 20, color: '#484f58', fontSize: 13 }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  background: 'none', border: 'none',
                  color: '#58a6ff', cursor: 'pointer',
                  padding: 0, font: 'inherit', fontSize: 13,
                  textDecoration: 'underline',
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(160deg, #161b22 0%, #0d1117 100%)',
            border: '1px solid #30363d',
            borderRadius: 14,
            padding: '28px 32px',
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
            animation: 'fadeUp 0.2s ease-out',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 20 }}>🔐</span>
              <h2 style={{ color: '#e6edf3', fontSize: 20, fontWeight: 700, margin: 0 }}>
                Data Privacy Policy
              </h2>
            </div>

            <div style={{
              color: '#8b949e', fontSize: 13, lineHeight: 1.7,
              maxHeight: 280, overflowY: 'auto',
              marginBottom: 20,
              paddingRight: 8,
            }}>
              {[
                ['📊 Progress Tracking', 'We store your code analysis results, earned XP, and rank to provide a continuous learning experience.'],
                ['🔒 Data Isolation',    'Your code is stored in secure, isolated storage. We do not share your private source code with other users.'],
                ['📈 Analytics',         'We use anonymised performance metrics to improve our C++ teaching tools. Your personal data is never sold.'],
              ].map(([title, body]) => (
                <div key={title as string} style={{ marginBottom: 14 }}>
                  <strong style={{ color: '#e6edf3', display: 'block', marginBottom: 4 }}>{title}</strong>
                  {body}
                </div>
              ))}
            </div>

            <button
              onClick={() => { setAgreedToPrivacy(true); setShowPrivacyModal(false); setErrors(prev => ({ ...prev, privacy: '' })); }}
              style={{
                width: '100%', padding: '12px',
                background: 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
                border: 'none', borderRadius: 8,
                color: 'white', fontWeight: 700, fontSize: 13,
                letterSpacing: '0.5px', cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
                boxShadow: '0 4px 14px rgba(35,134,54,0.35)',
              }}
            >
              ✓ I Understand & Agree
            </button>
            <button
              onClick={() => setShowPrivacyModal(false)}
              style={{
                width: '100%', padding: '10px',
                background: 'transparent',
                border: '1px solid #30363d', borderRadius: 8,
                color: '#484f58', fontWeight: 600, fontSize: 12,
                cursor: 'pointer', marginTop: 8,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};