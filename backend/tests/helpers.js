import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';

export { app };

export async function initDb() {
  await connectDB({ retry: false });
}

export async function closeDb() {
  await disconnectDB();
}

export async function clearDb() {
  if (!mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function registerUser({ name = 'Test Student', email, password = 'secret123', role = 'student' } = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email: email ?? `u_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`, password });
  return res.body;
}

export async function loginUser(email, password = 'secret123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body;
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function makeAdmin(email) {
  const mongoose = (await import('mongoose')).default;
  const { User } = await import('../src/models/user.js');
  const user = await User.findOne({ email });
  if (!user) throw new Error(`user ${email} not found`);
  user.role = 'admin';
  await user.save();
  return user;
}

export async function uploadResume(token, { buffer, filename = 'resume.pdf', github = '', role = 'SDE' } = {}) {
  const req = request(app).post('/api/profile').set('Authorization', `Bearer ${token}`);
  if (buffer) req.attach('resume', buffer, { filename });
  if (github) req.field('github_username', github);
  req.field('target_role', role);
  return req;
}

function textPdf(lines) {
  const content = lines
    .map((line, index) => `BT /F1 12 Tf 72 ${712 - index * 20} Td (${line}) Tj ET`)
    .join('\n');
  const objects = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj',
    `4 0 obj<</Length ${Buffer.byteLength(content)}>>stream\n${content}\nendstream\nendobj`,
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  ];
  return Buffer.from(`%PDF-1.4\n${objects.join('\n')}\ntrailer<</Root 1 0 R>>\n%%EOF\n`);
}

export function minimalPdfBuffer() {
  return textPdf([
    'Aarav Mehta',
    'Software Development Engineer',
    'aarav.mehta@example.com | +91 98765 43210 | github.com/maayav',
    'Summary',
    'Software engineer with 2 years of experience building web applications.',
    'Skills',
    '- React, Node.js, MongoDB, JavaScript',
    'Experience',
    '- Built dashboards and REST APIs for internal tools.',
    'Education',
    '- B.Tech Computer Science, 2020',
  ]);
}

export function nonResumePdfBuffer() {
  return textPdf([
    'Machine Learning Resources Handout',
    'Chapter 1 - Introduction to Supervised Learning',
    'This document summarizes gradient descent, regularization, and evaluation metrics for coursework.',
    'Chapter 2 - Model Evaluation',
    'Precision, recall, and F1 are computed from the confusion matrix.',
    'References',
    '1. Bishop, Pattern Recognition and Machine Learning, 2006.',
    '2. Goodfellow, Deep Learning, 2016.',
  ]);
}

export function fakeVector(name) {
  const seed = [...String(name).toLowerCase().trim()].reduce((a, c) => a + c.charCodeAt(0), 7);
  const v = Array.from({ length: 16 }, (_, i) => Math.sin(seed * (i + 3)) * 0.5 + (i === seed % 16 ? 1 : 0));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function seedTestOntology() {
  const { SkillOntology } = await import('../src/models/skillOntology.js');
  const { ResourceCatalog } = await import('../src/models/resourceCatalog.js');

  const sdeSkills = [
    ['React', 'framework', 0.7],
    ['JavaScript', 'language', 0.8],
    ['Node.js', 'framework', 0.6],
    ['Express', 'framework', 0.5],
    ['MongoDB', 'database', 0.5],
    ['Python', 'language', 0.4],
    ['Git', 'tools', 0.6],
    ['SQL', 'database', 0.5],
    ['Data Structures & Algorithms', 'core-cs', 0.9],
  ];

  await SkillOntology.insertMany(
    sdeSkills.map(([skill_name, category, weight]) => ({
      skill_name,
      category,
      embedding_model: 'gemini-embedding-2',
      embedding_version: '2026-09',
      embedding_vector: fakeVector(skill_name),
      roles: [{ role_name: 'SDE', weight }],
    }))
  );

  await ResourceCatalog.insertMany([
    { skill_name: 'Express', title: 'Express Guide', url: 'https://example.com/express', type: 'documentation', verified: true },
    { skill_name: 'SQL', title: 'SQLBolt', url: 'https://sqlbolt.com/', type: 'practice-set', verified: true },
  ]);
}