# SeedExchangeServiceIdentity Managed Identity Setup

## Overview

The SeedExchange API uses the **SeedExchangeServiceIdentity** managed identity to authenticate to Azure Key Vault for retrieving the Cosmos DB connection key. This document provides detailed instructions for setting up and configuring this managed identity across different environments.

## What is SeedExchangeServiceIdentity?

**SeedExchangeServiceIdentity** is a user-assigned managed identity in Azure that provides the SeedExchange application with a secure identity to access Azure resources without storing credentials in code or configuration.

### Benefits

- **No credential management**: No passwords, keys, or secrets to manage or rotate
- **Automatic credential rotation**: Azure handles credential rotation automatically
- **Centralized access control**: Single identity to manage across all environments
- **Audit trail**: All access attempts are logged in Azure AD

## Prerequisites

- Azure subscription with permissions to create and manage resources
- Azure CLI installed and configured
- Appropriate permissions to create managed identities and configure Key Vault

## Creating the Managed Identity

If the SeedExchangeServiceIdentity doesn't already exist, create it:

```bash
# Set your resource group and location
RESOURCE_GROUP="your-resource-group"
LOCATION="eastus"

# Create the managed identity
az identity create \
  --name SeedExchangeServiceIdentity \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Retrieve the identity details
IDENTITY_CLIENT_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query clientId -o tsv)
IDENTITY_OBJECT_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query principalId -o tsv)
IDENTITY_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query id -o tsv)

echo "Client ID: $IDENTITY_CLIENT_ID"
echo "Object ID: $IDENTITY_OBJECT_ID"
echo "Resource ID: $IDENTITY_ID"
```

## Granting Key Vault Access

Grant the SeedExchangeServiceIdentity permission to read secrets from your Key Vault:

```bash
# Set your Key Vault name
KEY_VAULT_NAME="your-keyvault"

# Get the managed identity's object ID
IDENTITY_OBJECT_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query principalId -o tsv)

# Grant Get secret permissions
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $IDENTITY_OBJECT_ID \
  --secret-permissions get
```

## Environment-Specific Configuration

### 1. GitHub Actions (CI/CD)

For GitHub Actions to use the SeedExchangeServiceIdentity, configure OIDC federated credentials:

#### Create Federated Credential

```bash
# Get the managed identity client ID
IDENTITY_CLIENT_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query clientId -o tsv)

# Create federated credential for main branch
az identity federated-credential create \
  --name github-seedexchange-main \
  --identity-name SeedExchangeServiceIdentity \
  --resource-group $RESOURCE_GROUP \
  --issuer https://token.actions.githubusercontent.com \
  --subject repo:your-org/SeedExchange:ref:refs/heads/main \
  --audiences api://AzureADTokenExchange

# Optionally, create federated credential for pull requests
az identity federated-credential create \
  --name github-seedexchange-pr \
  --identity-name SeedExchangeServiceIdentity \
  --resource-group $RESOURCE_GROUP \
  --issuer https://token.actions.githubusercontent.com \
  --subject repo:your-org/SeedExchange:pull_request \
  --audiences api://AzureADTokenExchange
```

#### Configure GitHub Repository Variables

Add the following repository variables in GitHub (Settings → Secrets and variables → Actions → Variables):

- `AZURE_CLIENT_ID`: The SeedExchangeServiceIdentity client ID
- `AZURE_TENANT_ID`: Your Azure tenant ID
- `AZURE_SUBSCRIPTION_ID`: Your Azure subscription ID
- `COSMOS_DB_ENDPOINT`: Your Cosmos DB endpoint
- `AZURE_KEY_VAULT_URI`: Your Key Vault URI

To get the tenant ID and subscription ID:

```bash
# Get tenant ID
az account show --query tenantId -o tsv

# Get subscription ID
az account show --query id -o tsv
```

#### Workflow Configuration

The workflows in `.github/workflows/test.yml` and `.github/workflows/health-check.yml` are already configured to use these variables. They will:

1. Authenticate to Azure using OIDC
2. Assume the SeedExchangeServiceIdentity
3. Access Key Vault to retrieve the Cosmos DB key

