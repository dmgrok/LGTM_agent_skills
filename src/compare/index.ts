import type { CompareOptions, CompareResult, SessionMetrics } from './types.js';
import { isClaudeAvailable, runBaseline, runOptimized } from './runner.js';
import { parseSession, findMostRecentSession } from './session-parser.js';
import { estimateSavings } from './estimator.js';
import { cacheHitRate } from './pricing.js';

export async function compareCommand(options: CompareOptions): Promise<number> {
  if (options.session) {
    return sessionAnalysisMode(options.session);
  }

  const claudeAvailable = await isClaudeAvailable();
  if (!claudeAvailable) {
    console.log('\n  Claude CLI not found. Falling back to session analysis.\n');
    const uuid = await findMostRecentSession(options.projectPath);
    if (!uuid) {
      console.error(
        '  No sessions found in ~/.claude/projects/. Run a Claude Code session first,\n' +
          '  or install claude CLI to use live comparison.\n',
      );
      return 1;
    }
    console.log(`  Using most recent session: ${uuid}\n`);
    return sessionAnalysisMode(uuid);
  }

  return liveCompareMode(options);
}

async function liveCompareMode(options: CompareOptions): Promise<number> {
  const prompt = options.prompt;

  console.log('\n  CC-Tricks Compare — Token Efficiency Benchmark');
  console.log('  ' + '─'.repeat(50));
  if (prompt) {
    console.log(`\n  Task: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`);
  }

  process.stdout.write('\n  Running baseline (no config)…');
  let baseline: SessionMetrics;
  try {
    baseline = await runBaseline(prompt);
    process.stdout.write(' done\n');
  } catch (err) {
    process.stdout.write(' failed\n');
    console.error(`  Error: ${(err as Error).message}`);
    return 1;
  }

  process.stdout.write('  Running optimized (with .claude/ config)…');
  let optimized: SessionMetrics;
  try {
    optimized = await runOptimized(prompt);
    process.stdout.write(' done\n');
  } catch (err) {
    process.stdout.write(' failed\n');
    console.error(`  Error: ${(err as Error).message}`);
    return 1;
  }

  const result = buildCompareResult(baseline, optimized);
  printLiveTable(result);
  return 0;
}

async function sessionAnalysisMode(sessionId: string): Promise<number> {
  console.log('\n  CC-Tricks Compare — Session Analysis');
  console.log('  ' + '─'.repeat(50));
  console.log(`\n  Session: ${sessionId}`);

  let metrics: SessionMetrics;
  try {
    metrics = await parseSession(sessionId);
  } catch (err) {
    console.error(`\n  Error: ${(err as Error).message}`);
    return 1;
  }

  const estimation = estimateSavings(metrics);
  printEstimationTable(estimation.actual, estimation.estimated, estimation.savings, estimation.assumptions);
  return 0;
}

