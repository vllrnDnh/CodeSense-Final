// src/services/DatabaseService.ts
import { supabase } from './supabase'
import type { ExplorerProfile } from '../types'

export const DatabaseService = {

  // ── AUTHENTICATION ──────────────────────────────────────────────────────────

  // LOGIN: Looks up the real email by playerName, then signs in with Supabase Auth
  async login(playerName: string, secretCode: string): Promise<ExplorerProfile> {
    try {
      // 1. Look up the real email from public.users by playerName
      const { data: userRow, error: lookupError } = await supabase
        .from('users')
        .select('email')
        .eq('playername', playerName)
        .maybeSingle()

      if (lookupError || !userRow?.email) {
        throw new Error('INVALID_CREDENTIALS')
      }

      // 2. Sign in with their real email + secretCode
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userRow.email,
        password: secretCode,
      })

      if (error || !data.user) {
        throw new Error('INVALID_CREDENTIALS')
      }

      // 3. Fetch full profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        throw new Error('PROFILE_NOT_FOUND')
      }

      // 4. Update lastactive
      await supabase
        .from('users')
        .update({ lastactive: new Date().toISOString() })
        .eq('id', data.user.id)

      return mapProfile(profile)

    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },

  // SIGNUP: Creates a Supabase Auth user and a public.users profile row.
  //
  // KEY FIXES vs. the old version:
  //  1. Username/email uniqueness is checked via Supabase Auth signUp()
  //     returning an error, NOT by querying public.users before the auth user
  //     exists (that query fails silently under RLS for anon callers).
  //  2. After signUp(), we poll for the trigger-created row instead of using
  //     a fixed 500 ms timeout — the trigger can take 1–3 s under cold starts.
  //  3. All thrown errors carry distinct codes so the UI can show precise
  //     messages instead of the generic "name may be taken" fallback.
  async signUp(
    playerName: string,
    secretCode: string,
    email: string,
    characterType: 'squire' | 'knight' | 'duke' | 'lord'
  ): Promise<ExplorerProfile> {
    try {
      // ── Step 1: Create the Supabase Auth user ──────────────────────────────
      // Pass playerName in metadata so the DB trigger can write it to
      // public.users.playername without a separate update call.
      const { data, error } = await supabase.auth.signUp({
        email,
        password: secretCode,
        options: {
          data: { playername: playerName },
        },
      })

      // Supabase returns specific error messages we can map to friendly copy:
      //   "User already registered"         → duplicate email in auth.users
      //   "duplicate key … playername"      → duplicate name in public.users
      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          throw new Error('EMAIL_TAKEN')
        }
        if (msg.includes('playername') || msg.includes('username')) {
          throw new Error('USERNAME_TAKEN')
        }
        throw new Error(error.message)
      }

      if (!data.user) {
        throw new Error('SIGNUP_FAILED')
      }

      const userId = data.user.id

      // ── Step 2: Poll for the trigger-created public.users row ──────────────
      // The handle_new_user trigger runs asynchronously; we retry up to 10×
      // with 400 ms gaps (4 s total) before giving up.
      let profile: any = null
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 400))
        const { data: row, error: rowErr } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (!rowErr && row) { profile = row; break }
      }

      // ── Step 3: If trigger never fired, insert the row manually ───────────
      // This is a safe fallback: if your DB trigger is missing or disabled,
      // signup still works.
      if (!profile) {
        const { data: inserted, error: insertErr } = await supabase
          .from('users')
          .insert({
            id:            userId,
            playername:    playerName,
            email:         email,
            charactertype: characterType,
            totalxp:       0,
            currentlevel:  1,
            createdat:     new Date().toISOString(),
            lastactive:    new Date().toISOString(),
          })
          .select()
          .single()

        if (insertErr) {
          // Duplicate playername constraint from the DB
          if (insertErr.message.toLowerCase().includes('playername') ||
              insertErr.code === '23505') {
            throw new Error('USERNAME_TAKEN')
          }
          throw new Error(insertErr.message)
        }

        profile = inserted
      }

      // ── Step 4: Update characterType (trigger sets a default) ─────────────
      await supabase
        .from('users')
        .update({
          charactertype: characterType,
          playername:    playerName,   // ensure name is correct even if trigger used metadata
          totalxp:       0,
          currentlevel:  1,
        })
        .eq('id', userId)

      return {
        id:            userId,
        playerName,
        secretCode:    '***',
        characterType,
        totalXP:       0,
        currentLevel:  1,
        createdAt:     new Date(profile?.createdat ?? Date.now()),
        lastActive:    new Date(),
      } as ExplorerProfile

    } catch (error) {
      console.error('SignUp error:', error)
      throw error
    }
  },

  // GUEST LOGIN: No Supabase auth — pure in-memory session
  async loginAsGuest(): Promise<ExplorerProfile> {
    return {
      id:            `guest_${Date.now()}`,
      playerName:    `Explorer_${Math.floor(Math.random() * 999)}`,
      secretCode:    'GUEST-SESSION',
      characterType: 'squire',
      totalXP:       0,
      currentLevel:  1,
      createdAt:     new Date(),
      lastActive:    new Date(),
    } as ExplorerProfile
  },

  // LOGOUT: Signs out from Supabase Auth
  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  // RESTORE SESSION: Called on app load to restore an existing Supabase session
  async restoreSession(): Promise<ExplorerProfile | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return null

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!profile) return null
      return mapProfile(profile)

    } catch (error) {
      console.error('Restore session error:', error)
      return null
    }
  },

  // ── PROGRESS SYSTEM ─────────────────────────────────────────────────────────

  async addXP(userId: string, xpEarned: number): Promise<ExplorerProfile | null> {
    try {
      const { data: current } = await supabase
        .from('users')
        .select('totalxp, currentlevel, playername, charactertype, createdat')
        .eq('id', userId)
        .single()

      if (!current) return null

      const newTotal = (current.totalxp || 0) + xpEarned
      let newLevel: 1 | 2 | 3 | 4 = 1
      if      (newTotal >= 600) newLevel = 4   // Lord
      else if (newTotal >= 300) newLevel = 3   // Duke
      else if (newTotal >= 100) newLevel = 2   // Knight

      const { data: updated } = await supabase
        .from('users')
        .update({
          totalxp:    newTotal,
          currentlevel: newLevel,
          lastactive: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single()

      if (!updated) return null
      return mapProfile(updated)

    } catch (error) {
      console.error('Update XP error:', error)
      throw error
    }
  },

  // ── SANDBOX ─────────────────────────────────────────────────────────────────

  async logSandboxRun(
    userId: string,
    sourceCode: string,
    cognitiveComplexity: number,
    symbolTable: object
  ): Promise<void> {
    try {
      await supabase.rpc('log_sandbox_run', {
        p_userid:               userId,
        p_sourcecode:           sourceCode,
        p_cognitive_complexity: cognitiveComplexity,
        p_symbol_table:         symbolTable,
      })
    } catch (error) {
      console.error('Sandbox log failed (non-critical):', error)
    }
  },

  // ── CAMPAIGN ────────────────────────────────────────────────────────────────

  async completeQuest(
    userId: string,
    questId: string,
    xpEarned: number,
    complexityScore: number,
    symbolTable: object,
    sourceCode: string
  ): Promise<void> {
    try {
      await supabase.rpc('complete_campaign_quest', {
        p_userid:           userId,
        p_questid:          questId,
        p_xp_earned:        xpEarned,
        p_complexity_score: complexityScore,
        p_symbol_table:     symbolTable,
        p_sourcecode:       sourceCode,
      })
    } catch (error) {
      console.error('Complete quest error:', error)
      throw error
    }
  },

  async getQuests(phase: 'beginner' | 'intermediate' | 'advanced') {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .eq('mode', 'campaign')
      .eq('phase', phase)
      .eq('isactive', true)
      .order('sortorder', { ascending: true })

    if (error) throw error
    return data
  },

  async getMissionProgress(userId: string) {
    const { data, error } = await supabase
      .from('mission_progress')
      .select('*, quests(*)')
      .eq('userid', userId)

    if (error) throw error
    return data
  },

  async getLeaderboard(limit = 10) {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data
  },

  // ── REPORTS ─────────────────────────────────────────────────────────────────

  async saveAnalysisReport(
    userId: string,
    code: string,
    narrative: string[],
    modeContext: 'sandbox' | 'campaign' = 'sandbox',
    cognitiveComplexity?: number,
    symbolTable?: object
  ): Promise<void> {
    try {
      await supabase.from('reports').insert({
        userid:               userId,
        type:                 modeContext === 'sandbox' ? 'summary' : 'progress',
        sourcecode:           code,
        narrative,
        mode_context:         modeContext,
        cognitive_complexity: cognitiveComplexity ?? null,
        symbol_table:         symbolTable ?? null,
      })
    } catch (error) {
      console.error('Failed to save report (non-critical):', error)
    }
  },
}

// ── HELPER ───────────────────────────────────────────────────────────────────
function mapProfile(profile: any): ExplorerProfile {
  return {
    id:            profile.id,
    playerName:    profile.playername,
    secretCode:    '***',
    characterType: profile.charactertype,
    totalXP:       profile.totalxp,
    currentLevel:  profile.currentlevel,
    createdAt:     new Date(profile.createdat),
    lastActive:    new Date(profile.lastactive),
  } as ExplorerProfile
}