### 2. Azure App Service

Assign the SeedExchangeServiceIdentity to your App Service:

```bash
# Set your App Service name
APP_SERVICE_NAME="your-app-service"

# Get the managed identity resource ID
IDENTITY_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query id -o tsv)

# Assign to App Service
az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --identities $IDENTITY_ID
```

Then configure application settings:

```bash
# Set environment variables
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings \
    COSMOS_DB_ENDPOINT="https://your-cosmos.documents.azure.com:443/" \
    AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/" \
    AZURE_CLIENT_ID="$IDENTITY_CLIENT_ID"
```

### 3. Azure Functions

Assign the SeedExchangeServiceIdentity to your Function App:

```bash
# Set your Function App name
FUNCTION_APP_NAME="your-function-app"

# Get the managed identity resource ID
IDENTITY_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query id -o tsv)

# Assign to Function App
az functionapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --identities $IDENTITY_ID
```

Then configure application settings:

```bash
# Set environment variables
az functionapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --settings \
    COSMOS_DB_ENDPOINT="https://your-cosmos.documents.azure.com:443/" \
    AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/" \
    AZURE_CLIENT_ID="$IDENTITY_CLIENT_ID"
```

### 4. Azure Container Instances

Assign the SeedExchangeServiceIdentity when creating a container:

```bash
# Get the managed identity resource ID
IDENTITY_ID=$(az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query id -o tsv)

# Create container instance with managed identity
az container create \
  --resource-group $RESOURCE_GROUP \
  --name seedexchange-container \
  --image your-registry/seedexchange:latest \
  --assign-identity $IDENTITY_ID \
  --environment-variables \
    COSMOS_DB_ENDPOINT="https://your-cosmos.documents.azure.com:443/" \
    AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/" \
    AZURE_CLIENT_ID="$IDENTITY_CLIENT_ID"
```

### 5. Azure Kubernetes Service (AKS)

Use Azure AD Workload Identity for AKS:

```bash
# Create service account
kubectl create serviceaccount seedexchange-sa

# Annotate service account with managed identity client ID
kubectl annotate serviceaccount seedexchange-sa \
  azure.workload.identity/client-id=$IDENTITY_CLIENT_ID

# Create federated credential for the service account
az identity federated-credential create \
  --name aks-seedexchange \
  --identity-name SeedExchangeServiceIdentity \
  --resource-group $RESOURCE_GROUP \
  --issuer $(az aks show --resource-group $RESOURCE_GROUP --name your-aks-cluster --query "oidcIssuerProfile.issuerUrl" -o tsv) \
  --subject system:serviceaccount:default:seedexchange-sa \
  --audiences api://AzureADTokenExchange
```

Then use the service account in your deployment:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: seedexchange
  labels:
    azure.workload.identity/use: "true"
spec:
  serviceAccountName: seedexchange-sa
  containers:
  - name: seedexchange
    image: your-registry/seedexchange:latest
    env:
    - name: COSMOS_DB_ENDPOINT
      value: "https://your-cosmos.documents.azure.com:443/"
    - name: AZURE_KEY_VAULT_URI
      value: "https://your-keyvault.vault.azure.net/"
```

### 6. Local Development

For local development, developers should use Azure CLI authentication instead of the managed identity:

```bash
# Login to Azure
az login

# Set environment variables
export COSMOS_DB_ENDPOINT="https://your-cosmos.documents.azure.com:443/"
export AZURE_KEY_VAULT_URI="https://your-keyvault.vault.azure.net/"

# Run the application
npm run build
node dist/example.js
```

The `DefaultAzureCredential` in the code will automatically use Azure CLI credentials for local development.

## How DefaultAzureCredential Works

The application uses `DefaultAzureCredential` from `@azure/identity`, which automatically tries authentication methods in this order:

1. **Environment variables** - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`
2. **Managed Identity** - For Azure resources (App Service, Functions, VMs, AKS)
3. **Azure CLI** - For local development (`az login`)
4. **Azure PowerShell** - For PowerShell users
5. **Interactive browser** - As a fallback

