/*
  示例图片首选项预热：把「示例图片 × 所有表单组合」沿默认首选项 [0,0,0] 灌满缓存。
    - 同一张照片（hash）、同一组身份信息（name / nickname / gender）。
    - 两种 posterStyle × 5 主题 × 3 画风 = 30 个组合。
    - 每个组合只走 [0,0,0] 这一条路径（start + next×3 = 4 个节点）。
    - 总计 30 × 4 = 120 个节点；如果全部 miss，按 ~30s/节点估算约 60–90 分钟。
    - 命中过的节点会被服务器秒回，所以重跑只是把"还没缓存"的那一小段补上。

  如果想覆盖一个组合里完整 27 选择路径，请改用 prewarm-story.js + 编辑 demos.json。

  用法：
    1. node server.js 在跑（默认 http://localhost:3000）。
    2. node scripts/prewarm-demo.js
*/

const axios = require('axios');

const HOST = process.env.HOST || 'http://localhost:3000';

// 演示固定身份：同一张照片、同一个名字 / 性别
const COMMON = {
  hash: 'd11d926bb0704654f535674bd95ad5681110bf879a8ae417f0c5a8b9dbe4bf61',
  name: '示例同学',
  nickname: '梦中梦',
  gender: 'f',
};

// 与 server.js / public/app.js 保持一致：两套主题池、两套画风池
const THEMES_BY_PS = {
  prank: ['gongdou', 'chuanyue', 'xuanyi', 'dalian', 'shuangwen'],
  warm:  ['zhiyu', 'tonghua', 'xiaoyuan', 'lvtu', 'jieri'],
};
const STYLES_BY_PS = {
  prank: ['lianyu', 'bluelock', 'xianni'],
  warm:  ['ghibli', 'shinkai', 'picturebook'],
};
const PS_CN = { prank: '整蛊风', warm: '温暖之域' };

const DEMOS = [];
for (const ps of ['prank', 'warm']) {
  for (const theme of THEMES_BY_PS[ps]) {
    for (const style of STYLES_BY_PS[ps]) {
      DEMOS.push({
        label: `${PS_CN[ps]} · ${theme} · ${style}`,
        posterStyle: ps,
        theme,
        style,
      });
    }
  }
}

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

  console.log(`将预热 ${DEMOS.length} 个表单组合（每条 4 个节点，全部 miss 时 ${DEMOS.length * 4} 个节点）：`);
  for (const d of DEMOS) {
    console.log(`  - ${d.label}（posterStyle=${d.posterStyle}, theme=${d.theme}, style=${d.style}）`);
  }
  console.log(`公共：hash=${COMMON.hash}`);
  console.log(`     name=${COMMON.name}, nickname=${COMMON.nickname}, gender=${COMMON.gender}`);
  console.log(`     选择路径=[0, 0, 0]（每次都点第 1 个选项）`);

  const tAll = Date.now();
  let okCount = 0;
  const failed = [];
  for (let i = 0; i < DEMOS.length; i++) {
    const d = DEMOS[i];
    process.stdout.write(`\n[${i + 1}/${DEMOS.length}] `);
    try {
      await warmOnePath(d);
      okCount++;
    } catch (e) {
      const detail = (e.response && e.response.data) || e.message;
      const msg = typeof detail === 'object' ? JSON.stringify(detail).slice(0, 400) : detail;
      console.error(`\n[${d.label}] 失败：`, msg);
      failed.push({ label: d.label, msg });
      process.exitCode = 2;
    }
  }
  console.log(`\n========== 完成 ==========`);
  console.log(`成功 ${okCount} / ${DEMOS.length}，失败 ${failed.length}`);
  console.log(`总耗时 ${((Date.now() - tAll) / 60000).toFixed(1)} 分钟`);
  if (failed.length) {
    console.log(`失败列表（可重跑脚本，已缓存节点会秒回）：`);
    for (const f of failed) console.log(`  - ${f.label}: ${String(f.msg).slice(0, 160)}`);
  } else {
    console.log(`再次走相同路径将完全走缓存，秒回。`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
