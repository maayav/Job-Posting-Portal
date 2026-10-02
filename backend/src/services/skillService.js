import { ProfileSubmission } from '../models/profileSubmission.js';
import { ExtractedSkillProfile } from '../models/extractedSkillProfile.js';
import { extractSkills } from './geminiService.js';
import { fetchLeetcodeProfile } from './leetcodeService.js';
import { generateEmbeddings } from './ai/embeddingProvider.js';
import { env } from '../config/env.js';

const SECTION_MARKER = /===\s*(?:RESUME|GITHUB PROFILE|LINKEDIN USER-PROVIDED SUMMARY|LEETCODE PROFILE|CODING USER-PROVIDED SUMMARY)\s*===/gi;

export function sanitizeSourceText(value) {
  return String(value ?? '').replace(SECTION_MARKER, '[profile section marker]');
}

export function buildProfileText(submission, github) {
  const parts = [];
  parts.push('=== RESUME ===');
  parts.push(sanitizeSourceText(submission.resume_text));

  if (submission.linkedinSummaryText) {
    parts.push('\n=== LINKEDIN USER-PROVIDED SUMMARY ===');
    parts.push(sanitizeSourceText(submission.linkedinSummaryText));
  }
  if (submission.codingSummaryText) {
    parts.push('\n=== CODING USER-PROVIDED SUMMARY ===');
    parts.push(sanitizeSourceText(submission.codingSummaryText));
  }

  if (Array.isArray(github?.repos) && github.repos.length) {
    parts.push('\n=== GITHUB PROFILE ===');
    parts.push(`Username: ${sanitizeSourceText(github.username)}`);
    for (const repo of github.repos.slice(0, 10)) {
      if (!repo || typeof repo !== 'object') continue;
      parts.push(`\nRepo: ${sanitizeSourceText(repo.name)}`);
      if (repo.description) parts.push(`Description: ${sanitizeSourceText(repo.description)}`);
      if (repo.language) parts.push(`Primary language: ${sanitizeSourceText(repo.language)}`);
      if (repo.languages && Object.keys(repo.languages).length) {
        parts.push(`Languages: ${Object.entries(repo.languages).map(([k]) => sanitizeSourceText(k)).join(', ')}`);
      }
      if (Array.isArray(repo.topics) && repo.topics.length) parts.push(`Topics: ${repo.topics.map(sanitizeSourceText).join(', ')}`);
      for (const [file, content] of Object.entries(repo.manifests || {})) {
        parts.push(`\n--- ${sanitizeSourceText(file)} ---\n${sanitizeSourceText(content)}`);
      }
      if (repo.readme) parts.push(`\nREADME excerpt:\n${sanitizeSourceText(repo.readme)}`);
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

const DEPTH_RANK = { low: 0, medium: 1, high: 2 };

function defaultProficiency(signals) {
  return {
    projects_count: signals?.projects_count ?? 0,
    has_production_usage: signals?.has_production_usage ?? false,
    mentions_depth: signals?.mentions_depth ?? 'low',
  };
}

function mergeProficiency(a, b) {
  const left = defaultProficiency(a);
  const right = defaultProficiency(b);
  return {
    projects_count: Math.max(left.projects_count, right.projects_count),
    has_production_usage: left.has_production_usage || right.has_production_usage,
    mentions_depth:
      DEPTH_RANK[right.mentions_depth] > DEPTH_RANK[left.mentions_depth]
        ? right.mentions_depth
        : left.mentions_depth,
  };
}

function mergeSkills(geminiSkills) {
  const map = new Map();
  for (const skill of geminiSkills) {
    const key = skill.name.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        name: skill.name.trim(),
        category: skill.category ?? 'other',
        sources: [...new Set(skill.sources)],
        evidence: skill.evidence || [],
        proficiency_signals: defaultProficiency(skill.proficiency_signals),
      });
      continue;
    }
    const existing = map.get(key);
    existing.sources = [...new Set([...existing.sources, ...skill.sources])];
    existing.category = existing.category === 'other' ? skill.category ?? 'other' : existing.category;
    existing.proficiency_signals = mergeProficiency(existing.proficiency_signals, skill.proficiency_signals);
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

  const savedGithub = submission.source_evidence?.github?.available
    ? { username: submission.github_username, ...(submission.toObject ? submission.toObject({ flattenMaps: true }).source_evidence.github : submission.source_evidence.github) } : null;
  githubData = githubData || savedGithub;
  const leetcode = await fetchLeetcodeProfile(submission.leetcode_username);
  // Keep a bounded snapshot of exactly what this analysis observed. Later report
  // views do not re-fetch profiles or silently change their evidence.
  const sourceEvidence = {
    capturedAt: new Date(),
    github: { available: Boolean(githubData), partial: Boolean(githubData?.partial), fetchedAt: githubData?.fetchedAt, repos: (githubData?.repos ?? []).slice(0, 10) },
    leetcode: { available: leetcode.status === 'ok', ...leetcode.metrics },
  };
  const profileText = buildProfileText(submission, githubData) + (leetcode.evidence ? '\n=== LEETCODE PROFILE ===\n' + sanitizeSourceText(leetcode.evidence) : '');
  const { skills: geminiSkills, model: usedModel } = await extractSkills(profileText);
  const skills = mergeSkills(geminiSkills);

  // Cache skill vectors now so later analyses skip the embedding round trip.
  // A failure here must not fail extraction; analysis embeds as a fallback.
  let embeddings = [];
  let embeddingModel = '';
  let embeddingVersion = '';
  try {
    const vectors = await generateEmbeddings(skills.map((skill) => skill.name));
    embeddings = skills.map((skill, index) => ({ name: skill.name, vector: vectors[index] }));
    embeddingModel = env.EMBEDDING_MODEL;
    embeddingVersion = env.EMBEDDING_VERSION;
  } catch (error) {
    console.warn('skill embedding cache skipped', { code: error.code || 'embedding_unavailable' });
  }

  const saved = await ExtractedSkillProfile.findOneAndUpdate(
    { submission_id: submissionId },
    { $set: { skills, gemini_model: usedModel, embeddings, embedding_model: embeddingModel, embedding_version: embeddingVersion } },
    { upsert: true, returnDocument: 'after' }
  );
  await ProfileSubmission.findByIdAndUpdate(submissionId, { $set: { extraction_status: 'completed', extraction_error: null, source_evidence: sourceEvidence, leetcode_status: leetcode.status } });

  return saved;
}
