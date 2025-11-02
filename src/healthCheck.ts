import { ISeedExchangeCollections } from './ISeedExchangeCollections';
import { initializeCollections } from './collectionsFactory';
import { v4 as uuidv4 } from 'uuid';
import { SeedExchange } from './types';
import { CosmosClient } from '@azure/cosmos';
import { getCosmosDbConfig } from './cosmosDbConfig';

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
    return {
      name: 'cosmos-db',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Failed to connect to Cosmos DB',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.stack : String(error)
      }
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
    
    // Check Cosmos DB connectivity if using Cosmos DB
    const hasCosmosEndpoint = !!process.env.COSMOS_DB_ENDPOINT;
    const hasKeyVault = !!process.env.AZURE_KEY_VAULT_URI;
    const hasEnvKey = !!process.env.COSMOS_DB_KEY;
    const hasCosmosConfig = hasCosmosEndpoint && (hasKeyVault || hasEnvKey);
    
    if (hasCosmosConfig) {
      const cosmosDbHealth = await checkCosmosDbConnectivity();
      dependencies.push(cosmosDbHealth);
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
