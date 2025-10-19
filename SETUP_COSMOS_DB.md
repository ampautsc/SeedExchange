# Setting Up Cosmos DB Integration

## Overview

The SeedExchange API now automatically uses Azure Cosmos DB when the appropriate environment variables are configured. This document explains how to set up Cosmos DB integration for different environments.

## Prerequisites

1. **Azure Cosmos DB Account**: Create an Azure Cosmos DB account in the Azure Portal
2. **Connection Details**: Obtain your Cosmos DB endpoint and key from the Azure Portal:
   - Navigate to your Cosmos DB account
   - Go to "Keys" section
   - Copy the "URI" (endpoint) and "PRIMARY KEY" or "SECONDARY KEY"

## Environment Variables

The following environment variables are required for Cosmos DB integration:

### Required
- `COSMOS_DB_ENDPOINT`: Your Cosmos DB account endpoint (e.g., `https://your-account.documents.azure.com:443/`)
- `COSMOS_DB_KEY`: Your Cosmos DB account key (primary or secondary)

### Optional
- `COSMOS_DB_DATABASE_ID`: Database name (defaults to "SeedExchange" if not specified)
- `COSMOS_DB_CONTAINER_ID`: Container name (defaults to "SeedExchanges" if not specified)

## Setup Instructions

### Local Development

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your actual Cosmos DB credentials:
   ```bash
   COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
   COSMOS_DB_KEY=your-actual-cosmos-db-key-here
   COSMOS_DB_DATABASE_ID=SeedExchange
   COSMOS_DB_CONTAINER_ID=SeedExchanges
   ```

3. Load the environment variables:
   ```bash
   source .env  # or use dotenv in your application
   ```

4. Run your application - it will automatically use Cosmos DB:
   ```bash
   npm run build
   node dist/example.js
   ```

### GitHub Actions / CI/CD

To use Cosmos DB in GitHub Actions workflows:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:
   - Name: `COSMOS_DB_ENDPOINT`
     Value: Your Cosmos DB endpoint URL
   - Name: `COSMOS_DB_KEY`
     Value: Your Cosmos DB key

4. Update your workflow file (`.github/workflows/test.yml`) to use these secrets:

```yaml
- name: Run Cosmos DB integration tests
  env:
    COSMOS_DB_ENDPOINT: ${{ secrets.COSMOS_DB_ENDPOINT }}
    COSMOS_DB_KEY: ${{ secrets.COSMOS_DB_KEY }}
  run: npm test
```

### Azure App Service / Functions

1. Navigate to your App Service or Function App in Azure Portal
2. Go to **Configuration** → **Application settings**
3. Add new application settings:
   - `COSMOS_DB_ENDPOINT`: Your endpoint
   - `COSMOS_DB_KEY`: Your key
   - `COSMOS_DB_DATABASE_ID`: (optional)
   - `COSMOS_DB_CONTAINER_ID`: (optional)

### Docker / Container Deployments

Pass environment variables when running the container:

```bash
docker run -e COSMOS_DB_ENDPOINT="https://..." \
           -e COSMOS_DB_KEY="..." \
           your-image
```

Or use a `.env` file:

```bash
docker run --env-file .env your-image
```

### Kubernetes

Create a Secret:

```bash
kubectl create secret generic cosmos-db-secret \
  --from-literal=endpoint='https://...' \
  --from-literal=key='your-key'
```

Reference in your deployment:

```yaml
env:
  - name: COSMOS_DB_ENDPOINT
    valueFrom:
      secretKeyRef:
        name: cosmos-db-secret
        key: endpoint
  - name: COSMOS_DB_KEY
    valueFrom:
      secretKeyRef:
        name: cosmos-db-secret
        key: key
```

## Testing the Configuration

### Verify Cosmos DB Connection

Run the example application to verify the connection:

```bash
npm run build
node dist/example.js
```

If configured correctly, you should see:
```
Initializing Cosmos DB collections...
✓ Cosmos DB collections initialized successfully
```

If not configured, you'll see:
```
Using in-memory collections (set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY to use Cosmos DB)
```

### Run Cosmos DB Example

The repository includes a comprehensive Cosmos DB example:

```bash
npm run build
node dist/cosmosDbExample.js
```

## Troubleshooting

### Connection Issues

If you see errors like "Failed to initialize Cosmos DB collections":

1. **Verify credentials**: Double-check your endpoint and key
2. **Check network**: Ensure you can reach the Cosmos DB endpoint
3. **Firewall rules**: Verify your IP is allowed in Cosmos DB firewall settings
4. **Key permissions**: Ensure the key has proper read/write permissions

### Fallback Behavior

The application is designed to gracefully fall back to in-memory storage if:
- Cosmos DB credentials are not provided
- Cosmos DB connection fails
- Any errors occur during initialization

This ensures the application continues to work even if Cosmos DB is unavailable.

## Security Best Practices

1. **Never commit secrets**: Always use `.env` or secret management tools
2. **Use environment-specific keys**: Different keys for dev, staging, and production
3. **Rotate keys regularly**: Update keys periodically for security
4. **Restrict IP access**: Configure Cosmos DB firewall to allow only specific IPs
5. **Use Key Vault**: Consider Azure Key Vault for production environments

## Monitoring

Once connected to Cosmos DB, you can monitor usage in the Azure Portal:

1. Navigate to your Cosmos DB account
2. View metrics for:
   - Request units consumed
   - Storage used
   - Number of operations
3. Set up alerts for unusual activity

## Cost Management

- **Free tier**: Cosmos DB offers a free tier (400 RU/s, 25 GB storage)
- **Request units**: Monitor RU consumption to manage costs
- **Throughput**: Adjust provisioned throughput based on usage
- **Autoscale**: Consider autoscale for variable workloads

## Next Steps

After setting up Cosmos DB:

1. Test basic operations with the example application
2. Monitor performance and RU consumption
3. Adjust indexing policies if needed
4. Set up backup policies
5. Configure multi-region replication if required

For more information, see the main [README.md](README.md) file.
