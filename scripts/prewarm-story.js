/*
  剧情节点预热脚本：
    遍历 scripts/demos.json 里每个示例的全部 27 条选择路径，调用
    本地正在运行的服务器，借助 /api/story/start + /api/story/next，
    让 server.js 自带的剧情节点缓存把这些路径全部落盘。

  用法：
    1. 先用网页生成一次通缉令，从服务器日志里抄下完整 hash（64 个字符）。
    2. 编辑 scripts/demos.json（参考同目录的 demos.example.json）。
    3. 保持 node server.js 在跑。
    4. node scripts/prewarm-story.js

  说明：
    - 路径深度固定为 3 幕（与 server.js 的 totalScenes 一致），即 3×3×3 = 27 条。
    - 每条路径会发起 1 次 start + 3 次 next，总计 4 次 HTTP 调用。
    - 命中过的节点会被服务器秒回，所以同一示例只在第一次贯穿时才需要付出
      约 40 次模型生成的时间（约 20–30 分钟）；后续都是缓存读盘。
    - 如果想清空某个示例的缓存，删 cache/story/v4__<hash>__<nameHash>__<gender>__<posterStyle>__<theme>__<style>__*.{json,png} 即可
      （nameHash 是 sha1(name|nickname).slice(0,10)；改名字/外号/性别/posterStyle 即视为新示例）。
*/

const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const HOST = process.env.HOST || 'http://localhost:3000';
const DEMOS_FILE = path.join(__dirname, 'demos.json');

const VALID_POSTER_STYLES = ['prank', 'warm'];
const VALID_THEMES_BY_PS = {
  prank: ['gongdou', 'chuanyue', 'xuanyi', 'dalian', 'shuangwen'],
  warm:  ['zhiyu', 'tonghua', 'xiaoyuan', 'lvtu', 'jieri'],
};
const VALID_STYLES_BY_PS = {
  prank: ['lianyu', 'bluelock', 'xianni'],
  warm:  ['ghibli', 'shinkai', 'picturebook'],
};

