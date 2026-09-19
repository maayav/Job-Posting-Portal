import { connectDB, disconnectDB } from '../src/config/db.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';
import { loadResourceEntries } from './ontology-loader.js';

// Refresh only learning resources; no embedding API calls or report resets.
try {
  await connectDB({ retry: false });
  const entries = loadResourceEntries();
  // Retire only known replaced seed URLs; leave custom catalog additions intact.
  await ResourceCatalog.updateMany({ url: { $in: [
    'https://www.gnu.org/software/bash/manual/bash.html',
    'https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html',
    'https://docs.opencv.org/4.x/d9/df8/tutorial_root.html',
    'https://learnopencv.com/', 'https://leetcode.com/', 'https://realpython.com/',
  ] } }, { $set: { verified: false } });
  await ResourceCatalog.bulkWrite(entries.map((resource) => ({ updateOne: {
    filter: { skill_name: resource.skill_name, url: resource.url },
    update: { $set: resource }, upsert: true,
  } })));
  console.log(`Updated ${entries.length} curated resources covering ${new Set(entries.map((entry) => entry.skill_name)).size} skills.`);
} catch (error) {
  console.error('Resource seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
