/**
 * Represents an Azure user authentication token
 */
export interface AzureUserToken {
  userId: string;
  email?: string;
  name?: string;
}

/**
 * Represents a seed exchange entry that tracks the lifecycle of a seed exchange.
 * An entry can be:
 * - An open request (requestUserId set, offerUserId null)
 * - An open offer (offerUserId set, requestUserId null)
 * - A matched/confirmed exchange (both requestUserId and offerUserId set)
 */
export interface SeedExchange {
  id: string;
  plantId: string;
  requestUserId: string | null;
  offerUserId: string | null;
  quantity: number;
  seedRequestTime: Date | null;
  seedOfferTime: Date | null;
  confirmationTime: Date | null;
  shipTime: Date | null;
  receivedTime: Date | null;
}

/**
 * Result of submitting a seed offer
 */
export interface SubmitSeedOfferResult {
  filledExchanges: SeedExchange[];
  remainingOffer?: SeedExchange;
}

/**
 * Result of submitting a seed request
 */
export interface SubmitSeedRequestResult {
  filled: boolean;
  exchange?: SeedExchange;
  remainingRequest?: SeedExchange;
}

/**
 * Result of withdrawing an open request or offer
 */
export interface WithdrawResult {
  success: boolean;
  withdrawnExchange?: SeedExchange;
}
