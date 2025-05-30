import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Button,
  useToast,
  Flex,
  Image,
  Text,
  InputGroup,
  InputLeftElement,
  Input,
  Avatar,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { AddIcon, SearchIcon } from '@chakra-ui/icons';
import CreateCommunityDialog from './CreateCommunityDialog';
// Import Firestore functions and db
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Discover = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  // State to store search results
  const [searchResults, setSearchResults] = useState({
    users: [],
    communities: [],
  });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [isCreateCommunityModalOpen, setIsCreateCommunityModalOpen] = useState(false);
  // State to hold the current user's anonymous status
  const [isUserAnonymous, setIsUserAnonymous] = useState(false);
  // State to hold the user's profile data for the header
  const [discoverProfile, setDiscoverProfile] = useState({
    username: 'User',
    avatarUrl: '',
  });

  // Effect to fetch user's anonymous status on component mount or user change
  useEffect(() => {
    const fetchUserAnonymousStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setIsUserAnonymous(userDocSnap.data().isAnonymous || false);
            setDiscoverProfile({
              username: userDocSnap.data().username || user.email || 'User',
              avatarUrl: userDocSnap.data().avatarUrl || '',
            });
          } else {
            // If user document doesn't exist, assume not anonymous for now
            setIsUserAnonymous(false);
            setDiscoverProfile({
              username: user?.email || 'User',
              avatarUrl: '',
            });
            console.warn('User document not found for anonymous status check in Discover.');
          }
        } catch (error) {
          console.error('Error fetching user anonymous status in Discover:', error);
          setIsUserAnonymous(false); // Default to not anonymous on error
          setDiscoverProfile({
            username: user?.email || 'User',
            avatarUrl: '',
          });
        }
      } else {
        setIsUserAnonymous(false);
        setDiscoverProfile({
          username: 'User',
          avatarUrl: '',
        });
      }
    };

    fetchUserAnonymousStatus();

    // Listen for auth state changes to refetch if user logs in/out
    const unsubscribe = auth.onAuthStateChanged(() => {
      fetchUserAnonymousStatus();
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();

  }, [db]); // Dependency on db ensures effect runs if db initialization changes (less common)

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Logged out successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: 'Error logging out',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCreateCommunityClick = () => {
    setIsCreateCommunityModalOpen(true);
  };

  const handleCloseCreateCommunityModal = () => {
    setIsCreateCommunityModalOpen(false);
  };

  const handleCreateCommunity = (newCommunityData) => {
    console.log('New Community Data:', newCommunityData);
    toast({
      title: 'Community created (simulated)',
      description: 'Your community is ready!',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
    handleCloseCreateCommunityModal();
  };

  // Async function to fetch search results from Firestore
  const fetchSearchResults = async (queryText) => {
    if (queryText.trim() === '') {
      setSearchResults({ users: [], communities: [] });
      return;
    }

    setLoadingSearch(true);
    try {
      // Query users collection
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('username', '>=', queryText), where('username', '<=', queryText + '\uf8ff'));
      const userSnapshot = await getDocs(userQuery);
      const fetchedUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Query communities collection
      const communitiesRef = collection(db, 'communities');
      const communityQuery = query(communitiesRef, where('name', '>=', queryText), where('name', '<=', queryText + '\uf8ff'));
      const communitySnapshot = await getDocs(communityQuery);
      const fetchedCommunities = communitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setSearchResults({
        users: fetchedUsers,
        communities: fetchedCommunities,
      });

    } catch (error) {
      console.error('Error fetching search results:', error);
      toast({
        title: 'Search Error',
        description: 'Failed to fetch search results.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setSearchResults({ users: [], communities: [] });
    } finally {
      setLoadingSearch(false);
    }
  };

  // Effect to trigger search when searchQuery changes
  useEffect(() => {
    // You might want to debounce this for performance on real Firestore calls
    fetchSearchResults(searchQuery);
  }, [searchQuery]);

  return (
    <Box
      minH="100vh"
      bg="gray.50"
      py={4}
      px={4}
    >
      <Container maxW="container.xl">
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <Flex justify="space-between" align="center" pb={4} borderBottom="1px" borderColor="gray.200">
            {/* Left: Logo and Title */}
            <HStack spacing={2}>
              <Image src="/logo192.png" alt="Peeks Logo" boxSize="40px" />
              <Text fontSize="xl" fontWeight="bold">Peeks</Text>
            </HStack>

            {/* Center: Search Bar */}
            <InputGroup flex="1" maxW="md" mx={4}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search users and communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>

            {/* Right: Profile Icon */}
            <Button variant="ghost" onClick={() => navigate('/profile')} p={0} minW="auto">
              <Avatar
                size="sm"
                name={isUserAnonymous ? "Anonymous User" : discoverProfile.username}
                src={isUserAnonymous ? 'images/Anonymous.jpg' : discoverProfile.avatarUrl || 'https://via.placeholder.com/150'}
                cursor="pointer"
              />
            </Button>
          </Flex>

          {/* Create Community Button - positioned below the header */}
          <Flex justify="flex-end">
            <Button
              leftIcon={<AddIcon />}
              colorScheme="orange"
              onClick={handleCreateCommunityClick}
            >
              Create Community
            </Button>
          </Flex>

          {/* Search Results Display Area */}
          {searchQuery && (
            <Box mt={4}>
              <Text fontSize="lg" fontWeight="bold">Search Results:</Text>
              {loadingSearch ? (
                <Text>Loading...</Text>
              ) : (
                <VStack align="stretch" spacing={2} mt={2}>
                  <Text fontSize="md" fontWeight="semibold">Users:</Text>
                  {searchResults.users.length > 0 ? (
                    searchResults.users.map(user => (
                      <Text key={user.id}>{user.name}</Text>
                    ))
                  ) : (
                    <Text fontSize="sm" color="gray.500">No users found.</Text>
                  )}

                  <Text fontSize="md" fontWeight="semibold">Communities:</Text>
                  {searchResults.communities.length > 0 ? (
                    searchResults.communities.map(community => (
                      <Text key={community.id}>{community.name}</Text>
                    ))
                  ) : (
                    <Text fontSize="sm" color="gray.500">No communities found.</Text>
                  )}
                </VStack>
              )}
            </Box>
          )}

          {/* Content area below header, button, and search results (currently plain) */}
          {/* You would typically display recent communities or posts here when no search query is active */}

        </VStack>
      </Container>

      {/* Create Community Dialog */}
      <CreateCommunityDialog
        isOpen={isCreateCommunityModalOpen}
        onClose={handleCloseCreateCommunityModal}
        onCreateCommunity={handleCreateCommunity}
        isUserAnonymous={isUserAnonymous}
      />
    </Box>
  );
};

export default Discover; 