import { execSync } from 'node:child_process';

/*// Applies migrations to the throwaway test database once per run, so the schema
// always matches prisma/schema.prisma without anyone remembering to migrate.
export default function globalSetup() {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
*/

// Jest runs globalSetup once, before any suite loads and before Prisma opens a
// connection. It is the only place that can stop a run already pointed somewhere
// it must never touch - and this suite TRUNCATEs every table before each test.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertDisposableDatabase(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) {
    throw new Error(
      'DATABASE_URL is not set. Start the e2e suite with `npm run test:e2e`, which ' +
        'points it at the local throwaway database.',
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL is not a parseable URL.');
  }

  // IPv6 hosts arrive bracketed from the URL parser
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  // Never put rawUrl in a message - it carries the password.
  const where = `${host}:${url.port || '5432'}/${database}`;

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the e2e suite against a non-local database.\n` +
        `  target: ${where}\n` +
        `These tests TRUNCATE every table before each test. Use \`npm run test:e2e\`.`,
    );
  }

  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run the e2e suite against a database whose name does not end in "_test".\n` +
        `  target: ${where}`,
    );
  }

  return { host, port: url.port || '5432', database };
}

// Applies migrations to the throwaway test database once per run, so the schema
// always matches prisma/schema.prisma without anyone remembering to migrate.
export default function globalSetup() {
  const { host, port, database } = assertDisposableDatabase();
  console.log(`\ne2e: target database ${host}:${port}/${database}`);
  
  try{
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
  } catch{
    // Almost always the container simply is not running. Prisma's own output
    // says so, but buried in a connection trace - say it plainly instead.
    throw new Error(
      `Could not apply migrations to ${host}:${port}/${database}.\n` +
        `Is the test database running? Start it with \`npm run test:e2e:up\`.`,
    );
  }
}
