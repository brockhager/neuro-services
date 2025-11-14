#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Run tests with randomized delays to catch race conditions
 * This simulates real-world timing variations that can expose async bugs
 */

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestsWithDelays() {
  console.log('🧪 Running tests with randomized delays to catch race conditions...\n');

  const testFiles = [
    'src/swarm-intelligence/swarm-coordinator.test.ts',
    'src/communication/secure-communication.test.ts',
    'src/agent-registry/agent-registry.test.ts',
    'src/tokenomics/tokenomics-engine.test.ts',
    'tests/index.test.ts'
  ];

  const results = [];

  for (const testFile of testFiles) {
    if (fs.existsSync(testFile)) {
      console.log(`\n📋 Running ${testFile}...`);

      // Add random delay between 100-500ms to simulate timing variations
      const delay = Math.floor(Math.random() * 400) + 100;
      console.log(`⏱️  Adding ${delay}ms delay before test execution...`);
      await sleep(delay);

      try {
        const output = execSync(`npm test -- --testPathPattern="${path.basename(testFile)}"`, {
          encoding: 'utf8',
          stdio: 'pipe'
        });

        console.log('✅ PASSED');
        results.push({ file: testFile, status: 'PASSED' });
      } catch (error) {
        console.log('❌ FAILED');
        console.log(error.stdout);
        results.push({ file: testFile, status: 'FAILED', error: error.stdout });
      }
    } else {
      console.log(`⚠️  Skipping ${testFile} (file not found)`);
      results.push({ file: testFile, status: 'SKIPPED' });
    }
  }

  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));

  let passed = 0, failed = 0, skipped = 0;

  results.forEach(result => {
    console.log(`${result.status.padEnd(8)} ${result.file}`);
    if (result.status === 'PASSED') passed++;
    else if (result.status === 'FAILED') failed++;
    else if (result.status === 'SKIPPED') skipped++;
  });

  console.log('\n📈 Totals:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Skipped: ${skipped}`);

  if (failed > 0) {
    console.log('\n💥 Race condition detection: Some tests failed with randomized timing!');
    console.log('This may indicate async bugs that need fixing.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed with randomized delays!');
    console.log('No race conditions detected in this run.');
  }
}

runTestsWithDelays().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});