import { connectDB, disconnectDB } from '../src/config/db.js';
import { Job } from '../src/models/job.js';
import { User } from '../src/models/user.js';
import { AI_ENGINEER_JOB } from './ai-engineer-job.js';

// DEVELOPMENT / DEMO ONLY — idempotent job seed data.
//
//   node scripts/seed-jobs.js --admin=admin@example.com
//
// Requires a real existing admin account (their ObjectId is used as createdBy).
// Upserts by (title, city, createdBy), so running it repeatedly is safe.
// Only touches the `jobs` collection; placement collections are untouched.

const DEMO_JOBS = [
  AI_ENGINEER_JOB,
  {
    title: 'Frontend Developer',
    company: 'Northstar Labs',
    skills: ['React', 'JavaScript', 'TypeScript', 'REST APIs'],
    experienceLevel: 1,
    city: 'Chennai',
    description: 'Build and maintain responsive web interfaces for campus placement dashboards. Work with designers and backend engineers to ship accessible, tested UI.',
  },
  {
    title: 'Backend Developer',
    company: 'Orbit Systems',
    skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs'],
    experienceLevel: 2,
    city: 'Bangalore',
    description: 'Design and implement REST APIs, data models, and integrations. Own service reliability and write automated tests.',
  },
  {
    title: 'FastAPI Platform Engineer',
    company: 'Northstar Labs',
    skills: ['FastAPI', 'Python', 'PostgreSQL', 'Redis', 'Docker'],
    experienceLevel: 2,
    city: 'Remote',
    description: 'Build typed Python APIs and data services for a distributed product. Own observability, testing, and reliable integrations.',
  },
  {
    title: 'Java Backend Engineer',
    company: 'VertexWorks',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'REST APIs', 'Docker'],
    experienceLevel: 2,
    city: 'Bangalore',
    description: 'Design resilient Spring Boot services, evolve relational data models, and ship well-tested APIs with product teams.',
  },
  {
    title: 'Full Stack Developer',
    company: 'Acme Digital',
    skills: ['React', 'Node.js', 'MongoDB', 'Docker'],
    experienceLevel: 3,
    city: 'Hyderabad',
    description: 'Own features end to end across a MERN stack, from database schema to deployed UI. Containerized deployments with Docker.',
  },
  {
    title: 'Data Analyst',
    company: 'Vortex Analytics',
    skills: ['Python', 'SQL', 'Pandas', 'Data Visualization'],
    experienceLevel: 0,
    city: 'Chennai',
    description: 'Turn placement and student datasets into actionable dashboards and reports for the placement cell.',
  },
  {
    title: 'Machine Learning Engineer',
    company: 'SignalForge',
    skills: ['Python', 'PyTorch', 'scikit-learn', 'NLP'],
    experienceLevel: 2,
    city: 'Pune',
    description: 'Build and evaluate ML models for resume parsing and skill matching. Experience with NLP pipelines preferred.',
  },
  {
    title: 'DevOps Engineer',
    company: 'Cloudline',
    skills: ['Docker', 'Kubernetes', 'CI/CD Pipelines', 'AWS'],
    experienceLevel: 3,
    city: 'Bangalore',
    description: 'Automate build, test, and deployment pipelines; operate containerized services on AWS with monitoring and alerting.',
  },
  {
    title: 'QA / Test Engineer',
    company: 'Quality Loop',
    skills: ['Testing', 'Selenium', 'API Testing', 'CI/CD Pipelines'],
    experienceLevel: 1,
    city: 'Noida',
    description: 'Write and maintain automated test suites for web and API surfaces; integrate tests into CI and track defects.',
  },
  {
    title: 'Cloud Engineer',
    company: 'Nimbus Stack',
    skills: ['AWS', 'Terraform', 'Linux', 'Networking'],
    experienceLevel: 2,
    city: 'Remote',
    description: 'Provision and operate cloud infrastructure as code; manage networking, IAM, and cost optimization.',
  },
  {
    title: 'Django API Engineer',
    company: 'Civic Cloud',
    skills: ['Python', 'Django', 'Django REST Framework', 'PostgreSQL', 'Redis', 'Celery', 'Docker', 'pytest'],
    experienceLevel: 2,
    city: 'Delhi',
    description: 'Build secure Django services and background workflows for a high-volume civic platform. Own API quality, data migrations, and observability.',
  },
  {
    title: 'Flask Microservices Developer',
    company: 'Maple Works',
    skills: ['Python', 'Flask', 'SQLAlchemy', 'PostgreSQL', 'Redis', 'REST APIs', 'Docker', 'pytest'],
    experienceLevel: 1,
    city: 'Pune',
    description: 'Ship small, reliable Python services with clear contracts, practical tests, and production-ready container deployments.',
  },
  {
    title: '.NET Cloud Application Engineer',
    company: 'BluePeak Software',
    skills: ['C#', '.NET', 'ASP.NET Core', 'SQL Server', 'Azure', 'Docker', 'REST APIs', 'CI/CD Pipelines'],
    experienceLevel: 2,
    city: 'Hyderabad',
    description: 'Develop cloud-first .NET APIs and worker services, improve delivery pipelines, and partner with product teams on resilient features.',
  },
  {
    title: 'Go Backend Engineer',
    company: 'Relay Networks',
    skills: ['Go', 'REST APIs', 'GraphQL', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'gRPC'],
    experienceLevel: 2,
    city: 'Bangalore',
    description: 'Build fast, observable Go services for event-driven products. Experience with distributed systems and API design is welcome.',
  },
  {
    title: 'Vue.js Frontend Engineer',
    company: 'Harbor Studio',
    skills: ['Vue', 'TypeScript', 'JavaScript', 'Vite', 'Cypress', 'REST APIs', 'Figma', 'CSS'],
    experienceLevel: 1,
    city: 'Remote',
    description: 'Create polished, accessible product experiences in Vue and TypeScript, collaborating closely with design and platform teams.',
  },
  {
    title: 'React Native Developer',
    company: 'PocketPath',
    skills: ['React Native', 'React', 'JavaScript', 'TypeScript', 'REST APIs', 'Jest', 'Firebase'],
    experienceLevel: 2,
    city: 'Chennai',
    description: 'Build and release mobile features across iOS and Android with a shared React Native codebase and dependable test coverage.',
  },
  {
    title: 'Product Designer',
    company: 'Northstar Labs',
    skills: ['UI/UX', 'Figma', 'Design Systems', 'User Research', 'Prototyping', 'Accessibility'],
    experienceLevel: 1,
    city: 'Mumbai',
    description: 'Shape clear user flows and reusable interface patterns from discovery through delivery. Bring curiosity, craft, and strong communication.',
  },
  {
    title: 'Data Engineer',
    company: 'SignalForge',
    skills: ['Python', 'SQL', 'PostgreSQL', 'Apache Spark', 'Airflow', 'AWS', 'Docker', 'Data Pipelines'],
    experienceLevel: 2,
    city: 'Remote',
    description: 'Design dependable data pipelines and curated datasets that power product analytics and machine learning teams.',
  },
  {
    title: 'Business Intelligence Analyst',
    company: 'Vortex Analytics',
    skills: ['SQL', 'Python', 'Pandas', 'Power BI', 'Data Visualization', 'Excel', 'Stakeholder Management'],
    experienceLevel: 1,
    city: 'Chennai',
    description: 'Translate operational questions into trusted metrics, dashboards, and concise recommendations for business stakeholders.',
  },
  {
    title: 'Computer Vision Engineer',
    company: 'Visionary Robotics',
    skills: ['Python', 'PyTorch', 'Computer Vision', 'OpenCV', 'TensorFlow', 'Docker', 'Deep Learning'],
    experienceLevel: 3,
    city: 'Hyderabad',
    description: 'Prototype, evaluate, and productionize visual perception models with a focus on measurable quality and reliable inference.',
  },
  {
    title: 'NLP / LLM Engineer',
    company: 'Context Labs',
    skills: ['Python', 'PyTorch', 'NLP', 'Transformers', 'FastAPI', 'Vector Databases', 'Docker', 'Machine Learning'],
    experienceLevel: 2,
    city: 'Remote',
    description: 'Build practical language features from data preparation through evaluation and API delivery. Strong experimentation habits matter.',
  },
  {
    title: 'Site Reliability Engineer',
    company: 'Cloudline',
    skills: ['Linux', 'Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'Grafana', 'CI/CD Pipelines', 'Python'],
    experienceLevel: 3,
    city: 'Bangalore',
    description: 'Improve availability and developer velocity through automation, observability, incident learning, and resilient infrastructure.',
  },
  {
    title: 'Security Engineer',
    company: 'ShieldWorks',
    skills: ['Python', 'Linux', 'OWASP', 'Docker', 'AWS', 'Kubernetes', 'Networking', 'Threat Modeling'],
    experienceLevel: 2,
    city: 'Noida',
    description: 'Help teams build safer systems through practical threat modeling, secure defaults, vulnerability triage, and developer education.',
  },
  {
    title: 'Automation QA Engineer',
    company: 'Quality Loop',
    skills: ['Playwright', 'Cypress', 'Selenium', 'API Testing', 'Postman', 'JavaScript', 'CI/CD Pipelines', 'Jest'],
    experienceLevel: 1,
    city: 'Pune',
    description: 'Design reliable browser and API automation that gives product teams fast feedback without slowing delivery.',
  },
  {
    title: 'Technical Project Coordinator',
    company: 'VertexWorks',
    skills: ['Agile', 'Jira', 'SQL', 'REST APIs', 'Stakeholder Management', 'Documentation', 'Project Planning'],
    experienceLevel: 1,
    city: 'Delhi',
    description: 'Coordinate cross-functional delivery, keep decisions visible, and help teams turn product goals into shippable milestones.',
  },
  {
    title: 'IoT Software Engineer',
    company: 'Relay Networks',
    skills: ['C++', 'Python', 'Linux', 'MQTT', 'Docker', 'Networking', 'REST APIs', 'Embedded Systems'],
    experienceLevel: 2,
    city: 'Hyderabad',
    description: 'Develop dependable edge software and device integrations for connected products, from protocol design to field diagnostics.',
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
