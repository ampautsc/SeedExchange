import { SeedExchange } from './types';

/**
 * In-memory collection for managing seed exchange data
 */
export class SeedExchangeCollections {
  private seedExchanges: Map<string, SeedExchange> = new Map();

  /**
   * Get all open seed requests for a specific plant
   * (entries where requestUserId is set but offerUserId is null)
   */
  getOpenRequestsByPlant(plantId: string): SeedExchange[] {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.plantId === plantId && ex.requestUserId !== null && ex.offerUserId === null)
      .sort((a, b) => (a.seedRequestTime?.getTime() || 0) - (b.seedRequestTime?.getTime() || 0));
  }

  /**
   * Get all open seed offers for a specific plant
   * (entries where offerUserId is set but requestUserId is null)
   */
  getOpenOffersByPlant(plantId: string): SeedExchange[] {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.plantId === plantId && ex.offerUserId !== null && ex.requestUserId === null)
      .sort((a, b) => (a.seedOfferTime?.getTime() || 0) - (b.seedOfferTime?.getTime() || 0));
  }

  /**
   * Get all confirmed exchanges (both requestUserId and offerUserId are set)
   */
  getConfirmedExchanges(): SeedExchange[] {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.requestUserId !== null && ex.offerUserId !== null);
  }

  /**
   * Get all exchanges for a specific user (as requester or offerer)
   */
  getExchangesByUser(userId: string): SeedExchange[] {
    return Array.from(this.seedExchanges.values())
      .filter(ex => ex.requestUserId === userId || ex.offerUserId === userId);
  }

  /**
   * Add a new seed exchange entry
   */
  addExchange(exchange: SeedExchange): void {
    this.seedExchanges.set(exchange.id, exchange);
  }

  /**
   * Get a seed exchange by ID
   */
  getExchange(id: string): SeedExchange | undefined {
    return this.seedExchanges.get(id);
  }

  /**
   * Remove a seed exchange entry
   */
  removeExchange(id: string): void {
    this.seedExchanges.delete(id);
  }

  /**
   * Update a seed exchange entry
   */
  updateExchange(exchange: SeedExchange): void {
    this.seedExchanges.set(exchange.id, exchange);
  }

  /**
   * Get all seed exchanges
   */
  getAllExchanges(): SeedExchange[] {
    return Array.from(this.seedExchanges.values());
  }

  /**
   * Clear all collections (useful for testing)
   */
  clear(): void {
    this.seedExchanges.clear();
  }
}

// Singleton instance
export const collections = new SeedExchangeCollections();
