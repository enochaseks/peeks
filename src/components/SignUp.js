import React, { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
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
} from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SignUp = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  return (
    <Box
      minH="100vh"
      bg="linear-gradient(135deg, #8B4513 0%, #D2691E 100%)"
      py={12}
      px={4}
    >
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
            <Box textAlign="center">
              <Link to="/login">Already have an account? Login</Link>
            </Box>
          </VStack>
        </Box>
      </Container>
    </Box>
  );
};

export default SignUp; 