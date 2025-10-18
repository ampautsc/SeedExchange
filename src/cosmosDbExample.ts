/**
 * Example demonstrating how to use the Seed Exchange API with Azure Cosmos DB
 * 
 * Prerequisites:
 * 1. Set up environment variables:
 *    - COSMOS_DB_ENDPOINT
 *    - COSMOS_DB_KEY
 *    - COSMOS_DB_DATABASE_ID (optional, defaults to "SeedExchange")
 *    - COSMOS_DB_CONTAINER_ID (optional, defaults to "SeedExchanges")
 * 
 * 2. Run this example:
 *    node dist/cosmosDbExample.js
 */

import { 
  CosmosDbSeedExchangeCollections, 
  getCosmosDbConfig,
  SubmitSeedOffer,
  SubmitSeedRequest,
  Withdraw,
  AzureUserToken 
} from './index';

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

async function runCosmosDbDemo() {
  try {
    console.log('=== Seed Exchange with Azure Cosmos DB Demo ===\n');

    // Initialize Cosmos DB collections
    console.log('Initializing Azure Cosmos DB connection...');
    const config = getCosmosDbConfig();
    const collections = await CosmosDbSeedExchangeCollections.initialize(config);
    console.log('✓ Connected to Cosmos DB\n');

    // Clear any existing data (for demo purposes)
    console.log('Clearing existing data...');
    await collections.clear();
    console.log('✓ Data cleared\n');

    // Scenario 1: Alice offers tomato seeds
    console.log('1. Alice offers 5 packets of tomato seeds');
    const aliceOffer = await SubmitSeedOffer(alice, 'tomato-red', 5, collections);
    console.log(`   ✓ Filled exchanges: ${aliceOffer.filledExchanges.length}`);
    console.log(`   ✓ Remaining offer: ${aliceOffer.remainingOffer?.quantity} packets`);
    console.log(`   ✓ Offer ID: ${aliceOffer.remainingOffer?.id}\n`);

    // Scenario 2: Bob requests tomato seeds
    console.log('2. Bob requests tomato seeds');
    const bobRequest1 = await SubmitSeedRequest(bob, 'tomato-red', collections);
    console.log(`   ✓ Request filled: ${bobRequest1.filled}`);
    console.log(`   ✓ From user: ${bobRequest1.exchange?.offerUserId}`);
    console.log(`   ✓ Exchange ID: ${bobRequest1.exchange?.id}\n`);

    // Scenario 3: Charlie requests tomato seeds
    console.log('3. Charlie requests tomato seeds');
    const charlieRequest = await SubmitSeedRequest(charlie, 'tomato-red', collections);
    console.log(`   ✓ Request filled: ${charlieRequest.filled}`);
    console.log(`   ✓ From user: ${charlieRequest.exchange?.offerUserId}`);
    console.log(`   ✓ Exchange ID: ${charlieRequest.exchange?.id}\n`);

    // Scenario 4: Bob requests carrot seeds (no offers available)
    console.log('4. Bob requests carrot seeds (no offers available)');
    const bobRequest2 = await SubmitSeedRequest(bob, 'carrot-orange', collections);
    console.log(`   ✓ Request filled: ${bobRequest2.filled}`);
    console.log(`   ✓ Open request created: ${bobRequest2.remainingRequest !== undefined}`);
    console.log(`   ✓ Request ID: ${bobRequest2.remainingRequest?.id}\n`);

    // Scenario 5: Charlie offers carrot seeds (fills Bob's request)
    console.log('5. Charlie offers 2 packets of carrot seeds');
    const charlieOffer = await SubmitSeedOffer(charlie, 'carrot-orange', 2, collections);
    console.log(`   ✓ Filled exchanges: ${charlieOffer.filledExchanges.length}`);
    console.log(`   ✓ Filled for user: ${charlieOffer.filledExchanges[0]?.requestUserId}`);
    console.log(`   ✓ Remaining offer: ${charlieOffer.remainingOffer?.quantity} packet(s)`);
    console.log(`   ✓ Exchange ID: ${charlieOffer.filledExchanges[0]?.id}\n`);

    // Scenario 6: Alice requests lettuce seeds (no offers available)
    console.log('6. Alice requests lettuce seeds (no offers available)');
    const aliceRequest = await SubmitSeedRequest(alice, 'lettuce-green', collections);
    console.log(`   ✓ Request filled: ${aliceRequest.filled}`);
    console.log(`   ✓ Open request created: ${aliceRequest.remainingRequest !== undefined}`);
    console.log(`   ✓ Request ID: ${aliceRequest.remainingRequest?.id}\n`);

    // Scenario 7: Alice withdraws her lettuce request
    console.log('7. Alice withdraws her lettuce request');
    const withdrawResult = await Withdraw(alice, aliceRequest.remainingRequest!.id, collections);
    console.log(`   ✓ Withdrawal successful: ${withdrawResult.success}\n`);

    // Show final state from Cosmos DB
    console.log('=== Final State (from Cosmos DB) ===');
    const confirmedExchanges = await collections.getConfirmedExchanges();
    const openTomatoOffers = await collections.getOpenOffersByPlant('tomato-red');
    const openCarrotOffers = await collections.getOpenOffersByPlant('carrot-orange');
    const openTomatoRequests = await collections.getOpenRequestsByPlant('tomato-red');
    const openCarrotRequests = await collections.getOpenRequestsByPlant('carrot-orange');
    const openLettuceRequests = await collections.getOpenRequestsByPlant('lettuce-green');
    
    console.log(`Total confirmed exchanges: ${confirmedExchanges.length}`);
    console.log(`Open tomato offers: ${openTomatoOffers.length} (${openTomatoOffers[0]?.quantity || 0} packets)`);
    console.log(`Open carrot offers: ${openCarrotOffers.length} (${openCarrotOffers[0]?.quantity || 0} packets)`);
    console.log(`Open tomato requests: ${openTomatoRequests.length}`);
    console.log(`Open carrot requests: ${openCarrotRequests.length}`);
    console.log(`Open lettuce requests: ${openLettuceRequests.length}`);

    console.log('\n✓ Demo completed successfully!');
    console.log('\nNote: All data is now persisted in Azure Cosmos DB and will remain');
    console.log('even after this application exits. Run this demo again to see the');
    console.log('data persist (or uncomment the clear() call to start fresh).\n');

  } catch (error) {
    console.error('\n✗ Error running demo:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runCosmosDbDemo().catch(console.error);
}

export { runCosmosDbDemo };
