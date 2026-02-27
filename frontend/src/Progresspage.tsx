// src/ProgressPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthScreen';
import { supabase } from './services/supabase';
import { getLevelProgress, getXPToNextLevel, getLevelName, XP_LEVELS } from './types'

interface Report {
  id: string
  type: string
  sourcecode: string
  mode_context: 'sandbox' | 'campaign'
  cognitive_complexity: number
  createdat: string
}

interface MissionProgress {
  id: string
  status: string
  attempts: number
  hintsused: number
  completedat: string
  quests: {
    title: string
    phase: string
    basexp: number
  } | null
}

interface FullStats {
  totalXP: number
  currentLevel: number
  sandboxRuns: number
  questsCompleted: number
  levelProgress: number
  xpToNextLevel: number | null
  reports: Report[]
  missions: MissionProgress[]
  leaderboardRank: number | null
}

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<FullStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'campaign' | 'badges'>('overview')

  useEffect(() => {
    if (!user) { navigate('/login'); return }

    const fetchAll = async () => {
      try {
        // 1. Full user profile
        const { data: profile } = await supabase
          .from('users')
          .select('totalxp, currentlevel, sandbox_runs')
          .eq('id', user.id)
          .single()

        // 2. All reports (sandbox + campaign)
        const { data: reports } = await supabase
          .from('reports')
          .select('id, type, sourcecode, mode_context, cognitive_complexity, createdat')
          .eq('userid', user.id)
          .order('createdat', { ascending: false })
          .limit(50)

        // 3. Mission progress with quest details
        const { data: missions } = await supabase
          .from('mission_progress')
          .select('id, status, attempts, hintsused, completedat, quests(title, phase, basexp)')
          .eq('userid', user.id)
          .order('completedat', { ascending: false })

        // 4. Leaderboard rank
        const { data: leaderboard } = await supabase
          .from('leaderboard')
          .select('rank')
          .eq('userid', user.id)
          .single()

        // 5. Completed quests count
        const { count: questsCompleted } = await supabase
          .from('mission_progress')
          .select('*', { count: 'exact', head: true })
          .eq('userid', user.id)
          .eq('status', 'completed')

        const totalXP = profile?.totalxp ?? 0

        setStats({
          totalXP,
          currentLevel: profile?.currentlevel ?? 1,
          sandboxRuns: profile?.sandbox_runs ?? 0,
          questsCompleted: questsCompleted ?? 0,
          levelProgress: getLevelProgress(totalXP),
          xpToNextLevel: getXPToNextLevel(totalXP),
          reports: (reports ?? []) as Report[],
          missions: (missions ?? []) as unknown as MissionProgress[],
          leaderboardRank: leaderboard?.rank ?? null
        })
      } catch (error) {
        console.error('Failed to fetch progress:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [user?.id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
        Loading your progress...
      </div>
    )
  }

  if (!stats) return null

  const levelName = getLevelName((stats.currentLevel as 1|2|3|4))
  const campaignReports = stats.reports.filter(r => r.mode_context === 'campaign')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      color: 'white',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px', background: 'rgba(22, 27, 34, 0.8)',
        borderBottom: '1px solid #30363d'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/home')}
            style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px' }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <h1 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: '600' }}>
            Progress Report
          </h1>
        </div>
        <div style={{ color: '#8b949e', fontSize: '14px' }}>
          {user?.playerName}
        </div>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Top Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'RANK', value: levelName.toUpperCase(), color: '#64b5f6', icon: '🎖️' },
            { label: 'TOTAL XP', value: stats.totalXP, color: '#ffc107', icon: '⭐' },
            { label: 'SANDBOX RUNS', value: stats.sandboxRuns, color: '#4caf50', icon: '🔬' },
            { label: 'QUESTS DONE', value: stats.questsCompleted, color: '#ffa726', icon: '⚔️' },
            { label: 'LEADERBOARD', value: stats.leaderboardRank ? `#${stats.leaderboardRank}` : 'N/A', color: '#a855f7', icon: '🏆' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(22, 27, 34, 0.9)', border: '1px solid #30363d',
              borderRadius: '12px', padding: '20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.icon}</div>
              <div style={{ color: stat.color, fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>
                {stat.value}
              </div>
              <div style={{ color: '#8b949e', fontSize: '10px', letterSpacing: '0.5px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── XP Progress Bar ── */}
        <div style={{
          background: 'rgba(22, 27, 34, 0.9)', border: '1px solid #30363d',
          borderRadius: '12px', padding: '24px', marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ color: 'white', fontSize: '16px', fontWeight: '600' }}>Level Progression</div>
              <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
                {stats.xpToNextLevel === null
                  ? 'You have reached the maximum rank — Lord 👑'
                  : `${stats.xpToNextLevel} XP needed to reach next rank`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#ffc107', fontSize: '24px', fontWeight: '700' }}>{stats.levelProgress}%</div>
              <div style={{ color: '#8b949e', fontSize: '11px' }}>to next rank</div>
            </div>
          </div>

          {/* Level path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            {[1, 2, 3, 4].map((lvl) => {
              const name = getLevelName(lvl as 1|2|3|4)
              const threshold = XP_LEVELS[lvl as 1|2|3|4].minXP
              const isReached = stats.totalXP >= threshold
              const isCurrent = stats.currentLevel === lvl
              return (
                <React.Fragment key={lvl}>
                  <div style={{
                    flex: 1, textAlign: 'center', padding: '8px',
                    background: isReached ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isCurrent ? '#4caf50' : isReached ? '#4caf5066' : '#30363d'}`,
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '16px' }}>
                      {lvl === 1 ? '🛡️' : lvl === 2 ? '⚔️' : lvl === 3 ? '👑' : '🌟'}
                    </div>
                    <div style={{ color: isReached ? '#4caf50' : '#484f58', fontSize: '11px', fontWeight: '700' }}>
                      {name}
                    </div>
                    <div style={{ color: '#484f58', fontSize: '10px' }}>{threshold} XP</div>
                    {isCurrent && <div style={{ color: '#4caf50', fontSize: '9px', marginTop: '2px' }}>CURRENT</div>}
                  </div>
                  {lvl < 4 && <div style={{ color: '#30363d', fontSize: '16px' }}>→</div>}
                </React.Fragment>
              )
            })}
          </div>

          <div style={{ background: 'rgba(100,181,246,0.1)', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
            <div style={{
              width: `${stats.levelProgress}%`, height: '100%',
              background: 'linear-gradient(90deg, #4caf50, #66bb6a)',
              transition: 'width 0.5s ease'
            }} />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(22,27,34,0.9)', border: '1px solid #30363d', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
          {([
            { id: 'overview', label: '📋 Overview' },
            { id: 'campaign', label: `⚔️ Campaign (${stats.questsCompleted})` },
            { id: 'badges', label: '🏅 Badges' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                background: activeTab === tab.id ? 'rgba(100,181,246,0.2)' : 'transparent',
                color: activeTab === tab.id ? '#64b5f6' : '#8b949e',
                fontWeight: activeTab === tab.id ? '700' : '400',
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab: XP Timeline + Campaign Summary ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* XP Timeline */}
            <div style={cardStyle}>
              <h3 style={cardHeaderStyle}>XP History Timeline</h3>
              {campaignReports.length === 0 ? (
                <div style={emptyStyle}>No XP earned yet. Complete campaign quests to earn XP!</div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                  {/* Vertical line */}
                  <div style={{
                    position: 'absolute', left: '8px', top: 0, bottom: 0,
                    width: '2px', background: 'rgba(100,181,246,0.2)', borderRadius: '2px'
                  }} />
                  {campaignReports.map((report) => (
                    <div key={report.id} style={{ position: 'relative', marginBottom: '16px' }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: '-20px', top: '4px',
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: '#ffc107', border: '2px solid #0d1117'
                      }} />
                      <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid #21262d',
                        borderRadius: '8px', padding: '12px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                            ⚔️ Quest Completed
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>
                            Complexity score: {report.cognitive_complexity ?? 'N/A'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#ffc107', fontSize: '14px', fontWeight: '700' }}>
                            +XP
                          </div>
                          <div style={{ color: '#484f58', fontSize: '11px' }}>
                            {new Date(report.createdat).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Campaign summary */}
            <div style={cardStyle}>
              <h3 style={cardHeaderStyle}>Campaign Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {(['beginner', 'intermediate', 'advanced'] as const).map(phase => {
                  const phaseCount = stats.missions.filter(
                    m => m.quests?.phase === phase && m.status === 'completed'
                  ).length
                  const colors = { beginner: '#4caf50', intermediate: '#ffa726', advanced: '#f44336' }
                  return (
                    <div key={phase} style={{
                      background: `rgba(${phase === 'beginner' ? '76,175,80' : phase === 'intermediate' ? '255,167,38' : '244,67,54'},0.08)`,
                      border: `1px solid ${colors[phase]}44`,
                      borderRadius: '10px', padding: '16px', textAlign: 'center'
                    }}>
                      <div style={{ color: colors[phase], fontSize: '22px', fontWeight: '700' }}>{phaseCount}</div>
                      <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'capitalize', marginTop: '4px' }}>
                        {phase} quests
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Campaign Tab ── */}
        {activeTab === 'campaign' && (
          <div style={cardStyle}>
            <h3 style={cardHeaderStyle}>Campaign Quest Log</h3>
            {stats.missions.length === 0 ? (
              <div style={emptyStyle}>No campaign quests started yet. Go to Campaign Mode!</div>
            ) : (
              stats.missions.map(mission => (
                <div key={mission.id} style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid #21262d',
                  borderRadius: '8px', padding: '16px', marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                        {mission.quests?.title ?? 'Unknown Quest'}
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ color: '#8b949e', fontSize: '11px' }}>
                          Phase: <span style={{ color: '#64b5f6' }}>{mission.quests?.phase ?? 'N/A'}</span>
                        </span>
                        <span style={{ color: '#8b949e', fontSize: '11px' }}>
                          Attempts: <span style={{ color: 'white' }}>{mission.attempts}</span>
                        </span>
                        <span style={{ color: '#8b949e', fontSize: '11px' }}>
                          Hints used: <span style={{ color: mission.hintsused > 0 ? '#ff4444' : 'white' }}>
                            {mission.hintsused}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: mission.status === 'completed' ? '#4caf50' : '#ffa726',
                        fontSize: '12px', fontWeight: '700',
                        background: mission.status === 'completed' ? 'rgba(76,175,80,0.1)' : 'rgba(255,167,38,0.1)',
                        padding: '4px 10px', borderRadius: '6px'
                      }}>
                        {mission.status.toUpperCase()}
                      </div>
                      {mission.completedat && (
                        <div style={{ color: '#484f58', fontSize: '10px', marginTop: '4px' }}>
                          {new Date(mission.completedat).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Badges Tab ── */}
        {activeTab === 'badges' && (
          <div style={cardStyle}>
            <h3 style={cardHeaderStyle}>Badges Earned</h3>
            {/* Predefined badge definitions */}
            {(() => {
              const allBadges = [
                { id: 'first_quest', icon: '⚔️', name: 'First Quest', desc: 'Complete your first campaign quest', earned: stats.questsCompleted >= 1 },
                { id: 'beginner_clear', icon: '🌱', name: 'Beginner Clear', desc: 'Complete all beginner quests', earned: stats.missions.filter(m => m.quests?.phase === 'beginner' && m.status === 'completed').length >= 1 },
                { id: 'intermediate_clear', icon: '🔥', name: 'Intermediate Clear', desc: 'Complete an intermediate quest', earned: stats.missions.filter(m => m.quests?.phase === 'intermediate' && m.status === 'completed').length >= 1 },
                { id: 'advanced_clear', icon: '💎', name: 'Advanced Clear', desc: 'Complete an advanced quest', earned: stats.missions.filter(m => m.quests?.phase === 'advanced' && m.status === 'completed').length >= 1 },
                { id: 'knight_rank', icon: '🛡️', name: 'Knight', desc: 'Reach Knight rank (100 XP)', earned: stats.totalXP >= 100 },
                { id: 'duke_rank', icon: '👑', name: 'Duke', desc: 'Reach Duke rank (300 XP)', earned: stats.totalXP >= 300 },
                { id: 'lord_rank', icon: '🌟', name: 'Lord', desc: 'Reach Lord rank (600 XP)', earned: stats.totalXP >= 600 },
                { id: 'no_hints', icon: '🎯', name: 'Purist', desc: 'Complete a quest without using any hints', earned: stats.missions.some(m => m.status === 'completed' && m.hintsused === 0) },
              ]
              const earned = allBadges.filter(b => b.earned)
              const locked = allBadges.filter(b => !b.earned)

              return (
                <>
                  {earned.length > 0 && (
                    <>
                      <div style={{ color: '#4caf50', fontSize: '12px', fontWeight: '700', marginBottom: '12px' }}>
                        ✅ EARNED ({earned.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        {earned.map(badge => (
                          <div key={badge.id} style={{
                            background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.4)',
                            borderRadius: '10px', padding: '16px', textAlign: 'center'
                          }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{badge.icon}</div>
                            <div style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{badge.name}</div>
                            <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '4px' }}>{badge.desc}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div style={{ color: '#484f58', fontSize: '12px', fontWeight: '700', marginBottom: '12px' }}>
                    🔒 LOCKED ({locked.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {locked.map(badge => (
                      <div key={badge.id} style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid #21262d',
                        borderRadius: '10px', padding: '16px', textAlign: 'center', opacity: 0.5
                      }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px', filter: 'grayscale(1)' }}>{badge.icon}</div>
                        <div style={{ color: '#8b949e', fontSize: '13px', fontWeight: '700' }}>{badge.name}</div>
                        <div style={{ color: '#484f58', fontSize: '11px', marginTop: '4px' }}>{badge.desc}</div>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

const cardStyle = {
  background: 'rgba(22, 27, 34, 0.9)', border: '1px solid #30363d',
  borderRadius: '12px', padding: '24px'
}
const cardHeaderStyle = {
  color: 'white', fontSize: '15px', fontWeight: '600',
  marginBottom: '16px', marginTop: 0
}
const emptyStyle = {
  color: '#484f58', fontSize: '13px', textAlign: 'center' as const,
  padding: '32px 0', fontStyle: 'italic'
}
