import { ISeedExchangeCollections } from './ISeedExchangeCollections';
import { initializeCollections } from './collectionsFactory';
import { v4 as uuidv4 } from 'uuid';
import { SeedExchange } from './types';
import { CosmosClient } from '@azure/cosmos';
import { getCosmosDbConfig } from './cosmosDbConfig';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Status of a health check component
 */
export type HealthStatus = 'healthy' | 'unhealthy' | 'degraded';

/**
 * Details about a specific dependency check
 */
export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  message: string;
  responseTime?: number;
  details?: Record<string, unknown>;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  dependencies: DependencyHealth[];
  version?: string;
}

/**
 * Constants for the Cosmos DB readme document location
 * The readme is stored in a separate collection from the seed exchanges data
 */
const README_DATABASE = 'SeedExchange';
const README_COLLECTION = 'SeedExchange';
const README_ITEM_ID = 'readme';
const README_PARTITION_KEY = 'readme';

/**
 * Check Cosmos DB configuration to ensure required environment variables are set
 */
function checkCosmosDbConfiguration(): DependencyHealth {
  const startTime = Date.now();
  
  const hasEndpoint = !!process.env.COSMOS_DB_ENDPOINT;
  const hasKeyVault = !!process.env.AZURE_KEY_VAULT_URI;
  const hasEnvKey = !!process.env.COSMOS_DB_KEY;
  
  const missingVars: string[] = [];
  const configuredVars: string[] = [];
  
  if (!hasEndpoint) {
    missingVars.push('COSMOS_DB_ENDPOINT');
  } else {
    configuredVars.push('COSMOS_DB_ENDPOINT');
  }
  
  // Need either Key Vault or environment key
  if (!hasKeyVault && !hasEnvKey) {
    missingVars.push('COSMOS_DB_KEY or AZURE_KEY_VAULT_URI');
  } else {
    if (hasKeyVault) {
      configuredVars.push('AZURE_KEY_VAULT_URI');
    }
    if (hasEnvKey) {
      configuredVars.push('COSMOS_DB_KEY');
    }
  }
  
  const responseTime = Date.now() - startTime;
  
  if (missingVars.length > 0) {
    return {
      name: 'cosmos-db-config',
      status: 'unhealthy',
      message: `Missing required Cosmos DB configuration: ${missingVars.join(', ')}`,
      responseTime,
      details: {
        missingVariables: missingVars,
        configuredVariables: configuredVars,
        required: ['COSMOS_DB_ENDPOINT', 'COSMOS_DB_KEY or AZURE_KEY_VAULT_URI']
      }
    };
  }
  
  return {
    name: 'cosmos-db-config',
    status: 'healthy',
    message: 'Cosmos DB configuration is complete',
    responseTime,
    details: {
      configuredVariables: configuredVars,
      endpoint: process.env.COSMOS_DB_ENDPOINT
    }
  };
}

/**
 * Check Azure Key Vault connectivity and ability to retrieve secrets
 */
