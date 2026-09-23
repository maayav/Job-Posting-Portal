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
    // Channel links replaced by specific, verified tutorial videos.
    'https://www.youtube.com/@3blue1brown', 'https://www.youtube.com/@AladdinPersson',
    'https://www.youtube.com/@AlexTheAnalyst', 'https://www.youtube.com/@ArjanCodes',
    'https://www.youtube.com/@ByteByteGo', 'https://www.youtube.com/@HuggingFace',
    'https://www.youtube.com/@IBMTechnology', 'https://www.youtube.com/@KeithGalli',
    'https://www.youtube.com/@MongoDB', 'https://www.youtube.com/@NeetCode',
    'https://www.youtube.com/@NetNinja', 'https://www.youtube.com/@RaghavPal',
    'https://www.youtube.com/@Roboflow', 'https://www.youtube.com/@TechWorldwithNana',
    'https://www.youtube.com/@TensorFlow', 'https://www.youtube.com/@TraversyMedia',
    'https://www.youtube.com/@WebDevSimplified', 'https://www.youtube.com/@amazonwebservices',
    'https://www.youtube.com/@coreyms', 'https://www.youtube.com/@dataschool',
    'https://www.youtube.com/@freecodecamp', 'https://www.youtube.com/@github',
    'https://www.youtube.com/@javascriptmastery', 'https://www.youtube.com/@mattpocockuk',
    'https://www.youtube.com/@statquest',
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
