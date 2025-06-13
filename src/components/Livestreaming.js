import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Flex,
  IconButton,
  VStack,
  Textarea,
  Button,
  Avatar,
  Text,
  Input,
  InputGroup,
  InputRightElement,
  useToast,
  Divider,
} from '@chakra-ui/react';
import { FaTimes, FaPaperPlane, FaHeart } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase'; // Assuming firebase is set up for auth and db
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion'; // Import AnimatePresence

const Livestreaming = ({ stream, onEndLive }) => {
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [userName, setUserName] = useState('Anonymous'); // Default name for comments
  const [liveSessionStartTime, setLiveSessionStartTime] = useState(null); // State for session start time
  const [floatingHearts, setFloatingHearts] = useState([]); // State for floating hearts

  useEffect(() => {
    // console.log('Livestreaming: stream prop received:', stream); // TEMPORARY LOG - REMOVED
    let unsubscribeComments; // Declare variable for unsubscribe function
    let unsubscribeInteractions; // Declare variable for interactions unsubscribe function

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure the video element starts playing
      videoRef.current.play().catch(error => {
        console.error('Error playing video:', error);
      });

      // Set session start time only if not already set for this active stream
      if (!liveSessionStartTime) {
        setLiveSessionStartTime(new Date());
        setComments([]); // Clear comments when a truly new session starts
      }

      // Listen for comments ONLY when stream is active AND liveSessionStartTime is set
      if (liveSessionStartTime) {
        const commentsRef = collection(db, 'livestreamComments'); // This collection needs to exist
        const q = query(
          commentsRef,
          where('createdAt', '>=', liveSessionStartTime), // Filter by current session's start time
          orderBy('createdAt', 'asc')
        );

        const MAX_DISPLAYED_COMMENTS = 10; // Adjust as needed

        unsubscribeComments = onSnapshot(q, (snapshot) => {
          const newComments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate().toLocaleTimeString(), // Format timestamp
          }));
          // Keep only the latest comments
          setComments(newComments.slice(-MAX_DISPLAYED_COMMENTS));
        }, (error) => {
          console.error("Error fetching comments:", error);
          toast({
            title: "Error loading comments",
            description: error.message,
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        });

        // Listen for heart interactions ONLY when stream is active and liveSessionStartTime is set
        const interactionsRef = collection(db, 'livestreamInteractions');
        const qInteractions = query(
          interactionsRef,
          where('type', '==', 'heart'),
          where('createdAt', '>=', liveSessionStartTime),
          orderBy('createdAt', 'asc')
        );

        unsubscribeInteractions = onSnapshot(qInteractions, (snapshot) => {
          snapshot.docChanges().forEach(change => {
            if (change.type === "added") {
              // Trigger animation for newly added hearts on all clients
              triggerHeartAnimation();
            }
          });
        }, (error) => {
          console.error("Error fetching interactions:", error);
        });
      }
    } else if (!stream) {
      // If no stream is passed, navigate back (e.g., if page refreshed)
      toast({
        title: 'Live stream unavailable',
        description: 'No active camera stream found. Returning to camera.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      navigate('/camera');
    }

    // Fetch current user's username for comments
    const fetchUserName = async () => {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserName(userDocSnap.data().username || 'Anonymous');
        }
      }
    };
    fetchUserName();

    return () => {
      // Removed: stream.getTracks().forEach(track => track.stop());
      // Stream stopping is handled by onEndLive in CameraViewer.js
      // console.log('Live stream tracks stopped on unmount.'); // TEMPORARY LOG - REMOVED
      if (unsubscribeComments) {
        unsubscribeComments(); // Clean up comments listener
      }
      if (unsubscribeInteractions) {
        unsubscribeInteractions(); // Clean up interactions listener
      }
    };
  }, [stream, navigate, toast, liveSessionStartTime]); // Add liveSessionStartTime to dependencies

  const handleEndLive = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onEndLive(); // Call the prop function to reset state in CameraViewer
    setComments([]); // Clear comments when live stream ends
    setLiveSessionStartTime(null); // Clear session start time on end
    setFloatingHearts([]); // Clear any lingering hearts on end
    navigate('/camera');
  };

  const handleCommentSubmit = async () => {
    if (comment.trim() === '') return;
    try {
      await addDoc(collection(db, 'livestreamComments'), {
        userId: auth.currentUser?.uid || 'anonymous',
        username: userName,
        text: comment,
        createdAt: new Date(), // Important: ensure comments have a 'createdAt' timestamp
      });
      setComment('');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error sending comment",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleHeartClick = async () => {
    try {
      await addDoc(collection(db, 'livestreamInteractions'), {
        type: 'heart',
        userId: auth.currentUser?.uid || 'anonymous',
        createdAt: new Date(),
      });
      // Animation will be triggered by the Firestore listener on all clients
    } catch (error) {
      console.error("Error sending heart:", error);
      toast({
        title: "Error sending heart",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const triggerHeartAnimation = () => {
    const newHeart = { id: Date.now() + Math.random() }; // Unique ID for each heart
    setFloatingHearts(prev => [...prev, newHeart]);

    // Remove heart after animation
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(heart => heart.id !== newHeart.id));
    }, 3500); // Duration matches animation transition
  };

  return (
    <Box position="relative" w="100vw" h="100vh" bg="black" color="white">
      {/* Live Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted // Mute local preview
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0,
        }}
      />

      {/* Top Bar for Live Indicator and End Button */}
      <Flex position="absolute" top={4} left={0} right={0} zIndex={2} justify="space-between" align="center" px={6}>
        <Box bg="red.500" color="white" px={3} py={1} borderRadius="full">
          <Text fontSize="sm" fontWeight="bold">LIVE</Text>
        </Box>
        <IconButton
          aria-label="End Live Stream"
          icon={<FaTimes />}
          colorScheme="whiteAlpha"
          bg="rgba(0,0,0,0.5)"
          borderRadius="full"
          size="lg"
          onClick={handleEndLive}
        />
      </Flex>

      {/* Floating Hearts Container - positioned over video */}
      <Box
        position="absolute"
        bottom="80px" // Adjust to originate above the input field
        right="20px" // Position the container itself directly above the button
        zIndex={3} // Higher z-index to be above other content
        pointerEvents="none" // Important: allow clicks to pass through
        overflow="visible" // ALLOW hearts to float outside this container's initial bounds
        width="40px" // Width of the heart button
        height="calc(100% - 80px)" // Height to allow full float up
      >
        <AnimatePresence>
          {floatingHearts.map(heart => (
            <motion.div
              key={heart.id}
              initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -(Math.random() * 400 + 100), x: (Math.random() - 0.5) * 100, scale: 1 }} // Increased x movement range
              exit={{ opacity: 0, y: -500, scale: 1.2 }}
              transition={{ duration: 3 + Math.random() * 1.5, ease: "easeOut" }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%', // Center the heart relative to its parent container
                transform: 'translateX(-50%)', // Adjust for true centering
                fontSize: '2rem',
                color: 'red',
              }}
            >
              ❤️
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>

      {/* Comment Section */}
      <Flex
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        zIndex={1}
        p={4}
        flexDirection="column"
        maxH="40%"
      >
        <VStack
          flex="1"
          spacing={2}
          align="stretch"
          w="100%"
          overflowY="auto"
          pb={2}
        >
          <AnimatePresence initial={false}> {/* Use AnimatePresence for exit animations */}
            {comments.map((msg) => (
              <motion.div // Wrap with motion.div for animation
                key={msg.id}
                initial={{ opacity: 0, y: 50 }} // Start further below and transparent
                animate={{ opacity: 1, y: 0 }} // Animate to original position and full opacity
                exit={{ opacity: 0, y: -50 }} // Animate upwards and fade out on exit
                transition={{ duration: 0.5, ease: "easeOut" }} // Longer and smoother transition
                style={{ width: "100%" }} // Ensure it takes full width for Flex alignment
              >
                <Flex align="flex-start"> {/* Removed redundant key={msg.id} */}
                  <Avatar size="xs" name={msg.username} mr={2} />
                  <Box borderRadius="lg" p={0.5} maxW="80%" > {/* Removed bg="gray.700", reduced padding */}
                    <Text fontSize="sm" fontWeight="bold" color="orange.300">{msg.username}</Text>
                    <Text fontSize="sm">{msg.text}</Text>
                    <Text fontSize="xs" color="gray.400" mt={0} textAlign="right">{msg.createdAt}</Text> {/* Removed mt={1} */}
                  </Box>
                </Flex>
              </motion.div>
            ))}
          </AnimatePresence>
        </VStack>
        <Divider borderColor="gray.600" mt={2} mb={2} />
        <Flex align="center" justify="space-between" w="100%"> {/* New Flex for Input + Heart Button */}
          <InputGroup flex="1" mr={2}> {/* InputGroup takes most space */}
            <Input
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              bg="gray.800"
              color="white"
              borderRadius="full"
              pr="4.5rem" // Space for button
              _placeholder={{ color: 'gray.400' }}
            />
            <InputRightElement width="4.5rem">
              <Button h="1.75rem" size="sm" onClick={handleCommentSubmit} colorScheme="orange" borderRadius="full">
                <FaPaperPlane />
              </Button>
            </InputRightElement>
          </InputGroup>
          <IconButton
            aria-label="Like Live Stream"
            icon={<FaHeart />}
            h="2.5rem" // Slightly larger for better tap target
            w="2.5rem"
            size="md"
            onClick={handleHeartClick}
            colorScheme="red"
            borderRadius="full"
            mb={2} // Align with input bottom a bit
          />
        </Flex>
      </Flex>
    </Box>
  );
};

export default Livestreaming; 