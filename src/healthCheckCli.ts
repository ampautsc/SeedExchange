#!/usr/bin/env node

/**
 * Command-line interface for running health checks
 * 
 * Usage:
 *   npm run build
 *   node dist/healthCheckCli.js
 * 
 * Or with environment variables for Cosmos DB:
 *   COSMOS_DB_ENDPOINT=https://... COSMOS_DB_KEY=... node dist/healthCheckCli.js
 */

import { performHealthCheck, formatHealthCheckResult } from './healthCheck';

async function main() {
  console.log('='.repeat(60));
  console.log('SeedExchange API Health Check');
  console.log('='.repeat(60));
  console.log('');

  const storageType = process.env.COSMOS_DB_ENDPOINT ? 'Cosmos DB' : 'In-Memory';
  console.log(`Storage Backend: ${storageType}`);
  console.log('');

  try {
    const result = await performHealthCheck();
    const formatted = formatHealthCheckResult(result);

    console.log(formatted);
    console.log('');
    console.log('='.repeat(60));

    // Exit with appropriate code
    if (result.status === 'unhealthy') {
      console.error('❌ Health check FAILED');
      process.exit(1);
    } else if (result.status === 'degraded') {
      console.warn('⚠️  Health check shows DEGRADED status');
      process.exit(0); // Don't fail on degraded
    } else {
      console.log('✅ Health check PASSED');
      process.exit(0);
    }
  } catch (error) {
    console.error('='.repeat(60));
    console.error('❌ Health check encountered an error:');
    console.error(error);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main };
