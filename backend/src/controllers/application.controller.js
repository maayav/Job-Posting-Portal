import { z } from 'zod';
import { Application, APPLICATION_STATUSES, STATUS_LABELS } from '../models/application.js';
import { Job } from '../models/job.js';
import { User } from '../models/user.js';
import { ProfileSubmission } from '../models/profileSubmission.js';
import { ReadinessReport } from '../models/readinessReport.js';
import { ExtractedSkillProfile } from '../models/extractedSkillProfile.js';
import { deleteResume, readResume, saveResume, saveResumeBlob, isResumeBlobRef } from '../services/storageService.js';
import { buildDemoResumePdf, isDemoSubmission } from '../services/demoResumeService.js';
import { hydrateStudyPlan } from '../services/resourceService.js';
import { notifyApplicationStatus, notifyApplicationSubmitted } from '../services/notificationService.js';
import { AppError } from '../utils/errors.js';

const MAX_LIMIT = 50;
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const applySchema = z.strictObject({
  jobId: objectIdSchema,
  coverLetter: z.string().trim().max(3000).optional().default(''),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .default('')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'A valid email is required',
    }),
  resumeUrl: z.string().trim().max(500).optional().default('').refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, { message: 'Resume URL must be a valid HTTPS URL without credentials' }),
  useProfileResume: z.union([z.boolean(), z.string()]).optional(),
});

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

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

async function reviewForApplication(application, { details = false } = {}) {
  const applicantId = application.applicant?._id ?? application.applicant;
  const hasSnapshot = Boolean(application.reviewSnapshotAt || application.profileSubmissionId || application.readinessReportId);
  if (hasSnapshot && !application.profileSubmissionId) return null;
  const submission = application.profileSubmissionId
    ? await ProfileSubmission.findOne({ _id: application.profileSubmissionId, user_id: applicantId }).lean()
    : await ProfileSubmission.findOne({ user_id: applicantId }).sort({ submitted_at: -1 }).lean();
  if (!submission) return null;

  const report = application.readinessReportId
    ? await ReadinessReport.findOne({ _id: application.readinessReportId, submission_id: submission._id, status: 'completed' }).lean()
    : hasSnapshot ? null : await ReadinessReport.findOne({ submission_id: submission._id, status: 'completed' }).sort({ completedAt: -1 }).lean();
  const profile = details ? await ExtractedSkillProfile.findOne({ submission_id: submission._id }).lean() : null;
  const strong = report?.strong_areas ?? [];
  const developing = report?.developing_areas ?? [];
  const gaps = report?.gaps ?? [];
  const legacyProfileFallback = !application.resumeSource && !application.resumeFileRef && !application.resumeUrl;
  const canUseProfileResume = application.resumeSource === 'profile' || legacyProfileFallback;
  const review = {
      submissionId: submission._id.toString(),
      targetRole: submission.target_role,
      atsScore: report?.score ?? null,
      roleReadinessScore: report?.score ?? null,
      profileScore: report?.profile_assessment?.score ?? null,
      profileCoverage: report?.profile_assessment ? `${report.profile_assessment.assessedSources}/${report.profile_assessment.totalSources} sources` : null,
      githubUsername: submission.github_username || null,
      leetcodeUrl: submission.leetcode_username ? `https://leetcode.com/u/${encodeURIComponent(submission.leetcode_username)}/` : null,
      githubUrl: submission.github_username
        ? (submission.github_username.startsWith('http') ? submission.github_username : `https://github.com/${submission.github_username}`)
        : null,
      linkedinUrl: submission.linkedinUrl || null,
      resumeFileRef: canUseProfileResume ? (submission.resume_file_ref || null) : null,
      strongSkills: strong,
      developingSkills: developing,
      missingSkills: gaps,
    };

  if (details) {
      review.studyPlan = await hydrateStudyPlan(report?.study_plan ?? []);
      review.evidence = (profile?.skills ?? []).flatMap((skill) => (skill.evidence ?? []).map((evidence) => ({
        skill: skill.name,
        confidence: skill.confidence,
        source: evidence.source,
        text: evidence.text,
      })));
      review.extractedSkills = profile?.skills ?? [];
      review.generatedAt = report?.generatedAt ?? report?.generated_at ?? null;
  }
  return review;
}

