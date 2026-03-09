import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthScreen';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, continueAsGuest } = useAuth();
  
  const [formData, setFormData] = useState({ playerName: '', secretCode: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(formData.playerName, formData.secretCode);
      navigate('/welcome'); 
    } catch (err) {
      setError('Invalid Player Name or Secret Code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestEntry = () => {
    continueAsGuest();
    navigate('/welcome'); 
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ width: '100%', marginBottom: '15px', textAlign: 'left' }}>
          <button 
            onClick={() => navigate('/')} 
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
            &larr; Back to Home
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '50px' }}>🔑</div>
          <h2 style={{ color: 'white', marginTop: '10px' }}>Access System</h2>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>PLAYER NAME</label>
            <input
              type="text"
              required
              style={inputStyle}
              value={formData.playerName}
              onChange={(e) => setFormData({...formData, playerName: e.target.value})}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={labelStyle}>SECRET CODE</label>
            <input
              type="password"
              required
              style={inputStyle}
              value={formData.secretCode}
              onChange={(e) => setFormData({...formData, secretCode: e.target.value})}
            />
          </div>

          {error && <p style={{ color: '#ff4444', fontSize: '13px', textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={isLoading} style={primaryBtnStyle}>
            {isLoading ? 'DECRYPTING...' : 'LOGIN'}
          </button>
        </form>

        <div style={{ margin: '20px 0', textAlign: 'center', color: '#444' }}>OR</div>

        <button onClick={handleGuestEntry} style={secondaryBtnStyle}>
          CONTINUE AS GUEST
        </button>

        <p style={{ color: '#8b949e', textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          New explorer? <span onClick={() => navigate('/signup')} style={linkStyle}>Register here</span>
        </p>
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117', padding: '20px' };
const cardStyle = { background: '#161b22', padding: '40px', borderRadius: '16px', border: '1px solid #30363d', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)' };
const labelStyle = { display: 'block', color: '#8b949e', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' as const };
const inputStyle = { width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', color: 'white', outline: 'none' };
const primaryBtnStyle = { width: '100%', padding: '12px', background: '#238636', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' as const, cursor: 'pointer' };
const secondaryBtnStyle = { width: '100%', padding: '12px', background: 'transparent', color: '#58a6ff', border: '1px solid #58a6ff', borderRadius: '8px', fontWeight: 'bold' as const, cursor: 'pointer' };
const linkStyle = { color: '#58a6ff', cursor: 'pointer', textDecoration: 'underline' };