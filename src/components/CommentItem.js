import React, { useState } from 'react';
import {
  Box,
  Flex,
  Avatar,
  Text,
  HStack,
  VStack,
  IconButton,
} from '@chakra-ui/react';
import { FaTimes } from 'react-icons/fa';
import { auth } from '../firebase';

const CommentItem = ({ comment, postForComments, handleDeleteComment, getTimeAgo, setIsReplying, setReplyingToUsername, setNewCommentText }) => {
  const [commentTouchStartX, setCommentTouchStartX] = useState(null);
  const [commentTouchEndX, setCommentTouchEndX] = useState(null);
  const [commentTranslateX, setCommentTranslateX] = useState(0); // New state for swipe translation
  const [isSwipingToDelete, setIsSwipingToDelete] = useState(false); // New state for visual feedback
  const minSwipeDistanceComment = 50; // Define a minimum swipe distance for comments
  const deleteThreshold = 100; // Distance to swipe to confirm delete

  const onCommentTouchStart = (e) => {
    setCommentTouchStartX(e.targetTouches[0].clientX);
    setCommentTranslateX(0); // Reset position on new touch start
    setIsSwipingToDelete(false); // Reset delete swiping state
    e.stopPropagation(); // Prevent event from bubbling up
  };

  const onCommentTouchMove = (e) => {
    setCommentTouchEndX(e.targetTouches[0].clientX);
    const currentTranslateX = e.targetTouches[0].clientX - commentTouchStartX;
    // Only allow swipe right and limit it
    if (currentTranslateX > 0) {
      setCommentTranslateX(Math.min(currentTranslateX, 120)); // Limit swipe distance for visual feedback
      // Set isSwipingToDelete true if swipe is significant enough
      if (currentTranslateX > 20) {
        setIsSwipingToDelete(true);
      } else {
        setIsSwipingToDelete(false);
      }
    }
    e.stopPropagation(); // Prevent event from bubbling up
  };

  const onCommentTouchEnd = (e) => {
    if (commentTouchStartX === null || commentTouchEndX === null) return;
    e.stopPropagation(); // Prevent event from bubbling up

    const distance = commentTouchEndX - commentTouchStartX;
    if (distance > deleteThreshold) { // Swiped right beyond threshold
      if (comment.userId === auth.currentUser?.uid) { // Only allow if it's the current user's comment
        handleDeleteComment(comment.id);
      }
    }
    setCommentTranslateX(0); // Snap back to original position after swipe ends
    setIsSwipingToDelete(false); // Reset delete swiping state
    setCommentTouchStartX(null);
    setCommentTouchEndX(null);
  };

  const isCommentByPostAuthor = postForComments && comment.userId === postForComments.userId;

  return (
    <Box
      p={2}
      position="relative" // Needed for absolute positioning of delete button
      overflow="hidden" // Hide overflowing delete button when not swiped
      _hover={{ bg: "gray.50" }} // Visual feedback on hover/touch
    >
      {/* Delete Button/Area */}
      {comment.userId === auth.currentUser?.uid && (
        <Flex
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          width="120px"
          bg="red.500"
          align="center"
          justify="center"
          color="white"
          fontWeight="bold"
          fontSize="sm"
          cursor="pointer"
          onClick={() => handleDeleteComment(comment.id)}
          zIndex={0}
          transform={`translateX(${120 - commentTranslateX}px)`}
          transition="transform 0.2s ease-out"
          borderRadius="md"
          opacity={commentTranslateX > 20 ? 1 : 0} // Fade in when swiping
        >
          <VStack spacing={1}>
            <Text>Delete</Text>
            <Text fontSize="xs">Swipe to delete</Text>
          </VStack>
        </Flex>
      )}

      {/* Comment Content (Swipeable) */}
      <Box
        transform={`translateX(${commentTranslateX}px)`}
        transition="transform 0.2s ease-out"
        bg="white"
        position="relative"
        zIndex={1}
        borderRadius="md"
        border={isSwipingToDelete ? "2px solid red" : "1px solid transparent"}
        boxShadow={isSwipingToDelete ? "0 0 5px rgba(255,0,0,0.3)" : "none"}
        onTouchStart={onCommentTouchStart}
        onTouchMove={onCommentTouchMove}
        onTouchEnd={onCommentTouchEnd}
      >
        <Flex align="flex-start">
          <Avatar size="sm" src={comment.profilePicture} mr={3} />
          <VStack align="flex-start" spacing={0}>
            <Flex align="center">
              <Text fontWeight="bold" fontSize="sm">{comment.username}</Text>
              {isCommentByPostAuthor && (
                <Text fontSize="xs" color="gray.500" ml={2}>by author</Text>
              )}
            </Flex>
            <Text fontSize="sm" mt={1}>{comment.text}</Text>
            <HStack fontSize="xs" color="gray.500" mt={1}>
              <Text>{getTimeAgo(comment.timestamp)}</Text>
              <Text>•</Text>
              <Text cursor="pointer" onClick={() => {
                setIsReplying(true);
                setReplyingToUsername(comment.username);
                setNewCommentText(`@${comment.username} `);
              }}>Reply</Text>
            </HStack>
          </VStack>
        </Flex>
      </Box>
    </Box>
  );
};

export default CommentItem; 