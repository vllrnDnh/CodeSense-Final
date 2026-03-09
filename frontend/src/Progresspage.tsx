// src/ProgressPage.tsx
import React, { useEffect, useState, useMemo } from 'react';

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
  questid: {
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeeklyDistribution(dates: string[]) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const counts = [0, 0, 0, 0, 0, 0, 0]
  const now = new Date()
  // Current calendar week: Sunday 00:00 to Saturday 23:59
  const startOfWeek = new Date(now)
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  dates.forEach(dateStr => {
    if (!dateStr) return
    const d = new Date(dateStr)
    const localD = new Date(d.toLocaleString())
    if (localD >= startOfWeek && localD < endOfWeek) {
      counts[localD.getDay()]++
    }
  })
  return { counts: days.map((name, i) => ({ name, count: counts[i] })), startOfWeek }
}

function getPastWeeklyActivity(reports: Report[], missions: MissionProgress[]) {
  const now = new Date()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setHours(0, 0, 0, 0)
  startOfThisWeek.setDate(now.getDate() - now.getDay())

  const allEntries = [
    ...reports.map(r => ({
      date: r.createdat,
      type: 'Sandbox Run',
      mode: r.mode_context ?? 'sandbox',
      detail: '',
      complexity: r.cognitive_complexity ?? 'N/A'
    })),
    ...missions
      .filter(m => m.status === 'completed' && m.completedat)
      .map(m => ({
        date: m.completedat,
        type: 'Quest Completed',
        mode: 'campaign',
        detail: m.questid?.title ?? 'Unknown Quest',
        complexity: 'N/A'
      }))
  ]

  return allEntries
    .filter(a => new Date(a.date) < startOfThisWeek)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function buildHeatmapData(dates: string[]) {
  const map: Record<string, { count: number; times: string[] }> = {}
  dates.forEach(dateStr => {
    if (!dateStr) return
    const key = dateStr.slice(0, 10)
    if (!map[key]) map[key] = { count: 0, times: [] }
    map[key].count++
    // Store formatted time
    const t = new Date(dateStr)
    map[key].times.push(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  })
  const cells: { date: string; count: number; times: string[]; col: number; rowIndex: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() - 7 * 52)
  const targetDays = [0, 1, 2, 3, 4, 5, 6] // Sun through Sat
  let prevWeek = -1
  let col = 0
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const week = Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
    if (week !== prevWeek) { col = week; prevWeek = week }
    if (targetDays.includes(d.getDay())) {
      const key = d.toISOString().slice(0, 10)
      const entry = map[key]
      cells.push({ date: key, count: entry?.count ?? 0, times: entry?.times ?? [], col, rowIndex: targetDays.indexOf(d.getDay()) })
    }
  }
  return cells
}

function getMonthLabels() {
  const labels: { label: string; col: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() - 7 * 52)
  for (let w = 0; w < 52; w++) {
    const d = new Date(start)
    d.setDate(d.getDate() + w * 7)
    if (d.getDate() <= 7) {
      labels.push({ label: d.toLocaleString('default', { month: 'short' }), col: w })
    }
  }
  return labels
}

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<FullStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'campaign' | 'badges'>('overview')
  const [tooltip, setTooltip] = useState<{ cell: typeof heatmapCells[0]; x: number; y: number } | null>(null)

  // Override the global `overflow: hidden` set by layout.css on html/body/#root
  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById('root')]
    els.forEach(el => { if (el) el.style.overflow = 'auto' })
    return () => {
      els.forEach(el => { if (el) el.style.overflow = '' })
    }
  }, [])

  const allActivityDates = useMemo(() => {
    const reportDates = (stats?.reports ?? []).map(r => r.createdat)
    const missionDates = (stats?.missions ?? [])
      .filter(m => m.status === 'completed' && m.completedat)
      .map(m => m.completedat)
    return [...reportDates, ...missionDates]
  }, [stats?.reports, stats?.missions])

  const { counts: weeklyData, startOfWeek } = useMemo(
    () => getWeeklyDistribution(allActivityDates),
    [allActivityDates]
  )
  const pastActivity = useMemo(
    () => stats ? getPastWeeklyActivity(stats.reports, stats.missions) : [],
    [stats?.reports, stats?.missions]
  )
  const heatmapCells = useMemo(() => buildHeatmapData(allActivityDates), [allActivityDates])
  const monthLabels = useMemo(() => getMonthLabels(), [])

  const fetchAll = async (isRefresh = false) => {
    if (!user) return
    if (isRefresh) setRefreshing(true)
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('totalxp, currentlevel, sandbox_runs')
        .eq('id', user.id)
        .single()

      const { data: reports } = await supabase
        .from('reports')
        .select('id, type, sourcecode, mode_context, cognitive_complexity, createdat')
        .eq('userid', user.id)
        .order('createdat', { ascending: false })

      const { data: missions } = await supabase
        .from('mission_progress')
        .select('id, status, attempts, hintsused, completedat, questid(title, phase, basexp)')
        .eq('userid', user.id)
        .order('completedat', { ascending: false })

      const { data: leaderboard } = await supabase
        .from('leaderboard')
        .select('rank')
        .eq('userid', user.id)
        .maybeSingle()

      // Fetch avatar from Storage
      const { data: avatarData } = await supabase
        .storage
        .from('Avatars')
        .list(user.id, { limit: 1 })

      if (avatarData && avatarData.length > 0) {
        const { data: urlData } = supabase
          .storage
          .from('Avatars')
          .getPublicUrl(`${user.id}/${avatarData[0].name}`)
        setAvatarUrl(urlData.publicUrl)
      }

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
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!user) { navigate('/login'); return }
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
  const maxCount = Math.max(...weeklyData.map(d => d.count), 1)

  const heatColor = (count: number) => {
    if (count === 0) return 'rgba(255,255,255,0.06)'
    if (count === 1) return '#1a4d1a'
    if (count === 2) return '#2d7a2d'
    if (count === 3) return '#3da63d'
    return '#4caf50'
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      color: 'white',
      fontFamily: 'system-ui, sans-serif',
      boxSizing: 'border-box' as const
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', background: 'rgba(22, 27, 34, 0.8)',
        borderBottom: '1px solid #30363d', width: '100%', boxSizing: 'border-box' as const
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            style={{
              background: 'transparent', border: '1px solid #30363d',
              color: refreshing ? '#484f58' : '#8b949e', cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '12px', padding: '6px 12px', borderRadius: '6px',
              transition: 'all 0.15s'
            }}
          >
            {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
          </button>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              style={{
                width: '34px', height: '34px', borderRadius: '50%',
                objectFit: 'cover', border: '2px solid #30363d'
              }}
            />
          ) : (
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #4caf50, #2d7a2d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: '700', color: 'white', border: '2px solid #30363d'
            }}>
              {user?.playerName?.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ color: '#e6edf3', fontSize: '14px', fontWeight: '500' }}>
            {user?.playerName}
          </span>
        </div>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', boxSizing: 'border-box', width: '100%' }}>

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

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* ── Weekly Distribution Bar Chart ── */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ ...cardHeaderStyle, marginBottom: '2px' }}>Weekly Distribution</h3>
                  <span style={{ fontSize: '11px', color: '#8b949e' }}>
                    Week of {startOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric' })} — resets every Sunday
                  </span>
                </div>
                {pastActivity.length > 0 && (
                  <button
                    onClick={() => {
                      const header = 'Date,Time,Day,Type,Mode,Quest/Detail,Cognitive Complexity\n'
                      const rows = pastActivity.map(a => {
                        const d = new Date(a.date)
                        const date = d.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' })
                        const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        const day = d.toLocaleDateString('en-PH', { weekday: 'long' })
                        return `"${date}","${time}","${day}","${a.type}","${a.mode}","${a.detail}","${a.complexity}"`
                      }).join('\n')
                      const blob = new Blob([header + rows], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `codesense-activity-history.csv`
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                    style={{
                      background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.4)',
                      color: '#4caf50', cursor: 'pointer', fontSize: '11px',
                      padding: '6px 12px', borderRadius: '6px', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    ⬇ Download Past Activity ({pastActivity.length} entries)
                  </button>
                )}
              </div>
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg width="100%" viewBox="0 0 480 160" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
                  {/* Y-axis gridlines — only unique integer steps */}
                  {(() => {
                    const step = maxCount <= 5 ? 1 : maxCount <= 10 ? 2 : Math.ceil(maxCount / 5)
                    const ticks = Array.from({ length: Math.floor(maxCount / step) + 1 }, (_, i) => i * step)
                    return ticks.map((val, i) => {
                      const y = 16 + (1 - val / maxCount) * 110
                      return (
                        <g key={i}>
                          <line x1={36} y1={y} x2={472} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                          <text x={30} y={y + 4} textAnchor="end" fill="#8b949e" fontSize={9}>{val}</text>
                        </g>
                      )
                    })
                  })()}
                  {/* Bars */}
                  {weeklyData.map((d, i) => {
                    const barW = 42
                    const gap = 26
                    const x = 40 + i * (barW + gap)
                    const barH = maxCount === 0 ? 0 : (d.count / maxCount) * 110
                    const y = 16 + 110 - barH
                    const isMax = d.count === maxCount && d.count > 0
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={barW} height={Math.max(barH, 0)} rx={4} fill={isMax ? '#4caf50' : d.count > 0 ? '#2d7a2d' : 'rgba(255,255,255,0.04)'} />
                        {d.count > 0 && (
                          <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#8b949e" fontSize={9}>{d.count}</text>
                        )}
                        <text x={x + barW / 2} y={142} textAnchor="middle" fill="#8b949e" fontSize={11}>{d.name}</text>
                      </g>
                    )
                  })}
                  {/* X axis line */}
                  <line x1={36} y1={126} x2={472} y2={126} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
                </svg>
              </div>
            </div>

            {/* ── Activity Heatmap ── */}
            <div style={{ ...cardStyle, position: 'relative' }}>
              {/* Custom Tooltip */}
              {tooltip && (
                <div style={{
                  position: 'fixed',
                  left: tooltip.x + 12,
                  top: tooltip.y - 10,
                  background: '#1c2128',
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  zIndex: 9999,
                  pointerEvents: 'none',
                  minWidth: '160px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                  <div style={{ color: 'white', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                    {new Date(tooltip.cell.date + 'T12:00:00').toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ color: '#4caf50', fontSize: '11px', marginBottom: tooltip.cell.times.length > 0 ? '8px' : '0' }}>
                    {tooltip.cell.count === 0 ? 'No activity' : `${tooltip.cell.count} submission${tooltip.cell.count !== 1 ? 's' : ''}`}
                  </div>
                  {tooltip.cell.times.length > 0 && (
                    <div style={{ borderTop: '1px solid #30363d', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ color: '#8b949e', fontSize: '10px', marginBottom: '2px' }}>Times:</div>
                      {tooltip.cell.times.slice(0, 5).map((t, i) => (
                        <div key={i} style={{ color: '#e6edf3', fontSize: '11px', fontFamily: 'monospace' }}>🕐 {t}</div>
                      ))}
                      {tooltip.cell.times.length > 5 && (
                        <div style={{ color: '#8b949e', fontSize: '10px' }}>+{tooltip.cell.times.length - 5} more</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Month labels */}
              <div style={{ position: 'relative', height: '18px', marginBottom: '4px', marginLeft: '32px', overflow: 'hidden' }}>
                {monthLabels.map(({ label, col }) => (
                  <span key={col} style={{
                    position: 'absolute',
                    left: `${(col / 53) * 100}%`,
                    fontSize: '10px', color: '#8b949e',
                    whiteSpace: 'nowrap'
                  }}>{label}</span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                {/* Row labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '2px', minWidth: '26px' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} style={{ fontSize: '10px', color: '#8b949e', height: '11px', lineHeight: '11px' }}>{d}</div>
                  ))}
                </div>

                {/* Grid */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(53, minmax(0, 1fr))`,
                    gridTemplateRows: 'repeat(7, 11px)',
                    gap: '3px',
                    width: '100%'
                  }}>
                    {heatmapCells.map((cell, i) => (
                      <div
                        key={i}
                        onMouseEnter={e => setTooltip({ cell, x: e.clientX, y: e.clientY })}
                        onMouseMove={e => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                        style={{
                          gridColumn: cell.col + 1,
                          gridRow: cell.rowIndex + 1,
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: '2px',
                          background: heatColor(cell.count),
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                          transition: 'transform 0.1s',
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.4)' }}
                        onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', justifyContent: 'flex-end' }}>
                <span style={{ color: '#8b949e', fontSize: '10px' }}>Less</span>
                {[0, 1, 2, 3, 4].map(n => (
                  <div key={n} style={{ width: '11px', height: '11px', borderRadius: '2px', background: heatColor(n) }} />
                ))}
                <span style={{ color: '#8b949e', fontSize: '10px' }}>More</span>
              </div>
            </div>

            {/* Campaign summary */}
            <div style={cardStyle}>
              <h3 style={cardHeaderStyle}>Campaign Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {(['beginner', 'intermediate', 'advanced'] as const).map(phase => {
                  const phaseCount = stats.missions.filter(
                    m => m.questid?.phase === phase && m.status === 'completed'
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
                        {mission.questid?.title ?? 'Unknown Quest'}
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ color: '#8b949e', fontSize: '11px' }}>
                          Phase: <span style={{ color: '#64b5f6' }}>{mission.questid?.phase ?? 'N/A'}</span>
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
                { id: 'beginner_clear', icon: '🌱', name: 'Beginner Clear', desc: 'Complete all beginner quests', earned: stats.missions.filter(m => m.questid?.phase === 'beginner' && m.status === 'completed').length >= 1 },
                { id: 'intermediate_clear', icon: '🔥', name: 'Intermediate Clear', desc: 'Complete an intermediate quest', earned: stats.missions.filter(m => m.questid?.phase === 'intermediate' && m.status === 'completed').length >= 1 },
                { id: 'advanced_clear', icon: '💎', name: 'Advanced Clear', desc: 'Complete an advanced quest', earned: stats.missions.filter(m => m.questid?.phase === 'advanced' && m.status === 'completed').length >= 1 },
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