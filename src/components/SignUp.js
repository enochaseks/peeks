import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  Image,
  Flex,
  Container,
  Divider,
  Icon,
  Center,
  Spinner,
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Define keyframes for static-like flicker
const staticFlickerKeyframes = `@keyframes static-flicker {
  0%, 100% { opacity: 1; }
  5% { opacity: 0.9; }
  10% { opacity: 1; }
  15% { opacity: 0.9; }
  20% { opacity: 1; }
  25% { opacity: 0.9; }
  30% { opacity: 1; }
  35% { opacity: 0.9; }
  40% { opacity: 1; }
  45% { opacity: 0.9; }
  50% { opacity: 1; }
  55% { opacity: 0.9; }
  60% { opacity: 1; }
  65% { opacity: 0.9; }
  70% { opacity: 1; }
  75% { opacity: 0.9; }
  80% { opacity: 1; }
  85% { opacity: 0.9; }
  90% { opacity: 1; }
  95% { opacity: 0.9; }
}`;

const SignUp = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password should be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      await updateProfile(user, {
        displayName: formData.username
      });

      await setDoc(doc(db, "users", user.uid), {
        username: formData.username,
        email: user.email,
        createdAt: new Date(),
        followers: 0,
        following: 0,
        bio: '',
      });

      await sendEmailVerification(user);

      toast({
        title: 'Account created successfully!',
        description: 'Please check your email to verify your account.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      navigate('/login');

    } catch (error) {
      setError(error.message);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }

    setLoading(false);
  };

  const handleSocialSignIn = async (providerInstance) => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, providerInstance);
      const user = result.user;

      // Check if user document exists in Firestore, create if not
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Create a new user document with basic info
        await setDoc(userDocRef, {
          username: user.displayName || user.email, // Use display name from provider or email
          email: user.email,
          createdAt: new Date(),
          followers: 0,
          following: 0,
          bio: '',
        });
      }

      toast({
        title: 'Sign-in successful',
        description: 'Welcome Peeks!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Start transition effect
      setIsTransitioning(true);
      // Navigate after a delay
      setTimeout(() => {
        navigate('/discover');
      }, 1500); // 1500ms delay (adjust as needed)

    } catch (error) {
      console.error('Social Sign-in Error:', error);
      setError(error.message);
      toast({
        title: 'Sign-in Failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => handleSocialSignIn(new GoogleAuthProvider());

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(135deg, #8B4513 0%, #D2691E 100%)"
      py={12}
      px={4}
      css={{
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px)',
          animation: 'static-flicker 0.1s infinite step-end',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 2px)',
          animation: 'static-flicker 0.15s infinite step-end reverse',
          pointerEvents: 'none',
        },
      }}
    >
      <style>
        {staticFlickerKeyframes}
      </style>
      {isTransitioning ? (
        <Center minH="100vh" flexDirection="column">
          <Image src="/logo192.png" alt="Peeks Logo" boxSize="150px" mb={4} />
          <Spinner size="xl" color="orange.500" mb={4} />
          <Text fontSize="xl" fontWeight="bold" color="white">Entering Peeks...</Text>
        </Center>
      ) : (
        <Container maxW="lg">
          <Box
            bg="white"
            rounded="xl"
            boxShadow="2xl"
            p={8}
            bgColor="rgba(255, 255, 255, 0.9)"
          >
            <VStack spacing={6} align="stretch">
              <Flex justify="center" align="center" gap={4}>
                <Image
                  src="/logo192.png"
                  alt="Logo"
                  boxSize="50px"
                  objectFit="contain"
                />
                <Text
                  fontSize="3xl"
                  fontWeight="bold"
                  color="#8B4513"
                  textAlign="center"
                >
                  Sign Up
                </Text>
              </Flex>

              <FormControl isRequired>
                <FormLabel color="#8B4513">Username</FormLabel>
                <Input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  borderColor="#D2691E"
                  _hover={{ borderColor: '#8B4513' }}
                  _focus={{ borderColor: '#8B4513', boxShadow: '0 0 0 1px #8B4513' }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="#8B4513">Email</FormLabel>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  borderColor="#D2691E"
                  _hover={{ borderColor: '#8B4513' }}
                  _focus={{ borderColor: '#8B4513', boxShadow: '0 0 0 1px #8B4513' }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="#8B4513">Password</FormLabel>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  borderColor="#D2691E"
                  _hover={{ borderColor: '#8B4513' }}
                  _focus={{ borderColor: '#8B4513', boxShadow: '0 0 0 1px #8B4513' }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel color="#8B4513">Confirm Password</FormLabel>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  borderColor="#D2691E"
                  _hover={{ borderColor: '#8B4513' }}
                  _focus={{ borderColor: '#8B4513', boxShadow: '0 0 0 1px #8B4513' }}
                />
              </FormControl>

              {error && (
                <Text color="red.500" fontSize="sm" textAlign="center">
                  {error}
                </Text>
              )}

              <Button
                colorScheme="orange"
                width="full"
                onClick={handleSubmit}
                isLoading={loading}
                loadingText="Signing up..."
                bg="#D2691E"
                _hover={{ bg: '#8B4513' }}
              >
                Sign Up 
              </Button>

              <Divider my={4} />
              <Text textAlign="center">OR</Text>

              <Button
                leftIcon={<Icon viewBox="0 0 24 24" boxSize="24px"><path fill="currentColor" d="M21.2 11.1c-.1-.6-.2-1.1-.4-1.6h-6.8v3.2h3.9c-.2 1.3-.8 2.3-1.7 3l2.6 2c1.5-1.4 2.4-3.3 2.6-5.6zm-7.4 3.8c.9 0 1.7-.3 2.3-.8l2.6 2c-1 1-2.3 1.7-3.8 1.7-2.7 0-5-1.8-5.8-4.2H3v2.1c1.6 3.2 4.8 5.5 8.5 5.5 2.3 0 4.3-.8 5.8-2.1l-2.6-2c-.6.5-1.4.8-2.3.8zm-3.2-8.5V5c0-1.4 1.1-2.5 2.5-2.5S15 3.6 15 5v.4H9.8v2.1h4.4zm-6.5 3.6H3V9.4h5.1c-.2 1.2-.2 2.5 0 3.6z"/></Icon>}
                colorScheme="gray"
                width="full"
                onClick={handleGoogleSignIn}
                isLoading={loading}
              >
                Sign up with Google
              </Button>

              <Box textAlign="center">
                <Link to="/login">Already have an account? Login</Link>
              </Box>
            </VStack>
          </Box>
        </Container>
      )}
    </Box>
  );
};

export default SignUp; 