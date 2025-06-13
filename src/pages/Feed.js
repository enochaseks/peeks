import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  IconButton,
  Text,
  Avatar,
  Image,
  Flex,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Input,
  useToast,
  Center,
  Spinner,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { FaPlus, FaHeart, FaComment, FaBookmark, FaShare, FaEllipsisH, FaArrowLeft, FaTimes, FaCamera, FaArrowUp } from 'react-icons/fa';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, doc as firestoreDoc, getDoc, deleteDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useNavigate } from 'react-router-dom';
import StoryViewer from '../components/StoryViewer';
import CommentItem from '../components/CommentItem';

const Feed = () => {
  const [stories, setStories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newPost, setNewPost] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const toast = useToast();
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;
  const navigate = useNavigate();
  const [selectedStory, setSelectedStory] = useState(null);
  const { isOpen: isStoryOpen, onOpen: onStoryOpen, onClose: onStoryClose } = useDisclosure();
  const { isOpen: isPostModalOpen, onOpen: onPostModalOpen, onClose: onPostModalClose } = useDisclosure();
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isEditPostModalOpen, setIsEditPostModalOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null);
  const [editPostCaption, setEditPostCaption] = useState('');
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [postForComments, setPostForComments] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [currentPostComments, setCurrentPostComments] = useState([]);
  const [isReplying, setIsReplying] = useState(false);
  const [replyingToUsername, setReplyingToUsername] = useState('');
  const [commentModalTouchStart, setCommentModalTouchStart] = useState(null);
  const [commentModalTouchEnd, setCommentModalTouchEnd] = useState(null);
  const [commentModalTranslateY, setCommentModalTranslateY] = useState(0);
  const minSwipeDownDistance = 50;

  useEffect(() => {
    fetchStories();
    fetchPosts();
    fetchFollowing();
    fetchCurrentUserProfilePic();
  }, []);

  const fetchCurrentUserProfilePic = async () => {
    if (!auth.currentUser) return;
    try {
      const userDoc = await getDoc(firestoreDoc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setCurrentUserProfilePic(userDoc.data().profilePicture || null);
      }
    } catch (error) {
      console.error('Error fetching current user profile pic:', error);
    }
  };

  const fetchStories = async () => {
    if (!auth.currentUser) return;
    
    try {
      // First get the list of users being followed
      const followingRef = collection(db, 'following');
      const followingQuery = query(followingRef, where('followerId', '==', auth.currentUser.uid));
      const followingSnapshot = await getDocs(followingQuery);
      const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);
      
      // Add current user's ID to the list
      const allUserIds = [auth.currentUser.uid, ...followingIds];
      
      // Get stories from all these users
      const storiesRef = collection(db, 'stories');
      const storiesQuery = query(
        storiesRef,
        where('userId', 'in', allUserIds),
        where('timestamp', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)), // Only last 24 hours
        orderBy('timestamp', 'desc')
      );
      
      const storiesSnapshot = await getDocs(storiesQuery);
      
      // Group stories by user
      const storiesByUser = {};
      storiesSnapshot.docs.forEach(doc => {
        const story = { id: doc.id, ...doc.data() };
        if (!storiesByUser[story.userId]) {
          storiesByUser[story.userId] = {
            userId: story.userId,
            username: story.username,
            userProfilePic: story.userProfilePic,
            stories: []
          };
        }
        storiesByUser[story.userId].stories.push(story);
      });
      
      // Convert to array and sort by most recent story
      const storiesData = Object.values(storiesByUser).sort((a, b) => {
        const aLatest = Math.max(...a.stories.map(s => s.timestamp?.toDate() || 0));
        const bLatest = Math.max(...b.stories.map(s => s.timestamp?.toDate() || 0));
        return bLatest - aLatest;
      });
      
      setStories(storiesData);
    } catch (error) {
      console.error('Error fetching stories:', error);
      toast({
        title: 'Error loading stories',
        description: 'Please try again later',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const fetchPosts = async () => {
    if (!auth.currentUser) return;
    
    try {
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('userId', 'in', [auth.currentUser.uid, ...following]),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const postsData = await Promise.all(querySnapshot.docs.map(async snapshotDoc => {
        const post = { id: snapshotDoc.id, ...snapshotDoc.data() };
        try {
          const userDoc = await getDoc(firestoreDoc(db, 'users', post.userId));
          if (userDoc.exists()) {
            post.username = userDoc.data().username;
            post.userProfilePic = userDoc.data().profilePicture;
          } else {
            // Assign default values if user document doesn't exist
            post.username = 'Unknown User';
            post.userProfilePic = null;
          }
          // Ensure post.likes is always an array
          if (!Array.isArray(post.likes)) {
            post.likes = [];
          }
        } catch (innerError) {
          console.error(`Error fetching user info for post ${post.id}:`, innerError);
          // Assign default values if fetching user info fails
          post.username = 'Error User';
          post.userProfilePic = null;
        }
        return post;
      }));
      
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Optionally, you might want to show a toast message here for the user
      // toast({
      //   title: "Error loading posts",
      //   description: "Could not load posts. Please try again later.",
      //   status: "error",
      //   duration: 3000,
      //   isClosable: true,
      // });
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchFollowing = async () => {
    if (!auth.currentUser) return;
    
    try {
      const followingRef = collection(db, 'following');
      const q = query(followingRef, where('followerId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const followingData = querySnapshot.docs.map(doc => doc.data().followingId);
      setFollowing(followingData);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handlePostSubmit = async () => {
    if (!auth.currentUser) return;
    
    try {
      const postData = {
        userId: auth.currentUser.uid,
        content: newPost,
        timestamp: serverTimestamp(),
        likes: [],
        comments: []
      };

      console.log('Selected file:', selectedFile);

      if (selectedFile) {
        const storageRef = ref(storage, `posts/${auth.currentUser.uid}/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(storageRef, selectedFile);
        const mediaUrl = await getDownloadURL(storageRef);
        postData.mediaUrl = mediaUrl;
        postData.type = selectedFile.type.startsWith('image') ? 'image' : 'video';
        console.log('Media URL generated:', mediaUrl);
        console.log('Media type:', postData.type);
      }

      console.log('Post data being sent to Firestore:', postData);
      await addDoc(collection(db, 'posts'), postData);
      
      setNewPost('');
      setSelectedFile(null);
      onPostModalClose();
      fetchPosts();
      
      toast({
        title: 'Post created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error creating post',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleLikePost = async (postId, currentLikes) => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const postRef = firestoreDoc(db, 'posts', postId);

    try {
      if (currentLikes.includes(userId)) {
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
      setPosts(posts.map(post =>
        post.id === postId
          ? { ...post, likes: currentLikes.includes(userId) ? currentLikes.filter(id => id !== userId) : [...currentLikes, userId] }
          : post
      ));

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

  const handleDeletePost = async (postId) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(firestoreDoc(db, 'posts', postId));
      toast({
        title: 'Post deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchPosts(); // Refresh posts after deletion
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error deleting post',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleEditPost = (post) => {
    setPostToEdit(post);
    setEditPostCaption(post.content || '');
    setIsEditPostModalOpen(true);
  };

  const handleSaveEditedPost = async () => {
    if (!postToEdit) return;
    try {
      const postRef = firestoreDoc(db, 'posts', postToEdit.id);
      await updateDoc(postRef, {
        content: editPostCaption,
      });

      // Update local state
      setPosts(posts.map(p =>
        p.id === postToEdit.id ? { ...p, content: editPostCaption } : p
      ));

      toast({
        title: "Post updated",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      setIsEditPostModalOpen(false);
      setPostToEdit(null);
      setEditPostCaption('');
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Error updating post",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleArchivePost = (postId) => {
    toast({
      title: "Archive Post",
      description: `Post ${postId} archived (placeholder).`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
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
        const userDoc = await getDoc(firestoreDoc(db, 'users', comment.userId));
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
      
      // Fetch user info for the newly added comment to display it immediately
      const userDoc = await getDoc(firestoreDoc(db, 'users', auth.currentUser.uid));
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

  const handleDeleteComment = async (commentId) => {
    if (!auth.currentUser) return;

    try {
      await deleteDoc(firestoreDoc(db, 'comments', commentId));

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

  const onTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isRightSwipe) {
      navigate('/camera');
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleStoryClick = (story) => {
    setSelectedStory(story);
    onStoryOpen();
  };

  const handleAddStory = () => {
    toast({
      title: "Add Story",
      description: "Functionality to add a new story will be implemented here.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';

    let date;
    // Check if it's a Firestore Timestamp object
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Already a JavaScript Date object
      date = timestamp;
    } else {
      // Handle other potential formats or return empty if unknown
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

  const currentUserId = auth.currentUser?.uid;
  const currentUserStoriesGroup = stories.find(
    (userStories) => userStories.userId === currentUserId
  );
  const otherUsersStories = stories.filter(
    (userStories) => userStories.userId !== currentUserId
  );

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

  return (
    <Box
      w="100%"
      h="100vh"
      overflowY="auto"
      bg="gray.50"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header Section */}
      <Box 
        bg="white" 
        p={4} 
        borderBottom="1px" 
        borderColor="gray.200"
        position="sticky"
        top={0}
        zIndex={1}
      >
        <Flex justify="space-between" align="center">
          <Text fontSize="2xl" fontWeight="bold" color="purple.500">
            Your Feed
          </Text>
          <Button
            leftIcon={<FaPlus />}
            colorScheme="purple"
            size="sm"
            onClick={onPostModalOpen}
          >
            Create Post
          </Button>
        </Flex>
      </Box>

      {/* Stories Section */}
      <Box p={4} borderBottom="1px" borderColor="gray.200" bg="white">
        <HStack spacing={4} overflowX="auto" pb={2}>
          <Box
            textAlign="center"
            onClick={() => {
              if (currentUserStoriesGroup && currentUserStoriesGroup.stories.length > 0) {
                handleStoryClick(currentUserStoriesGroup);
              } else {
                handleAddStory();
              }
            }}
            cursor="pointer"
            position="relative"
          >
            <Box
              w="80px"
              h="80px"
              borderRadius="full"
              border="2px solid"
              borderColor="purple.500"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="gray.100"
              overflow="hidden"
            >
              {currentUserStoriesGroup && currentUserStoriesGroup.stories.length > 0 ? (
                <Image
                  src={currentUserStoriesGroup.stories[0].mediaUrl}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                />
              ) : currentUserProfilePic ? (
                <Image
                  src={currentUserProfilePic}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                />
              ) : (
                <FaPlus color="purple" size="24px" />
              )}
            </Box>
            <Box
              position="absolute"
              bottom="22px"
              right="0"
              w="24px"
              h="24px"
              borderRadius="full"
              bg="purple.500"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="2px solid white"
            >
              <FaPlus color="white" size="14px" />
            </Box>
            <Text fontSize="xs" mt={1}>
              Add Story
            </Text>
          </Box>
          {otherUsersStories.map((userStories) => (
            <Box 
              key={userStories.userId} 
              textAlign="center"
              onClick={() => handleStoryClick(userStories)}
              cursor="pointer"
              position="relative"
            >
              <Box
                w="80px"
                h="80px"
                borderRadius="full"
                overflow="hidden"
                border="2px solid"
                borderColor="purple.500"
              >
                <Image
                  src={userStories.stories[0].mediaUrl}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                />
              </Box>
              <Text fontSize="xs" mt={1}>
                {userStories.username}
              </Text>
            </Box>
          ))}
        </HStack>
      </Box>

      {/* Posts Section */}
      <VStack spacing={6} p={4}>
        {postsLoading ? (
          <Center py={10}>
            <Spinner color="purple.400" />
          </Center>
        ) : posts.length === 0 ? (
          <Center py={10}>
            <VStack>
              <Text fontSize="lg" color="gray.400">No posts yet</Text>
              <Text fontSize="md" color="gray.500">Share your moments!</Text>
            </VStack>
          </Center>
        ) : (
          posts.map((post) => (
            <Box key={post.id} w="100%" bg="white" borderRadius="lg" shadow="md" overflow="hidden">
              <Flex p={4} align="center" justify="space-between">
                <Flex align="center">
                  <Avatar size="md" src={post.userProfilePic} />
                  <Text ml={3} fontWeight="bold">{post.username}</Text>
                </Flex>
                {post.userId === auth.currentUser?.uid && (
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      icon={<FaEllipsisH />}
                      variant="ghost"
                      aria-label="Post options"
                    />
                    <MenuList>
                      <MenuItem onClick={() => handleEditPost(post)}>Edit</MenuItem>
                      <MenuItem onClick={() => handleDeletePost(post.id)}>Delete</MenuItem>
                      <MenuItem onClick={() => handleArchivePost(post.id)}>Archive</MenuItem>
                    </MenuList>
                  </Menu>
                )}
              </Flex>

              {post.mediaUrl && (
                post.type === 'video' ? (
                  <video
                    src={post.mediaUrl}
                    controls
                    style={{
                      width: '100%',
                      maxHeight: '400px',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Image src={post.mediaUrl} alt="Post media" objectFit="cover" w="100%" maxH="400px" />
                )
              )}

              <Box p={4}>
                <Text mb={2}>{post.content}</Text>
                <Text fontSize="xs" color="gray.500">{getTimeAgo(post.timestamp)}</Text>
              </Box>
              
              <Flex p={4} justify="space-between">
                <HStack spacing={4}>
                  <IconButton
                    icon={<FaHeart />}
                    variant="ghost"
                    aria-label="Like"
                    onClick={() => handleLikePost(post.id, post.likes)}
                    color={post.likes && post.likes.includes(auth.currentUser?.uid) ? "purple.500" : "gray.500"}
                  />
                  {post.userId === auth.currentUser?.uid ? (
                    <Text fontSize="sm" color="gray.500">{post.likes ? post.likes.length : 0} likes</Text>
                  ) : (
                    post.likes && post.likes.includes(auth.currentUser?.uid) && (
                      <Text fontSize="sm" color="gray.500">Liked</Text>
                    )
                  )}
                  <HStack spacing={1}>
                    <IconButton
                      icon={<FaComment />}
                      variant="ghost"
                      aria-label="Comment"
                      onClick={() => handleCommentClick(post)}
                    />
                  </HStack>
                  <IconButton
                    icon={<FaShare />}
                    variant="ghost"
                    aria-label="Share"
                  />
                </HStack>
                <IconButton
                  icon={<FaBookmark />}
                  variant="ghost"
                  aria-label="Save"
                />
              </Flex>
            </Box>
          ))
        )}
      </VStack>

      {/* Story Viewer */}
      <StoryViewer
        isOpen={isStoryOpen}
        onClose={onStoryClose}
        story={selectedStory}
        onStoryDelete={fetchStories}
      />

      {/* Create Post Modal */}
      <Modal isOpen={isPostModalOpen} onClose={onPostModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Post</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Input
                placeholder="What's on your mind?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
              />
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <Text fontSize="sm" color="gray.500">Selected: {selectedFile.name}</Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="purple" onClick={handlePostSubmit}>
              Post
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Post Modal */}
      <Modal isOpen={isEditPostModalOpen} onClose={() => {
        setIsEditPostModalOpen(false);
        setPostToEdit(null);
        setEditPostCaption('');
      }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Post</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Enter new caption"
              value={editPostCaption}
              onChange={(e) => setEditPostCaption(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="purple" mr={3} onClick={handleSaveEditedPost}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => {
              setIsEditPostModalOpen(false);
              setPostToEdit(null);
              setEditPostCaption('');
            }}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Comment Modal */}
      <Modal isOpen={isCommentModalOpen} onClose={() => {
        setIsCommentModalOpen(false);
        setPostForComments(null);
        setNewCommentText('');
        setIsReplying(false);
        setReplyingToUsername('');
      }} size="full" motionPreset="slideInBottom">
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
            touchAction: 'none' // Prevents default touch actions
          }}
        >
          <ModalHeader pb={2}>
            <Flex align="center" justify="space-between">
              <IconButton icon={<FaArrowLeft />} variant="ghost" onClick={() => {
                setIsCommentModalOpen(false);
                setPostForComments(null);
                setNewCommentText('');
                setIsReplying(false);
                setReplyingToUsername('');
              }} aria-label="Go back" />
              <Text fontSize="lg" fontWeight="bold">Reply</Text>
              <IconButton icon={<FaEllipsisH />} variant="ghost" aria-label="More options" />
            </Flex>
          </ModalHeader>
          <ModalCloseButton display="none" /> {/* Hide default close button */}

          <ModalBody px={0} pt={0} display="flex" flexDirection="column">
            {/* Quick Reply Buttons (Placeholder) */}
            
            {/* Emojis (Placeholder) */}
            <HStack spacing={2} px={4} py={3} borderBottom="1px" borderColor="gray.200">
              <Text fontSize="2xl">❤️</Text>
              <Text fontSize="2xl">🙌</Text>
              <Text fontSize="2xl">🔥</Text>
              <Text fontSize="2xl">👍</Text>
              <Text fontSize="2xl">😂</Text>
              <Text fontSize="2xl">🤯</Text>
              <Text fontSize="2xl">😍</Text>
              <Text fontSize="2xl">🥳</Text>
            </HStack>

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
                <IconButton icon={<FaArrowUp />} colorScheme="purple" borderRadius="full" onClick={handleAddComment} aria-label="Send comment" />
              </HStack>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Feed; 