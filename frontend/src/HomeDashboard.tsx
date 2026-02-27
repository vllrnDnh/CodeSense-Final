// src/HomeDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthScreen';
import { supabase } from './services/supabase';
import { getLevelProgress, getXPToNextLevel, getLevelName} from './types'

interface DashboardStats {
  sandboxRuns: number
  questsCompleted: number
  xpToNextLevel: number | null
  levelProgress: number
}

export const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isGuest, logout } = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    sandboxRuns: 0,
    questsCompleted: 0,
    xpToNextLevel: null,
    levelProgress: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!user) { setStatsLoading(false); return }

    const fetchStats = async () => {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('totalxp, currentlevel, sandbox_runs')
          .eq('id', user.id)
          .single()

        const { count: questsCompleted } = await supabase
          .from('mission_progress')
          .select('*', { count: 'exact', head: true })
          .eq('userid', user.id)
          .eq('status', 'completed')

        if (profile) {
          setStats({
            sandboxRuns: profile.sandbox_runs ?? 0,
            questsCompleted: questsCompleted ?? 0,
            xpToNextLevel: getXPToNextLevel(profile.totalxp ?? 0),
            levelProgress: getLevelProgress(profile.totalxp ?? 0)
          })
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [user?.id])

  const handleExit = () => {
    if (isGuest) {
      navigate('/');
    } else {
      logout();
      navigate('/');
    }
  };

  const currentLevelName = user ? getLevelName((user.currentLevel as 1|2|3|4) || 1) : 'Squire'

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: '40px'
    }}>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 40px',
        background: 'rgba(22, 27, 34, 0.8)',
        borderRadius: '12px',
        margin: '20px 0 30px 0',
        border: '1px solid #30363d',
        width: '95%',
        maxWidth: '1280px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🧠</span>
          <h1 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '600' }}>CodeSense</h1>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button style={iconBtnStyle}>🔍</button>
          <button style={iconBtnStyle}>🔔</button>
          <button onClick={() => navigate('/profile')} style={iconBtnStyle}>👤</button>
          <button onClick={handleExit} style={{
            background: 'rgba(255, 68, 68, 0.1)', border: '1px solid #ff4444',
            color: '#ff4444', padding: '8px 16px', borderRadius: '8px',
            cursor: 'pointer', fontWeight: '700', fontSize: '12px', marginLeft: '10px'
          }}>
            {isGuest ? 'EXIT GUEST' : 'SIGN OUT'} ⎋
          </button>
        </div>
      </header>

      <div style={{
        width: '95%', maxWidth: '1280px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '24px', margin: '0 auto', boxSizing: 'border-box'
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={heroSectionStyle}>
            <div style={radialOverlayStyle} />
            <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚀</div>
              <h2 style={heroTitleStyle}>
                {isGuest ? 'Welcome, Guest!' : `Welcome back, ${user?.playerName || 'Explorer'}!`}
              </h2>
              <p style={{ color: '#8b949e', fontSize: '16px', margin: 0 }}>
                {isGuest
                  ? 'Explore the sandbox freely. Sign up to save your progress!'
                  : `Continue your journey to master code safety as a ${currentLevelName}.`}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={modeCardStyle('#4caf50')} onClick={() => navigate('/sandbox')}>
              <h3 style={cardTitleStyle}>Sandbox</h3>
              <p style={cardParaStyle}>Experiment freely with code. No rules, just logic.</p>
              <button style={cardBtnStyle('#4caf50')}>EXPLORE</button>
            </div>
            <div
              style={isGuest ? lockedCardStyle : modeCardStyle('#ffa726')}
              onClick={() => !isGuest && navigate('/campaign')}
            >
              <h3 style={cardTitleStyle}>Campaign Mode</h3>
              <p style={cardParaStyle}>Start your journey. Complete missions to level up.</p>
              <button disabled={isGuest} style={cardBtnStyle(isGuest ? '#30363d' : '#ffa726')}>
                {isGuest ? 'LOCKED' : 'LEARN'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* User Stats */}
          <div style={sidebarCardStyle}>
            <h3 style={sidebarTitleStyle}><span>🏆</span> USER STATS</h3>
            {isGuest ? (
              <div style={guestPlaceholderStyle}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
                <p>Sign up to track your rank</p>
                <button onClick={() => navigate('/signup')} style={signupBtnStyle}>Sign Up</button>
              </div>
            ) : (
              <>
                <div style={statsBoxStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={statsLabelStyle}>RANK</div>
                      <div style={statsValueStyle}>{currentLevelName.toUpperCase()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={statsLabelStyle}>TOTAL XP</div>
                      <div style={statsValueStyle}>{user?.totalXP ?? 0}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={statsLabelStyle}>SANDBOX RUNS</div>
                      <div style={{ color: '#4caf50', fontSize: '18px', fontWeight: '700' }}>
                        {statsLoading ? '...' : stats.sandboxRuns}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={statsLabelStyle}>QUESTS DONE</div>
                      <div style={{ color: '#ffa726', fontSize: '18px', fontWeight: '700' }}>
                        {statsLoading ? '...' : stats.questsCompleted}
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => navigate('/profile')} style={fullProfileBtnStyle}>
                  View Full Profile
                </button>
              </>
            )}
          </div>

          {/* Progress Report */}
          <div style={sidebarCardStyle}>
            <h3 style={sidebarTitleStyle}><span>📊</span> PROGRESS REPORT</h3>
            {isGuest ? (
              <div style={guestPlaceholderStyle}><p>Sign up to track progress</p></div>
            ) : statsLoading ? (
              <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Loading progress...
              </div>
            ) : (
              <div>
                {/* XP Progress Bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#8b949e', fontSize: '12px' }}>XP to next rank</span>
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>
                      {stats.xpToNextLevel === null ? 'MAX RANK 👑' : `${stats.xpToNextLevel} XP remaining`}
                    </span>
                  </div>
                  <div style={progressBarContainerStyle}>
                    <div style={{
                      width: `${stats.levelProgress}%`, height: '100%',
                      background: 'linear-gradient(90deg, #4caf50 0%, #66bb6a 100%)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span style={{ color: '#484f58', fontSize: '10px' }}>Lvl {user?.currentLevel}</span>
                    <span style={{ color: '#484f58', fontSize: '10px' }}>{stats.levelProgress}%</span>
                    <span style={{ color: '#484f58', fontSize: '10px' }}>Lvl {Math.min((user?.currentLevel ?? 1) + 1, 4)}</span>
                  </div>
                </div>

                {/* Mini stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                  <div style={miniStatBoxStyle}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>🔬</div>
                    <div style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>{stats.sandboxRuns}</div>
                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Sandbox Runs</div>
                  </div>
                  <div style={miniStatBoxStyle}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>⚔️</div>
                    <div style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>{stats.questsCompleted}</div>
                    <div style={{ color: '#8b949e', fontSize: '10px' }}>Quests Done</div>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/progress')}
                  style={{
                    width: '100%', background: 'transparent', color: '#4caf50',
                    border: '1px solid #4caf50', borderRadius: '8px', padding: '10px',
                    fontWeight: '600', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  📊 View Full Progress Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const iconBtnStyle = { background: 'transparent', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer', padding: '8px' };
const heroSectionStyle: React.CSSProperties = { background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.9) 0%, rgba(30, 36, 47, 0.9) 100%)', borderRadius: '16px', padding: '60px 40px', border: '1px solid #30363d', position: 'relative', overflow: 'hidden', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const radialOverlayStyle: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 50% 50%, rgba(100, 181, 246, 0.1) 0%, transparent 70%)' };
const heroTitleStyle = { color: 'white', fontSize: '32px', fontWeight: '700', marginBottom: '12px', background: 'linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const modeCardStyle = (color: string) => ({ background: `linear-gradient(135deg, ${color}26 0%, ${color}0D 100%)`, border: `2px solid ${color}`, borderRadius: '16px', padding: '30px 24px', cursor: 'pointer' });
const lockedCardStyle = { background: 'rgba(139, 148, 158, 0.05)', border: '2px solid #30363d', borderRadius: '16px', padding: '30px 24px', cursor: 'not-allowed', opacity: 0.6 };
const cardTitleStyle = { color: 'white', fontSize: '22px', fontWeight: '600', marginBottom: '12px' };
const cardParaStyle = { color: '#8b949e', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' };
const cardBtnStyle = (bg: string) => ({ background: bg, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: 'pointer' });
const sidebarCardStyle = { background: 'rgba(22, 27, 34, 0.9)', border: '1px solid #30363d', borderRadius: '16px', padding: '24px' };
const sidebarTitleStyle = { color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' };
const guestPlaceholderStyle: React.CSSProperties = { textAlign: 'center', padding: '20px', color: '#8b949e' };
const signupBtnStyle = { background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' };
const statsBoxStyle = { background: 'rgba(100, 181, 246, 0.1)', border: '1px solid #64b5f6', borderRadius: '8px', padding: '12px', marginBottom: '16px' };
const statsLabelStyle = { color: '#64b5f6', fontSize: '11px', marginBottom: '4px' };
const statsValueStyle = { color: 'white', fontSize: '20px', fontWeight: '700' };
const fullProfileBtnStyle = { width: '100%', background: 'transparent', color: '#64b5f6', border: '1px solid #64b5f6', borderRadius: '8px', padding: '10px', fontWeight: '600', cursor: 'pointer' };
const progressBarContainerStyle = { width: '100%', height: '8px', background: 'rgba(100, 181, 246, 0.2)', borderRadius: '4px', overflow: 'hidden' };
const miniStatBoxStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', textAlign: 'center' as const };