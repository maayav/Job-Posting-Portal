import { z } from 'zod';
import { User } from '../models/user.js';
import { AppError } from '../utils/errors.js';
import { startSession, endSession } from '../services/sessionService.js';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req, res) {
  const data = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409, 'email_taken');
  }

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
  });

  const token = await startSession(user);

  res.status(201).json({
    token,
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  });
}

export async function login(req, res) {
  const data = loginSchema.parse(req.body);

  const user = await User.findOne({ email: data.email }).select('+password');
  if (!user || !(await user.comparePassword(data.password))) {
    throw new AppError('Invalid email or password', 401, 'invalid_credentials');
  }

  const token = await startSession(user);

  res.json({
    token,
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  });
}

export async function logout(req, res) {
  await endSession(req.user.id);
  res.status(204).end();
}