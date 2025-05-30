import React, { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';

const EditProfileDialog = ({ isOpen, onClose, profile, onSave }) => {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const toast = useToast();

  // Update state when the profile prop changes (e.g., when the dialog is opened with different profile data)
  useEffect(() => {
    setName(profile.name);
    setBio(profile.bio);
  }, [profile]);

  const handleSaveClick = () => {
    if (!name) {
      toast({
        title: 'Name is required',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const updatedProfile = {
      ...profile,
      name,
      bio,
    };
    onSave(updatedProfile);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Edit Profile</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Name</FormLabel>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>

            <FormControl>
              <FormLabel>Bio</FormLabel>
              <Textarea
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                size="sm"
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button colorScheme="orange" ml={3} onClick={handleSaveClick}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditProfileDialog; 