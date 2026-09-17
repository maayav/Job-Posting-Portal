import { z } from 'zod';
import { Application, APPLICATION_STATUSES, STATUS_LABELS } from '../models/application.js';
import { Job } from '../models/job.js';
import { User } from '../models/user.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { ReadinessReport } from '../models/readinessReport.js';
import { ExtractedSkillProfile } from '../models/extractedSkillProfile.js';
import { AppError } from '../utils/errors.js';

const MAX_LIMIT = 50;
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const applySchema = z.strictObject({
  jobId: objectIdSchema,
  coverLetter: z.string().trim().max(3000).optional().default(''),
  resumeUrl: z.string().trim().max(500).optional().default(''),
});

const statusSchema = z.strictObject({
  status: z.enum(APPLICATION_STATUSES),
});

const myQuerySchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
});

const adminQuerySchema = z.object({
  jobId: objectIdSchema.optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20).transform((value) => Math.min(value, MAX_LIMIT)),
});

const dashboardQuerySchema = adminQuerySchema.pick({
  jobId: true,
  search: true,
  page: true,
  limit: true,
});

const REVIEW_STAGE_LABELS = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Under Review',
  interview_scheduled: 'Under Review',
  selected: 'Selected',
  rejected: 'Rejected',
};

function reviewStage(status) {
  if (status === 'selected') return 'selected';
  if (status === 'rejected') return 'rejected';
  if (status === 'applied') return 'applied';
  return 'under_review';
}

async function latestReviewsForApplicants(applicantIds, { details = false } = {}) {
  if (!applicantIds.length) return new Map();

  const submissions = await ProfileSubmission.find({ user_id: { $in: applicantIds } })
    .sort({ submitted_at: -1 })
    .lean();
  const latestSubmissionByUser = new Map();
  for (const submission of submissions) {
    const key = submission.user_id.toString();
    if (!latestSubmissionByUser.has(key)) latestSubmissionByUser.set(key, submission);
  }

  const submissionIds = [...latestSubmissionByUser.values()].map((submission) => submission._id);
  const [reports, profiles] = await Promise.all([
    ReadinessReport.find({ submission_id: { $in: submissionIds }, status: 'completed' })
      .sort({ completedAt: -1 })
      .lean(),
    details
      ? ExtractedSkillProfile.find({ submission_id: { $in: submissionIds } }).lean()
      : Promise.resolve([]),
  ]);

  const reportBySubmission = new Map();
  for (const report of reports) {
    const key = report.submission_id.toString();
    if (!reportBySubmission.has(key)) reportBySubmission.set(key, report);
  }
  const profileBySubmission = new Map(profiles.map((profile) => [profile.submission_id.toString(), profile]));
  const reviewByUser = new Map();

  for (const [userId, submission] of latestSubmissionByUser) {
    const report = reportBySubmission.get(submission._id.toString());
    const profile = profileBySubmission.get(submission._id.toString());
    const strong = report?.strong_areas ?? [];
    const developing = report?.developing_areas ?? [];
    const gaps = report?.gaps ?? [];
    const review = {
      submissionId: submission._id.toString(),
      targetRole: submission.target_role,
      atsScore: report?.score ?? null,
      roleReadinessScore: report?.score ?? null,
      githubUsername: submission.github_username || null,
      leetcodeUrl: submission.leetcode_username ? `https://leetcode.com/u/${encodeURIComponent(submission.leetcode_username)}/` : null,
      githubUrl: submission.github_username
        ? (submission.github_username.startsWith('http') ? submission.github_username : `https://github.com/${submission.github_username}`)
        : null,
      resumeFileRef: submission.resume_file_ref || null,
      strongSkills: strong,
      developingSkills: developing,
      missingSkills: gaps,
    };

    if (details) {
      review.studyPlan = report?.study_plan ?? [];
      review.evidence = (profile?.skills ?? []).flatMap((skill) => (skill.evidence ?? []).map((evidence) => ({
        skill: skill.name,
        confidence: skill.confidence,
        source: evidence.source,
        text: evidence.text,
      })));
      review.extractedSkills = profile?.skills ?? [];
      review.generatedAt = report?.generatedAt ?? report?.generated_at ?? null;
    }
    reviewByUser.set(userId, review);
  }
  return reviewByUser;
}

