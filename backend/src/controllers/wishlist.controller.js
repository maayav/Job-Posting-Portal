import { z } from 'zod';
import { WishlistItem } from '../models/wishlist.js';
import { Job } from '../models/job.js';
import { AppError } from '../utils/errors.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

function toJobSummary(job) {
  return {
    id: job._id.toString(),
    title: job.title,
    company: job.company ?? '',
    city: job.city,
    skills: job.skills,
    experienceLevel: job.experienceLevel,
    createdAt: job.createdAt,
  };
}

// GET /api/wishlist — the current student's saved jobs, newest first.
export async function listWishlist(req, res) {
  const items = await WishlistItem.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .populate('job')
    .lean({ virtuals: false });

  res.json({
    items: items
      .filter((item) => item.job)
      .map((item) => ({
        id: item._id.toString(),
        savedAt: item.createdAt,
        job: toJobSummary(item.job),
      })),
  });
}

// POST /api/wishlist — save a job to apply for later (idempotent).
export async function addToWishlist(req, res) {
  const { jobId } = z.strictObject({ jobId: objectIdSchema }).parse(req.body);

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404, 'not_found');
  }

  try {
    await WishlistItem.create({ user: req.user.id, job: jobId });
  } catch (err) {
    if (err.code !== 11000) throw err; // already saved — fine
  }

  res.status(201).json({ saved: true, jobId, job: toJobSummary(job) });
}

// DELETE /api/wishlist/:jobId — remove a saved job.
export async function removeFromWishlist(req, res) {
  const jobId = objectIdSchema.parse(req.params.jobId);
  await WishlistItem.deleteOne({ user: req.user.id, job: jobId });
  res.status(204).end();
}