import React, { useState } from 'react';
import {
  Box,
  Container,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  Text,
  useToast,
  Image,
  Flex,
  Center,
  Spinner,
  Divider,
  Icon,
} from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  getMultiFactorResolver,
  RecaptchaVerifier,
  multiFactor,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../firebase';
import { FaGoogle } from 'react-icons/fa';

// Define keyframes for static-like flicker
const staticFlickerKeyframes = `@keyframes static-flicker {\n  0%, 100% { opacity: 1; }\n  5% { opacity: 0.9; }\n  10% { opacity: 1; }\n  15% { opacity: 0.9; }\n  20% { opacity: 1; }\n  25% { opacity: 0.9; }\n  30% { opacity: 1; }\n  35% { opacity: 0.9; }\n  40% { opacity: 1; }\n  45% { opacity: 0.9; }\n  50% { opacity: 1; }\n  55% { opacity: 0.9; }\n  60% { opacity: 1; }\n  65% { opacity: 0.9; }\n  70% { opacity: 1; }\n  75% { opacity: 0.9; }\n  80% { opacity: 1; }\n  85% { opacity: 0.9; }\n  90% { opacity: 1; }\n  95% { opacity: 0.9; }\n}`;

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaVerificationId, setMfaVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showMfaPrompt, setShowMfaPrompt] = useState(false);
  const [resolver, setResolver] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResendVerification = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast({
          title: 'Verification email sent',
          description: 'Please check your email to verify your account.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send verification email. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Try to sign in with email and password
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      
      // Check if MFA is enrolled
      const user = auth.currentUser;
      const mfaUser = multiFactor(user);
      const enrolledFactors = mfaUser.enrolledFactors;

      if (enrolledFactors && enrolledFactors.length > 0) {
        // User has MFA enabled, but hasn't been challenged yet
        // Sign out and retry to trigger MFA
        await auth.signOut();
        try {
          await signInWithEmailAndPassword(auth, formData.email, formData.password);
        } catch (mfaError) {
          if (mfaError.code === 'auth/multi-factor-auth-required') {
            handleMFARequired(mfaError);
          } else {
            throw mfaError;
          }
        }
      } else {
        // No MFA enrolled, proceed with login
        toast({
          title: 'Login successful',
          description: 'Welcome Peeks!',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        setIsTransitioning(true);
        setTimeout(() => {
          navigate('/camera');
        }, 1500);
      }
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') {
        handleMFARequired(error);
      } else {
        setError(error.message);
        toast({
          title: 'Login failed',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMFARequired = async (error) => {
    try {
      const resolver = getMultiFactorResolver(auth, error);
      setResolver(resolver);
      setShowMfaPrompt(true);

      // Initialize reCAPTCHA
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: () => {
          console.log('reCAPTCHA solved');
        },
      });

      // Send verification code
      const phoneInfoOptions = {
        multiFactorHint: resolver.hints[0],
        session: resolver.session,
      };

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        recaptchaVerifier
      );

      setMfaVerificationId(verificationId);
      
      toast({
        title: 'Verification code sent',
        description: 'Please check your phone for the verification code.',
        status: 'info',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('MFA Setup Error:', error);
      setError(error.message);
      toast({
        title: 'MFA Error',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleMfaVerification = async () => {
    try {
      setLoading(true);
      const cred = PhoneAuthProvider.credential(mfaVerificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      
      const userCredential = await resolver.resolveSignIn(multiFactorAssertion);
      
      toast({
        title: 'Login successful',
        description: 'Welcome Peeks!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setIsTransitioning(true);
      setTimeout(() => {
        navigate('/camera');
      }, 1500);
    } catch (error) {
      console.error('MFA Verification Error:', error);
      setError(error.message);
      toast({
        title: 'Verification failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({
        title: 'Google Sign-in successful',
        description: 'Welcome Peeks!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      setIsTransitioning(true);
      setTimeout(() => {
        navigate('/camera');
      }, 1500);
    } catch (error) {
      console.error('Google Sign-in Error:', error);
      setError(error.message);
      toast({
        title: 'Google Sign-in Failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

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
            Login
          </Text>

          {error && (
            <Text color="red.300" textAlign="center" fontSize="sm">
              {error}
            </Text>
          )}

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
              placeholder="Enter your password"
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
            Login
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
            Sign in with Google
          </Button>

          {showMfaPrompt && (
            <Box mt={4} p={4} borderWidth={1} borderRadius="lg" borderColor="purple.600">
              <Text mb={2} textAlign="center" color="whiteAlpha.800">Enter MFA Code:</Text>
              <Input
                type="text"
                placeholder="Verification Code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                bg="purple.700"
                borderColor="purple.600"
                color="white"
                _placeholder={{ color: 'whiteAlpha.600' }}
              />
              <Button
                mt={2}
                colorScheme="purple"
                onClick={handleMfaVerification}
                isLoading={loading}
                w="100%"
              >
                Verify Code
              </Button>
              <Box id="recaptcha-container" mt={2}></Box>
            </Box>
          )}

          <Text textAlign="center" fontSize="sm" color="whiteAlpha.800">
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: '#E9D8FD', fontWeight: 'bold' }}>
              Sign Up
            </Link>
          </Text>
        </VStack>
      </Container>
    </Box>
  );
};

export default Login;