async function reviewsForApplications(applications, options = {}) {
  const entries = await Promise.all(applications.map(async (application) => [
    application._id.toString(),
    await reviewForApplication(application, options),
  ]));
  return new Map(entries.filter(([, review]) => review));
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
    applicantEmail: application.applicantEmail ?? '',
    resumeUrl: application.resumeUrl ?? '',
    hasResume: Boolean(application.resumeFileRef),
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
    profileScore: review?.profileScore ?? null,
  };
}

// POST /api/applications — authenticated student applies to a job.
// The student may provide a contact email and either attach a different resume,
// reuse the resume already on their profile, or apply without one.
export async function applyToJob(req, res) {
  const data = applySchema.parse(req.body);

  const job = await Job.findById(data.jobId);
  if (!job) {
    throw new AppError('Job not found', 404, 'not_found');
  }
  if (job.status && job.status !== 'open') {
    throw new AppError('This job is no longer accepting applications', 409, 'job_closed');
  }

  const existing = await Application.findOne({ applicant: req.user.id, job: data.jobId });
  if (existing) {
    throw new AppError('You have already applied to this job', 409, 'already_applied');
  }

  const account = await User.findById(req.user.id).select('email').lean();
  const applicantEmail = data.email || account?.email || '';
  const profileSnapshot = await ProfileSubmission.findOne({ user_id: req.user.id })
    .sort({ submitted_at: -1 })
    .select('_id resume_file_ref')
    .lean();
  const readinessSnapshot = profileSnapshot
    ? await ReadinessReport.findOne({ submission_id: profileSnapshot._id, status: 'completed' }).sort({ completedAt: -1 }).select('_id').lean()
    : null;

  let resumeFileRef = '';
  let resumeOriginalName = '';
  let resumeSource = data.resumeUrl ? 'external_url' : 'none';
  if (req.file) {
    resumeFileRef = await saveResume(req.file.buffer, req.file.originalname);
    resumeOriginalName = req.file.originalname;
    resumeSource = 'application_upload';
  } else if (isTruthyFlag(data.useProfileResume)) {
    if (!profileSnapshot?.resume_file_ref) {
      throw new AppError('Your profile resume is unavailable. Attach a PDF or choose no resume.', 409, 'profile_resume_unavailable');
    }
    let buffer;
    try {
      buffer = await readResume(profileSnapshot.resume_file_ref);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      throw new AppError('Your profile resume is no longer available. Attach a PDF or choose no resume.', 409, 'profile_resume_unavailable');
    }
    resumeFileRef = await saveResume(buffer, 'profile-resume.pdf');
    resumeOriginalName = 'profile-resume.pdf';
    resumeSource = 'profile';
  }

  let application;
  try {
    application = await Application.create({
      applicant: req.user.id, // server-derived from the verified JWT
      job: data.jobId,
      profileSubmissionId: profileSnapshot?._id ?? null,
      readinessReportId: readinessSnapshot?._id ?? null,
      reviewSnapshotAt: new Date(),
      status: 'applied',
      coverLetter: data.coverLetter,
      applicantEmail,
      resumeFileRef,
      resumeOriginalName,
      resumeUrl: data.resumeUrl,
      resumeSource,
    });
  } catch (err) {
    if (resumeFileRef) await deleteResume(resumeFileRef).catch(() => {});
    if (err.code === 11000) {
      throw new AppError('You have already applied to this job', 409, 'already_applied');
    }
    throw err;
  }

  if (resumeFileRef) {
    application.resumeUrl = `/api/applications/${application._id.toString()}/resume`;
    await application.save();
  }

  await notifyApplicationSubmitted(application, job.title);
  await application.populate('job', 'title company city skills experienceLevel');
  res.status(201).json({ application: toApplicationResponse(application) });
}

