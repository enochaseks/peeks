import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Input,
  InputGroup,
  InputRightElement,
  IconButton,
  VStack,
  Text,
  Avatar,
  Button,
  useToast,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { FaSearch, FaUserPlus } from 'react-icons/fa';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

const Inbox = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    if (!auth.currentUser) return;

    // Query messages where user is either sender or receiver
    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messageList);
      setFilteredMessages(messageList);
    });

    return () => unsubscribe();
  }, []);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    const filtered = messages.filter(message => 
      message.content.toLowerCase().includes(query) ||
      message.senderName.toLowerCase().includes(query)
    );
    setFilteredMessages(filtered);
  };

  const handleFindUser = () => {
    onOpen();
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd; // Positive means left swipe
    const isLeftSwipe = distance > minSwipeDistance;
    
    if (isLeftSwipe) {
      navigate('/camera');
    }
  };

  return (
    <Box 
      h="100vh" 
      bg="gray.900" 
      color="white"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Search and Find User Bar */}
      <Flex p={4} gap={2}>
        <InputGroup>
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={handleSearch}
            bg="gray.800"
            color="white"
            borderRadius="full"
          />
          <InputRightElement>
            <FaSearch color="gray.400" />
          </InputRightElement>
        </InputGroup>
        <IconButton
          aria-label="Find User"
          icon={<FaUserPlus />}
          onClick={handleFindUser}
          colorScheme="blue"
          borderRadius="full"
        />
      </Flex>

      {/* Messages List */}
      <VStack spacing={2} p={4} overflowY="auto" h="calc(100vh - 80px)">
        {filteredMessages.map((message) => (
          <Flex
            key={message.id}
            w="100%"
            p={3}
            bg="gray.800"
            borderRadius="lg"
            align="center"
            gap={3}
          >
            <Avatar size="sm" name={message.senderName} />
            <Box flex="1">
              <Text fontWeight="bold">{message.senderName}</Text>
              <Text fontSize="sm" color="gray.400">{message.content}</Text>
            </Box>
            <Text fontSize="xs" color="gray.500">
              {message.timestamp?.toDate().toLocaleTimeString()}
            </Text>
          </Flex>
        ))}
      </VStack>

      {/* Find User Drawer */}
      <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent bg="gray.900" color="white">
          <DrawerCloseButton />
          <DrawerHeader>Find Users</DrawerHeader>
          <DrawerBody>
            {/* User search functionality will be implemented here */}
            <Text>User search coming soon...</Text>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
};

export default Inbox; 