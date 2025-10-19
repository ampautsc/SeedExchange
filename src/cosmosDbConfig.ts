import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

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
 * Get Cosmos DB configuration from Azure Key Vault or environment variables.
 * Prioritizes Key Vault for the Cosmos DB key, falls back to environment variables.
 * 
 * Configuration priority:
 * 1. Key Vault (if AZURE_KEY_VAULT_URI is set)
 * 2. Environment variables
 * 
 * Required environment variables:
 * - COSMOS_DB_ENDPOINT: Cosmos DB endpoint URL
 * - AZURE_KEY_VAULT_URI: Key Vault URI (optional, for secure key storage)
 * - COSMOS_DB_KEY_SECRET_NAME: Name of the secret in Key Vault (default: "CosmosDbKey")
 * - COSMOS_DB_KEY: Cosmos DB key (only used if Key Vault is not configured)
 */
export async function getCosmosDbConfig(): Promise<CosmosDbConfig> {
  const endpoint = process.env.COSMOS_DB_ENDPOINT;
  const databaseId = process.env.COSMOS_DB_DATABASE_ID || 'SeedExchange';
  const containerId = process.env.COSMOS_DB_CONTAINER_ID || 'SeedExchanges';
  const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
  const keySecretName = process.env.COSMOS_DB_KEY_SECRET_NAME || 'CosmosDbKey';

  if (!endpoint) {
    throw new Error(
      'Cosmos DB endpoint is missing. Please set COSMOS_DB_ENDPOINT environment variable.'
    );
  }

  let key: string | undefined;

  // Try to get key from Azure Key Vault first
  if (keyVaultUri) {
    try {
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(keyVaultUri, credential);
      const secret = await client.getSecret(keySecretName);
      key = secret.value;
      
      if (key) {
        console.log('✓ Retrieved Cosmos DB key from Azure Key Vault');
      }
    } catch (error) {
      console.warn('Failed to retrieve Cosmos DB key from Key Vault:', error instanceof Error ? error.message : error);
      console.log('Falling back to environment variable COSMOS_DB_KEY');
    }
  }

  // Fall back to environment variable if Key Vault didn't work
  if (!key) {
    key = process.env.COSMOS_DB_KEY;
  }

  if (!key) {
    throw new Error(
      'Cosmos DB key is missing. Please either:\n' +
      '1. Set AZURE_KEY_VAULT_URI and store the key in Key Vault as "CosmosDbKey" (recommended), or\n' +
      '2. Set COSMOS_DB_KEY environment variable (not recommended for production)'
    );
  }

  return {
    endpoint,
    key,
    databaseId,
    containerId
  };
}
