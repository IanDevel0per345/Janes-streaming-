import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { config } from '@/lib/config';
import path from 'path';

// Initialize variables as null
let client: any = null;
let dbInstance: any = null;
let migrationPromise: Promise<void> | null = null;

async function ensureMigrated() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      // Check if the Config table exists (quick check for migration state)
      const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Config' LIMIT 1");
      if (result.rows.length > 0) {
        // Tables exist, check if migration journal exists too
        const journalResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations' LIMIT 1");
        if (journalResult.rows.length > 0) {
          return; // Already migrated
        }
      }
      
      // Run migrations — DB is empty or missing tables
      console.log('[DB] Tables missing, running auto-migration...');
      const migrationsFolder = path.join(process.cwd(), 'src', 'db', 'migrations');
      await migrate(dbInstance, { migrationsFolder });
      console.log('[DB] Auto-migration complete!');
    } catch (error: any) {
      console.error('[DB] Auto-migration failed:', error?.message || error);
      // Don't throw — let the app try to continue, some queries may still work
    }
  })();

  return migrationPromise;
}

export function getDb() {
  if (dbInstance) return dbInstance;

  // Next.js Middleware/Edge doesn't support local file access
  if (typeof window === 'undefined' && config.db.url?.startsWith('file:')) {
    // Check if we are in the edge runtime (where middleware runs)
    if (process.env.NEXT_RUNTIME === 'edge') {
        throw new Error('Database access with "file:" protocol is not supported in the Edge Runtime/Middleware. Ensure AUTH_SECRET is set in your environment variables.');
    }
  }

  if (!client) {
    if (config.db.url && !config.db.url.startsWith('file:') && !config.db.authToken) {
        console.warn('[DB] DATABASE_URL is remote but DATABASE_AUTH_TOKEN is missing. This may cause 401 errors.');
    }
    client = createClient({
      url: config.db.url,
      authToken: config.db.authToken,
    });
  }

  if (!dbInstance) {
    dbInstance = drizzle(client, { schema });
  }

  return dbInstance;
}

/**
 * Call this before any DB operation to ensure migrations have run.
 * In Vercel serverless, each cold start gets a fresh empty DB, so we
 * need to auto-migrate before the first query.
 */
export async function getDbReady() {
  getDb(); // ensure initialized
  await ensureMigrated();
  return dbInstance;
}

// Keep the export for compatibility, but make it a proxy or getter
export const db = new Proxy({} as any, {
  get(_, prop) {
    return getDb()[prop];
  }
});

export { client };

// Re-export all schema tables and types for convenience
export { sessions, likes, hiddens, sessionMembers, config, userProfiles, sessionEvents, movieSources } from './schema';
export type { Session, NewSession, Like, NewLike, Hidden, NewHidden, SessionMember, NewSessionMember, Config, NewConfig, UserProfile, NewUserProfile, SessionEvent, NewSessionEvent, MovieSource, NewMovieSource } from './schema';
