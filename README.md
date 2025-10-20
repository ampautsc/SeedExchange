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
- **Multiple Storage Options**: Supports both in-memory storage (for testing/development) and Azure Cosmos DB (for production)
- **Health Checks**: Comprehensive health monitoring for service and dependencies

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

Run all tests (unit tests and end-to-end tests):

```bash
npm test
```

Run tests with coverage:

```bash
npm test -- --coverage
```

The test suite includes:
- **Unit tests** (`src/api.test.ts`): Comprehensive tests for individual API operations
- **End-to-end tests** (`src/e2e.test.ts`): Complete workflow validation including multi-user scenarios, FIFO ordering, withdrawals, and edge cases

### Continuous Integration

The repository includes a GitHub Actions workflow (`.github/workflows/test.yml`) that automatically:
- Runs on all pushes and pull requests to main/master branches
- Tests on Node.js 18.x and 20.x
- Executes linting, building, and all tests with coverage reporting
- Can be manually triggered via workflow_dispatch

## Storage Options

### Automatic Storage Selection

The API automatically selects the appropriate storage backend based on environment configuration:
- **Cosmos DB**: Used when `COSMOS_DB_ENDPOINT` and `COSMOS_DB_KEY` environment variables are set
- **In-Memory**: Used as fallback when Cosmos DB credentials are not available

```typescript
import { initializeCollections, SubmitSeedOffer } from 'seed-exchange-api';

// Automatically uses Cosmos DB if configured, otherwise in-memory
const collections = await initializeCollections();

const user = {
  userId: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

const offerResult = await SubmitSeedOffer(user, 'tomato-123', 5, collections);
console.log('Offer created:', offerResult);
```

### In-Memory Storage (Development/Testing)

The in-memory storage implementation is ideal for development, testing, and scenarios where persistence is not required. Data is stored in a JavaScript Map and will be lost when the application stops.

```typescript
import { SeedExchangeCollections } from 'seed-exchange-api';

// Create an in-memory collection
const collections = new SeedExchangeCollections();
```

Or use the factory function:

```typescript
import { getInMemoryCollections } from 'seed-exchange-api';

// Explicitly get in-memory collections
const collections = getInMemoryCollections();
```

### Azure Cosmos DB Storage (Production)

For production deployments, use Azure Cosmos DB for persistent, scalable storage. This implementation automatically handles database and container creation.

#### Prerequisites

1. Create an Azure Cosmos DB account
2. Obtain the connection endpoint from the Azure Portal
3. Store the Cosmos DB key securely in Azure Key Vault (recommended) or use environment variables

#### Configuration Options

**Option 1: Azure Key Vault (Recommended for Production)**

```bash
export COSMOS_DB_ENDPOINT="https://your-account.documents.azure.com:443/"
export AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/"
# Optional: specify secret name (defaults to "CosmosDbKey")
export COSMOS_DB_KEY_SECRET_NAME="CosmosDbKey"
```

Store your Cosmos DB key in Azure Key Vault as a secret named "CosmosDbKey" (or your custom name).

**Option 2: Environment Variable (Development Only)**

```bash
export COSMOS_DB_ENDPOINT="https://your-account.documents.azure.com:443/"
export COSMOS_DB_KEY="your-cosmos-db-key"
```

**Note:** For production, always use Azure Key Vault to store sensitive credentials.

**Optional Configuration:**

```bash
export COSMOS_DB_DATABASE_ID="SeedExchange"  # Optional, defaults to "SeedExchange"
export COSMOS_DB_CONTAINER_ID="SeedExchanges"  # Optional, defaults to "SeedExchanges"
```

#### Automatic Usage

Once environment variables are set, simply use `initializeCollections()`:

```typescript
import { initializeCollections, SubmitSeedOffer } from 'seed-exchange-api';

// Will automatically use Cosmos DB when credentials are available
// Retrieves key from Key Vault if AZURE_KEY_VAULT_URI is set
const collections = await initializeCollections();
const result = await SubmitSeedOffer(user, plantId, quantity, collections);
```

#### Manual Usage

