import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sample-resumes');
const MARGIN = 50;

function buildResume({ file, name, role, sections }) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  doc.fontSize(18).text(name, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#333').text(role, { align: 'center' });
  doc.moveDown(1);

  for (const { heading, lines } of sections) {
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor('#111').text(heading);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#444');
    for (const line of lines) {
      doc.text(`- ${line}`);
    }
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

const resumes = [
  {
    name: 'Aarav Mehta',
    role: 'Software Development Engineer',
    file: 'sample-sde.pdf',
    sections: [
      {
        heading: 'Summary',
        lines: [
          'Software engineer with 2 years of experience building React-based dashboards and Node.js REST APIs.',
          'Comfortable with MongoDB schema design and AWS deployment.',
        ],
      },
      {
        heading: 'Skills',
        lines: [
          'React, JavaScript, Node.js, Express, MongoDB, Docker, AWS, Git, HTML, CSS',
        ],
      },
      {
        heading: 'Experience',
        lines: [
          'Placement dashboard using React, Redux and Recharts — 3,000 daily users.',
          'Built a REST API with Node.js, Express and MongoDB, deployed on AWS EC2.',
        ],
      },
      {
        heading: 'Education',
        lines: ['B.Tech Computer Science, 2024'],
      },
    ],
  },
  {
    name: 'Diya Sharma',
    role: 'ML Engineer',
    file: 'sample-ml.pdf',
    sections: [
      {
        heading: 'Summary',
        lines: [
          'Machine learning engineer focused on NLP and computer vision.',
          'Hands-on with PyTorch, scikit-learn and model deployment via FastAPI.',
        ],
      },
      {
        heading: 'Skills',
        lines: [
          'Python, PyTorch, TensorFlow, scikit-learn, Pandas, NumPy, SQL, FastAPI, Git',
        ],
      },
      {
        heading: 'Projects',
        lines: [
          'Fine-tuned a transformer model for sentiment analysis (F1 0.91) with PyTorch.',
          'Built an object-detection pipeline using YOLO and OpenCV.',
        ],
      },
      {
        heading: 'Education',
        lines: ['B.Tech Artificial Intelligence, 2023'],
      },
    ],
  },
  {
    name: 'Rohan Gupta',
    role: 'Software Development Engineer',
    file: 'sample-messy.pdf',
    sections: [
      {
        heading: 'Summary',
        lines: [
          'Builder of small tools. Knows some programming. Used a laptop.',
        ],
      },
      {
        heading: 'Projects',
        lines: [
          'Made a website once. It had buttons.',
          'Wrote scripts to rename files.',
          'Helped install a printer at the lab.',
        ],
      },
      {
        heading: 'Education',
        lines: ['B.E. Electrical, 2022'],
      },
    ],
  },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const r of resumes) {
  await buildResume({ file: path.join(OUT_DIR, r.file), name: r.name, role: r.role, sections: r.sections });
  console.log(`generated ${r.file}`);
}