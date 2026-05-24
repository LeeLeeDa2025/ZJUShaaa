/*
  单路径预热：把「演示用」的两条路径灌满缓存。
    - 路径固定为每次都选第 1 个选项，即 [0, 0, 0]。
    - 走两遍：整蛊风 (prank) 和 温暖之域 (warm) 各一次。
    - 这条脚本只生成 8 个节点（每条 start + next×3 = 4 个），
      跟 prewarm-story.js 的「27 条全量预热」是两回事。

  用法：
    1. node server.js 在跑（默认 http://localhost:3000）。
    2. node scripts/prewarm-demo.js
*/

const axios = require('axios');

const HOST = process.env.HOST || 'http://localhost:3000';

// 演示固定配置：同一张照片、同一个名字 / 性别，两套 posterStyle 各跑一条
const COMMON = {
  hash: 'd11d926bb0704654f535674bd95ad5681110bf879a8ae417f0c5a8b9dbe4bf61',
  name: '示例同学',
  nickname: '梦中梦',
  gender: 'f',
};
const DEMOS = [
  {
    label: '整蛊风 · 爽文 · 恋与深空',
    posterStyle: 'prank',
    theme: 'shuangwen',
    style: 'lianyu',
  },
  {
    label: '温暖之域 · 旅途同行 · 新海诚',
    posterStyle: 'warm',
    theme: 'lvtu',
    style: 'shinkai',
  },
];

function fmt(ms) {
  if (ms < 1500) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function getSceneImage(sessionId, sceneIndex) {
  // 文先回、图后到 —— 预热必须显式等图片落盘，否则缓存不会写
  await axios.get(`${HOST}/api/story/scene-image`, {
    params: { sessionId, sceneIndex },
    timeout: 500000,
  });
}

async function warmOnePath(demo) {
  console.log(`\n=== ${demo.label} ===`);

  const t0 = Date.now();
  process.stdout.write(`  [start]            ... `);
  const startResp = await axios.post(
    `${HOST}/api/story/start`,
    {
      ...COMMON,
      posterStyle: demo.posterStyle,
      theme: demo.theme,
      style: demo.style,
    },
    { timeout: 500000 }
  );
  const sessionId = startResp.data && startResp.data.sessionId;
  if (!sessionId) throw new Error('start 接口未返回 sessionId');
  await getSceneImage(sessionId, 0);
  console.log(`✓ ${fmt(Date.now() - t0)}`);

  // 每次都点第 1 个选项（index = 0），共 3 次 → start + 0 + 0-0 + 0-0-0
  for (let i = 0; i < 3; i++) {
    const tx = Date.now();
    const label = `next #${i + 1} (choose 0)`;
    process.stdout.write(`  [${label.padEnd(18)}] ... `);
    await axios.post(
      `${HOST}/api/story/next`,
      { sessionId, choiceIndex: 0 },
      { timeout: 500000 }
    );
    await getSceneImage(sessionId, i + 1);
    console.log(`✓ ${fmt(Date.now() - tx)}`);
  }
}

async function main() {
  // 探活
  try {
    await axios.get(HOST + '/', { timeout: 5000 });
  } catch (e) {
    console.error(`连不上 ${HOST} —— 请先 node server.js`);
    process.exit(1);
  }

  console.log(`将为下列演示路径预热缓存（每条 4 个节点）：`);
  for (const d of DEMOS) {
    console.log(`  - ${d.label}（posterStyle=${d.posterStyle}, theme=${d.theme}, style=${d.style}）`);
  }
  console.log(`公共：hash=${COMMON.hash}`);
  console.log(`     name=${COMMON.name}, nickname=${COMMON.nickname}, gender=${COMMON.gender}`);
  console.log(`     选择路径=[0, 0, 0]（每次都点第 1 个选项）`);

  const tAll = Date.now();
  for (const d of DEMOS) {
    try {
      await warmOnePath(d);
    } catch (e) {
      const detail = (e.response && e.response.data) || e.message;
      console.error(`\n[${d.label}] 失败：`, typeof detail === 'object' ? JSON.stringify(detail).slice(0, 400) : detail);
      process.exitCode = 2;
    }
  }
  console.log(`\n========== 完成 ==========`);
  console.log(`总耗时 ${((Date.now() - tAll) / 60000).toFixed(1)} 分钟`);
  console.log(`再次走相同路径将完全走缓存，秒回。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
