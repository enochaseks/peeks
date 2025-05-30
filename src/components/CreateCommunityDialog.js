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
  useToast,
  RadioGroup,
  Radio,
  HStack,
  Text,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Renamed component and props
const CreateCommunityDialog = ({ isOpen, onClose, onCreateCommunity, isUserAnonymous }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [communityType, setCommunityType] = useState(isUserAnonymous ? 'anonymous' : 'public');
  // Placeholder for moderator selection (can be added later)
  const [moderators, setModerators] = useState([]); // User is admin by default

  const toast = useToast();

  const handleSubmit = async () => {
    // Updated validation check
    if (!name || !description || !communityType) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields (Name, Description, and Type).',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // --- Add community document to Firestore ---
    try {
      // Get the current user's UID
      const currentUserId = auth.currentUser?.uid; // Use optional chaining

      if (!currentUserId) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create a community.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const newCommunityData = {
        name,
        description,
        rules,
        type: communityType,
        admins: [currentUserId], // Creator is admin by default
        moderators: [],
        createdAt: new Date(), // Timestamp
        isAnonymousCommunity: communityType === 'anonymous',
      };

      // Add the new community document to the 'communities' collection
      await addDoc(collection(db, "communities"), newCommunityData);

      toast({
        title: 'Community created successfully!',
        description: `The community '${name}' has been created.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      onCreateCommunity(newCommunityData); // Pass data to the parent component if needed

      // Clear form and close modal
      setName('');
      setDescription('');
      setRules('');
      setCommunityType(isUserAnonymous ? 'anonymous' : 'public');
      setModerators([]);
      onClose();

    } catch (error) {
      console.error('Error creating community:', error);
      toast({
        title: 'Error creating community',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    // --------------------------------------
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Create New Community</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Community Name</FormLabel>
              <Input
                placeholder="Enter community name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Description</FormLabel>
              <Textarea
                placeholder="Describe your community..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="sm"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Rules (Optional)</FormLabel>
              <Textarea
                placeholder="Community rules..."
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                size="sm"
              />
            </FormControl>

            <FormControl as="fieldset" isRequired>
              <FormLabel as="legend">Community Type</FormLabel>
              <RadioGroup onChange={setCommunityType} value={communityType} isDisabled={isUserAnonymous}>
                <HStack spacing="24px">
                  <Radio value="public">Public</Radio>
                  <Radio value="anonymous">Anonymous</Radio>
                  <Radio value="private">Private</Radio>
                </HStack>
              </RadioGroup>
            </FormControl>

            {isUserAnonymous && (
              <Alert status="info" mt={4}>
                <AlertIcon />
                <Text fontSize="sm">
                  You are creating an **Anonymous** community. In this community, all members (including you) will appear anonymous to each other, regardless of their personal profile settings. This setting cannot be changed later.
                </Text>
              </Alert>
            )}

            {/* Placeholder for Moderator Selection */}
            {/* You could add a component here to search for and select users as moderators */}
            {/* For now, the creator is admin by default */}

          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="orange" ml={3} onClick={handleSubmit}>
            Create Community
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateCommunityDialog; 