function buildCompareResult(baseline: SessionMetrics, optimized: SessionMetrics): CompareResult {
  const inputDelta = optimized.totalUsage.input_tokens - baseline.totalUsage.input_tokens;
  const outputDelta = optimized.totalUsage.output_tokens - baseline.totalUsage.output_tokens;
  const costDelta = optimized.costUsd - baseline.costUsd;
  const bHit = cacheHitRate(baseline.totalUsage);
  const oHit = cacheHitRate(optimized.totalUsage);

  const durationDeltaPct =
    baseline.durationMs && optimized.durationMs
      ? ((optimized.durationMs - baseline.durationMs) / baseline.durationMs) * 100
      : undefined;

  return {
    baseline,
    optimized,
    savings: {
      inputTokensDelta: inputDelta,
      inputTokensDeltaPct:
        baseline.totalUsage.input_tokens > 0
          ? (inputDelta / baseline.totalUsage.input_tokens) * 100
          : 0,
      outputTokensDelta: outputDelta,
      outputTokensDeltaPct:
        baseline.totalUsage.output_tokens > 0
          ? (outputDelta / baseline.totalUsage.output_tokens) * 100
          : 0,
      costDelta,
      costDeltaPct: baseline.costUsd > 0 ? (costDelta / baseline.costUsd) * 100 : 0,
      cacheHitRateBaseline: bHit,
      cacheHitRateOptimized: oHit,
      durationDeltaPct,
    },
  };
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtPct(n: number, invert = false): string {
  const v = invert ? -n : n;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}%`;
}

function fmtCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function row(label: string, a: string, b: string, delta: string): void {
  const L = 22, C = 16;
  console.log(
    `  ${label.padEnd(L)}${a.padStart(C)}${b.padStart(C)}${delta.padStart(C)}`,
  );
}

function printLiveTable(r: CompareResult): void {
  const sep = '  ' + '─'.repeat(70);
  const { baseline: b, optimized: o, savings: s } = r;

  console.log('\n');
  row('', 'Baseline', 'Optimized', 'Delta');
  console.log(sep);
  row('Model', b.model, o.model, '');
  row('Turns', String(b.turns), String(o.turns), String(o.turns - b.turns));
  row(
    'Input tokens',
    fmt(b.totalUsage.input_tokens),
    fmt(o.totalUsage.input_tokens),
    fmtPct(s.inputTokensDeltaPct),
  );
  row(
    'Output tokens',
    fmt(b.totalUsage.output_tokens),
    fmt(o.totalUsage.output_tokens),
    fmtPct(s.outputTokensDeltaPct),
  );
  row(
    'Cache hit rate',
    `${(s.cacheHitRateBaseline * 100).toFixed(1)}%`,
    `${(s.cacheHitRateOptimized * 100).toFixed(1)}%`,
    fmtPct((s.cacheHitRateOptimized - s.cacheHitRateBaseline) * 100),
  );
  if (b.durationMs !== undefined && o.durationMs !== undefined) {
    row(
      'Duration',
      `${(b.durationMs / 1000).toFixed(1)}s`,
      `${(o.durationMs / 1000).toFixed(1)}s`,
      s.durationDeltaPct !== undefined ? fmtPct(s.durationDeltaPct) : '',
    );
  }
  console.log(sep);
  row('Cost', fmtCost(b.costUsd), fmtCost(o.costUsd), fmtPct(s.costDeltaPct));
  console.log(sep);

  const saved = -s.costDelta;
  const direction = saved >= 0 ? '↓' : '↑';
  console.log(
    `\n  ${direction} ${Math.abs(s.costDeltaPct).toFixed(1)}% cost ${saved >= 0 ? 'reduction' : 'increase'} (${fmtCost(Math.abs(saved))} per session)\n`,
  );
}

function printEstimationTable(
  actual: SessionMetrics,
  estimated: SessionMetrics,
  savings: { totalInputDelta: number; totalInputDeltaPct: number; costDelta: number; costDeltaPct: number },
  assumptions: string[],
): void {
  const sep = '  ' + '─'.repeat(70);

  console.log(`\n  Model: ${actual.model}  |  Turns: ${actual.turns}\n`);

  row('', 'Actual', 'Estimated', 'Delta');
  console.log(sep);
  row(
    'Input tokens',
    fmt(actual.totalUsage.input_tokens),
    fmt(estimated.totalUsage.input_tokens),
    fmtPct(
      actual.totalUsage.input_tokens > 0
        ? ((estimated.totalUsage.input_tokens - actual.totalUsage.input_tokens) /
            actual.totalUsage.input_tokens) *
            100
        : 0,
    ),
  );
  row(
    'Cache creates',
    fmt(actual.totalUsage.cache_creation_input_tokens),
    fmt(estimated.totalUsage.cache_creation_input_tokens),
    '',
  );
  row(
    'Cache reads',
    fmt(actual.totalUsage.cache_read_input_tokens),
    fmt(estimated.totalUsage.cache_read_input_tokens),
    '',
  );
  row(
    'Output tokens',
    fmt(actual.totalUsage.output_tokens),
    fmt(estimated.totalUsage.output_tokens),
    '—',
  );
  console.log(sep);
  row(
    'Cost',
    fmtCost(actual.costUsd),
    fmtCost(estimated.costUsd),
    fmtPct(savings.costDeltaPct, true),
  );
  console.log(sep);

  console.log(`\n  Estimated savings with token-optimizer: ${fmtCost(savings.costDelta)} (${savings.costDeltaPct.toFixed(1)}%)\n`);
  console.log('  Assumptions:');
  for (const a of assumptions) {
    console.log(`    • ${a}`);
  }
  console.log('\n  Install: cc-tricks preset install token-optimizer\n');
}

export { estimateSavings, parseSession };
export type { CompareOptions, CompareResult };
