// src/ProfileSettings.tsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './components/AuthScreen'
import { supabase } from './services/supabase'
import { getLevelProgress, getXPToNextLevel, getLevelName, XP_LEVELS } from './types'

interface ProfileData {
  playername: string
  email: string
  totalxp: number
  currentlevel: number
  sandbox_runs: number
  charactertype: string | null
  createdat: string
}

interface LeaderboardEntry {
  rank: number
  userid: string
  users: { playername: string } | null
  totalxp: number
}

export const ProfileSettings: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [cropScale, setCropScale] = useState(1)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropImageRef = useRef<HTMLImageElement | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState<'overview' | 'learn'>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Override global overflow:hidden from layout.css
  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById('root')]
    els.forEach(el => { if (el) el.style.overflow = 'auto' })
    return () => { els.forEach(el => { if (el) el.style.overflow = '' }) }
  }, [])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchAll()
  }, [user?.id])

  const fetchAll = async () => {
    if (!user) return
    try {
      const { data: prof } = await supabase
        .from('users')
        .select('playername, email, totalxp, currentlevel, sandbox_runs, charactertype, createdat')
        .eq('id', user.id)
        .single()
      if (prof) {
        setProfile(prof)
        setEditName(prof.playername)
        setEditEmail(prof.email ?? '')
      }

      const { data: lb } = await supabase
        .from('leaderboard')
        .select('rank, userid, totalxp, users(playername)')
        .order('rank', { ascending: true })
        .limit(10)
      setLeaderboard((lb ?? []) as unknown as LeaderboardEntry[])

      const { data: myLb } = await supabase
        .from('leaderboard')
        .select('rank')
        .eq('userid', user.id)
        .maybeSingle()
      setMyRank(myLb?.rank ?? null)

      const { data: avatarFiles } = await supabase.storage.from('Avatars').list(user.id, { limit: 10 })
      // Filter out folders (folders have no size or id) and find the avatar file
      const avatarFile = avatarFiles?.find(f => f.id && f.name && !f.name.includes('banner') && f.metadata?.mimetype?.startsWith('image/'))
        ?? avatarFiles?.find(f => f.id && f.name && f.name !== 'banner')
      if (avatarFile) {
        const { data: urlData } = supabase.storage.from('Avatars').getPublicUrl(`${user.id}/${avatarFile.name}`)
        setAvatarUrl(urlData.publicUrl + '?t=' + Date.now())
      }

      const { data: bannerFiles } = await supabase.storage.from('Avatars').list(`${user.id}/banner`, { limit: 1 })
      if (bannerFiles && bannerFiles.length > 0) {
        const { data: urlData } = supabase.storage.from('Avatars').getPublicUrl(`${user.id}/banner/${bannerFiles[0].name}`)
        setBannerUrl(urlData.publicUrl + '?t=' + Date.now())
      }
    } catch (e) {
      console.error('ProfileSettings fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB. Please choose a smaller file.')
      e.target.value = ''
      return
    }
    // Open crop modal
    const reader = new FileReader()
    reader.onload = ev => {
      setCropImageSrc(ev.target?.result as string)
      setCropOffset({ x: 0, y: 0 })
      setCropScale(1)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const drawCrop = () => {
    const canvas = cropCanvasRef.current
    const img = cropImageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const size = 280
    canvas.width = size
    canvas.height = size
    ctx.clearRect(0, 0, size, size)
    // Clip to circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
    const scaledW = img.naturalWidth * cropScale
    const scaledH = img.naturalHeight * cropScale
    const x = (size - scaledW) / 2 + cropOffset.x
    const y = (size - scaledH) / 2 + cropOffset.y
    ctx.drawImage(img, x, y, scaledW, scaledH)
    ctx.restore()
    // Circle border
    ctx.strokeStyle = '#4caf50'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
    ctx.stroke()
  }

  const handleCropConfirm = async () => {
    const canvas = cropCanvasRef.current
    if (!canvas || !user) return
    setUploadingAvatar(true)
    setCropModalOpen(false)
    canvas.toBlob(async (blob) => {
      if (!blob) { setUploadingAvatar(false); return }
      try {
        const path = `${user.id}/avatar.webp`
        await supabase.storage.from('Avatars').upload(path, blob, { upsert: true, contentType: 'image/webp' })
        const { data } = supabase.storage.from('Avatars').getPublicUrl(path)
        setAvatarUrl(data.publicUrl + '?t=' + Date.now())
      } catch (e) { console.error(e) }
      finally { setUploadingAvatar(false) }
    }, 'image/webp', 0.92)
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingBanner(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/banner/banner.${ext}`
      await supabase.storage.from('Avatars').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('Avatars').getPublicUrl(path)
      setBannerUrl(data.publicUrl + '?t=' + Date.now())
    } catch (e) { console.error(e) }
    finally { setUploadingBanner(false) }
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('users').update({ playername: editName, email: editEmail }).eq('id', user.id)
      setProfile(prev => prev ? { ...prev, playername: editName, email: editEmail } : prev)
      setIsEditing(false)
      setSaveMsg('Profile updated!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      Loading profile...
    </div>
  )

  if (!profile) return null

  const levelName = getLevelName(profile.currentlevel as 1 | 2 | 3 | 4)
  const levelProgress = getLevelProgress(profile.totalxp)
  const xpToNext = getXPToNextLevel(profile.totalxp)
  const memberSince = new Date(profile.createdat).toLocaleDateString([], { year: 'numeric', month: 'long' })

  const rankIcon = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
      color: 'white', fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      boxSizing: 'border-box' as const
    }}>
      <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
      <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleBannerUpload} />

      {/* ── Crop Modal ── */}
      {cropModalOpen && cropImageSrc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: '16px',
            padding: '28px', width: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
          }}>
            <h3 style={{ color: '#e6edf3', margin: 0, fontSize: '16px', fontWeight: '700' }}>Crop Profile Picture</h3>
            <p style={{ color: '#8b949e', fontSize: '12px', margin: 0, textAlign: 'center' }}>Drag to reposition · Scroll to zoom</p>

            {/* Canvas preview */}
            <div style={{ position: 'relative', cursor: 'grab', userSelect: 'none' }}>
              <img
                ref={cropImageRef}
                src={cropImageSrc}
                onLoad={drawCrop}
                style={{ display: 'none' }}
                alt="crop source"
              />
              <canvas
                ref={cropCanvasRef}
                width={280} height={280}
                style={{ borderRadius: '50%', display: 'block', border: '2px solid #4caf50' }}
                onMouseDown={e => {
                  isDragging.current = true
                  dragStart.current = { x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y }
                }}
                onMouseMove={e => {
                  if (!isDragging.current) return
                  setCropOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
                  setTimeout(drawCrop, 0)
                }}
                onMouseUp={() => { isDragging.current = false }}
                onMouseLeave={() => { isDragging.current = false }}
                onWheel={e => {
                  e.preventDefault()
                  setCropScale(prev => {
                    const next = Math.min(4, Math.max(0.3, prev - e.deltaY * 0.001))
                    setTimeout(drawCrop, 0)
                    return next
                  })
                }}
              />
            </div>

            {/* Zoom slider */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#8b949e', fontSize: '12px' }}>🔍</span>
              <input
                type="range" min={0.3} max={4} step={0.01} value={cropScale}
                onChange={e => { setCropScale(parseFloat(e.target.value)); setTimeout(drawCrop, 0) }}
                style={{ flex: 1, accentColor: '#4caf50' }}
              />
              <span style={{ color: '#8b949e', fontSize: '11px', minWidth: '36px' }}>{Math.round(cropScale * 100)}%</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={() => setCropModalOpen(false)} style={{
                flex: 1, background: 'transparent', border: '1px solid #30363d',
                color: '#8b949e', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
              }}>Cancel</button>
              <button onClick={handleCropConfirm} style={{
                flex: 1, background: '#4caf50', border: 'none',
                color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700'
              }}>✓ Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', background: 'rgba(22,27,34,0.95)',
        borderBottom: '1px solid #21262d', position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(8px)'
      }}>
        <button onClick={() => navigate('/home')} style={{ background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '14px' }}>
          ← Back to Dashboard
        </button>
        <span style={{ color: '#8b949e', fontSize: '13px', fontWeight: '500' }}>Profile Settings</span>
        {saveMsg
          ? <span style={{ color: '#4caf50', fontSize: '12px', fontWeight: '600' }}>✓ {saveMsg}</span>
          : <div style={{ width: '120px' }} />
        }
      </header>

      {/* Main Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px',
        padding: '28px 24px', maxWidth: '1100px', margin: '0 auto',
        boxSizing: 'border-box' as const
      }}>

        {/* ── LEFT ── */}
        <div style={{ minWidth: 0 }}>
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid #21262d', borderRadius: '14px', overflow: 'hidden' }}>

            {/* Banner */}
            <div
              onClick={() => bannerInputRef.current?.click()}
              style={{
                height: '150px', position: 'relative', cursor: 'pointer',
                background: bannerUrl
                  ? `url(${bannerUrl}) center/cover no-repeat`
                  : 'linear-gradient(135deg, #0d2a0d 0%, #1a3a1a 40%, #0d1a2a 100%)',
              }}
            >
              {/* Subtle grid overlay for style */}
              {!bannerUrl && (
                <div style={{
                  position: 'absolute', inset: 0, opacity: 0.15,
                  backgroundImage: 'linear-gradient(rgba(76,175,80,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(76,175,80,0.3) 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }} />
              )}
              <div className="banner-hover-overlay" style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.2s'
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              >
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600', background: 'rgba(0,0,0,0.65)', padding: '7px 16px', borderRadius: '8px' }}>
                  {uploadingBanner ? '⏳ Uploading...' : '📷 Upload Background Photo'}
                </span>
              </div>
            </div>

            {/* Profile body */}
            <div style={{ padding: '0 24px 28px', position: 'relative' }}>

              {/* Avatar */}
              <div style={{ position: 'relative', display: 'inline-block', marginTop: '-46px', marginBottom: '14px' }}>
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    width: '92px', height: '92px', borderRadius: '50%', cursor: 'pointer',
                    border: '4px solid #161b22', overflow: 'hidden', position: 'relative',
                    background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #4caf50, #2d7a2d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '34px', fontWeight: '700', color: 'white' }}>{profile.playername.charAt(0).toUpperCase()}</span>
                  }
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', opacity: 0, transition: 'opacity 0.2s'
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <span style={{ fontSize: '20px' }}>{uploadingAvatar ? '⏳' : '📷'}</span>
                  </div>
                </div>
              </div>

              {/* Edit / Save buttons */}
              <div style={{ position: 'absolute', top: '14px', right: '24px' }}>
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} style={{
                    background: 'transparent', border: '1px solid #30363d',
                    color: '#e6edf3', padding: '7px 16px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleSaveProfile} disabled={saving} style={{
                      background: '#4caf50', border: 'none', color: 'white',
                      padding: '7px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                    }}>
                      {saving ? 'Saving...' : '✓ Save'}
                    </button>
                    <button onClick={() => setIsEditing(false)} style={{
                      background: 'transparent', border: '1px solid #30363d',
                      color: '#8b949e', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer'
                    }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Name / handle */}
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Player name"
                    style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '9px 13px', color: 'white', fontSize: '16px', fontWeight: '700', width: '280px', outline: 'none' }} />
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email"
                    style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '9px 13px', color: '#8b949e', fontSize: '13px', width: '280px', outline: 'none' }} />
                </div>
              ) : (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: '#e6edf3', marginBottom: '3px' }}>{profile.playername}</div>
                  <div style={{ fontSize: '13px', color: '#8b949e' }}>@{profile.playername.toLowerCase().replace(/\s+/g, '')}</div>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #21262d', marginBottom: '22px' }}>
                {(['overview', 'learn'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    background: 'transparent', border: 'none',
                    borderBottom: `2px solid ${activeTab === tab ? '#4caf50' : 'transparent'}`,
                    color: activeTab === tab ? '#4caf50' : '#8b949e',
                    padding: '10px 22px', fontSize: '13px', fontWeight: '600',
                    cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
                    marginBottom: '-1px'
                  }}>
                    {tab === 'overview' ? '📋 Overview' : '📚 Learn'}
                  </button>
                ))}
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {[
                      { label: 'Total XP', value: profile.totalxp, color: '#ffc107', icon: '⭐' },
                      { label: 'Sandbox Runs', value: profile.sandbox_runs, color: '#4caf50', icon: '🔬' },
                      { label: 'Rank', value: myRank ? `#${myRank}` : 'N/A', color: '#a855f7', icon: '🏆' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '22px', marginBottom: '6px' }}>{s.icon}</div>
                        <div style={{ color: s.color, fontSize: '22px', fontWeight: '700' }}>{s.value}</div>
                        <div style={{ color: '#8b949e', fontSize: '11px', marginTop: '2px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '10px', padding: '18px' }}>
                    <div style={{ color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>About</div>
                    {[
                      { label: 'Current Rank', value: levelName, icon: '🎖️' },
                      { label: 'Character Type', value: profile.charactertype ?? 'Not set', icon: '🧙' },
                      { label: 'Member Since', value: memberSince, icon: '📅' },
                      { label: 'Email', value: profile.email ?? 'Not set', icon: '📧' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #21262d' }}>
                        <span style={{ color: '#8b949e', fontSize: '12px' }}>{item.icon} {item.label}</span>
                        <span style={{ color: '#e6edf3', fontSize: '12px', fontWeight: '500' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learn Tab */}
              {activeTab === 'learn' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '10px', padding: '18px' }}>
                    <div style={{ color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '14px' }}>Rank Progression Path</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {([1, 2, 3, 4] as const).map(lvl => {
                        const name = getLevelName(lvl)
                        const threshold = XP_LEVELS[lvl].minXP
                        const isReached = profile.totalxp >= threshold
                        const isCurrent = profile.currentlevel === lvl
                        return (
                          <div key={lvl} style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '12px 14px', borderRadius: '10px',
                            background: isCurrent ? 'rgba(76,175,80,0.08)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isCurrent ? 'rgba(76,175,80,0.35)' : '#21262d'}`
                          }}>
                            <span style={{ fontSize: '22px' }}>{lvl === 1 ? '🛡️' : lvl === 2 ? '⚔️' : lvl === 3 ? '👑' : '🌟'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: isReached ? '#4caf50' : '#484f58' }}>{name}</div>
                              <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '1px' }}>Requires {threshold} XP</div>
                            </div>
                            {isCurrent && <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: '700', background: 'rgba(76,175,80,0.15)', padding: '3px 10px', borderRadius: '10px' }}>CURRENT</span>}
                            {isReached && !isCurrent && <span style={{ fontSize: '16px' }}>✅</span>}
                            {!isReached && <span style={{ fontSize: '10px', color: '#484f58' }}>🔒</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: '10px', padding: '18px' }}>
                    <div style={{ color: '#8b949e', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>How to Earn XP</div>
                    {[
                      { action: 'Complete a campaign quest', xp: '+Base XP (varies)', icon: '⚔️' },
                      { action: 'Complete without hints', xp: 'Bonus XP', icon: '🎯' },
                      { action: 'Run sandbox analysis', xp: 'Activity tracked', icon: '🔬' },
                    ].map(tip => (
                      <div key={tip.action} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #21262d' }}>
                        <span style={{ fontSize: '18px' }}>{tip.icon}</span>
                        <span style={{ flex: 1, fontSize: '12px', color: '#e6edf3' }}>{tip.action}</span>
                        <span style={{ fontSize: '11px', color: '#4caf50', fontWeight: '600' }}>{tip.xp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Leaderboard */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid #21262d', borderRadius: '14px', padding: '20px' }}>
            <h3 style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '700', margin: '0 0 14px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              🏆 User Leaderboard
            </h3>
            {leaderboard.length === 0 ? (
              <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>No leaderboard data yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {leaderboard.map((entry, i) => {
                  const isMe = entry.userid === user?.id
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 10px', borderRadius: '8px',
                      background: isMe ? 'rgba(76,175,80,0.1)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      border: isMe ? '1px solid rgba(76,175,80,0.3)' : '1px solid transparent',
                      transition: 'background 0.15s'
                    }}>
                      <span style={{ fontSize: entry.rank <= 3 ? '16px' : '11px', minWidth: '22px', textAlign: 'center', color: '#8b949e', fontWeight: '700' }}>
                        {rankIcon(entry.rank)}
                      </span>
                      <span style={{ flex: 1, fontSize: '12px', color: isMe ? '#4caf50' : '#e6edf3', fontWeight: isMe ? '700' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(entry.users as any)?.playername ?? 'Unknown'}
                        {isMe && <span style={{ fontSize: '9px', color: '#4caf50', marginLeft: '5px', opacity: 0.8 }}>(you)</span>}
                      </span>
                      <span style={{ fontSize: '11px', color: '#ffc107', fontWeight: '600', whiteSpace: 'nowrap' }}>{entry.totalxp ?? 0} XP</span>
                    </div>
                  )
                })}
                {myRank && myRank > 10 && (
                  <div style={{ marginTop: '6px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.2)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#4caf50' }}>Your rank: #{myRank}</span>
                    <span style={{ fontSize: '11px', color: '#ffc107' }}>{profile.totalxp} XP</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Progress Results */}
          <div style={{ background: 'rgba(22,27,34,0.9)', border: '1px solid #21262d', borderRadius: '14px', padding: '20px' }}>
            <h3 style={{ color: '#e6edf3', fontSize: '13px', fontWeight: '700', margin: '0 0 14px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              📊 Progress Results
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>Current Rank</span>
              <span style={{ fontSize: '12px', color: '#64b5f6', fontWeight: '700' }}>{levelName}</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '11px', color: '#8b949e' }}>{profile.totalxp} XP earned</span>
                <span style={{ fontSize: '11px', color: '#ffc107', fontWeight: '700' }}>{levelProgress}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  width: `${levelProgress}%`, height: '100%',
                  background: 'linear-gradient(90deg, #4caf50, #66bb6a)',
                  borderRadius: '6px', transition: 'width 0.6s ease'
                }} />
              </div>
              <div style={{ fontSize: '10px', color: '#484f58', marginTop: '4px', textAlign: 'right' }}>
                {xpToNext === null ? '🌟 Max rank reached!' : `${xpToNext} XP to next rank`}
              </div>
            </div>

            {/* Rank icons path */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              {([1, 2, 3, 4] as const).map((lvl, i) => {
                const isReached = profile.totalxp >= XP_LEVELS[lvl].minXP
                const isCurrent = profile.currentlevel === lvl
                return (
                  <React.Fragment key={lvl}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', filter: isReached ? 'none' : 'grayscale(1) opacity(0.25)' }}>
                        {lvl === 1 ? '🛡️' : lvl === 2 ? '⚔️' : lvl === 3 ? '👑' : '🌟'}
                      </div>
                      {isCurrent && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4caf50', margin: '3px auto 0' }} />}
                    </div>
                    {i < 3 && <div style={{ flex: 1, height: '1px', background: isReached ? 'rgba(76,175,80,0.5)' : '#21262d', margin: '0 4px' }} />}
                  </React.Fragment>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'Sandbox Runs', value: profile.sandbox_runs, color: '#4caf50' },
                { label: 'Leaderboard', value: myRank ? `#${myRank}` : 'Unranked', color: '#a855f7' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #21262d' }}>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>{s.label}</span>
                  <span style={{ fontSize: '12px', color: s.color, fontWeight: '700' }}>{s.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/progress')}
              style={{
                width: '100%', padding: '10px',
                background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
                borderRadius: '8px', color: '#4caf50', fontSize: '12px',
                fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(76,175,80,0.1)')}
            >
              View Full Progress Report →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}