/**
 * Next.js Instrumentation — runs once per server instance on startup.
 * Used here to auto-migrate the database on Vercel serverless cold starts,
 * where each invocation may get a fresh empty SQLite file.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { getDbReady } = await import('@/db/index');
      await getDbReady();
      console.log('[Instrumentation] DB ready (migrations checked)');
    } catch (error: any) {
      console.error('[Instrumentation] DB init failed:', error?.message || error);
    }
  }
}
