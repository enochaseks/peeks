import React, { useState, useEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './components/SignUp';
import Login from './components/Login';
import MFAEnrollment from './components/MFAEnrollment';
import Discover from './components/Discover';
import ProfilePage from './components/ProfilePage';
import SearchPage from './components/SearchPage';
import { auth } from './firebase';
import CreatePostDialog from './components/CreatePostDialog';
import CommunityPage from './components/CommunityPage';

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
          <Route 
            path="/discover" 
            element={
              <ProtectedRoute>
                <Discover />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/community/:communityId"
            element={
              <ProtectedRoute>
                <CommunityPage />
              </ProtectedRoute>
            }
          />
          
          {/* Redirect authenticated users from login/signup to discover */}
          <Route 
            path="/signup"
            element={auth.currentUser ? <Navigate to="/discover" replace /> : <SignUp />}
          />
           <Route 
            path="/login"
            element={auth.currentUser ? <Navigate to="/discover" replace /> : <Login />}
          />

          {/* Default route */}
          <Route path="/" element={<Navigate to="/discover" replace />} />

          {/* Catch-all for undefined routes (optional) */}
          {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