async function checkKeyVaultConnectivity(): Promise<DependencyHealth> {
  const startTime = Date.now();
  const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
  const keySecretName = process.env.COSMOS_DB_KEY_SECRET_NAME || 'CosmosDbKey';
  
  if (!keyVaultUri) {
    // Key Vault is not configured - this is okay, as COSMOS_DB_KEY can be used instead
    return {
      name: 'key-vault',
      status: 'healthy',
      message: 'Key Vault not configured (using environment variable for Cosmos DB key)',
      responseTime: Date.now() - startTime,
      details: {
        configured: false,
        reason: 'AZURE_KEY_VAULT_URI not set'
      }
    };
  }
  
  try {
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(keyVaultUri, credential);
    
    // Try to retrieve the Cosmos DB key secret
    const secret = await client.getSecret(keySecretName);
    
    const responseTime = Date.now() - startTime;
    
    if (secret.value) {
      return {
        name: 'key-vault',
        status: 'healthy',
        message: 'Successfully retrieved secret from Key Vault',
        responseTime,
        details: {
          configured: true,
          keyVaultUri: keyVaultUri,
          secretName: keySecretName,
          secretRetrieved: true,
          secretProperties: {
            enabled: secret.properties.enabled,
            expiresOn: secret.properties.expiresOn?.toISOString(),
            notBefore: secret.properties.notBefore?.toISOString(),
            updatedOn: secret.properties.updatedOn?.toISOString()
          }
        }
      };
    } else {
      return {
        name: 'key-vault',
        status: 'unhealthy',
        message: 'Key Vault secret exists but has no value',
        responseTime,
        details: {
          configured: true,
          keyVaultUri: keyVaultUri,
          secretName: keySecretName,
          secretRetrieved: false,
          error: 'Secret value is empty or null'
        }
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Provide detailed error information
    let detailedMessage = 'Failed to connect to Key Vault';
    const errorDetails: Record<string, unknown> = {
      configured: true,
      keyVaultUri: keyVaultUri,
      secretName: keySecretName,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    };
    
    // Only include stack trace in development environments
    if (errorStack && process.env.NODE_ENV !== 'production') {
      errorDetails.errorStack = errorStack;
    }
    
    // Add specific troubleshooting guidance based on error type
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      detailedMessage = 'Failed to connect to Key Vault - DNS resolution failed';
      errorDetails.troubleshooting = [
        'Verify AZURE_KEY_VAULT_URI is correct',
        'Check network connectivity to Azure',
        'Ensure Key Vault exists and is accessible'
      ];
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      detailedMessage = 'Failed to connect to Key Vault - Access denied';
      errorDetails.troubleshooting = [
        'Verify managed identity has "Get" permission on secrets',
        'Check that SeedExchangeServiceIdentity is properly configured',
        'Ensure Key Vault access policies are set correctly'
      ];
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      detailedMessage = 'Failed to connect to Key Vault - Authentication failed';
      errorDetails.troubleshooting = [
        'Verify DefaultAzureCredential is properly configured',
        'In development: Run "az login" to authenticate',
        'In production: Verify managed identity is assigned'
      ];
    } else if (errorMessage.includes('SecretNotFound') || errorMessage.includes('not found')) {
      detailedMessage = `Failed to retrieve secret "${keySecretName}" from Key Vault`;
      errorDetails.troubleshooting = [
        `Verify secret "${keySecretName}" exists in Key Vault`,
        'Check secret name spelling and case sensitivity',
        'Ensure secret is not disabled or expired'
      ];
    }
    
    return {
      name: 'key-vault',
      status: 'unhealthy',
      message: detailedMessage,
      responseTime,
      details: errorDetails
    };
  }
}

/**
 * Check Cosmos DB connectivity by retrieving the readme document
 * Database: SeedExchange, Collection: SeedExchange, Item: readme
 */
async function checkCosmosDbConnectivity(): Promise<DependencyHealth> {
  const startTime = Date.now();
  
  try {
    const config = await getCosmosDbConfig();
    const client = new CosmosClient({
      endpoint: config.endpoint,
      key: config.key
    });

    // Try to retrieve the readme document from the SeedExchange collection
    const database = client.database(README_DATABASE);
    const container = database.container(README_COLLECTION);
    
    // Attempt to read the readme item (using partition key for efficient read)
    const { resource } = await container.item(README_ITEM_ID, README_PARTITION_KEY).read();
    
    const responseTime = Date.now() - startTime;
    
    if (resource) {
      return {
        name: 'cosmos-db',
        status: 'healthy',
        message: 'Cosmos DB connectivity confirmed - readme retrieved successfully',
        responseTime,
        details: {
          database: README_DATABASE,
          collection: README_COLLECTION,
          itemId: README_ITEM_ID
        }
      };
    } else {
      return {
        name: 'cosmos-db',
        status: 'degraded',
        message: 'Connected to Cosmos DB but readme document not found',
        responseTime,
        details: {
          database: README_DATABASE,
          collection: README_COLLECTION,
          itemId: README_ITEM_ID
        }
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Provide detailed error information
    let detailedMessage = 'Failed to connect to Cosmos DB';
    const errorDetails: Record<string, unknown> = {
      database: README_DATABASE,
      collection: README_COLLECTION,
      itemId: README_ITEM_ID,
      endpoint: process.env.COSMOS_DB_ENDPOINT,
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    };
    
    // Only include stack trace in development environments
    if (errorStack && process.env.NODE_ENV !== 'production') {
      errorDetails.errorStack = errorStack;
    }
    
    // Add specific troubleshooting guidance based on error type
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      detailedMessage = 'Failed to connect to Cosmos DB - DNS resolution failed';
      errorDetails.troubleshooting = [
        'Verify COSMOS_DB_ENDPOINT is correct',
        'Check network connectivity to Azure',
        'Ensure Cosmos DB account exists and is accessible'
      ];
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      detailedMessage = 'Failed to connect to Cosmos DB - Access denied';
      errorDetails.troubleshooting = [
        'Verify Cosmos DB key is correct',
        'Check that the account has not been deleted or moved',
        'Ensure IP address is allowed in Cosmos DB firewall rules'
      ];
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      detailedMessage = 'Failed to connect to Cosmos DB - Authentication failed';
      errorDetails.troubleshooting = [
        'Verify COSMOS_DB_KEY is correct and not expired',
        'Check that Key Vault secret contains valid Cosmos DB key',
        'Regenerate Cosmos DB key if necessary'
      ];
    } else if (errorMessage.includes('NotFound') || errorMessage.includes('ResourceNotFound')) {
      detailedMessage = 'Failed to connect to Cosmos DB - Database or container not found';
      errorDetails.troubleshooting = [
        `Verify database "${README_DATABASE}" exists`,
        `Verify container "${README_COLLECTION}" exists`,
        'Check Cosmos DB account configuration'
      ];
    } else if (errorMessage.includes('TooManyRequests') || errorMessage.includes('429')) {
      detailedMessage = 'Failed to connect to Cosmos DB - Rate limit exceeded';
      errorDetails.troubleshooting = [
        'Cosmos DB is throttling requests',
        'Check RU/s allocation for the database',
        'Consider increasing provisioned throughput'
      ];
    }
    
    return {
      name: 'cosmos-db',
      status: 'unhealthy',
      message: detailedMessage,
      responseTime,
      details: errorDetails
    };
  }
}

/**
 * Check the health of the storage backend (CosmosDB or in-memory)
 */
async function checkStorageHealth(collections: ISeedExchangeCollections): Promise<DependencyHealth> {
  const startTime = Date.now();
  
  try {
    // Create a test exchange to verify write capability
    const testExchange: SeedExchange = {
      id: `health-check-${uuidv4()}`,
      plantId: 'health-check-plant',
      requestUserId: 'health-check-user',
      offerUserId: null,
      quantity: 1,
      seedRequestTime: new Date(),
      seedOfferTime: null,
      confirmationTime: null,
      shipTime: null,
      receivedTime: null
    };

    // Test write operation
    await collections.addExchange(testExchange);
    
    // Test read operation
    const retrieved = await collections.getExchange(testExchange.id);
    
    if (!retrieved) {
      return {
        name: 'storage',
        status: 'unhealthy',
        message: 'Failed to retrieve test data after write',
        responseTime: Date.now() - startTime
      };
    }
    
    // Verify data integrity
    if (retrieved.id !== testExchange.id || retrieved.plantId !== testExchange.plantId) {
      return {
        name: 'storage',
        status: 'unhealthy',
        message: 'Data integrity check failed',
        responseTime: Date.now() - startTime
      };
    }
    
    // Test query operation
    const openRequests = await collections.getOpenRequestsByPlant('health-check-plant');
    if (!openRequests.some(ex => ex.id === testExchange.id)) {
      return {
        name: 'storage',
        status: 'degraded',
        message: 'Query operation returned unexpected results',
        responseTime: Date.now() - startTime
      };
    }
    
    // Clean up test data
    await collections.removeExchange(testExchange.id);
    
    // Verify cleanup
    const afterDelete = await collections.getExchange(testExchange.id);
    if (afterDelete !== undefined) {
      return {
        name: 'storage',
        status: 'degraded',
        message: 'Delete operation did not remove test data',
        responseTime: Date.now() - startTime
      };
    }
    
    const responseTime = Date.now() - startTime;
    const storageType = process.env.COSMOS_DB_ENDPOINT ? 'CosmosDB' : 'In-Memory';
    
    return {
      name: 'storage',
      status: 'healthy',
      message: `${storageType} storage is functioning correctly`,
      responseTime,
      details: {
        storageType,
        operationsVerified: ['create', 'read', 'query', 'delete']
      }
    };
    
  } catch (error) {
    return {
      name: 'storage',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error during health check',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.stack : String(error)
      }
    };
  }
}

/**
 * Perform a comprehensive health check of the service and its dependencies
 * 
 * @param collections - Optional pre-initialized collections. If not provided, will initialize automatically.
 * @returns Health check result with overall status and dependency details
 */
export async function performHealthCheck(
  collections?: ISeedExchangeCollections
): Promise<HealthCheckResult> {
  const timestamp = new Date();
  const dependencies: DependencyHealth[] = [];
  
  try {
    // Initialize collections if not provided
    const collectionsToUse = collections || await initializeCollections();
    
    // Check Cosmos DB configuration
    const hasCosmosEndpoint = !!process.env.COSMOS_DB_ENDPOINT;
    const hasKeyVault = !!process.env.AZURE_KEY_VAULT_URI;
    const hasEnvKey = !!process.env.COSMOS_DB_KEY;
    const hasAnyCosmosVar = hasCosmosEndpoint || hasKeyVault || hasEnvKey;
    const hasCosmosConfig = hasCosmosEndpoint && (hasKeyVault || hasEnvKey);
    
    // Check Cosmos DB configuration if any Cosmos DB variables are set
    // This validates that all required variables are present when Cosmos DB is being used
    if (hasAnyCosmosVar) {
      const configHealth = checkCosmosDbConfiguration();
      dependencies.push(configHealth);
      
      // Check Key Vault connectivity if it's configured
      // Key Vault is checked separately as it's a distinct dependency
      if (hasKeyVault) {
        const keyVaultHealth = await checkKeyVaultConnectivity();
        dependencies.push(keyVaultHealth);
      }
      
      // Only check Cosmos DB connectivity if configuration is complete
      if (hasCosmosConfig) {
        const cosmosDbHealth = await checkCosmosDbConnectivity();
        dependencies.push(cosmosDbHealth);
      }
    }
    
    // Check storage health
    const storageHealth = await checkStorageHealth(collectionsToUse);
    dependencies.push(storageHealth);
    
    // Determine overall status based on all dependencies
    const overallStatus = determineOverallStatus(dependencies);
    
    return {
      status: overallStatus,
      timestamp,
      dependencies,
      version: process.env.npm_package_version || '1.0.0'
    };
    
  } catch (error) {
    // If we can't even initialize, the service is unhealthy
    dependencies.push({
      name: 'initialization',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Failed to initialize service'
    });
    
    return {
      status: 'unhealthy',
      timestamp,
      dependencies
    };
  }
}

/**
 * Determine overall health status based on individual dependency statuses
 */
function determineOverallStatus(dependencies: DependencyHealth[]): HealthStatus {
  if (dependencies.some(dep => dep.status === 'unhealthy')) {
    return 'unhealthy';
  }
  if (dependencies.some(dep => dep.status === 'degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

/**
 * Format health check result as a human-readable string
 */
export function formatHealthCheckResult(result: HealthCheckResult): string {
  const statusEmoji = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌'
  };
  
  const lines = [
    `${statusEmoji[result.status]} Overall Status: ${result.status.toUpperCase()}`,
    `Timestamp: ${result.timestamp.toISOString()}`,
    `Version: ${result.version || 'unknown'}`,
    '',
    'Dependencies:'
  ];
  
  for (const dep of result.dependencies) {
    lines.push(`  ${statusEmoji[dep.status]} ${dep.name}: ${dep.status}`);
    lines.push(`     Message: ${dep.message}`);
    if (dep.responseTime !== undefined) {
      lines.push(`     Response Time: ${dep.responseTime}ms`);
    }
    if (dep.details) {
      lines.push(`     Details: ${JSON.stringify(dep.details, null, 2)}`);
    }
  }
  
  return lines.join('\n');
}
