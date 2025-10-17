import { OpenSeedRequest, OpenSeedOffer, SeedFill } from './types';

/**
 * In-memory collections for managing seed exchange data
 */
export class SeedExchangeCollections {
  private openSeedRequests: Map<string, OpenSeedRequest> = new Map();
  private openSeedOffers: Map<string, OpenSeedOffer> = new Map();
  private seedFills: Map<string, SeedFill> = new Map();

  /**
   * Get all open seed requests for a specific plant
   */
  getOpenRequestsByPlant(plantId: string): OpenSeedRequest[] {
    return Array.from(this.openSeedRequests.values())
      .filter(req => req.plantId === plantId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get all open seed offers for a specific plant
   */
  getOpenOffersByPlant(plantId: string): OpenSeedOffer[] {
    return Array.from(this.openSeedOffers.values())
      .filter(offer => offer.plantId === plantId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Add a new open seed request
   */
  addOpenRequest(request: OpenSeedRequest): void {
    this.openSeedRequests.set(request.id, request);
  }

  /**
   * Add a new open seed offer
   */
  addOpenOffer(offer: OpenSeedOffer): void {
    this.openSeedOffers.set(offer.id, offer);
  }

  /**
   * Remove an open seed request
   */
  removeOpenRequest(id: string): void {
    this.openSeedRequests.delete(id);
  }

  /**
   * Remove an open seed offer
   */
  removeOpenOffer(id: string): void {
    this.openSeedOffers.delete(id);
  }

  /**
   * Update an open seed request
   */
  updateOpenRequest(request: OpenSeedRequest): void {
    this.openSeedRequests.set(request.id, request);
  }

  /**
   * Update an open seed offer
   */
  updateOpenOffer(offer: OpenSeedOffer): void {
    this.openSeedOffers.set(offer.id, offer);
  }

  /**
   * Add a seed fill record
   */
  addSeedFill(fill: SeedFill): void {
    this.seedFills.set(fill.id, fill);
  }

  /**
   * Get all seed fills
   */
  getAllFills(): SeedFill[] {
    return Array.from(this.seedFills.values());
  }

  /**
   * Clear all collections (useful for testing)
   */
  clear(): void {
    this.openSeedRequests.clear();
    this.openSeedOffers.clear();
    this.seedFills.clear();
  }
}

// Singleton instance
export const collections = new SeedExchangeCollections();
