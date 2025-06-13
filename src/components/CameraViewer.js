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
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import Livestreaming from './Livestreaming';

const CameraViewer = () => {
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
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
  const [previewRotation, setPreviewRotation] = useState(0);
  const [liveCameraRotation, setLiveCameraRotation] = useState(0);
  const longPressTimerRef = useRef(null);
  const LONG_PRESS_THRESHOLD = 300;
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    startCamera(); // Always start camera when component mounts or isFrontCamera changes
    return () => {
      stopCamera(); // Stop camera only when component unmounts
    };
  }, [isFrontCamera]); // Only depend on isFrontCamera for camera toggling

  useEffect(() => {
    const getRotationAngle = () => {
      const angle = window.screen.orientation?.angle || window.orientation || 0;
      if (angle === 90) return 90;
      if (angle === 270) return -90;
      return 0;
    };

    const handleOrientationChange = () => {
      setLiveCameraRotation(getRotationAngle());
    };

    handleOrientationChange();
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

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
      console.log('Attempting to start camera...');
      const constraints = {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        console.log('Camera stream set.');
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
      console.log('Camera stream stopped.');
    }
  };

  const toggleCamera = () => {
    setIsFrontCamera(!isFrontCamera);
    console.log('Toggling camera to:', !isFrontCamera ? 'front' : 'back');
  };

  const handleCapture = async () => {
    console.log('handleCapture called (intending to take photo)');
    if (!videoRef.current) {
      console.log('videoRef not current.');
      return;
    }

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
        console.log('Camera video not ready (readyState: ', video.readyState, ').');
        return;
      }

      const canvas = document.createElement('canvas');
      let width = video.videoWidth;
      let height = video.videoHeight;
      const orientation = window.screen.orientation?.angle || window.orientation || 0;
      setPreviewRotation(orientation);

      if (orientation === 90 || orientation === 270) {
        [width, height] = [height, width];
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      console.log(`Canvas created: ${width}x${height}, orientation: ${orientation}deg.`);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((orientation * Math.PI) / 180);

      if (isFrontCamera) {
        ctx.scale(-1, 1);
      }

      if (orientation === 90 || orientation === 270) {
        ctx.drawImage(video, -height / 2, -width / 2, height, width);
      } else {
        ctx.drawImage(video, -width / 2, -height / 2, width, height);
      }
      ctx.restore();
      console.log('Video frame drawn to canvas.');

      const blob = await new Promise((resolve) => {
        canvas.toBlob(
          (capturedBlob) => {
            if (!capturedBlob) {
              console.error('canvas.toBlob returned null blob.');
        toast({
          title: 'Error',
                description: 'Failed to create image blob.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
              resolve(null);
            } else {
              console.log('Photo blob created: type=', capturedBlob.type, 'size=', capturedBlob.size);
              resolve(capturedBlob);
            }
          },
          'image/jpeg',
          0.95
        );
      });

      if (!blob) {
        console.log('Blob was null, stopping capture process.');
        return;
      }

      const url = URL.createObjectURL(blob);
      setPreview({ type: 'photo', url, blob });
      console.log('Preview set to photo type with URL:', url);
      onOpen();
    } catch (error) {
      console.error('Photo capture error:', error);
      toast({
        title: 'Error',
        description: `Failed to capture photo: ${error.message}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleLiveStream = () => {
    if (streamRef.current) {
      const activeStream = streamRef.current;
      setIsLiveMode(true);
      toast({
        title: 'Live Stream Started',
        description: 'You are now live!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      console.log('Switched to live mode with active stream.');
    } else {
      toast({
        title: 'Camera not ready',
        description: 'Cannot go live without an active camera stream.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      console.log('Cannot go live: no active stream.');
    }
  };

  const handleEndLiveStream = () => {
    console.log('handleEndLiveStream called. Ending live mode.');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLiveMode(false);
    startCamera();
    toast({
      title: 'Live Stream Ended',
      description: 'Your live stream has ended.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const _startRecording = () => {
    console.log('_startRecording called (actual video recording)');
    if (!streamRef.current) {
      toast({
        title: 'Camera not ready',
        description: 'Please wait for the camera to load before recording.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      console.log('Stream not ready for recording.');
      return;
    }
    try {
      recordedChunksRef.current = [];
      const recorder = new window.MediaRecorder(streamRef.current, { 
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('Recorded chunk data available, size:', event.data.size, 'mimeType:', event.data.type);
        }
      };
      
      recorder.onstop = () => {
        console.log('MediaRecorder stopped.');
        if (recordedChunksRef.current.length === 0) {
          toast({
            title: 'Recording Error',
            description: 'No video data was recorded.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          console.log('No video data was recorded.');
          return;
        }
        
        const blob = new Blob(recordedChunksRef.current, { 
          type: 'video/webm;codecs=vp8,opus' 
        });
        const url = URL.createObjectURL(blob);
        setPreview({ type: 'video', url, blob });
        console.log('Preview set to video type, blob type:', blob.type, 'blob size:', blob.size);
        recordedChunksRef.current = [];
        onOpen();
      };
      
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
      console.log('Recording started.');
      
      recordingTimeoutRef.current = setTimeout(() => {
        _stopRecording();
        console.log('Recording stopped by timeout.');
      }, 60000);
    } catch (error) {
      console.error('Recording Error:', error);
      toast({
        title: 'Recording Error',
        description: 'Could not start video recording.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const _stopRecording = () => {
    console.log('_stopRecording called (actual video recording stop).');
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      console.log('MediaRecorder stopped programmatically.');
    } else {
      console.log('MediaRecorder was not active or already stopped.');
    }
  };

  const handlePressStart = () => {
    console.log('handlePressStart called.');
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      console.log('Long press detected. Starting recording.');
      _startRecording();
      longPressTimerRef.current = null;
    }, LONG_PRESS_THRESHOLD);
  };

  const handlePressEnd = () => {
    console.log('handlePressEnd called.');
    if (longPressTimerRef.current) {
      console.log('Short tap detected. Taking photo.');
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (!isRecording) {
      handleCapture();
      } else {
        console.log('Was recording, so not taking photo on tap end.');
      }
    } else if (isRecording) {
      console.log('Long press release detected. Stopping recording.');
      _stopRecording();
    }
  };

  const handlePressLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      console.log('Press leave detected before long press. No action.');
    } else if (isRecording) {
      console.log('Press leave detected during recording. Stopping recording.');
      _stopRecording();
    }
  };

  const handleSavePreview = async () => {
    console.log('handleSavePreview called.');
    if (!preview || !preview.blob) {
      console.log('No preview or blob to save.');
      return;
    }
    try {
    const a = document.createElement('a');
      a.href = URL.createObjectURL(preview.blob);
      
      if (preview.type === 'photo') {
        a.download = `photo_${new Date().getTime()}.jpg`;
      } else {
        a.download = `video_${new Date().getTime()}.webm`;
      }
    a.click();
      URL.revokeObjectURL(a.href);
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
      console.log(`${preview.type} saved successfully.`);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save media.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handlePostStory = async () => {
    console.log('handlePostStory called.');
    if (!preview || !auth.currentUser) {
      toast({
        title: 'Error',
        description: 'No media to post or user not logged in.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const blob = await fetch(preview.url).then((res) => res.blob());
      const storageRef = ref(storage, `stories/${auth.currentUser.uid}/${Date.now()}`);
      await uploadBytes(storageRef, blob);
      const mediaUrl = await getDownloadURL(storageRef);

      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      await addDoc(collection(db, 'stories'), {
        userId: auth.currentUser.uid,
        username: userData.username || 'Anonymous',
        userProfilePic: userData.profilePicture || null,
        mediaUrl: mediaUrl,
        timestamp: serverTimestamp(),
        type: preview.type, // 'photo' or 'video'
      });

      toast({
        title: 'Posted to Stories!',
        description: 'Your media has been posted to your story.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      if (preview) URL.revokeObjectURL(preview.url);
      setPreview(null);
      onClose();
      navigate('/feed'); // Navigate to feed after posting
    } catch (error) {
      console.error('Error posting story:', error);
      toast({
        title: 'Error',
        description: 'Failed to post story.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSendTo = () => {
    console.log('handleSendTo called.');
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

  const closePreviewAndResumeCamera = () => {
    console.log('closePreviewAndResumeCamera called.');
    if (preview) {
      URL.revokeObjectURL(preview.url);
      setPreview(null);
    }
    setPreviewRotation(0);
    onClose();
    startCamera();
  };

  const toggleFlash = () => {
    setIsFlashOn((prev) => !prev);
    console.log('Flash toggled to:', !isFlashOn);
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
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      navigate('/feed');
    } else if (isRightSwipe) {
      navigate('/inbox');
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <Box
      w="100%"
      h="100vh"
      position="relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {isLiveMode ? (
        <Livestreaming stream={streamRef.current} onEndLive={handleEndLiveStream} />
      ) : (
        <>
      {!preview && (
        <Flex position="absolute" top={4} left={0} right={0} zIndex={3} justify="space-between" align="center" px={6}>
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

      {preview ? (
        <>
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
          <Box
            position="absolute"
            top="50%"
            left="50%"
                width={previewRotation % 180 !== 0 ? '100vh' : '100vw'}
                height={previewRotation % 180 !== 0 ? '100vw' : '100vh'}
                zIndex={1}
                transform={`translate(-50%, -50%) rotate(${previewRotation}deg)`}
            transformOrigin="center center"
                overflow="hidden"
          >
            {preview.type === 'photo' ? (
              <img
                src={preview.url}
                alt="Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
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
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </Box>
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
            <HStack spacing={12} w="100%" justify="center" align="center">
              {preview.type === 'video' && (
                <Center flexDirection="column">
                  <IconButton
                    aria-label="Rotate"
                    icon={<FaExchangeAlt size={28} color="#FF6600" />}
                    colorScheme="white"
                    variant="ghost"
                    size="lg"
                    fontSize="2xl"
                    borderRadius="full"
                        onClick={() => setPreviewRotation((r) => (r + 90) % 360)}
                  />
                  <Text fontSize="sm" color="white" mt={1}>Rotate</Text>
                </Center>
              )}
              <Center flexDirection="column">
                <IconButton
                  aria-label="Save"
                      icon={<FaDownload size={28} color="purple.400" />}
                  colorScheme="white"
                  variant="ghost"
                  size="lg"
                  fontSize="2xl"
                  borderRadius="full"
                  onClick={handleSavePreview}
                />
                <Text fontSize="sm" color="white" mt={1}>Save</Text>
              </Center>
              <Button
                colorScheme="purple"
                size="lg"
                fontWeight="bold"
                borderRadius="full"
                px={6}
                onClick={handlePostStory}
              >
                Stories
              </Button>
              <Button
                colorScheme="purple"
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
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `
                ${isFrontCamera ? 'scaleX(-1)' : ''}
                rotate(${liveCameraRotation}deg)
              `.trim(),
              transformOrigin: 'center center',
            }}
          />

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
              <Button
                aria-label="Go live"
                onClick={handleLiveStream}
                    colorScheme="red"
                    variant="solid"
                borderRadius="full"
                size="lg"
                fontWeight="bold"
                px={6}
                leftIcon={<FaVideo />}
              >
                    Go Live
              </Button>

              <Button
                aria-label={isRecording ? "Recording video" : "Take photo or record video"}
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressLeave}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
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

              <IconButton
                    aria-label="Toggle camera"
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
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default CameraViewer;
