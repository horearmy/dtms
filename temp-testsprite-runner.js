const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_KEY = 'sk-member-dTz2l4lPLo8tAPzwXVUSlGo9lsXGhIsyGOmQVWsCFeE';
const MCP_INDEX = 'C:\\Users\\st4th\\AppData\\Local\\npm-cache\\_npx\\8ddf6bea01b2519d\\node_modules\\@testsprite\\testsprite-mcp\\dist\\index.js';
const PROJECT = 'C:\\Users\\st4th\\Documents\\DTMS';
const LOG_FILE = path.join(PROJECT, 'testsprite_tests', 'tmp', 'mcp.log');
let msgId = 0;

const server = spawn('npx', ['@testsprite/testsprite-mcp@latest'], {
  env: { ...process.env, API_KEY },
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let buffer = '';
let resolveWaiting = null;

server.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id && resolveWaiting) {
        resolveWaiting(msg);
        resolveWaiting = null;
      }
    } catch(e) {}
  }
});

server.stderr.on('data', (d) => {
  const s = d.toString().trim();
  if (s && !s.includes('DeprecationWarning')) console.error('[STDERR]', s);
});

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => { resolveWaiting = null; reject(new Error('Timeout')); }, 300000);
    resolveWaiting = (msg) => { clearTimeout(timer); resolve(msg); };
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForCompletion(cli, timeoutMs = 2400000) {
  return new Promise((resolve) => {
    let resolved = false;
    const startTime = Date.now();

    // Watch the log file for completion
    const logSize = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;
    let watcher;
    try {
      watcher = fs.watch(LOG_FILE, () => {
        if (resolved) return;
        try {
          const content = fs.readFileSync(LOG_FILE, 'utf-8');
          if (content.includes('Test execution completed')) {
            console.log('\n[DETECTED] Test execution completed in log file!');
            resolved = true;
            watcher?.close();
            // Wait 3 seconds for tunnel cleanup, then kill
            setTimeout(() => {
              try { cli.kill('SIGTERM'); } catch(e) {}
              resolve('completed');
            }, 3000);
          }
        } catch(e) {}
      });
    } catch(e) {
      // If watch fails, fall back to polling
    }

    // Timeout fallback
    const timer = setTimeout(() => {
      if (!resolved) {
        console.log('\n[TIMEOUT] Reached max wait time, killing process');
        resolved = true;
        watcher?.close();
        try { cli.kill('SIGTERM'); } catch(e) {}
        resolve('timeout');
      }
    }, timeoutMs);

    cli.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        watcher?.close();
        clearTimeout(timer);
        resolve({ code });
      }
    });

    cli.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        watcher?.close();
        clearTimeout(timer);
        resolve({ error: err.message });
      }
    });
  });
}

async function main() {
  console.log('Starting MCP server...');
  await sleep(4000);

  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'dtms-client', version: '1.0.0' }
  });
  console.log('Server:', init.result?.serverInfo?.name, init.result?.serverInfo?.version);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  await sleep(1000);

  // Call MCP tool to populate config.executionArgs
  console.log('\n=== Calling MCP generate_code_and_execute to populate config ===');
  const exec = await send('tools/call', {
    name: 'testsprite_generate_code_and_execute',
    arguments: {
      projectName: 'dtms',
      projectPath: PROJECT,
      testIds: [],
      serverMode: 'production',
      additionalInstruction: 'Login instructions (CRITICAL): The Perusahaan field is an AUTOCOMPLETE SEARCH (not a dropdown) because there are 10000+ tenants. For tenant login: TYPE "PT Logistik Nusantara" (the company NAME, NOT the UUID), wait for suggestions, then CLICK the suggestion. Then enter username: logistik_admin, password: Admin1234. For superadmin login: CHECK the "Login sebagai Super Admin" checkbox first, then enter username: superadmin, password: Admin1234 (no company needed). Never type UUIDs in the Perusahaan field. Never call login API directly.'
    }
  });

  const text = exec.result?.content?.[0]?.text || '';
  console.log('MCP response length:', text.length);

  // Kill MCP server
  server.kill();
  await sleep(1000);

  // Now run the CLI directly
  console.log('\n=== Running CLI (generateCodeAndExecute) ===');
  console.log('Tunnel will connect your localhost:3000 to TestSprite cloud...');
  console.log('Will auto-kill after "Test execution completed" appears in log (~13 min).\n');

  const cli = spawn('node', [MCP_INDEX, 'generateCodeAndExecute'], {
    env: { ...process.env, API_KEY },
    stdio: ['inherit'],
    shell: false,
    cwd: PROJECT
  });

  const result = await waitForCompletion(cli, 2400000);
  console.log('\nExit result:', result);

  // Check results
  const tcFiles = fs.readdirSync(path.join(PROJECT, 'testsprite_tests')).filter(f => f.startsWith('TC'));
  console.log('Generated test files:', tcFiles.length);

  const rawReport = path.join(PROJECT, 'testsprite_tests', 'tmp', 'raw_report.md');
  if (fs.existsSync(rawReport)) {
    const content = fs.readFileSync(rawReport, 'utf-8');
    const passed = (content.match(/✅ Passed/g) || []).length;
    const failed = (content.match(/❌ Failed/g) || []).length;
    const blocked = (content.match(/BLOCKED/g) || []).length;
    console.log(`\nResults: ${passed} passed, ${failed} failed, ${blocked} blocked`);
  }

  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); server.kill(); process.exit(1); });