```typescript
import { 
  CosmosDbSeedExchangeCollections, 
  getCosmosDbConfig,
  SubmitSeedOffer,
  SubmitSeedRequest 
} from 'seed-exchange-api';

// Initialize Cosmos DB collections
const config = getCosmosDbConfig();
const collections = await CosmosDbSeedExchangeCollections.initialize(config);

// Use the same API as in-memory collections
const user = {
  userId: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

const offerResult = await SubmitSeedOffer(user, 'tomato-123', 5, collections);
console.log('Offer created:', offerResult);
```

#### Cosmos DB Configuration

The Cosmos DB implementation uses:
- **Partition Key**: `plantId` - Ensures efficient querying by plant type
- **Indexing**: Automatic indexing on all paths for flexible queries
- **Container**: `SeedExchanges` - Stores all seed exchange documents

## Health Checks

The SeedExchange API includes comprehensive health check functionality to monitor service availability and dependency status.

### Running Health Checks

**Programmatically:**

```typescript
import { performHealthCheck, formatHealthCheckResult } from 'seed-exchange-api';

// Perform health check
const result = await performHealthCheck();

// Display formatted results
console.log(formatHealthCheckResult(result));

// Check status programmatically
if (result.status === 'healthy') {
  console.log('✅ All systems operational');
} else if (result.status === 'degraded') {
  console.warn('⚠️ Service degraded');
} else {
  console.error('❌ Service unhealthy');
}
```

**Via Command Line:**

```bash
# Using npm script (recommended)
npm run health-check

# Or manually after building
npm run build
node dist/healthCheckCli.js

# With Cosmos DB
COSMOS_DB_ENDPOINT=https://... COSMOS_DB_KEY=... npm run health-check
```

**Programmatically:**

```bash
npm run build
node -e "
const { performHealthCheck, formatHealthCheckResult } = require('./dist/healthCheck');
performHealthCheck().then(result => {
  console.log(formatHealthCheckResult(result));
  process.exit(result.status === 'unhealthy' ? 1 : 0);
});
"
```

**Via GitHub Actions:**

The repository includes a [Health Check workflow](.github/workflows/health-check.yml) that can be:
- Manually triggered via the Actions tab
- Scheduled to run daily at 6:00 AM UTC
- Automatically run when health check code changes

To manually trigger:
1. Go to the Actions tab in GitHub
2. Select "Health Check" workflow
3. Click "Run workflow"
4. Choose environment (in-memory or cosmos-db)

### Health Check Features

The health check verifies:
- ✅ Storage backend connectivity (in-memory or Cosmos DB)
- ✅ Write operations (create records)
- ✅ Read operations (retrieve records)
- ✅ Query operations (search records)
- ✅ Delete operations (remove records)
- ✅ Data integrity (correct data returned)
- ✅ Cleanup (test data removed)

### Health Status Levels

| Status | Meaning | Example |
|--------|---------|---------|
| `healthy` | All dependencies functioning normally | All operations complete successfully |
| `degraded` | Service operational with non-critical issues | Slower than expected response times |
| `unhealthy` | Critical dependency failure | Cannot connect to Cosmos DB |

### Health Check Response

```typescript
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  dependencies: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    responseTime?: number;
    details?: Record<string, unknown>;
  }>;
  version?: string;
}
```

For complete health check documentation, see [HEALTH_CHECK_STANDARDS.md](./HEALTH_CHECK_STANDARDS.md).

## Usage

### Recommended Approach (Automatic Storage Selection)

```typescript
import { SubmitSeedOffer, SubmitSeedRequest, Withdraw, initializeCollections } from 'seed-exchange-api';

// Initialize collections (automatically uses Cosmos DB if configured)
const collections = await initializeCollections();

// Define user authentication token
const user = {
  userId: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

// Submit a seed offer (5 packets of tomatoes)
const offerResult = await SubmitSeedOffer(user, 'tomato-123', 5, collections);
console.log('Filled exchanges:', offerResult.filledExchanges);
console.log('Remaining offer:', offerResult.remainingOffer);

// Submit a seed request (always 1 packet)
const requestResult = await SubmitSeedRequest(user, 'carrot-456', collections);
console.log('Request filled:', requestResult.filled);
console.log('Exchange details:', requestResult.exchange);

// Withdraw an open request or offer
const withdrawResult = await Withdraw(user, requestResult.remainingRequest!.id, collections);
console.log('Withdrawal successful:', withdrawResult.success);
```

