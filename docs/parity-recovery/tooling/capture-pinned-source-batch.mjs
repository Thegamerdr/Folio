#!/usr/bin/env node

/** Batch-capture pinned Lovable references with one Vite server for the whole wave. */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const DESIGN_ROOT = process.env.MELO_PINNED_DESIGN_ROOT ?? 'C:/dev/melo-design-source-ad90b4';
const PORT = Number.parseInt(process.env.MELO_SOURCE_CAPTURE_PORT ?? '4179', 10);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CAPTURE_SCRIPT = path.join(import.meta.dirname, 'capture-pinned-source.mjs');

function readArg(name, fallback) {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

const manifestPath = path.resolve(ROOT, readArg('manifest', 'docs/parity-recovery/registries/capture-batches.json'));
const concurrency = Math.max(1, Number.parseInt(readArg('concurrency', '3'), 10));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.batches)) {
  throw new Error(`Unsupported capture batch manifest: ${manifestPath}`);
}

const jobs = manifest.batches.flatMap((batch) =>
  batch.surfaces.flatMap((surface) =>
    (surface.themes ?? ['light', 'dark']).map((theme) => ({
      fixture: batch.fixture,
      screen: surface.sourceScreen ?? surface.screen,
      sheet: surface.sourceSheet ?? surface.sheet ?? '',
      surface: surface.id ?? surface.screen,
      theme,
    })),
  ),
);

function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = async () => {
      try {
        const response = await fetch(BASE_URL);
        if (response.ok) return resolve();
      } catch {
        // Vite is still starting.
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${BASE_URL}.`));
        return;
      }
      setTimeout(probe, 150);
    };
    void probe();
  });
}

function runJob(job) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        CAPTURE_SCRIPT,
        `--fixture=${job.fixture}`,
        `--screen=${job.screen}`,
        `--sheet=${job.sheet}`,
        `--surface=${job.surface}`,
        `--theme=${job.theme}`,
      ],
      {
        cwd: ROOT,
        env: { ...process.env, MELO_SOURCE_CAPTURE_REUSE_SERVER: 'true' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        process.stdout.write(`captured ${job.fixture}/${job.theme}/${job.surface}\n`);
        resolve();
      } else {
        reject(new Error(`Capture failed for ${job.fixture}/${job.theme}/${job.surface}\n${output}`));
      }
    });
  });
}

const vite = spawn(
  process.execPath,
  [path.join(DESIGN_ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(PORT)],
  { cwd: DESIGN_ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let viteOutput = '';
vite.stdout.on('data', (chunk) => { viteOutput += chunk.toString(); });
vite.stderr.on('data', (chunk) => { viteOutput += chunk.toString(); });

try {
  await waitForServer();
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      await runJob(job);
    }
  });
  await Promise.all(workers);
  process.stdout.write(`Pinned source batch complete: ${jobs.length} captures.\n`);
} finally {
  vite.kill();
  if (!vite.killed) vite.kill('SIGTERM');
  if (vite.exitCode !== null && vite.exitCode !== 0 && viteOutput.trim() !== '') {
    process.stderr.write(viteOutput);
  }
}
