import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Avatar,
  Button,
  Flex,
  Switch,
  FormControl,
  FormLabel,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Spacer,
  useDisclosure,
  Tab,
  IconButton,
  useToast
} from '@chakra-ui/react';
import { auth } from '../firebase'; // Assuming you have firebase auth initialized here
import EditProfileDialog from './EditProfileDialog'; // We will create this next
import { ArrowBackIcon } from '@chakra-ui/icons'; // Added icon imports
import { FiShare } from 'react-icons/fi'; // Import Share icon from react-icons
import { useNavigate } from 'react-router-dom'; // Added useNavigate import
// Import Firestore functions and db
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ProfilePage = () => {
  const user = auth.currentUser; // Get the current logged-in user
  const toast = useToast(); // Called useToast hook
  const [isAnonymous, setIsAnonymous] = useState(false); // State for anonymous toggle
  // Placeholder state for profile details (will come from backend usually)
  const [profile, setProfile] = useState({
    name: user?.displayName || user?.email || 'User',
    bio: 'Tell us about yourself...',
    followers: 0,
    following: 0,
    // You might add an avatarUrl and isAnonymous field here later when fetching profile
    isAnonymous: false, // Initialize isAnonymous state based on fetched profile data
  });

  // State and handlers for the Edit Profile Dialog
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate(); // Initialize navigate

  // --- Fetch profile data on component mount ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setProfile(prevProfile => ({
              ...prevProfile,
              name: userData.username || prevProfile.name, // Update name if available
              bio: userData.bio || prevProfile.bio, // Update bio if available
              followers: userData.followers || prevProfile.followers,
              following: userData.following || prevProfile.following,
              isAnonymous: userData.isAnonymous || false, // Set anonymous state
            }));
            setIsAnonymous(userData.isAnonymous || false); // Also update the separate isAnonymous state
          } else {
            console.log('No such user document!');
            // Optionally, create the user document here if it doesn't exist
            // setDoc(userDocRef, { username: user.displayName || user.email, ... });
            toast({
              title: 'Profile not found',
              description: 'Your user profile document is missing. It will be created when you update your profile.',
              status: 'info',
              duration: 5000,
              isClosable: true,
            });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          toast({
            title: 'Error',
            description: 'Failed to load profile data.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    };

    fetchProfileData();
  }, [user, db, toast]); // Add dependencies
  // -------------------------------------------

  // --- Handle Anonymous Toggle and update Firestore ---
  const handleAnonymousToggle = async () => {
    const newAnonymousStatus = !isAnonymous;
    setIsAnonymous(newAnonymousStatus);

    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        // Use setDoc with merge: true to create or update the document
        await setDoc(userDocRef, {
          isAnonymous: newAnonymousStatus,
        }, { merge: true }); // Use merge: true

        toast({
          title: newAnonymousStatus ? 'Profile is now anonymous' : 'Profile is now public',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error updating anonymous status:', error);
        // Revert the toggle state if the update fails
        setIsAnonymous(isAnonymous);
        // Show a toast error message
        toast({
          title: 'Error',
          description: 'Failed to update anonymous status.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };
  // ---------------------------------------------------

  const handleSaveProfile = (updatedProfile) => {
    console.log('Saving profile:', updatedProfile);
    // In a real app, you would update the user's document in Firestore here
    // using setDoc with merge: true
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
         // Use setDoc with merge: true to update the document
         setDoc(userDocRef, {
          username: updatedProfile.name, // Assuming name from dialog is username
          bio: updatedProfile.bio,
         }, { merge: true }); // Use merge: true

         toast({
          title: 'Profile updated',
          status: 'success',
          duration: 3000,
          isClosable: true,
         });
         setProfile(updatedProfile); // Update local state after successful save
         onClose();
      } catch (error) {
        console.error('Error updating profile:', error);
        toast({
          title: 'Error',
          description: 'Failed to update profile.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } else {
       setProfile(updatedProfile); // Update local state even if not logged in (for demo)
       onClose();
    }
  };

  const handleShareProfile = () => {
    // Implement share functionality here
    console.log('Sharing profile...');
    if (navigator.share) {
      navigator.share({
        title: `${profile.name}'s Profile on Peeks`,
        text: profile.bio || '',
        url: window.location.href,
      }).then(() => {
        console.log('Profile shared successfully');
      }).catch((error) => {
        console.error('Error sharing profile:', error);
      });
    } else {
      alert(`You can share this profile by copying the URL: ${window.location.href}`);
    }
  };

  // Placeholder content for tabs
  const PostsTabContent = () => <Text>User's posts will appear here.</Text>;
  const CommunityTabContent = () => <Text>User's community interactions will appear here.</Text>;
  const LiveSessionsTabContent = () => <Text>User's live sessions will appear here.</Text>;

  return (
    <Box minH="100vh" bg="gray.50" py={8} px={4}>
      <Container maxW="container.md">
        <VStack spacing={6} align="stretch">
          {/* Top Header Row: Back and Share/Edit Buttons */}
          <Flex justify="space-between" align="center" w="100%" pb={4} borderBottom="1px" borderColor="gray.200">
            {/* Left: Back Button */}
            <IconButton
              aria-label="Go back"
              icon={<ArrowBackIcon />}
              onClick={() => navigate('/discover')}
              variant="ghost"
            />

            {/* Only show Share and Edit buttons if not anonymous */}
            {!isAnonymous && (
              <HStack spacing={2}>
                <IconButton
                  aria-label="Share profile"
                  icon={<FiShare />}
                  onClick={handleShareProfile}
                  variant="ghost"
                />
                <Button colorScheme="orange" size="sm" onClick={onOpen}>
                  Edit Profile
                </Button>
              </HStack>
            )}
          </Flex>

          {/* Profile Details Section (Centered) */}
          <VStack spacing={4} align="center" w="100%"> {/* This VStack now contains the main profile content below the header */}
            {/* Show default anonymous avatar or user's avatar */}
            <Avatar 
              size="xl" 
              name={isAnonymous ? "Anonymous" : profile.name} 
              src={isAnonymous ? "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y" : "https://via.placeholder.com/150/CCCCCC/FFFFFF/?text=User"} 
            />
            
            {/* Show anonymous name or user's name */}
            <Text fontSize="2xl" fontWeight="bold">
              {isAnonymous ? "Anonymous" : profile.name}
            </Text>

            {/* Only show bio if not anonymous */}
            {!isAnonymous && (
              <Text fontSize="md" color="gray.600" textAlign="center">
                {profile.bio}
              </Text>
            )}

            {/* Only show follower/following counts if not anonymous */}
            {!isAnonymous && (
              <HStack spacing={8}>
                <VStack>
                  <Text fontSize="lg" fontWeight="bold">{profile.followers}</Text>
                  <Text fontSize="sm" color="gray.600">Followers</Text>
                </VStack>
                <VStack>
                  <Text fontSize="lg" fontWeight="bold">{profile.following}</Text>
                  <Text fontSize="sm" color="gray.600">Following</Text>
                </VStack>
              </HStack>
            )}

            {/* Anonymous Toggle */}
            <FormControl display="flex" alignItems="center" justifyContent="center">
              <FormLabel htmlFor="anonymous-toggle" mb="0">
                Post Anonymously?
              </FormLabel>
              <Switch
                id="anonymous-toggle"
                isChecked={isAnonymous}
                onChange={handleAnonymousToggle}
                colorScheme="orange"
              />
            </FormControl>
          </VStack>

          {/* Show tabs regardless of anonymous status */}
          <Tabs isFitted variant="enclosed">
            <TabList>
              <Tab>Posts</Tab>
              <Tab>Community</Tab>
              <Tab>Live Sessions</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <PostsTabContent />
              </TabPanel>
              <TabPanel>
                <CommunityTabContent />
              </TabPanel>
              <TabPanel>
                <LiveSessionsTabContent />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        isOpen={isOpen}
        onClose={onClose}
        profile={profile}
        onSave={handleSaveProfile}
      />
    </Box>
  );
};

export default ProfilePage; 