# Quick Setup Guide for SeedExchangeServiceIdentity

This guide provides the minimum steps needed to configure the SeedExchangeServiceIdentity managed identity for the SeedExchange application.

## Overview

The SeedExchange application now uses the **SeedExchangeServiceIdentity** managed identity to authenticate to Azure Key Vault and retrieve the Cosmos DB connection key. This provides secure, credential-free authentication.

## What You Need to Do

### 1. Create the Managed Identity (If It Doesn't Exist)

```bash
# Set your resource group
RESOURCE_GROUP="your-resource-group"

# Create the managed identity
az identity create \
  --name SeedExchangeServiceIdentity \
  --resource-group $RESOURCE_GROUP \
  --location eastus

# Get the identity details (save these for later)
az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP
```

### 2. Grant Key Vault Access

```bash
# Get the managed identity's object ID
IDENTITY_OBJECT_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query principalId -o tsv)

# Grant access to Key Vault
az keyvault set-policy \
  --name your-keyvault \
  --object-id $IDENTITY_OBJECT_ID \
  --secret-permissions get
```

### 3. Configure GitHub Actions (For CI/CD)

#### a. Create Federated Credential

```bash
# Create federated credential for GitHub Actions
az identity federated-credential create \
  --name github-seedexchange-main \
  --identity-name SeedExchangeServiceIdentity \
  --resource-group $RESOURCE_GROUP \
  --issuer https://token.actions.githubusercontent.com \
  --subject repo:ampautsc/SeedExchange:ref:refs/heads/main \
  --audiences api://AzureADTokenExchange
```

#### b. Set GitHub Repository Variables

Go to your repository **Settings** → **Secrets and variables** → **Actions** → **Variables** and add:

1. `AZURE_CLIENT_ID`: 
   ```bash
   az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query clientId -o tsv
   ```

2. `AZURE_TENANT_ID`:
   ```bash
   az account show --query tenantId -o tsv
   ```

3. `AZURE_SUBSCRIPTION_ID`:
   ```bash
   az account show --query id -o tsv
   ```

4. `COSMOS_DB_ENDPOINT`: Your Cosmos DB endpoint (e.g., `https://your-cosmos.documents.azure.com:443/`)

5. `AZURE_KEY_VAULT_URI`: Your Key Vault URI (e.g., `https://your-keyvault.vault.azure.net/`)

### 4. Configure Azure App Service or Functions (If Deploying)

```bash
# Get the managed identity resource ID
IDENTITY_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query id -o tsv)

# Assign to App Service
az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name your-app-name \
  --identities $IDENTITY_ID

# Configure application settings
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name your-app-name \
  --settings \
    COSMOS_DB_ENDPOINT="https://your-cosmos.documents.azure.com:443/" \
    AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/"
```

## Verification

### Test GitHub Actions

1. Go to your repository's **Actions** tab
2. Select the **Test Suite** workflow
3. Click **Run workflow**
4. The workflow should now authenticate using the managed identity and retrieve the Cosmos DB key from Key Vault

### Test Locally (Developers)

Developers don't need the managed identity for local development. They should:

```bash
# Login with Azure CLI
az login

# Set environment variables
export COSMOS_DB_ENDPOINT="https://your-cosmos.documents.azure.com:443/"
export AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/"

# Run the application
npm run build
node dist/example.js
```

You should see:
```
Initializing Cosmos DB collections...
✓ Retrieved Cosmos DB key from Azure Key Vault
✓ Cosmos DB collections initialized successfully
```

## Troubleshooting

### "Failed to retrieve Cosmos DB key from Key Vault"

Check:
1. The managed identity exists: `az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP`
2. Key Vault access is granted: `az keyvault show-policy --name your-keyvault`
3. The secret exists in Key Vault: `az keyvault secret show --vault-name your-keyvault --name CosmosDbKey`

### GitHub Actions fails with "AADSTS700016"

This means the federated credential is not configured. Run:
```bash
az identity federated-credential list --identity-name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP
```

If empty, follow step 3a above to create it.

### "ManagedIdentityCredential authentication failed"

For local development: Run `az login`
For Azure resources: Verify the managed identity is assigned to the resource

## Next Steps

- See [MANAGED_IDENTITY_SETUP.md](./MANAGED_IDENTITY_SETUP.md) for comprehensive documentation
- See [SETUP_COSMOS_DB.md](./SETUP_COSMOS_DB.md) for Cosmos DB configuration details
- Monitor Key Vault access logs in the Azure Portal

## Support

If you need help:
1. Check the [MANAGED_IDENTITY_SETUP.md](./MANAGED_IDENTITY_SETUP.md) troubleshooting section
2. Verify all environment variables are set correctly
3. Check Azure AD and Key Vault audit logs
4. Create an issue in the repository

## Summary of Changes Made

The following files have been updated to support the SeedExchangeServiceIdentity:

- `.github/workflows/test.yml` - Added OIDC authentication and Azure login
- `.github/workflows/health-check.yml` - Enabled Cosmos DB health checks with managed identity
- `src/cosmosDbConfig.ts` - Added documentation about managed identity usage
- `README.md` - Added reference to managed identity
- `SETUP_COSMOS_DB.md` - Updated with SeedExchangeServiceIdentity instructions
- `MANAGED_IDENTITY_SETUP.md` - Comprehensive setup guide (new file)

All changes are backward compatible. The application will still work with:
- Azure CLI authentication (for local development)
- Environment variables (for testing)
- The new managed identity (for production)
