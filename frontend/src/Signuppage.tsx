import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthScreen'; 
import type { ExplorerProfile } from './types'; 

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  // Pull goBack from the useAuth hook
  const { signup, goBack } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    characterType: 'squire' as ExplorerProfile['characterType']
  });
  
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Player Name is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Name must be at least 3 characters';
    }

    if (!formData.password) {
      newErrors.password = 'Secret Code is required';
    } else if (formData.password.length < 4) {
      newErrors.password = 'Code must be at least 4 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Codes do not match';
    }

    if (!agreedToPrivacy) {
      newErrors.privacy = 'You must agree to the Data Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await signup(formData.username, formData.password, formData.characterType);
      navigate('/home');
    } catch (error) {
      setErrors({ submit: 'Signup failed. This Player Name may already be taken.' });
    } finally {
      setIsLoading(false);
    }
  };

  const characters: ExplorerProfile['characterType'][] = ['squire', 'knight', 'duke', 'lord'];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.95) 0%, rgba(30, 36, 47, 0.95) 100%)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '480px',
        width: '100%',
        border: '1px solid #30363d',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        
        {/* ADDED: BACK BUTTON */}
        <div style={{ width: '100%', marginBottom: '15px', textAlign: 'left' }}>
          <button 
            onClick={goBack} 
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            ← Back to Home
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
          <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>Begin Your Quest</h1>
          <p style={{ color: '#8b949e', fontSize: '14px' }}>Choose your path in CodeSense</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Player Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Player Name</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. CoderKnight"
              style={inputStyle(!!errors.username)}
            />
            {errors.username && <p style={errorTextStyle}>{errors.username}</p>}
          </div>

          {/* Character Type Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Choose Your Rank</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {characters.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, characterType: type })}
                  style={{
                    padding: '10px',
                    background: formData.characterType === type ? 'rgba(100, 181, 246, 0.2)' : 'rgba(13, 17, 23, 0.6)',
                    border: `1px solid ${formData.characterType === type ? '#64b5f6' : '#30363d'}`,
                    borderRadius: '8px',
                    color: formData.characterType === type ? '#64b5f6' : '#8b949e',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Secret Code (Password) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Secret Code</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create your entry code"
              style={inputStyle(!!errors.password)}
            />
            {errors.password && <p style={errorTextStyle}>{errors.password}</p>}
          </div>

          {/* Confirm Code */}
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Confirm Code</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your code"
              style={inputStyle(!!errors.confirmPassword)}
            />
            {errors.confirmPassword && <p style={errorTextStyle}>{errors.confirmPassword}</p>}
          </div>

          {/* Privacy Toggle */}
          <div style={privacyBoxStyle(!!errors.privacy)}>
             <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', color: '#c9d1d9' }}>
               <input 
                 type="checkbox" 
                 checked={agreedToPrivacy} 
                 onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                 style={{ marginRight: '10px', marginTop: '3px' }}
               />
               <span style={{ fontSize: '13px', lineHeight: '1.4' }}>
                 I agree to the <button type="button" onClick={() => setShowPrivacyModal(true)} style={linkButtonStyle}>Data Privacy Policy</button>
               </span>
             </label>
          </div>

          {errors.submit && <p style={{...errorTextStyle, marginBottom: '15px', textAlign: 'center'}}>{errors.submit}</p>}

          <button
            type="submit"
            disabled={isLoading}
            style={submitButtonStyle(isLoading)}
          >
            {isLoading ? 'INITIATING...' : 'START JOURNEY'}
          </button>
        </form>
      </div>

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ color: 'white', fontSize: '24px', marginBottom: '15px' }}>Privacy Agreement</h2>
            <div style={{ color: '#8b949e', fontSize: '14px', lineHeight: '1.6', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }}>
              <p>By creating an account with CodeSense, you agree to the following:</p>
              <p><strong>1. Progress Tracking:</strong> We store your code analysis results, earned XP, and rank to provide a continuous learning experience.</p>
              <p><strong>2. Data Isolation:</strong> Your code is stored in secure, isolated storage. We do not share your private source code with other users.</p>
              <p><strong>3. Analytics:</strong> We use anonymized performance metrics to improve our C++ teaching tools.</p>
            </div>
            <button onClick={() => setShowPrivacyModal(false)} style={modalCloseButtonStyle}>I UNDERSTAND</button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Styles unchanged ---
const labelStyle = { display: 'block', color: '#8b949e', fontSize: '13px', fontWeight: '600', marginBottom: '8px' };
const errorTextStyle: React.CSSProperties = { color: '#ff4444', fontSize: '11px', marginTop: '4px' };
const linkButtonStyle = { background: 'none', border: 'none', color: '#64b5f6', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle = { background: '#161b22', padding: '30px', borderRadius: '16px', border: '1px solid #30363d', maxWidth: '500px', width: '90%' };
const modalCloseButtonStyle = { width: '100%', padding: '12px', background: '#4caf50', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '700', cursor: 'pointer' };

const inputStyle = (hasError: boolean) => ({
  width: '100%', padding: '12px 16px', background: 'rgba(13, 17, 23, 0.6)',
  border: `1px solid ${hasError ? '#ff4444' : '#30363d'}`, borderRadius: '8px', color: 'white', outline: 'none',
});

const submitButtonStyle = (loading: boolean) => ({
  width: '100%', padding: '14px', background: loading ? '#30363d' : 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
  color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
});

const privacyBoxStyle = (hasError: boolean) => ({
    background: 'rgba(100, 181, 246, 0.05)', border: `1px solid ${hasError ? '#ff4444' : '#30363d'}`,
    borderRadius: '8px', padding: '12px', marginBottom: '20px'
});