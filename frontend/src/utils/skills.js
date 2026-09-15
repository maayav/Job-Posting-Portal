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

  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',

  pytorch: 'PyTorch',
  torch: 'PyTorch',
  tensorflow: 'TensorFlow',
  sklearn: 'scikit-learn',
  scikitlearn: 'scikit-learn',
  'scikit learn': 'scikit-learn',
  pandas: 'Pandas',
  numpy: 'NumPy',

  docker: 'Docker',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  'ci/cd': 'CI/CD Pipelines',
  cicd: 'CI/CD Pipelines',
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'GCP',
  azure: 'Azure',

  javascript: 'JavaScript',
  js: 'JavaScript',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  python: 'Python',
  java: 'Java',
  golang: 'Go',
  go: 'Go',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',

  rest: 'REST APIs',
  restful: 'REST APIs',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  graphql: 'GraphQL',
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