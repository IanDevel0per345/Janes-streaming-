import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const getDefaultDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    // On Vercel serverless, /tmp is the writable directory
    if (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL?.startsWith('libsql://')) {
      return process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
    }
    const dbDir = '/tmp';
    try { fs.mkdirSync(dbDir, { recursive: true }); } catch {}
    return `file:${dbDir}/janes-streaming.db`;
  }
  return 'file:janes-streaming.db';
};

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || getDefaultDbPath();
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

console.log('Connecting to database at:', url.includes('@') ? url.split('@').pop() : url.replace(/^file:/, 'file:***'));

// For local file databases, ensure the directory exists
if (url.startsWith('file:')) {
  const dbPath = url.replace('file:', '');
  const dbDir = path.dirname(dbPath);
  try { fs.mkdirSync(dbDir, { recursive: true }); } catch {}
}

const client = createClient({
  url,
  authToken,
});

const db = drizzle(client);

async function wipeLegacyCryptoTokens() {
  try {
    const result = await client.execute(
      "UPDATE Session SET hostAccessToken = NULL, hostDeviceId = NULL WHERE hostAccessToken LIKE 'v1:%'"
    );
    if (result.rowsAffected > 0) {
      console.log(
        `[Security] Wiped ${result.rowsAffected} legacy v1-encrypted guest-lending token(s).`
      );
    }
  } catch (error) {
    console.warn('[Security] Could not wipe legacy tokens (safe to ignore on fresh install):', error.message);
  }
}

async function main() {
  console.log('Running migrations...');
  try {
    const migrationsFolder = path.join(process.cwd(), 'src', 'db', 'migrations');
    console.log('Migrations folder:', migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log('Migrations complete!');
    await wipeLegacyCryptoTokens();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
