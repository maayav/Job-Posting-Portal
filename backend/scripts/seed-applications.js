import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.js';
import { Job } from '../src/models/job.js';
import { Application, APPLICATION_STATUSES } from '../src/models/application.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ExtractedSkillProfile } from '../src/models/extractedSkillProfile.js';
import { generateReport } from '../src/services/scoringService.js';
import { buildProfileAssessment } from '../src/services/profileAssessmentService.js';
import { buildCareerActions } from '../src/services/careerActionService.js';
import { createDemoResumePdf, demoResumeContent } from './demo-resumes.js';
import { saveResumeBlob, readResume, deleteResume, isResumeBlobRef } from '../src/services/storageService.js';
import { extractResumeText } from '../src/services/resumeService.js';
import { assertLocalDemoDatabase } from './demo-guard.js';
import { env } from '../src/config/env.js';
import { ReadinessReport } from '../src/models/readinessReport.js';

// DEVELOPMENT / DEMO ONLY — idempotent application seed data.
//
//   node scripts/seed-applications.js --admin=admin@example.com
//
// Requires an existing admin. Uses existing jobs; creates up to 8 demo students
// if they do not already exist. Applications cover up to 60 admin-owned jobs and every
// pipeline status. Running it again never duplicates applications (unique
// applicant+job index).
//
// Also creates clearly marked demo profile/review records so the dashboard's
// View panel is useful immediately in a development environment.

const DEMO_STUDENTS = [
  { email: 'demo.student1@vortex.dev', name: 'Aisha Verma' },
  { email: 'demo.student2@vortex.dev', name: 'Rahul Nair' },
  { email: 'demo.student3@vortex.dev', name: 'Priya Iyer' },
  { email: 'demo.student4@vortex.dev', name: 'Karthik Rao' },
  { email: 'demo.student5@vortex.dev', name: 'Meera Pillai' },
  { email: 'demo.student6@vortex.dev', name: 'Arjun Das' },
  { email: 'demo.student7@vortex.dev', name: 'Sneha Menon' },
  { email: 'demo.student8@vortex.dev', name: 'Vikram Singh' },
];

// Statuses to distribute across the demo applications, in a realistic mix.
const STATUS_MIX = [
  'applied',
  'under_review',
  'shortlisted',
  'interview_scheduled',
  'rejected',
  'selected',
  'applied',
  'under_review',
];

