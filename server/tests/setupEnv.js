// Test isolation: a dedicated database name so tests never touch development data.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_jest_only_0123456789abcdef';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGODB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/bugboard_test';
