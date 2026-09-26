import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/user.js';

// Usage:
//   node scripts/release-session.js <email>
//
// Clears the account's single active session so the user can sign in again.
// Set MONGO_URI in the shell to target a remote database.

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/release-session.js <email>');
    process.exit(1);
  }

  await connectDB({ retry: false });

  const user = await User.findOne({ email: email.toLowerCase() }).select('+activeSessionId');
  if (!user) {
    console.error(`No account found for ${email}`);
    await disconnectDB();
    process.exit(1);
  }

  if (!user.activeSessionId) {
    console.log(`${user.email} has no active session.`);
    await disconnectDB();
    return;
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { activeSessionId: null, sessionExpiresAt: null } }
  );
  console.log(`Released the active session for ${user.email}.`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error('release-session failed:', err.message);
  await disconnectDB();
  process.exit(1);
});
