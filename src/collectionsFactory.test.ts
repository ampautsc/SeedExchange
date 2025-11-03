import { initializeCollections, getInMemoryCollections } from './collectionsFactory';
import { SeedExchangeCollections } from './collections';

describe('Collections Factory', () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.COSMOS_DB_ENDPOINT;
    delete process.env.COSMOS_DB_KEY;
    delete process.env.AZURE_KEY_VAULT_URI;
    delete process.env.COSMOS_DB_KEY_SECRET_NAME;
    
    // Suppress console output during tests
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterAll(() => {
    // Restore original environment and console
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('initializeCollections', () => {
    it('should return in-memory collections when Cosmos DB is not configured', async () => {
      const collections = await initializeCollections();
      
      // Verify it's a SeedExchangeCollections instance
      expect(collections).toBeInstanceOf(SeedExchangeCollections);
      
      // Test basic functionality
      const testExchange = {
        id: 'test-1',
        plantId: 'plant-1',
        requestUserId: 'user-1',
        offerUserId: null,
        quantity: 1,
        seedRequestTime: new Date(),
        seedOfferTime: null,
        confirmationTime: null,
        shipTime: null,
        receivedTime: null
      };
      
      await collections.addExchange(testExchange);
      const retrieved = await collections.getExchange('test-1');
      expect(retrieved).toEqual(testExchange);
    });

    it('should fall back to in-memory when Cosmos DB config is incomplete', async () => {
      // Set only endpoint (missing key)
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      
      const collections = await initializeCollections();
      expect(collections).toBeInstanceOf(SeedExchangeCollections);
    });
  });

  describe('getInMemoryCollections', () => {
    it('should always return in-memory collections', () => {
      const collections = getInMemoryCollections();
      expect(collections).toBeInstanceOf(SeedExchangeCollections);
    });

    it('should return a new instance each time', () => {
      const collections1 = getInMemoryCollections();
      const collections2 = getInMemoryCollections();
      expect(collections1).not.toBe(collections2);
    });

    it('should work independently of environment variables', () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      process.env.COSMOS_DB_KEY = 'test-key';
      
      const collections = getInMemoryCollections();
      expect(collections).toBeInstanceOf(SeedExchangeCollections);
    });
  });
});
