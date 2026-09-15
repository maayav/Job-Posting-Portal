import { connectDB, disconnectDB } from '../src/config/db.js';
import { Job } from '../src/models/job.js';
import { User } from '../src/models/user.js';

// DEVELOPMENT / DEMO ONLY — idempotent job seed data.
//
//   node scripts/seed-jobs.js --admin=admin@example.com
//
// Requires a real existing admin account (their ObjectId is used as createdBy).
// Upserts by (title, city, createdBy), so running it repeatedly is safe.
// Only touches the `jobs` collection; placement collections are untouched.

const DEMO_JOBS = [
  {
    title: 'Frontend Developer',
    skills: ['React', 'JavaScript', 'TypeScript', 'REST APIs'],
    experienceLevel: 1,
    city: 'Chennai',
    description: 'Build and maintain responsive web interfaces for campus placement dashboards. Work with designers and backend engineers to ship accessible, tested UI.',
  },
  {
    title: 'Backend Developer',
    skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs'],
    experienceLevel: 2,
    city: 'Bangalore',
    description: 'Design and implement REST APIs, data models, and integrations. Own service reliability and write automated tests.',
  },
  {
    title: 'Full Stack Developer',
    skills: ['React', 'Node.js', 'MongoDB', 'Docker'],
    experienceLevel: 3,
    city: 'Hyderabad',
    description: 'Own features end to end across a MERN stack, from database schema to deployed UI. Containerized deployments with Docker.',
  },
  {
    title: 'Data Analyst',
    skills: ['Python', 'SQL', 'Pandas', 'Data Visualization'],
    experienceLevel: 0,
    city: 'Chennai',
    description: 'Turn placement and student datasets into actionable dashboards and reports for the placement cell.',
  },
  {
    title: 'Machine Learning Engineer',
    skills: ['Python', 'PyTorch', 'scikit-learn', 'NLP'],
    experienceLevel: 2,
    city: 'Pune',
    description: 'Build and evaluate ML models for resume parsing and skill matching. Experience with NLP pipelines preferred.',
  },
  {
    title: 'DevOps Engineer',
    skills: ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'AWS'],
    experienceLevel: 3,
    city: 'Bangalore',
    description: 'Automate build, test, and deployment pipelines; operate containerized services on AWS with monitoring and alerting.',
  },
  {
    title: 'QA / Test Engineer',
    skills: ['Testing', 'Selenium', 'API Testing', 'CI/CD Pipelines'],
    experienceLevel: 1,
    city: 'Noida',
    description: 'Write and maintain automated test suites for web and API surfaces; integrate tests into CI and track defects.',
  },
  {
    title: 'Cloud Engineer',
    skills: ['AWS', 'Terraform', 'Linux', 'Networking'],
    experienceLevel: 2,
    city: 'Remote',
    description: 'Provision and operate cloud infrastructure as code; manage networking, IAM, and cost optimization.',
  },
];

function parseAdminArg(argv) {
  const arg = argv.find((a) => a.startsWith('--admin='));
  return arg ? arg.slice('--admin='.length).trim() : null;
}

async function main() {
  const adminEmail = parseAdminArg(process.argv.slice(2));
  if (!adminEmail) {
    console.error('Usage: node scripts/seed-jobs.js --admin=<existing-admin-email>');
    process.exit(1);
  }

  await connectDB({ retry: false });

  const admin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (!admin) {
    console.error(`No user found with email ${adminEmail}`);
    await disconnectDB();
    process.exit(1);
  }
  if (admin.role !== 'admin') {
    console.error(`${admin.email} is not an admin. Use scripts/create-admin.js first.`);
    await disconnectDB();
    process.exit(1);
  }

  console.log(`[dev/demo only] Seeding ${DEMO_JOBS.length} job postings as ${admin.email}...`);

  let created = 0;
  let updated = 0;
  for (const job of DEMO_JOBS) {
    const existing = await Job.findOne({ title: job.title, city: job.city, createdBy: admin._id });
    if (existing) {
      existing.set(job);
      await existing.save();
      updated += 1;
    } else {
      await Job.create({ ...job, createdBy: admin._id });
      created += 1;
    }
  }

  console.log(`Done: ${created} created, ${updated} updated (idempotent by title+city+admin).`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('seed-jobs failed:', err.message);
  await disconnectDB();
  process.exit(1);
});