function fmt(ms) {
  if (ms < 1500) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function warmPath(demo, choicePath) {
  const ps = demo.posterStyle === 'warm' ? 'warm' : 'prank';
  const startResp = await axios.post(
    `${HOST}/api/story/start`,
    {
      hash: demo.hash,
      name: demo.name,
      nickname: demo.nickname || '',
      gender: demo.gender || 'x',
      posterStyle: ps,
      theme: demo.theme,
      style: demo.style,
    },
    { timeout: 500000 }
  );
  const sessionId = startResp.data && startResp.data.sessionId;
  if (!sessionId) throw new Error('start 接口未返回 sessionId');

  // 现在 start/next 是"文先回，图后到"——预热必须显式等图落盘，否则缓存写不进去。
  await axios.get(
    `${HOST}/api/story/scene-image`,
    { params: { sessionId, sceneIndex: 0 }, timeout: 500000 }
  );

  for (let i = 0; i < choicePath.length; i++) {
    const ci = choicePath[i];
    await axios.post(
      `${HOST}/api/story/next`,
      { sessionId, choiceIndex: ci },
      { timeout: 500000 }
    );
    await axios.get(
      `${HOST}/api/story/scene-image`,
      { params: { sessionId, sceneIndex: i + 1 }, timeout: 500000 }
    );
  }
}

function validateDemo(demo, idx) {
  if (!demo || typeof demo !== 'object') {
    throw new Error(`demos[${idx}] 不是对象`);
  }
  if (!demo.hash || typeof demo.hash !== 'string' || demo.hash.length < 32) {
    throw new Error(`demos[${idx}].hash 缺失或不像 sha256（${demo.hash}）`);
  }
  if (!demo.name) {
    throw new Error(`demos[${idx}].name 缺失`);
  }
  const ps = demo.posterStyle === 'warm' ? 'warm' : 'prank';
  if (demo.posterStyle && !VALID_POSTER_STYLES.includes(demo.posterStyle)) {
    throw new Error(`demos[${idx}].posterStyle 必须是 ${VALID_POSTER_STYLES.join(' / ')}（缺省为 prank）`);
  }
  if (!VALID_THEMES_BY_PS[ps].includes(demo.theme)) {
    throw new Error(`demos[${idx}].theme（posterStyle=${ps}）必须是 ${VALID_THEMES_BY_PS[ps].join(' / ')}`);
  }
  if (!VALID_STYLES_BY_PS[ps].includes(demo.style)) {
    throw new Error(`demos[${idx}].style（posterStyle=${ps}）必须是 ${VALID_STYLES_BY_PS[ps].join(' / ')}`);
  }
}

async function warmDemo(demo, idx, totalDemos) {
  console.log(
    `\n=== [${idx + 1}/${totalDemos}] ${demo.name}` +
    (demo.nickname ? `（${demo.nickname}）` : '') +
    `  主题：${demo.theme}  画风：${demo.style} ===`
  );
  console.log(`hash：${demo.hash}`);

  let n = 0;
  const failures = [];
  const tDemo = Date.now();
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 3; b++) {
      for (let c = 0; c < 3; c++) {
        n++;
        const tag = `[${a},${b},${c}]`;
        const t0 = Date.now();
        process.stdout.write(`  (${n}/27) ${tag}  ... `);
        try {
          await warmPath(demo, [a, b, c]);
          console.log(`✓ ${fmt(Date.now() - t0)}`);
        } catch (e) {
          const detail = (e.response && e.response.data) || e.message;
          const msg = typeof detail === 'object' ? JSON.stringify(detail).slice(0, 200) : String(detail);
          console.log(`✗ ${msg}`);
          failures.push({ path: [a, b, c], error: msg });
        }
      }
    }
  }
  console.log(
    `小结：${demo.name} 共 27 条路径，` +
    `成功 ${27 - failures.length}，失败 ${failures.length}，` +
    `耗时 ${((Date.now() - tDemo) / 60000).toFixed(1)} 分钟`
  );
  return failures;
}

async function main() {
  if (!fs.existsSync(DEMOS_FILE)) {
    console.error(`找不到 ${DEMOS_FILE}`);
    console.error('请参考 scripts/demos.example.json 创建该文件。');
    process.exit(1);
  }

  let demos;
  try {
    demos = JSON.parse(fs.readFileSync(DEMOS_FILE, 'utf8'));
  } catch (e) {
    console.error(`解析 ${DEMOS_FILE} 失败：${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(demos) || demos.length === 0) {
    console.error('demos.json 必须是非空数组');
    process.exit(1);
  }
  demos.forEach(validateDemo);

  // 探活：服务器必须在跑
  try {
    await axios.get(HOST + '/', { timeout: 5000 });
  } catch (e) {
    console.error(`连不上 ${HOST} —— 请先 node server.js`);
    process.exit(1);
  }

  console.log(`将预热 ${demos.length} 个示例，每个 27 条路径。`);
  console.log(`后端：${HOST}`);
  console.log(`提示：每条新路径首次贯穿大约 30s × 4 = 2 分钟左右，全部贯穿后再走一次基本秒回。`);

  const t0 = Date.now();
  const allFailures = [];
  for (let i = 0; i < demos.length; i++) {
    const fails = await warmDemo(demos[i], i, demos.length);
    if (fails.length) {
      allFailures.push({ demo: demos[i].name, failures: fails });
    }
  }

  console.log(`\n========== 完成 ==========`);
  console.log(`总耗时 ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`);
  if (allFailures.length) {
    console.log(`下列路径失败，可重跑：`);
    for (const f of allFailures) {
      console.log(`  - ${f.demo}：${f.failures.length} 条`);
      for (const x of f.failures.slice(0, 5)) {
        console.log(`      [${x.path.join(',')}] ${x.error.slice(0, 120)}`);
      }
    }
  } else {
    console.log('全部 ✓');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
