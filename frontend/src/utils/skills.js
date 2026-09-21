// Mirrors backend/src/utils/skillNormalizer.js for display/entry consistency.
// The backend remains authoritative — it re-normalizes every skill on save and search.
const SYNONYMS = {
  'ui/ux': 'UI/UX',
  'ui ux': 'UI/UX',
  'ui-ux': 'UI/UX',
  uiux: 'UI/UX',
  ux: 'UI/UX',
  ui: 'UI/UX',
  'product design': 'UI/UX',
  'interaction design': 'UI/UX',
  figma: 'Figma',

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

  redux: 'Redux',

  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  redis: 'Redis',
  sqlite: 'SQLite',

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

  jest: 'Jest',
  selenium: 'Selenium',
  cypress: 'Cypress',
  postman: 'Postman',
  pytest: 'pytest',
  playwright: 'Playwright',

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

  rest: 'REST APIs',
  restful: 'REST APIs',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  graphql: 'GraphQL',
  grpc: 'gRPC',
  'power bi': 'Power BI',
  'apache spark': 'Apache Spark',
  spark: 'Apache Spark',
  airflow: 'Airflow',
  prometheus: 'Prometheus',
  grafana: 'Grafana',
  opencv: 'OpenCV',
  transformers: 'Transformers',
  llm: 'Large Language Models',
  llms: 'Large Language Models',
  'large language models': 'Large Language Models',
  rag: 'Retrieval-Augmented Generation',
  'retrieval augmented generation': 'Retrieval-Augmented Generation',
  'retrieval-augmented generation': 'Retrieval-Augmented Generation',
  'prompt engineering': 'Prompt Engineering',
  'vector databases': 'Vector Databases',
  'vector database': 'Vector Databases',
  'llm evaluation': 'LLM Evaluation',
  'fine tuning': 'Fine-tuning',
  'fine-tuning': 'Fine-tuning',
  'ai safety': 'AI Safety',
  sqlalchemy: 'SQLAlchemy',
  celery: 'Celery',
  firebase: 'Firebase',
  'data visualization': 'Data Visualization',
  'data visualisation': 'Data Visualization',
  'api testing': 'API Testing',
  networking: 'Networking',
};

export function normalizeSkillName(raw) {
  const cleaned = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return SYNONYMS[cleaned.toLowerCase()] ?? cleaned;
}

export function parseSkillsInput(value) {
  return value
    .split(',')
    .map((s) => normalizeSkillName(s))
    .filter(Boolean);
}

export function duplicateNormalizedSkills(skills) {
  const normalized = skills.map((s) => s.toLowerCase());
  return new Set(normalized).size !== normalized.length;
}
