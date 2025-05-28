import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignUp from './components/SignUp';

function App() {
  return (
    <ChakraProvider>
      <Router>
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          {/* Redirect root path to signup for now */}
          <Route path="/" element={<Navigate to="/signup" replace />} />
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