// GET /api/applications/me — a student's own applications only.
export async function listMyApplications(req, res) {
  res.set('Cache-Control', 'private, no-store');
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
  res.set('Cache-Control', 'private, no-store');
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
  res.set('Cache-Control', 'private, no-store');
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

  const [applications, totalApplications, filteredTotal, roleRows, filteredStatusRows] = await Promise.all([
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
    Application.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const stageCounts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0]));
  for (const row of filteredStatusRows) stageCounts[row._id] = row.count;

  const reviews = await reviewsForApplications(applications);

  res.json({
    totalApplications,
    roles: roleRows,
    applications: applications.map((application) => toDashboardApplication(
      application,
      reviews.get(application._id.toString()),
    )),
    page,
    limit,
    total: filteredTotal,
    totalPages: Math.ceil(filteredTotal / limit),
    stageCounts,
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

  res.set('Cache-Control', 'private, no-store');
  const review = await reviewForApplication(application, { details: true });
  res.json({
    application: toApplicationResponse(application),
    candidate: toDashboardApplication(application, review),
    review,
  });
}

async function findApplicationSubmission(application) {
  const fields = 'resume_file_ref resume_text demo_key';
  if (application.profileSubmissionId) {
    return ProfileSubmission.findOne({ _id: application.profileSubmissionId, user_id: application.applicant })
      .select(fields)
      .lean();
  }
  if (application.reviewSnapshotAt || application.readinessReportId) return null;
  return ProfileSubmission.findOne({ user_id: application.applicant })
    .sort({ submitted_at: -1 })
    .select(fields)
    .lean();
}

// GET /api/admin/applications/:applicationId/resume — authorized resume preview.
// Resume files stay outside the public web root and are streamed only after the
// admin route has verified access to the application.
// GET /api/applications/:applicationId/resume — the application resume (owner or admin).
export async function getApplicationResume(req, res) {
  const id = objectIdSchema.parse(req.params.applicationId);
  const application = await Application.findById(id)
    .select('applicant resumeFileRef resumeOriginalName resumeSource profileSubmissionId resumeUrl reviewSnapshotAt readinessReportId')
    .lean();
  if (!application) {
    throw new AppError('Application not found', 404, 'not_found');
  }

  const isOwner = application.applicant?.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('Insufficient permissions', 403, 'forbidden');
  }

  // Only applications that explicitly selected a profile resume may use one.
  // Legacy records retain the old fallback behavior for compatibility.
  let fileRef = application.resumeFileRef;
  let downloadName = application.resumeOriginalName || 'vortex-resume.pdf';
  let submission = null;
  const legacyProfileFallback = !application.resumeSource && !application.resumeFileRef && !application.resumeUrl;
  const canUseProfileResume = application.resumeSource === 'profile' || legacyProfileFallback;
  if (!fileRef && canUseProfileResume) {
    submission = await findApplicationSubmission(application);
    fileRef = submission?.resume_file_ref;
    downloadName = 'vortex-resume.pdf';
  }

  let buffer = null;
  let missing = false;
  if (fileRef) {
    try {
      buffer = await readResume(fileRef);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      missing = true;
    }
  }

  if (!buffer && missing && canUseProfileResume) {
    submission = submission ?? await findApplicationSubmission(application);
    const resumeText = String(submission?.resume_text ?? '').trim();
    if (submission && resumeText && isDemoSubmission(submission)) {
      let profileBuffer = null;
      try {
        if (submission.resume_file_ref) profileBuffer = await readResume(submission.resume_file_ref);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      // Prefer the captured PDF when it still exists. Only marked demo records
      // can be rebuilt from their stored text after ephemeral files disappear.
      buffer = profileBuffer ?? buildDemoResumePdf(resumeText);
      if (buffer) {
        if (!profileBuffer || !isResumeBlobRef(submission.resume_file_ref)) {
          const profileBlobRef = await saveResumeBlob(buffer, 'demo-resume.pdf');
          try {
            await ProfileSubmission.updateOne({ _id: submission._id }, { $set: { resume_file_ref: profileBlobRef } });
          } catch (error) {
            await deleteResume(profileBlobRef).catch(() => {});
            throw error;
          }
        }
        // An application owns its copy independently of the profile's lifetime.
        const applicationBlobRef = await saveResumeBlob(buffer, downloadName);
        try {
          await Application.updateOne(
            { _id: application._id },
            { $set: { resumeFileRef: applicationBlobRef, resumeSource: 'profile', resumeUrl: `/api/applications/${application._id}/resume` } },
          );
        } catch (error) {
          await deleteResume(applicationBlobRef).catch(() => {});
          throw error;
        }
      }
    }
  }

  if (!buffer) {
    throw fileRef
      ? new AppError('The saved resume file is no longer available', 404, 'resume_missing')
      : new AppError('Resume is not available for this application', 404, 'resume_not_found');
  }

  res.set('Cache-Control', 'private, no-store');
  res.type('application/pdf');
  res.set('Content-Disposition', `inline; filename="${downloadName.replace(/[^\w.-]+/g, '-')}"`);
  res.send(buffer);
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
  await notifyApplicationStatus(application, application.job?.title);
  res.json({ application: toApplicationResponse(application) });
}

// GET /api/admin/dashboard/application-summary — aggregation-backed dashboard data (admin only).
export async function applicationSummary(req, res) {
  res.set('Cache-Control', 'private, no-store');
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