export async function ensureDemoReview(student, job, index) {
  const key = `${student.email}:${job._id}`;
  const required = [...new Set(job.skills ?? [])];
  const chosen = required.slice(0, Math.max(1, required.length - (index % 3)));
  const content = demoResumeContent(student, job, chosen);
  const contentHash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const skills = chosen.map((name, i) => ({ name, category: 'other', confidence: 'medium', sources: ['resume'], evidence: [{ source: 'resume', text: content.projects[i] }], proficiency_signals: { projects_count: 1, has_production_usage: false, mentions_depth: 'medium' } }));
  let submission = await ProfileSubmission.findOne({ demo_key: key });
  // Upgrade earlier placeholder records when they refer to this exact demo role.
  if (!submission) submission = await ProfileSubmission.findOne({ user_id: student._id, target_role: job.title, resume_file_ref: `demo-review/${student.email}.pdf` });
  const oldRef = submission?.resume_file_ref;
  let fileRef = oldRef;
  let buffer;
  try { if (fileRef) buffer = await readResume(fileRef); } catch { /* Rebuild missing demo files. */ }
  if (!buffer || submission?.demo_content_hash !== contentHash || !isResumeBlobRef(fileRef)) {
    buffer = await createDemoResumePdf(student, job, chosen);
    // MongoDB-backed so demo resumes survive serverless cold starts and redeploys.
    fileRef = await saveResumeBlob(buffer, `${student.name}-demo-resume.pdf`);
  }
  const resumeText = await extractResumeText(buffer);
  const fields = { demo_key: key, demo_content_hash: contentHash, resume_file_ref: fileRef, resume_text: resumeText, target_role: job.title, github_username: '', github_status: 'none', leetcode_username: '', leetcode_status: 'none', linkedinUrl: '', linkedinSummaryText: '', linkedinDataSource: null, codingProfileUrl: '', codingSummaryText: '', source_evidence: { capturedAt: new Date(), github: { available: false, repos: [] }, leetcode: { available: false, languages: [] } }, extraction_status: 'completed', extraction_error: null };
  if (submission) { submission.set(fields); await submission.save(); }
  else submission = await ProfileSubmission.create({ ...fields, user_id: student._id });
  if (oldRef && oldRef !== fileRef) await deleteResume(oldRef).catch(() => {});
  await ExtractedSkillProfile.findOneAndUpdate({ submission_id: submission._id }, { $set: { skills, gemini_model: 'demo-seed', embeddings: [], embedding_model: '', embedding_version: '' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  const ontology = required.map((skill_name) => ({ skill_name, weight: 1 }));
  const result = await generateReport(ontology, skills);
  const profileAssessment = buildProfileAssessment(submission, skills, ontology);
  const actions = buildCareerActions({ role: job.title, plan: result.study_plan, requiredSkills: required, assessment: profileAssessment });
  const report = await ReadinessReport.findOneAndUpdate({ submission_id: submission._id }, { $set: { ...result, target_role: job.title, status: 'completed', stage: 'completed', errorCode: null, profile_assessment: profileAssessment, career_actions: actions, embedding_model: 'demo-seed', embedding_version: 'demo-seed', completedAt: new Date(), generated_at: new Date() }, $setOnInsert: { submission_id: submission._id, startedAt: new Date() } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  return { submission, report, fileRef };
}

function parseAdminArg(argv) {
  const arg = argv.find((a) => a.startsWith('--admin='));
  return arg ? arg.slice('--admin='.length).trim() : null;
}

async function ensureDemoStudents() {
  const created = [];
  for (const student of DEMO_STUDENTS) {
    const existing = await User.findOne({ email: student.email });
    if (existing) continue;
    await User.create({
      name: student.name,
      email: student.email,
      password: 'demo-pass-123',
      role: 'student',
    });
    created.push(student.email);
  }
  return created;
}

async function main() {
  const adminEmail = parseAdminArg(process.argv.slice(2));
  if (!adminEmail) {
    console.error('Usage: node scripts/seed-applications.js --admin=<existing-admin-email>');
    process.exit(1);
  }

  assertLocalDemoDatabase(env.MONGO_URI, env.NODE_ENV);
  await connectDB({ retry: false });

  const admin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (!admin || admin.role !== 'admin') {
    console.error(`${adminEmail} is not an existing admin. Use scripts/create-admin.js first.`);
    await disconnectDB();
    process.exit(1);
  }

  const jobs = await Job.find({ createdBy: admin._id }).sort({ title: 1 }).limit(60).lean();
  if (jobs.length < 4) {
    console.error(`Only ${jobs.length} jobs found — seed at least 4 jobs first (scripts/seed-jobs.js).`);
    await disconnectDB();
    process.exit(1);
  }

  const createdStudents = await ensureDemoStudents();
  console.log(`[dev/demo only] students created: ${createdStudents.length || 'none (already present)'}`);
  const students = await User.find({ email: { $in: DEMO_STUDENTS.map((s) => s.email) } }).sort({ email: 1 }).lean();

  let created = 0;
  let skipped = 0;

  // Distribute students across jobs so each (student, job) pair is unique.
  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex += 1) {
    const job = jobs[jobIndex];
    for (let slot = 0; slot < STATUS_MIX.length; slot += 1) {
      const studentIndex = (jobIndex * 2 + slot) % students.length;
      const student = students[studentIndex];
      if (!student) continue;

      const review = await ensureDemoReview(student, job, studentIndex);
      const existing = await Application.findOne({ applicant: student._id, job: job._id });
      const oldApplicationRef = existing?.resumeFileRef;
      let applicationRef = oldApplicationRef;
      let applicationBuffer;
      try { if (applicationRef && applicationRef !== review.fileRef) applicationBuffer = await readResume(applicationRef); } catch { /* Rebuild missing demo snapshot. */ }
      const profileBuffer = await readResume(review.fileRef);
      if (!applicationBuffer?.equals(profileBuffer) || !isResumeBlobRef(applicationRef)) {
        applicationRef = await saveResumeBlob(profileBuffer, `${student.name}-application.pdf`);
      }
      const snapshot = { profileSubmissionId: review.submission._id, readinessReportId: review.report._id, reviewSnapshotAt: new Date(), resumeFileRef: applicationRef, resumeOriginalName: `${student.name}-demo-resume.pdf`, resumeSource: 'profile', applicantEmail: student.email };
      if (existing) {
        existing.set(snapshot);
        existing.resumeUrl = `/api/applications/${existing._id}/resume`;
        await existing.save();
        if (oldApplicationRef && oldApplicationRef !== applicationRef && oldApplicationRef !== review.fileRef) await deleteResume(oldApplicationRef).catch(() => {});
        skipped += 1;
        continue;
      }

      const status = STATUS_MIX[(jobIndex * 3 + slot) % STATUS_MIX.length];
      const application = await Application.create({
        ...snapshot,
        applicant: student._id,
        job: job._id,
        status,
        appliedAt: new Date(Date.now() - (jobIndex * 3 + slot) * 86400000),
        coverLetter: `Demo application to ${job.title} at ${job.company || 'the company'}.`,
      });
      application.resumeUrl = `/api/applications/${application._id}/resume`;
      await application.save();
      created += 1;
    }
  }

  const count = await Application.countDocuments({});
  const reviewCount = await ProfileSubmission.countDocuments({ demo_key: { $ne: null } });
  console.log(`Done: ${created} created, ${skipped} skipped (idempotent). Total applications now: ${count}.`);
  console.log(`Demo candidate reviews ready: ${reviewCount}.`);
  console.log(`Statuses in seed set: ${APPLICATION_STATUSES.join(', ')}`);
  await disconnectDB();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(async (err) => {
  console.error('seed-applications failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
