const CANONICAL: Record<string, string> = {
  // React ecosystem
  'reactjs': 'React', 'react.js': 'React', 'react js': 'React',
  // Node.js
  'nodejs': 'Node.js', 'node js': 'Node.js', 'node': 'Node.js',
  // Express
  'expressjs': 'Express.js', 'express': 'Express.js', 'express.js': 'Express.js',
  // Vue
  'vuejs': 'Vue.js', 'vue': 'Vue.js', 'vue.js': 'Vue.js',
  // Next.js
  'nextjs': 'Next.js', 'next.js': 'Next.js',
  // Angular
  'angularjs': 'Angular', 'angular.js': 'Angular',
  // JavaScript / TypeScript
  'js': 'JavaScript', 'javascript': 'JavaScript',
  'ts': 'TypeScript', 'typescript': 'TypeScript',
  // Python
  'py': 'Python', 'python': 'Python',
  // Go
  'golang': 'Go',
  // Java
  'java': 'Java',
  // C#
  'c#': 'C#', 'csharp': 'C#', 'c sharp': 'C#',
  // C++
  'c++': 'C++', 'cpp': 'C++',
  // Ruby
  'ruby on rails': 'Ruby on Rails', 'ror': 'Ruby on Rails', 'rails': 'Ruby on Rails',
  // Databases
  'postgresql': 'PostgreSQL', 'postgres': 'PostgreSQL',
  'mongodb': 'MongoDB', 'mongo': 'MongoDB',
  'mysql': 'MySQL',
  'sql': 'SQL', 'nosql': 'NoSQL',
  'redis': 'Redis',
  'elasticsearch': 'Elasticsearch', 'elastic search': 'Elasticsearch',
  // Cloud
  'amazon web services': 'AWS', 'aws': 'AWS',
  'google cloud platform': 'GCP', 'google cloud': 'GCP', 'gcp': 'GCP',
  'microsoft azure': 'Azure', 'azure': 'Azure',
  // DevOps
  'docker': 'Docker',
  'kubernetes': 'Kubernetes', 'k8s': 'Kubernetes',
  'terraform': 'Terraform',
  'ci/cd': 'CI/CD', 'cicd': 'CI/CD',
  'jenkins': 'Jenkins',
  // APIs
  'rest': 'REST API', 'restful': 'REST API', 'rest api': 'REST API', 'restful api': 'REST API',
  'graphql': 'GraphQL',
  'grpc': 'gRPC',
  // Frontend
  'css3': 'CSS', 'css': 'CSS',
  'html5': 'HTML', 'html': 'HTML',
  'tailwindcss': 'Tailwind CSS', 'tailwind': 'Tailwind CSS',
  'material-ui': 'Material UI', 'mui': 'Material UI',
  'redux toolkit': 'Redux', 'redux': 'Redux',
  // Testing
  'jest': 'Jest',
  'cypress': 'Cypress',
  'selenium': 'Selenium',
  // VCS / CI
  'git': 'Git', 'github': 'GitHub', 'gitlab': 'GitLab',
  // Methodologies
  'agile': 'Agile', 'scrum': 'Scrum', 'kanban': 'Kanban',
  // Tools
  'jira': 'Jira', 'confluence': 'Confluence', 'figma': 'Figma',
}

export function normalizeSkill(skill: string): string {
  const key = skill.toLowerCase().trim()
  return CANONICAL[key] ?? skill
}

export function normalizeSkills<T extends { skill: string }>(skills: T[]): T[] {
  return skills.map((s) => ({ ...s, skill: normalizeSkill(s.skill) }))
}
