import React, { useEffect } from 'react';
import { Box, Text, Button, HStack, IconButton, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { FaArrowLeft } from 'react-icons/fa';

const Settings = () => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Swipe back handler
  useEffect(() => {
    let touchStartX = null;
    let touchEndX = null;
    function handleTouchStart(e) {
      touchStartX = e.changedTouches[0].screenX;
    }
    function handleTouchEnd(e) {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX !== null && touchEndX - touchStartX > 80) {
        navigate('/profile');
      }
    }
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate]);

  return (
    <Box w="100vw" h="100vh" bg="black" color="white" p={0}>
      <VStack align="start" spacing={6} pt={8} px={6}>
        <HStack spacing={4} align="center">
          <IconButton
            icon={<FaArrowLeft />}
            aria-label="Back to profile"
            colorScheme="whiteAlpha"
            bg="rgba(0,0,0,0.5)"
            borderRadius="full"
            onClick={() => navigate('/profile')}
          />
          <Text fontSize="3xl" fontWeight="bold">Settings</Text>
        </HStack>
        <Button colorScheme="red" size="md" onClick={handleLogout}>
          Log Out
        </Button>
      </VStack>
    </Box>
  );
};

export default Settings; 