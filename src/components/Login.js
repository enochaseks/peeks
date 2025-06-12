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
      <Container maxW="md" py={10}>
        <Flex justify="center" mb={5}>
          <Box textAlign="center">
            <Image src="/logo192.png" alt="Logo" boxSize="100px" />
          </Box>
          <Box textAlign="center" mt={4}>
            <Text fontSize="4xl" fontWeight="bold" color="white" textAlign="center">
              Welcome Peeks!
            </Text>
          </Box>
        </Flex>
        <VStack
          spacing={4}
          w="100%"
          bg="orange.50"
          rounded="xl"
          boxShadow="2xl"
          p={8}
          bgColor="rgba(255, 255, 255, 0.9)"
        >
          {!showMfaPrompt ? (
            <>
              <FormControl id="email" isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </FormControl>
              <FormControl id="password" isRequired>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </FormControl>
              <Button
                type="submit"
                colorScheme="orange"
                width="full"
                onClick={handleSubmit}
                isLoading={loading}
                loadingText="Logging in..."
              >
                Login
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
                  Sign in with Google
                </Button>
            </>
          ) : (
            <>
              <Text>Please enter the verification code sent to your phone</Text>
              <div id="recaptcha-container"></div>
              <FormControl id="verificationCode" isRequired>
                <FormLabel>Verification Code</FormLabel>
                <Input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                />
              </FormControl>
              <Button
                colorScheme="orange"
                width="full"
                onClick={handleMfaVerification}
                isLoading={loading}
                loadingText="Verifying..."
              >
                Verify
              </Button>
            </>
          )}

          {error && (
            <Text color="red.500" fontSize="sm">
              {error}
              {error.includes('verify') && (
                <Button
                  variant="link"
                  color="blue.500"
                  ml={2}
                  onClick={handleResendVerification}
                >
                  Resend verification email
                </Button>
              )}
            </Text>
          )}

          <Box textAlign="center">
            <Link to="/signup">Don't have an account? Sign up</Link>
          </Box>
        </VStack>
      </Container>
      )}
    </Box>
  );
};

export default Login;