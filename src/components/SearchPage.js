import React, { useState } from 'react';
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
} from '@chakra-ui/react';
import { SearchIcon, ArrowBackIcon } from '@chakra-ui/icons';
import { useNavigate } from 'react-router-dom';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    users: [],
    communities: [],
  });
  const [loadingSearch, setLoadingSearch] = useState(false);
  const navigate = useNavigate();

  // You will implement the fetchSearchResults function here later
  // const fetchSearchResults = async (queryText) => { ... }

  // You will likely add a useEffect here to trigger search when searchQuery changes
  // useEffect(() => { fetchSearchResults(searchQuery); }, [searchQuery]);

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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </InputGroup>

        {/* Placeholder for Search Results */}
        <Box>
          {loadingSearch ? (
            <Spinner size="xl" />
          ) : (
            <VStack align="stretch" spacing={2}>
              {searchResults.users.length > 0 || searchResults.communities.length > 0 ? (
                <>
                  <Text fontSize="lg" fontWeight="semibold">Users:</Text>
                  {searchResults.users.map(user => (
                    <Text key={user.id}>{user.username || user.email}</Text>
                  ))}

                  <Text fontSize="lg" fontWeight="semibold">Communities:</Text>
                  {searchResults.communities.map(community => (
                    <Text key={community.id}>{community.name}</Text>
                  ))}
                </>
              ) : ( searchQuery.trim() !== '' ?
                <Text textAlign="center" color="gray.500">No results found.</Text>
                :
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