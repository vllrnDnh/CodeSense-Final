import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthScreen';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();

  const handleGuestAccess = () => {
    continueAsGuest();
    navigate('/home');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        fontSize: '100px',
        opacity: 0.05,
        animation: 'float 6s ease-in-out infinite'
      }}>
        💻
      </div>
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '15%',
        fontSize: '80px',
        opacity: 0.05,
        animation: 'float 8s ease-in-out infinite reverse'
      }}>
        🧠
      </div>

      <div style={{
        maxWidth: '800px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Logo */}
        <div style={{
          fontSize: '80px',
          marginBottom: '24px',
          animation: 'float 3s ease-in-out infinite'
        }}>
          🧠
        </div>

        {/* Title */}
        <h1 style={{
          color: 'white',
          fontSize: '56px',
          fontWeight: '800',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, #64b5f6 0%, #4caf50 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.5px'
        }}>
          CodeSense
        </h1>

        {/* Subtitle */}
        <p style={{
          color: '#8b949e',
          fontSize: '20px',
          marginBottom: '48px',
          lineHeight: '1.6'
        }}>
          Learn C++ security and best practices through interactive code analysis.
          <br />
          Master safe coding with real-time feedback.
        </p>

        {/* Feature Highlights */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginBottom: '48px'
        }}>
          <div style={{
            background: 'rgba(22, 27, 34, 0.8)',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '24px',
            transition: 'transform 0.2s ease'
          }}
          className="feature-card">
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔬</div>
            <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '8px' }}>
              Sandbox Mode
            </h3>
            <p style={{ color: '#8b949e', fontSize: '13px', lineHeight: '1.4' }}>
              Experiment freely with code analysis
            </p>
          </div>

          <div style={{
            background: 'rgba(22, 27, 34, 0.8)',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '24px',
            transition: 'transform 0.2s ease'
          }}
          className="feature-card">
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
            <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '8px' }}>
              Campaign Mode
            </h3>
            <p style={{ color: '#8b949e', fontSize: '13px', lineHeight: '1.4' }}>
              Complete missions and level up
            </p>
          </div>

          <div style={{
            background: 'rgba(22, 27, 34, 0.8)',
            border: '1px solid #30363d',
            borderRadius: '12px',
            padding: '24px',
            transition: 'transform 0.2s ease'
          }}
          className="feature-card">
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
            <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '8px' }}>
              Track Progress
            </h3>
            <p style={{ color: '#8b949e', fontSize: '13px', lineHeight: '1.4' }}>
              Monitor your learning journey
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginBottom: '32px'
        }}>
          <button
            onClick={() => navigate('/signup')}
            style={{
              padding: '16px 40px',
              background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)'
            }}
            className="cta-button"
          >
            Get Started Free
          </button>

          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '16px 40px',
              background: 'transparent',
              color: '#64b5f6',
              border: '2px solid #64b5f6',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            className="secondary-button"
          >
            Sign In
          </button>
        </div>

        {/* Guest Access */}
        <div style={{
          padding: '24px',
          background: 'rgba(139, 148, 158, 0.1)',
          border: '1px solid #30363d',
          borderRadius: '12px'
        }}>
          <p style={{
            color: '#8b949e',
            fontSize: '14px',
            marginBottom: '12px'
          }}>
            Want to try without signing up?
          </p>
          <button
            onClick={handleGuestAccess}
            style={{
              padding: '12px 32px',
              background: 'transparent',
              color: '#8b949e',
              border: '1px solid #30363d',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            className="guest-button"
          >
            Continue as Guest
          </button>
          <p style={{
            color: '#6e7681',
            fontSize: '12px',
            marginTop: '8px',
            fontStyle: 'italic'
          }}>
            Limited features • Progress not saved
          </p>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        
        .feature-card:hover {
          transform: translateY(-4px);
        }
        
        .cta-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 24px rgba(76, 175, 80, 0.4);
        }
        
        .secondary-button:hover {
          background: rgba(100, 181, 246, 0.1);
          transform: scale(1.05);
        }
        
        .guest-button:hover {
          background: rgba(139, 148, 158, 0.1);
          border-color: #8b949e;
          color: white;
        }
      `}</style>
    </div>
  );
};