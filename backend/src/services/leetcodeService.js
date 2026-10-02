import axios from 'axios';
import { assertRequestBudget, requestSignal, requestTimeout } from '../utils/requestBudget.js';

// Unauthenticated public GraphQL lookup; supplementary data, not an official API contract.
export async function fetchLeetcodeProfile(username, { client = axios } = {}) {
  if (!username) return { status: 'none', evidence: '' };
  if (typeof username !== 'string' || !/^[A-Za-z0-9._-]{1,120}$/.test(username)) return { status: 'unavailable', evidence: '' };
  try {
    assertRequestBudget();
    const { data } = await client.post('https://leetcode.com/graphql/', {
      query: 'query ProfileLanguages($username: String!) { matchedUser(username: $username) { languageProblemCount { languageName problemsSolved } } }',
      variables: { username },
    }, { timeout: requestTimeout(10000), signal: requestSignal(), maxContentLength: 100000, headers: { 'Content-Type': 'application/json' } });
    assertRequestBudget();
    const profile = data?.data?.matchedUser;
    if (!profile) return { status: data?.errors ? 'unavailable' : 'not_found', evidence: '' };
    if (data?.errors?.length || !Array.isArray(profile.languageProblemCount)) return { status: 'unavailable', evidence: '' };
    const evidence = profile.languageProblemCount
      .filter((item) => item && Number.isSafeInteger(item.problemsSolved) && item.problemsSolved > 0 && typeof item.languageName === 'string' && /^[A-Za-z][A-Za-z0-9 +#./_-]{0,49}$/.test(item.languageName))
      .slice(0, 20)
      .map((item) => `Solved ${item.problemsSolved} LeetCode problems using ${item.languageName}.`)
      .join('\n');
    return { status: 'ok', evidence };
  } catch {
    // A source outage is optional; exhaustion of the whole analysis deadline is not.
    assertRequestBudget();
    return { status: 'unavailable', evidence: '' };
  }
}