function toApplicationResponse(application) {
  const applicant = application.applicant;
  const job = application.job;
  const applicantPopulated = applicant && typeof applicant === 'object' && applicant.name !== undefined;
  const jobPopulated = job && typeof job === 'object' && job.title !== undefined;

  return {
    id: application._id.toString(),
    status: application.status,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    coverLetter: application.coverLetter ?? '',
    resumeUrl: application.resumeUrl ?? '',
    statusHistory: (application.statusHistory ?? []).map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy ? entry.changedBy.toString() : null,
    })),
    applicant: applicantPopulated
      ? { id: applicant._id.toString(), name: applicant.name, email: applicant.email }
      : { id: applicant?.toString() ?? null },
    job: jobPopulated
      ? {
          id: job._id.toString(),
          title: job.title,
          company: job.company ?? '',
          city: job.city,
          skills: job.skills,
          experienceLevel: job.experienceLevel,
        }
      : { id: job?.toString() ?? null },
  };
}

function toDashboardApplication(application, review) {
  const response = toApplicationResponse(application);
  return {
    applicationId: response.id,
    applicant: response.applicant,
    job: response.job,
    appliedAt: response.appliedAt,
    status: response.status,
    reviewStage: reviewStage(response.status),
    reviewStageLabel: REVIEW_STAGE_LABELS[response.status],
    atsScore: review?.atsScore ?? null,
    roleReadinessScore: review?.roleReadinessScore ?? null,
  };
}

