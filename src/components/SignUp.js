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
import { collection, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { FaGoogle } from 'react-icons/fa';

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
    dob: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Helper to check if username exists
  const checkUsernameExists = async (username) => {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  // Suggest alternative usernames
  const suggestUsernames = (base) => {
    const suggestions = [];
    for (let i = 1; i <= 3; i++) {
      suggestions.push(base + Math.floor(Math.random() * 1000));
    }
    return suggestions;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    if (name === 'username' && value.length > 2) {
      setCheckingUsername(true);
      checkUsernameExists(value).then(exists => {
        if (exists) {
          setError('Username already taken');
          setUsernameSuggestions(suggestUsernames(value));
        } else {
          setError('');
          setUsernameSuggestions([]);
        }
        setCheckingUsername(false);
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Age validation
    if (!formData.dob) {
      setError('Date of birth is required');
      setLoading(false);
      return;
    }
    const dobDate = new Date(formData.dob);
    const age = ((new Date()).getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 16) {
      setError('You must be at least 16 years old to sign up');
      setLoading(false);
      return;
    }

    // Username duplicate check
    if (await checkUsernameExists(formData.username)) {
      setError('Username already taken');
      setUsernameSuggestions(suggestUsernames(formData.username));
      setLoading(false);
      return;
    }

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
        dob: formData.dob,
        createdAt: new Date(),
        followers: 0,
        following: 0,
        bio: '',
        profilePicture: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(formData.username) + '&background=random',
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
      if (error.code === 'auth/email-already-in-use') {
        setError('Email is already in use. Please use a different email.');
      } else {
        setError(error.message);
      }
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
          profilePicture: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=random',
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
      bg="purple.800"
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
      color="white"
    >
      {/* Background static/flicker effect */}
      <Box
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        bg="repeating-linear-gradient(45deg, purple.700 0, purple.700 1px, transparent 0, transparent 50%)"
        backgroundSize="3px 3px"
        opacity="0.1"
        animation="static-flicker 10s infinite step-end"
        zIndex="0"
      >
        <style>{staticFlickerKeyframes}</style>
      </Box>

      {/* Transitioning / Loading State Overlay */}
      {isTransitioning && (
        <Center
          position="absolute"
          top="0"
          left="0"
          width="100%"
          height="100%"
          bg="rgba(0,0,0,0.7)" // Semi-transparent overlay
          zIndex="10"
          flexDirection="column"
        >
          <Image src="/logo192.png" alt="Peeks Logo" boxSize="150px" mb={4} objectFit="contain" />
          <Spinner size="xl" color="purple.400" mb={4} />
          <Text fontSize="xl" fontWeight="bold" color="white">Entering Peeks...</Text>
        </Center>
      )}

      {/* Main content box with form */}
      <Container
        centerContent
        maxW="md"
        py={8}
        px={6}
        bg="purple.900"
        borderRadius="xl"
        boxShadow="dark-lg"
        zIndex="1"
        position="relative"
      >
        <VStack spacing={6} align="stretch" w="100%">
          {/* Logo in main form area (if not transitioning) */}
          {!isTransitioning && (
            <Center>
              <Image src="/logo192.png" alt="Peeks Logo" boxSize="100px" objectFit="contain" />
            </Center>
          )}
          <Text fontSize="3xl" fontWeight="bold" textAlign="center" color="white">
            Sign Up
          </Text>

          {error && (
            <Text color="red.300" textAlign="center" fontSize="sm">
              {error}
            </Text>
          )}

          <FormControl id="username">
            <FormLabel color="whiteAlpha.800">Username</FormLabel>
            <Input
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a username"
              bg="purple.700"
              borderColor="purple.600"
              color="white"
              _placeholder={{ color: 'whiteAlpha.600' }}
              _hover={{ borderColor: 'purple.400' }}
              _focus={{ borderColor: 'purple.300', boxShadow: '0 0 0 1px #805AD5' }}
            />
            {checkingUsername && (
              <Text fontSize="sm" color="whiteAlpha.700" mt={1}>
                Checking username availability... <Spinner size="xs" />
              </Text>
            )}
            {usernameSuggestions.length > 0 && (
              <Text fontSize="sm" color="whiteAlpha.700" mt={2}>
                Suggestions: {usernameSuggestions.join(', ')}
              </Text>
            )}
          </FormControl>

          <FormControl id="email">
            <FormLabel color="whiteAlpha.800">Email address</FormLabel>
            <Input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              bg="purple.700"
              borderColor="purple.600"
              color="white"
              _placeholder={{ color: 'whiteAlpha.600' }}
              _hover={{ borderColor: 'purple.400' }}
              _focus={{ borderColor: 'purple.300', boxShadow: '0 0 0 1px #805AD5' }}
            />
          </FormControl>

          <FormControl id="password">
            <FormLabel color="whiteAlpha.800">Password</FormLabel>
            <Input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              bg="purple.700"
              borderColor="purple.600"
              color="white"
              _placeholder={{ color: 'whiteAlpha.600' }}
              _hover={{ borderColor: 'purple.400' }}
              _focus={{ borderColor: 'purple.300', boxShadow: '0 0 0 1px #805AD5' }}
            />
          </FormControl>

          <FormControl id="confirmPassword">
            <FormLabel color="whiteAlpha.800">Confirm Password</FormLabel>
            <Input
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              bg="purple.700"
              borderColor="purple.600"
              color="white"
              _placeholder={{ color: 'whiteAlpha.600' }}
              _hover={{ borderColor: 'purple.400' }}
              _focus={{ borderColor: 'purple.300', boxShadow: '0 0 0 1px #805AD5' }}
            />
          </FormControl>

          <FormControl id="dob">
            <FormLabel color="whiteAlpha.800">Date of Birth</FormLabel>
            <Input
              name="dob"
              type="date"
              value={formData.dob}
              onChange={handleChange}
              bg="purple.700"
              borderColor="purple.600"
              color="white"
              _placeholder={{ color: 'whiteAlpha.600' }}
              _hover={{ borderColor: 'purple.400' }}
              _focus={{ borderColor: 'purple.300', boxShadow: '0 0 0 1px #805AD5' }}
            />
          </FormControl>

          <Button
            type="submit"
            colorScheme="purple"
            isLoading={loading}
            onClick={handleSubmit}
            size="lg"
            fontSize="md"
            w="100%"
            mt={4}
          >
            Sign Up
          </Button>

          <Flex align="center" my={4}>
            <Divider borderColor="whiteAlpha.400" />
            <Text px={2} fontSize="sm" color="whiteAlpha.700">
              OR
            </Text>
            <Divider borderColor="whiteAlpha.400" />
          </Flex>

          <Button
            leftIcon={<Icon as={FaGoogle} />}
            colorScheme="red"
            onClick={handleGoogleSignIn}
            isLoading={loading}
            size="lg"
            fontSize="md"
            w="100%"
          >
            Sign up with Google
          </Button>

          <Text textAlign="center" fontSize="sm" color="whiteAlpha.800">
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#E9D8FD', fontWeight: 'bold' }}>
              Log In
            </Link>
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default SignUp; 