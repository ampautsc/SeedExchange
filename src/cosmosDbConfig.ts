/**
 * Configuration for Azure Cosmos DB connection
 */
export interface CosmosDbConfig {
  endpoint: string;
  key: string;
  databaseId: string;
  containerId: string;
}

/**
 * Get Cosmos DB configuration from environment variables
 */
export function getCosmosDbConfig(): CosmosDbConfig {
  const endpoint = process.env.COSMOS_DB_ENDPOINT;
  const key = process.env.COSMOS_DB_KEY;
  const databaseId = process.env.COSMOS_DB_DATABASE_ID || 'SeedExchange';
  const containerId = process.env.COSMOS_DB_CONTAINER_ID || 'SeedExchanges';

  if (!endpoint || !key) {
    throw new Error(
      'Cosmos DB configuration is missing. Please set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY environment variables.'
    );
  }

  return {
    endpoint,
    key,
    databaseId,
    containerId
  };
}