// POST /api/applications — authenticated student applies to a job.
export async function applyToJob(req, res) {
  const data = applySchema.parse(req.body);

  const job = await Job.findById(data.jobId);
  if (!job) {
    throw new AppError('Job not found', 404, 'not_found');
  }

  const existing = await Application.findOne({ applicant: req.user.id, job: data.jobId });
  if (existing) {
    throw new AppError('You have already applied to this job', 409, 'already_applied');
  }

  let application;
  try {
    application = await Application.create({
      applicant: req.user.id, // server-derived from the verified JWT
      job: data.jobId,
      status: 'applied',
      coverLetter: data.coverLetter,
      resumeUrl: data.resumeUrl,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('You have already applied to this job', 409, 'already_applied');
    }
    throw err;
  }

  await application.populate('job', 'title company city skills experienceLevel');
  res.status(201).json({ application: toApplicationResponse(application) });
}

// GET /api/applications/me — a student's own applications only.
export async function listMyApplications(req, res) {
  const query = myQuerySchema.parse(req.query);
  const filter = { applicant: req.user.id };
  if (query.status) filter.status = query.status;

  const applications = await Application.find(filter)
    .sort({ appliedAt: -1 })
    .populate('job', 'title company city skills experienceLevel')
    .lean({ virtuals: false });

  res.json({ applications: applications.map(toApplicationResponse) });
}

// GET /api/admin/applications — paginated list of all applications (admin only).
export async function listAllApplications(req, res) {
  const query = adminQuerySchema.parse(req.query);
  const { page, limit } = query;

  const filter = {};
  if (query.jobId) filter.job = query.jobId;
  if (query.status) filter.status = query.status;

  let applicantIds = null;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').lean();
    applicantIds = users.map((u) => u._id);
    filter.applicant = { $in: applicantIds };
  }

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .sort({ appliedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('applicant', 'name email')
      .populate('job', 'title company city skills experienceLevel')
      .lean({ virtuals: false }),
    Application.countDocuments(filter),
  ]);

  res.json({
    applications: applications.map(toApplicationResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

// GET /api/admin/dashboard — compact candidate-review data sourced from applications.
export async function adminDashboard(req, res) {
  const query = dashboardQuerySchema.parse(req.query);
  const { page, limit } = query;
  const filter = {};

  if (query.jobId) filter.job = query.jobId;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id').lean();
    filter.applicant = { $in: users.map((user) => user._id) };
  }

  const [applications, totalApplications, filteredTotal, roleRows] = await Promise.all([
    Application.find(filter)
      .sort({ appliedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('applicant', 'name email')
      .populate('job', 'title company city skills experienceLevel')
      .lean({ virtuals: false }),
    Application.countDocuments({}),
    Application.countDocuments(filter),
    Application.aggregate([
      { $group: { _id: '$job', applicationCount: { $sum: 1 } } },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
      { $project: { _id: 0, jobId: { $toString: '$_id' }, title: '$job.title', applicationCount: 1 } },
      { $sort: { title: 1 } },
    ]),
  ]);

  const reviews = await latestReviewsForApplicants(
    applications.map((application) => application.applicant?._id).filter(Boolean),
  );

  res.json({
    totalApplications,
    roles: roleRows,
    applications: applications.map((application) => toDashboardApplication(
      application,
      reviews.get(application.applicant?._id?.toString()),
    )),
    page,
    limit,
    total: filteredTotal,
    totalPages: Math.ceil(filteredTotal / limit),
  });
}

// GET /api/admin/applications/:applicationId — protected candidate review details.
export async function getApplicationDetails(req, res) {
  const id = objectIdSchema.parse(req.params.applicationId);
  const application = await Application.findById(id)
    .populate('applicant', 'name email')
    .populate('job', 'title company city skills experienceLevel')
    .lean({ virtuals: false });
  if (!application) {
    throw new AppError('Application not found', 404, 'not_found');
  }

  const applicantId = application.applicant?._id;
  const reviews = await latestReviewsForApplicants(applicantId ? [applicantId] : [], { details: true });
  const review = reviews.get(applicantId?.toString()) ?? null;
  res.json({
    application: toApplicationResponse(application),
    candidate: toDashboardApplication(application, review),
    review,
  });
}

// PATCH /api/admin/applications/:applicationId/status — admin moves a candidate through the pipeline.
export async function updateApplicationStatus(req, res) {
  const id = objectIdSchema.parse(req.params.applicationId);
  const data = statusSchema.parse(req.body);

  const application = await Application.findById(id);
  if (!application) {
    throw new AppError('Application not found', 404, 'not_found');
  }
  if (application.status === data.status) {
    throw new AppError(`Application is already "${STATUS_LABELS[data.status]}"`, 400, 'status_unchanged');
  }

  application.status = data.status;
  application.statusHistory.push({
    status: data.status,
    changedAt: new Date(),
    changedBy: req.user.id,
  });
  await application.save();

  await application.populate('applicant', 'name email');
  await application.populate('job', 'title company city skills experienceLevel');
  res.json({ application: toApplicationResponse(application) });
}

// GET /api/admin/dashboard/application-summary — aggregation-backed dashboard data (admin only).
export async function applicationSummary(req, res) {
  const statusCountsProjection = {};
  for (const status of APPLICATION_STATUSES) {
    statusCountsProjection[status] = {
      $size: {
        $filter: {
          input: '$applications',
          as: 'application',
          cond: { $eq: ['$$application.status', status] },
        },
      },
    };
  }

  const [statusAgg, totalApplications, applicationsByJob] = await Promise.all([
    Application.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.countDocuments({}),
    Job.aggregate([
      {
        $lookup: {
          from: 'applications',
          localField: '_id',
          foreignField: 'job',
          as: 'applications',
        },
      },
      {
        $project: {
          _id: 0,
          jobId: { $toString: '$_id' },
          jobTitle: '$title',
          company: { $ifNull: ['$company', ''] },
          applicationCount: { $size: '$applications' },
          statusCounts: statusCountsProjection,
        },
      },
      { $sort: { applicationCount: -1, jobTitle: 1 } },
    ]),
  ]);

  const countsByStatus = {};
  for (const row of statusAgg) countsByStatus[row._id] = row.count;

  const totals = {
    totalApplications,
    applied: countsByStatus.applied ?? 0,
    underReview: countsByStatus.under_review ?? 0,
    shortlisted: countsByStatus.shortlisted ?? 0,
    interviewScheduled: countsByStatus.interview_scheduled ?? 0,
    rejected: countsByStatus.rejected ?? 0,
    selected: countsByStatus.selected ?? 0,
  };

  const pipelineOrder = [
    'applied',
    'under_review',
    'shortlisted',
    'interview_scheduled',
    'selected',
    'rejected',
  ];

  res.json({
    totals,
    applicationsByJob,
    pipeline: pipelineOrder.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: countsByStatus[status] ?? 0,
    })),
  });
}
