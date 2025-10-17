import { v4 as uuidv4 } from 'uuid';
import { AzureUserToken, SubmitSeedOfferResult, SubmitSeedRequestResult, OpenSeedOffer, OpenSeedRequest, SeedFill } from './types';
import { SeedExchangeCollections } from './collections';

/**
 * Submit a seed offer to the exchange
 * @param authToken - Azure user authentication token
 * @param plantId - ID of the plant being offered
 * @param packetQuantity - Number of packets being offered
 * @param collections - Collection manager instance
 * @returns Result containing filled requests and any remaining offer
 */
export function SubmitSeedOffer(
  authToken: AzureUserToken,
  plantId: string,
  packetQuantity: number,
  collections: SeedExchangeCollections
): SubmitSeedOfferResult {
  const filledRequests: SeedFill[] = [];
  let remainingQuantity = packetQuantity;
  const timestamp = new Date();

  // Get all open requests for this plant, sorted by timestamp (FIFO)
  const openRequests = collections.getOpenRequestsByPlant(plantId);

  // Fill as many requests as possible
  for (const request of openRequests) {
    if (remainingQuantity <= 0) break;

    // Don't fill your own requests
    if (request.userId === authToken.userId) continue;

    const quantityToFill = Math.min(remainingQuantity, request.quantity);

    // Create a fill record
    const fill: SeedFill = {
      id: uuidv4(),
      plantId,
      offerUserId: authToken.userId,
      requestUserId: request.userId,
      quantity: quantityToFill,
      timestamp
    };

    filledRequests.push(fill);
    collections.addSeedFill(fill);

    // Update remaining quantities
    remainingQuantity -= quantityToFill;
    request.quantity -= quantityToFill;

    // Remove or update the request
    if (request.quantity <= 0) {
      collections.removeOpenRequest(request.id);
    } else {
      collections.updateOpenRequest(request);
    }
  }

  // Record remaining quantity in OpenSeedOffer collection if any
  let remainingOffer: OpenSeedOffer | undefined;
  if (remainingQuantity > 0) {
    remainingOffer = {
      id: uuidv4(),
      plantId,
      userId: authToken.userId,
      quantity: remainingQuantity,
      timestamp
    };
    collections.addOpenOffer(remainingOffer);
  }

  return { filledRequests, remainingOffer };
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
    if (offer.userId === authToken.userId) continue;

    if (offer.quantity >= requestQuantity) {
      // Create a fill record
      const fill: SeedFill = {
        id: uuidv4(),
        plantId,
        offerUserId: offer.userId,
        requestUserId: authToken.userId,
        quantity: requestQuantity,
        timestamp
      };

      collections.addSeedFill(fill);

      // Update the offer
      offer.quantity -= requestQuantity;
      if (offer.quantity <= 0) {
        collections.removeOpenOffer(offer.id);
      } else {
        collections.updateOpenOffer(offer);
      }

      return { filled: true, fill };
    }
  }

  // No offer found, create an open request
  const remainingRequest: OpenSeedRequest = {
    id: uuidv4(),
    plantId,
    userId: authToken.userId,
    quantity: requestQuantity,
    timestamp
  };
  collections.addOpenRequest(remainingRequest);

  return { filled: false, remainingRequest };
}
