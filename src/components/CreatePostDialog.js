import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  VStack,
  useToast
} from '@chakra-ui/react';

const CreatePostDialog = ({ isOpen, onClose, onCreatePost }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [community, setCommunity] = useState('');
  const toast = useToast();

  const handleSubmit = () => {
    if (!title || !content || !community) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const newPost = {
      title,
      content,
      community,
      // Add author, timestamp, likes, comments later
    };

    onCreatePost(newPost);

    // Clear form and close modal
    setTitle('');
    setContent('');
    setCommunity('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create New Post</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Title</FormLabel>
              <Input
                placeholder="Post Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Content</FormLabel>
              <Textarea
                placeholder="Post content..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                size="sm"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Community</FormLabel>
              <Input
                placeholder="Enter community name"
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
              />
            </FormControl>

          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="orange" ml={3} onClick={handleSubmit}>
            Create Post
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreatePostDialog; 