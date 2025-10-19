# Quick Start Guide - How to Enable Cosmos DB

This guide provides **step-by-step instructions** for enabling Cosmos DB in your SeedExchange API.

## 🎯 What You Need

You only need **TWO pieces of information** from Azure:

1. **Cosmos DB Endpoint** (a URL)
2. **Cosmos DB Key** (a long string)

## 📋 Step-by-Step Instructions

### Step 1: Get Your Cosmos DB Credentials

1. Go to the [Azure Portal](https://portal.azure.com)
2. Find your Cosmos DB account
3. Click on **"Keys"** in the left menu
4. You'll see two important values:
   - **URI** - This is your `COSMOS_DB_ENDPOINT`
   - **PRIMARY KEY** - This is your Cosmos DB key

**Copy these two values** - you'll need them in the next step.

### Step 2: Choose Your Setup Method

You have **two options**. Choose ONE based on your needs:

---

## ✅ OPTION A: Simple Setup (For Testing/Development)

**Use this if:** You want to test quickly on your local machine or in GitHub Actions

### For Local Testing:

1. Create a `.env` file in your project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```bash
   COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
   COSMOS_DB_KEY=your-actual-primary-key-here
   ```

3. Run your application:
   ```bash
   npm run build
   node dist/example.js
   ```

### For GitHub Actions:

1. Go to your GitHub repository: https://github.com/ampautsc/SeedExchange
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add TWO secrets:
   
   **First Secret:**
   - Name: `COSMOS_DB_ENDPOINT`
   - Value: `https://your-account.documents.azure.com:443/` (paste your URI from Step 1)
   
   **Second Secret:**
   - Name: `COSMOS_DB_KEY`
   - Value: (paste your PRIMARY KEY from Step 1)

5. That's it! Your GitHub Actions will now use Cosmos DB when these secrets are present.

**✅ Done!** Your app will now automatically use Cosmos DB.

---

## 🔒 OPTION B: Secure Setup (For Production - Recommended)

**Use this if:** You're deploying to production and want maximum security

This option stores your Cosmos DB key in **Azure Key Vault** instead of as a plain text secret.

### Prerequisites:
- Azure subscription
- Azure CLI installed (`az --version` to check)

### Instructions:

1. **Create an Azure Key Vault** (if you don't have one):
   ```bash
   az keyvault create \
     --name seedexchange-vault \
     --resource-group your-resource-group \
     --location eastus
   ```

2. **Store your Cosmos DB key in the vault**:
   ```bash
   az keyvault secret set \
     --vault-name seedexchange-vault \
     --name CosmosDbKey \
     --value "your-actual-primary-key-here"
   ```

3. **For local development**, login to Azure:
   ```bash
   az login
   ```

4. **Set environment variables** (NOT the key, just the vault URI):
   ```bash
   export COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
   export AZURE_KEY_VAULT_URI=https://seedexchange-vault.vault.azure.net/
   ```

5. **Run your application**:
   ```bash
   npm run build
   node dist/example.js
   ```

**✅ Done!** The app will retrieve the key from Key Vault automatically.

### For Production Deployment (Azure App Service):

1. Enable **Managed Identity** on your App Service
2. Grant the managed identity access to your Key Vault:
   ```bash
   az keyvault set-policy \
     --name seedexchange-vault \
     --object-id <your-app-service-managed-identity-id> \
     --secret-permissions get
   ```

3. Set **Application Settings** in Azure Portal:
   - `COSMOS_DB_ENDPOINT`: `https://your-account.documents.azure.com:443/`
   - `AZURE_KEY_VAULT_URI`: `https://seedexchange-vault.vault.azure.net/`

**✅ Done!** Your app will securely retrieve the key from Key Vault.

---

## 🚀 Verify It's Working

After setup, run your application and look for this message:

**If using Key Vault:**
```
Initializing Cosmos DB collections...
✓ Retrieved Cosmos DB key from Azure Key Vault
✓ Cosmos DB collections initialized successfully
```

**If using environment variable:**
```
Initializing Cosmos DB collections...
✓ Cosmos DB collections initialized successfully
```

**If not configured:**
```
Using in-memory collections (set COSMOS_DB_ENDPOINT and AZURE_KEY_VAULT_URI or COSMOS_DB_KEY to use Cosmos DB)
```

## ❓ Which Option Should I Choose?

| Scenario | Recommended Option |
|----------|-------------------|
| Testing locally | **Option A** (Simple Setup) |
| GitHub Actions testing | **Option A** (Simple Setup) |
| Production deployment | **Option B** (Secure Setup with Key Vault) |
| Azure App Service | **Option B** (Secure Setup with Key Vault) |
| Quick demo | **Option A** (Simple Setup) |

## 📝 Summary

**Option A (Simple):**
- ✅ Quick to set up
- ✅ Good for testing
- ⚠️ Not recommended for production
- **You need:** `COSMOS_DB_ENDPOINT` + `COSMOS_DB_KEY`

**Option B (Secure):**
- ✅ Production-ready
- ✅ Maximum security
- ✅ Industry best practice
- **You need:** `COSMOS_DB_ENDPOINT` + `AZURE_KEY_VAULT_URI` + Key Vault setup

## 🆘 Need More Help?

- **Detailed setup guide:** See [SETUP_COSMOS_DB.md](SETUP_COSMOS_DB.md)
- **Migration guide:** See [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)
- **General usage:** See [README.md](README.md)

## 🔑 Key Points

1. **You don't need to change any code** - just set environment variables or secrets
2. **The app detects credentials automatically** - no manual configuration needed
3. **It falls back gracefully** - if Cosmos DB isn't configured, it uses in-memory storage
4. **For production, use Key Vault** - for everything else, environment variables are fine

---

**Ready to proceed?** Choose Option A or B above and follow the steps!
