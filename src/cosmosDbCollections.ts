import { CosmosClient, Container } from '@azure/cosmos';
import { SeedExchange } from './types';
import { ISeedExchangeCollections } from './ISeedExchangeCollections';
import { CosmosDbConfig } from './cosmosDbConfig';

/**
 * Cosmos DB document that extends SeedExchange with Cosmos DB specific fields
 */
interface SeedExchangeDocument extends SeedExchange {
  _ts?: number; // Cosmos DB timestamp
}

/**
 * Cosmos DB implementation of seed exchange collections
 */
export class CosmosDbSeedExchangeCollections implements ISeedExchangeCollections {
  private container: Container;

  /**
   * Initialize the Cosmos DB collections
   * @param config - Cosmos DB configuration
   */
  constructor(config: CosmosDbConfig) {
    const client = new CosmosClient({
      endpoint: config.endpoint,
      key: config.key
    });

    this.container = client
      .database(config.databaseId)
      .container(config.containerId);
  }

  /**
   * Initialize database and container if they don't exist
   * @param config - Cosmos DB configuration
   */
  static async initialize(config: CosmosDbConfig): Promise<CosmosDbSeedExchangeCollections> {
    const client = new CosmosClient({
      endpoint: config.endpoint,
      key: config.key
    });

    // Create database if it doesn't exist
    const { database } = await client.databases.createIfNotExists({
      id: config.databaseId
    });

    // Create container with partition key on plantId for efficient querying
    await database.containers.createIfNotExists({
      id: config.containerId,
      partitionKey: {
        paths: ['/plantId'],
        version: 2
      },
      indexingPolicy: {
        automatic: true,
        indexingMode: 'consistent',
        includedPaths: [
          { path: '/*' }
        ]
      }
    });

    return new CosmosDbSeedExchangeCollections(config);
  }

  /**
   * Convert Date objects to ISO strings for Cosmos DB storage
   */
  private serializeExchange(exchange: SeedExchange): SeedExchangeDocument {
    return {
      ...exchange,
      seedRequestTime: exchange.seedRequestTime ? exchange.seedRequestTime : null,
      seedOfferTime: exchange.seedOfferTime ? exchange.seedOfferTime : null,
      confirmationTime: exchange.confirmationTime ? exchange.confirmationTime : null,
      shipTime: exchange.shipTime ? exchange.shipTime : null,
      receivedTime: exchange.receivedTime ? exchange.receivedTime : null
    };
  }

  /**
   * Convert ISO strings back to Date objects from Cosmos DB
   */
  private deserializeExchange(doc: SeedExchangeDocument): SeedExchange {
    return {
      id: doc.id,
      plantId: doc.plantId,
      requestUserId: doc.requestUserId,
      offerUserId: doc.offerUserId,
      quantity: doc.quantity,
      seedRequestTime: doc.seedRequestTime ? new Date(doc.seedRequestTime) : null,
      seedOfferTime: doc.seedOfferTime ? new Date(doc.seedOfferTime) : null,
      confirmationTime: doc.confirmationTime ? new Date(doc.confirmationTime) : null,
      shipTime: doc.shipTime ? new Date(doc.shipTime) : null,
      receivedTime: doc.receivedTime ? new Date(doc.receivedTime) : null
    };
  }

  /**
   * Get all open seed requests for a specific plant
   */
  async getOpenRequestsByPlant(plantId: string): Promise<SeedExchange[]> {
    const querySpec = {
      query: `SELECT * FROM c 
              WHERE c.plantId = @plantId 
              AND c.requestUserId != null 
              AND c.offerUserId = null
              ORDER BY c.seedRequestTime ASC`,
      parameters: [
        { name: '@plantId', value: plantId }
      ]
    };

    const { resources } = await this.container.items.query<SeedExchangeDocument>(querySpec).fetchAll();
    return resources.map(doc => this.deserializeExchange(doc));
  }

  /**
   * Get all open seed offers for a specific plant
   */
  async getOpenOffersByPlant(plantId: string): Promise<SeedExchange[]> {
    const querySpec = {
      query: `SELECT * FROM c 
              WHERE c.plantId = @plantId 
              AND c.offerUserId != null 
              AND c.requestUserId = null
              ORDER BY c.seedOfferTime ASC`,
      parameters: [
        { name: '@plantId', value: plantId }
      ]
    };

    const { resources } = await this.container.items.query<SeedExchangeDocument>(querySpec).fetchAll();
    return resources.map(doc => this.deserializeExchange(doc));
  }

  /**
   * Get all confirmed exchanges
   */
  async getConfirmedExchanges(): Promise<SeedExchange[]> {
    const querySpec = {
      query: `SELECT * FROM c 
              WHERE c.requestUserId != null 
              AND c.offerUserId != null`
    };

    const { resources } = await this.container.items.query<SeedExchangeDocument>(querySpec).fetchAll();
    return resources.map(doc => this.deserializeExchange(doc));
  }

  /**
   * Get all exchanges for a specific user
   */
  async getExchangesByUser(userId: string): Promise<SeedExchange[]> {
    const querySpec = {
      query: `SELECT * FROM c 
              WHERE c.requestUserId = @userId 
              OR c.offerUserId = @userId`,
      parameters: [
        { name: '@userId', value: userId }
      ]
    };

    const { resources } = await this.container.items.query<SeedExchangeDocument>(querySpec).fetchAll();
    return resources.map(doc => this.deserializeExchange(doc));
  }

  /**
   * Add a new seed exchange entry
   */
  async addExchange(exchange: SeedExchange): Promise<void> {
    const doc = this.serializeExchange(exchange);
    await this.container.items.create(doc);
  }

  /**
   * Get a seed exchange by ID
   */
  async getExchange(id: string): Promise<SeedExchange | undefined> {
    try {
      // We need to query since we don't have the partition key readily available
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [
          { name: '@id', value: id }
        ]
      };

      const { resources } = await this.container.items.query<SeedExchangeDocument>(querySpec).fetchAll();
      
      if (resources.length === 0) {
        return undefined;
      }

      return this.deserializeExchange(resources[0]);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Remove a seed exchange entry
   */
  async removeExchange(id: string): Promise<void> {
    // First get the document to obtain the partition key
    const exchange = await this.getExchange(id);
    if (exchange) {
      await this.container.item(id, exchange.plantId).delete();
    }
  }

  /**
   * Update a seed exchange entry
   */
  async updateExchange(exchange: SeedExchange): Promise<void> {
    const doc = this.serializeExchange(exchange);
    await this.container.item(exchange.id, exchange.plantId).replace(doc);
  }

  /**
   * Get all seed exchanges
   */
  async getAllExchanges(): Promise<SeedExchange[]> {
    const querySpec = {
      query: 'SELECT * FROM c'
    };

    const { resources } = await this.container.items.query<SeedExchangeDocument>(querySpec).fetchAll();
    return resources.map(doc => this.deserializeExchange(doc));
  }

  /**
   * Clear all collections (useful for testing)
   */
  async clear(): Promise<void> {
    const exchanges = await this.getAllExchanges();
    
    // Delete all items
    const deletePromises = exchanges.map(exchange =>
      this.container.item(exchange.id, exchange.plantId).delete()
    );
    
    await Promise.all(deletePromises);
  }
}
