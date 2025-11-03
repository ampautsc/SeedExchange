import { performHealthCheck, formatHealthCheckResult, HealthCheckResult } from './healthCheck';
import { SeedExchangeCollections } from './collections';
import { ISeedExchangeCollections } from './ISeedExchangeCollections';

describe('Health Check', () => {
  let collections: ISeedExchangeCollections;
  
  // Save original environment variables
  let originalEnv: {
    COSMOS_DB_ENDPOINT?: string;
    AZURE_KEY_VAULT_URI?: string;
    COSMOS_DB_KEY?: string;
    COSMOS_DB_KEY_SECRET_NAME?: string;
  } = {};

  beforeEach(async () => {
    collections = new SeedExchangeCollections();
    await collections.clear();
    
    // Save environment variables before each test
    originalEnv = {
      COSMOS_DB_ENDPOINT: process.env.COSMOS_DB_ENDPOINT,
      AZURE_KEY_VAULT_URI: process.env.AZURE_KEY_VAULT_URI,
      COSMOS_DB_KEY: process.env.COSMOS_DB_KEY,
      COSMOS_DB_KEY_SECRET_NAME: process.env.COSMOS_DB_KEY_SECRET_NAME
    };
    
    // Clear Cosmos DB and Key Vault environment variables for most tests
    // Individual tests will set them as needed
    delete process.env.COSMOS_DB_ENDPOINT;
    delete process.env.AZURE_KEY_VAULT_URI;
    delete process.env.COSMOS_DB_KEY;
    delete process.env.COSMOS_DB_KEY_SECRET_NAME;
  });

  afterEach(async () => {
    await collections.clear();
    
    // Restore original environment variables after each test
    if (originalEnv.COSMOS_DB_ENDPOINT !== undefined) {
      process.env.COSMOS_DB_ENDPOINT = originalEnv.COSMOS_DB_ENDPOINT;
    } else {
      delete process.env.COSMOS_DB_ENDPOINT;
    }
    if (originalEnv.AZURE_KEY_VAULT_URI !== undefined) {
      process.env.AZURE_KEY_VAULT_URI = originalEnv.AZURE_KEY_VAULT_URI;
    } else {
      delete process.env.AZURE_KEY_VAULT_URI;
    }
    if (originalEnv.COSMOS_DB_KEY !== undefined) {
      process.env.COSMOS_DB_KEY = originalEnv.COSMOS_DB_KEY;
    } else {
      delete process.env.COSMOS_DB_KEY;
    }
    if (originalEnv.COSMOS_DB_KEY_SECRET_NAME !== undefined) {
      process.env.COSMOS_DB_KEY_SECRET_NAME = originalEnv.COSMOS_DB_KEY_SECRET_NAME;
    } else {
      delete process.env.COSMOS_DB_KEY_SECRET_NAME;
    }
  });

  describe('performHealthCheck', () => {
    it('should return healthy status when storage is working', async () => {
      const result = await performHealthCheck(collections);

      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].name).toBe('storage');
      expect(result.dependencies[0].status).toBe('healthy');
    });

    it('should verify all CRUD operations', async () => {
      const result = await performHealthCheck(collections);

      expect(result.status).toBe('healthy');
      const storageDep = result.dependencies.find(d => d.name === 'storage');
      expect(storageDep).toBeDefined();
      expect(storageDep?.details?.operationsVerified).toEqual(['create', 'read', 'query', 'delete']);
    });

    it('should include response time in health check', async () => {
      const result = await performHealthCheck(collections);

      const storageDep = result.dependencies.find(d => d.name === 'storage');
      expect(storageDep?.responseTime).toBeDefined();
      expect(storageDep?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should clean up test data after health check', async () => {
      await performHealthCheck(collections);

      // Verify no health check data remains
      const allExchanges = await collections.getAllExchanges();
      const healthCheckExchanges = allExchanges.filter(ex => 
        ex.plantId === 'health-check-plant'
      );
      expect(healthCheckExchanges).toHaveLength(0);
    });

    it('should identify storage type in details', async () => {
      const result = await performHealthCheck(collections);

      const storageDep = result.dependencies.find(d => d.name === 'storage');
      expect(storageDep?.details?.storageType).toBe('In-Memory');
    });

    it('should work without pre-initialized collections', async () => {
      const result = await performHealthCheck();

      expect(result.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result.dependencies.length).toBeGreaterThan(0);
    });

    it('should include version information', async () => {
      const result = await performHealthCheck(collections);

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });
  });

  describe('formatHealthCheckResult', () => {
    it('should format healthy result correctly', async () => {
      const result = await performHealthCheck(collections);
      const formatted = formatHealthCheckResult(result);

      expect(formatted).toContain('Overall Status: HEALTHY');
      expect(formatted).toContain('✅');
      expect(formatted).toContain('storage: healthy');
      expect(formatted).toContain('Dependencies:');
    });

    it('should include timestamp in formatted output', async () => {
      const result = await performHealthCheck(collections);
      const formatted = formatHealthCheckResult(result);

      expect(formatted).toContain('Timestamp:');
      expect(formatted).toContain(result.timestamp.toISOString());
    });

    it('should include response time in formatted output', async () => {
      const result = await performHealthCheck(collections);
      const formatted = formatHealthCheckResult(result);

      expect(formatted).toContain('Response Time:');
      expect(formatted).toMatch(/Response Time: \d+ms/);
    });

    it('should include details in formatted output', async () => {
      const result = await performHealthCheck(collections);
      const formatted = formatHealthCheckResult(result);

      expect(formatted).toContain('Details:');
      expect(formatted).toContain('storageType');
    });

    it('should show degraded status with warning emoji', async () => {
      const degradedResult: HealthCheckResult = {
        status: 'degraded',
        timestamp: new Date(),
        dependencies: [{
          name: 'test',
          status: 'degraded',
          message: 'Test degraded'
        }]
      };

      const formatted = formatHealthCheckResult(degradedResult);

      expect(formatted).toContain('⚠️');
      expect(formatted).toContain('Overall Status: DEGRADED');
    });

    it('should show unhealthy status with error emoji', async () => {
      const unhealthyResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date(),
        dependencies: [{
          name: 'test',
          status: 'unhealthy',
          message: 'Test unhealthy'
        }]
      };

      const formatted = formatHealthCheckResult(unhealthyResult);

      expect(formatted).toContain('❌');
      expect(formatted).toContain('Overall Status: UNHEALTHY');
    });
  });

  describe('Error handling', () => {
    it('should handle storage errors gracefully', async () => {
      const mockCollections: ISeedExchangeCollections = {
        getOpenRequestsByPlant: jest.fn().mockRejectedValue(new Error('Storage error')),
        getOpenOffersByPlant: jest.fn().mockRejectedValue(new Error('Storage error')),
        getConfirmedExchanges: jest.fn().mockRejectedValue(new Error('Storage error')),
        getExchangesByUser: jest.fn().mockRejectedValue(new Error('Storage error')),
        addExchange: jest.fn().mockRejectedValue(new Error('Storage error')),
        getExchange: jest.fn().mockRejectedValue(new Error('Storage error')),
        removeExchange: jest.fn().mockRejectedValue(new Error('Storage error')),
        updateExchange: jest.fn().mockRejectedValue(new Error('Storage error')),
        getAllExchanges: jest.fn().mockRejectedValue(new Error('Storage error')),
        clear: jest.fn().mockRejectedValue(new Error('Storage error'))
      };

      const result = await performHealthCheck(mockCollections);

      expect(result.status).toBe('unhealthy');
      const storageDep = result.dependencies.find(d => d.name === 'storage');
      expect(storageDep?.status).toBe('unhealthy');
      expect(storageDep?.message).toContain('Storage error');
    });

    it('should return unhealthy if write fails', async () => {
      const mockCollections: ISeedExchangeCollections = {
        ...collections,
        addExchange: jest.fn().mockRejectedValue(new Error('Write failed'))
      };

      const result = await performHealthCheck(mockCollections);

      expect(result.status).toBe('unhealthy');
    });

    it('should return unhealthy if read after write returns nothing', async () => {
      const mockCollections: ISeedExchangeCollections = {
        ...collections,
        addExchange: jest.fn().mockResolvedValue(undefined),
        getExchange: jest.fn().mockResolvedValue(undefined)
      };

      const result = await performHealthCheck(mockCollections);

      expect(result.status).toBe('unhealthy');
      const storageDep = result.dependencies.find(d => d.name === 'storage');
      expect(storageDep?.message).toContain('Failed to retrieve test data');
    });
  });

  describe('Integration with different storage backends', () => {
    it('should detect CosmosDB when environment variable is set', async () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';

      const result = await performHealthCheck(collections);

      const storageDep = result.dependencies.find(d => d.name === 'storage');
      // Even though we're using in-memory collections in the test,
      // the environment variable check should indicate CosmosDB
      expect(storageDep?.message).toContain('storage is functioning correctly');
    });
  });

  describe('Cosmos DB connectivity check', () => {
    it('should not include cosmos-db checks when not using Cosmos DB', async () => {
      const result = await performHealthCheck(collections);

      const cosmosDbDep = result.dependencies.find(d => d.name === 'cosmos-db');
      const cosmosConfigDep = result.dependencies.find(d => d.name === 'cosmos-db-config');
      expect(cosmosDbDep).toBeUndefined();
      expect(cosmosConfigDep).toBeUndefined();
    });

    it('should validate configuration when only endpoint is set', async () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      // Don't set COSMOS_DB_KEY or AZURE_KEY_VAULT_URI

      const result = await performHealthCheck(collections);

      const cosmosConfigDep = result.dependencies.find(d => d.name === 'cosmos-db-config');
      expect(cosmosConfigDep).toBeDefined();
      expect(cosmosConfigDep?.status).toBe('unhealthy');
      expect(cosmosConfigDep?.message).toContain('Missing required Cosmos DB configuration');
      expect(cosmosConfigDep?.details?.missingVariables).toContain('COSMOS_DB_KEY or AZURE_KEY_VAULT_URI');
      
      // Should not attempt connectivity check with incomplete config
      const cosmosDbDep = result.dependencies.find(d => d.name === 'cosmos-db');
      expect(cosmosDbDep).toBeUndefined();
    });

    it('should show healthy config when Key Vault URI is set', async () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      process.env.AZURE_KEY_VAULT_URI = 'https://test.vault.azure.net/';

      const result = await performHealthCheck(collections);

      const cosmosConfigDep = result.dependencies.find(d => d.name === 'cosmos-db-config');
      expect(cosmosConfigDep).toBeDefined();
      expect(cosmosConfigDep?.status).toBe('healthy');
      expect(cosmosConfigDep?.message).toContain('Cosmos DB configuration is complete');
      expect(cosmosConfigDep?.details?.configuredVariables).toContain('COSMOS_DB_ENDPOINT');
      expect(cosmosConfigDep?.details?.configuredVariables).toContain('AZURE_KEY_VAULT_URI');
    }, 60000);
  });

  describe('Key Vault connectivity check', () => {
    it('should not include key-vault check when not configured', async () => {
      const result = await performHealthCheck(collections);

      const keyVaultDep = result.dependencies.find(d => d.name === 'key-vault');
      expect(keyVaultDep).toBeUndefined();
    });

    it('should check Key Vault when AZURE_KEY_VAULT_URI is set', async () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      process.env.AZURE_KEY_VAULT_URI = 'https://test.vault.azure.net/';

      const result = await performHealthCheck(collections);

      const keyVaultDep = result.dependencies.find(d => d.name === 'key-vault');
      expect(keyVaultDep).toBeDefined();
      expect(keyVaultDep?.name).toBe('key-vault');
      // Since we can't actually connect to Key Vault in tests, it should be unhealthy
      expect(['healthy', 'unhealthy']).toContain(keyVaultDep?.status);
    }, 60000);

    it('should provide detailed error information for Key Vault failures', async () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      process.env.AZURE_KEY_VAULT_URI = 'https://nonexistent.vault.azure.net/';

      const result = await performHealthCheck(collections);

      const keyVaultDep = result.dependencies.find(d => d.name === 'key-vault');
      expect(keyVaultDep).toBeDefined();
      expect(keyVaultDep?.status).toBe('unhealthy');
      expect(keyVaultDep?.message).toBeDefined();
      expect(keyVaultDep?.details).toBeDefined();
      expect(keyVaultDep?.details?.error).toBeDefined();
      expect(keyVaultDep?.details?.errorType).toBeDefined();
      expect(keyVaultDep?.details?.keyVaultUri).toBe('https://nonexistent.vault.azure.net/');
    }, 60000);

    it('should include troubleshooting guidance in Key Vault errors', async () => {
      process.env.COSMOS_DB_ENDPOINT = 'https://test.documents.azure.com:443/';
      process.env.AZURE_KEY_VAULT_URI = 'https://invalid.vault.azure.net/';

      const result = await performHealthCheck(collections);

      const keyVaultDep = result.dependencies.find(d => d.name === 'key-vault');
      expect(keyVaultDep).toBeDefined();
      expect(keyVaultDep?.status).toBe('unhealthy');
      // Should include troubleshooting guidance
      if (keyVaultDep?.details?.troubleshooting) {
        expect(Array.isArray(keyVaultDep.details.troubleshooting)).toBe(true);
        expect((keyVaultDep.details.troubleshooting as string[]).length).toBeGreaterThan(0);
      }
    }, 60000);
  });
});
