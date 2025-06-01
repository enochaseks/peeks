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
  useBreakpointValue,
  Spinner,
  Badge,
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
  const [isCreateCommunityModalOpen, setIsCreateCommunityModalOpen] = useState(false);
  // State to hold the current user's anonymous status
  const [isUserAnonymous, setIsUserAnonymous] = useState(false);
  // State to hold the user's profile data for the header
  const [discoverProfile, setDiscoverProfile] = useState({
    username: 'User',
    avatarUrl: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    users: [],
    communities: [],
  });
  const [loadingSearch, setLoadingSearch] = useState(false);

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

  // Search functionality
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery.trim()) {
        setSearchResults({ users: [], communities: [] });
        return;
      }

      setLoadingSearch(true);
      try {
        // Search for users
        const usersQuery = query(
          collection(db, 'users'),
          where('username', '>=', searchQuery.toLowerCase()),
          where('username', '<=', searchQuery.toLowerCase() + '\uf8ff')
        );
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Search for communities
        const communitiesQuery = query(
          collection(db, 'communities'),
          where('name', '>=', searchQuery.toLowerCase()),
          where('name', '<=', searchQuery.toLowerCase() + '\uf8ff')
        );
        const communitiesSnapshot = await getDocs(communitiesQuery);
        const communities = communitiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter out anonymous communities if user is not anonymous
        const filteredCommunities = isUserAnonymous 
          ? communities 
          : communities.filter(community => !community.isAnonymous);

        setSearchResults({
          users: users,
          communities: filteredCommunities
        });
      } catch (error) {
        console.error('Error searching:', error);
        setSearchResults({ users: [], communities: [] });
      } finally {
        setLoadingSearch(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isUserAnonymous]);

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

            {/* Center: Search Bar (visible on md and up) */}
            <InputGroup flex="1" maxW="md" mx={4} display={{ base: 'none', md: 'flex' }}>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search users and communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>

            {/* Right: Create Community and Profile Icons */}
            <HStack spacing={2}>
              {/* Search Icon (visible on base, moved to the right) */}
              <Button
                variant="ghost"
                onClick={() => navigate('/search')}
                p={0}
                minW="auto"
                aria-label="Search"
                display={{ base: 'block', md: 'none' }}
              >
                <SearchIcon boxSize={6} />
              </Button>
              <Button
                variant="ghost"
                onClick={handleCreateCommunityClick}
                p={0}
                minW="auto"
                aria-label="Create Community"
              >
                <AddIcon boxSize={5} />
              </Button>
              <Button variant="ghost" onClick={() => navigate('/profile')} p={0} minW="auto">
                <Avatar
                  size="sm"
                  name={isUserAnonymous ? "Anonymous User" : discoverProfile.username}
                  src={isUserAnonymous ? 'images/Anonymous.jpg' : discoverProfile.avatarUrl || 'https://via.placeholder.com/150'}
                  cursor="pointer"
                />
              </Button>
            </HStack>
          </Flex>

          {/* Search Results */}
          {searchQuery.trim() !== '' && (
            <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
              {loadingSearch ? (
                <Flex justify="center" p={4}>
                  <Spinner size="xl" />
                </Flex>
              ) : (
                <VStack align="stretch" spacing={4}>
                  {searchResults.users.length > 0 && (
                    <>
                      <Text fontSize="lg" fontWeight="semibold">Users:</Text>
                      {searchResults.users.map(user => (
                        <HStack 
                          key={user.id} 
                          p={2} 
                          bg="gray.50" 
                          borderRadius="md" 
                          cursor="pointer"
                          onClick={() => navigate(`/profile/${user.id}`)}
                        >
                          <Avatar 
                            size="sm" 
                            name={user.isAnonymous ? "Anonymous User" : user.username}
                            src={user.isAnonymous ? 'images/Anonymous.jpg' : user.avatarUrl}
                          />
                          <Text>{user.isAnonymous ? "Anonymous User" : user.username}</Text>
                          {user.isAnonymous && <Badge colorScheme="gray">Anonymous</Badge>}
                        </HStack>
                      ))}
                    </>
                  )}

                  {searchResults.communities.length > 0 && (
                    <>
                      <Text fontSize="lg" fontWeight="semibold">Communities:</Text>
                      {searchResults.communities.map(community => (
                        <HStack 
                          key={community.id} 
                          p={2} 
                          bg="gray.50" 
                          borderRadius="md" 
                          cursor="pointer"
                          onClick={() => navigate(`/community/${community.id}`)}
                        >
                          <Avatar 
                            size="sm" 
                            name={community.isAnonymous ? "Anonymous Community" : community.name}
                            src={community.isAnonymous ? 'images/Anonymous.jpg' : community.avatarUrl}
                          />
                          <Text>{community.isAnonymous ? "Anonymous Community" : community.name}</Text>
                          {community.isAnonymous && <Badge colorScheme="gray">Anonymous</Badge>}
                        </HStack>
                      ))}
                    </>
                  )}

                  {searchResults.users.length === 0 && searchResults.communities.length === 0 && (
                    <Text textAlign="center" color="gray.500">No results found.</Text>
                  )}
                </VStack>
              )}
            </Box>
          )}

          {/* Content area below header and search results */}
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