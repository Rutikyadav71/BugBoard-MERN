import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

export function assertEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy server/.env.example to server/.env and fill it in.'
    );
  }
  if (process.env.JWT_SECRET === 'replace_with_a_long_random_string') {
    throw new Error('JWT_SECRET is still the placeholder value. Set a real random secret in server/.env.');
  }
}

export const env = {
  get port() {
    return Number(process.env.PORT) || 5000;
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get mongoUri() {
    return process.env.MONGODB_URI;
  },
  get jwtSecret() {
    return process.env.JWT_SECRET;
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '7d';
  },
  get clientUrl() {
    return process.env.CLIENT_URL || 'http://localhost:5173';
  },
};
