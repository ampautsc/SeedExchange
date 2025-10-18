# SeedExchange
Camp Monarch's Seed Exchange API

A TypeScript-based API for managing seed exchanges between users. The API supports submitting seed offers and requests, with automatic matching and fulfillment, as well as the ability to withdraw open requests or offers.

## Features

- **Submit Seed Offers**: Users can offer seed packets, which automatically fill pending requests
- **Submit Seed Requests**: Users request seed packets (always 1 packet), which are filled from available offers
- **Withdraw Exchanges**: Users can withdraw their own open requests or offers
- **FIFO Matching**: Requests and offers are matched in first-in-first-out order
- **Azure Authentication**: Uses Azure user tokens to identify users
- **Unified Data Model**: Single SeedExchange collection tracks the full lifecycle from request/offer to confirmation and delivery

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Usage

```typescript
import { SubmitSeedOffer, SubmitSeedRequest, Withdraw, collections } from 'seed-exchange-api';

// Define user authentication token
const user = {
  userId: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

// Submit a seed offer (5 packets of tomatoes)
const offerResult = SubmitSeedOffer(user, 'tomato-123', 5, collections);
console.log('Filled exchanges:', offerResult.filledExchanges);
console.log('Remaining offer:', offerResult.remainingOffer);

// Submit a seed request (always 1 packet)
const requestResult = SubmitSeedRequest(user, 'carrot-456', collections);
console.log('Request filled:', requestResult.filled);
console.log('Exchange details:', requestResult.exchange);

// Withdraw an open request or offer
const withdrawResult = Withdraw(user, requestResult.remainingRequest!.id, collections);
console.log('Withdrawal successful:', withdrawResult.success);
```

## API Reference

### SubmitSeedOffer

Submits a seed offer to the exchange.

**Parameters:**
- `authToken: AzureUserToken` - Authentication token identifying the user
- `plantId: string` - ID of the plant being offered
- `packetQuantity: number` - Number of packets being offered
- `collections: SeedExchangeCollections` - Collection manager instance

**Returns:** `SubmitSeedOfferResult`
- `filledExchanges: SeedExchange[]` - Array of exchanges that were confirmed
- `remainingOffer?: SeedExchange` - Remaining offer if quantity > filled requests

**Behavior:**
1. Checks for open requests matching the plant
2. Fills as many requests as possible (FIFO order)
3. Creates confirmed exchanges for each match
4. Records remaining quantity as an open offer if needed
5. Does not fill own requests

### SubmitSeedRequest

Submits a seed request to the exchange (always 1 packet).

**Parameters:**
- `authToken: AzureUserToken` - Authentication token identifying the user
- `plantId: string` - ID of the plant being requested
- `collections: SeedExchangeCollections` - Collection manager instance

**Returns:** `SubmitSeedRequestResult`
- `filled: boolean` - Whether the request was filled
- `exchange?: SeedExchange` - Confirmed exchange if request was filled
- `remainingRequest?: SeedExchange` - Request details if not filled

**Behavior:**
1. Checks for open offers matching the plant
2. Fills from first available offer (FIFO order)
3. Creates a confirmed exchange if filled
4. Records unfilled request as an open request if needed
5. Does not fill from own offers

### Withdraw

Withdraws an open seed request or offer.

**Parameters:**
- `authToken: AzureUserToken` - Authentication token identifying the user
- `exchangeId: string` - ID of the exchange to withdraw
- `collections: SeedExchangeCollections` - Collection manager instance

**Returns:** `WithdrawResult`
- `success: boolean` - Whether withdrawal was successful
- `withdrawnExchange?: SeedExchange` - Details of withdrawn exchange

**Behavior:**
1. Verifies the exchange exists and is owned by the user
2. Cannot withdraw confirmed exchanges (only open requests/offers)
3. Removes the exchange from the collection

## Data Model

### SeedExchange

The unified data model that tracks the complete lifecycle of a seed exchange:

- `id: string` - Unique identifier
- `plantId: string` - Plant identifier
- `requestUserId: string | null` - User who made the request (null for open offers)
- `offerUserId: string | null` - User who made the offer (null for open requests)
- `quantity: number` - Number of packets
- `seedRequestTime: Date | null` - When request was made
- `seedOfferTime: Date | null` - When offer was made
- `confirmationTime: Date | null` - When exchange was confirmed (matched)
- `shipTime: Date | null` - When seeds were shipped (future use)
- `receivedTime: Date | null` - When seeds were received (future use)

**Exchange States:**
- **Open Request**: `requestUserId` set, `offerUserId` null, `confirmationTime` null
- **Open Offer**: `offerUserId` set, `requestUserId` null, `confirmationTime` null
- **Confirmed Exchange**: Both `requestUserId` and `offerUserId` set, `confirmationTime` set

## License

ISC

