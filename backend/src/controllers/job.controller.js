import { z } from 'zod';
import { Job } from '../models/job.js';
import { AppError } from '../utils/errors.js';
import { normalizeSkillName, normalizeSkills, hasDuplicateNormalizedSkills } from '../utils/skillNormalizer.js';

const MAX_LIMIT = 50;

const skillsSchema = z
  .array(z.string().trim().min(1, 'Skill cannot be empty').max(50))
  .min(1, 'At least one skill is required')
  .max(30, 'Too many skills')
  .refine((skills) => !hasDuplicateNormalizedSkills(skills), {
    message: 'Duplicate skills are not allowed (synonyms are treated as the same skill)',
  });

const jobFields = {
  title: z.string().trim().min(1, 'Title is required').max(150),
  skills: skillsSchema,
  experienceLevel: z.coerce.number().min(0, 'Experience cannot be negative').max(50),
  city: z.string().trim().min(1, 'City is required').max(100),
  description: z.string().trim().min(1, 'Description is required').max(5000),
};

// strictObject rejects unknown keys (e.g. a client-supplied createdBy).
const createJobSchema = z.strictObject(jobFields);

const updateJobSchema = z
  .strictObject({
    title: jobFields.title.optional(),
    skills: jobFields.skills.optional(),
    experienceLevel: jobFields.experienceLevel.optional(),
    city: jobFields.city.optional(),
    description: jobFields.description.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' });

const jobIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job id');

const listQuerySchema = z.object({
  skills: z.string().trim().optional(),
  experience: z.coerce.number().min(0).max(50).optional(),
  city: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20).transform((value) => Math.min(value, MAX_LIMIT)),
});

function toJobResponse(job) {
  return {
    id: job._id.toString(),
    title: job.title,
    skills: job.skills,
    experienceLevel: job.experienceLevel,
    city: job.city,
    description: job.description,
    createdBy: job.createdBy.toString(),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function parseSkillsParam(value) {
  return [...new Set(value.split(',').map((s) => normalizeSkillName(s).toLowerCase()).filter(Boolean))];
}

export async function listJobs(req, res) {
  const query = listQuerySchema.parse(req.query);

  const filter = {};
  if (query.skills) {
    const skills = parseSkillsParam(query.skills);
    if (skills.length > 0) filter.skillsLower = { $in: skills };
  }
  if (query.experience !== undefined) {
    filter.experienceLevel = { $lte: query.experience };
  }
  if (query.city) {
    filter.cityLower = query.city.toLowerCase();
  }

  const { page, limit } = query;
  const [jobs, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);

  res.json({
    jobs: jobs.map(toJobResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function createJob(req, res) {
  const data = createJobSchema.parse(req.body);

  const job = await Job.create({
    title: data.title,
    skills: normalizeSkills(data.skills),
    experienceLevel: data.experienceLevel,
    city: data.city,
    description: data.description,
    createdBy: req.user.id, // server-controlled from the verified JWT
  });

  res.status(201).json({ job: toJobResponse(job) });
}

export async function updateJob(req, res) {
  const id = jobIdSchema.parse(req.params.id);
  const data = updateJobSchema.parse(req.body);

  const job = await Job.findById(id);
  if (!job) {
    throw new AppError('Job not found', 404, 'not_found');
  }

  if (data.title !== undefined) job.title = data.title;
  if (data.skills !== undefined) job.skills = normalizeSkills(data.skills);
  if (data.experienceLevel !== undefined) job.experienceLevel = data.experienceLevel;
  if (data.city !== undefined) job.city = data.city;
  if (data.description !== undefined) job.description = data.description;

  await job.save();
  res.json({ job: toJobResponse(job) });
}

export async function deleteJob(req, res) {
  const id = jobIdSchema.parse(req.params.id);

  const deleted = await Job.findByIdAndDelete(id);
  if (!deleted) {
    throw new AppError('Job not found', 404, 'not_found');
  }

  res.status(204).end();
}