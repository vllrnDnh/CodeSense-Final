/**
 * DataIsolationService
 * 
 * Ensures complete data separation between:
 * 1. Guest users (temporary, limited access)
 * 2. Authenticated users (each with unique isolated data)
 * 
 * This prevents users from sharing progress, accessing each other's data,
 * or overloading the server with shared resources.
 */

export class DataIsolationService {
  private static readonly GUEST_PREFIX = 'guest_';
  private static readonly USER_PREFIX = 'user_';
  //private static readonly PROGRESS_PREFIX = 'progress_';
  private static readonly SANDBOX_PREFIX = 'sandbox_';

  /**
   * Get user-specific storage key
   */
  private static getUserKey(userId: string, dataType: string): string {
    return `${this.USER_PREFIX}${userId}_${dataType}`;
  }

  /**
   * Get guest-specific storage key (session-based)
   */
  private static getGuestKey(dataType: string): string {
    const guestSessionId = this.getOrCreateGuestSession();
    return `${this.GUEST_PREFIX}${guestSessionId}_${dataType}`;
  }

  /**
   * Create or retrieve guest session ID
   */
  private static getOrCreateGuestSession(): string {
    let sessionId = sessionStorage.getItem('guestSessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('guestSessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Save user progress (isolated per user)
   */
  static saveUserProgress(userId: string, progress: any): void {
    const key = this.getUserKey(userId, 'progress');
    const data = {
      ...progress,
      userId,
      lastUpdated: new Date().toISOString(),
      version: '1.0'
    };
    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Get user progress (only their own data)
   */
  static getUserProgress(userId: string): any | null {
    const key = this.getUserKey(userId, 'progress');
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Save guest progress (temporary, session-based)
   */
  static saveGuestProgress(progress: any): void {
    const key = this.getGuestKey('progress');
    const data = {
      ...progress,
      isGuest: true,
      sessionId: this.getOrCreateGuestSession(),
      lastUpdated: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    };
    sessionStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Get guest progress (session-specific)
   */
  static getGuestProgress(): any | null {
    const key = this.getGuestKey('progress');
    const data = sessionStorage.getItem(key);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    
    // Check if expired
    if (new Date(parsed.expiresAt) < new Date()) {
      this.clearGuestData();
      return null;
    }
    
    return parsed;
  }

  /**
   * Save sandbox code (isolated per user/guest)
   */
  static saveSandboxCode(userId: string | null, code: string, filename: string): void {
    const key = userId 
      ? this.getUserKey(userId, `${this.SANDBOX_PREFIX}${filename}`)
    : this.getGuestKey(`${this.SANDBOX_PREFIX}${filename}`);
    
    const data = {
      code,
      filename,
      savedAt: new Date().toISOString(),
      userId: userId || 'guest'
    };
    
    if (userId) {
      localStorage.setItem(key, JSON.stringify(data));
    } else {
      sessionStorage.setItem(key, JSON.stringify(data));
    }
  }

  /**
   * Get sandbox code (only user's own code)
   */
  static getSandboxCode(userId: string | null, filename: string): string | null {
    const key = userId 
      ? this.getUserKey(userId, `sandbox_${filename}`)
      : this.getGuestKey(`sandbox_${filename}`);
    
    const data = userId 
      ? localStorage.getItem(key)
      : sessionStorage.getItem(key);
    
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return parsed.code;
  }

  /**
   * List all sandbox files for user/guest
   */
  static listSandboxFiles(userId: string | null): string[] {
    const prefix = userId 
     ? this.getUserKey(userId, this.SANDBOX_PREFIX)
    : this.getGuestKey(this.SANDBOX_PREFIX);
    
    const storage = userId ? localStorage : sessionStorage;
    const files: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        const data = storage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          files.push(parsed.filename);
        }
      }
    }
    
    return files;
  }

  /**
   * Save campaign progress (users only)
   */
  static saveCampaignProgress(userId: string, level: number, mission: number, data: any): void {
    const key = this.getUserKey(userId, `campaign_${level}_${mission}`);
    const progressData = {
      ...data,
      level,
      mission,
      completedAt: new Date().toISOString(),
      userId
    };
    localStorage.setItem(key, JSON.stringify(progressData));
  }

  /**
   * Get campaign progress (users only)
   */
  static getCampaignProgress(userId: string, level: number, mission: number): any | null {
    const key = this.getUserKey(userId, `campaign_${level}_${mission}`);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Clear all guest data
   */
  static clearGuestData(): void {
    const sessionId = sessionStorage.getItem('guestSessionId');
    if (!sessionId) return;
    
    const prefix = `${this.GUEST_PREFIX}${sessionId}_`;
    
    // Clear from sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    sessionStorage.removeItem('guestSessionId');
  }

  /**
   * Clear all user data (on account deletion)
   */
  static clearUserData(userId: string): void {
    const prefix = this.getUserKey(userId, '');
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Migrate guest data to user account (on signup)
   */
  static migrateGuestToUser(userId: string): void {
    const guestProgress = this.getGuestProgress();
    if (!guestProgress) return;
    
    // Migrate progress
    this.saveUserProgress(userId, {
      sandboxProgress: guestProgress.sandboxProgress || {},
      exploredNodes: guestProgress.exploredNodes || [],
      completedChallenges: guestProgress.completedChallenges || []
    });
    
    // Migrate sandbox files
    const guestFiles = this.listSandboxFiles(null);
    guestFiles.forEach(filename => {
      const code = this.getSandboxCode(null, filename);
      if (code) {
        this.saveSandboxCode(userId, code, filename);
      }
    });
    
    // Clear guest data after migration
    this.clearGuestData();
  }

  /**
   * Get storage usage stats
   */
  static getStorageStats(userId: string | null): {
    totalKeys: number;
    totalSize: number;
    files: number;
  } {
    const prefix = userId 
      ? this.getUserKey(userId, '')
      : this.getGuestKey('');
    
    const storage = userId ? localStorage : sessionStorage;
    let totalKeys = 0;
    let totalSize = 0;
    let files = 0;
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        totalKeys++;
        const value = storage.getItem(key);
        if (value) {
          totalSize += value.length;
          if (key.includes('sandbox_')) {
            files++;
          }
        }
      }
    }
    
    return { totalKeys, totalSize, files };
  }

  /**
   * Check if user can access campaign mode
   */
  static canAccessCampaign(isGuest: boolean): boolean {
    return !isGuest;
  }

  /**
   * Check if user can save progress permanently
   */
  static canSavePermanently(isGuest: boolean): boolean {
    return !isGuest;
  }

  /**
   * Get guest limitations
   */
  static getGuestLimitations(): {
    maxSandboxFiles: number;
    maxCodeSize: number;
    sessionDuration: number;
  } {
    return {
      maxSandboxFiles: 5,
      maxCodeSize: 10000, // characters
      sessionDuration: 24 * 60 * 60 * 1000 // 24 hours in ms
    };
  }
}