In production (Azure App Service, Functions, etc.), it will automatically use the assigned SeedExchangeServiceIdentity managed identity.

## Verification

### Verify Managed Identity Access

Test that the managed identity can access Key Vault:

```bash
# Get an access token using the managed identity (run from Azure resource)
ACCESS_TOKEN=$(curl -H "Metadata:true" "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net&client_id=$IDENTITY_CLIENT_ID" | jq -r .access_token)

# Test accessing a secret
curl -H "Authorization: Bearer $ACCESS_TOKEN" "https://your-keyvault.vault.azure.net/secrets/CosmosDbKey?api-version=7.3"
```

### Test Application Authentication

Run the application and check logs:

```bash
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

### Error: "Failed to retrieve Cosmos DB key from Key Vault"

**Possible causes:**
1. Managed identity not assigned to the resource
2. Key Vault access policy not configured
3. Incorrect Key Vault URI or secret name

**Solutions:**
```bash
# Verify identity is assigned
az webapp identity show --resource-group $RESOURCE_GROUP --name $APP_SERVICE_NAME

# Verify Key Vault access policy
az keyvault show --name $KEY_VAULT_NAME --query "properties.accessPolicies[?objectId=='$IDENTITY_OBJECT_ID']"

# Test access manually
az keyvault secret show --vault-name $KEY_VAULT_NAME --name CosmosDbKey
```

### Error: "AADSTS700016: Application with identifier was not found"

**Cause:** Federated credential not configured or incorrect client ID

**Solution:**
```bash
# List federated credentials
az identity federated-credential list --identity-name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP

# Verify client ID matches
az identity show --name SeedExchangeServiceIdentity --resource-group $RESOURCE_GROUP --query clientId
```

### Error: "ManagedIdentityCredential authentication failed"

**Possible causes:**
1. Running locally without Azure CLI authentication
2. Managed identity not available in the environment

**Solutions:**
- For local development: Run `az login`
- For Azure resources: Verify managed identity is assigned
- Check that `AZURE_CLIENT_ID` is set if using user-assigned identity

## Security Best Practices

1. **Principle of Least Privilege**: Grant only `Get` permission for secrets, not `List` or `Set`
2. **Separate identities per environment**: Use different managed identities for dev, staging, and production
3. **Enable Key Vault logging**: Monitor who accesses secrets and when
4. **Rotate secrets regularly**: Update Cosmos DB keys periodically
5. **Use network restrictions**: Limit Key Vault access to specific networks when possible
6. **Audit federated credentials**: Regularly review and remove unused federated credentials

## Monitoring and Auditing

### Enable Diagnostic Logging

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name seedexchange-logs

# Get workspace ID
WORKSPACE_ID=$(az monitor log-analytics workspace show --resource-group $RESOURCE_GROUP --workspace-name seedexchange-logs --query id -o tsv)

# Enable Key Vault diagnostics
az monitor diagnostic-settings create \
  --name KeyVaultAudit \
  --resource $(az keyvault show --name $KEY_VAULT_NAME --query id -o tsv) \
  --workspace $WORKSPACE_ID \
  --logs '[{"category": "AuditEvent", "enabled": true}]'
```

### Query Access Logs

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.KEYVAULT"
| where OperationName == "SecretGet"
| where identity_claim_appid_g == "<your-identity-client-id>"
| project TimeGenerated, CallerIPAddress, ResultSignature, requestUri_s
```

## Additional Resources

- [Azure Managed Identities Documentation](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/)
- [Azure Key Vault Access Policies](https://docs.microsoft.com/azure/key-vault/general/assign-access-policy)
- [Workload Identity Federation](https://docs.microsoft.com/azure/active-directory/develop/workload-identity-federation)
- [DefaultAzureCredential Documentation](https://docs.microsoft.com/javascript/api/@azure/identity/defaultazurecredential)

## Support

For issues or questions about the SeedExchangeServiceIdentity managed identity setup, please contact your Azure administrator or create an issue in the repository.
