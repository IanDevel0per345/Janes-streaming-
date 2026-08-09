import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

const getDefaultDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'file:/app/data/janes-streaming.db';
  }
  return 'file:janes-streaming.db';
};

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url:  process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || getDefaultDbPath(),
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  },
});
