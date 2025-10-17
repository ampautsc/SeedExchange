import { SubmitSeedOffer, SubmitSeedRequest } from './api';
import { SeedExchangeCollections } from './collections';
import { AzureUserToken } from './types';

describe('SeedExchange API', () => {
  let collections: SeedExchangeCollections;
  let user1: AzureUserToken;
  let user2: AzureUserToken;
  let user3: AzureUserToken;

  beforeEach(() => {
    collections = new SeedExchangeCollections();
    user1 = { userId: 'user-1', email: 'user1@example.com', name: 'User 1' };
    user2 = { userId: 'user-2', email: 'user2@example.com', name: 'User 2' };
    user3 = { userId: 'user-3', email: 'user3@example.com', name: 'User 3' };
  });

  describe('SubmitSeedOffer', () => {
    it('should add an offer to OpenSeedOffer when no requests exist', () => {
      const result = SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      expect(result.filledRequests).toHaveLength(0);
      expect(result.remainingOffer).toBeDefined();
      expect(result.remainingOffer?.plantId).toBe('tomato-123');
      expect(result.remainingOffer?.quantity).toBe(5);
      expect(result.remainingOffer?.userId).toBe('user-1');
    });

    it('should fill one request and create offer for remainder', () => {
      // User 2 submits a request first
      SubmitSeedRequest(user2, 'tomato-123', collections);

      // User 1 submits an offer with 5 packets
      const result = SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      expect(result.filledRequests).toHaveLength(1);
      expect(result.filledRequests[0].offerUserId).toBe('user-1');
      expect(result.filledRequests[0].requestUserId).toBe('user-2');
      expect(result.filledRequests[0].quantity).toBe(1);
      expect(result.remainingOffer).toBeDefined();
      expect(result.remainingOffer?.quantity).toBe(4);

      // Check that the request was removed
      const openRequests = collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(0);
    });

    it('should fill multiple requests in FIFO order', () => {
      // Three users submit requests
      SubmitSeedRequest(user1, 'tomato-123', collections);
      SubmitSeedRequest(user2, 'tomato-123', collections);
      SubmitSeedRequest(user3, 'tomato-123', collections);

      // User 1's offer should fill user 2 and user 3 (not their own)
      const result = SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      expect(result.filledRequests).toHaveLength(2);
      expect(result.filledRequests[0].requestUserId).toBe('user-2');
      expect(result.filledRequests[1].requestUserId).toBe('user-3');
      expect(result.remainingOffer).toBeDefined();
      expect(result.remainingOffer?.quantity).toBe(1);

      // User 1's request should still be open
      const openRequests = collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(1);
      expect(openRequests[0].userId).toBe('user-1');
    });

    it('should fill all requests exactly with no remainder', () => {
      SubmitSeedRequest(user2, 'tomato-123', collections);
      SubmitSeedRequest(user3, 'tomato-123', collections);

      const result = SubmitSeedOffer(user1, 'tomato-123', 2, collections);

      expect(result.filledRequests).toHaveLength(2);
      expect(result.remainingOffer).toBeUndefined();

      const openRequests = collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(0);
    });

    it('should not fill own requests', () => {
      SubmitSeedRequest(user1, 'tomato-123', collections);

      const result = SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      expect(result.filledRequests).toHaveLength(0);
      expect(result.remainingOffer?.quantity).toBe(3);

      const openRequests = collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(1);
    });

    it('should only match requests for the same plant', () => {
      SubmitSeedRequest(user2, 'carrot-456', collections);

      const result = SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      expect(result.filledRequests).toHaveLength(0);
      expect(result.remainingOffer?.quantity).toBe(3);

      const openRequestsTomato = collections.getOpenRequestsByPlant('tomato-123');
      const openRequestsCarrot = collections.getOpenRequestsByPlant('carrot-456');
      expect(openRequestsTomato).toHaveLength(0);
      expect(openRequestsCarrot).toHaveLength(1);
    });
  });

  describe('SubmitSeedRequest', () => {
    it('should add request to OpenSeedRequest when no offers exist', () => {
      const result = SubmitSeedRequest(user1, 'tomato-123', collections);

      expect(result.filled).toBe(false);
      expect(result.fill).toBeUndefined();
      expect(result.remainingRequest).toBeDefined();
      expect(result.remainingRequest?.plantId).toBe('tomato-123');
      expect(result.remainingRequest?.quantity).toBe(1);
      expect(result.remainingRequest?.userId).toBe('user-1');
    });

    it('should fill request from existing offer', () => {
      // User 1 submits an offer first
      SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      // User 2 submits a request
      const result = SubmitSeedRequest(user2, 'tomato-123', collections);

      expect(result.filled).toBe(true);
      expect(result.fill).toBeDefined();
      expect(result.fill?.offerUserId).toBe('user-1');
      expect(result.fill?.requestUserId).toBe('user-2');
      expect(result.fill?.quantity).toBe(1);
      expect(result.remainingRequest).toBeUndefined();

      // Check that the offer was updated
      const openOffers = collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(4);
    });

    it('should remove offer when last packet is taken', () => {
      // User 1 submits an offer with 1 packet
      SubmitSeedOffer(user1, 'tomato-123', 1, collections);

      // User 2 submits a request
      const result = SubmitSeedRequest(user2, 'tomato-123', collections);

      expect(result.filled).toBe(true);

      // Check that the offer was removed
      const openOffers = collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(0);
    });

    it('should fill from first available offer (FIFO)', () => {
      // Two users submit offers
      SubmitSeedOffer(user1, 'tomato-123', 3, collections);
      SubmitSeedOffer(user2, 'tomato-123', 3, collections);

      // User 3 submits a request
      const result = SubmitSeedRequest(user3, 'tomato-123', collections);

      expect(result.filled).toBe(true);
      expect(result.fill?.offerUserId).toBe('user-1');

      // Check that the first offer was updated
      const openOffers = collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(2);
      expect(openOffers[0].userId).toBe('user-1');
      expect(openOffers[0].quantity).toBe(2);
      expect(openOffers[1].userId).toBe('user-2');
      expect(openOffers[1].quantity).toBe(3);
    });

    it('should not fill from own offers', () => {
      SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      const result = SubmitSeedRequest(user1, 'tomato-123', collections);

      expect(result.filled).toBe(false);
      expect(result.remainingRequest).toBeDefined();

      const openOffers = collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(3);
    });

    it('should only match offers for the same plant', () => {
      SubmitSeedOffer(user1, 'carrot-456', 3, collections);

      const result = SubmitSeedRequest(user2, 'tomato-123', collections);

      expect(result.filled).toBe(false);
      expect(result.remainingRequest).toBeDefined();
    });

    it('should always request exactly 1 packet', () => {
      const result = SubmitSeedRequest(user1, 'tomato-123', collections);

      expect(result.remainingRequest?.quantity).toBe(1);
    });
  });

  describe('SeedFill collection', () => {
    it('should record all fills in SeedFill collection', () => {
      SubmitSeedRequest(user2, 'tomato-123', collections);
      SubmitSeedRequest(user3, 'tomato-123', collections);

      SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      const fills = collections.getAllFills();
      expect(fills).toHaveLength(2);
      expect(fills[0].offerUserId).toBe('user-1');
      expect(fills[0].requestUserId).toBe('user-2');
      expect(fills[1].offerUserId).toBe('user-1');
      expect(fills[1].requestUserId).toBe('user-3');
    });

    it('should record fills from both offer and request submissions', () => {
      // User 1 submits offer
      SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      // User 2 submits request (fills from offer)
      SubmitSeedRequest(user2, 'tomato-123', collections);

      // User 3 submits request first
      SubmitSeedRequest(user3, 'carrot-456', collections);

      // User 1 submits offer (fills request)
      SubmitSeedOffer(user1, 'carrot-456', 2, collections);

      const fills = collections.getAllFills();
      expect(fills).toHaveLength(2);
      expect(fills[0].plantId).toBe('tomato-123');
      expect(fills[1].plantId).toBe('carrot-456');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple users and plants correctly', () => {
      // User 1 offers tomatoes
      SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      // User 2 offers carrots
      SubmitSeedOffer(user2, 'carrot-456', 2, collections);

      // User 3 requests tomatoes (should be filled from user 1)
      const result1 = SubmitSeedRequest(user3, 'tomato-123', collections);
      expect(result1.filled).toBe(true);

      // User 1 requests carrots (should be filled from user 2)
      const result2 = SubmitSeedRequest(user1, 'carrot-456', collections);
      expect(result2.filled).toBe(true);

      const fills = collections.getAllFills();
      expect(fills).toHaveLength(2);

      const openOffersTomato = collections.getOpenOffersByPlant('tomato-123');
      expect(openOffersTomato).toHaveLength(1);
      expect(openOffersTomato[0].quantity).toBe(2);

      const openOffersCarrot = collections.getOpenOffersByPlant('carrot-456');
      expect(openOffersCarrot).toHaveLength(1);
      expect(openOffersCarrot[0].quantity).toBe(1);
    });
  });
});
