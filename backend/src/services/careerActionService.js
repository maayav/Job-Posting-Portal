// Destinations are maintained here, never invented by a text provider.
export const PRACTICE_CATALOG = [
  { id: 'lc-two-sum', title: 'Two Sum', platform: 'LeetCode', topic: 'Arrays and hash maps', difficulty: 'Easy', group: 'dsa', url: 'https://leetcode.com/problems/two-sum/' },
  { id: 'lc-parentheses', title: 'Valid Parentheses', platform: 'LeetCode', topic: 'Stacks', difficulty: 'Easy', group: 'dsa', url: 'https://leetcode.com/problems/valid-parentheses/' },
  { id: 'lc-reverse-list', title: 'Reverse Linked List', platform: 'LeetCode', topic: 'Linked lists', difficulty: 'Easy', group: 'dsa', url: 'https://leetcode.com/problems/reverse-linked-list/' },
  { id: 'lc-binary-search', title: 'Binary Search', platform: 'LeetCode', topic: 'Binary search', difficulty: 'Easy', group: 'dsa', url: 'https://leetcode.com/problems/binary-search/' },
  { id: 'hr-arrays', title: 'Arrays - DS', platform: 'HackerRank', topic: 'Arrays', difficulty: 'Easy', group: 'dsa', url: 'https://www.hackerrank.com/challenges/arrays-ds/problem' },
  { id: 'hr-tree', title: 'Binary Search Tree: Insertion', platform: 'HackerRank', topic: 'Trees', difficulty: 'Easy', group: 'dsa', url: 'https://www.hackerrank.com/challenges/binary-search-tree-insertion/problem' },
  { id: 'hr-sql', title: 'Select All', platform: 'HackerRank', topic: 'SQL queries', difficulty: 'Easy', group: 'sql', url: 'https://www.hackerrank.com/challenges/select-all-sql/problem' },
];

export function practiceForRole(role, requiredSkills) {
  const labels = requiredSkills.join(' ');
  const dsa = /data structures|algorithms|\bdsa\b/i.test(labels) || /software|backend|frontend|full.?stack|mobile|game|\bSDE\b|AI Engineer|Machine Learning/i.test(role);
  const sql = /\bsql\b|postgres|mysql/i.test(labels);
  return PRACTICE_CATALOG.filter((item) => (item.group === 'dsa' && dsa) || (item.group === 'sql' && sql));
}

export function buildCareerActions({ role, plan, requiredSkills, assessment }, suggestions) {
  const skills = [...new Set([...plan.map((item) => item.skill), ...requiredSkills])];
  const allowed = new Set(skills.map((skill) => skill.toLowerCase()));
  const validSkill = (entry) => allowed.has(entry.skill?.toLowerCase());
  const fallbackProjects = skills.slice(0, 2).map((skill) => ({
    title: `${skill}: a small ${role} case study`, skill,
    reason: plan.some((item) => item.skill === skill) ? `Add concrete evidence for ${skill}, which is in your learning plan.` : `Show how you apply ${skill} in a role-relevant task.`,
    deliverables: [`Define one real problem that needs ${skill}.`, 'Build a small working example and document how to reproduce it.', 'Include test cases or an evaluation, its limitations, and a short walkthrough.'],
  }));
  const projects = suggestions?.projects?.filter(validSkill).slice(0, 3) || [];
  const chosenProjects = projects.length ? projects : fallbackProjects;
  const catalog = practiceForRole(role, requiredSkills);
  const requestedIds = new Set(suggestions?.practiceIds ?? []);
  const chosen = catalog.filter((item) => requestedIds.has(item.id));
  const selected = chosen.length ? chosen : catalog;
  const groups = [...new Set(catalog.map((item) => item.group))];
  const representatives = groups.map((group) => selected.find((item) => item.group === group) ?? catalog.find((item) => item.group === group));
  const balanced = [...representatives, ...selected].filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index);
  const practice = balanced.slice(0, 6).map(({ group: _group, ...item }) => ({ ...item, reason: `Practice ${item.topic.toLowerCase()} for ${role}. Explain the approach, test edge cases, and compare complexity. If already solved, revisit it without hints or choose another exercise in the linked catalog.` }));
  const posts = chosenProjects.slice(0, 2).map((project) => ({
    title: `Share your ${project.skill} build plan`, skill: project.skill,
    outline: ['Explain the problem you plan to tackle.', 'Describe the approach and what you will test.', 'After building it, share a real result, a limitation, and your project link.'],
    draft: `I’m planning a small project to practice ${project.skill} for ${role}: ${project.title}.\n\nThe problem I want to solve: [add your actual problem].\nWhat I plan to test: [add your test or evaluation].\n\nI’ll share the working example and what I learn when it is ready.`,
  }));
  return { mode: suggestions ? 'ai_assisted' : 'curated', projects: chosenProjects, practice, posts, note: `Suggestions use your target role and available evidence (${assessment.assessedSources}/${assessment.totalSources} sources assessed). Practice links are curated; solved problem identities are unknown. LinkedIn drafts are editable starting points and are never posted automatically.` };
}
