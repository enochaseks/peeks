import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Avatar,
  Button,
  Flex,
  Switch,
  FormControl,
  FormLabel,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Spacer,
  useDisclosure,
  Tab,
  IconButton,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Spinner,
  Alert,
  AlertIcon,
  Input
} from '@chakra-ui/react';
import { auth, firebaseApp } from '../firebase';
import { signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import EditProfileDialog from './EditProfileDialog';
import { ArrowBackIcon, SettingsIcon } from '@chakra-ui/icons';
import { FiShare } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const ProfilePage = () => {
  const user = auth.currentUser;
  const toast = useToast();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.displayName || user?.email || 'User',
    bio: 'Tell us about yourself...',
    followers: 0,
    following: 0,
    isAnonymous: false,
  });

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isSettingsMenuOpen, onOpen: onSettingsMenuOpen, onClose: onSettingsMenuClose } = useDisclosure();
  const { isOpen: isDeleteAlertOpen, onOpen: onDeleteAlertOpen, onClose: onDeleteAlertClose } = useDisclosure();
  const cancelRef = useRef();
  const [isDeleting, setIsDeleting] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [showReauthPrompt, setShowReauthPrompt] = useState(false);
  const [createdCommunities, setCreatedCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setProfile(prevProfile => ({
              ...prevProfile,
              name: userData.username || prevProfile.name,
              bio: userData.bio || prevProfile.bio,
              followers: userData.followers || prevProfile.followers,
              following: userData.following || prevProfile.following,
              isAnonymous: userData.isAnonymous || false,
            }));
            setIsAnonymous(userData.isAnonymous || false);
          } else {
            console.log('No such user document!');
            toast({
              title: 'Profile not found',
              description: 'Your user profile document is missing. It will be created when you update your profile.',
              status: 'info',
              duration: 5000,
              isClosable: true,
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          toast({
            title: 'Error',
            description: 'Failed to load profile data.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    };

    fetchProfileData();
  }, [user, db, toast]);

  useEffect(() => {
    const fetchCreatedCommunities = async () => {
      if (user) {
        try {
          setLoadingCommunities(true);
          const communitiesQuery = query(
            collection(db, 'communities'),
            where('admins', 'array-contains', user.uid)
          );
          const communitySnapshot = await getDocs(communitiesQuery);
          const communitiesList = communitySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setCreatedCommunities(communitiesList);
        } catch (error) {
          console.error('Error fetching created communities:', error);
          toast({
            title: 'Error',
            description: 'Failed to load your communities.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        } finally {
          setLoadingCommunities(false);
        }
      }
    };

    fetchCreatedCommunities();
  }, [user, db, toast]);

  const handleAnonymousToggle = async () => {
    const newAnonymousStatus = !isAnonymous;
    setIsAnonymous(newAnonymousStatus);

    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          isAnonymous: newAnonymousStatus,
        }, { merge: true });

        toast({
          title: newAnonymousStatus ? 'Profile is now anonymous' : 'Profile is now public',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error updating anonymous status:', error);
        setIsAnonymous(isAnonymous);
        toast({
          title: 'Error',
          description: 'Failed to update anonymous status.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  const handleSaveProfile = (updatedProfile) => {
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        setDoc(userDocRef, {
          username: updatedProfile.name,
          bio: updatedProfile.bio,
        }, { merge: true });

        toast({
          title: 'Profile updated',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setProfile(updatedProfile);
        onClose();
      } catch (error) {
        console.error('Error updating profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to update profile.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } else {
      setProfile(updatedProfile);
      onClose();
    }
  };

  const handleShareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: `${profile.name}'s Profile on Peeks`,
        text: profile.bio || '',
        url: window.location.href,
      }).then(() => {
        console.log('Profile shared successfully');
      }).catch((error) => {
        console.error('Error sharing profile:', error);
      });
    } else {
      alert(`You can share this profile by copying the URL: ${window.location.href}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: 'Logout Failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);

    try {
      await deleteUser(user);
      toast({
        title: 'Account Deleted',
        description: 'Your account has been successfully deleted.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/signup');
    } catch (error) {
      console.error('Error deleting account:', error);

      if (error.code === 'auth/requires-recent-login') {
        setShowReauthPrompt(true);
        toast({
          title: 'Re-authentication Required',
          description: 'Please log in again to delete your account.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Account Deletion Failed',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setIsDeleting(false);
      onDeleteAlertClose();
      onSettingsMenuClose();
    }
  };

  const handleReauthenticateAndDelete = async () => {
    if (!user || !reauthPassword) return;

    setIsDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, reauthPassword);
      await reauthenticateWithCredential(user, credential);
      await handleDeleteAccount();
    } catch (error) {
      console.error('Re-authentication failed:', error);
      toast({
        title: 'Re-authentication Failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
      setReauthPassword('');
      setShowReauthPrompt(false);
      onDeleteAlertClose();
      onSettingsMenuClose();
    }
  };

  const PostsTabContent = () => <Text>User's posts will appear here.</Text>;

  const CommunityTabContent = () => (
    <VStack spacing={4} align="stretch">
      <Text fontSize="lg" fontWeight="bold">Communities Created by You</Text>
      {loadingCommunities ? (
        <Spinner size="lg" />
      ) : createdCommunities.length > 0 ? (
        createdCommunities.map(community => (
          <HStack
            key={community.id}
            p={4}
            bg="white"
            borderRadius="md"
            boxShadow="sm"
            cursor="pointer"
            onClick={() => navigate(`/community/${community.id}`)}
            align="center"
          >
            <Avatar size="md" name={community.name} src={community.avatarUrl} />
            <Box>
              <Text fontWeight="bold">{community.name}</Text>
              <Text fontSize="sm" color="gray.600" noOfLines={1}>{community.description}</Text>
            </Box>
          </HStack>
        ))
      ) : (
        <Text>You haven't created any communities yet.</Text>
      )}
    </VStack>
  );

  const LiveSessionsTabContent = () => <Text>User's live sessions will appear here.</Text>;

  if (!user) {
    return (
      <Container maxW="container.md" py={6}>
        <Text>Please log in to view your profile.</Text>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50" py={8} px={4}>
      <Container maxW="container.md">
        <VStack spacing={6} align="stretch">
          <Flex justify="space-between" align="center" w="100%" pb={4} borderBottom="1px" borderColor="gray.200">
            <IconButton
              aria-label="Go back"
              icon={<ArrowBackIcon />}
              onClick={() => navigate('/discover')}
              variant="ghost"
            />

            <HStack spacing={2}>
              <Menu isOpen={isSettingsMenuOpen} onClose={onSettingsMenuClose}>
                <MenuButton
                  as={IconButton}
                  aria-label="Settings"
                  icon={<SettingsIcon />}
                  variant="ghost"
                  onClick={onSettingsMenuOpen}
                />
                <MenuList>
                  <MenuItem onClick={handleLogout}>
                    Logout
                  </MenuItem>
                  <MenuItem onClick={onDeleteAlertOpen}>
                    Delete Account
                  </MenuItem>
                </MenuList>
              </Menu>

              {!isAnonymous && user && (
                <HStack spacing={2}>
                  <IconButton
                    aria-label="Share profile"
                    icon={<FiShare />}
                    onClick={handleShareProfile}
                    variant="ghost"
                  />
                  <Button colorScheme="orange" size="sm" onClick={onOpen}>
                    Edit Profile
                  </Button>
                </HStack>
              )}
            </HStack>
          </Flex>

          <VStack spacing={4} align="center" w="100%">
            <Avatar
              size="xl"
              name={isAnonymous ? "Anonymous User" : profile.name}
              src={isAnonymous ? 'images/Anonymous.jpg' : profile.avatarUrl || 'https://via.placeholder.com/150'}
            />

            <Text fontSize="2xl" fontWeight="bold">
              {isAnonymous ? "Anonymous" : profile.name}
            </Text>

            {!isAnonymous && profile.bio && (
              <Text fontSize="md" color="gray.600" textAlign="center">
                {profile.bio}
              </Text>
            )}

            {!isAnonymous && (user && (
              <HStack spacing={8}>
                <VStack>
                  <Text fontSize="lg" fontWeight="bold">{profile.followers}</Text>
                  <Text fontSize="sm" color="gray.600">Followers</Text>
                </VStack>
                <VStack>
                  <Text fontSize="lg" fontWeight="bold">{profile.following}</Text>
                  <Text fontSize="sm" color="gray.600">Following</Text>
                </VStack>
              </HStack>
            ))}

            {user && (
              <FormControl display="flex" alignItems="center" justifyContent="center">
                <FormLabel htmlFor="anonymous-toggle" mb="0">
                  Post Anonymously?
                </FormLabel>
                <Switch
                  id="anonymous-toggle"
                  isChecked={isAnonymous}
                  onChange={handleAnonymousToggle}
                  colorScheme="orange"
                />
              </FormControl>
            )}
          </VStack>

          <Tabs isFitted variant="enclosed">
            <TabList>
              <Tab>Posts</Tab>
              <Tab>Community</Tab>
              <Tab>Live Sessions</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <PostsTabContent />
              </TabPanel>
              <TabPanel>
                <CommunityTabContent />
              </TabPanel>
              <TabPanel>
                <LiveSessionsTabContent />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>

      <EditProfileDialog
        isOpen={isOpen}
        onClose={onClose}
        profile={profile}
        onSave={handleSaveProfile}
      />

      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteAlertClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Account
            </AlertDialogHeader>

            <AlertDialogBody>
              {showReauthPrompt ? (
                <VStack spacing={4}>
                  <Alert status="warning">
                    <AlertIcon />
                    Please re-enter your password to confirm account deletion.
                  </Alert>
                  <FormControl>
                    <FormLabel>Password</FormLabel>
                    <Input
                      type="password"
                      value={reauthPassword}
                      onChange={(e) => setReauthPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </FormControl>
                </VStack>
              ) : (
                <Text>Are you sure you want to delete your account? This action cannot be undone.</Text>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteAlertClose} isDisabled={isDeleting}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={showReauthPrompt ? handleReauthenticateAndDelete : handleDeleteAccount}
                ml={3}
                isLoading={isDeleting}
              >
                {showReauthPrompt ? 'Confirm & Delete' : 'Delete Account'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ProfilePage; 