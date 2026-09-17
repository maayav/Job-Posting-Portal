import axios from 'axios';

// Public profile data only; fixed destination, bounded request size and time.
export async function fetchLeetcodeProfile(username) {
  if (!username) return { status: 'none', evidence: '' };
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(username)) return { status: 'unavailable', evidence: '' };
  try {
    const { data } = await axios.post('https://leetcode.com/graphql/', {
      query: 'query ProfileLanguages($username: String!) { matchedUser(username: $username) { languageProblemCount { languageName problemsSolved } } }',
      variables: { username },
    }, { timeout: 10000, maxContentLength: 100000, headers: { 'Content-Type': 'application/json' } });
    const profile = data?.data?.matchedUser;
    if (!profile) return { status: data?.errors ? 'unavailable' : 'not_found', evidence: '' };
    const evidence = (profile.languageProblemCount || []).filter((item) => item.problemsSolved > 0).slice(0,20).map((item) => `Solved ${item.problemsSolved} LeetCode problems using ${String(item.languageName).slice(0,50)}.`).join('\n');
    return { status: 'ok', evidence };
  } catch { return { status: 'unavailable', evidence: '' }; }
}
