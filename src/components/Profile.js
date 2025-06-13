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
  FormControl,
  FormErrorMessage,
  ModalCloseButton,
  Flex,
  HStack,
} from '@chakra-ui/react';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, onSnapshot, arrayRemove, arrayUnion, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../firebase';
import { FaCamera, FaEdit, FaArrowLeft, FaCog, FaHeart, FaComment, FaShare, FaBookmark, FaTimes, FaArrowUp, FaEllipsisH } from 'react-icons/fa';
import { storage } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useDisclosure } from '@chakra-ui/react';
import CommentItem from './CommentItem';

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
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [userStories, setUserStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [selectedPostForDetail, setSelectedPostForDetail] = useState(null);
  const { isOpen: isPostDetailModalOpen, onOpen: onPostDetailModalOpen, onClose: onPostDetailModalClose } = useDisclosure();
  const [postComments, setPostComments] = useState([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyingToUsername, setReplyingToUsername] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [postForComments, setPostForComments] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [currentPostComments, setCurrentPostComments] = useState([]);
  const [commentModalTouchStart, setCommentModalTouchStart] = useState(null);
  const [commentModalTouchEnd, setCommentModalTouchEnd] = useState(null);
  const [commentModalTranslateY, setCommentModalTranslateY] = useState(0);
  const minSwipeDownDistance = 50;

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
    fetchUserPosts();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    setStoriesLoading(true);

    const storiesRef = collection(db, 'stories');
    const q = query(
      storiesRef,
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const storiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserStories(storiesData);
      setStoriesLoading(false);
    }, (error) => {
      console.error('Error fetching user stories:', error);
      toast({
        title: 'Error loading stories',
        description: 'Could not load your stories.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setStoriesLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser, toast]);

  // Fetch comments when the post detail modal opens
  useEffect(() => {
    const fetchComments = async () => {
      if (!isPostDetailModalOpen || !selectedPostForDetail?.id) return;

      setCommentLoading(true);
      try {
        const commentsRef = collection(db, 'comments');
        const q = query(commentsRef, where('postId', '==', selectedPostForDetail.id), orderBy('timestamp', 'asc'));
        const querySnapshot = await getDocs(q);
        const commentsData = [];
        for (const doc of querySnapshot.docs) {
          const comment = { id: doc.id, ...doc.data() };
          const userDoc = await getDoc(doc(db, 'users', comment.userId));
          if (userDoc.exists()) {
            commentsData.push({
              ...comment,
              username: userDoc.data().username,
              profilePicture: userDoc.data().profilePicture,
            });
          }
        }
        setPostComments(commentsData);
      } catch (error) {
        console.error('Error fetching comments:', error);
        toast({
          title: 'Error loading comments',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setCommentLoading(false);
      }
    };

    fetchComments();
  }, [isPostDetailModalOpen, selectedPostForDetail?.id, toast]);

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

  const fetchUserPosts = async () => {
    if (!auth.currentUser) return;
    setPostsLoading(true);
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('userId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const postsData = [];
      for (const snapshotDoc of querySnapshot.docs) {
        const post = { id: snapshotDoc.id, ...snapshotDoc.data() };
        // Fetch user info for each post
        const userDoc = await getDoc(doc(db, 'users', post.userId));
        if (userDoc.exists()) {
          postsData.push({
            ...post,
            username: userDoc.data().username,
            userProfilePic: userDoc.data().profilePicture,
          });
        } else {
          // If user doc doesn't exist, still add the post but with default/empty user info
          postsData.push({
            ...post,
            username: 'Unknown User',
            userProfilePic: '',
          });
        }
      }
      setUserPosts(postsData);
    } catch (error) {
      console.error('Error fetching user posts:', error);
      toast({
        title: 'Error loading posts',
        description: 'Could not load your posts.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setPostsLoading(false);
    }
  };

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

  const handleLikePost = async (postId, currentLikes) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const postRef = doc(db, 'posts', postId);

    try {
      if (currentLikes?.includes(userId)) {
        // User has already liked, so unlike
        await updateDoc(postRef, {
          likes: arrayRemove(userId)
        });
        toast({
          title: "Unliked post",
          status: "info",
          duration: 1500,
          isClosable: true,
        });
      } else {
        // User has not liked, so like
        await updateDoc(postRef, {
          likes: arrayUnion(userId)
        });
        toast({
          title: "Liked post",
          status: "success",
          duration: 1500,
          isClosable: true,
        });
      }

      // Update local state to reflect the change immediately
      setUserPosts(userPosts.map(post =>
        post.id === postId
          ? { 
              ...post, 
              likes: currentLikes?.includes(userId) 
                ? currentLikes.filter(id => id !== userId) 
                : [...(currentLikes || []), userId] 
            }
          : post
      ));

      // Update selected post if it's the one being liked
      if (selectedPostForDetail?.id === postId) {
        setSelectedPostForDetail(prev => ({
          ...prev,
          likes: currentLikes?.includes(userId)
            ? currentLikes.filter(id => id !== userId)
            : [...(currentLikes || []), userId]
        }));
      }

    } catch (error) {
      console.error('Error liking/unliking post:', error);
      toast({
        title: "Error",
        description: "Could not update like status.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const onCommentModalTouchStart = (e) => {
    setCommentModalTouchStart(e.targetTouches[0].clientY);
    setCommentModalTranslateY(0);
  };

  const onCommentModalTouchMove = (e) => {
    const currentY = e.targetTouches[0].clientY;
    setCommentModalTouchEnd(currentY);
    
    if (commentModalTouchStart) {
      const distance = currentY - commentModalTouchStart;
      if (distance > 0) { // Only allow downward swipe
        setCommentModalTranslateY(distance);
      }
    }
  };

  const onCommentModalTouchEnd = () => {
    if (!commentModalTouchStart || !commentModalTouchEnd) return;
    
    const distance = commentModalTouchEnd - commentModalTouchStart;
    const isSwipeDown = distance > minSwipeDownDistance;
    
    if (isSwipeDown) {
      // Animate to bottom of screen
      setCommentModalTranslateY(window.innerHeight);
      // Close modal after animation
      setTimeout(() => {
        setIsCommentModalOpen(false);
        setPostForComments(null);
        setNewCommentText('');
        setIsReplying(false);
        setReplyingToUsername('');
        setCommentModalTranslateY(0);
      }, 300);
    } else {
      // Reset position if swipe wasn't far enough
      setCommentModalTranslateY(0);
    }
    
    setCommentModalTouchStart(null);
    setCommentModalTouchEnd(null);
  };

  const handleCommentClick = async (post) => {
    setPostForComments(post);
    setIsCommentModalOpen(true);
    setNewCommentText(''); // Clear previous comment input
    // Fetch comments immediately when modal opens
    setCommentsLoading(true);
    try {
      const commentsRef = collection(db, 'comments');
      const q = query(commentsRef, where('postId', '==', post.id), orderBy('timestamp', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedComments = [];
      for (const doc of querySnapshot.docs) {
        const comment = { id: doc.id, ...doc.data() };
        const userDoc = await getDoc(doc(db, 'users', comment.userId));
        if (userDoc.exists()) {
          fetchedComments.push({
            ...comment,
            username: userDoc.data().username,
            profilePicture: userDoc.data().profilePicture,
          });
        }
      }
      setCurrentPostComments(fetchedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error loading comments",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!auth.currentUser || !postForComments || !newCommentText.trim()) return;

    try {
      const commentData = {
        postId: postForComments.id,
        userId: auth.currentUser.uid,
        text: newCommentText.trim(),
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      
      // Fetch user info for the newly added comment
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      let newCommentDisplay = { ...commentData, id: docRef.id };
      if (userDoc.exists()) {
        newCommentDisplay.username = userDoc.data().username;
        newCommentDisplay.profilePicture = userDoc.data().profilePicture;
      }

      setCurrentPostComments(prevComments => [...prevComments, newCommentDisplay]);
      setNewCommentText('');
      
      toast({
        title: "Comment added",
        status: "success",
        duration: 1500,
        isClosable: true,
      });

    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error adding comment",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';

    let date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return '';
    }

    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
  };

  const handleDeleteComment = async (commentId) => {
    if (!auth.currentUser) return;

    try {
      await deleteDoc(doc(db, 'comments', commentId));

      // Update local state
      setCurrentPostComments(currentPostComments.filter(comment => comment.id !== commentId));

      toast({
        title: "Comment deleted",
        status: "success",
        duration: 1500,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error deleting comment",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
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
        colorScheme="purple"
        onClick={() => navigate('/camera')}
      />
      <IconButton
        icon={<FaCog />}
        aria-label="Settings"
        position="absolute"
        top={4}
        right={4}
        zIndex={10}
        colorScheme="purple"
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
            {postsLoading ? (
              <Center py={10}><Spinner color="purple.400" /></Center>
            ) : userPosts.length === 0 ? (
              <Center py={10}>
                <VStack>
                  <Text fontSize="lg" color="gray.400">No posts yet</Text>
                  <Text fontSize="md" color="gray.500">Share your moments!</Text>
                </VStack>
              </Center>
            ) : (
              <SimpleGrid columns={3} spacing="1px" bg="gray.700">
                {userPosts.map((post) => (
                  <Box 
                    key={post.id} 
                    aspectRatio={1}
                    onClick={() => {
                      setSelectedPostForDetail(post);
                      onPostDetailModalOpen();
                    }}
                    cursor="pointer"
                  >
                    {post.mediaUrl && (
                      post.type === 'video' ? (
                        <video
                          src={post.mediaUrl}
                          controls
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Image
                          src={post.mediaUrl}
                          alt="Post Media"
                          objectFit="cover"
                          w="100%"
                          h="100%"
                        />
                      )
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </TabPanel>
          <TabPanel px={0}>
            {storiesLoading ? (
              <Center py={10}><Spinner color="purple.400" /></Center>
            ) : userStories.length === 0 ? (
              <Center py={10}>
                <VStack>
                  <Text fontSize="lg" color="gray.400">No stories yet</Text>
                  <Text fontSize="md" color="gray.500">Create stories and they will be saved here until you delete them.</Text>
                </VStack>
              </Center>
            ) : (
              <SimpleGrid columns={3} spacing="1px" bg="gray.700">
                {userStories.map((story) => (
                  <Box key={story.id} aspectRatio={1}>
                    {story.mediaUrl && (
                      <Image
                        src={story.mediaUrl}
                        alt="Story Media"
                        objectFit="cover"
                        w="100%"
                        h="100%"
                      />
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} isCentered>
        <ModalOverlay />
        <ModalContent bg="gray.800" color="white">
          <ModalHeader>Edit Profile</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Center position="relative" onClick={handlePhotoIconClick} cursor="pointer">
                <Avatar size="xl" src={editPhotoURL || userData?.profilePicture} />
                <Box
                  position="absolute"
                  bottom="0"
                  right="0"
                  bg="purple.500"
                  borderRadius="full"
                  p={2}
                >
                  <FaCamera size="14px" />
                </Box>
                <Input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  hidden
                />
              </Center>
              <FormControl isInvalid={!!editError}>
                <InputGroup>
                  <Input
                    placeholder="Username"
                    value={editUsername}
                    onChange={handleEditUsernameChange}
                    bg="gray.700"
                    color="white"
                    _placeholder={{ color: 'gray.500' }}
                  />
                  {checkingUsername && (
                    <InputRightElement children={<Spinner size="sm" color="purple.400" />} />
                  )}
                </InputGroup>
                <FormErrorMessage>{editError}</FormErrorMessage>
              </FormControl>
              {usernameSuggestions.length > 0 && (
                <VStack align="start" w="100%">
                  <Text fontSize="sm" color="gray.500">Suggestions:</Text>
                  {usernameSuggestions.map(suggestion => (
                    <Button key={suggestion} size="sm" variant="link" onClick={() => setEditUsername(suggestion)}>
                      {suggestion}
                    </Button>
                  ))}
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="purple" mr={3} onClick={handleSave} isLoading={saving}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Post Detail Modal */}
      {selectedPostForDetail && (
        <Modal isOpen={isPostDetailModalOpen} onClose={onPostDetailModalClose} size="xl" isCentered>
          <ModalOverlay />
          <ModalContent borderRadius="lg" overflow="hidden">
            <ModalHeader p={4} borderBottom="1px" borderColor="gray.200">
              <Flex align="center">
                <Avatar size="sm" src={selectedPostForDetail.userProfilePic} />
                <Text ml={3} fontWeight="bold">{selectedPostForDetail.username}</Text>
              </Flex>
              <ModalCloseButton />
            </ModalHeader>
            <ModalBody p={0}>
              {selectedPostForDetail.mediaUrl && (
                selectedPostForDetail.type === 'video' ? (
                  <video
                    src={selectedPostForDetail.mediaUrl}
                    controls
                    style={{
                      width: '100%',
                      maxHeight: '500px',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <Image
                    src={selectedPostForDetail.mediaUrl}
                    alt="Post media"
                    objectFit="contain"
                    w="100%"
                    maxH="500px"
                  />
                )
              )}

              <Box p={4}>
                {selectedPostForDetail.content && <Text mb={2}>{selectedPostForDetail.content}</Text>}
                {selectedPostForDetail.userId === auth.currentUser?.uid && (
                  <Text fontSize="sm" color="gray.500">{selectedPostForDetail.likes?.length || 0} likes</Text>
                )}
                
                {/* Comments Section */}
                <VStack align="stretch" mt={4} spacing={3}>
                  {commentLoading ? (
                    <Center py={4}><Spinner size="sm" color="purple.500" /></Center>
                  ) : postComments.length === 0 ? (
                    <Text fontSize="sm" color="gray.500" textAlign="center">No comments yet.</Text>
                  ) : (
                    postComments.map(comment => (
                      <Flex key={comment.id} align="flex-start">
                        <Avatar size="xs" src={comment.profilePicture} mr={2} />
                        <Box>
                          <Text fontSize="sm">
                            <Text as="span" fontWeight="bold">{comment.username}</Text>{' '}
                            {comment.text}
                          </Text>
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            {getTimeAgo(comment.timestamp)}
                          </Text>
                        </Box>
                      </Flex>
                    ))
                  )}
                </VStack>
              </Box>

              <Flex p={4} borderTop="1px" borderColor="gray.200" justify="space-between">
                <HStack spacing={4}>
                  <IconButton 
                    icon={<FaHeart />} 
                    variant="ghost" 
                    aria-label="Like post"
                    color={selectedPostForDetail.likes?.includes(auth.currentUser?.uid) ? "purple.500" : "gray.500"}
                    onClick={() => handleLikePost(selectedPostForDetail.id, selectedPostForDetail.likes)}
                  />
                  <IconButton 
                    icon={<FaComment />} 
                    variant="ghost" 
                    aria-label="Comment on post"
                    onClick={() => handleCommentClick(selectedPostForDetail)}
                  />
                  <IconButton icon={<FaShare />} variant="ghost" aria-label="Share post" />
                </HStack>
                <IconButton icon={<FaBookmark />} variant="ghost" aria-label="Save post" />
              </Flex>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {/* Comment Modal */}
      <Modal 
        isOpen={isCommentModalOpen} 
        onClose={() => {
          setIsCommentModalOpen(false);
          setPostForComments(null);
          setNewCommentText('');
          setIsReplying(false);
          setReplyingToUsername('');
        }} 
        size="full" 
        motionPreset="slideInBottom"
      >
        <ModalOverlay />
        <ModalContent 
          borderRadius="20px 20px 0 0" 
          bg="white" 
          py={4} 
          h="90vh" 
          mt="auto"
          onTouchStart={onCommentModalTouchStart}
          onTouchMove={onCommentModalTouchMove}
          onTouchEnd={onCommentModalTouchEnd}
          position="relative"
          transition="transform 0.3s ease-out"
          transform={`translateY(${commentModalTranslateY}px)`}
          style={{
            touchAction: 'none'
          }}
        >
          <ModalHeader pb={2}>
            <Flex align="center" justify="space-between">
              <IconButton 
                icon={<FaArrowLeft />} 
                variant="ghost" 
                onClick={() => {
                  setIsCommentModalOpen(false);
                  setPostForComments(null);
                  setNewCommentText('');
                  setIsReplying(false);
                  setReplyingToUsername('');
                }} 
                aria-label="Go back" 
              />
              <Text fontSize="lg" fontWeight="bold">Comments</Text>
              <IconButton icon={<FaEllipsisH />} variant="ghost" aria-label="More options" />
            </Flex>
          </ModalHeader>
          <ModalCloseButton display="none" />

          <ModalBody px={0} pt={0} display="flex" flexDirection="column">
            {/* Comments List */}
            {postForComments ? (
              <VStack spacing={4} align="stretch" px={4} py={3} overflowY="auto" flex={1}>
                {commentsLoading ? (
                  <Center py={10}>
                    <Spinner color="purple.400" />
                  </Center>
                ) : currentPostComments.length === 0 ? (
                  <Center py={10}>
                    <Text fontSize="lg" color="gray.400">No comments yet</Text>
                  </Center>
                ) : (
                  currentPostComments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      postForComments={postForComments}
                      handleDeleteComment={handleDeleteComment}
                      getTimeAgo={getTimeAgo}
                      setIsReplying={setIsReplying}
                      setReplyingToUsername={setReplyingToUsername}
                      setNewCommentText={setNewCommentText}
                    />
                  ))
                )}
              </VStack>
            ) : (
              <Center py={10}>
                <Text fontSize="lg" color="gray.400">Select a post to view comments.</Text>
              </Center>
            )}

            {/* Comment Input Area */}
            <Box p={4} borderTop="1px" borderColor="gray.200">
              {isReplying && replyingToUsername && (
                <Flex align="center" mb={2} px={2}>
                  <Text fontSize="sm" color="gray.500">Replying to {replyingToUsername}</Text>
                  <IconButton
                    icon={<FaTimes />} 
                    variant="ghost" 
                    size="xs" 
                    ml={2} 
                    onClick={() => {
                      setIsReplying(false);
                      setReplyingToUsername('');
                      setNewCommentText('');
                    }}
                    aria-label="Clear reply"
                  />
                </Flex>
              )}
              <HStack>
                <Input
                  placeholder="Add a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  borderRadius="full"
                  flex="1"
                />
                <IconButton 
                  icon={<FaArrowUp />} 
                  colorScheme="purple" 
                  borderRadius="full" 
                  onClick={handleAddComment} 
                  aria-label="Send comment" 
                />
              </HStack>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Profile; 