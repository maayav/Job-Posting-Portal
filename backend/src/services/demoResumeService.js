// Dependency-free PDF rendering for generated demo resumes. The demo seed uses
// pdfkit for nicer output, but serverless production does not install dev
// dependencies, so this path must stay plain Node.
const MAX_LINE_LENGTH = 92;
const MAX_LINES = 44;
const LINE_HEIGHT = 17;
const FIRST_LINE_Y = 770;
const LEFT_MARGIN = 54;

function escapePdfText(value) {
  return String(value)
    .replace(/[\\()]/g, (match) => `\\${match}`)
    .replace(/[^\x20-\x7E]/g, ' ');
}

function wrapLine(value) {
  const text = String(value ?? '').trimEnd();
  if (!text) return [''];
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= MAX_LINE_LENGTH) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildDemoResumePdf(resumeText) {
  const text = String(resumeText ?? '').trim();
  if (!text) return null;
  const lines = [];
  for (const raw of text.split(/\r?\n/)) lines.push(...wrapLine(raw));
  if (!lines.length) return null;

  const content = lines.slice(0, MAX_LINES)
    .map((line, index) => `BT /F1 11 Tf ${LEFT_MARGIN} ${FIRST_LINE_Y - index * LINE_HEIGHT} Td (${escapePdfText(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj',
    `4 0 obj<</Length ${Buffer.byteLength(content)}>>stream\n${content}\nendstream\nendobj`,
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(document));
    document += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(document);
  const xref = ['0000000000 65535 f ', ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)];
  document += `xref\n0 ${objects.length + 1}\n${xref.join('\n')}\ntrailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

// Only seed-generated records are allowed to self-heal. Real users must never
// receive a fabricated resume for a missing file.
export function isDemoSubmission(submission) {
  if (!submission) return false;
  if (submission.demo_key) return true;
  if (typeof submission.resume_file_ref === 'string' && submission.resume_file_ref.startsWith('demo-review/')) return true;
  // Contact emails can be supplied by applicants and are not proof of a seed.
  return false;
}
