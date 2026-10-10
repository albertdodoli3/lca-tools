export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.DISABLE_SCHEDULER === '1') return;
  const { runJobs } = await import('./lib/jobs');
  const tick = () => runJobs().catch((e) => console.error('[jobs]', e));
  setTimeout(tick, 30_000);
  setInterval(tick, 15 * 60_000);
}
