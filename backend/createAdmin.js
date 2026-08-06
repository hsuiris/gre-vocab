const { createUser } = require('./users');

const [, , email, password, displayName = 'Admin'] = process.argv;
if (!email || !password) {
  console.error('usage: npm run backend:create-admin -- email@example.com password [displayName]');
  process.exit(1);
}

createUser({ email, password, displayName, role: 'admin', allowExisting: true });
console.log(`admin ready: ${email}`);
