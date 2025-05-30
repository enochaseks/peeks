import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './components/SignUp';
import Login from './components/Login';
import MFAEnrollment from './components/MFAEnrollment';
import Discover from './components/Discover';
import ProfilePage from './components/ProfilePage';
import { auth } from './firebase';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  if (!auth.currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
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
          <Route path="/" element={<Navigate to="/discover" replace />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
