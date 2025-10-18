import { SeedExchange } from './types';
import { ISeedExchangeCollections } from './ISeedExchangeCollections';

/**
 * In-memory collection for managing seed exchange data
 */
export class SeedExchangeCollections implements ISeedExchangeCollections {
  private seedExchanges: Map<string, SeedExchange> = new Map();

  /**
   * Get all open seed requests for a specific plant
   * (entries where requestUserId is set but offerUserId is null)
   */
  async getOpenRequestsByPlant(plantId: string): Promise<SeedExchange[]> {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.plantId === plantId && ex.requestUserId !== null && ex.offerUserId === null)
      .sort((a, b) => (a.seedRequestTime?.getTime() || 0) - (b.seedRequestTime?.getTime() || 0));
  }

  /**
   * Get all open seed offers for a specific plant
   * (entries where offerUserId is set but requestUserId is null)
   */
  async getOpenOffersByPlant(plantId: string): Promise<SeedExchange[]> {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.plantId === plantId && ex.offerUserId !== null && ex.requestUserId === null)
      .sort((a, b) => (a.seedOfferTime?.getTime() || 0) - (b.seedOfferTime?.getTime() || 0));
  }

  /**
   * Get all confirmed exchanges (both requestUserId and offerUserId are set)
   */
  async getConfirmedExchanges(): Promise<SeedExchange[]> {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.requestUserId !== null && ex.offerUserId !== null);
  }

  /**
   * Get all exchanges for a specific user (as requester or offerer)
   */
  async getExchangesByUser(userId: string): Promise<SeedExchange[]> {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.requestUserId === userId || ex.offerUserId === userId);
  }

  /**
   * Add a new seed exchange entry
   */
  async addExchange(exchange: SeedExchange): Promise<void> {
    this.seedExchanges.set(exchange.id, exchange);
  }

  /**
   * Get a seed exchange by ID
   */
  async getExchange(id: string): Promise<SeedExchange | undefined> {
    return this.seedExchanges.get(id);
  }

  /**
   * Remove a seed exchange entry
   */
  async removeExchange(id: string): Promise<void> {
    this.seedExchanges.delete(id);
  }

  /**
   * Update a seed exchange entry
   */
  async updateExchange(exchange: SeedExchange): Promise<void> {
    this.seedExchanges.set(exchange.id, exchange);
  }

  /**
   * Get all seed exchanges
   */
  async getAllExchanges(): Promise<SeedExchange[]> {
    return Array.from(this.seedExchanges.values());
  }

  /**
   * Clear all collections (useful for testing)
   */
  async clear(): Promise<void> {
    this.seedExchanges.clear();
  }
}

// Singleton instance
export const collections = new SeedExchangeCollections();
