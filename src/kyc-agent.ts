import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  formatReport,
  runKycAssessment,
  runReviewerQaTurn,
  type KycReport,
  type ReviewerExchange,
} from './kycEngine.js';

const apiKey = process.env.LITELLM_API_KEY ?? process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error(
    'Set LITELLM_API_KEY or OPENAI_API_KEY in the environment (see .env.example).',
  );
  process.exit(1);
}

async function readStdinAll(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function resolveApplicantPayload(): Promise<string> {
  const argv = process.argv.slice(2).join(' ').trim();
  if (argv) {
    return argv;
  }
  if (!process.stdin.isTTY) {
    return readStdinAll();
  }
  const rl = readline.createInterface({ input, output });
  try {
    console.log(
      'Paste applicant details in one block (single line is fine), then Enter:\n' +
        'Example: Name: Vikram Sarabhai, DOB: 1890-01-01, Address: 123 Main St, City: Chennai, State: Tamil Nadu, Pin: 600017, Country: India\n',
    );
    const line = (await rl.question('> ')).trim();
    return line;
  } finally {
    rl.close();
  }
}

async function optionalReviewerLoop(payload: string, report: KycReport) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;
  const rl = readline.createInterface({ input, output });
  const prior: ReviewerExchange[] = [];
  try {
    console.log(
      '\n--- Optional reviewer follow-up (blank line to finish) ---\n',
    );
    while (true) {
      const q = (await rl.question('Reviewer: ')).trim();
      if (!q) break;
      const ans = await runReviewerQaTurn(payload, report, prior, q);
      prior.push({ role: 'reviewer', text: q });
      prior.push({ role: 'analyst', text: ans });
      console.log('\nAnalyst:\n', ans);
      console.log('');
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const payload = await resolveApplicantPayload();
  if (!payload) {
    console.error('No applicant payload. Pass as args or stdin.');
    process.exit(1);
  }

  const report = await runKycAssessment(payload);

  console.log(formatReport(report));
  console.log('\n--- Machine-readable JSON ---\n');
  console.log(JSON.stringify(report, null, 2));

  await optionalReviewerLoop(payload, report);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
