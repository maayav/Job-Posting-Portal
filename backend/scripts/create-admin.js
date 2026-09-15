import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.js';

// Explicit CLI admin provisioning (never run automatically, never part of the API).
//
// Promote an existing account:
//   node scripts/create-admin.js admin@example.com
//
// Create a new admin (password supplied via env so it never lands in shell history or logs):
//   ADMIN_PASSWORD='...' node scripts/create-admin.js admin@example.com --name "Placement Admin"
//
// The password is hashed by the existing User model bcrypt pre-save hook and is
// never printed. Public registration remains student-only.

function parseArgs(argv) {
  const positional = [];
  let name = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--name') {
      name = argv[i + 1] ?? null;
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  return { email: positional[0], name };
}

async function main() {
  const { email, name } = parseArgs(process.argv.slice(2));

  if (!email) {
    console.error('Usage: node scripts/create-admin.js <email> [--name "Full Name"]');
    console.error('For a new account, also set ADMIN_PASSWORD in the environment.');
    process.exit(1);
  }

  await connectDB({ retry: false });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`No change: ${existing.email} is already an admin.`);
    } else {
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted ${existing.email} to admin.`);
    }
    await disconnectDB();
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 6) {
    console.error('Account does not exist. Set ADMIN_PASSWORD (min 6 chars) to create it:');
    console.error('  ADMIN_PASSWORD=\'...\' node scripts/create-admin.js <email> [--name "Full Name"]');
    await disconnectDB();
    process.exit(1);
  }

  const user = await User.create({
    name: name ?? 'Placement Admin',
    email,
    password,
    role: 'admin',
  });

  console.log(`Created admin account: ${user.email} (password hashed with bcrypt; not displayed).`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('create-admin failed:', err.message);
  await disconnectDB();
  process.exit(1);
});