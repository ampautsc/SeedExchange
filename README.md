# SeedExchange
Camp Monarch's Seed Exchange API

A TypeScript-based API for managing seed exchanges between users. The API supports submitting seed offers and requests, with automatic matching and fulfillment.

## Features

- **Submit Seed Offers**: Users can offer seed packets, which automatically fill pending requests
- **Submit Seed Requests**: Users request seed packets (always 1 packet), which are filled from available offers
- **FIFO Matching**: Requests and offers are matched in first-in-first-out order
- **Azure Authentication**: Uses Azure user tokens to identify users
- **Automatic Fill Management**: Removes fulfilled requests/offers and tracks all fills

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
import { SubmitSeedOffer, SubmitSeedRequest, collections } from 'seed-exchange-api';

// Define user authentication token
const user = {
  userId: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

// Submit a seed offer (5 packets of tomatoes)
const offerResult = SubmitSeedOffer(user, 'tomato-123', 5, collections);
console.log('Filled requests:', offerResult.filledRequests);
console.log('Remaining offer:', offerResult.remainingOffer);

// Submit a seed request (always 1 packet)
const requestResult = SubmitSeedRequest(user, 'carrot-456', collections);
console.log('Request filled:', requestResult.filled);
console.log('Fill details:', requestResult.fill);
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
- `filledRequests: SeedFill[]` - Array of requests that were filled
- `remainingOffer?: OpenSeedOffer` - Remaining offer if quantity > filled requests

**Behavior:**
1. Checks OpenSeedRequest collection for matching plant requests
2. Fills as many requests as possible (FIFO order)
3. Records remaining quantity in OpenSeedOffer collection
4. Removes filled requests and adds details to SeedFill collection
5. Does not fill own requests

### SubmitSeedRequest

Submits a seed request to the exchange (always 1 packet).

**Parameters:**
- `authToken: AzureUserToken` - Authentication token identifying the user
- `plantId: string` - ID of the plant being requested
- `collections: SeedExchangeCollections` - Collection manager instance

**Returns:** `SubmitSeedRequestResult`
- `filled: boolean` - Whether the request was filled
- `fill?: SeedFill` - Fill details if request was filled
- `remainingRequest?: OpenSeedRequest` - Request details if not filled

**Behavior:**
1. Checks OpenSeedOffer collection for matching plant offers
2. Fills from first available offer (FIFO order)
3. Records unfilled request in OpenSeedRequest collection
4. Removes/updates offers and adds fill details to SeedFill collection
5. Does not fill from own offers

## Data Models

### OpenSeedRequest
- `id: string` - Unique identifier
- `plantId: string` - Plant identifier
- `userId: string` - User who made the request
- `quantity: number` - Always 1 packet
- `timestamp: Date` - When request was made

### OpenSeedOffer
- `id: string` - Unique identifier
- `plantId: string` - Plant identifier
- `userId: string` - User who made the offer
- `quantity: number` - Number of packets available
- `timestamp: Date` - When offer was made

### SeedFill
- `id: string` - Unique identifier
- `plantId: string` - Plant identifier
- `offerUserId: string` - User who made the offer
- `requestUserId: string` - User who made the request
- `quantity: number` - Number of packets filled
- `timestamp: Date` - When fill occurred

## License

ISC

