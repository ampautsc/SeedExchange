import { SeedExchange } from './types';

/**
 * Interface for seed exchange collections storage
 */
export interface ISeedExchangeCollections {
  /**
   * Get all open seed requests for a specific plant
   */
  getOpenRequestsByPlant(plantId: string): Promise<SeedExchange[]>;

  /**
   * Get all open seed offers for a specific plant
   */
  getOpenOffersByPlant(plantId: string): Promise<SeedExchange[]>;

  /**
   * Get all confirmed exchanges
   */
  getConfirmedExchanges(): Promise<SeedExchange[]>;

  /**
   * Get all exchanges for a specific user
   */
  getExchangesByUser(userId: string): Promise<SeedExchange[]>;

  /**
   * Add a new seed exchange entry
   */
  addExchange(exchange: SeedExchange): Promise<void>;

  /**
   * Get a seed exchange by ID
   */
  getExchange(id: string): Promise<SeedExchange | undefined>;

  /**
   * Remove a seed exchange entry
   */
  removeExchange(id: string): Promise<void>;

  /**
   * Update a seed exchange entry
   */
  updateExchange(exchange: SeedExchange): Promise<void>;

  /**
   * Get all seed exchanges
   */
  getAllExchanges(): Promise<SeedExchange[]>;

  /**
   * Clear all collections (useful for testing)
   */
  clear(): Promise<void>;
}
