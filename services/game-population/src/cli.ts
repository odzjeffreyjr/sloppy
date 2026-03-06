#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brainstormConcepts, type GameConcept } from './brainstorm-agent.js';
import { runBatch } from './batch-runner.js';
import { runQualityFilter } from './quality-filter.js';
import { createLogger } from './logger.js';
import { ALL_2D_GENRES, ALL_3D_GENRES, type GameGenre } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const LOGS_DIR = path.join(ROOT, 'logs');
const RESUME_FILE = path.join(ROOT, '.resume-state.json');

function loadJsonConfig<T>(filename: string): T {
  const filePath = path.join(CONFIG_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function resolveGenres(genresArg: string): GameGenre[] | undefined {
  if (!genresArg || genresArg === 'all') return undefined;
  if (genresArg === '2d') return ALL_2D_GENRES;
  if (genresArg === '3d') return ALL_3D_GENRES;
  return genresArg.split(',').map((g) => g.trim() as GameGenre);
}

function resolveAuthToken(): string {
  const token = process.env.POPULATION_AUTH_TOKEN || process.env.FIREBASE_ID_TOKEN;
  if (!token) {
    console.error(
      chalk.red('Error: No auth token found.\n') +
        'Set POPULATION_AUTH_TOKEN or FIREBASE_ID_TOKEN environment variable.\n' +
        'You can obtain a Firebase ID token from the browser devtools (Application → IndexedDB → firebaseLocalStorageDb).',
    );
    process.exit(1);
  }
  return token;
}

function resolveLLMConfig(): { apiKey: string; model: string; provider: 'openai' | 'anthropic' } {
  const provider = (process.env.LLM_PROVIDER || 'openai') as 'openai' | 'anthropic';

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error(chalk.red('Error: ANTHROPIC_API_KEY not set'));
      process.exit(1);
    }
    return { apiKey, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514', provider };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('Error: OPENAI_API_KEY not set'));
    process.exit(1);
  }
  return { apiKey, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', provider };
}

const program = new Command();

program
  .name('game-population')
  .description('Brainstorm and mass-generate games for the Sloppy platform')
  .version('0.0.0');

program
  .command('populate', { isDefault: true })
  .description('Generate games through the full pipeline')
  .requiredOption('--count <number>', 'Number of games to generate', parseInt)
  .option('--genres <genres>', 'Genre filter: "all", "2d", "3d", or comma-separated genre tags', 'all')
  .option('--delay-ms <ms>', 'Delay between submissions in ms', parseInt, 20000)
  .option('--api-url <url>', 'API base URL', 'http://localhost:3001')
  .option('--dry-run', 'Generate concepts only, print to stdout', false)
  .option('--resume', 'Skip already-generated games from a previous run', false)
  .option('--max-concurrent <n>', 'Max parallel generations', parseInt, 2)
  .option('--skip-quality', 'Skip quality filter step', false)
  .action(async (opts) => {
    const {
      count,
      genres: genresArg,
      delayMs,
      apiUrl,
      dryRun,
      resume,
      maxConcurrent,
      skipQuality,
    } = opts;

    console.log(chalk.bold.cyan('\n🎮 Sloppy Game Population Tool\n'));
    console.log(chalk.gray(`  Count:          ${count}`));
    console.log(chalk.gray(`  Genres:         ${genresArg}`));
    console.log(chalk.gray(`  Delay:          ${delayMs}ms`));
    console.log(chalk.gray(`  API URL:        ${apiUrl}`));
    console.log(chalk.gray(`  Max concurrent: ${maxConcurrent}`));
    console.log(chalk.gray(`  Dry run:        ${dryRun}`));
    console.log(chalk.gray(`  Resume:         ${resume}`));
    console.log();

    const log = createLogger(LOGS_DIR);
    const llmConfig = resolveLLMConfig();
    const genreFilter = resolveGenres(genresArg);

    // Load config files before starting the spinner so any
    // console warnings don't interleave with spinner output.
    let genreWeights: Record<string, number> = {};
    try {
      genreWeights = loadJsonConfig<Record<string, number>>('genre-weights.json');
      if (genreFilter) {
        const filtered: Record<string, number> = {};
        for (const genre of genreFilter) {
          if (genre in genreWeights) filtered[genre] = genreWeights[genre];
        }
        genreWeights = filtered;
      }
    } catch {
      console.warn(chalk.yellow('  Could not load genre-weights.json — using uniform distribution'));
    }

    let seedConcepts: GameConcept[] = [];
    try {
      seedConcepts = loadJsonConfig<GameConcept[]>('seed-concepts.json');
    } catch {
      console.warn(chalk.yellow('  Could not load seed-concepts.json — starting without seeds'));
    }

    // --- Step 1: Brainstorm concepts ---
    const spinner = ora('Brainstorming game concepts...').start();

    let concepts: GameConcept[];
    try {
      concepts = await brainstormConcepts({
        count,
        genreFilter,
        genreWeights,
        previousConcepts: seedConcepts,
        apiKey: llmConfig.apiKey,
        model: llmConfig.model,
        provider: llmConfig.provider,
      });
      spinner.succeed(`Brainstormed ${concepts.length} game concepts`);
    } catch (err) {
      spinner.fail('Failed to brainstorm concepts');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    // Log all concepts
    for (const c of concepts) {
      log.info(`Concept: "${c.title}" [${c.genre}/${c.engine}] — ${c.tagline}`);
    }

    // --- Dry run: just print ---
    if (dryRun) {
      console.log(chalk.bold('\nGenerated Concepts:\n'));
      for (const c of concepts) {
        console.log(chalk.green(`  ${c.title}`) + chalk.gray(` [${c.genre}/${c.engine}]`));
        console.log(chalk.gray(`    ${c.tagline}`));
        console.log(chalk.gray(`    Mechanic: ${c.coreMechanic}`));
        console.log(chalk.gray(`    Twist: ${c.uniqueTwist}`));
        console.log(chalk.gray(`    Style: ${c.visualStyle}`));
        console.log(chalk.gray(`    Complexity: ${c.estimatedComplexity}`));
        console.log();
      }

      // Print genre distribution
      const genreCounts = new Map<string, number>();
      for (const c of concepts) {
        genreCounts.set(c.genre, (genreCounts.get(c.genre) ?? 0) + 1);
      }
      console.log(chalk.bold('Genre Distribution:'));
      for (const [genre, gCount] of [...genreCounts.entries()].sort((a, b) => b[1] - a[1])) {
        const bar = '█'.repeat(gCount);
        console.log(chalk.cyan(`  ${genre.padEnd(20)} ${bar} ${gCount}`));
      }
      console.log();
      return;
    }

    // --- Step 2: Submit through pipeline ---
    const authToken = resolveAuthToken();

    console.log(chalk.bold(`\nSubmitting ${concepts.length} games to pipeline...\n`));

    const results = await runBatch(concepts, {
      apiUrl,
      authToken,
      delayMs,
      maxConcurrent,
      resumeFile: resume ? RESUME_FILE : undefined,
      logger: log,
    });

    // --- Step 3: Quality filter ---
    const successfulGames = results
      .filter((r) => r.status === 'success' && r.gameId)
      .map((r) => ({ gameId: r.gameId!, title: r.concept.title }));

    if (successfulGames.length > 0 && !skipQuality) {
      console.log(chalk.bold(`\nRunning quality filter on ${successfulGames.length} games...\n`));
      const qualityResults = await runQualityFilter(successfulGames, {
        apiUrl,
        authToken,
        logger: log,
      });

      const published = qualityResults.filter((r) => r.action === 'publish').length;
      const needsReview = qualityResults.filter((r) => r.action === 'needs_review').length;

      console.log(chalk.green(`  Published: ${published}`));
      console.log(chalk.yellow(`  Needs review: ${needsReview}`));
    }

    // --- Summary ---
    const succeeded = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

    console.log(chalk.bold('\n─── Summary ───\n'));
    console.log(chalk.green(`  Succeeded: ${succeeded}`));
    console.log(chalk.red(`  Failed:    ${failed}`));
    console.log(chalk.gray(`  Skipped:   ${skipped}`));
    console.log(chalk.gray(`  Total:     ${results.length}`));
    console.log(chalk.gray(`  Duration:  ${Math.round(totalDuration / 1000)}s`));
    console.log();

    if (failed > 0) {
      console.log(chalk.yellow('Failed games:'));
      for (const r of results.filter((r) => r.status === 'failed')) {
        console.log(chalk.red(`  "${r.concept.title}": ${r.error}`));
      }
      console.log();
    }

    log.info(`Run complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);
  });

program.parse();
