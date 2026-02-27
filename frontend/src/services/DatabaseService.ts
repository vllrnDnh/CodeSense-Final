// src/services/DatabaseService.ts
import { supabase } from './supabase'
import type { ExplorerProfile } from '../types'

export const DatabaseService = {

  // --- AUTHENTICATION ---

  // LOGIN: Looks up real email by playerName, then signs in with Supabase Auth
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
        password: secretCode
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
      console.error('Login Error:', error)
      throw error
    }
  },

  // SIGNUP: Creates Supabase Auth user + public profile
  async signUp(
    playerName: string,
    secretCode: string,
    email: string,
    characterType: 'squire' | 'knight' | 'duke' | 'lord'
  ): Promise<ExplorerProfile> {
    try {
      // 1. Check if playerName is already taken
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('playername', playerName)
        .maybeSingle()

      if (existing) {
        throw new Error('USERNAME_TAKEN')
      }

      // 2. Check if email is already taken
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingEmail) {
        throw new Error('EMAIL_TAKEN')
      }

      // 3. Create Supabase Auth user with real email
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: secretCode,
        options: {
          data: {
            playername: playerName
          }
        }
      })

      if (error || !data.user) {
        throw new Error(error?.message || 'SIGNUP_FAILED')
      }

      // 4. Wait for handle_new_user trigger to fire
      await new Promise(resolve => setTimeout(resolve, 500))

      // 5. Update charactertype, XP starts at 0
      await supabase
        .from('users')
        .update({
          charactertype: characterType,
          totalxp: 0,
          currentlevel: 1
        })
        .eq('id', data.user.id)

      // 6. Fetch final profile
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      return {
        id: data.user.id,
        playerName,
        secretCode: '***',
        characterType,
        totalXP: 0,
        currentLevel: 1,
        createdAt: new Date(profile?.createdat ?? Date.now()),
        lastActive: new Date()
      } as ExplorerProfile

    } catch (error) {
      console.error('SignUp Error:', error)
      throw error
    }
  },

  // GUEST LOGIN: No Supabase auth — pure in-memory session
  async loginAsGuest(): Promise<ExplorerProfile> {
    return {
      id: `guest_${Date.now()}`,
      playerName: `Explorer_${Math.floor(Math.random() * 999)}`,
      secretCode: 'GUEST-SESSION',
      characterType: 'squire',
      totalXP: 0,
      currentLevel: 1,
      createdAt: new Date(),
      lastActive: new Date()
    } as ExplorerProfile
  },

  // LOGOUT: Signs out from Supabase Auth
  async logout(): Promise<void> {
    await supabase.auth.signOut()
  },

  // RESTORE SESSION: Called on app load to restore existing Supabase session
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
      console.error('Restore Session Error:', error)
      return null
    }
  },

  // --- PROGRESS SYSTEM (campaign only, never sandbox) ---

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
      if (newTotal >= 600) newLevel = 4       // Lord
      else if (newTotal >= 300) newLevel = 3  // Duke
      else if (newTotal >= 100) newLevel = 2  // Knight

      const { data: updated } = await supabase
        .from('users')
        .update({
          totalxp: newTotal,
          currentlevel: newLevel,
          lastactive: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (!updated) return null

      return mapProfile(updated)

    } catch (error) {
      console.error('Update XP Error:', error)
      throw error
    }
  },

  // --- SANDBOX (no XP, no rewards) ---

  async logSandboxRun(
    userId: string,
    sourceCode: string,
    cognitiveComplexity: number,
    symbolTable: object
  ): Promise<void> {
    try {
      await supabase.rpc('log_sandbox_run', {
        p_userid: userId,
        p_sourcecode: sourceCode,
        p_cognitive_complexity: cognitiveComplexity,
        p_symbol_table: symbolTable
      })
    } catch (error) {
      console.error('Sandbox log failed (non-critical):', error)
    }
  },

  // --- CAMPAIGN ---

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
        p_userid: userId,
        p_questid: questId,
        p_xp_earned: xpEarned,
        p_complexity_score: complexityScore,
        p_symbol_table: symbolTable,
        p_sourcecode: sourceCode
      })
    } catch (error) {
      console.error('Complete Quest Error:', error)
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

  // --- REPORTS ---

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
        userid: userId,
        type: modeContext === 'sandbox' ? 'summary' : 'progress',
        sourcecode: code,
        narrative,
        mode_context: modeContext,
        cognitive_complexity: cognitiveComplexity ?? null,
        symbol_table: symbolTable ?? null
      })
    } catch (error) {
      console.error('Failed to save report (non-critical):', error)
    }
  }
}

// --- HELPER ---
// Converts raw Supabase row to ExplorerProfile type
function mapProfile(profile: any): ExplorerProfile {
  return {
    id: profile.id,
    playerName: profile.playername,
    secretCode: '***',
    characterType: profile.charactertype,
    totalXP: profile.totalxp,
    currentLevel: profile.currentlevel,
    createdAt: new Date(profile.createdat),
    lastActive: new Date(profile.lastactive)
  } as ExplorerProfile
}