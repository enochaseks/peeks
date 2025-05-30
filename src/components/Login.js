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
} from 'firebase/auth';
import { auth } from '../firebase';

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
        navigate('/discover');
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
      
      navigate('/discover');
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

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(135deg, #8B4513 0%, #D2691E 100%)"
      py={12}
      px={4}
    >
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
    </Box>
  );
};

export default Login;