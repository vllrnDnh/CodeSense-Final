// src/LeaderboardPage.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './components/AuthScreen'
import { supabase } from './services/supabase'
import { getLevelName } from './types'

interface Player {
  id: string
  playername: string
  totalxp: number
  currentlevel: number
  sandbox_runs: number
  createdat: string
}

const PAGE_SIZE = 20

export const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [players, setPlayers] = useState<Player[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myPlayer, setMyPlayer] = useState<Player | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Override overflow:hidden from layout.css
  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById('root')]
    els.forEach(el => { if (el) el.style.overflow = 'auto' })
    return () => { els.forEach(el => { if (el) el.style.overflow = '' }) }
  }, [])

  useEffect(() => {
    fetchPlayers()
  }, [page, searchQuery])

  // Fetch my rank on mount
  useEffect(() => {
    if (!user) return
    const fetchMyRank = async () => {
      const { data: me } = await supabase
        .from('users').select('id, playername, totalxp, currentlevel, sandbox_runs, createdat')
        .eq('id', user.id).single()
      if (me) {
        setMyPlayer(me)
        const { count } = await supabase
          .from('users').select('*', { count: 'exact', head: true })
          .eq('isactive', true).gt('totalxp', me.totalxp)
        setMyRank((count ?? 0) + 1)
      }
    }
    fetchMyRank()

    // Realtime
    const channel = supabase.channel('lb-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchPlayers()
        fetchMyRank()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const fetchPlayers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('users')
        .select('id, playername, totalxp, currentlevel, sandbox_runs, createdat', { count: 'exact' })
        .eq('isactive', true)
        .order('totalxp', { ascending: false })

      if (searchQuery.trim()) {
        query = query.ilike('playername', `%${searchQuery.trim()}%`)
      } else {
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      }

      const { data, count } = await query
      setPlayers(data ?? [])
      setTotal(count ?? 0)
    } catch (e) {
      console.error('Leaderboard fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(val)
      setPage(0)
    }, 300)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const rankIcon = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  const rankColor = (rank: number) =>
    rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#8b949e'

  const globalRank = (i: number) => searchQuery ? null : page * PAGE_SIZE + i + 1

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      color: 'white', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      boxSizing: 'border-box' as const
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 32px', background: 'rgba(22,27,34,0.95)',
        borderBottom: '1px solid #21262d', position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(8px)'
      }}>
        <button onClick={() => navigate('/home')} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px' }}>
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>🏆</span>
          <span style={{ color: '#e6edf3', fontSize: '18px', fontWeight: '700' }}>Leaderboard</span>
        </div>
        <div style={{ color: '#8b949e', fontSize: '12px' }}>
          {total > 0 && `${total} player${total !== 1 ? 's' : ''}`}
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 24px', boxSizing: 'border-box' as const }}>

        {/* My rank banner */}
        {myPlayer && myRank && !searchQuery && (
          <div style={{
            background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.3)',
            borderRadius: '14px', padding: '16px 20px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '16px'
          }}>
            <div style={{ fontSize: '28px', minWidth: '36px', textAlign: 'center' }}>
              {rankIcon(myRank)}
            </div>
            <div style={{
              width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #4caf50, #2d7a2d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>
                {myPlayer.playername.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#4caf50', fontSize: '14px', fontWeight: '700' }}>
                {myPlayer.playername} <span style={{ fontSize: '11px', opacity: 0.7 }}>(you)</span>
              </div>
              <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
                {getLevelName(myPlayer.currentlevel as 1|2|3|4)} · {myPlayer.totalxp} XP · {myPlayer.sandbox_runs} sandbox runs
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#8b949e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Rank</div>
              <div style={{ color: '#4caf50', fontSize: '24px', fontWeight: '800' }}>#{myRank}</div>
            </div>
          </div>
        )}

        {/* Top 3 podium — only show on page 0 without search */}
        {!searchQuery && page === 0 && players.length >= 3 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', marginBottom: '32px' }}>
            {/* 2nd */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🥈</div>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 8px',
                background: 'linear-gradient(135deg, #9e9e9e, #616161)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid #c0c0c0', fontSize: '22px', fontWeight: '800', color: 'white'
              }}>
                {players[1].playername.charAt(0).toUpperCase()}
              </div>
              <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{players[1].playername}</div>
              <div style={{ color: '#ffc107', fontSize: '12px', fontWeight: '700' }}>{players[1].totalxp} XP</div>
              <div style={{ height: '60px', background: 'rgba(192,192,192,0.15)', border: '1px solid rgba(192,192,192,0.3)', borderRadius: '8px 8px 0 0', marginTop: '8px' }} />
            </div>
            {/* 1st */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🥇</div>
              <div style={{
                width: '68px', height: '68px', borderRadius: '50%', margin: '0 auto 8px',
                background: 'linear-gradient(135deg, #ffc107, #ff8f00)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid #ffd700', fontSize: '28px', fontWeight: '800', color: 'white',
                boxShadow: '0 0 20px rgba(255,193,7,0.4)'
              }}>
                {players[0].playername.charAt(0).toUpperCase()}
              </div>
              <div style={{ color: '#e6edf3', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>{players[0].playername}</div>
              <div style={{ color: '#ffc107', fontSize: '13px', fontWeight: '700' }}>{players[0].totalxp} XP</div>
              <div style={{ height: '80px', background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: '8px 8px 0 0', marginTop: '8px' }} />
            </div>
            {/* 3rd */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🥉</div>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 8px',
                background: 'linear-gradient(135deg, #a1887f, #6d4c41)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid #cd7f32', fontSize: '22px', fontWeight: '800', color: 'white'
              }}>
                {players[2].playername.charAt(0).toUpperCase()}
              </div>
              <div style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{players[2].playername}</div>
              <div style={{ color: '#ffc107', fontSize: '12px', fontWeight: '700' }}>{players[2].totalxp} XP</div>
              <div style={{ height: '44px', background: 'rgba(205,127,50,0.15)', border: '1px solid rgba(205,127,50,0.3)', borderRadius: '8px 8px 0 0', marginTop: '8px' }} />
            </div>
          </div>
        )}

        {/* Search bar */}
        <div style={{
          background: 'rgba(22,27,34,0.9)', border: '1px solid #21262d',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span style={{ fontSize: '16px', opacity: 0.5 }}>🔍</span>
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search players by name..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e6edf3', fontSize: '14px'
            }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(0) }}
              style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '18px', padding: 0 }}>×</button>
          )}
          {searchQuery && (
            <span style={{ color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap' }}>
              {players.length} result{players.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Players table */}
        <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid #21262d', borderRadius: '14px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '52px 1fr 100px 100px 90px',
            padding: '10px 20px', borderBottom: '1px solid #21262d',
            background: 'rgba(255,255,255,0.02)'
          }}>
            {['RANK', 'PLAYER', 'LEVEL', 'XP', 'RUNS'].map(h => (
              <div key={h} style={{ color: '#484f58', fontSize: '10px', fontWeight: '700', letterSpacing: '1.2px' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#8b949e', fontSize: '13px' }}>
              Loading players...
            </div>
          ) : players.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#484f58', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>😶</div>
              No players found{searchQuery ? ` for "${searchQuery}"` : ''}
            </div>
          ) : (
            players.map((player, i) => {
              const rank = globalRank(i)
              const isMe = player.id === user?.id
              return (
                <div key={player.id} style={{
                  display: 'grid', gridTemplateColumns: '52px 1fr 100px 100px 90px',
                  padding: '14px 20px', borderBottom: '1px solid #21262d',
                  background: isMe ? 'rgba(76,175,80,0.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  transition: 'background 0.15s', cursor: 'default',
                  borderLeft: isMe ? '3px solid #4caf50' : '3px solid transparent'
                }}
                  onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!isMe) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                >
                  {/* Rank */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {rank ? (
                      <span style={{ fontSize: rank <= 3 ? '18px' : '13px', fontWeight: '700', color: rankColor(rank) }}>
                        {rankIcon(rank)}
                      </span>
                    ) : (
                      <span style={{ color: '#8b949e', fontSize: '12px' }}>—</span>
                    )}
                  </div>

                  {/* Player */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                      background: isMe
                        ? 'linear-gradient(135deg, #4caf50, #2d7a2d)'
                        : rank && rank <= 3
                          ? ['linear-gradient(135deg,#ffc107,#ff8f00)', 'linear-gradient(135deg,#9e9e9e,#616161)', 'linear-gradient(135deg,#a1887f,#6d4c41)'][rank - 1]
                          : 'rgba(100,181,246,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: isMe ? '2px solid rgba(76,175,80,0.5)' : '2px solid transparent'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: isMe ? 'white' : '#64b5f6' }}>
                        {player.playername.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: isMe ? '#4caf50' : '#e6edf3', fontSize: '13px', fontWeight: isMe ? '700' : '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {player.playername}
                        {isMe && <span style={{ fontSize: '10px', color: '#4caf50', marginLeft: '6px', opacity: 0.8 }}>(you)</span>}
                      </div>
                      <div style={{ color: '#484f58', fontSize: '11px' }}>
                        Joined {new Date(player.createdat).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Level */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#64b5f6', fontSize: '12px', fontWeight: '600' }}>
                      {getLevelName(player.currentlevel as 1|2|3|4)}
                    </span>
                  </div>

                  {/* XP */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#ffc107', fontSize: '13px', fontWeight: '700' }}>{player.totalxp}</span>
                    <span style={{ color: '#484f58', fontSize: '10px', marginLeft: '3px' }}>XP</span>
                  </div>

                  {/* Sandbox runs */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: '#4caf50', fontSize: '12px', fontWeight: '600' }}>{player.sandbox_runs}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination — only when not searching */}
        {!searchQuery && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
            <button
              onClick={() => setPage(0)} disabled={page === 0}
              style={{ ...pageBtnStyle, opacity: page === 0 ? 0.3 : 1 }}>«</button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ ...pageBtnStyle, opacity: page === 0 ? 0.3 : 1 }}>‹</button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5))
              const p = start + i
              return (
                <button key={p} onClick={() => setPage(p)} style={{
                  ...pageBtnStyle,
                  background: p === page ? '#4caf50' : 'transparent',
                  color: p === page ? 'white' : '#8b949e',
                  border: p === page ? '1px solid #4caf50' : '1px solid #30363d',
                  fontWeight: p === page ? '700' : '400'
                }}>{p + 1}</button>
              )
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ ...pageBtnStyle, opacity: page >= totalPages - 1 ? 0.3 : 1 }}>›</button>
            <button
              onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
              style={{ ...pageBtnStyle, opacity: page >= totalPages - 1 ? 0.3 : 1 }}>»</button>

            <span style={{ color: '#484f58', fontSize: '12px', marginLeft: '8px' }}>
              Page {page + 1} of {totalPages}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const pageBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #30363d', color: '#8b949e',
  width: '34px', height: '34px', borderRadius: '8px', cursor: 'pointer',
  fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s'
}