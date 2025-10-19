# Setting Up Cosmos DB Integration

## Overview

The SeedExchange API now automatically uses Azure Cosmos DB when the appropriate environment variables are configured. For production environments, the API integrates with Azure Key Vault to securely retrieve the Cosmos DB key, ensuring credentials are never stored in plain text.

## Prerequisites

1. **Azure Cosmos DB Account**: Create an Azure Cosmos DB account in the Azure Portal
2. **Connection Details**: Obtain your Cosmos DB endpoint from the Azure Portal:
   - Navigate to your Cosmos DB account
   - Go to "Keys" section
   - Copy the "URI" (endpoint)
3. **Azure Key Vault** (Recommended for production): Create an Azure Key Vault to securely store your Cosmos DB key

## Environment Variables

### Required
- `COSMOS_DB_ENDPOINT`: Your Cosmos DB account endpoint (e.g., `https://your-account.documents.azure.com:443/`)

### Key Storage (Choose One)

**Option 1: Azure Key Vault (Recommended for Production)**
- `AZURE_KEY_VAULT_URI`: Your Key Vault URI (e.g., `https://your-keyvault.vault.azure.net/`)
- `COSMOS_DB_KEY_SECRET_NAME`: Name of the secret in Key Vault (optional, defaults to "CosmosDbKey")

**Option 2: Environment Variable (Development Only)**
- `COSMOS_DB_KEY`: Your Cosmos DB account key (primary or secondary) - **NOT recommended for production**

### Optional
- `COSMOS_DB_DATABASE_ID`: Database name (defaults to "SeedExchange" if not specified)
- `COSMOS_DB_CONTAINER_ID`: Container name (defaults to "SeedExchanges" if not specified)

## Setup Instructions

### Production Deployment (Using Azure Key Vault)

1. **Create Azure Key Vault** (if not already created):
   ```bash
   az keyvault create --name your-keyvault --resource-group your-resource-group --location eastus
   ```

2. **Store Cosmos DB key in Key Vault**:
   ```bash
   az keyvault secret set --vault-name your-keyvault --name CosmosDbKey --value "your-actual-cosmos-db-key"
   ```

3. **Configure managed identity** for your application:
   - For Azure App Service/Functions: Enable system-assigned managed identity
   - For local development: Use Azure CLI authentication (`az login`)

4. **Grant Key Vault access** to your application's managed identity:
   ```bash
   az keyvault set-policy --name your-keyvault --object-id <your-managed-identity-id> --secret-permissions get
   ```

5. **Set environment variables**:
   ```bash
   export COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
   export AZURE_KEY_VAULT_URI=https://your-keyvault.vault.azure.net/
   ```

### Local Development

**Option 1: Using Azure Key Vault (Recommended)**

1. Ensure you're logged in with Azure CLI:
   ```bash
   az login
   ```

2. Set environment variables:
   ```bash
   export COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
   export AZURE_KEY_VAULT_URI=https://your-keyvault.vault.azure.net/
   ```

3. Run your application - it will retrieve the key from Key Vault using your Azure CLI credentials.

**Option 2: Using Environment Variable (Quick Testing)**

1. Copy the `.env.example` file (included in the repository) to `.env`:
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

**Option 1: Using Azure Key Vault (Recommended)**

Configure your GitHub Actions workflow to use Azure credentials and Key Vault:

1. Create a service principal and configure OIDC:
   ```bash
   az ad sp create-for-rbac --name "github-actions-seedexchange" --role contributor \
     --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group}
   ```

2. Grant the service principal access to Key Vault:
   ```bash
   az keyvault set-policy --name your-keyvault --spn <service-principal-app-id> --secret-permissions get
   ```

3. Add GitHub secrets for Azure authentication:
   - `AZURE_CLIENT_ID`: Service principal app ID
   - `AZURE_TENANT_ID`: Azure tenant ID
   - `AZURE_SUBSCRIPTION_ID`: Azure subscription ID

4. Update your workflow file:

```yaml
- name: Azure Login
  uses: azure/login@v1
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- name: Run Cosmos DB integration tests
  env:
    COSMOS_DB_ENDPOINT: ${{ secrets.COSMOS_DB_ENDPOINT }}
    AZURE_KEY_VAULT_URI: ${{ secrets.AZURE_KEY_VAULT_URI }}
  run: npm test
```

**Option 2: Using GitHub Secrets (Development Only)**

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:
   - Name: `COSMOS_DB_ENDPOINT`
     Value: Your Cosmos DB endpoint URL
   - Name: `COSMOS_DB_KEY`
     Value: Your Cosmos DB key

4. Update your workflow file (`.github/workflows/test.yml`):

```yaml
- name: Run Cosmos DB integration tests
  env:
    COSMOS_DB_ENDPOINT: ${{ secrets.COSMOS_DB_ENDPOINT }}
    COSMOS_DB_KEY: ${{ secrets.COSMOS_DB_KEY }}
  run: npm test
```

### Azure App Service / Functions

**Using Azure Key Vault (Recommended)**

1. Enable system-assigned managed identity:
   - Navigate to your App Service or Function App in Azure Portal
   - Go to **Identity** → **System assigned**
   - Turn status to **On** and save

2. Grant managed identity access to Key Vault:
   ```bash
   az keyvault set-policy --name your-keyvault \
     --object-id <managed-identity-object-id> \
     --secret-permissions get
   ```

3. Configure application settings:
   - Go to **Configuration** → **Application settings**
   - Add:
     - `COSMOS_DB_ENDPOINT`: Your endpoint
     - `AZURE_KEY_VAULT_URI`: Your Key Vault URI
     - `COSMOS_DB_DATABASE_ID`: (optional)
     - `COSMOS_DB_CONTAINER_ID`: (optional)

**Alternative: Direct Configuration (Not Recommended)**

Add application settings:
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

**With Azure Key Vault configured:**
```
Initializing Cosmos DB collections...
✓ Retrieved Cosmos DB key from Azure Key Vault
✓ Cosmos DB collections initialized successfully
```

**With environment variable:**
```
Initializing Cosmos DB collections...
✓ Cosmos DB collections initialized successfully
```

**Without configuration:**
```
Using in-memory collections (set COSMOS_DB_ENDPOINT and AZURE_KEY_VAULT_URI or COSMOS_DB_KEY to use Cosmos DB)
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
- Key Vault is unavailable or misconfigured
- Cosmos DB connection fails
- Any errors occur during initialization

This ensures the application continues to work even if Cosmos DB is unavailable.

## Security Best Practices

1. **Always use Azure Key Vault in production**: Never store Cosmos DB keys in environment variables for production deployments
2. **Use managed identities**: Enable managed identity for Azure resources to avoid storing credentials
3. **Never commit secrets**: Always use `.env` files (which should be in `.gitignore`) or secret management tools
4. **Use environment-specific Key Vaults**: Different Key Vaults for dev, staging, and production
5. **Rotate keys regularly**: Update keys periodically and update them in Key Vault
6. **Restrict IP access**: Configure Cosmos DB firewall to allow only specific IPs
7. **Audit Key Vault access**: Enable diagnostic logging in Key Vault to monitor secret access
8. **Use least privilege**: Grant only necessary permissions to managed identities and service principals

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
