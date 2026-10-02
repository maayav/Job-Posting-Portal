import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: [
      'tests/ai-grounding.test.js', 'tests/ai-provider.test.js',
      'tests/extraction-schema.test.js', 'tests/integration-services.test.js',
      'tests/request-budget.test.js', 'tests/analysis-budget.test.js',
      'tests/serverless-cors.test.js', 'tests/storage-service.test.js',
      'tests/test-environment.test.js', 'tests/resume-bounds.test.js',
      'tests/api-handler.test.js', 'tests/ontology-source.test.js',
      'tests/study-plan-ai.test.js',
    ],
  },
});
