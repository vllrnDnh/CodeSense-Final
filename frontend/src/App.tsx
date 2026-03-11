import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthScreen';
import { HomeDashboard } from './HomeDashboard';
import { SignupPage } from './Signuppage'; 
import { LoginPage } from './Loginpage'; 
import { SandboxPage } from './SandboxPage';
import { LandingPage } from './Landingpage';
import { ProgressPage } from './Progresspage'
import { ProfileSettings } from './ProfileSettings';
import { LeaderboardPage } from './LeaderboardPage';
import { WelcomePage } from './WelcomePage';
import { CampaignPage } from './CampaignPage';

// Real ProtectedRoute logic that checks both authentication and guest status
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isGuest } = useAuth();
  
  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Main App Areas */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute>
                <HomeDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
  path="/progress" 
  element={
    <ProtectedRoute>
      <ProgressPage />
    </ProtectedRoute>
  } 
/>

          
          <Route 
            path="/sandbox" 
            element={
              <ProtectedRoute>
                <SandboxPage />
              </ProtectedRoute>
            } 
          />

          {/* These redirect back to /home so you stay logged in! */}
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/campaign" element={<ProtectedRoute><CampaignPage /></ProtectedRoute>} />
          <Route path="/campaign/:phase" element={<ProtectedRoute><CampaignPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="/settings" element={<Navigate to="/home" replace />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/welcome" element={<WelcomePage />} />

          {/* Fallback - Redirect to Landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;