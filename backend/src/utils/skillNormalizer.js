// Explicit, small synonym map for canonical skill names.
// Keys are lowercase lookup forms; values are the canonical display names.
// Unknown skills are preserved as-is (trimmed, original casing) so the map stays
// intentionally small and never hides data.
const SYNONYMS = {
  // design (kept strictly separate from frontend engineering)
  'ui/ux': 'UI/UX',
  'ui ux': 'UI/UX',
  'ui-ux': 'UI/UX',
  uiux: 'UI/UX',
  ux: 'UI/UX',
  ui: 'UI/UX',
  'product design': 'UI/UX',
  'interaction design': 'UI/UX',
  figma: 'Figma',

  // frontend frameworks
  react: 'React',
  reactjs: 'React',
  'react.js': 'React',
  vue: 'Vue',
  vuejs: 'Vue',
  'vue.js': 'Vue',
  angular: 'Angular',
  angularjs: 'Angular',
  next: 'Next.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  redux: 'Redux',

  // backend frameworks / runtimes
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  express: 'Express',
  expressjs: 'Express',
  'express.js': 'Express',
  fastapi: 'FastAPI',
  django: 'Django',
  'spring boot': 'Spring Boot',
  flask: 'Flask',
  'react native': 'React Native',
  '.net': '.NET',
  dotnet: '.NET',
  'asp.net': 'ASP.NET Core',
  'asp.net core': 'ASP.NET Core',

  // databases
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  redis: 'Redis',
  sqlite: 'SQLite',

  // ml
  pytorch: 'PyTorch',
  torch: 'PyTorch',
  tensorflow: 'TensorFlow',
  tf: 'TensorFlow',
  sklearn: 'scikit-learn',
  scikitlearn: 'scikit-learn',
  'scikit learn': 'scikit-learn',
  pandas: 'Pandas',
  numpy: 'NumPy',
  'machine learning': 'Machine Learning',
  'deep learning': 'Deep Learning',
  nlp: 'NLP',
  'natural language processing': 'NLP',
  'computer vision': 'Computer Vision',

  // devops / cloud
  docker: 'Docker',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  terraform: 'Terraform',
  ansible: 'Ansible',
  'ci/cd': 'CI/CD Pipelines',
  cicd: 'CI/CD Pipelines',
  'ci cd': 'CI/CD Pipelines',
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'GCP',
  'google cloud': 'GCP',
  azure: 'Azure',
  linux: 'Linux',

  // testing
  jest: 'Jest',
  selenium: 'Selenium',
  cypress: 'Cypress',
  postman: 'Postman',
  pytest: 'pytest',
  playwright: 'Playwright',

  // languages / web basics
  javascript: 'JavaScript',
  js: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  python: 'Python',
  java: 'Java',
  golang: 'Go',
  go: 'Go',
  'c++': 'C++',
  cpp: 'C++',
  'c#': 'C#',
  csharp: 'C#',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  bash: 'Bash',
  shell: 'Shell',

  // apis
  rest: 'REST APIs',
  restful: 'REST APIs',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  graphql: 'GraphQL',
  grpc: 'gRPC',

  // data, observability, and product tooling
  'power bi': 'Power BI',
  'apache spark': 'Apache Spark',
  spark: 'Apache Spark',
  airflow: 'Airflow',
  prometheus: 'Prometheus',
  grafana: 'Grafana',
  opencv: 'OpenCV',
  transformers: 'Transformers',
  sqlalchemy: 'SQLAlchemy',
  celery: 'Celery',
  firebase: 'Firebase',
  'data visualization': 'Data Visualization',
  'data visualisation': 'Data Visualization',
  'api testing': 'API Testing',
  networking: 'Networking',
};

export function normalizeSkillName(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const key = cleaned.toLowerCase();
  return SYNONYMS[key] ?? cleaned;
}

export function normalizeSkills(skills) {
  return (skills ?? []).map(normalizeSkillName).filter(Boolean);
}

export function hasDuplicateNormalizedSkills(skills) {
  const normalized = normalizeSkills(skills).map((s) => s.toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

export { SYNONYMS };
