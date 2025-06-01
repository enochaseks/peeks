import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Container,
  Flex,
  Image,
  Text,
  Avatar,
  Button,
  VStack,
  HStack,
  IconButton,
  useToast,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Select,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Input,
  Spacer,
  Progress,
  Tooltip,
} from '@chakra-ui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth, default as firebaseApp } from '../firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { ArrowBackIcon, EditIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';

// Initialize Firebase Storage
const storage = getStorage();

const CommunityPage = () => {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [community, setCommunity] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [isModerationModalOpen, setIsModerationModalOpen] = useState(false);
  const [moderators, setModerators] = useState([]);
  const [selectedModerator, setSelectedModerator] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const backgroundInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Get storage instance from the initialized firebase app
  const storageInstance = useMemo(() => getStorage(firebaseApp), [firebaseApp]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setCurrentUserProfile({
              username: userData.username || user.email || 'User', // Prefer username, fallback to email, then 'User'
              avatarUrl: userData.avatarUrl || '',
              isAnonymous: userData.isAnonymous || false,
              uid: user.uid
            });
          } else {
            setCurrentUserProfile({
              username: user.email || 'User', // Fallback to email if no user doc
              avatarUrl: '',
              isAnonymous: false,
              uid: user.uid
            });
            console.warn('User document not found for profile header in CommunityPage.');
          }
        } catch (error) {
          console.error('Error fetching user profile for header:', error);
          setCurrentUserProfile({
            username: user?.email || 'User', // Fallback to email on error
            avatarUrl: '',
            isAnonymous: false,
            uid: user?.uid
          });
        }
      } else {
        setCurrentUserProfile(null);
      }
    };

    fetchUserProfile();

    const unsubscribe = auth.onAuthStateChanged(() => {
      // Re-fetch profile on auth state change to ensure we have the latest data
      fetchUserProfile();
    });

    return () => unsubscribe();
  }, [db, auth]);

  // Set up online status tracking
  useEffect(() => {
    const user = auth.currentUser;
    // Only proceed if user and community ID are available, and user profile is loaded
    if (!user || !communityId || !currentUserProfile) return;

    // Reference to the user's online status document
    const userStatusRef = doc(db, 'status', user.uid);
    const communityStatusRef = doc(db, 'communities', communityId, 'status', user.uid);

    // Set up real-time listener for online users in this community
    const unsubscribeOnlineUsers = onSnapshot(
      collection(db, 'communities', communityId, 'status'),
      (snapshot) => {
        const onlineUsersList = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Online user data from snapshot:', data); // Log the data being received
          if (data.state === 'online') {
            onlineUsersList.push({
              uid: doc.id,
              lastSeen: data.lastSeen,
              username: data.username, // This should now be the actual username from Firestore
              isAnonymous: data.isAnonymous
            });
          }
        });
        setOnlineUsers(onlineUsersList);
      }
    );

    // Set user as online
    const setOnline = async () => {
      try {
         // Re-fetch user document right before setting status to get latest username
         const userDocSnap = await getDoc(doc(db, 'users', user.uid));
         const userData = userDocSnap.exists() ? userDocSnap.data() : {};
         const currentUsername = userData.username || user.email || 'Anonymous User';
         const isAnon = userData.isAnonymous || false;

        // Create or update user status
        await setDoc(userStatusRef, {
          state: 'online',
          lastSeen: serverTimestamp(),
          userId: user.uid
        }, { merge: true });

        // Create or update community status with the correct username and anonymity status
        await setDoc(communityStatusRef, {
          state: 'online',
          lastSeen: serverTimestamp(),
          userId: user.uid,
          username: currentUsername, // Use the fetched username
          isAnonymous: isAnon // Use the fetched anonymity status
        }, { merge: true });
      } catch (error) {
        console.error('Error setting online status:', error);
      }
    };

    // Set user as offline
    const setOffline = async () => {
      try {
         // Re-fetch user document right before setting status to get latest username
         const userDocSnap = await getDoc(doc(db, 'users', user.uid));
         const userData = userDocSnap.exists() ? userDocSnap.data() : {};
         const currentUsername = userData.username || user.email || 'Anonymous User';
         const isAnon = userData.isAnonymous || false;

        // Update user status
        await setDoc(userStatusRef, {
          state: 'offline',
          lastSeen: serverTimestamp(),
          userId: user.uid
        }, { merge: true });

        // Update community status with the correct username and anonymity status
        await setDoc(communityStatusRef, {
          state: 'offline',
          lastSeen: serverTimestamp(),
          userId: user.uid,
          username: currentUsername, // Use the fetched username
          isAnonymous: isAnon // Use the fetched anonymity status
        }, { merge: true });
      } catch (error) {
        console.error('Error setting offline status:', error);
      }
    };

    // Initialize status and set online
    const initializeAndSetOnline = async () => {
       // Re-fetch user document right before initialization to get latest username
       const userDocSnap = await getDoc(doc(db, 'users', user.uid));
       const userData = userDocSnap.exists() ? userDocSnap.data() : {};
       const currentUsername = userData.username || user.email || 'Anonymous User';
       const isAnon = userData.isAnonymous || false;

       // Check if the community status document exists, if not, initialize
       const communityStatusSnap = await getDoc(communityStatusRef);
       if (!communityStatusSnap.exists()) {
         await setDoc(communityStatusRef, {
           state: 'offline',
           lastSeen: serverTimestamp(),
           userId: user.uid,
           username: currentUsername, // Use the fetched username
           isAnonymous: isAnon // Use the fetched anonymity status
         });
       }

       // Check if the global user status document exists, if not, initialize
       const userStatusSnap = await getDoc(userStatusRef);
       if (!userStatusSnap.exists()) {
          await setDoc(userStatusRef, {
            state: 'offline',
            lastSeen: serverTimestamp(),
            userId: user.uid
          });
       }

      // Now set the user online
      await setOnline();
    };

    // Initialize and set online status
    initializeAndSetOnline();

    // Set up window event listeners for online/offline status
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    // Cleanup function
    return () => {
      unsubscribeOnlineUsers();
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
      setOffline();
    };

  }, [communityId, currentUserProfile]); // Depend on currentUserProfile

  // Fetch community data and handle unique visitor count
  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const communityDocRef = doc(db, 'communities', communityId);
        const communityDoc = await getDoc(communityDocRef);

        if (communityDoc.exists()) {
          const communityData = communityDoc.data();
          setCommunity({
            id: communityDoc.id,
            ...communityData,
            backgroundImage: communityData.backgroundImage || 'https://via.placeholder.com/1200x300/CCCCCC/FFFFFF/?text=Community+Background',
            avatarUrl: communityData.avatarUrl || 'https://via.placeholder.com/150/CCCCCC/FFFFFF/?text=Community',
          });

          const currentUser = auth.currentUser;
          if (currentUser) {
            setIsAdmin(communityData.admins.includes(currentUser.uid));

            // Handle unique visitor count
            const visitors = communityData.visitors || [];
            if (!visitors.includes(currentUser.uid)) {
              // New unique visitor
              const updatedVisitors = [...visitors, currentUser.uid];
              const newVisitorCount = (communityData.visitorCount || 0) + 1;

              await updateDoc(communityDocRef, {
                visitors: updatedVisitors,
                visitorCount: newVisitorCount
              });
              setVisitorCount(newVisitorCount);
            } else {
              // Existing visitor
              setVisitorCount(communityData.visitorCount || 0);
            }

          } else {
             // If user is not logged in, just display the current count
            setVisitorCount(communityData.visitorCount || 0);
          }

          setModerators(communityData.moderators || []);

        } else {
          toast({
            title: 'Community not found',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          navigate('/discover');
        }
      } catch (error) {
        console.error('Error fetching community or updating visitor count:', error);
        toast({
          title: 'Error',
          description: 'Failed to load community data or update visitor count',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    fetchCommunity();
  }, [communityId, navigate, toast, auth.currentUser]); // Depend on communityId and auth.currentUser

  useEffect(() => {
    const fetchPosts = async () => {
      if (!communityId) return;
      
      try {
        const postsQuery = query(
          collection(db, 'communities', communityId, 'posts'),
          where('status', '==', 'approved')
        );
        const postsSnapshot = await getDocs(postsQuery);
        const postsData = postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPosts(postsData);
      } catch (error) {
        console.error('Error fetching posts:', error);
        toast({
          title: 'Error',
          description: 'Failed to load posts',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    fetchPosts();
  }, [communityId, toast]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCollection = collection(db, 'users');
        const userSnapshot = await getDocs(usersCollection);
        const usersList = userSnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username || doc.id,
        }));
        setAvailableUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    if (isModerationModalOpen) {
      fetchUsers();
    }
  }, [isModerationModalOpen]);

  const handleCreatePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const postData = {
        title: newPost.title,
        content: newPost.content,
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      await addDoc(collection(db, 'communities', communityId, 'posts'), postData);
      
      toast({
        title: 'Success',
        description: 'Your post has been submitted for moderation',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setNewPost({ title: '', content: '' });
      setIsCreatePostModalOpen(false);
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAddModerator = async () => {
    if (!selectedModerator) return;

    if (moderators.includes(selectedModerator)) {
      toast({
        title: 'Error',
        description: 'User is already a moderator.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const updatedModerators = [...moderators, selectedModerator];
      await updateDoc(doc(db, 'communities', communityId), {
        moderators: updatedModerators
      });
      
      setModerators(updatedModerators);
      setSelectedModerator('');
      
      toast({
        title: 'Success',
        description: 'Moderator added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding moderator:', error);
      toast({
        title: 'Error',
        description: 'Failed to add moderator',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleRemoveModerator = async (moderatorId) => {
    try {
      const updatedModerators = moderators.filter(id => id !== moderatorId);
      await updateDoc(doc(db, 'communities', communityId), {
        moderators: updatedModerators
      });
      
      setModerators(updatedModerators);
      
      toast({
        title: 'Success',
        description: 'Moderator removed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error removing moderator:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove moderator',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleBackgroundClick = () => {
    backgroundInputRef.current.click();
  };

  const handleBackgroundChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !community) return;

    setIsUploading(true);
    setUploadProgress(0);

    const storageRef = ref(storageInstance, `community_backgrounds/${communityId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Background upload error:', error);
        toast({
          title: 'Upload failed',
          description: error.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setIsUploading(false);
        setUploadProgress(0);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        console.log('Background image uploaded, URL:', downloadURL);

        try {
          await updateDoc(doc(db, 'communities', communityId), { backgroundImage: downloadURL });
          setCommunity(prevCommunity => ({ ...prevCommunity, backgroundImage: downloadURL }));
          toast({
            title: 'Success',
            description: 'Background image updated successfully',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        } catch (firestoreError) {
          console.error('Error updating community background in Firestore:', firestoreError);
          toast({
            title: 'Firestore update failed',
            description: firestoreError.message,
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }
    );
  };

  const handleAvatarClick = () => {
    // avatarInputRef.current.click();
  };

  const handleAvatarChange = async (event) => {
    console.log('Avatar file selected (handler not fully implemented in this step)', event.target.files[0]);
  };

  if (!community) {
    return (
      <Container maxW="container.xl" py={8}>
        <Text>Loading community...</Text>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex 
        justify="space-between" 
        align="center" 
        py={4} 
        px={4}
        borderBottom="1px" 
        borderColor="gray.200"
        bg="white"
      >
        <HStack spacing={2}>
          <IconButton
            icon={<ArrowBackIcon />}
            aria-label="Go back"
            onClick={() => navigate(-1)}
            variant="ghost"
          />
          <Image src="/logo192.png" alt="Peeks Logo" boxSize="30px" />
          <Text fontSize="lg" fontWeight="bold">Peeks</Text>
        </HStack>

        <Spacer />

        <HStack spacing={2}>
          <Button variant="ghost" onClick={() => navigate('/profile')} p={0} minW="auto">
            <Avatar
              size="sm"
              name={currentUserProfile?.isAnonymous ? "Anonymous User" : currentUserProfile?.username || 'User'}
              src={currentUserProfile?.isAnonymous ? 'images/Anonymous.jpg' : currentUserProfile?.avatarUrl || 'https://via.placeholder.com/150'}
              cursor="pointer"
            />
          </Button>
        </HStack>
      </Flex>

      <Box 
        h="300px" 
        bgImage={`url(${community.backgroundImage})`}
        bgSize="cover"
        bgPosition="center"
        position="relative"
        _hover={{ opacity: isAdmin ? 0.9 : 1, cursor: isAdmin ? 'pointer' : 'default' }}
      >
        {isAdmin && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            onClick={handleBackgroundClick}
            aria-label="Change background image"
            opacity={isUploading ? 0.5 : 1}
            pointerEvents={isUploading ? 'none' : 'auto'}
          >
            <IconButton
              icon={<EditIcon />}
              position="absolute"
              bottom={4}
              right={4}
              aria-label="Change background"
              pointerEvents="none"
            />
            <Input
              type="file"
              ref={backgroundInputRef}
              onChange={handleBackgroundChange}
              accept="image/*"
              display="none"
            />
            {isUploading && (
              <Progress 
                value={uploadProgress} 
                size="xs" 
                colorScheme="orange" 
                position="absolute" 
                bottom={0} 
                left={0} 
                right={0} 
                borderRadius="md"
                hasStripe
                isAnimated
              />
            )}
          </Box>
        )}
      </Box>

      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'center', md: 'flex-end' }} gap={4}>
            <Avatar
              size="2xl"
              name={community.isAnonymous ? "Anonymous Community" : community.name}
              src={community.avatarUrl}
              position="relative"
              top="-50px"
              border="4px solid white"
            />
            {isAdmin && (
              <IconButton
                icon={<EditIcon />}
                position="absolute"
                top="calc(50% - 50px)"
                left="50%"
                transform="translate(-50%, -50%)"
                onClick={() => {/* TODO: Implement avatar change */}}
                aria-label="Change avatar"
                display="none"
                _groupHover={{ display: 'block' }}
              />
            )}
            <Box flex="1" ml={{ base: 0, md: 4 }} mt={{ base: -8, md: 0 }}>
              <HStack spacing={4} align="center">
                <Text fontSize="2xl" fontWeight="bold">
                  {community.isAnonymous ? "Anonymous Community" : community.name}
                </Text>
                {community.isAnonymous && <Badge colorScheme="gray">Anonymous</Badge>}
              </HStack>
              <Text color="gray.600" mt={2}>{community.description}</Text>
              <HStack spacing={4} mt={4}>
                <Text color="gray.500">{visitorCount} visitors</Text>
                {isAdmin && (
                  <Button
                    size="sm"
                    colorScheme="orange"
                    onClick={() => setIsModerationModalOpen(true)}
                  >
                    Moderation
                  </Button>
                )}
              </HStack>
            </Box>
          </Flex>

          <Tabs variant="enclosed">
            <TabList>
              <Tab>Posts</Tab>
              <Tab>Members</Tab>
              <Tab>About</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Button
                    leftIcon={<AddIcon />}
                    colorScheme="orange"
                    onClick={() => setIsCreatePostModalOpen(true)}
                  >
                    Create Post
                  </Button>

                  {posts.map(post => (
                    <Box
                      key={post.id}
                      p={4}
                      bg="white"
                      borderRadius="md"
                      boxShadow="sm"
                    >
                      <Text fontSize="lg" fontWeight="bold">{post.title}</Text>
                      <Text mt={2}>{post.content}</Text>
                      <Text fontSize="sm" color="gray.500" mt={2}>
                        Posted by {post.authorName} on {new Date(post.createdAt).toLocaleDateString()}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </TabPanel>
              <TabPanel>
                <VStack spacing={4} align="stretch">
                  <Text fontSize="lg" fontWeight="bold">Online Members</Text>
                  {onlineUsers.length > 0 ? (
                    onlineUsers.map(user => {
                      // Determine display name: prefer username if it doesn't look like an email
                      const displayName = user.isAnonymous
                        ? "Anonymous User"
                        : (user.username && !user.username.includes('@'))
                          ? user.username
                          : (user.username && user.username.includes('@') ? user.username.split('@')[0] : 'User'); // Fallback to part of email or 'User'

                      return (
                        <HStack 
                          key={user.uid} 
                          p={2} 
                          bg="white" 
                          borderRadius="md" 
                          boxShadow="sm"
                          spacing={3}
                        >
                          <Box position="relative">
                            <Avatar
                              size="sm"
                              name={displayName}
                              src={user.isAnonymous ? 'images/Anonymous.jpg' : ''}
                            />
                            <Box
                              position="absolute"
                              bottom="0"
                              right="0"
                              w="3"
                              h="3"
                              bg="green.500"
                              borderRadius="full"
                              border="2px solid white"
                            />
                          </Box>
                          {/* Display the determined display name */}
                          <Text>{displayName}</Text>
                          {user.isAnonymous && <Badge colorScheme="gray">Anonymous</Badge>}
                          {community?.admins?.includes(user.uid) && <Badge colorScheme="orange">Admin</Badge>}
                          {moderators.includes(user.uid) && <Badge colorScheme="blue">Moderator</Badge>}
                        </HStack>
                      );
                    })
                  ) : (
                    <Text color="gray.500">No members currently online</Text>
                  )}
                </VStack>
              </TabPanel>
              <TabPanel>
                <VStack align="stretch" spacing={4}>
                  <Text fontWeight="bold">Description</Text>
                  <Text>{community.description}</Text>
                  {community.rules && (
                    <>
                      <Text fontWeight="bold" mt={4}>Rules</Text>
                      <Text>{community.rules}</Text>
                    </>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>

      <Modal isOpen={isCreatePostModalOpen} onClose={() => setIsCreatePostModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Post</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Input
                placeholder="Post title"
                value={newPost.title}
                onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              />
              <Textarea
                placeholder="Post content"
                value={newPost.content}
                onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                minH="200px"
              />
              <Button colorScheme="orange" onClick={handleCreatePost} width="full">
                Submit Post
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isModerationModalOpen} onClose={() => setIsModerationModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Community Moderation</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text fontWeight="bold">Current Moderators</Text>
              {moderators.length > 0 ? (
                moderators.map(moderatorId => (
                  <HStack key={moderatorId} justify="space-between" width="full">
                    <Text>{moderatorId}</Text>
                    <IconButton
                      icon={<DeleteIcon />}
                      onClick={() => handleRemoveModerator(moderatorId)}
                      aria-label="Remove moderator"
                      size="sm"
                    />
                  </HStack>
                ))
              ) : (
                <Text color="gray.500">No moderators added yet.</Text>
              )}
              
              {isAdmin && (
                <>
                  <Text fontWeight="bold" mt={4}>Add New Moderator</Text>
                  <Select
                    placeholder="Select user"
                    value={selectedModerator}
                    onChange={(e) => setSelectedModerator(e.target.value)}
                  >
                    {availableUsers
                      .filter(user => !moderators.includes(user.id))
                      .map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </Select>
                  <Button 
                    colorScheme="orange" 
                    onClick={handleAddModerator} 
                    width="full"
                    isDisabled={!selectedModerator}
                  >
                    Add Moderator
                  </Button>
                </>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default CommunityPage; 