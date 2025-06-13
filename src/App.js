import React, { useState, useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './components/SignUp';
import Login from './components/Login';
import MFAEnrollment from './components/MFAEnrollment';
import CameraViewer from './components/CameraViewer';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Inbox from './pages/Inbox';
import { auth } from './firebase';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    // You might want to render a loading spinner or splash screen here
    return <div>Loading...</div>; 
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route 
            path="/mfa-enrollment" 
            element={
              <ProtectedRoute>
                <MFAEnrollment />
              </ProtectedRoute>
            } 
          />
          
          {/* Camera View Route */}
          <Route 
            path="/camera" 
            element={
              <ProtectedRoute>
                <CameraViewer />
              </ProtectedRoute>
            } 
          />

          {/* Inbox Route */}
          <Route 
            path="/inbox" 
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            } 
          />
          
          {/* Redirect authenticated users from login/signup to camera */}
          <Route 
            path="/signup"
            element={auth.currentUser ? <Navigate to="/camera" replace /> : <SignUp />}
          />
          <Route 
            path="/login"
            element={auth.currentUser ? <Navigate to="/camera" replace /> : <Login />}
          />

          {/* Add the profile route */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />

          {/* Default route */}
          <Route path="/" element={<Navigate to="/camera" replace />} />

          {/* Catch-all for undefined routes (optional) */}
          {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
