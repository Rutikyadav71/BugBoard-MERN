import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/User.js';

export const app = createApp();

export async function setupDb() {
  await connectDB();
}

export async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export async function teardownDb() {
  await clearDb();
  await disconnectDB();
}

// Creates a user directly in the DB (bypassing public registration so tests can make Admins).
export async function makeUser(overrides = {}) {
  const n = Math.random().toString(36).slice(2, 8);
  const user = await User.create({
    name: `User ${n}`,
    email: `user_${n}@test.com`,
    password: 'Password123',
    role: 'Tester',
    ...overrides,
  });
  const token = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token };
}

export const authed = (token) => ({ Authorization: `Bearer ${token}` });
export { request };
