import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  InputGroup,
  InputLeftElement,
  Input,
  VStack,
  Text,
  Spinner,
  Flex,
  Spacer,
  IconButton,
  Avatar,
  HStack,
  Badge,
} from '@chakra-ui/react';
import { SearchIcon, ArrowBackIcon } from '@chakra-ui/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    users: [],
    communities: [],
  });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [isUserAnonymous, setIsUserAnonymous] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle initial search query from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get('q');
    if (queryParam) {
      setSearchQuery(queryParam);
      fetchSearchResults(queryParam);
    }
  }, [location.search]);

  // Fetch user's anonymous status
  useEffect(() => {
    const fetchUserAnonymousStatus = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setIsUserAnonymous(userDocSnap.data().isAnonymous || false);
          }
        } catch (error) {
          console.error('Error fetching user anonymous status:', error);
        }
      }
    };

    fetchUserAnonymousStatus();
  }, []);

  const fetchSearchResults = async (queryText) => {
    if (!queryText.trim()) {
      setSearchResults({ users: [], communities: [] });
      return;
    }

    setLoadingSearch(true);
    try {
      // Search for users
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '>=', queryText.toLowerCase()),
        where('username', '<=', queryText.toLowerCase() + '\uf8ff')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Search for communities
      const communitiesQuery = query(
        collection(db, 'communities'),
        where('name', '>=', queryText.toLowerCase()),
        where('name', '<=', queryText.toLowerCase() + '\uf8ff')
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

  // Debounce search to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSearchResults(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <Container maxW="container.md" py={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex align="center" mb={4}>
          <IconButton
            icon={<ArrowBackIcon />}
            aria-label="Go back"
            onClick={() => navigate(-1)}
            variant="ghost"
          />
          <Spacer />
          <Text fontSize="2xl" fontWeight="bold">Search</Text>
          <Spacer />
          <Box w="40px" />
        </Flex>

        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search users and communities..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              // Update URL with search query
              const newUrl = e.target.value 
                ? `/search?q=${encodeURIComponent(e.target.value)}`
                : '/search';
              navigate(newUrl, { replace: true });
            }}
          />
        </InputGroup>

        {/* Search Results */}
        <Box>
          {loadingSearch ? (
            <Spinner size="xl" />
          ) : (
            <VStack align="stretch" spacing={4}>
              {searchResults.users.length > 0 && (
                <>
                  <Text fontSize="lg" fontWeight="semibold">Users:</Text>
                  {searchResults.users.map(user => (
                    <HStack 
                      key={user.id} 
                      p={2} 
                      bg="white" 
                      borderRadius="md" 
                      boxShadow="sm"
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
                      bg="white" 
                      borderRadius="md" 
                      boxShadow="sm"
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

              {searchQuery.trim() !== '' && 
               searchResults.users.length === 0 && 
               searchResults.communities.length === 0 && (
                <Text textAlign="center" color="gray.500">No results found.</Text>
              )}

              {searchQuery.trim() === '' && (
                <Text textAlign="center" color="gray.500">Start typing to search.</Text>
              )}
            </VStack>
          )}
        </Box>
      </VStack>
    </Container>
  );
};

export default SearchPage; 