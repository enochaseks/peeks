import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Avatar,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  Text,
  SimpleGrid,
  Image,
  Spinner,
  Center,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  useToast,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../firebase';
import { FaCamera, FaEdit, FaArrowLeft, FaCog } from 'react-icons/fa';
import { storage } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';

const Profile = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef();
  const toast = useToast();
  const navigate = useNavigate();
  const [editError, setEditError] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

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
        navigate('/camera');
      }
    }
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [navigate]);

  // Helper to check if username exists (excluding current user)
  const checkUsernameExists = async (username) => {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const snapshot = await getDocs(q);
    // Exclude current user
    return snapshot.docs.some(docSnap => docSnap.id !== auth.currentUser.uid);
  };

  // Suggest alternative usernames
  const suggestUsernames = (base) => {
    const suggestions = [];
    for (let i = 1; i <= 3; i++) {
      suggestions.push(base + Math.floor(Math.random() * 1000));
    }
    return suggestions;
  };

  const openEdit = () => {
    setEditUsername(userData?.username || '');
    setEditPhotoURL(userData?.profilePicture || '');
    setEditPhoto(null);
    setIsEditOpen(true);
    setEditError('');
    setUsernameSuggestions([]);
  };

  const handlePhotoIconClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditPhoto(file);
      setEditPhotoURL(URL.createObjectURL(file));
    }
  };

  // Username check on change
  const handleEditUsernameChange = (e) => {
    const value = e.target.value;
    setEditUsername(value);
    if (value.length > 2) {
      setCheckingUsername(true);
      checkUsernameExists(value).then(exists => {
        if (exists) {
          setEditError('Username already taken');
          setUsernameSuggestions(suggestUsernames(value));
        } else {
          setEditError('');
          setUsernameSuggestions([]);
        }
        setCheckingUsername(false);
      });
    } else {
      setEditError('');
      setUsernameSuggestions([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let photoURL = editPhotoURL;
    try {
      // Username duplicate check
      if (await checkUsernameExists(editUsername)) {
        setEditError('Username already taken');
        setUsernameSuggestions(suggestUsernames(editUsername));
        setSaving(false);
        return;
      }
      if (editPhoto) {
        // Upload to Firebase Storage
        const storageRef = ref(storage, `profilePictures/${auth.currentUser.uid}`);
        await uploadBytes(storageRef, editPhoto);
        photoURL = await getDownloadURL(storageRef);
      }
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username: editUsername,
        profilePicture: photoURL,
      });
      setUserData((prev) => ({ ...prev, username: editUsername, profilePicture: photoURL }));
      setIsEditOpen(false);
      toast({ title: 'Profile updated', status: 'success', duration: 2000, isClosable: true });
    } catch (err) {
      toast({ title: 'Error updating profile', description: err.message, status: 'error', duration: 3000, isClosable: true });
    }
    setSaving(false);
  };

  // Log out handler
  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (loading) {
    return (
      <Center w="100vw" h="100vh" bg="black" flexDirection="column">
        <Image src="/logo192.png" alt="Peeks Logo" boxSize="150px" mb={4} objectFit="contain" />
        <Spinner color="purple.400" size="xl" />
      </Center>
    );
  }

  return (
    <Box w="100vw" minH="100vh" bg="black" color="white" p={0} position="relative">
      {/* Top Bar: Back and Settings */}
      <IconButton
        icon={<FaArrowLeft />}
        aria-label="Back to camera"
        position="absolute"
        top={4}
        left={4}
        zIndex={10}
        colorScheme="whiteAlpha"
        bg="rgba(0,0,0,0.5)"
        borderRadius="full"
        onClick={() => navigate('/camera')}
      />
      <IconButton
        icon={<FaCog />}
        aria-label="Settings"
        position="absolute"
        top={4}
        right={4}
        zIndex={10}
        colorScheme="whiteAlpha"
        bg="rgba(0,0,0,0.5)"
        borderRadius="full"
        onClick={() => navigate('/settings')}
      />
      <VStack spacing={2} pt={6} pb={2} position="relative">
        <Box position="relative" display="inline-block">
          <Avatar size="xl" name={userData?.username || 'User'} src={userData?.profilePicture || ''} />
          {/* Photo Icon Overlay */}
          <IconButton
            icon={<FaCamera />}
            aria-label="Change profile picture"
            size="sm"
            position="absolute"
            bottom={0}
            right={0}
            borderRadius="full"
            colorScheme="purple"
            onClick={handlePhotoIconClick}
            zIndex={2}
          />
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handlePhotoChange}
          />
        </Box>
        <Text fontSize="xl" fontWeight="bold" mt={1} mb={0}>
          {userData?.username ? userData.username : 'No username set'}
        </Text>
        <Button
          leftIcon={<FaEdit />}
          colorScheme="purple"
          size="sm"
          mt={1}
          onClick={openEdit}
        >
          Edit Profile
        </Button>
      </VStack>
      <Tabs variant="soft-rounded" colorScheme="purple" w="100%" mt={2}>
        <TabList justifyContent="center">
          <Tab w="50%">Posts</Tab>
          <Tab w="50%">Saved Stories</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Center w="100%" h="120px" color="gray.400" fontSize="lg">No posts shown</Center>
          </TabPanel>
          <TabPanel px={0}>
            <Center w="100%" h="120px" color="gray.400" fontSize="lg">No Saved Stories Shown</Center>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} isCentered>
        <ModalOverlay />
        <ModalContent bg="gray.900" color="white">
          <ModalHeader>Edit Profile</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <Box position="relative" display="inline-block">
                <Avatar size="xl" name={editUsername || 'User'} src={editPhotoURL || ''} />
                <IconButton
                  icon={<FaCamera />}
                  aria-label="Change profile picture"
                  size="sm"
                  position="absolute"
                  bottom={0}
                  right={0}
                  borderRadius="full"
                  colorScheme="purple"
                  onClick={handlePhotoIconClick}
                  zIndex={2}
                />
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                />
              </Box>
              <InputGroup>
                <Input
                  placeholder="Username"
                  value={editUsername}
                  onChange={handleEditUsernameChange}
                  maxLength={30}
                  isInvalid={!!editError}
                  bg="gray.700"
                  borderColor="gray.600"
                  color="white"
                  _placeholder={{ color: 'gray.400' }}
                  _hover={{ borderColor: 'gray.500' }}
                  _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px #63B3ED' }}
                />
                <InputRightElement>
                  <FaEdit color="gray.400" />
                </InputRightElement>
              </InputGroup>
              {checkingUsername && <Text color="gray.500" fontSize="sm">Checking username...</Text>}
              {editError && (
                <Box mt={1}>
                  <Text color="red.500" fontSize="sm">{editError}</Text>
                  {usernameSuggestions.length > 0 && (
                    <Text color="gray.500" fontSize="sm">Suggestions: {usernameSuggestions.join(', ')}</Text>
                  )}
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="purple" mr={3} onClick={handleSave} isLoading={saving}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} color="whiteAlpha.800">
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Profile; 