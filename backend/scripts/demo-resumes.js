import PDFDocument from 'pdfkit';

export function demoResumeContent(student, job, skills) {
  const projects = skills.map((name) => `Built and tested a ${name} example for a ${job.title} training project.`);
  return {
    heading: `${student.name} - ${job.title}`,
    contact: student.email,
    summary: `Fictional student portfolio for a ${job.title} application. This document is generated demo data, not a real person's credentials.`,
    skills: skills.join(', '),
    projects,
    education: 'Example Institute - Computer Science training, 2026 (demo)',
    practice: 'Documented setup steps, evaluated a small sample, and recorded limitations. Training work only; no employment or production claims.',
  };
}

export async function createDemoResumePdf(student, job, skills) {
  const content = demoResumeContent(student, job, skills);
  const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: content.heading, Author: 'Vortex demo seed' } });
  const chunks = [];
  const done = new Promise((resolve, reject) => { doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  doc.fontSize(9).fillColor('#555555').text('VORTEX / FICTIONAL DEMO RESUME');
  doc.moveDown().fontSize(20).fillColor('#111111').text(student.name);
  doc.fontSize(12).text(job.title).moveDown(.5).fontSize(10).text(content.contact).moveDown();
  for (const [title, text] of [['Summary', content.summary], ['Skills', content.skills], ['Projects', content.projects.join('\n\n')], ['Education', content.education], ['Training notes', content.practice]]) {
    doc.fontSize(12).font('Helvetica-Bold').text(title).moveDown(.35);
    doc.fontSize(10).font('Helvetica').text(text, { lineGap: 3 }).moveDown();
  }
  doc.end();
  return done;
}
