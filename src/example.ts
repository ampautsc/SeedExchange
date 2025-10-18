import { SubmitSeedOffer, SubmitSeedRequest, CancelExchange, collections, AzureUserToken } from './index';

// Example: Demonstrating the Seed Exchange API

// Define some users
const alice: AzureUserToken = {
  userId: 'alice-123',
  email: 'alice@example.com',
  name: 'Alice'
};

const bob: AzureUserToken = {
  userId: 'bob-456',
  email: 'bob@example.com',
  name: 'Bob'
};

const charlie: AzureUserToken = {
  userId: 'charlie-789',
  email: 'charlie@example.com',
  name: 'Charlie'
};

console.log('=== Seed Exchange Demo ===\n');

// Scenario 1: Alice offers tomato seeds
console.log('1. Alice offers 5 packets of tomato seeds');
const aliceOffer = SubmitSeedOffer(alice, 'tomato-red', 5, collections);
console.log(`   - Filled exchanges: ${aliceOffer.filledExchanges.length}`);
console.log(`   - Remaining offer: ${aliceOffer.remainingOffer?.quantity} packets\n`);

// Scenario 2: Bob requests tomato seeds
console.log('2. Bob requests tomato seeds');
const bobRequest1 = SubmitSeedRequest(bob, 'tomato-red', collections);
console.log(`   - Request filled: ${bobRequest1.filled}`);
console.log(`   - From user: ${bobRequest1.exchange?.offerUserId}\n`);

// Scenario 3: Charlie requests tomato seeds
console.log('3. Charlie requests tomato seeds');
const charlieRequest = SubmitSeedRequest(charlie, 'tomato-red', collections);
console.log(`   - Request filled: ${charlieRequest.filled}`);
console.log(`   - From user: ${charlieRequest.exchange?.offerUserId}\n`);

// Scenario 4: Bob requests carrot seeds (no offers available)
console.log('4. Bob requests carrot seeds');
const bobRequest2 = SubmitSeedRequest(bob, 'carrot-orange', collections);
console.log(`   - Request filled: ${bobRequest2.filled}`);
console.log(`   - Open request created: ${bobRequest2.remainingRequest?.id !== undefined}\n`);

// Scenario 5: Charlie offers carrot seeds (fills Bob's request)
console.log('5. Charlie offers 2 packets of carrot seeds');
const charlieOffer = SubmitSeedOffer(charlie, 'carrot-orange', 2, collections);
console.log(`   - Filled exchanges: ${charlieOffer.filledExchanges.length}`);
console.log(`   - Filled for user: ${charlieOffer.filledExchanges[0]?.requestUserId}`);
console.log(`   - Remaining offer: ${charlieOffer.remainingOffer?.quantity} packets\n`);

// Scenario 6: Alice requests lettuce seeds (no offers available)
console.log('6. Alice requests lettuce seeds');
const aliceRequest = SubmitSeedRequest(alice, 'lettuce-green', collections);
console.log(`   - Request filled: ${aliceRequest.filled}`);
console.log(`   - Open request created: ${aliceRequest.remainingRequest?.id !== undefined}\n`);

// Scenario 7: Alice cancels her lettuce request
console.log('7. Alice cancels her lettuce request');
const cancelResult = CancelExchange(alice, aliceRequest.remainingRequest!.id, collections);
console.log(`   - Cancellation successful: ${cancelResult.success}\n`);

// Show final state
console.log('=== Final State ===');
console.log(`Total confirmed exchanges: ${collections.getConfirmedExchanges().length}`);
console.log(`Open tomato offers: ${collections.getOpenOffersByPlant('tomato-red').length} (${collections.getOpenOffersByPlant('tomato-red')[0]?.quantity || 0} packets)`);
console.log(`Open carrot offers: ${collections.getOpenOffersByPlant('carrot-orange').length} (${collections.getOpenOffersByPlant('carrot-orange')[0]?.quantity || 0} packets)`);
console.log(`Open tomato requests: ${collections.getOpenRequestsByPlant('tomato-red').length}`);
console.log(`Open carrot requests: ${collections.getOpenRequestsByPlant('carrot-orange').length}`);
console.log(`Open lettuce requests: ${collections.getOpenRequestsByPlant('lettuce-green').length}`);
