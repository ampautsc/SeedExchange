import { SubmitSeedOffer, SubmitSeedRequest, Withdraw } from './api';
import { SeedExchangeCollections } from './collections';
import { AzureUserToken } from './types';

/**
 * End-to-End Test Suite
 * 
 * This test suite validates all operations in the Seed Exchange service
 * through comprehensive end-to-end scenarios that test the complete workflow
 * from submission to withdrawal.
 */
describe('End-to-End Test Suite', () => {
  let collections: SeedExchangeCollections;
  let alice: AzureUserToken;
  let bob: AzureUserToken;
  let charlie: AzureUserToken;
  let diana: AzureUserToken;

  beforeEach(() => {
    collections = new SeedExchangeCollections();
    alice = { userId: 'alice-e2e', email: 'alice@e2e.com', name: 'Alice' };
    bob = { userId: 'bob-e2e', email: 'bob@e2e.com', name: 'Bob' };
    charlie = { userId: 'charlie-e2e', email: 'charlie@e2e.com', name: 'Charlie' };
    diana = { userId: 'diana-e2e', email: 'diana@e2e.com', name: 'Diana' };
  });

  describe('Complete workflow: Offer -> Request -> Confirmation', () => {
    it('should handle a simple offer-then-request flow', async () => {
      // Alice offers tomato seeds
      const offerResult = await SubmitSeedOffer(alice, 'tomato-001', 3, collections);
      expect(offerResult.filledExchanges).toHaveLength(0);
      expect(offerResult.remainingOffer).toBeDefined();
      expect(offerResult.remainingOffer?.quantity).toBe(3);

      // Bob requests tomato seeds
      const requestResult = await SubmitSeedRequest(bob, 'tomato-001', collections);
      expect(requestResult.filled).toBe(true);
      expect(requestResult.exchange?.offerUserId).toBe('alice-e2e');
      expect(requestResult.exchange?.requestUserId).toBe('bob-e2e');
      expect(requestResult.exchange?.confirmationTime).toBeDefined();

      // Verify state
      const openOffers = await collections.getOpenOffersByPlant('tomato-001');
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(2); // 3 - 1 = 2

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(1);
    });

    it('should handle a simple request-then-offer flow', async () => {
      // Bob requests carrot seeds
      const requestResult = await SubmitSeedRequest(bob, 'carrot-002', collections);
      expect(requestResult.filled).toBe(false);
      expect(requestResult.remainingRequest).toBeDefined();

      // Alice offers carrot seeds
      const offerResult = await SubmitSeedOffer(alice, 'carrot-002', 2, collections);
      expect(offerResult.filledExchanges).toHaveLength(1);
      expect(offerResult.filledExchanges[0].requestUserId).toBe('bob-e2e');
      expect(offerResult.filledExchanges[0].offerUserId).toBe('alice-e2e');
      expect(offerResult.remainingOffer?.quantity).toBe(1);

      // Verify state
      const openRequests = await collections.getOpenRequestsByPlant('carrot-002');
      expect(openRequests).toHaveLength(0);

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(1);
    });
  });

  describe('FIFO order validation', () => {
    it('should fill requests in FIFO order when offer arrives', async () => {
      // Submit requests in order
      await SubmitSeedRequest(bob, 'lettuce-003', collections);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to ensure timestamp difference
      await SubmitSeedRequest(charlie, 'lettuce-003', collections);
      await new Promise(resolve => setTimeout(resolve, 10));
      await SubmitSeedRequest(diana, 'lettuce-003', collections);

      // Alice offers enough to fill all
      const offerResult = await SubmitSeedOffer(alice, 'lettuce-003', 3, collections);
      
      expect(offerResult.filledExchanges).toHaveLength(3);
      expect(offerResult.filledExchanges[0].requestUserId).toBe('bob-e2e');
      expect(offerResult.filledExchanges[1].requestUserId).toBe('charlie-e2e');
      expect(offerResult.filledExchanges[2].requestUserId).toBe('diana-e2e');
    });

    it('should fill from offers in FIFO order when request arrives', async () => {
      // Submit offers in order
      await SubmitSeedOffer(bob, 'pepper-004', 2, collections);
      await new Promise(resolve => setTimeout(resolve, 10));
      await SubmitSeedOffer(charlie, 'pepper-004', 2, collections);
      await new Promise(resolve => setTimeout(resolve, 10));
      await SubmitSeedOffer(diana, 'pepper-004', 2, collections);

      // Alice requests
      const requestResult = await SubmitSeedRequest(alice, 'pepper-004', collections);
      
      expect(requestResult.filled).toBe(true);
      expect(requestResult.exchange?.offerUserId).toBe('bob-e2e');

      // Check Bob's offer was reduced
      const openOffers = await collections.getOpenOffersByPlant('pepper-004');
      const bobOffer = openOffers.find(o => o.offerUserId === 'bob-e2e');
      expect(bobOffer?.quantity).toBe(1); // 2 - 1 = 1
    });
  });

  describe('Multi-user, multi-plant scenarios', () => {
    it('should handle multiple plants independently', async () => {
      // Setup offers for different plants
      await SubmitSeedOffer(alice, 'tomato-005', 3, collections);
      await SubmitSeedOffer(bob, 'carrot-005', 2, collections);
      await SubmitSeedOffer(charlie, 'lettuce-005', 4, collections);

      // Bob requests tomato (should get from Alice)
      const bobRequest = await SubmitSeedRequest(bob, 'tomato-005', collections);
      expect(bobRequest.filled).toBe(true);
      expect(bobRequest.exchange?.offerUserId).toBe('alice-e2e');

      // Alice requests carrot (should get from Bob)
      const aliceRequest = await SubmitSeedRequest(alice, 'carrot-005', collections);
      expect(aliceRequest.filled).toBe(true);
      expect(aliceRequest.exchange?.offerUserId).toBe('bob-e2e');

      // Diana requests lettuce (should get from Charlie)
      const dianaRequest = await SubmitSeedRequest(diana, 'lettuce-005', collections);
      expect(dianaRequest.filled).toBe(true);
      expect(dianaRequest.exchange?.offerUserId).toBe('charlie-e2e');

      // Verify all exchanges are independent
      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(3);
      
      const plants = confirmedExchanges.map(e => e.plantId);
      expect(plants).toContain('tomato-005');
      expect(plants).toContain('carrot-005');
      expect(plants).toContain('lettuce-005');
    });

    it('should handle complex multi-user exchanges', async () => {
      // Multiple requests for same plant
      await SubmitSeedRequest(bob, 'cucumber-006', collections);
      await SubmitSeedRequest(charlie, 'cucumber-006', collections);
      await SubmitSeedRequest(diana, 'cucumber-006', collections);

      // Alice offers enough for 2
      const offer1 = await SubmitSeedOffer(alice, 'cucumber-006', 2, collections);
      expect(offer1.filledExchanges).toHaveLength(2);

      // Bob also offers (should fill Diana's remaining request)
      const offer2 = await SubmitSeedOffer(bob, 'cucumber-006', 1, collections);
      expect(offer2.filledExchanges).toHaveLength(1);
      expect(offer2.filledExchanges[0].requestUserId).toBe('diana-e2e');

      // Verify all requests filled
      const openRequests = await collections.getOpenRequestsByPlant('cucumber-006');
      expect(openRequests).toHaveLength(0);
    });
  });

  describe('Withdraw operations', () => {
    it('should allow withdrawal of open requests', async () => {
      const requestResult = await SubmitSeedRequest(bob, 'spinach-007', collections);
      const exchangeId = requestResult.remainingRequest!.id;

      const withdrawResult = await Withdraw(bob, exchangeId, collections);
      expect(withdrawResult.success).toBe(true);

      const openRequests = await collections.getOpenRequestsByPlant('spinach-007');
      expect(openRequests).toHaveLength(0);
    });

    it('should allow withdrawal of open offers', async () => {
      const offerResult = await SubmitSeedOffer(alice, 'kale-008', 5, collections);
      const exchangeId = offerResult.remainingOffer!.id;

      const withdrawResult = await Withdraw(alice, exchangeId, collections);
      expect(withdrawResult.success).toBe(true);

      const openOffers = await collections.getOpenOffersByPlant('kale-008');
      expect(openOffers).toHaveLength(0);
    });

    it('should not allow withdrawal of confirmed exchanges', async () => {
      await SubmitSeedRequest(bob, 'basil-009', collections);
      const offerResult = await SubmitSeedOffer(alice, 'basil-009', 1, collections);
      const confirmedId = offerResult.filledExchanges[0].id;

      const withdrawResult = await Withdraw(alice, confirmedId, collections);
      expect(withdrawResult.success).toBe(false);

      const confirmedExchanges = await collections.getConfirmedExchanges();
      expect(confirmedExchanges).toHaveLength(1);
    });

    it('should not allow users to withdraw others\' exchanges', async () => {
      const requestResult = await SubmitSeedRequest(bob, 'thyme-010', collections);
      const exchangeId = requestResult.remainingRequest!.id;

      const withdrawResult = await Withdraw(alice, exchangeId, collections);
      expect(withdrawResult.success).toBe(false);

      const openRequests = await collections.getOpenRequestsByPlant('thyme-010');
      expect(openRequests).toHaveLength(1);
    });
  });

  describe('Self-matching prevention', () => {
    it('should not allow user to fill their own request', async () => {
      await SubmitSeedRequest(alice, 'oregano-011', collections);
      const offerResult = await SubmitSeedOffer(alice, 'oregano-011', 3, collections);

      expect(offerResult.filledExchanges).toHaveLength(0);
      expect(offerResult.remainingOffer?.quantity).toBe(3);

      const openRequests = await collections.getOpenRequestsByPlant('oregano-011');
      expect(openRequests).toHaveLength(1);
    });

    it('should not allow user to fill from their own offer', async () => {
      await SubmitSeedOffer(alice, 'cilantro-012', 3, collections);
      const requestResult = await SubmitSeedRequest(alice, 'cilantro-012', collections);

      expect(requestResult.filled).toBe(false);
      expect(requestResult.remainingRequest).toBeDefined();

      const openOffers = await collections.getOpenOffersByPlant('cilantro-012');
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(3);
    });
  });

  describe('Quantity management', () => {
    it('should correctly handle partial offer fulfillment', async () => {
      // 3 users request
      await SubmitSeedRequest(bob, 'parsley-013', collections);
      await SubmitSeedRequest(charlie, 'parsley-013', collections);
      await SubmitSeedRequest(diana, 'parsley-013', collections);

      // Alice offers 2 (only fills 2 out of 3)
      const offerResult = await SubmitSeedOffer(alice, 'parsley-013', 2, collections);
      expect(offerResult.filledExchanges).toHaveLength(2);
      expect(offerResult.remainingOffer).toBeUndefined();

      const openRequests = await collections.getOpenRequestsByPlant('parsley-013');
      expect(openRequests).toHaveLength(1);
    });

    it('should correctly handle exact match', async () => {
      await SubmitSeedRequest(bob, 'dill-014', collections);
      await SubmitSeedRequest(charlie, 'dill-014', collections);

      const offerResult = await SubmitSeedOffer(alice, 'dill-014', 2, collections);
      expect(offerResult.filledExchanges).toHaveLength(2);
      expect(offerResult.remainingOffer).toBeUndefined();

      const openRequests = await collections.getOpenRequestsByPlant('dill-014');
      expect(openRequests).toHaveLength(0);
    });

    it('should handle large quantity offers', async () => {
      await SubmitSeedRequest(bob, 'mint-015', collections);
      
      const offerResult = await SubmitSeedOffer(alice, 'mint-015', 100, collections);
      expect(offerResult.filledExchanges).toHaveLength(1);
      expect(offerResult.remainingOffer?.quantity).toBe(99);
    });
  });

  describe('Collection query operations', () => {
    it('should correctly retrieve exchanges by user', async () => {
      // Alice makes multiple offers
      await SubmitSeedOffer(alice, 'rosemary-016', 3, collections);
      await SubmitSeedOffer(alice, 'sage-016', 2, collections);

      // Bob requests from both
      await SubmitSeedRequest(bob, 'rosemary-016', collections);
      await SubmitSeedRequest(bob, 'sage-016', collections);

      // Alice's exchanges (2 confirmed + 2 open offers with reduced quantities)
      const aliceExchanges = await collections.getExchangesByUser('alice-e2e');
      expect(aliceExchanges.length).toBeGreaterThanOrEqual(2);

      // Bob's exchanges (2 confirmed)
      const bobExchanges = await collections.getExchangesByUser('bob-e2e');
      const bobConfirmed = bobExchanges.filter(e => e.confirmationTime !== null);
      expect(bobConfirmed).toHaveLength(2);
    });

    it('should correctly retrieve all exchanges', async () => {
      await SubmitSeedOffer(alice, 'chive-017', 3, collections);
      await SubmitSeedRequest(bob, 'chive-017', collections);
      await SubmitSeedRequest(charlie, 'fennel-017', collections);

      const allExchanges = await collections.getAllExchanges();
      expect(allExchanges.length).toBeGreaterThanOrEqual(3);
    });

    it('should correctly filter open requests vs open offers', async () => {
      await SubmitSeedRequest(bob, 'marjoram-018', collections);
      await SubmitSeedRequest(charlie, 'marjoram-018', collections);
      await SubmitSeedOffer(diana, 'marjoram-018', 5, collections);

      // Diana's offer fills Bob and Charlie's requests, leaving 3 packets
      const openRequests = await collections.getOpenRequestsByPlant('marjoram-018');
      const openOffers = await collections.getOpenOffersByPlant('marjoram-018');

      expect(openRequests).toHaveLength(0); // Both requests were filled
      expect(openOffers).toHaveLength(1);
      expect(openOffers[0].quantity).toBe(3); // 5 - 2 = 3
    });
  });

  describe('Data integrity and timestamps', () => {
    it('should set correct timestamps for offers', async () => {
      const beforeTime = new Date();
      const offerResult = await SubmitSeedOffer(alice, 'tarragon-019', 3, collections);
      const afterTime = new Date();

      expect(offerResult.remainingOffer?.seedOfferTime).toBeDefined();
      const offerTime = offerResult.remainingOffer!.seedOfferTime!;
      expect(offerTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(offerTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should set correct timestamps for requests', async () => {
      const beforeTime = new Date();
      const requestResult = await SubmitSeedRequest(bob, 'lavender-020', collections);
      const afterTime = new Date();

      expect(requestResult.remainingRequest?.seedRequestTime).toBeDefined();
      const requestTime = requestResult.remainingRequest!.seedRequestTime!;
      expect(requestTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(requestTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should set confirmation timestamp when exchange is confirmed', async () => {
      await SubmitSeedRequest(bob, 'chamomile-021', collections);
      const beforeConfirm = new Date();
      const offerResult = await SubmitSeedOffer(alice, 'chamomile-021', 1, collections);
      const afterConfirm = new Date();

      expect(offerResult.filledExchanges).toHaveLength(1);
      const confirmTime = offerResult.filledExchanges[0].confirmationTime!;
      expect(confirmTime.getTime()).toBeGreaterThanOrEqual(beforeConfirm.getTime());
      expect(confirmTime.getTime()).toBeLessThanOrEqual(afterConfirm.getTime());
    });

    it('should maintain data integrity across operations', async () => {
      const requestResult = await SubmitSeedRequest(bob, 'echinacea-022', collections);
      const requestId = requestResult.remainingRequest!.id;

      const retrievedRequest = await collections.getExchange(requestId);
      expect(retrievedRequest).toBeDefined();
      expect(retrievedRequest?.plantId).toBe('echinacea-022');
      expect(retrievedRequest?.requestUserId).toBe('bob-e2e');
      expect(retrievedRequest?.offerUserId).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty collection state', async () => {
      const openRequests = await collections.getOpenRequestsByPlant('nonexistent-023');
      const openOffers = await collections.getOpenOffersByPlant('nonexistent-023');
      const confirmedExchanges = await collections.getConfirmedExchanges();

      expect(openRequests).toHaveLength(0);
      expect(openOffers).toHaveLength(0);
      expect(confirmedExchanges).toHaveLength(0);
    });

    it('should handle withdrawal of non-existent exchange', async () => {
      const withdrawResult = await Withdraw(alice, 'fake-id-024', collections);
      expect(withdrawResult.success).toBe(false);
      expect(withdrawResult.withdrawnExchange).toBeUndefined();
    });

    it('should handle multiple rapid operations', async () => {
      // Submit multiple requests rapidly
      const promises = [
        SubmitSeedRequest(bob, 'rapid-025', collections),
        SubmitSeedRequest(charlie, 'rapid-025', collections),
        SubmitSeedRequest(diana, 'rapid-025', collections),
      ];

      await Promise.all(promises);

      const openRequests = await collections.getOpenRequestsByPlant('rapid-025');
      expect(openRequests).toHaveLength(3);

      // Now fulfill with offer
      const offerResult = await SubmitSeedOffer(alice, 'rapid-025', 10, collections);
      expect(offerResult.filledExchanges).toHaveLength(3);
    });

    it('should handle zero quantity edge case gracefully', async () => {
      const offerResult = await SubmitSeedOffer(alice, 'zero-026', 0, collections);
      expect(offerResult.filledExchanges).toHaveLength(0);
      expect(offerResult.remainingOffer).toBeUndefined();
    });
  });

  describe('Complete lifecycle simulation', () => {
    it('should simulate a realistic seed exchange lifecycle', async () => {
      // Day 1: Initial offers
      await SubmitSeedOffer(alice, 'tomato-lifecycle', 10, collections);
      await SubmitSeedOffer(bob, 'carrot-lifecycle', 5, collections);

      // Day 2: Some requests come in
      await SubmitSeedRequest(charlie, 'tomato-lifecycle', collections);
      await SubmitSeedRequest(diana, 'tomato-lifecycle', collections);
      await SubmitSeedRequest(alice, 'carrot-lifecycle', collections);

      // Verify some exchanges confirmed
      const confirmed = await collections.getConfirmedExchanges();
      expect(confirmed).toHaveLength(3);

      // Day 3: More requests
      await SubmitSeedRequest(bob, 'tomato-lifecycle', collections);
      
      // Day 4: Someone withdraws
      const openTomatoRequests = await collections.getOpenRequestsByPlant('tomato-lifecycle');
      if (openTomatoRequests.length > 0) {
        await Withdraw(bob, openTomatoRequests[0].id, collections);
      }

      // Day 5: New offers come in
      await SubmitSeedOffer(charlie, 'lettuce-lifecycle', 3, collections);

      // Final state check
      const allExchanges = await collections.getAllExchanges();
      expect(allExchanges.length).toBeGreaterThan(0);

      const finalConfirmed = await collections.getConfirmedExchanges();
      expect(finalConfirmed.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Clear operation', () => {
    it('should clear all data from collections', async () => {
      // Add some data
      await SubmitSeedOffer(alice, 'clear-027', 5, collections);
      await SubmitSeedRequest(bob, 'clear-027', collections);

      let allExchanges = await collections.getAllExchanges();
      expect(allExchanges.length).toBeGreaterThan(0);

      // Clear
      await collections.clear();

      // Verify empty
      allExchanges = await collections.getAllExchanges();
      expect(allExchanges).toHaveLength(0);

      const openRequests = await collections.getOpenRequestsByPlant('clear-027');
      expect(openRequests).toHaveLength(0);
    });
  });
});
