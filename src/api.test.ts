import { SubmitSeedOffer, SubmitSeedRequest, Withdraw } from './api';
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
    it('should add an offer to the collection when no requests exist', async () => {
      const result = await SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      expect(result.filledExchanges).toHaveLength(0);
      expect(result.remainingOffer).toBeDefined();
      expect(result.remainingOffer?.plantId).toBe('tomato-123');
      expect(result.remainingOffer?.quantity).toBe(5);
      expect(result.remainingOffer?.offerUserId).toBe('user-1');
      expect(result.remainingOffer?.requestUserId).toBeNull();
      expect(result.remainingOffer?.seedOfferTime).toBeDefined();
    });

    it('should fill one request and create offer for remainder', async () => {
      // User 2 submits a request first
      await SubmitSeedRequest(user2, 'tomato-123', collections);

      // User 1 submits an offer with 5 packets
      const result = await SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      expect(result.filledExchanges).toHaveLength(1);
      expect(result.filledExchanges[0].offerUserId).toBe('user-1');
      expect(result.filledExchanges[0].requestUserId).toBe('user-2');
      expect(result.filledExchanges[0].quantity).toBe(1);
      expect(result.filledExchanges[0].confirmationTime).toBeDefined();
      expect(result.remainingOffer).toBeDefined();
      expect(result.remainingOffer?.quantity).toBe(4);

      // Check that the request was converted to a confirmed exchange
      const openRequests = await collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(0);
    });

    it('should fill multiple requests in FIFO order', async () => {
      // Three users submit requests
      await SubmitSeedRequest(user1, 'tomato-123', collections);
      await SubmitSeedRequest(user2, 'tomato-123', collections);
      await SubmitSeedRequest(user3, 'tomato-123', collections);

      // User 1's offer should fill user 2 and user 3 (not their own)
      const result = await SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      expect(result.filledExchanges).toHaveLength(2);
      expect(result.filledExchanges[0].requestUserId).toBe('user-2');
      expect(result.filledExchanges[1].requestUserId).toBe('user-3');
      expect(result.remainingOffer).toBeDefined();
      expect(result.remainingOffer?.quantity).toBe(1);

      // User 1's request should still be open
      const openRequests = await collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(1);
      expect(openRequests[0].requestUserId).toBe('user-1');
    });

    it('should fill all requests exactly with no remainder', async () => {
      await SubmitSeedRequest(user2, 'tomato-123', collections);
      await SubmitSeedRequest(user3, 'tomato-123', collections);

      const result = await SubmitSeedOffer(user1, 'tomato-123', 2, collections);

      expect(result.filledExchanges).toHaveLength(2);
      expect(result.remainingOffer).toBeUndefined();

      const openRequests = await collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(0);
    });

    it('should not fill own requests', async () => {
      await SubmitSeedRequest(user1, 'tomato-123', collections);

      const result = await SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      expect(result.filledExchanges).toHaveLength(0);
      expect(result.remainingOffer?.quantity).toBe(3);

      const openRequests = await collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(1);
    });

    it('should only match requests for the same plant', async () => {
      await SubmitSeedRequest(user2, 'carrot-456', collections);

      const result = await SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      expect(result.filledExchanges).toHaveLength(0);
      expect(result.remainingOffer?.quantity).toBe(3);

      const openRequestsTomato = await collections.getOpenRequestsByPlant('tomato-123');
      const openRequestsCarrot = await collections.getOpenRequestsByPlant('carrot-456');
      expect(openRequestsTomato).toHaveLength(0);
      expect(openRequestsCarrot).toHaveLength(1);
    });
  });

  describe('SubmitSeedRequest', () => {
    it('should add request to the collection when no offers exist', async () => {
      const result = await SubmitSeedRequest(user1, 'tomato-123', collections);

      expect(result.filled).toBe(false);
      expect(result.exchange).toBeUndefined();
      expect(result.remainingRequest).toBeDefined();
      expect(result.remainingRequest?.plantId).toBe('tomato-123');
      expect(result.remainingRequest?.quantity).toBe(1);
      expect(result.remainingRequest?.requestUserId).toBe('user-1');
      expect(result.remainingRequest?.offerUserId).toBeNull();
      expect(result.remainingRequest?.seedRequestTime).toBeDefined();
    });

    it('should fill request from existing offer', async () => {
      // User 1 submits an offer first
      await SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      // User 2 submits a request
      const result = await SubmitSeedRequest(user2, 'tomato-123', collections);

      expect(result.filled).toBe(true);
      expect(result.exchange).toBeDefined();
      expect(result.exchange?.offerUserId).toBe('user-1');
      expect(result.exchange?.requestUserId).toBe('user-2');
      expect(result.exchange?.quantity).toBe(1);
      expect(result.exchange?.confirmationTime).toBeDefined();
      expect(result.remainingRequest).toBeUndefined();

      // Check that the offer was updated (split into remainder)
      const openOffers = await collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(4);
    });

    it('should remove offer when last packet is taken', async () => {
      // User 1 submits an offer with 1 packet
      await SubmitSeedOffer(user1, 'tomato-123', 1, collections);

      // User 2 submits a request
      const result = await SubmitSeedRequest(user2, 'tomato-123', collections);

      expect(result.filled).toBe(true);

      // Check that the offer was removed (no remainder)
      const openOffers = await collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(0);
    });

    it('should fill from first available offer (FIFO)', async () => {
      // Two users submit offers
      await SubmitSeedOffer(user1, 'tomato-123', 3, collections);
      await SubmitSeedOffer(user2, 'tomato-123', 3, collections);

      // User 3 submits a request
      const result = await SubmitSeedRequest(user3, 'tomato-123', collections);

      expect(result.filled).toBe(true);
      expect(result.exchange?.offerUserId).toBe('user-1');

      // Check that the offers were updated
      const openOffers = await collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(2);
      
      // Find user1 and user2 offers
      const user1Offer = openOffers.find(o => o.offerUserId === 'user-1');
      const user2Offer = openOffers.find(o => o.offerUserId === 'user-2');
      
      expect(user1Offer).toBeDefined();
      expect(user1Offer?.quantity).toBe(2);
      expect(user2Offer).toBeDefined();
      expect(user2Offer?.quantity).toBe(3);
    });

    it('should not fill from own offers', async () => {
      await SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      const result = await SubmitSeedRequest(user1, 'tomato-123', collections);

      expect(result.filled).toBe(false);
      expect(result.remainingRequest).toBeDefined();

      const openOffers = await collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(3);
    });

    it('should only match offers for the same plant', async () => {
      await SubmitSeedOffer(user1, 'carrot-456', 3, collections);

      const result = await SubmitSeedRequest(user2, 'tomato-123', collections);

      expect(result.filled).toBe(false);
      expect(result.remainingRequest).toBeDefined();
    });

    it('should always request exactly 1 packet', async () => {
      const result = await SubmitSeedRequest(user1, 'tomato-123', collections);

      expect(result.remainingRequest?.quantity).toBe(1);
    });
  });

  describe('Confirmed Exchanges', () => {
    it('should record all confirmed exchanges in the collection', async () => {
      await SubmitSeedRequest(user2, 'tomato-123', collections);
      await SubmitSeedRequest(user3, 'tomato-123', collections);

      await SubmitSeedOffer(user1, 'tomato-123', 5, collections);

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(2);
      expect(confirmedExchanges[0].offerUserId).toBe('user-1');
      expect(confirmedExchanges[0].requestUserId).toBe('user-2');
      expect(confirmedExchanges[1].offerUserId).toBe('user-1');
      expect(confirmedExchanges[1].requestUserId).toBe('user-3');
    });

    it('should record exchanges from both offer and request submissions', async () => {
      // User 1 submits offer
      await SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      // User 2 submits request (fills from offer)
      await SubmitSeedRequest(user2, 'tomato-123', collections);

      // User 3 submits request first
      await SubmitSeedRequest(user3, 'carrot-456', collections);

      // User 1 submits offer (fills request)
      await SubmitSeedOffer(user1, 'carrot-456', 2, collections);

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(2);
      expect(confirmedExchanges[0].plantId).toBe('tomato-123');
      expect(confirmedExchanges[1].plantId).toBe('carrot-456');
    });
  });

  describe('Withdraw', () => {
    it('should withdraw an open request', async () => {
      const requestResult = await SubmitSeedRequest(user1, 'tomato-123', collections);
      const exchangeId = requestResult.remainingRequest!.id;

      const withdrawResult = await Withdraw(user1, exchangeId, collections);

      expect(withdrawResult.success).toBe(true);
      expect(withdrawResult.withdrawnExchange).toBeDefined();
      expect(withdrawResult.withdrawnExchange?.id).toBe(exchangeId);

      const openRequests = await collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(0);
    });

    it('should withdraw an open offer', async () => {
      const offerResult = await SubmitSeedOffer(user1, 'tomato-123', 3, collections);
      const exchangeId = offerResult.remainingOffer!.id;

      const withdrawResult = await Withdraw(user1, exchangeId, collections);

      expect(withdrawResult.success).toBe(true);
      expect(withdrawResult.withdrawnExchange).toBeDefined();

      const openOffers = await collections.getOpenOffersByPlant('tomato-123');
      expect(openOffers).toHaveLength(0);
    });

    it('should not withdraw a confirmed exchange', async () => {
      await SubmitSeedRequest(user2, 'tomato-123', collections);
      const offerResult = await SubmitSeedOffer(user1, 'tomato-123', 2, collections);
      const confirmedExchangeId = offerResult.filledExchanges[0].id;

      const withdrawResult = await Withdraw(user1, confirmedExchangeId, collections);

      expect(withdrawResult.success).toBe(false);

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(1);
    });

    it('should not withdraw another user\'s exchange', async () => {
      const requestResult = await SubmitSeedRequest(user1, 'tomato-123', collections);
      const exchangeId = requestResult.remainingRequest!.id;

      const withdrawResult = await Withdraw(user2, exchangeId, collections);

      expect(withdrawResult.success).toBe(false);

      const openRequests = await collections.getOpenRequestsByPlant('tomato-123');
      expect(openRequests).toHaveLength(1);
    });

    it('should return false for non-existent exchange', async () => {
      const withdrawResult = await Withdraw(user1, 'non-existent-id', collections);

      expect(withdrawResult.success).toBe(false);
      expect(withdrawResult.withdrawnExchange).toBeUndefined();
    });
  });

  describe('Complex scenarios', () => {
    it('should handle multiple users and plants correctly', async () => {
      // User 1 offers tomatoes
      await SubmitSeedOffer(user1, 'tomato-123', 3, collections);

      // User 2 offers carrots
      await SubmitSeedOffer(user2, 'carrot-456', 2, collections);

      // User 3 requests tomatoes (should be filled from user 1)
      const result1 = await SubmitSeedRequest(user3, 'tomato-123', collections);
      expect(result1.filled).toBe(true);

      // User 1 requests carrots (should be filled from user 2)
      const result2 = await SubmitSeedRequest(user1, 'carrot-456', collections);
      expect(result2.filled).toBe(true);

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(2);

      const openOffersTomato = await collections.getOpenOffersByPlant('tomato-123');
      expect(openOffersTomato).toHaveLength(1);
      expect(openOffersTomato[0].quantity).toBe(2);

      const openOffersCarrot = await collections.getOpenOffersByPlant('carrot-456');
      expect(openOffersCarrot).toHaveLength(1);
      expect(openOffersCarrot[0].quantity).toBe(1);
    });
  });
});
