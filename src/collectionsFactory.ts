import { ISeedExchangeCollections } from './ISeedExchangeCollections';
import { SeedExchangeCollections } from './collections';
import { CosmosDbSeedExchangeCollections } from './cosmosDbCollections';
import { getCosmosDbConfig } from './cosmosDbConfig';

/**
 * Initialize collections based on environment configuration.
 * If COSMOS_DB_ENDPOINT and COSMOS_DB_KEY are set, uses Cosmos DB.
 * Otherwise, falls back to in-memory collections.
 */
export async function initializeCollections(): Promise<ISeedExchangeCollections> {
  const hasCosmosConfig = process.env.COSMOS_DB_ENDPOINT && process.env.COSMOS_DB_KEY;
  
  if (hasCosmosConfig) {
    try {
      console.log('Initializing Cosmos DB collections...');
      const config = getCosmosDbConfig();
      const collections = await CosmosDbSeedExchangeCollections.initialize(config);
      console.log('✓ Cosmos DB collections initialized successfully');
      return collections;
    } catch (error) {
      console.error('Failed to initialize Cosmos DB collections:', error);
      console.log('Falling back to in-memory collections');
      return new SeedExchangeCollections();
    }
  } else {
    console.log('Using in-memory collections (set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY to use Cosmos DB)');
    return new SeedExchangeCollections();
  }
}

/**
 * Get a synchronous in-memory collections instance.
 * For production use, prefer initializeCollections() which supports Cosmos DB.
 */
export function getInMemoryCollections(): ISeedExchangeCollections {
  return new SeedExchangeCollections();
}
