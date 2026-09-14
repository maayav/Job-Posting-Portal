import { ProfileSubmission } from '../models/profileSubmission.js';
import { ExtractedSkillProfile } from '../models/extractedSkillProfile.js';
import { extractSkills } from './geminiService.js';

function buildProfileText(submission, github) {
  const parts = [];
  parts.push('=== RESUME ===');
  parts.push(submission.resume_text);

  if (github?.repos?.length) {
    parts.push('\n=== GITHUB PROFILE ===');
    parts.push(`Username: ${github.username}`);
    for (const repo of github.repos) {
      parts.push(`\nRepo: ${repo.name}`);
      if (repo.language) parts.push(`Primary language: ${repo.language}`);
      if (repo.languages && Object.keys(repo.languages).length) {
        parts.push(`Languages: ${Object.entries(repo.languages).map(([k]) => k).join(', ')}`);
      }
      if (repo.topics?.length) parts.push(`Topics: ${repo.topics.join(', ')}`);
      for (const [file, content] of Object.entries(repo.manifests || {})) {
        parts.push(`\n--- ${file} ---\n${content}`);
      }
      if (repo.readme) parts.push(`\nREADME excerpt:\n${repo.readme}`);
    }
  }

  return parts.join('\n');
}

function deriveConfidence(sources, evidence) {
  const sourcesWithEvidence = new Set(evidence.filter((e) => e.text?.trim()).map((e) => e.source));
  if (sourcesWithEvidence.size >= 2) return 'high';
  if (sourcesWithEvidence.size === 1) return 'medium';
  return 'low';
}

function mergeSkills(geminiSkills) {
  const map = new Map();
  for (const skill of geminiSkills) {
    const key = skill.name.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        name: skill.name.trim(),
        sources: [...new Set(skill.sources)],
        evidence: skill.evidence || [],
      });
      continue;
    }
    const existing = map.get(key);
    existing.sources = [...new Set([...existing.sources, ...skill.sources])];
    const existingKeys = new Set(existing.evidence.map((e) => `${e.source}:${e.text}`));
    for (const item of skill.evidence || []) {
      const k = `${item.source}:${item.text}`;
      if (!existingKeys.has(k)) {
        existing.evidence.push(item);
        existingKeys.add(k);
      }
    }
  }
  return [...map.values()].map((skill) => ({
    ...skill,
    confidence: deriveConfidence(skill.sources, skill.evidence),
  }));
}

export async function processExtraction(submissionId, githubData) {
  const submission = await ProfileSubmission.findById(submissionId);
  if (!submission) {
    const err = new Error('Submission not found');
    err.code = 'submission_missing';
    throw err;
  }

  const profileText = buildProfileText(submission, githubData);
  const { skills: geminiSkills, model: usedModel } = await extractSkills(profileText);
  const skills = mergeSkills(geminiSkills);

  const saved = await ExtractedSkillProfile.findOneAndUpdate(
    { submission_id: submissionId },
    { $set: { skills, gemini_model: usedModel } },
    { upsert: true, returnDocument: 'after' }
  );

  return saved;
}