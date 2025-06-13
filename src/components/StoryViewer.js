import React, { useState, useEffect } from 'react';
import {
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Image,
  Flex,
  Text,
  IconButton,
  Progress,
  Avatar,
  useToast,
  useDisclosure,
  ModalHeader,
  ModalCloseButton,
  VStack,
  HStack,
  Input,
  Divider,
  Button,
  Spacer,
} from '@chakra-ui/react';
import { FaTimes, FaTrash, FaEye, FaEllipsisV, FaDownload, FaUpload, FaPaperPlane } from 'react-icons/fa';
import { doc, getDoc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';

const StoryViewer = ({ isOpen, onClose, story, onStoryDelete }) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [username, setUsername] = useState('');
  const [userProfilePic, setUserProfilePic] = useState('');
  const [mediaOrientation, setMediaOrientation] = useState('portrait');
  const [stories, setStories] = useState([]);
  const toast = useToast();
  const { isOpen: isViewersOpen, onOpen: onViewersOpen, onClose: onViewersClose } = useDisclosure();
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;
  const [viewersList, setViewersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (story && story.userId) {
      fetchUserInfo(story.userId);
      setCurrentStoryIndex(0);
      setProgress(0);
      setStories(story.stories || []);
    }
  }, [story]);

  useEffect(() => {
    if (!isOpen || !stories || stories.length === 0) return;
    if (isViewersOpen) return; // Pause if viewers modal is open

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentStoryIndex < stories.length - 1) {
            setCurrentStoryIndex((prev) => prev + 1);
            return 0;
          } else {
            onClose();
            return 0;
          }
        }
        return prev + 1; // Increment progress
      });
    }, 30);

    return () => clearInterval(timer);
  }, [isOpen, currentStoryIndex, stories, onClose, isViewersOpen]);

  useEffect(() => {
    const currentMedia = stories[currentStoryIndex];
    if (currentMedia) {
      const mediaUrl = currentMedia.mediaUrl;
      const isVideo = mediaUrl.match(/\.(mp4|mov|avi|wmv)$/i);
      
      if (isVideo) {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.onloadedmetadata = () => {
          setMediaOrientation(video.videoWidth > video.videoHeight ? 'landscape' : 'portrait');
        };
      } else {
        const tempImage = document.createElement('img');
        tempImage.onload = () => {
          setMediaOrientation(tempImage.naturalWidth > tempImage.naturalHeight ? 'landscape' : 'portrait');
        };
        tempImage.src = mediaUrl;
      }
      
      // Mark story as viewed
      if (auth.currentUser && currentMedia.id) {
        const storyRef = doc(db, 'stories', currentMedia.id);
        // Check if the current user has already viewed this story
        if (!currentMedia.viewedBy || !currentMedia.viewedBy.includes(auth.currentUser.uid)) {
          updateDoc(storyRef, {
            viewCount: (currentMedia.viewCount || 0) + 1,
            viewedBy: arrayUnion(auth.currentUser.uid)
          }).catch(error => console.error("Error updating view count:", error));
        }
      }
    }
  }, [currentStoryIndex, stories]);

  // Fetch viewers data when the modal opens
  useEffect(() => {
    const fetchViewers = async () => {
      const currentMediaInEffect = stories[currentStoryIndex];
      const currentUserId = auth.currentUser?.uid; // Get current user ID in the effect

      if (isViewersOpen && currentMediaInEffect && currentMediaInEffect.viewedBy && currentMediaInEffect.viewedBy.length > 0) {
        try {
          const fetchedViewers = [];
          for (const viewerId of currentMediaInEffect.viewedBy) {
            if (viewerId !== currentUserId) { // Exclude current user from viewers list
              const userDoc = await getDoc(doc(db, 'users', viewerId));
              if (userDoc.exists()) {
                fetchedViewers.push({
                  id: userDoc.id,
                  username: userDoc.data().username,
                  profilePicture: userDoc.data().profilePicture,
                });
              }
            }
          }
          setViewersList(fetchedViewers);
        } catch (error) {
          console.error("Error fetching viewers:", error);
          toast({
            title: "Error loading viewers",
            description: error.message,
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        }
      } else if (!isViewersOpen) {
        setViewersList([]); // Clear viewers list when modal closes
      }
    };

    fetchViewers();
  }, [isViewersOpen, stories, currentStoryIndex, toast]);

  const fetchUserInfo = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setUsername(userDoc.data().username);
        setUserProfilePic(userDoc.data().profilePicture);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const handleClick = (e) => {
    if (!story || !stories || stories.length === 0) return;

    const { clientX } = e;
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const clickPosition = clientX - left;
    
    if (clickPosition < width / 2) {
      if (currentStoryIndex > 0) {
        setCurrentStoryIndex((prev) => prev - 1);
        setProgress(0);
      }
    } else {
      if (currentStoryIndex < stories.length - 1) {
        setCurrentStoryIndex((prev) => prev + 1);
        setProgress(0);
      } else {
        onClose();
      }
    }
  };

  const handleDeleteStory = async () => {
    try {
      if (!story || !story.userId) return;

      const currentStory = stories[currentStoryIndex];
      if (!currentStory || !currentStory.id) return;

      // Delete the story from Firestore
      await deleteDoc(doc(db, 'stories', currentStory.id));

      // Remove the story from local state
      const updatedStories = stories.filter((_, index) => index !== currentStoryIndex);
      setStories(updatedStories);

      toast({
        title: "Story deleted",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      if (onStoryDelete) {
        onStoryDelete(currentStory);
      }

      // Handle navigation after deletion
      if (updatedStories.length === 0) {
        onClose();
        return;
      }

      const newIndex = Math.min(currentStoryIndex, updatedStories.length - 1);
      setCurrentStoryIndex(newIndex);
      setProgress(0);
    } catch (error) {
      toast({
        title: "Error deleting story",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Swipe handlers
  const onTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) { // Swiped up
      if (currentUserId === story.userId) { // Only allow if it's the current user's story
        onViewersOpen();
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Helper to calculate time ago for stories
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
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

  const filteredViewers = viewersList.filter(viewer =>
    viewer.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Early return if no stories
  if (!story || !stories || stories.length === 0) {
    onClose();
    return null;
  }

  const currentMedia = stories[currentStoryIndex];
  const currentUserId = auth.currentUser?.uid;
  
  // Additional check for currentMedia
  if (!currentMedia || !currentMedia.mediaUrl) {
    onClose();
    return null;
  }

  const isVideo = currentMedia.mediaUrl.match(/\.(mp4|mov|avi|wmv)$/i);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalOverlay />
      <ModalContent bg="black" h="100vh">
        <ModalBody 
          p={0} 
          position="relative" 
          onClick={handleClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Progress bars */}
          <Flex position="absolute" top={4} left={4} right={4} zIndex={1} gap={2}>
            {stories.map((_, index) => (
              <Progress
                key={index}
                value={index === currentStoryIndex ? progress : index < currentStoryIndex ? 100 : 0}
                size="xs"
                flex={1}
                colorScheme="whiteAlpha"
              />
            ))}
          </Flex>

          {/* User info and actions */}
          <Flex
            position="absolute"
            top={4}
            left={4}
            right={4}
            zIndex={1}
            align="center"
            justify="space-between"
          >
            <Flex align="center">
              <Avatar size="sm" src={userProfilePic} />
              <Text color="white" ml={2} fontWeight="bold">
                {username}
              </Text>
            </Flex>
            <Flex gap={2}>
              {currentUserId === story.userId && (
                <IconButton
                  icon={<FaTrash />}
                  variant="ghost"
                  color="white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteStory();
                  }}
                  aria-label="Delete story"
                />
              )}
              <IconButton
                icon={<FaTimes />}
                variant="ghost"
                color="white"
                onClick={onClose}
                aria-label="Close story"
              />
            </Flex>
          </Flex>

          {/* Story content container */}
          <Box 
            h="100%" 
            display="flex" 
            alignItems="center" 
            justifyContent="center"
          >
            {isVideo ? (
              <video
                src={currentMedia.mediaUrl}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Image
                src={currentMedia.mediaUrl}
                w="100%"
                h="100%"
                objectFit="cover"
              />
            )}
          </Box>

          {/* Viewer count at the bottom */}
          {currentUserId === story.userId && ( // Only show for current user's stories
            <Flex
              position="absolute"
              bottom={4}
              left={0}
              right={0}
              zIndex={1}
              justifyContent="center"
              alignItems="center"
              color="white"
              flexDirection="column"
            >
              <IconButton
                icon={<FaEye />}
                variant="ghost"
                color="white"
                onClick={onViewersOpen} // Open viewers modal on click
                aria-label="Viewers"
              />
              <Text fontSize="sm" mt={1}>
                {currentMedia.viewCount || 0} views
              </Text>
            </Flex>
          )}
        </ModalBody>
      </ModalContent>

      {/* Viewers Modal */}
      <Modal isOpen={isViewersOpen} onClose={onViewersClose} size="full" motionPreset="slideInBottom">
        <ModalOverlay />
        <ModalContent borderTopRadius="20px" bg="white" py={4} h="90vh" mt="auto">
          <ModalHeader pb={2}>
            <Flex align="center" justify="space-between">
              <IconButton icon={<FaTimes />} variant="ghost" onClick={onViewersClose} aria-label="Close" />
              <Text fontSize="lg" fontWeight="bold">My Story</Text>
              <IconButton icon={<FaEllipsisV />} variant="ghost" aria-label="More options" />
            </Flex>
          </ModalHeader>

          <ModalBody px={0} pt={0}>
            {/* Story Thumbnails Horizontal Scroll */}
            <HStack spacing={3} px={4} pb={4} overflowX="auto" borderBottom="1px" borderColor="gray.200">
              {story.stories.map((s, index) => (
                <VStack key={s.id} spacing={1} onClick={() => {
                  setCurrentStoryIndex(index);
                  setProgress(0);
                  onViewersClose(); // Close viewers modal when switching story
                }} cursor="pointer">
                  <Box
                    w="80px"
                    h="120px"
                    borderRadius="8px"
                    overflow="hidden"
                    border={index === currentStoryIndex ? "3px solid" : "1px solid"}
                    borderColor={index === currentStoryIndex ? "purple.500" : "gray.200"}
                    flexShrink={0}
                  >
                    <Image src={s.mediaUrl} objectFit="cover" w="100%" h="100%" />
                  </Box>
                  <Text fontSize="xs" color="gray.600">{getTimeAgo(s.timestamp)}</Text>
                  <Flex align="center" fontSize="xs" color="gray.500">
                    <FaEye size="12px" />
                    <Text ml={1}>{s.viewCount || 0}</Text>
                  </Flex>
                </VStack>
              ))}
            </HStack>

            {/* Search Input */}
            <Box px={4} py={3} borderBottom="1px" borderColor="gray.200">
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                borderRadius="full"
                bg="gray.100"
                _placeholder={{ color: 'gray.500' }}
              />
            </Box>

            {/* Viewers List */}
            <VStack spacing={4} align="stretch" px={4} py={3} overflowY="auto" flex={1}>
              {filteredViewers.length > 0 ? (
                filteredViewers.map(viewer => (
                  <Flex key={viewer.id} align="center">
                    <Avatar size="md" src={viewer.profilePicture} />
                    <Text ml={3} fontWeight="bold">{viewer.username}</Text>
                  </Flex>
                ))
              ) : (
                <Text color="gray.500" textAlign="center" py={10}>
                  {searchQuery ? "No matching viewers." : "No viewers yet."}
                </Text>
              )}
            </VStack>

            <Spacer /> {/* Push content to top */}

            {/* Bottom Action Bar */}
            <Flex
              position="sticky"
              bottom={0}
              left={0}
              right={0}
              bg="white"
              borderTop="1px" 
              borderColor="gray.200"
              p={4}
              justify="space-around"
              align="center"
              boxShadow="lg"
            >
              <VStack spacing={1}>
                <IconButton icon={<FaDownload />} variant="ghost" aria-label="Save Story" size="lg" />
                <Text fontSize="xs">Save</Text>
              </VStack>
              <VStack spacing={1}>
                <IconButton icon={<FaUpload />} variant="ghost" aria-label="Export Story" size="lg" />
                <Text fontSize="xs">Export</Text>
              </VStack>
              <VStack spacing={1} onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteStory();
                  onViewersClose(); // Close viewers modal after deletion
                }} cursor="pointer">
                <IconButton icon={<FaTrash />} variant="ghost" aria-label="Delete Story" size="lg" color="red.500" />
                <Text fontSize="xs" color="red.500">Delete</Text>
              </VStack>
              <Spacer />
              <IconButton icon={<FaPaperPlane />} colorScheme="purple" borderRadius="full" size="lg" p={3} aria-label="Send Story" />
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Modal>
  );
};

export default StoryViewer; 