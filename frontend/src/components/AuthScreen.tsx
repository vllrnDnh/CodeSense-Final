import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { DataIsolationService } from '../Dataisolationservice';
import type { ExplorerProfile } from '../types'; 

interface AuthContextType {
  user: ExplorerProfile | null;
  isGuest: boolean;
  isAuthenticated: boolean;
  setUser: React.Dispatch<React.SetStateAction<ExplorerProfile | null>>; 
  login: (playerName: string, secretCode: string) => Promise<void>;
  signup: (playerName: string, secretCode: string, characterType: ExplorerProfile['characterType']) => Promise<void>;
  logout: () => void;
  continueAsGuest: () => void;
  goBack: () => void; // Added for navigation
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ExplorerProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const guestMode = localStorage.getItem('guestMode');
    
    if (storedUser && !guestMode) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    } else if (guestMode === 'true') {
      setIsGuest(true);
    }
  }, []);

  const login = async (playerName: string, secretCode: string) => {
    // FIX: Check local storage first since we don't have a live backend yet
    const storedUserJson = localStorage.getItem('user');
    
    if (storedUserJson) {
      const storedUser = JSON.parse(storedUserJson) as ExplorerProfile;
      
      // Validate credentials against local storage
      if (storedUser.playerName === playerName && storedUser.secretCode === secretCode) {
        setUser(storedUser);
        setIsAuthenticated(true);
        setIsGuest(false);
        localStorage.removeItem('guestMode');
        return;
      }
    }
    
    // If local check fails, throw the error that triggers "Invalid Account"
    throw new Error('Invalid credentials');
  };

  const signup = async (playerName: string, secretCode: string, characterType: ExplorerProfile['characterType']) => {
    const newProfile: ExplorerProfile = {
      id: `user_${Date.now()}`,
      playerName,
      secretCode,
      totalXP: 0,
      currentLevel: 1,
      characterType,
      createdAt: new Date(),
      lastActive: new Date(),
    };

    localStorage.setItem('user', JSON.stringify(newProfile));
    DataIsolationService.migrateGuestToUser(newProfile.id);

    setUser(newProfile);
    setIsAuthenticated(true);
    setIsGuest(false);
    localStorage.removeItem('guestMode');
  };

  const logout = () => {
    // We clear state, but we don't necessarily want to delete the account from localStorage 
    // unless you want a "Delete Account" feature.
    setUser(null);
    setIsAuthenticated(false);
    setIsGuest(false);
    localStorage.removeItem('guestMode');
  };

  const continueAsGuest = () => {
    localStorage.setItem('guestMode', 'true');
    setIsGuest(true);
    setIsAuthenticated(false);
    setUser(null);
  };

  // Added for "Back/Exit" buttons
  const goBack = () => {
    window.history.back();
  };

  return (
    <AuthContext.Provider value={{ 
      user, setUser, isGuest, isAuthenticated, login, signup, logout, continueAsGuest, goBack 
    }}>
      {children}
    </AuthContext.Provider>
  );
};