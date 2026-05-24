const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'cache');

function startServer(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function unusedPort() {
  const server = http.createServer();
  const port = await startServer(server);
  await stopServer(server);
  return port;
}

function waitForApp(child, expectedLine) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error(`App did not start in time. Output: ${output}`));
    }, 5000);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes(expectedLine)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`App exited before startup with code ${code}. Output: ${output}`));
    });
  });
}

function removeGeneratedFiles(hash) {
  for (const suffix of ['original.png', 'meta.json', 'prank.png']) {
    fs.rmSync(path.join(CACHE_DIR, `${hash}.${suffix}`), { force: true });
  }
}

test('prank poster edits the portrait once and reuses the edited image cache', async (t) => {
  const editedBytes = Buffer.from('edited-prank-image');
  const editRequests = [];
  const imageApi = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      editRequests.push(Buffer.concat(chunks).toString());
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        data: [{ b64_json: editedBytes.toString('base64') }],
      }));
    });
  });
  const apiPort = await startServer(imageApi);

  const appPort = await unusedPort();
  const appEnv = { ...process.env };
  delete appEnv.IMAGE_MODEL;
  const app = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...appEnv,
      PORT: String(appPort),
      OPENAI_API_KEY: 'test-key',
      OPENAI_BASE_URL: `http://127.0.0.1:${apiPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const uploadBytes = Buffer.from(`test-prank-upload-${Date.now()}-${Math.random()}`);
  const hash = crypto.createHash('sha256').update(uploadBytes).digest('hex');
  t.after(async () => {
    app.kill();
    await stopServer(imageApi);
    removeGeneratedFiles(hash);
  });

  await waitForApp(app, `http://localhost:${appPort}`);

  async function generatePoster() {
    const form = new FormData();
    form.append('image', new Blob([uploadBytes], { type: 'image/png' }), 'portrait.png');
    form.append('name', '测试人物');
    form.append('style', 'prank');
    form.append('gender', 'x');
    const response = await fetch(`http://127.0.0.1:${appPort}/api/generate-poster`, {
      method: 'POST',
      body: form,
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  const first = await generatePoster();
  const second = await generatePoster();
  const expectedImage = `data:image/png;base64,${editedBytes.toString('base64')}`;

  assert.equal(first.image, expectedImage);
  assert.equal(first.cached, false);
  assert.equal(second.image, expectedImage);
  assert.equal(second.cached, true);
  assert.equal(editRequests.length, 1);
  assert.match(editRequests[0], /saliva/i);
  assert.match(editRequests[0], /mouth/i);
  assert.match(editRequests[0], /gpt-image-2/);
  assert.ok(fs.existsSync(path.join(CACHE_DIR, `${hash}.prank.png`)));
});

test('poster does not overlay a fixed-position drool sticker', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');

  assert.doesNotMatch(html, /sticker drool/);
  assert.doesNotMatch(css, /\.drool\b/);
});
