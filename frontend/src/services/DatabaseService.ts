import { db } from './firebase';
import { 
  collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, serverTimestamp, limit 
} from "firebase/firestore";
import type { ExplorerProfile } from '../types';

export const DatabaseService = {
  
  // --- AUTHENTICATION ---

  // LOGIN: Verifies credentials
  async login(playerName: string, secretCode: string): Promise<ExplorerProfile> {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef, 
        where("playerName", "==", playerName),
        where("secretCode", "==", secretCode),
        limit(1) // Optimization: Stop searching after finding one
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("INVALID_CREDENTIALS");
      }
      
      // Merge ID into the data just in case
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      
      return { 
        id: docSnap.id, 
        ...data,
        // Conversion for Firestore Timestamps to JS Dates
        createdAt: data.createdAt?.toDate?.() || new Date(),
        lastActive: data.lastActive?.toDate?.() || new Date(),
      } as ExplorerProfile;
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  },

  // SIGNUP: Creates new user (With Duplicate Check)
  async signUp(playerName: string, secretCode: string, characterType: 'squire' | 'knight' | 'duke' | 'lord'): Promise<ExplorerProfile> {
    try {
      const usersRef = collection(db, "users");
      
      // 1. CRITICAL CHECK: Does this name exist?
      const q = query(usersRef, where("playerName", "==", playerName));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        throw new Error("USERNAME_TAKEN");
      }

      // 2. Create User
      const userId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newProfile: ExplorerProfile = {
        id: userId,
        playerName,
        secretCode, // In a real app, hash this!
        characterType,
        totalXP: 50, // Start with a bonus!
        currentLevel: 1,
        createdAt: new Date(),
        lastActive: new Date()
      };

      // We use setDoc to specify our custom userId
      await setDoc(doc(db, "users", userId), {
        ...newProfile,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp()
      });
      
      return newProfile;
    } catch (error) {
      console.error("SignUp Error:", error);
      throw error;
    }
  },

  // GUEST LOGIN: Temporary session
  async loginAsGuest(): Promise<ExplorerProfile> {
    try {
      const guestId = `guest_${Date.now()}`;
      const guestProfile: ExplorerProfile = {
        id: guestId,
        playerName: `Explorer_${Math.floor(Math.random() * 999)}`,
        secretCode: "GUEST-SESSION",
        characterType: 'squire',
        totalXP: 0,
        currentLevel: 1,
        createdAt: new Date(),
        lastActive: new Date()
      };
      
      // We save guests too so they can save reports temporarily
      await setDoc(doc(db, "users", guestId), {
          ...guestProfile,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp()
      });
      return guestProfile;
    } catch (error) {
      console.error("Guest Login Error:", error);
      throw error;
    }
  },

  // --- PROGRESS SYSTEM ---

  // LEVEL UP LOGIC: Updates XP and recalculates Level
  async addXP(userId: string, xpEarned: number): Promise<ExplorerProfile | null> {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as ExplorerProfile;
        const newTotal = (data.totalXP || 0) + xpEarned;
        
        // Simple RPG Math synced with your GameEngine thresholds:
        let newLevel: 1 | 2 | 3 | 4 = 1;
        if (newTotal >= 600) newLevel = 4;      // Lord
        else if (newTotal >= 300) newLevel = 3; // Duke
        else if (newTotal >= 100) newLevel = 2; // Knight

        const updates = {
          totalXP: newTotal,
          currentLevel: newLevel,
          lastActive: serverTimestamp()
        };

        await updateDoc(userRef, updates);
        
        // Return updated profile with proper Date objects
        const createdAtDate = data.createdAt instanceof Date 
          ? data.createdAt 
          : (data.createdAt as any)?.toDate?.() || new Date();
        
        return { 
          ...data, 
          totalXP: newTotal, 
          currentLevel: newLevel, 
          lastActive: new Date(),
          createdAt: createdAtDate
        } as ExplorerProfile;
      }
      return null;
    } catch (error) {
      console.error("Update XP Error:", error);
      throw error;
    }
  },

  // --- HISTORY & ANALYTICS ---

  // Saves the "Pedagogy Report" to the cloud
  async saveAnalysisReport(userId: string, code: string, narrative: string[]): Promise<void> {
    try {
      // Auto-ID generation for reports
      const reportRef = doc(collection(db, "reports")); 
      await setDoc(reportRef, {
        userId,
        sourceCode: code,
        narrative: narrative, 
        timestamp: serverTimestamp(),
        type: "SANDBOX_RUN"
      });
    } catch (e) {
      console.error("Failed to save report", e);
      // Don't crash the app if analytics fail
    }
  }
};