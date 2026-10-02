import { computeBestMatches, computeScore } from './scoringService.js';

const SOURCE_NAMES = { resume: 'Resume', github: 'GitHub projects', leetcode: 'LeetCode practice', coding_user_provided: 'Other coding profile', linkedin_user_provided: 'LinkedIn profile text' };
const descriptive = (text) => /\b(built|developed|implemented|created|trained|deployed|designed|integrated|tested|maintained|optimized|used|using|migrated)\b/i.test(text);

function alignment(ontology, skills, source) {
  const scoped = skills.filter((skill) => skill.sources?.includes(source)).map((skill) => {
    const evidence = (skill.evidence ?? []).filter((entry) => entry.source === source);
    // Depth from a resume must never upgrade a GitHub keyword or practice count.
    const depth = !['leetcode', 'coding_user_provided'].includes(source) && evidence.some((entry) => descriptive(entry.text)) ? 'medium' : 'low';
    return { ...skill, evidence, proficiency_signals: { mentions_depth: depth } };
  });
  const matches = computeBestMatches(ontology, scoped);
  return { score: computeScore(matches), skills: matches.filter((item) => item.m > 0).map((item) => item.skill) };
}

export function buildProfileAssessment(submission, skillProfiles, ontology) {
  const skills = skillProfiles.map((skill) => skill.toObject ? skill.toObject() : skill);
  const snapshot = submission.source_evidence ?? {};
  const repos = snapshot.github?.repos ?? [];
  const lc = snapshot.leetcode ?? {};
  const sources = Object.entries(SOURCE_NAMES).map(([id, label]) => {
    const match = alignment(ontology, skills, id);
    let available = false;
    let status = 'not_provided';
    let score = match.score;
    let formula = 'Weighted coverage of target-role skills supported by this source; shallow mentions receive partial credit.';
    const details = [];
    if (id === 'resume') {
      available = Boolean(submission.resume_text); status = available ? 'assessed' : 'unavailable';
      details.push(`${match.skills.length} target-role skills found in resume evidence.`);
    } else if (id === 'github') {
      available = Boolean(snapshot.github?.available);
      status = available ? (snapshot.github.partial ? 'partial' : 'assessed') : (submission.github_username ? 'unavailable' : 'not_provided');
      const unavailableReadmes = repos.filter((repo) => repo.readmeStatus === 'unavailable' || (!repo.readmeStatus && !repo.readme?.trim())).length;
      if (available && unavailableReadmes) { available = false; status = 'partial'; details.push(`${unavailableReadmes} README responses were unavailable. The GitHub score is withheld until documentation can be assessed.`); }
      const documented = repos.filter((repo) => (repo.readme ?? '').trim().length >= 100).length;
      const documentation = repos.length ? Math.round(100 * documented / repos.length) : 0;
      score = Math.round(match.score * 0.7 + documentation * 0.3);
      formula = '70% role-skill coverage + 30% share of sampled repositories with at least 100 characters of README text. No stars or follower counts.';
      details.push(`${repos.length} public, non-fork repositories sampled; ${documented} with a substantive README excerpt.`, `${match.skills.length} role skills supported. Repository code was not executed or comprehensively reviewed.`);
    } else if (id === 'leetcode') {
      available = Boolean(lc.available);
      status = available ? 'assessed' : (submission.leetcode_username ? 'unavailable' : 'not_provided');
      const levels = [lc.easy, lc.medium, lc.hard].filter((n) => Number.isFinite(n) && n > 0).length;
      // A disclosed practice milestone, not a claim about proficiency or rank.
      if (Number.isFinite(lc.totalSolved)) {
        score = Math.round(60 * Math.min(lc.totalSolved / 50, 1) + 40 * levels / 3);
        formula = 'Practice milestone: up to 60 points for 50 unique solved problems + up to 40 for practice across Easy, Medium, and Hard. This does not measure code quality or job readiness.';
        details.push(`${lc.totalSolved} unique problems solved. Easy: ${lc.easy ?? 'unknown'}; Medium: ${lc.medium ?? 'unknown'}; Hard: ${lc.hard ?? 'unknown'}.`);
      } else {
        available = false; status = lc.available ? 'partial' : status;
        details.push('Unique solved totals are unavailable. Language counts may overlap and are not added together.');
      }
      details.push(`Reported languages: ${(lc.languages ?? []).map((entry) => entry.name).join(', ') || 'none'}. Solved problem identities were not retrieved.`);
    } else {
      const text = id === 'linkedin_user_provided' ? submission.linkedinSummaryText : submission.codingSummaryText;
      const url = id === 'linkedin_user_provided' ? submission.linkedinUrl : submission.codingProfileUrl;
      available = Boolean(text?.trim()); status = available ? 'user_provided' : url ? 'link_only' : 'not_provided';
      details.push(available ? `${match.skills.length} role skills in the text you supplied. This source has not been independently verified.` : 'A URL alone is not evidence. Add profile or practice text to include this source.');
    }
    return { id, label, status, score: available ? score : null, roleAlignment: available ? match.score : null, matchedSkills: available ? match.skills : [], formula, details };
  });
  const assessed = sources.filter((source) => source.score !== null);
  const crossSourceSkills = skills.map((skill) => ({ skill: skill.name, sources: [...new Set((skill.evidence ?? []).filter((entry) => entry.text?.trim()).map((entry) => entry.source))] })).filter((entry) => entry.sources.length > 1).slice(0, 30);
  const hasComparison = sources.some((source) => source.id !== 'resume' && source.score !== null);
  return {
    version: 'profile-evidence-v1',
    score: assessed.length ? Math.round(assessed.reduce((sum, source) => sum + source.score, 0) / assessed.length) : null,
    assessedSources: assessed.length,
    totalSources: sources.length,
    summary: 'An equal average of the available source scores below. Missing or unavailable sources are excluded, not scored zero. Read it with coverage: scores with different source coverage are not directly comparable. This is a self-review rubric, not an ATS score or hiring prediction.',
    sources,
    crossSourceSkills,
    resumeOnlySkills: hasComparison ? skills.filter((skill) => skill.sources?.includes('resume') && !skill.sources.some((source) => source !== 'resume')).map((skill) => skill.name).slice(0, 20) : [],
    projects: repos.slice(0, 10).map((repo) => ({ name: repo.name, description: repo.description || '', hasReadme: (repo.readme ?? '').trim().length >= 100, url: `https://github.com/${encodeURIComponent(submission.github_username)}/${encodeURIComponent(repo.name)}` })),
    capturedAt: snapshot.capturedAt ?? null,
  };
}
