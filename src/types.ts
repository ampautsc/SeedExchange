/**
 * Represents an Azure user authentication token
 */
export interface AzureUserToken {
  userId: string;
  email?: string;
  name?: string;
}

/**
 * Represents an open seed request
 */
export interface OpenSeedRequest {
  id: string;
  plantId: string;
  userId: string;
  quantity: number; // Always 1 packet per request
  timestamp: Date;
}

/**
 * Represents an open seed offer
 */
export interface OpenSeedOffer {
  id: string;
  plantId: string;
  userId: string;
  quantity: number; // Number of packets available
  timestamp: Date;
}

/**
 * Represents a completed seed fill (match between offer and request)
 */
export interface SeedFill {
  id: string;
  plantId: string;
  offerUserId: string;
  requestUserId: string;
  quantity: number;
  timestamp: Date;
}

/**
 * Result of submitting a seed offer
 */
export interface SubmitSeedOfferResult {
  filledRequests: SeedFill[];
  remainingOffer?: OpenSeedOffer;
}

/**
 * Result of submitting a seed request
 */
export interface SubmitSeedRequestResult {
  filled: boolean;
  fill?: SeedFill;
  remainingRequest?: OpenSeedRequest;
}
