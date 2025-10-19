# Health Check Standards

This document defines the standards and best practices for implementing and using health checks in the SeedExchange API.

## Overview

Health checks are essential for monitoring service availability and dependency status. The SeedExchange API provides comprehensive health check functionality that tests all critical dependencies and returns structured status information.

## Health Check Endpoint

### Purpose

The health check verifies that:
1. The service can start and initialize correctly
2. Storage backend (in-memory or Cosmos DB) is accessible
3. All CRUD operations work as expected
4. Dependencies return expected data

### Implementation

The health check is implemented in `src/healthCheck.ts` and provides:

```typescript
import { performHealthCheck, formatHealthCheckResult } from 'seed-exchange-api';

// Perform health check
const result = await performHealthCheck();

// Format for display
const formatted = formatHealthCheckResult(result);
console.log(formatted);
```

## Health Check Standards

### 1. Status Levels

The health check returns one of three status levels:

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `healthy` | All dependencies functioning normally | None |
| `degraded` | Service operational but some non-critical issues detected | Monitor closely |
| `unhealthy` | Critical dependency failure | Immediate investigation required |

### 2. Response Format

Health check results follow a consistent structure:

```typescript
interface HealthCheckResult {
  status: HealthStatus;           // Overall status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date;                // When the check was performed
  dependencies: DependencyHealth[]; // Status of each dependency
  version?: string;               // Service version
}

interface DependencyHealth {
  name: string;                   // Dependency name (e.g., 'storage')
  status: HealthStatus;           // Dependency status
  message: string;                // Human-readable status message
  responseTime?: number;          // Response time in milliseconds
  details?: Record<string, unknown>; // Additional details
}
```

### 3. Dependency Checks

#### Storage Backend Check

The storage health check verifies:

- **Write operation**: Can create new records
- **Read operation**: Can retrieve created records
- **Query operation**: Can query records by criteria
- **Delete operation**: Can remove records
- **Data integrity**: Retrieved data matches written data
- **Cleanup**: Test data is properly removed

**Pass criteria**: All operations complete successfully within acceptable time
**Fail criteria**: Any operation fails or returns incorrect data
**Degraded criteria**: Operations work but with warnings or slower than expected

### 4. Test Data Management

Health checks use temporary test data:
- Test records use the prefix `health-check-` in IDs
- Test plant ID: `health-check-plant`
- Test user ID: `health-check-user`
- All test data is cleaned up after the check completes
- Test data should never persist in the production database

### 5. Response Time Expectations

| Storage Backend | Expected Response Time | Warning Threshold | Critical Threshold |
|-----------------|----------------------|-------------------|-------------------|
| In-Memory | < 10ms | > 50ms | > 100ms |
| Cosmos DB | < 100ms | > 500ms | > 1000ms |

### 6. Error Handling

Health checks must:
- Never throw unhandled exceptions
- Always return a structured `HealthCheckResult`
- Include error details in the `details` field
- Log errors for debugging without exposing sensitive information

### 7. Monitoring and Alerting

#### Automated Health Checks

The repository includes a GitHub Action (`.github/workflows/health-check.yml`) that:
- Runs automatically on a schedule (daily at 6:00 AM UTC)
- Can be manually triggered via workflow_dispatch
- Tests both in-memory and Cosmos DB backends (if configured)
- Reports failures and creates issues for investigation

#### Manual Health Checks

To run a manual health check:

```bash
# Build the project
npm run build

# Run health check with in-memory storage
node -e "
const { performHealthCheck, formatHealthCheckResult } = require('./dist/healthCheck');
performHealthCheck().then(result => {
  console.log(formatHealthCheckResult(result));
  process.exit(result.status === 'unhealthy' ? 1 : 0);
});
"

# Run health check with Cosmos DB (requires environment variables)
export COSMOS_DB_ENDPOINT="https://your-account.documents.azure.com:443/"
export COSMOS_DB_KEY="your-key"
node -e "
const { performHealthCheck, formatHealthCheckResult } = require('./dist/healthCheck');
performHealthCheck().then(result => {
  console.log(formatHealthCheckResult(result));
  process.exit(result.status === 'unhealthy' ? 1 : 0);
});
"
```

#### GitHub Action Usage

**Manual Trigger:**

1. Go to Actions tab in GitHub repository
2. Select "Health Check" workflow
3. Click "Run workflow"
4. Choose environment (in-memory or cosmos-db)
5. Click "Run workflow" button

**Scheduled Runs:**

The workflow runs automatically every day at 6:00 AM UTC.

**On Code Changes:**

