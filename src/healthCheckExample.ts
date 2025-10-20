/**
 * Example demonstrating health check usage
 * 
 * This example shows how to:
 * 1. Run health checks at application startup
 * 2. Periodically monitor service health
 * 3. Handle different health statuses
 * 4. Log health check results
 */

import { performHealthCheck, formatHealthCheckResult, HealthCheckResult } from './healthCheck';
import { initializeCollections } from './collectionsFactory';

/**
 * Run health check at application startup
 */
async function startupHealthCheck(): Promise<boolean> {
  console.log('Running startup health check...');
  
  try {
    const result = await performHealthCheck();
    console.log(formatHealthCheckResult(result));
    
    if (result.status === 'unhealthy') {
      console.error('❌ Startup health check failed! Service cannot start.');
      return false;
    }
    
    if (result.status === 'degraded') {
      console.warn('⚠️  Startup health check shows degraded status. Proceeding with caution.');
    }
    
    console.log('✅ Startup health check passed. Service is ready.');
    return true;
  } catch (error) {
    console.error('❌ Startup health check error:', error);
    return false;
  }
}

/**
 * Run periodic health checks
 */
async function periodicHealthCheck(intervalMinutes: number): Promise<void> {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`Starting periodic health checks every ${intervalMinutes} minutes...`);
  
  const runCheck = async () => {
    const result = await performHealthCheck();
    const timestamp = new Date().toISOString();
    
    console.log(`\n[${timestamp}] Health Check Results:`);
    console.log(formatHealthCheckResult(result));
    
    // Take action based on status
    if (result.status === 'unhealthy') {
      console.error('⚠️  ALERT: Service is unhealthy!');
      // In production, you might want to:
      // - Send alerts (email, Slack, PagerDuty, etc.)
      // - Attempt automatic recovery
      // - Log to monitoring system
    } else if (result.status === 'degraded') {
      console.warn('⚠️  WARNING: Service is degraded');
      // In production, you might want to:
      // - Create a support ticket
      // - Scale resources
      // - Log to monitoring system
    }
  };
  
  // Run immediately
  await runCheck();
  
  // Then run periodically
  setInterval(runCheck, intervalMs);
}

/**
 * Health check with custom collections (useful for testing)
 */
async function healthCheckWithCustomCollections(): Promise<HealthCheckResult> {
  console.log('Running health check with custom collections...');
  
  const collections = await initializeCollections();
  const result = await performHealthCheck(collections);
  
  return result;
}

/**
 * Example of checking specific dependencies
 */
async function checkStorageHealth(): Promise<boolean> {
  const result = await performHealthCheck();
  
  const storageDep = result.dependencies.find(d => d.name === 'storage');
  
  if (!storageDep || storageDep.status !== 'healthy') {
    console.error('Storage dependency is not healthy:', storageDep);
    return false;
  }
  
  console.log('✅ Storage is healthy');
  console.log(`   Response time: ${storageDep.responseTime}ms`);
  console.log(`   Storage type: ${storageDep.details?.storageType}`);
  
  return true;
}

/**
 * Example main function showing typical usage
 */
async function main() {
  console.log('=== SeedExchange Health Check Example ===\n');
  
  // 1. Run startup health check
  const startupOk = await startupHealthCheck();
  
  if (!startupOk) {
    console.error('Cannot start application due to failed health check');
    process.exit(1);
  }
  
  console.log('\n---\n');
  
  // 2. Check specific dependency
  await checkStorageHealth();
  
  console.log('\n---\n');
  
  // 3. Run health check with custom collections
  const customResult = await healthCheckWithCustomCollections();
  console.log(`Custom health check status: ${customResult.status}`);
  
  console.log('\n---\n');
  
  // 4. Start periodic health checks (every 5 minutes)
  // Uncomment the line below to enable periodic checks
  // await periodicHealthCheck(5);
  
  console.log('Example complete!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Example error:', error);
    process.exit(1);
  });
}

export {
  startupHealthCheck,
  periodicHealthCheck,
  healthCheckWithCustomCollections,
  checkStorageHealth
};
