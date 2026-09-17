import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.js';
import { Job } from '../src/models/job.js';
import { Application, APPLICATION_STATUSES } from '../src/models/application.js';
import { ProfileSubmission } from '../src/models/profileSubmission.js';
import { ExtractedSkillProfile } from '../src/models/extractedSkillProfile.js';
import { buildStudyPlan } from '../src/services/scoringService.js';
import { ReadinessReport } from '../src/models/readinessReport.js';

// DEVELOPMENT / DEMO ONLY — idempotent application seed data.
//
//   node scripts/seed-applications.js --admin=admin@example.com
//
// Requires an existing admin. Uses existing jobs; creates up to 8 demo students
// if they do not already exist. Applications span at least 4 jobs and every
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

const DEMO_SKILLS = [
  [['React', 'frontend_framework'], ['JavaScript', 'language'], ['Node.js', 'backend_framework'], ['MongoDB', 'database']],
  [['React', 'frontend_framework'], ['TypeScript', 'language'], ['Node.js', 'backend_framework'], ['Docker', 'devops_tool']],
  [['Figma', 'other'], ['React', 'frontend_framework'], ['JavaScript', 'language'], ['CSS', 'other']],
  [['Python', 'language'], ['SQL', 'database'], ['Pandas', 'other'], ['Docker', 'devops_tool']],
  [['React', 'frontend_framework'], ['Node.js', 'backend_framework'], ['AWS', 'cloud_platform'], ['Jest', 'testing_tool']],
  [['JavaScript', 'language'], ['React', 'frontend_framework'], ['Express', 'backend_framework'], ['MongoDB', 'database']],
  [['Python', 'language'], ['PyTorch', 'ml_framework'], ['SQL', 'database'], ['Git', 'devops_tool']],
  [['Java', 'language'], ['Selenium', 'testing_tool'], ['SQL', 'database'], ['Docker', 'devops_tool']],
];

function demoReviewFor(index, job) {
  const skills = DEMO_SKILLS[index % DEMO_SKILLS.length];
  const strong = skills.slice(0, 2).map(([skill], offset) => ({ skill, percent: 88 - offset * 5 }));
  const developing = skills.slice(2, 3).map(([skill]) => ({ skill, percent: 68 }));
  const missingSkill = job.skills?.find((skill) => !skills.some(([candidate]) => candidate.toLowerCase() === skill.toLowerCase())) || 'System Design';
  const gaps = [{ skill: missingSkill, percent: 38, priority: 0.82, m: 0.38 }];
  return {
    skills: skills.map(([name, category], skillIndex) => ({
      name,
      category,
      sources: skillIndex % 2 === 0 ? ['resume', 'github'] : ['resume'],
      evidence: [{ source: 'resume', text: `Built and documented a ${name} project for the placement portfolio.` }],
      proficiency_signals: { projects_count: Math.min(3, skillIndex + 1), has_production_usage: skillIndex === 0, mentions_depth: skillIndex === 0 ? 'high' : 'medium' },
    })),
    report: {
      score: 74 + (index % 5),
      strong_areas: strong,
      developing_areas: developing,
      gaps,
      study_plan: [{
        skill: missingSkill,
        priority: 0.82,
        resources: [],
        done: false,
      }],
    },
  };
}

async function ensureDemoReviews(students, jobs) {
  let created = 0;
  for (let index = 0; index < students.length; index += 1) {
    const student = students[index];
    const job = jobs[index % jobs.length];
    const fileRef = `demo-review/${student.email}.pdf`;
    const review = demoReviewFor(index, job);
    review.report.study_plan = await buildStudyPlan(review.report.gaps);
    const submission = await ProfileSubmission.findOneAndUpdate(
      { user_id: student._id, resume_file_ref: fileRef },
      {
        $set: {
          resume_text: `Demo portfolio for ${student.name}. Built projects using ${review.skills.map((skill) => skill.name).join(', ')}.`,
          github_username: `demo-${student.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          github_status: 'ok',
          target_role: job.title,
          extraction_status: 'completed',
          extraction_error: null,
        },
        $setOnInsert: { user_id: student._id, resume_file_ref: fileRef, submitted_at: new Date() },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    await ExtractedSkillProfile.findOneAndUpdate(
      { submission_id: submission._id },
      { $set: { skills: review.skills, gemini_model: 'demo-seed' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    await ReadinessReport.findOneAndUpdate(
      { submission_id: submission._id },
      {
        $set: {
          target_role: job.title,
          status: 'completed',
          score: review.report.score,
          strong_areas: review.report.strong_areas,
          developing_areas: review.report.developing_areas,
          gaps: review.report.gaps,
          study_plan: review.report.study_plan,
          embedding_model: 'demo-seed',
          embedding_version: 'demo-seed',
          completedAt: new Date(),
          generated_at: new Date(),
        },
        $setOnInsert: { submission_id: submission._id, startedAt: new Date() },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    created += 1;
  }
  return created;
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

  await connectDB({ retry: false });

  const admin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (!admin || admin.role !== 'admin') {
    console.error(`${adminEmail} is not an existing admin. Use scripts/create-admin.js first.`);
    await disconnectDB();
    process.exit(1);
  }

  const jobs = await Job.find({}).sort({ createdAt: -1 }).limit(4).lean();
  if (jobs.length < 4) {
    console.error(`Only ${jobs.length} jobs found — seed at least 4 jobs first (scripts/seed-jobs.js).`);
    await disconnectDB();
    process.exit(1);
  }

  const createdStudents = await ensureDemoStudents();
  console.log(`[dev/demo only] students created: ${createdStudents.length || 'none (already present)'}`);
  const students = await User.find({ email: { $in: DEMO_STUDENTS.map((s) => s.email) } }).lean();

  let created = 0;
  let skipped = 0;

  // Distribute students across jobs so each (student, job) pair is unique.
  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex += 1) {
    const job = jobs[jobIndex];
    for (let slot = 0; slot < STATUS_MIX.length; slot += 1) {
      const studentIndex = (jobIndex * 2 + slot) % students.length;
      const student = students[studentIndex];
      if (!student) continue;

      const existing = await Application.findOne({ applicant: student._id, job: job._id });
      if (existing) {
        skipped += 1;
        continue;
      }

      const status = STATUS_MIX[(jobIndex * 3 + slot) % STATUS_MIX.length];
      await Application.create({
        applicant: student._id,
        job: job._id,
        status,
        appliedAt: new Date(Date.now() - (jobIndex * 3 + slot) * 86400000),
        coverLetter: `Demo application to ${job.title} at ${job.company || 'the company'}.`,
      });
      created += 1;
    }
  }

  const count = await Application.countDocuments({});
  const reviewCount = await ensureDemoReviews(students, jobs);
  console.log(`Done: ${created} created, ${skipped} skipped (idempotent). Total applications now: ${count}.`);
  console.log(`Demo candidate reviews ready: ${reviewCount}.`);
  console.log(`Statuses in seed set: ${APPLICATION_STATUSES.join(', ')}`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('seed-applications failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
