import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  Container,
  InputGroup,
  InputLeftAddon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Select,
} from '@chakra-ui/react';
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

// Country codes data
const countryCodes = [
  { code: '+1', country: 'United States/Canada' },
  { code: '+44', country: 'United Kingdom' },
  { code: '+91', country: 'India' },
  { code: '+86', country: 'China' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'South Korea' },
  { code: '+61', country: 'Australia' },
  { code: '+64', country: 'New Zealand' },
  { code: '+33', country: 'France' },
  { code: '+49', country: 'Germany' },
  { code: '+39', country: 'Italy' },
  { code: '+34', country: 'Spain' },
  { code: '+351', country: 'Portugal' },
  { code: '+7', country: 'Russia' },
  { code: '+55', country: 'Brazil' },
  { code: '+52', country: 'Mexico' },
  { code: '+27', country: 'South Africa' },
  { code: '+234', country: 'Nigeria' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+65', country: 'Singapore' },
  { code: '+60', country: 'Malaysia' },
  { code: '+66', country: 'Thailand' },
  { code: '+84', country: 'Vietnam' },
].sort((a, b) => a.country.localeCompare(b.country));

const MFAEnrollment = ({ onEnrollmentComplete }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+44'); // Default to UK
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [password, setPassword] = useState('');
  const recaptchaContainerRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }

    if (recaptchaContainerRef.current) {
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          size: 'normal',
          callback: () => {
            console.log('reCAPTCHA solved');
          },
          'expired-callback': () => {
            toast({
              title: 'reCAPTCHA expired',
              description: 'Please solve the reCAPTCHA again',
              status: 'warning',
              duration: 3000,
              isClosable: true,
            });
          },
        });

        recaptchaVerifierRef.current.render();
      } catch (error) {
        console.error('Error initializing reCAPTCHA:', error);
      }
    }

    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, [toast]);

  const formatPhoneNumber = (number, code) => {
    const cleaned = number.replace(/\D/g, '');
    const withoutLeadingZeros = cleaned.replace(/^0+/, '');
    const codeWithoutPlus = code.substring(1);
    const final = withoutLeadingZeros.startsWith(codeWithoutPlus)
      ? withoutLeadingZeros
      : codeWithoutPlus + withoutLeadingZeros;
    return '+' + final;
  };

  const handleReauthenticate = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      setShowReauthModal(false);
      handleSendCode();
    } catch (error) {
      console.error('Reauthentication error:', error);
      toast({
        title: 'Reauthentication failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const validatePhoneNumber = (number, code) => {
    const cleaned = number.replace(/\D/g, '');
    if (!cleaned) {
      return 'Phone number is required';
    }

    // Minimum lengths for different countries
    const minLengths = {
      '+1': 10,    // US/Canada
      '+44': 10,   // UK
      '+91': 10,   // India
      '+86': 11,   // China
      // Add more country-specific validations as needed
    };

    const minLength = minLengths[code] || 9; // Default minimum length
    if (cleaned.length < minLength) {
      return `Phone number must be at least ${minLength} digits for ${
        countryCodes.find(c => c.code === code)?.country || 'this country'
      }`;
    }

    return null; // No error
  };

  const handleSendCode = async () => {
    try {
      // Validate phone number before proceeding
      const validationError = validatePhoneNumber(phoneNumber, countryCode);
      if (validationError) {
        toast({
          title: 'Invalid Phone Number',
          description: validationError,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to set up MFA',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        navigate('/login');
        return;
      }

      if (!recaptchaVerifierRef.current) {
        // Try to reinitialize reCAPTCHA if it's not available
        try {
          recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
            size: 'normal',
            callback: () => {
              console.log('reCAPTCHA solved');
            },
          });
          await recaptchaVerifierRef.current.render();
        } catch (error) {
          console.error('Error reinitializing reCAPTCHA:', error);
          toast({
            title: 'Error',
            description: 'Failed to initialize reCAPTCHA. Please refresh the page and try again.',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
          return;
        }
      }

      const session = await multiFactor(user).getSession();

      // Format the phone number with country code
      const formattedPhoneNumber = formatPhoneNumber(phoneNumber, countryCode);
      console.log('Attempting to send code to:', formattedPhoneNumber);

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      
      // Add timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), 30000)
      );

      const verificationPromise = phoneAuthProvider.verifyPhoneNumber(
        {
          phoneNumber: formattedPhoneNumber,
          session,
        },
        recaptchaVerifierRef.current
      );

      // Race between the verification and timeout
      const verificationId = await Promise.race([verificationPromise, timeoutPromise]);

      setVerificationId(verificationId);
      setShowVerificationInput(true);
      toast({
        title: 'Verification code sent',
        description: 'Please check your phone for the verification code. If you don\'t receive it within a few minutes, try again.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error sending code:', error);
      let errorMessage = error.message;

      if (error.code === 'auth/requires-recent-login') {
        setShowReauthModal(true);
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and make sure you\'ve added your phone number to Firebase test numbers.';
      } else if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format. Please check the number and try again.';
      } else if (error.message === 'Request timed out') {
        errorMessage = 'Request timed out. Please check your internet connection and try again.';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });

      // Clear reCAPTCHA on error
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

      await multiFactor(user).enroll(multiFactorAssertion, 'Phone Number');
      
      toast({
        title: 'MFA Enrolled Successfully',
        description: 'Your phone number has been added as a second factor.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      if (onEnrollmentComplete) {
        onEnrollmentComplete();
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Container maxW="lg" py={12}>
        <Box bg="white" rounded="xl" boxShadow="2xl" p={8}>
          <VStack spacing={6}>
            <Text fontSize="2xl" fontWeight="bold">
              Set Up Two-Factor Authentication
            </Text>
            
            <FormControl isRequired>
              <FormLabel>Country</FormLabel>
              <Select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={showVerificationInput}
              >
                {countryCodes.map(({ code, country }) => (
                  <option key={code} value={code}>
                    {country} ({code})
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Phone Number</FormLabel>
              <InputGroup>
                <InputLeftAddon>{countryCode}</InputLeftAddon>
                <Input
                  type="tel"
                  placeholder="Enter your phone number without country code"
                  value={phoneNumber}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    setPhoneNumber(cleaned);
                  }}
                  disabled={showVerificationInput}
                />
              </InputGroup>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Enter number without leading zeros or country code
              </Text>
            </FormControl>

            <Box ref={recaptchaContainerRef} />

            {!showVerificationInput ? (
              <Button
                colorScheme="orange"
                width="full"
                onClick={handleSendCode}
                isLoading={loading}
              >
                Send Verification Code
              </Button>
            ) : (
              <>
                <FormControl isRequired>
                  <FormLabel>Verification Code</FormLabel>
                  <Input
                    type="text"
                    placeholder="Enter verification code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                </FormControl>

                <Button
                  colorScheme="orange"
                  width="full"
                  onClick={handleVerifyCode}
                  isLoading={loading}
                >
                  Verify Code
                </Button>
              </>
            )}
          </VStack>
        </Box>
      </Container>

      {/* Re-authentication Modal */}
      <Modal isOpen={showReauthModal} onClose={() => setShowReauthModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Re-authenticate Required</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Text>For security reasons, please enter your password to continue</Text>
              <FormControl>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </FormControl>
              <Button
                colorScheme="orange"
                width="full"
                onClick={handleReauthenticate}
                isLoading={loading}
              >
                Confirm
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

export default MFAEnrollment; 