The workflow runs automatically when changes are made to:
- `src/healthCheck.ts`
- `.github/workflows/health-check.yml`

### 8. Integration with CI/CD

Health checks should be integrated into deployment pipelines:

```yaml
# Example CI/CD integration
- name: Run health check
  run: npm run build && node -e "..."
  
- name: Verify health
  run: |
    if [ $? -ne 0 ]; then
      echo "Health check failed, stopping deployment"
      exit 1
    fi
```

### 9. Best Practices

#### For Developers

1. **Run health checks locally** before committing changes to storage-related code
2. **Add new dependency checks** when adding new external dependencies
3. **Update response time thresholds** based on observed performance
4. **Test health check failure scenarios** to ensure proper error handling
5. **Document any new health check criteria** in this standards document

#### For Operations

1. **Monitor health check results** from automated runs
2. **Investigate degraded status** within 24 hours
3. **Respond to unhealthy status** immediately
4. **Track response time trends** to identify performance degradation
5. **Keep Cosmos DB credentials** up to date in GitHub secrets

#### For Testing

1. **Include health check tests** in the test suite
2. **Test all status levels** (healthy, degraded, unhealthy)
3. **Verify cleanup** of test data
4. **Mock failures** to test error handling
5. **Test both storage backends** when applicable

## Example Usage

### Basic Health Check

```typescript
import { performHealthCheck, formatHealthCheckResult } from 'seed-exchange-api';

async function checkServiceHealth() {
  const result = await performHealthCheck();
  
  if (result.status === 'healthy') {
    console.log('✅ Service is healthy');
  } else if (result.status === 'degraded') {
    console.warn('⚠️ Service is degraded:', result);
  } else {
    console.error('❌ Service is unhealthy:', result);
  }
  
  return result;
}
```

### Health Check with Custom Collections

```typescript
import { performHealthCheck, initializeCollections } from 'seed-exchange-api';

async function checkWithCustomConfig() {
  // Initialize with specific configuration
  const collections = await initializeCollections();
  
  // Run health check with these collections
  const result = await performHealthCheck(collections);
  
  return result;
}
```

### Programmatic Status Check

```typescript
import { performHealthCheck } from 'seed-exchange-api';

async function isServiceHealthy(): Promise<boolean> {
  const result = await performHealthCheck();
  return result.status === 'healthy';
}

async function startupCheck() {
  const healthy = await isServiceHealthy();
  if (!healthy) {
    throw new Error('Service failed startup health check');
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Health Check Fails with "Storage error"

**Cause**: Cosmos DB credentials are invalid or endpoint is unreachable

**Solution**: 
- Verify `COSMOS_DB_ENDPOINT` is correct
- Check that `COSMOS_DB_KEY` or Key Vault credentials are valid
- Ensure network connectivity to Cosmos DB

#### 2. Health Check Passes but Service Fails

**Cause**: Health check may not cover all failure scenarios

**Solution**:
- Review health check implementation
- Add checks for missing dependencies
- Verify test coverage of health check module

#### 3. Slow Health Check Response Times

**Cause**: Network latency or Cosmos DB performance issues

**Solution**:
- Check Cosmos DB performance metrics
- Review partition key strategy
- Consider caching for health checks

#### 4. Test Data Not Cleaned Up

**Cause**: Exception during health check prevented cleanup

**Solution**:
- Health check includes cleanup in try-finally blocks
- Manually query for `health-check-*` records and remove them
- Review logs for errors during cleanup

## Metrics and SLAs

### Service Level Objectives (SLOs)

- **Availability**: 99.9% uptime
- **Health Check Success Rate**: > 99%
- **Response Time**: < 100ms for in-memory, < 500ms for Cosmos DB

### Key Performance Indicators (KPIs)

- Number of health check failures per day
- Average health check response time
- Time to recovery from unhealthy status
- Percentage of degraded vs healthy checks

## Compliance and Security

### Security Considerations

1. **Never expose sensitive data** in health check responses
2. **Limit error details** in production environments
3. **Use secure credentials** for Cosmos DB (Key Vault recommended)
4. **Restrict health check endpoint** access if exposed via API

### Compliance

Health checks support compliance requirements by:
- Demonstrating service availability
- Providing audit trail of service health
- Enabling proactive monitoring
- Supporting incident response procedures

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-10-19 | Initial health check standards |

## References

- [Health Check Implementation](./src/healthCheck.ts)
- [Health Check Tests](./src/healthCheck.test.ts)
- [GitHub Action Workflow](./.github/workflows/health-check.yml)
- [README - Storage Options](./README.md#storage-options)
