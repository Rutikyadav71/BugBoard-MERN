// Test isolation: a dedicated database name so tests never touch development data.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_only_0123456789abcdef';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGODB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bugboard_test';
// AI: tests must never reach a real model or spend API quota. Always use the offline mock provider.
process.env.AI_PROVIDER = 'mock';
process.env.AI_ENABLED = 'true';
delete process.env.GEMINI_API_KEY;
process.env.AI_RATE_LIMIT_PER_MINUTE = '1000';
process.env.AI_DAILY_LIMIT_PER_USER = '100000';
process.env.AI_DAILY_LIMIT_GLOBAL = '1000000';
