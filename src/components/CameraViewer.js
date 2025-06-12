import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Flex,
  useToast,
  Button,
  VStack,
  HStack,
  Text,
  Switch,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Center,
  Avatar,
} from '@chakra-ui/react';
import { FaCamera, FaVideo, FaExchangeAlt, FaSave, FaRegPaperPlane, FaRegBookmark, FaTimes, FaDownload, FaUserCircle, FaBolt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const CameraViewer = () => {
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const recordingTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const recordedChunksRef = useRef([]);
  const [preview, setPreview] = useState(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [profilePic, setProfilePic] = useState(null);

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isFrontCamera]);

  useEffect(() => {
    const fetchProfilePic = async () => {
      if (!auth.currentUser) return;
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setProfilePic(userDoc.data().profilePicture || null);
      }
    };
    fetchProfilePic();
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true // Enable audio capture
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please check permissions.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const toggleCamera = () => {
    setIsFrontCamera(!isFrontCamera);
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      if (video.readyState < 2) {
        toast({
          title: 'Camera not ready',
          description: 'Please wait for the camera to load before taking a photo.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Apply mirror effect for front camera
      if (isFrontCamera) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) {
        toast({
          title: 'Error',
          description: 'Failed to capture photo.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreview({ type: 'photo', url });
      onOpen();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to capture photo.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleLiveStream = () => {
    setIsLive(!isLive);
    // Implement live streaming functionality
    toast({
      title: isLive ? 'Live Stream Ended' : 'Live Stream Started',
      description: isLive ? 'Your live stream has ended.' : 'You are now live!',
      status: isLive ? 'info' : 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Video recording handlers with 1 minute limit
  const startRecording = () => {
    if (!streamRef.current) {
      toast({
        title: 'Camera not ready',
        description: 'Please wait for the camera to load before recording.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    try {
      recordedChunksRef.current = [];
      const recorder = new window.MediaRecorder(streamRef.current, { 
        mimeType: 'video/webm',
        videoBitsPerSecond: 2500000 // 2.5 Mbps for better quality
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) {
          toast({
            title: 'Recording Error',
            description: 'No video data was recorded.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }
        
        const blob = new Blob(recordedChunksRef.current, { 
          type: 'video/webm;codecs=vp8,opus' 
        });
        const url = URL.createObjectURL(blob);
        setPreview({ type: 'video', url });
        recordedChunksRef.current = []; // Clear after creating blob
        onOpen();
      };
      
      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Set timeout to stop after 1 minute
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 60000);
    } catch (error) {
      toast({
        title: 'Recording Error',
        description: 'Could not start video recording.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleSavePreview = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = preview.type === 'photo' ? `photo_${new Date().getTime()}.jpg` : `video_${new Date().getTime()}.webm`;
    a.click();
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    onClose();
    toast({
      title: preview.type === 'photo' ? 'Photo Saved' : 'Video Saved',
      description: `Your ${preview.type} has been saved.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handlePostStory = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    onClose();
    toast({
      title: 'Posted to Stories!',
      description: 'Your media has been posted to your story.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleSendTo = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    onClose();
    toast({
      title: 'Send To',
      description: 'Send To feature coming soon!',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Helper to close preview and restart camera
  const closePreviewAndResumeCamera = () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    }
    onClose();
    startCamera();
  };

  // Toggle flash (UI only)
  const toggleFlash = () => setIsFlashOn((prev) => !prev);

  return (
    <Box position="relative" w="100vw" h="100vh" bg="black">
      {/* Top Bar: Profile (left) and Flash (right) */}
      {!preview && (
        <Flex position="absolute" top={4} left={0} right={0} zIndex={3} justify="space-between" align="center" px={6}>
          {/* Profile Icon */}
          <IconButton
            aria-label="Profile"
            icon={
              <Avatar size="sm" name="Profile" src={profilePic || undefined} />
            }
            colorScheme="white"
            variant="ghost"
            size="lg"
            fontSize="2xl"
            borderRadius="full"
            onClick={() => navigate('/profile')}
          />
          {/* Flash Icon */}
          <IconButton
            aria-label="Toggle flash"
            icon={<FaBolt size={28} color={isFlashOn ? '#FFD600' : '#FFF'} />}
            colorScheme={isFlashOn ? 'yellow' : 'white'}
            variant="ghost"
            size="lg"
            fontSize="2xl"
            borderRadius="full"
            onClick={toggleFlash}
          />
        </Flex>
      )}

      {/* Main Content: Show preview or camera */}
      {preview ? (
        <>
          {/* X Button (top right) */}
          <IconButton
            aria-label="Close preview"
            icon={<FaTimes />}
            position="absolute"
            top={4}
            right={4}
            zIndex={3}
            size="lg"
            colorScheme="whiteAlpha"
            bg="rgba(0,0,0,0.5)"
            borderRadius="full"
            onClick={closePreviewAndResumeCamera}
          />

          {/* Fullscreen Preview */}
          {preview.type === 'photo' ? (
            <img
              src={preview.url}
              alt="Preview"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                objectFit: 'cover',
                zIndex: 1,
              }}
            />
          ) : (
            <video
              src={preview.url}
              autoPlay
              loop
              playsInline
              controls
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                objectFit: 'cover',
                zIndex: 1,
                transform: isFrontCamera ? 'none' : 'scaleX(-1)',
              }}
            />
          )}

          {/* Preview Action Bar (bottom) */}
          <Flex
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            p={6}
            justify="center"
            align="center"
            bg="rgba(0, 0, 0, 0.2)"
            zIndex={2}
          >
            <HStack spacing={16} w="100%" justify="center" align="center">
              {/* Save */}
              <Center flexDirection="column">
                <IconButton
                  aria-label="Save"
                  icon={<FaDownload size={28} color="#FF6600" />}
                  colorScheme="white"
                  variant="ghost"
                  size="lg"
                  fontSize="2xl"
                  borderRadius="full"
                  onClick={handleSavePreview}
                />
                <Text fontSize="sm" color="white" mt={1}>Save</Text>
              </Center>
              {/* Post on Stories */}
              <Button
                colorScheme="blue"
                size="lg"
                fontWeight="bold"
                borderRadius="full"
                px={6}
                onClick={handlePostStory}
              >
                Stories
              </Button>
              {/* Send To */}
              <Button
                colorScheme="orange"
                size="lg"
                fontWeight="bold"
                borderRadius="full"
                px={6}
                onClick={handleSendTo}
              >
                Send To
              </Button>
            </HStack>
          </Flex>
        </>
      ) : (
        <>
          {/* Camera View */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isFrontCamera ? 'scaleX(-1)' : 'none',
            }}
          />

          {/* Camera Controls */}
          <Flex
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            p={6}
            justify="center"
            align="center"
          >
            <HStack spacing={8} w="100%" justify="center" align="center">
              {/* Go Live Button */}
              <Button
                aria-label="Go live"
                onClick={handleLiveStream}
                colorScheme={isLive ? "red" : "gray"}
                variant={isLive ? "solid" : "outline"}
                borderRadius="full"
                size="lg"
                fontWeight="bold"
                px={6}
                leftIcon={<FaVideo />}
              >
                {isLive ? 'Live' : 'Go Live'}
              </Button>

              {/* Combined Capture/Record Button (no icon) */}
              <Button
                aria-label={isRecording ? "Recording video" : "Take photo or record video"}
                onClick={handleCapture}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={isRecording ? stopRecording : undefined}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                bg="white"
                borderRadius="full"
                w="72px"
                h="72px"
                minW="72px"
                minH="72px"
                p={0}
                borderWidth={isRecording ? "6px" : "6px"}
                borderColor={isRecording ? "red.500" : "gray.300"}
                boxShadow={isRecording ? "0 0 0 4px rgba(255,0,0,0.2)" : "0 0 0 4px rgba(0,0,0,0.2)"}
                _hover={{ bg: 'gray.100' }}
                _active={{ bg: 'gray.200' }}
                display="flex"
                alignItems="center"
                justifyContent="center"
              />

              {/* Camera Switch */}
              <IconButton
                aria-label="Switch camera"
                icon={<FaExchangeAlt />}
                colorScheme="white"
                variant="ghost"
                size="lg"
                fontSize="2xl"
                borderRadius="full"
                onClick={toggleCamera}
              />
            </HStack>
          </Flex>

          {/* Live Indicator */}
          {isLive && (
            <Box
              position="absolute"
              top={4}
              left={4}
              bg="red.500"
              color="white"
              px={3}
              py={1}
              borderRadius="full"
            >
              <Text fontSize="sm" fontWeight="bold">LIVE</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default CameraViewer;
