// src/HomeDashboard.tsx
import React, { useEffect, useState, useRef } from 'react';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<{ id: string; playername: string; totalxp: number; currentlevel: number }[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    actions: { label: string; icon: string; desc: string; path: string }[]
    players: { id: string; playername: string; totalxp: number; currentlevel: number }[]
    quests: { id: string; title: string; phase: string; difficulty: string; basexp: number }[]
    reports: { id: string; type: string; createdat: string; mode_context: string }[]
  }>({ actions: [], players: [], quests: [], reports: [] })
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) { setStatsLoading(false); return }
    fetchStats()

    // Realtime subscription — re-fetch leaderboard whenever any user's XP changes
    const channel = supabase
      .channel('leaderboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
      }, () => {
        fetchLeaderboard()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ actions: [], players: [], quests: [], reports: [] })
      return
    }
    const timer = setTimeout(() => runSearch(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Focus input when search opens + Escape to close
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSearchOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])

  const QUICK_ACTIONS = [
    { label: 'Sandbox Mode', icon: '🔬', desc: 'Experiment freely with code', path: '/sandbox', keywords: ['sandbox', 'experiment', 'code', 'run', 'free'] },
    { label: 'Campaign Mode', icon: '⚔️', desc: 'Complete quests and earn XP', path: '/campaign', keywords: ['campaign', 'quest', 'mission', 'learn', 'level'] },
    { label: 'Progress Report', icon: '📊', desc: 'View your stats and activity', path: '/progress', keywords: ['progress', 'report', 'stats', 'activity', 'xp', 'chart'] },
    { label: 'Profile Settings', icon: '👤', desc: 'Edit your profile and avatar', path: '/profile', keywords: ['profile', 'avatar', 'settings', 'edit', 'account', 'image'] },
    { label: 'Leaderboard', icon: '🏆', desc: 'See top players ranking', path: '/progress', keywords: ['leaderboard', 'rank', 'ranking', 'top', 'players'] },
  ]

  const runSearch = async (q: string) => {
    setSearchLoading(true)
    const ql = q.toLowerCase()
    try {
      // Players by name (ilike works on varchar)
      const { data: players } = await supabase
        .from('users').select('id, playername, totalxp, currentlevel')
        .ilike('playername', `%${q}%`).limit(5)

      // Quests by title, description, or phase (all varchar/text)
      const [questsByTitle, questsByPhase, questsByDesc] = await Promise.all([
        supabase.from('quests').select('id, title, phase, difficulty, basexp')
          .ilike('title', `%${q}%`).eq('isactive', true).limit(5),
        supabase.from('quests').select('id, title, phase, difficulty, basexp')
          .ilike('phase', `%${q}%`).eq('isactive', true).limit(5),
        supabase.from('quests').select('id, title, phase, difficulty, basexp')
          .ilike('description', `%${q}%`).eq('isactive', true).limit(5),
      ])
      const questMap = new Map()
      ;[...(questsByTitle.data ?? []), ...(questsByPhase.data ?? []), ...(questsByDesc.data ?? [])]
        .forEach((item: any) => questMap.set(item.id, item))

      // Reports: type is ENUM, narrative is ARRAY — only sourcecode and mode_context are searchable
      // For mode_context match "sandbox"/"campaign" directly; for sourcecode use ilike
      let reportsData: any[] = []
      if (user) {
        const modeMatch = ['sandbox', 'campaign'].find(m => m.includes(ql) || ql.includes(m))
        const [byMode, byCode] = await Promise.all([
          modeMatch
            ? supabase.from('reports').select('id, type, createdat, mode_context')
                .eq('userid', user.id).eq('mode_context', modeMatch)
                .order('createdat', { ascending: false }).limit(5)
            : Promise.resolve({ data: [] }),
          supabase.from('reports').select('id, type, createdat, mode_context')
            .eq('userid', user.id).ilike('sourcecode', `%${q}%`)
            .order('createdat', { ascending: false }).limit(5),
        ])
        const reportMap = new Map()
        ;[...((byMode as any).data ?? []), ...((byCode as any).data ?? [])]
          .forEach((r: any) => reportMap.set(r.id, r))
        reportsData = Array.from(reportMap.values()).slice(0, 5)
      }

      // Match quick actions by keyword
      const matchedActions = QUICK_ACTIONS.filter(a =>
        a.keywords.some(k => k.includes(ql) || ql.includes(k)) ||
        a.label.toLowerCase().includes(ql)
      )

      setSearchResults({
        actions: matchedActions,
        players: players ?? [],
        quests: Array.from(questMap.values()).slice(0, 5),
        reports: reportsData,
      })
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    if (!user) return
    try {
      const { data: lb } = await supabase
        .from('users')
        .select('id, playername, totalxp, currentlevel')
        .eq('isactive', true)
        .order('totalxp', { ascending: false })
        .limit(10)
      if (lb) {
        setLeaderboard(lb)
        const myPos = lb.findIndex(u => u.id === user.id)
        if (myPos !== -1) {
          setMyRank(myPos + 1)
        } else {
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('isactive', true)
            .gt('totalxp', user.totalXP ?? 0)
          setMyRank((count ?? 0) + 1)
        }
      }
    } catch (e) {
      console.error('Leaderboard fetch error:', e)
    }
  }

  const fetchStats = async () => {
    if (!user) return
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

      // Fetch avatar
      const { data: avatarFiles } = await supabase.storage.from('Avatars').list(user.id, { limit: 1 })
      if (avatarFiles && avatarFiles.length > 0) {
        const { data: urlData } = supabase.storage.from('Avatars').getPublicUrl(`${user.id}/${avatarFiles[0].name}`)
        setAvatarUrl(urlData.publicUrl + '?t=' + Date.now())
      }
      await fetchLeaderboard()
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleExit = async () => {
    if (isGuest) {
      sessionStorage.removeItem('guestMode')
      navigate('/', { replace: true })
    } else {
      logout()
      // Let React flush state before navigating to prevent stale session flash
      await new Promise(r => setTimeout(r, 50))
      navigate('/', { replace: true })
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
          {/* Search */}
          <div ref={searchRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setSearchOpen(prev => !prev)}
              style={{ ...iconBtnStyle, color: searchOpen ? '#4caf50' : '#8b949e', transition: 'color 0.15s' }}
            >🔍</button>

            {searchOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                width: '380px', background: '#161b22', border: '1px solid #30363d',
                borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                zIndex: 1000, overflow: 'hidden'
              }}>
                {/* Search input */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px', opacity: 0.5 }}>🔍</span>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search players, quests, reports..."
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: '#e6edf3', fontSize: '14px'
                    }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '16px', padding: '0' }}>×</button>
                  )}
                </div>

                {/* Results */}
                <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {searchLoading && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>Searching...</div>
                  )}

                  {!searchLoading && !searchQuery && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#484f58', fontSize: '13px' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
                      Type to search players, quests, or your reports
                    </div>
                  )}

                  {!searchLoading && searchQuery && searchResults.actions.length === 0 && searchResults.players.length === 0 && searchResults.quests.length === 0 && searchResults.reports.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#484f58', fontSize: '13px' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>😶</div>
                      No results for "{searchQuery}"
                    </div>
                  )}

                  {/* Quick Actions */}
                  {searchResults.actions.length > 0 && (
                    <div>
                      <div style={{ padding: '8px 16px 4px', color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Quick Actions</div>
                      {searchResults.actions.map(a => (
                        <button key={a.label} onClick={() => { setSearchOpen(false); navigate(a.path) }}
                          style={{ width: '100%', background: 'transparent', border: 'none', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '16px' }}>{a.icon}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600' }}>{a.label}</div>
                            <div style={{ color: '#8b949e', fontSize: '11px' }}>{a.desc}</div>
                          </div>
                          <span style={{ color: '#4caf50', fontSize: '11px' }}>→</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Players */}
                  {searchResults.players.length > 0 && (
                    <div>
                      <div style={{ padding: '8px 16px 4px', color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Players</div>
                      {searchResults.players.map(p => (
                        <button key={p.id} onClick={() => { setSearchOpen(false); navigate('/profile') }}
                          style={{ width: '100%', background: 'transparent', border: 'none', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #4caf50, #2d7a2d)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>{p.playername.charAt(0).toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600' }}>{p.playername}</div>
                            <div style={{ color: '#8b949e', fontSize: '11px' }}>{getLevelName(p.currentlevel as 1|2|3|4)} · {p.totalxp} XP</div>
                          </div>
                          <span style={{ color: '#484f58', fontSize: '11px' }}>👤</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quests */}
                  {searchResults.quests.length > 0 && (
                    <div style={{ borderTop: searchResults.players.length > 0 ? '1px solid #21262d' : 'none' }}>
                      <div style={{ padding: '8px 16px 4px', color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Quests</div>
                      {searchResults.quests.map(q => {
                        const phaseColor = q.phase === 'beginner' ? '#4caf50' : q.phase === 'intermediate' ? '#ffa726' : '#f44336'
                        return (
                          <button key={q.id} onClick={() => { setSearchOpen(false); navigate('/campaign') }}
                            style={{ width: '100%', background: 'transparent', border: 'none', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${phaseColor}22`, border: `1px solid ${phaseColor}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '16px' }}>⚔️</span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600' }}>{q.title}</div>
                              <div style={{ color: '#8b949e', fontSize: '11px', textTransform: 'capitalize' }}>{q.phase} · {q.difficulty} · {q.basexp} XP</div>
                            </div>
                            <span style={{ color: phaseColor, fontSize: '10px', fontWeight: '700', background: `${phaseColor}22`, padding: '2px 8px', borderRadius: '8px', textTransform: 'capitalize' }}>{q.phase}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Reports */}
                  {searchResults.reports.length > 0 && (
                    <div style={{ borderTop: (searchResults.players.length > 0 || searchResults.quests.length > 0) ? '1px solid #21262d' : 'none' }}>
                      <div style={{ padding: '8px 16px 4px', color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Your Reports</div>
                      {searchResults.reports.map((r: any) => (
                        <button key={r.id} onClick={() => { setSearchOpen(false); navigate('/progress') }}
                          style={{ width: '100%', background: 'transparent', border: 'none', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(100,181,246,0.1)', border: '1px solid rgba(100,181,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '16px' }}>📋</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600', textTransform: 'capitalize' }}>{r.type} Analysis</div>
                            <div style={{ color: '#8b949e', fontSize: '11px' }}>{r.mode_context} · {new Date(r.createdat).toLocaleDateString()}</div>
                          </div>
                          <span style={{ color: '#484f58', fontSize: '11px' }}>📊</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {searchQuery && !searchLoading && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#484f58', fontSize: '11px' }}>
                      {searchResults.actions.length + searchResults.players.length + searchResults.quests.length + searchResults.reports.length} result(s)
                    </span>
                    <span style={{ color: '#484f58', fontSize: '11px' }}>Press Esc to close</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <button style={iconBtnStyle}>🔔</button>

          {/* Profile icon + dropdown */}
          <div ref={profileMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileMenuOpen(prev => !prev)}
              style={{
                ...iconBtnStyle,
                padding: '4px',
                borderRadius: '50%',
                border: profileMenuOpen ? '2px solid #4caf50' : '2px solid transparent',
                transition: 'border-color 0.15s',
                overflow: 'hidden',
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '20px' }}>👤</span>
              )}
            </button>

            {/* Dropdown Menu */}
            {profileMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                background: '#161b22', border: '1px solid #30363d',
                borderRadius: '12px', minWidth: '200px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                zIndex: 1000, overflow: 'hidden',
                animation: 'fadeInDown 0.15s ease'
              }}>
                {/* User info header */}
                <div style={{
                  padding: '14px 16px', borderBottom: '1px solid #21262d',
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #4caf50, #2d7a2d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {avatarUrl
                      ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>{user?.playerName?.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div>
                    <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600' }}>{user?.playerName ?? 'Guest'}</div>
                    <div style={{ color: '#8b949e', fontSize: '11px' }}>{currentLevelName}</div>
                  </div>
                </div>

                {/* Menu items */}
                {[
                  { icon: '🖼️', label: 'Profile Image',       action: () => { navigate('/profile'); setProfileMenuOpen(false) } },
                  { icon: '📋', label: 'Details Information',  action: () => { navigate('/profile'); setProfileMenuOpen(false) } },
                  { icon: '📊', label: 'Progress Report',      action: () => { navigate('/progress'); setProfileMenuOpen(false) } },
                  { icon: 'ℹ️', label: 'About',               action: () => { navigate('/profile'); setProfileMenuOpen(false) } },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      color: '#e6edf3', padding: '11px 16px', fontSize: '13px',
                      cursor: 'pointer', textAlign: 'left', display: 'flex',
                      alignItems: 'center', gap: '10px', transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '15px' }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}

                {/* Divider + Log Out */}
                <div style={{ borderTop: '1px solid #21262d' }}>
                  <button
                    onClick={() => { setProfileMenuOpen(false); handleExit() }}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      color: '#f85149', padding: '11px 16px', fontSize: '13px',
                      cursor: 'pointer', textAlign: 'left', display: 'flex',
                      alignItems: 'center', gap: '10px', transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '15px' }}>🚪</span>
                    {isGuest ? 'Exit Guest' : 'Log Out'}
                  </button>
                </div>
              </div>
            )}
          </div>

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
            <h3 style={sidebarTitleStyle}><span>🏆</span> USER LEADERBOARD</h3>
            {isGuest ? (
              <div style={guestPlaceholderStyle}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
                <p>Sign up to see the leaderboard</p>
                <button onClick={() => navigate('/signup')} style={signupBtnStyle}>Sign Up</button>
              </div>
            ) : statsLoading ? (
              <div style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No players yet</div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                  {leaderboard.map((player, i) => {
                    const isMe = player.id === user?.id
                    const rank = i + 1
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
                    return (
                      <div key={player.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '8px',
                        background: isMe ? 'rgba(76,175,80,0.1)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        border: isMe ? '1px solid rgba(76,175,80,0.3)' : '1px solid transparent',
                      }}>
                        <span style={{ fontSize: medal ? '16px' : '11px', minWidth: '24px', textAlign: 'center', color: '#8b949e', fontWeight: '700' }}>
                          {medal ?? `#${rank}`}
                        </span>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                          background: isMe ? 'linear-gradient(135deg, #4caf50, #2d7a2d)' : 'rgba(100,181,246,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: isMe ? 'white' : '#64b5f6' }}>
                            {player.playername.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span style={{ flex: 1, fontSize: '12px', color: isMe ? '#4caf50' : '#e6edf3', fontWeight: isMe ? '700' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.playername}{isMe && <span style={{ fontSize: '10px', color: '#4caf50', marginLeft: '4px', opacity: 0.8 }}>(you)</span>}
                        </span>
                        <span style={{ fontSize: '11px', color: '#ffc107', fontWeight: '600', whiteSpace: 'nowrap' }}>{player.totalxp} XP</span>
                      </div>
                    )
                  })}
                  {myRank && myRank > 10 && (
                    <div style={{ marginTop: '4px', padding: '7px 10px', borderRadius: '8px', background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#4caf50' }}>Your rank: #{myRank}</span>
                      <span style={{ fontSize: '11px', color: '#ffc107' }}>{user?.totalXP ?? 0} XP</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => navigate('/leaderboard')} style={{ ...fullProfileBtnStyle, color: '#ffc107', borderColor: '#ffc107' }}>
                    🏆 View Full Leaderboard
                  </button>
                  <button onClick={() => navigate('/profile')} style={fullProfileBtnStyle}>
                    View Full Profile
                  </button>
                </div>
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

const iconBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: '#8b949e', fontSize: '20px', cursor: 'pointer', padding: '8px' };
const heroSectionStyle: React.CSSProperties = { background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.9) 0%, rgba(30, 36, 47, 0.9) 100%)', borderRadius: '16px', padding: '60px 40px', border: '1px solid #30363d', position: 'relative', overflow: 'hidden', minHeight: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const radialOverlayStyle: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 50% 50%, rgba(100, 181, 246, 0.1) 0%, transparent 70%)' };
const heroTitleStyle: React.CSSProperties = { color: 'white', fontSize: '32px', fontWeight: '700', marginBottom: '12px', background: 'linear-gradient(135deg, #64b5f6 0%, #42a5f5 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const modeCardStyle = (color: string): React.CSSProperties => ({ background: `linear-gradient(135deg, ${color}26 0%, ${color}0D 100%)`, border: `2px solid ${color}`, borderRadius: '16px', padding: '30px 24px', cursor: 'pointer' });
const lockedCardStyle: React.CSSProperties = { background: 'rgba(139, 148, 158, 0.05)', border: '2px solid #30363d', borderRadius: '16px', padding: '30px 24px', cursor: 'not-allowed', opacity: 0.6 };
const cardTitleStyle: React.CSSProperties = { color: 'white', fontSize: '22px', fontWeight: '600', marginBottom: '12px' };
const cardParaStyle: React.CSSProperties = { color: '#8b949e', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' };
const cardBtnStyle = (bg: string): React.CSSProperties => ({ background: bg, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: 'pointer' });
const sidebarCardStyle: React.CSSProperties = { background: 'rgba(22, 27, 34, 0.9)', border: '1px solid #30363d', borderRadius: '16px', padding: '24px' };
const sidebarTitleStyle: React.CSSProperties = { color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' };
const guestPlaceholderStyle: React.CSSProperties = { textAlign: 'center', padding: '20px', color: '#8b949e' };
const signupBtnStyle: React.CSSProperties = { background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' };
const fullProfileBtnStyle: React.CSSProperties = { width: '100%', background: 'transparent', color: '#64b5f6', border: '1px solid #64b5f6', borderRadius: '8px', padding: '10px', fontWeight: '600', cursor: 'pointer' };
const progressBarContainerStyle: React.CSSProperties = { width: '100%', height: '8px', background: 'rgba(100, 181, 246, 0.2)', borderRadius: '4px', overflow: 'hidden' };
const miniStatBoxStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', textAlign: 'center' };