### Alternative: Using In-Memory Collections Directly

```typescript
import { SubmitSeedOffer, SubmitSeedRequest, Withdraw, collections } from 'seed-exchange-api';

// Define user authentication token
const user = {
  userId: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
};

// Submit a seed offer (5 packets of tomatoes)
const offerResult = await SubmitSeedOffer(user, 'tomato-123', 5, collections);
console.log('Filled exchanges:', offerResult.filledExchanges);
console.log('Remaining offer:', offerResult.remainingOffer);

// Submit a seed request (always 1 packet)
const requestResult = await SubmitSeedRequest(user, 'carrot-456', collections);
console.log('Request filled:', requestResult.filled);
console.log('Exchange details:', requestResult.exchange);

// Withdraw an open request or offer
const withdrawResult = await Withdraw(user, requestResult.remainingRequest!.id, collections);
console.log('Withdrawal successful:', withdrawResult.success);
```

## API Reference

### SubmitSeedOffer

Submits a seed offer to the exchange.

**Parameters:**
- `authToken: AzureUserToken` - Authentication token identifying the user
- `plantId: string` - ID of the plant being offered
- `packetQuantity: number` - Number of packets being offered
- `collections: ISeedExchangeCollections` - Collection manager instance (in-memory or Cosmos DB)

**Returns:** `Promise<SubmitSeedOfferResult>`
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
- `collections: ISeedExchangeCollections` - Collection manager instance (in-memory or Cosmos DB)

**Returns:** `Promise<SubmitSeedRequestResult>`
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
- `collections: ISeedExchangeCollections` - Collection manager instance (in-memory or Cosmos DB)

**Returns:** `Promise<WithdrawResult>`
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
- `plantId: string` - Plant identifier (used as partition key in Cosmos DB)
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

## Implementation Details

### Storage Abstraction

The API uses the `ISeedExchangeCollections` interface to abstract storage operations, allowing seamless switching between in-memory and Cosmos DB storage:

```typescript
interface ISeedExchangeCollections {
  getOpenRequestsByPlant(plantId: string): Promise<SeedExchange[]>;
  getOpenOffersByPlant(plantId: string): Promise<SeedExchange[]>;
  getConfirmedExchanges(): Promise<SeedExchange[]>;
  getExchangesByUser(userId: string): Promise<SeedExchange[]>;
  addExchange(exchange: SeedExchange): Promise<void>;
  getExchange(id: string): Promise<SeedExchange | undefined>;
  removeExchange(id: string): Promise<void>;
  updateExchange(exchange: SeedExchange): Promise<void>;
  getAllExchanges(): Promise<SeedExchange[]>;
  clear(): Promise<void>;
}
```

### Cosmos DB Design

The Cosmos DB implementation is optimized for the seed exchange workload:

1. **Partition Key**: Uses `plantId` as the partition key, enabling efficient queries for offers and requests by plant type
2. **Indexing**: Automatic indexing on all paths for flexible query patterns
3. **Data Serialization**: Properly handles Date objects by converting to/from ISO strings
4. **Query Patterns**: Optimized SQL queries for common operations (open requests, open offers, confirmed exchanges)
5. **Initialization**: Automatic database and container creation with proper schema

### Async API

All API functions are async and return Promises, supporting both in-memory and Cosmos DB storage:

- `SubmitSeedOffer()` - Returns `Promise<SubmitSeedOfferResult>`
- `SubmitSeedRequest()` - Returns `Promise<SubmitSeedRequestResult>`
- `Withdraw()` - Returns `Promise<WithdrawResult>`

## Examples

### Basic Example (In-Memory)

See `src/example.ts` for a complete demonstration using in-memory storage.

### Cosmos DB Example

See `src/cosmosDbExample.ts` for a complete demonstration using Azure Cosmos DB.

To run the Cosmos DB example:

```bash
# Set up environment variables
export COSMOS_DB_ENDPOINT="https://your-account.documents.azure.com:443/"
export COSMOS_DB_KEY="your-key"

# Build and run
npm run build
node dist/cosmosDbExample.js
```

## License

ISC

