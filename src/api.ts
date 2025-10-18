import { v4 as uuidv4 } from 'uuid';
import { AzureUserToken, SubmitSeedOfferResult, SubmitSeedRequestResult, SeedExchange, WithdrawResult } from './types';
import { SeedExchangeCollections } from './collections';

/**
 * Submit a seed offer to the exchange
 * @param authToken - Azure user authentication token
 * @param plantId - ID of the plant being offered
 * @param packetQuantity - Number of packets being offered
 * @param collections - Collection manager instance
 * @returns Result containing filled exchanges and any remaining offer
 */
export function SubmitSeedOffer(
  authToken: AzureUserToken,
  plantId: string,
  packetQuantity: number,
  collections: SeedExchangeCollections
): SubmitSeedOfferResult {
  const filledExchanges: SeedExchange[] = [];
  let remainingQuantity = packetQuantity;
  const timestamp = new Date();

  // Get all open requests for this plant, sorted by timestamp (FIFO)
  const openRequests = collections.getOpenRequestsByPlant(plantId);

  // Fill as many requests as possible
  for (const request of openRequests) {
    if (remainingQuantity <= 0) break;

    // Don't fill your own requests
    if (request.requestUserId === authToken.userId) continue;

    const quantityToFill = Math.min(remainingQuantity, request.quantity);

    // Update the request to become a confirmed exchange
    const confirmedExchange: SeedExchange = {
      ...request,
      offerUserId: authToken.userId,
      seedOfferTime: timestamp,
      confirmationTime: timestamp,
      quantity: quantityToFill,
      shipTime: null,
      receivedTime: null
    };

    filledExchanges.push(confirmedExchange);
    collections.updateExchange(confirmedExchange);

    // Update remaining quantities
    remainingQuantity -= quantityToFill;
    const updatedQuantity = request.quantity - quantityToFill;

    // If request is partially filled, create a new request for the remainder
    if (updatedQuantity > 0) {
      const remainderRequest: SeedExchange = {
        id: uuidv4(),
        plantId: request.plantId,
        requestUserId: request.requestUserId,
        offerUserId: null,
        quantity: updatedQuantity,
        seedRequestTime: request.seedRequestTime,
        seedOfferTime: null,
        confirmationTime: null,
        shipTime: null,
        receivedTime: null
      };
      collections.addExchange(remainderRequest);
    }
  }

  // Record remaining quantity as an open offer if any
  let remainingOffer: SeedExchange | undefined;
  if (remainingQuantity > 0) {
    remainingOffer = {
      id: uuidv4(),
      plantId,
      requestUserId: null,
      offerUserId: authToken.userId,
      quantity: remainingQuantity,
      seedRequestTime: null,
      seedOfferTime: timestamp,
      confirmationTime: null,
      shipTime: null,
      receivedTime: null
    };
    collections.addExchange(remainingOffer);
  }

  return { filledExchanges, remainingOffer };
}

/**
 * Submit a seed request to the exchange
 * @param authToken - Azure user authentication token
 * @param plantId - ID of the plant being requested
 * @param collections - Collection manager instance
 * @returns Result indicating if request was filled or remains open
 */
export function SubmitSeedRequest(
  authToken: AzureUserToken,
  plantId: string,
  collections: SeedExchangeCollections
): SubmitSeedRequestResult {
  const timestamp = new Date();
  const requestQuantity = 1; // Always one packet per request

  // Get all open offers for this plant, sorted by timestamp (FIFO)
  const openOffers = collections.getOpenOffersByPlant(plantId);

  // Try to fill from the first available offer
  for (const offer of openOffers) {
    // Don't fill from your own offers
    if (offer.offerUserId === authToken.userId) continue;

    if (offer.quantity >= requestQuantity) {
      // Update the offer to become a confirmed exchange
      const confirmedExchange: SeedExchange = {
        ...offer,
        requestUserId: authToken.userId,
        seedRequestTime: timestamp,
        confirmationTime: timestamp,
        quantity: requestQuantity,
        shipTime: null,
        receivedTime: null
      };

      collections.updateExchange(confirmedExchange);

      // Update the offer quantity
      const updatedQuantity = offer.quantity - requestQuantity;
      if (updatedQuantity > 0) {
        // Create a new offer for the remainder
        const remainderOffer: SeedExchange = {
          id: uuidv4(),
          plantId: offer.plantId,
          requestUserId: null,
          offerUserId: offer.offerUserId,
          quantity: updatedQuantity,
          seedRequestTime: null,
          seedOfferTime: offer.seedOfferTime,
          confirmationTime: null,
          shipTime: null,
          receivedTime: null
        };
        collections.addExchange(remainderOffer);
      }

      return { filled: true, exchange: confirmedExchange };
    }
  }

  // No offer found, create an open request
  const remainingRequest: SeedExchange = {
    id: uuidv4(),
    plantId,
    requestUserId: authToken.userId,
    offerUserId: null,
    quantity: requestQuantity,
    seedRequestTime: timestamp,
    seedOfferTime: null,
    confirmationTime: null,
    shipTime: null,
    receivedTime: null
  };
  collections.addExchange(remainingRequest);

  return { filled: false, remainingRequest };
}

/**
 * Withdraw an open seed request or offer
 * @param authToken - Azure user authentication token
 * @param exchangeId - ID of the exchange to withdraw
 * @param collections - Collection manager instance
 * @returns Result indicating if withdrawal was successful
 */
export function Withdraw(
  authToken: AzureUserToken,
  exchangeId: string,
  collections: SeedExchangeCollections
): WithdrawResult {
  const exchange = collections.getExchange(exchangeId);

  if (!exchange) {
    return { success: false };
  }

  // Check if the exchange is open (not yet confirmed)
  if (exchange.confirmationTime !== null) {
    // Cannot withdraw a confirmed exchange
    return { success: false };
  }

  // Check if the user owns this request or offer
  const isOwner = 
    (exchange.requestUserId === authToken.userId && exchange.offerUserId === null) ||
    (exchange.offerUserId === authToken.userId && exchange.requestUserId === null);

  if (!isOwner) {
    return { success: false };
  }

  // Remove the exchange
  collections.removeExchange(exchangeId);

  return { success: true, withdrawnExchange: exchange };
}
