import mongoose from 'mongoose';
import { z } from 'zod';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { SkillOntology } from '../models/skillOntology.js';
import { saveResume, deleteResume } from '../services/storageService.js';
import { extractResumeText } from '../services/resumeService.js';
import { normalizeUsername, fetchGithubProfile } from '../services/githubService.js';
import { processExtraction } from '../services/skillService.js';
import { AppError } from '../utils/errors.js';

const createSchema = z.object({
  github_username: z.string().trim().optional().default(''),
  leetcode_username: z.string().trim().max(120).optional().default(''),
  target_role: z.string().trim().min(1, 'Target role is required').max(100),
});

async function assertKnownRole(targetRole) {
  const available = await SkillOntology.distinct('roles.role_name');
  if (!available.includes(targetRole)) {
    throw new AppError(`Unknown target role "${targetRole}"`, 400, 'validation_error');
  }
}

async function collectGithub(username) {
  try {
    const profile = await fetchGithubProfile(username);
    return {
      github_username: profile.username,
      github_status: 'ok',
      github_profile: profile,
    };
  } catch (err) {
    if (err instanceof AppError && err.code === 'github_not_found') {
      return { github_username: username, github_status: 'not_found', github_profile: null };
    }
    return { github_username: username, github_status: 'unavailable', github_profile: null };
  }
}

export async function createProfile(req, res) {
  const data = createSchema.parse(req.body);
  await assertKnownRole(data.target_role);
  const github_username = data.github_username
    ? normalizeUsername(data.github_username)
    : '';
  const leetcode_username = data.leetcode_username
    ? data.leetcode_username.replace(/^(https?:\/\/)?(www\.)?leetcode\.com\/(u\/|profile\/)?/i, '').replace(/\/.*$/, '').trim()
    : '';
  if (leetcode_username && !/^[a-zA-Z0-9._-]+$/.test(leetcode_username)) {
    throw new AppError('Invalid LeetCode username or profile URL', 400, 'validation_error');
  }

  const filename = await saveResume(req.file.buffer, req.file.originalname);
  let resume_text;
  try {
    resume_text = await extractResumeText(req.file.buffer);
  } catch (err) {
    await deleteResume(filename);
    throw err;
  }

  let github = { github_username, github_status: 'none', github_profile: null };
  if (github_username) {
    github = await collectGithub(github_username);
  }

  const submission = await ProfileSubmission.create({
    user_id: req.user.id,
    resume_file_ref: filename,
    resume_text,
    target_role: data.target_role,
    github_username: github.github_username,
    github_status: github.github_status,
    leetcode_username,
  });

  let extraction = { status: 'pending', error: null };
  try {
    const profile = await processExtraction(submission._id, github.github_profile);
    extraction = { status: 'completed', error: null, skillCount: profile.skills.length };
    submission.extraction_status = 'completed';
    submission.extraction_error = null;
    await submission.save();
  } catch (err) {
    extraction = { status: 'failed', error: err.code ?? 'extraction_failed' };
    submission.extraction_status = 'failed';
    submission.extraction_error = extraction.error;
    await submission.save();
  }

  res.status(201).json({
    id: submission._id.toString(),
    target_role: submission.target_role,
    github_username: submission.github_username,
    github_status: submission.github_status,
    leetcode_username: submission.leetcode_username,
    leetcode_status: submission.leetcode_status,
    extraction_status: extraction.status,
    extraction_error: extraction.error ?? null,
    submitted_at: submission.submitted_at,
    created_at: submission.createdAt,
  });
}

export async function getProfile(req, res) {
  const submission = req.resource;

  let extracted_skills = null;
  const SkillProfile = mongoose.models.ExtractedSkillProfile;
  if (SkillProfile) {
    const profile = await SkillProfile.findOne({ submission_id: submission._id });
    if (profile) {
      extracted_skills = profile.skills;
    }
  }

  res.json({
    id: submission._id.toString(),
    target_role: submission.target_role,
    github_username: submission.github_username,
    github_status: submission.github_status,
    leetcode_username: submission.leetcode_username,
    leetcode_status: submission.leetcode_status,
    submitted_at: submission.submitted_at,
    created_at: submission.createdAt,
    extracted_skills,
    extraction_status: submission.extraction_status,
    extraction_error: submission.extraction_error,
  });
}

export async function retryExtraction(req, res) {
  const submission = req.resource;
  const github = submission.github_username ? await collectGithub(submission.github_username) : null;
  await processExtraction(submission._id, github?.github_profile);
  req.resource = await ProfileSubmission.findById(submission._id);
  return getProfile(req, res);
}

export async function deleteProfile(req, res) {
  const submission = req.resource;

  await deleteResume(submission.resume_file_ref);

  const SkillProfile = mongoose.models.ExtractedSkillProfile;
  if (SkillProfile) {
    await SkillProfile.deleteMany({ submission_id: submission._id });
  }
  const Report = mongoose.models.ReadinessReport;
  if (Report) {
    await Report.deleteMany({ submission_id: submission._id });
  }

  await submission.deleteOne();

  res.status(204).end();
}
