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

  // frontend / design keywords
  tailwind: 'Tailwind CSS',
  tailwindcss: 'Tailwind CSS',
  html: 'HTML/CSS',
  html5: 'HTML/CSS',
  css: 'HTML/CSS',
  css3: 'HTML/CSS',
  'html/css': 'HTML/CSS',
  a11y: 'Web Accessibility',
  accessibility: 'Web Accessibility',
  'web accessibility': 'Web Accessibility',
  'web performance': 'Web Performance',
  'responsive design': 'Responsive Design',
  'responsive web design': 'Responsive Design',
  vite: 'Vite',

  // mobile
  flutter: 'Flutter',
  kotlin: 'Kotlin',
  swift: 'Swift',
  firebase: 'Firebase',
  'mobile ui design': 'Mobile UI Design',
  'push notifications': 'Push Notifications',
  'app store deployment': 'App Store Deployment',

  // data / analytics
  excel: 'Microsoft Excel',
  'microsoft excel': 'Microsoft Excel',
  powerbi: 'Power BI',
  'power bi': 'Power BI',
  tableau: 'Tableau',
  'data cleaning': 'Data Cleaning',
  'dashboard design': 'Dashboard Design',
  'data storytelling': 'Data Storytelling',

  // blockchain
  solidity: 'Solidity',
  ethereum: 'Ethereum',
  'smart contracts': 'Smart Contracts',
  'smart contract': 'Smart Contracts',
  web3: 'Web3.js',
  web3js: 'Web3.js',
  'web3.js': 'Web3.js',
  hardhat: 'Hardhat',
  cryptography: 'Cryptography',
  'blockchain security': 'Blockchain Security',
  ipfs: 'IPFS',

  // game development
  unity: 'Unity',
  unreal: 'Unreal Engine',
  'unreal engine': 'Unreal Engine',
  'c#': 'C#',
  csharp: 'C#',
  'c++': 'C++',
  cpp: 'C++',
  'game physics': 'Game Physics',
  '3d mathematics': '3D Mathematics',
  '3d math': '3D Mathematics',
  shader: 'Shaders',
  shaders: 'Shaders',
  'game design': 'Game Design',

  // design systems / research
  'design systems': 'Design Systems',
  'design system': 'Design Systems',
  prototyping: 'Prototyping',
  'user research': 'User Research',
  wireframe: 'Wireframing',
  wireframing: 'Wireframing',
  'interaction design': 'Interaction Design',
  'usability testing': 'Usability Testing',

  // networking
  'tcp/ip': 'TCP/IP',
  tcpip: 'TCP/IP',
  tcp: 'TCP/IP',
  'routing and switching': 'Routing and Switching',
  dns: 'DNS',
  'network monitoring': 'Network Monitoring',
  'load balancing': 'Load Balancing',
  'load balancer': 'Load Balancing',
  loadbalancer: 'Load Balancing',
  'cloud networking': 'Cloud Networking',

  // reliability / databases / analysis
  observability: 'Observability',
  slo: 'Service Level Objectives',
  'service level objectives': 'Service Level Objectives',
  'database tuning': 'Database Tuning',
  'query optimization': 'Query Optimization',
  'backup and recovery': 'Backup and Recovery',
  'database replication': 'Database Replication',
  indexing: 'Indexing',
  'database indexing': 'Indexing',
  'high availability': 'High Availability',
  'requirements gathering': 'Requirements Gathering',
  'process modeling': 'Process Modeling',
  'stakeholder communication': 'Stakeholder Communication',
  'user story': 'User Stories',
  'user stories': 'User Stories',
  agile: 'Agile Methodologies',
  'agile methodologies': 'Agile Methodologies',
  bpmn: 'Business Process Modeling',
  'business process modeling': 'Business Process Modeling',
  jira: 'Jira',
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
