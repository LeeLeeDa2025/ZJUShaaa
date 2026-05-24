const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const API_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai-next.com';
const API_KEY =
  process.env.OPENAI_API_KEY ||
  'sk-XODhEVNgovTP7Y7mE49a2e2b4b8a4d0b8172020960EeC99a';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-2';
const TEXT_MODEL  = process.env.TEXT_MODEL  || 'gpt-4o-mini';

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CACHE_DIR = path.join(__dirname, 'cache');
const STORY_CACHE_DIR = path.join(CACHE_DIR, 'story');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
if (!fs.existsSync(STORY_CACHE_DIR)) fs.mkdirSync(STORY_CACHE_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '20mb' }));

function rollBounty() {
  const levels = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const idx = Math.floor(Math.random() * levels.length);
  const level = levels[idx];
  const base = 500 * Math.pow(3, idx);
  const jitter = Math.floor(base * (0.5 + Math.random()));
  const bounty = base + jitter;
  return { dangerLevel: level, bounty };
}

const WARM_KEYWORDS = [
  '午后散步', '雨后小巷', '咖啡香气', '书页翻动', '微凉清晨',
  '黄昏窗台', '炉火慢炖', '一行旧句', '懒猫晒太阳', '冰拿铁与风',
  '行李半收', '路边花摊', '夜车回家', '老歌单',
];
const WARM_FEELINGS = [
  '正在被温柔包围',
  '想跟谁分享这一刻',
  '没什么大事，就是有点想念',
  '心里有片暖光在亮着',
  '好像被时间放过了',
  '只想这样多待一会儿',
  '突然有种活着真好的感觉',
];
function rollWarm() {
  return {
    keyword: WARM_KEYWORDS[Math.floor(Math.random() * WARM_KEYWORDS.length)],
    warmth: 3 + Math.floor(Math.random() * 3),         // 3-5 颗星
    mood:   72 + Math.floor(Math.random() * 28),       // 72-99 分
    feeling: WARM_FEELINGS[Math.floor(Math.random() * WARM_FEELINGS.length)],
  };
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// 缓存元数据：cache/{hash}.meta.json
//   { gender, prank?: {dangerLevel, bounty}, warm?: {keyword, warmth, mood, feeling}, createdAt, updatedAt }
function readPosterMeta(hash) {
  const metaPath = path.join(CACHE_DIR, `${hash}.meta.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (e) {
    return null;
  }
}
function writePosterMeta(hash, meta) {
  try {
    fs.writeFileSync(
      path.join(CACHE_DIR, `${hash}.meta.json`),
      JSON.stringify(meta, null, 2)
    );
  } catch (e) {
    console.warn('[cache] write meta failed:', e.message);
  }
}

function mimeToExt(mime) {
  if (!mime) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif'))  return 'gif';
  return 'png';
}

// 保留原图到 cache/{hash}.original.{ext}，给第二部分剧情图用
function saveOriginalIfNeeded(filePath, hash, mime) {
  const ext = mimeToExt(mime);
  const dest = path.join(CACHE_DIR, `${hash}.original.${ext}`);
  if (fs.existsSync(dest)) return dest;
  try {
    fs.copyFileSync(filePath, dest);
    return dest;
  } catch (e) {
    console.warn('[cache] save original failed:', e.message);
    return null;
  }
}

function findOriginalByHash(hash) {
  for (const ext of ['png', 'jpg', 'webp', 'gif']) {
    const p = path.join(CACHE_DIR, `${hash}.original.${ext}`);
    if (fs.existsSync(p)) return { path: p, ext };
  }
  return null;
}

// 整蛊风 · 保留原照构图，只在嘴角加入与姿态相符的口水和旧照质感
async function generatePrankPortrait(hash) {
  const orig = findOriginalByHash(hash);
  if (!orig) throw new Error('原始照片未找到');

  const prompt = `Edit the input portrait into a playful vintage wanted-poster photograph.

CRITICAL PRESERVATION:
- Keep the same person unmistakably recognizable: preserve facial features, face shape, skin tone, hairstyle, glasses, clothing, pose, head orientation, camera angle, and background arrangement.
- Keep the original framing and orientation. Do not rotate, recompose, replace, or beautify the person.
- This is a localized photographic edit, not a new illustration.

LOCAL PRANK DETAIL:
- Add one small, believable strand of translucent saliva attached precisely to the visible corner of the person's mouth.
- The saliva must visibly originate at the lips and hang naturally with gravity relative to the existing pose.
- Keep it subtle and humorous; it must never float on clothing, the chair, or the background.

PHOTO FINISH:
- Apply a restrained sepia, faded archival wanted-photo finish with light paper grain and softly worn edges.
- Preserve clear facial detail and the recognizability of the original photograph.

STRICT NO LIST:
- Do NOT add text, letters, numbers, logos, stamps, captions, frames, or decorative overlays.
- Do NOT add any saliva anywhere except the visible mouth corner.
- Do NOT introduce other people or remove original scene elements.`;

  return withRetry('prank-portrait', async () => {
    const form = new FormData();
    form.append('image', fs.createReadStream(orig.path), {
      filename: `original.${orig.ext}`,
      contentType: `image/${orig.ext === 'jpg' ? 'jpeg' : orig.ext}`,
    });
    form.append('prompt', prompt);
    form.append('model', IMAGE_MODEL);
    form.append('size', '1024x1024');
    form.append('n', '1');

    const response = await axios.post(
      `${API_BASE}/v1/images/edits`,
      form,
      {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${API_KEY}` },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000,
      }
    );
    const item = response.data && response.data.data && response.data.data[0];
    if (!item) throw new Error('图像服务返回为空');
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item.url) {
      const imgResp = await axios.get(item.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      const b64 = Buffer.from(imgResp.data).toString('base64');
      return `data:image/png;base64,${b64}`;
    }
    throw new Error('图像服务返回格式异常');
  }, { attempts: 5, baseDelayMs: 10000 });
}

// 取整蛊风编辑照：先查 cache/{hash}.prank.png，没命中才调 gpt-image-2
async function getOrGeneratePrankImage(hash) {
  const cached = path.join(CACHE_DIR, `${hash}.prank.png`);
  if (fs.existsSync(cached)) {
    try {
      const b64 = fs.readFileSync(cached).toString('base64');
      return { image: `data:image/png;base64,${b64}`, cachedImage: true };
    } catch (e) {
      console.warn('[cache] read prank image failed:', e.message);
    }
  }
  const dataUrl = await generatePrankPortrait(hash);
  const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (m) {
    try {
      fs.writeFileSync(cached, Buffer.from(m[1], 'base64'));
    } catch (e) {
      console.warn('[cache] write prank image failed:', e.message);
    }
  }
  return { image: dataUrl, cachedImage: false };
}

// 温暖之域 · 把原图重绘成治愈系日常风景插画（保留人物面部特征）
async function generateWarmIllustration(hash) {
  const orig = findOriginalByHash(hash);
  if (!orig) throw new Error('原始照片未找到');

  const prompt = `Reimagine the person from the input photo inside a soft, peaceful daily-life illustration.

ART STYLE:
- Warm healing aesthetic inspired by Studio Ghibli and Makoto Shinkai animation backgrounds.
- Painterly, soft pastel palette, gentle natural lighting (golden hour, window light, or overcast).
- Dreamy bokeh, fine grain, slice-of-life mood.

SCENE TO DEPICT:
- A calm everyday setting — pick one that fits the mood: afternoon sunlight by a window, a quiet cafe corner, a park bench under cherry blossoms or autumn leaves, a kitchen with steaming kettle, a bookstore aisle, a slow rooftop sunset, a tatami room with floating curtains, etc.
- The person from the photo is present in the frame and looks calm, at ease, content. They can be sitting, walking, looking out, holding a cup, etc.
- Composition is peaceful — no dramatic action, no danger, no exaggerated expressions.

IDENTITY PRESERVATION (FACE FEATURES):
- The face should be recognizable as the same individual from the input photo — face shape, eyes, eyebrows, nose, mouth, skin tone, and hairstyle.
- The result is stylized illustration, not a photo, but should still feel like a portrait of this specific person.
- Head/camera angle can differ from the input photo; the body, outfit, and framing should match the daily scene.

STRICT NO LIST:
- Do NOT render any text, letters, numbers, words, logos, captions, or signs anywhere in the image.
- Do NOT use harsh shadows, neon, action effects, or dramatic motion blur.
- Do NOT replace the person with someone else.`;

  return withRetry('warm-illustration', async () => {
    const form = new FormData();
    form.append('image', fs.createReadStream(orig.path), {
      filename: `original.${orig.ext}`,
      contentType: `image/${orig.ext === 'jpg' ? 'jpeg' : orig.ext}`,
    });
    form.append('prompt', prompt);
    form.append('model', IMAGE_MODEL);
    form.append('size', '1024x1024');
    form.append('n', '1');

    const response = await axios.post(
      `${API_BASE}/v1/images/edits`,
      form,
      {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${API_KEY}` },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000,
      }
    );
    const item = response.data && response.data.data && response.data.data[0];
    if (!item) throw new Error('图像服务返回为空');
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item.url) {
      const imgResp = await axios.get(item.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      const b64 = Buffer.from(imgResp.data).toString('base64');
      return `data:image/png;base64,${b64}`;
    }
    throw new Error('图像服务返回格式异常');
  }, { attempts: 5, baseDelayMs: 10000 });
}

// 取暖系插画：先查 cache/{hash}.warm.png，没命中才调 gpt-image-2
async function getOrGenerateWarmImage(hash) {
  const cached = path.join(CACHE_DIR, `${hash}.warm.png`);
  if (fs.existsSync(cached)) {
    try {
      const b64 = fs.readFileSync(cached).toString('base64');
      return { image: `data:image/png;base64,${b64}`, cachedImage: true };
    } catch (e) {
      console.warn('[cache] read warm image failed:', e.message);
    }
  }
  const dataUrl = await generateWarmIllustration(hash);
  const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (m) {
    try {
      fs.writeFileSync(cached, Buffer.from(m[1], 'base64'));
    } catch (e) {
      console.warn('[cache] write warm image failed:', e.message);
    }
  }
  return { image: dataUrl, cachedImage: false };
}

const VALID_POSTER_STYLES = new Set(['prank', 'warm']);
const VALID_GENDERS = new Set(['m', 'f', 'x']);
const ENTER_PARALLEL_SUGGESTION = '进入照片中的平行世界';

app.post('/api/generate-poster', upload.single('image'), async (req, res) => {
  const filePath = req.file && req.file.path;
  try {
    const name = (req.body.name || '').trim();
    const nickname = (req.body.nickname || '').trim();
    const style = VALID_POSTER_STYLES.has(req.body.style) ? req.body.style : 'prank';
    const gender = VALID_GENDERS.has(req.body.gender) ? req.body.gender : 'x';

    if (!filePath) return res.status(400).json({ error: '请上传图片' });
    if (!name) {
      fs.unlink(filePath, () => {});
      return res.status(400).json({ error: '请输入姓名' });
    }

    const hash = sha256File(filePath);
    const mime = req.file.mimetype || 'image/png';

    // 保留原图，供第二部分剧情图复用
    saveOriginalIfNeeded(filePath, hash, mime);

    // 同一张照片 → 复用之前摇出的数值；不同风格各自分桶
    let meta = readPosterMeta(hash) || { createdAt: Date.now() };
    meta.gender = gender;          // 性别按最近一次提交覆盖
    meta.updatedAt = Date.now();

    let image;
    let posterBody;
    let cached;

    if (style === 'prank') {
      // 生成保留原貌的整蛊旧照，口水由图像编辑定位到实际嘴角
      const prankImg = await getOrGeneratePrankImage(hash);
      image = prankImg.image;

      if (!meta.prank) {
        meta.prank = rollBounty();
      }
      cached = prankImg.cachedImage;
      writePosterMeta(hash, meta);

      posterBody = {
        name,
        nickname: nickname || null,
        crime: '在工作时间潜入照片副本',
        dangerLevel: meta.prank.dangerLevel,
        bounty: meta.prank.bounty,
        status: '假装掉线，实则灵魂出窍',
        suggestion: ENTER_PARALLEL_SUGGESTION,
      };
    } else {
      // 温暖之域：调 gpt-image-2 把原图重绘成治愈风景插画，落盘
      const warmImg = await getOrGenerateWarmImage(hash);
      image = warmImg.image;

      if (!meta.warm) {
        meta.warm = rollWarm();
        cached = warmImg.cachedImage;       // 数值新摇，但图可能命中缓存
      } else {
        cached = warmImg.cachedImage;
      }
      writePosterMeta(hash, meta);

      posterBody = {
        name,
        nickname: nickname || null,
        crime: meta.warm.keyword,           // 主题词
        dangerLevel: '★'.repeat(meta.warm.warmth), // 暖意之度
        bounty: meta.warm.mood,             // 心情值
        status: meta.warm.feeling,          // 当下感受
        suggestion: ENTER_PARALLEL_SUGGESTION,
      };
    }

    console.log(`[cache] ${cached ? 'HIT ' : 'MISS'} ${style} ${hash}`);

    fs.unlink(filePath, () => {});

    return res.json({
      image,
      cached,
      hash,
      style,
      gender,
      poster: posterBody,
    });
  } catch (err) {
    if (filePath) fs.unlink(filePath, () => {});
    const detail =
      (err.response && err.response.data) || err.message || String(err);
    console.error('[generate-poster] error:', detail);
    return res.status(500).json({
      error: '生成失败',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
});

/* =========================================================
   第二部分 · 入画剧情
   ========================================================= */

const sessionStore = new Map(); // sessionId -> session
// 30 分钟未访问的 session 自动清除
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessionStore) {
    if (now - (s.touchedAt || s.createdAt) > 30 * 60 * 1000) {
      sessionStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

function newSessionId() {
  return crypto.randomBytes(10).toString('hex');
}

/* ---------- 剧情节点永久缓存 ----------
   键：(hash, name+nickname hash, theme, style, choicePath, gender, posterStyle) → 文件 cache/story/{key}.json + .png
   覆盖范围：开局 1 节点 + 第 2 幕 3 节点 + 第 3 幕 9 节点 + 终幕 27 节点 = 40 节点
   bump STORY_CACHE_VERSION 即可强制让所有旧缓存失效。
*/
const STORY_CACHE_VERSION = 'v5';

function nameKey(name, nickname) {
  const raw = `${(name || '').trim()}|${(nickname || '').trim()}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 10);
}

function storyCacheKey(hash, theme, style, choicePath, name, nickname, gender, posterStyle) {
  const p = (choicePath && choicePath.length > 0) ? choicePath.join('-') : 'start';
  const n = nameKey(name, nickname);
  const g = (gender === 'm' || gender === 'f') ? gender : 'x';
  const ps = posterStyle === 'warm' ? 'warm' : 'prank';
  return `${STORY_CACHE_VERSION}__${hash}__${n}__${g}__${ps}__${theme}__${style}__${p}`;
}

function readStoryCache(key) {
  const metaPath = path.join(STORY_CACHE_DIR, `${key}.json`);
  const imgPath  = path.join(STORY_CACHE_DIR, `${key}.png`);
  if (!fs.existsSync(metaPath) || !fs.existsSync(imgPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const b64  = fs.readFileSync(imgPath).toString('base64');
    return {
      narrative: meta.narrative,
      imagePrompt: meta.imagePrompt,
      choices: meta.choices || [],
      isFinale: !!meta.isFinale,
      aWins: meta.aWins,
      image: `data:image/png;base64,${b64}`,
    };
  } catch (e) {
    console.warn('[story-cache] read failed:', e.message);
    return null;
  }
}

function writeStoryCache(key, scene) {
  try {
    const m = scene.image && scene.image.match(/^data:image\/\w+;base64,(.+)$/);
    if (!m) return;
    fs.writeFileSync(
      path.join(STORY_CACHE_DIR, `${key}.png`),
      Buffer.from(m[1], 'base64')
    );
    fs.writeFileSync(
      path.join(STORY_CACHE_DIR, `${key}.json`),
      JSON.stringify({
        narrative: scene.narrative,
        imagePrompt: scene.imagePrompt,
        choices: scene.choices || [],
        isFinale: !!scene.isFinale,
        aWins: scene.aWins,
        cachedAt: Date.now(),
      }, null, 2)
    );
  } catch (e) {
    console.warn('[story-cache] write failed:', e.message);
  }
}

function getChoicePath(session) {
  return session.scenes
    .filter((s) => typeof s.pickedIndex === 'number' && s.pickedIndex >= 0)
    .map((s) => s.pickedIndex);
}

// 上游 API（gpt-4o-mini / gpt-image-2）经常 524 / 5xx 临时超时，
// 用退避重试包一层，让预热不至于一两条路径就全军覆没。
function isRetryableError(err) {
  if (!err) return false;
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'EAI_AGAIN') return true;
  const status = err.response && err.response.status;
  if (status && (status === 408 || status === 429 || status >= 500)) return true;
  return false;
}
async function withRetry(label, fn, { attempts = 4, baseDelayMs = 8000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || i === attempts - 1) break;
      const wait = baseDelayMs * Math.pow(1.8, i) + Math.floor(Math.random() * 2000);
      const status = (err.response && err.response.status) || err.code || err.message;
      console.warn(`[retry] ${label} attempt ${i + 1}/${attempts} failed (${status}); waiting ${(wait/1000).toFixed(1)}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

const STYLE_PROMPTS = {
  lianyu:
    'Otome romance game illustration style ("恋与深空" inspired): semi-realistic 3D anime portrait, soft cinematic rim lighting, dreamy bokeh, painterly background, sparkling particles, refined detailed eyes, gentle film grain, magazine-cover composition',
  bluelock:
    'High-contrast modern sports anime art style ("蓝色监狱" inspired): sharp angular ink lineart, dramatic perspective with strong foreshortening, intense expression, neon spotlight, motion lines, dark gritty atmosphere with cool blue and crimson accents',
  xianni:
    'Chinese cultivation xianxia anime art style ("仙逆" inspired): flowing Hanfu / Daoist robes, glowing spiritual energy aura, ink-wash mountains background, drifting petals and embers, ancient Eastern aesthetic, mystical celestial lighting',
};

const STYLE_LABELS = {
  lianyu:   '恋与深空',
  bluelock: '蓝色监狱',
  xianni:   '仙逆',
};

const THEME_LABELS = {
  gongdou:   '宫斗剧',
  chuanyue:  '穿越重生',
  xuanyi:    '悬疑探案',
  dalian:    '打脸',
  shuangwen: '爽文',
};

const THEME_HINTS = {
  gongdou:   '宫斗剧：深宫嫔妃、心机暗涌、丝绸长裙、玉簪冷茶之间藏刀',
  chuanyue:  '穿越重生：穿越到古代或异世界，凭现代知识开挂逆袭',
  xuanyi:    '悬疑探案：阴雨小巷、蛛丝马迹，最后一刻揭晓真相',
  dalian:    '打脸文：傲慢对手一开始看不起我，结局被我啪啪打脸',
  shuangwen: '爽文：一路碾压、好运叠满、装到、爽到、所有人惊呆',
};

/* ===== 温暖之域风：与整蛊风平行的另一套主题/画风 ===== */
const WARM_STYLE_PROMPTS = {
  ghibli:
    'Studio Ghibli inspired hand-painted animation style: lush watercolor backgrounds, soft natural light, gentle wind, expressive but rounded character design, warm earth and pastel tones, lyrical pastoral or cozy interior settings, a calm wholesome atmosphere',
  shinkai:
    'Makoto Shinkai inspired anime style: hyper-saturated luminous skies, intricate cloud and light shafts, glittering reflections, detailed urban or small-town backgrounds, soft glow, slightly melancholic warmth, cinematic widescreen composition',
  picturebook:
    'Storybook watercolor illustration style: flat-yet-textured watercolor washes, gentle outline, simplified shapes, friendly rounded character design, cozy pastel palette, dotted patterns and storybook borders, warm childlike sweetness',
};

const WARM_STYLE_LABELS = {
  ghibli:      '吉卜力',
  shinkai:     '新海诚',
  picturebook: '绘本水彩',
};

const WARM_THEME_LABELS = {
  zhiyu:    '治愈日常',
  tonghua:  '童话奇遇',
  xiaoyuan: '校园回忆',
  lvtu:     '旅途同行',
  jieri:    '节日温馨',
};

const WARM_THEME_HINTS = {
  zhiyu:    '治愈日常：一杯热茶、一个慵懒午后，雨声、猫咪、烤面包香',
  tonghua:  '童话奇遇：走进绘本里的小世界，会说话的小动物、星光下的露营',
  xiaoyuan: '校园回忆：操场、毕业册、未发出的纸条，夏蝉与黑板擦的粉笔灰',
  lvtu:     '旅途同行：火车窗外的稻田、便利店关东煮、夕阳里的海岸公路',
  jieri:    '节日温馨：除夕灯笼、夏日祭烟花、生日蜡烛与悄悄准备的惊喜',
};

/* 按 posterStyle ('prank' | 'warm') 拿对应的主题/画风集合 */
function themesFor(posterStyle) {
  return posterStyle === 'warm' ? WARM_THEME_LABELS : THEME_LABELS;
}
function themeHintsFor(posterStyle) {
  return posterStyle === 'warm' ? WARM_THEME_HINTS : THEME_HINTS;
}
function stylePromptsFor(posterStyle) {
  return posterStyle === 'warm' ? WARM_STYLE_PROMPTS : STYLE_PROMPTS;
}
function styleLabelsFor(posterStyle) {
  return posterStyle === 'warm' ? WARM_STYLE_LABELS : STYLE_LABELS;
}
function defaultThemeFor(posterStyle) {
  return posterStyle === 'warm' ? 'zhiyu' : 'shuangwen';
}
function defaultStyleFor(posterStyle) {
  return posterStyle === 'warm' ? 'ghibli' : 'lianyu';
}

async function generateText(messages) {
  return withRetry('chat-completion', async () => {
    const resp = await axios.post(
      `${API_BASE}/v1/chat/completions`,
      {
        model: TEXT_MODEL,
        messages,
        temperature: 0.95,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    const content = resp.data && resp.data.choices && resp.data.choices[0] &&
      resp.data.choices[0].message && resp.data.choices[0].message.content;
    if (!content) throw new Error('文本服务返回为空');
    try {
      return JSON.parse(content);
    } catch (e) {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('文本服务返回非 JSON：' + content.slice(0, 200));
    }
  });
}

const HEAD_ANGLES = [
  'FRONTAL EYE-LEVEL shot — the character faces the camera straight on, both eyes meeting the viewer; this is NOT the angle of the input photo, do not reuse the source profile',
  'THREE-QUARTER FRONT shot from slightly ABOVE (high angle) — the face is turned about 30° away from camera, chin tucked, looking up toward the lens',
  'STRICT PROFILE from the opposite side of the input photo — full side silhouette of the face against a bright rim light; if the source was a left profile use a right profile here, and vice versa',
  'LOW-ANGLE HERO shot looking UP at the character — chin raised, face tilted three-quarter, dramatic backlight behind the head',
  'OVER-THE-SHOULDER / BACK THREE-QUARTER view — we mostly see the back of the head and one shoulder; the character glances back so only ~40% of the face is visible',
  'DYNAMIC ACTION close-up with the head mid-motion — three-quarter from below, hair and clothes streaked by motion, mouth open in a shout or smirk',
];

function pickHeadAngle(sceneIndex, choicePath) {
  const lastPick = (choicePath && choicePath.length > 0)
    ? Number(choicePath[choicePath.length - 1]) || 0
    : 0;
  const i = (sceneIndex * 2 + lastPick) % HEAD_ANGLES.length;
  return HEAD_ANGLES[i];
}

async function generateSceneImage({ hash, imagePrompt, styleKey, sceneIndex = 0, choicePath = [], gender = 'x', posterStyle = 'prank' }) {
  const orig = findOriginalByHash(hash);
  if (!orig) {
    throw new Error('原始照片未找到，请先完成上一步通缉令生成');
  }
  const ps = posterStyle === 'warm' ? 'warm' : 'prank';
  const stylePrompts = stylePromptsFor(ps);
  const styleDesc = stylePrompts[styleKey] || stylePrompts[defaultStyleFor(ps)];
  const headAngle = pickHeadAngle(sceneIndex, choicePath);

  const playerHardGender = gender === 'm'
    ? { label: 'MALE', body: 'a young adult MAN in his early twenties', detail: 'clearly masculine build, flat chest, broader shoulders, no breasts, no makeup, masculine jawline, short or medium men\'s hairstyle', wrong: 'female, woman, girl, feminine, breasts, long flowing hair styled as a woman\'s, makeup, skirt or dress' }
    : gender === 'f'
      ? { label: 'FEMALE', body: 'a young adult WOMAN in her early twenties', detail: 'clearly feminine build, slimmer shoulders, defined waist, softer facial features, women\'s hairstyle (shoulder-length, tied-up, long, etc.)', wrong: 'male, man, boy, masculine build, flat male chest, stubble, men\'s broad shoulders, men\'s short military haircut' }
      : { label: 'ANDROGYNOUS', body: 'a young adult of androgynous presentation in their early twenties', detail: 'neutral build and mid-length hair, hard to immediately read as male or female; keep this neutral presentation CONSISTENT across all panels of this session', wrong: 'flipping between male in one panel and female in another, exaggerated masculine or feminine features' };

  const playerDesc = `${playerHardGender.body}; ${playerHardGender.detail}; dressed appropriately for the scene.`;

  const fullPrompt = `Render a single comic panel that contains TWO characters in the same frame: the friend "A" (from the input photo) and the player "YOU".

ART STYLE:
${styleDesc}

SCENE TO DEPICT:
${imagePrompt}

PLAYER GENDER (HARD CONSTRAINT — DO NOT IGNORE):
- The player character "YOU" in this panel MUST be ${playerHardGender.label}. The player is ${playerHardGender.body}.
- ${playerHardGender.detail}.
- The player's gender presentation MUST match the label above. Do NOT draw the player as ${playerHardGender.wrong}.
- This gender choice was made by the user at sign-up and is non-negotiable for every panel of this session — keep it identical from panel to panel.

CHARACTERS IN THE PANEL (BOTH must be visible):

[Character A — the friend, from the input photo]
- Recreate the person from the input photo as a stylized character in the scene.
- Face features (face shape, eyes, eyebrows, nose, mouth, skin tone, hairstyle) should be recognizable as the same individual from the input photo.
- Identity is preserved by facial FEATURES — do NOT copy the input photo's pose, head angle, framing or clothing. Body, outfit, and action follow THIS scene.
- A's gender is whatever the input photo shows — DO NOT override A's gender to match the player's.

[Character YOU — the player, NOT from the input photo]
- Appearance: ${playerDesc}
- Gender presentation: ${playerHardGender.label} (see HARD CONSTRAINT above).
- The PLAYER is a SEPARATE individual — face must NOT resemble character A. Treat them as a different person who appears alongside A in this panel.
- Outfit / pose / accessories should fit the scene. The player is the protagonist interacting with A.

INTERACTION:
- Show a clear interaction or relationship between A and YOU appropriate to the scene (facing each other, walking side by side, one challenging the other, one reacting to the other, etc.).
- BOTH faces / forms should be readable in the composition — don't crop one out, don't bury one in the background. Two-shot framing.

PER-PANEL HEAD & CAMERA ANGLE (HARD OVERRIDE — MOST IMPORTANT RULE):
- This panel MUST be rendered from this exact head/camera angle: ${headAngle}.
- The INPUT PHOTO's head orientation is IRRELEVANT to this panel and must be IGNORED for character A. Do not mirror, echo, or "snap to" the input photo's facial angle.
- Treat the input photo strictly as a reference for WHO character A is (facial identity), not for HOW they are oriented in this panel.

COMPOSITION (POSE & FRAMING MUST VARY ACROSS PANELS):
- Single comic / manga style panel, expressive and dramatic.
- Pick a body pose and action that fits THIS scene — running, swinging a weapon, casting a spell, leaning, peeking, kneeling, jumping, glancing back, etc.
- Across the sequence, vary camera distance (close-up / medium / wide / over-the-shoulder) AND head angle. Avoid defaulting to a centered head-and-shoulders portrait, and never repeat the previous panel's pose.
- Cinematic framing, strong lighting, vivid atmosphere matching the scene.

STRICT NO LIST:
- Do NOT draw the player with the WRONG gender. Player MUST be ${playerHardGender.label} (${playerHardGender.body}). Drawing a ${playerHardGender.wrong.split(',')[0].trim()} player is a HARD FAIL.
- Do NOT render any text, letters, numbers, words, logos, captions, speech bubbles, or symbols anywhere in the image.
- Do NOT add modern accessories that conflict with the scene's costume context.
- Do NOT make the player look like character A — they are two different people.
- Do NOT reuse the input photo's head/face orientation. Do NOT reuse the previous panel's pose.`;

  return withRetry('image-edits', async () => {
    // 每次重试都重建 form-data：FormData 内含的文件流是一次性的
    const form = new FormData();
    form.append('image', fs.createReadStream(orig.path), {
      filename: `original.${orig.ext}`,
      contentType: `image/${orig.ext === 'jpg' ? 'jpeg' : orig.ext}`,
    });
    form.append('prompt', fullPrompt);
    form.append('model', IMAGE_MODEL);
    form.append('size', '1024x1024');
    form.append('n', '1');
    // 加速：低质量档 + jpeg 输出，单帧能从 ~25s 砍到 ~10–15s，payload 也小一大截
    form.append('quality', 'low');
    form.append('output_format', 'jpeg');
    form.append('output_compression', '82');

    const t0 = Date.now();
    const response = await axios.post(
      `${API_BASE}/v1/images/edits`,
      form,
      {
        headers: { ...form.getHeaders(), Authorization: `Bearer ${API_KEY}` },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000,
      }
    );
    console.log(`[image-edits] ${IMAGE_MODEL} scene=${sceneIndex} took ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const item = response.data && response.data.data && response.data.data[0];
    if (!item) throw new Error('图像服务返回为空');

    if (item.b64_json) {
      return `data:image/jpeg;base64,${item.b64_json}`;
    }
    if (item.url) {
      const imgResp = await axios.get(item.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
      const b64 = Buffer.from(imgResp.data).toString('base64');
      return `data:image/jpeg;base64,${b64}`;
    }
    throw new Error('图像服务返回格式异常');
  }, { attempts: 5, baseDelayMs: 10000 });
}

function buildStoryMessages(session, { sceneIndex, isFinale }) {
  const ps = session.posterStyle === 'warm' ? 'warm' : 'prank';
  const isWarm = ps === 'warm';

  const themeMap  = themesFor(ps);
  const hintMap   = themeHintsFor(ps);
  const styleMap  = styleLabelsFor(ps);
  const themeHint  = hintMap[session.theme]   || hintMap[defaultThemeFor(ps)];
  const themeLabel = themeMap[session.theme]  || themeMap[defaultThemeFor(ps)];
  const styleLabel = styleMap[session.style]  || styleMap[defaultStyleFor(ps)];
  const aLabel = session.nickname
    ? `${session.name}（外号「${session.nickname}」）`
    : session.name;

  const summary = session.scenes.length === 0
    ? '（这是开场第一幕）'
    : session.scenes
        .map((s, i) => {
          const picked = (s.choices && s.choices[s.pickedIndex]) || '（未选择）';
          return `第${i + 1}幕：${s.narrative}\n  → 你选择了：${picked}`;
        })
        .join('\n');

  let task;
  if (isFinale) {
    if (isWarm) {
      task =
        `这是大结局。前面 ${session.scenes.length} 幕里"你"和 ${aLabel} 一起经历了一段温柔的小事，` +
        `请在终幕落到一个安静而温暖的瞬间：可以是回家路上的路灯、清晨第一缕光、互相说出一句平日里没说出口的话。` +
        `结尾要明确点出"原来只是一次共度的小日子"，让现实里两人的友谊更近一步。`;
    } else if (session.aWins) {
      task =
        `这是大结局。前面 ${session.scenes.length} 幕里"你"一路碾压 ${aLabel}，现在请来一个温暖的反转：` +
        `${aLabel} 在最后关头做出一个意外的可爱/体面/有担当的举动，让"你"在赢的同时也对 ${aLabel} 刮目相看。` +
        `叙述要给出明确的"出画/笑出声/友情升温"收束，让现实里两人感情更好。`;
    } else {
      task =
        `这是大结局，"你"完成了一次酣畅淋漓的高光时刻，${aLabel} 以一种好笑但仍有体面的方式收场（不能真的羞辱 ${aLabel}，只是朋友间的玩笑）。` +
        `结尾要点出"原来只是一次入画"，让现实里两人感情更好。`;
    }
    task += ' 终幕的 choices 字段必须输出空数组 []。';
  } else {
    if (isWarm) {
      task =
        `请生成第 ${sceneIndex + 1} / ${session.totalScenes} 幕。这是温暖之域风：你和 ${aLabel} 是好朋友，一起经历一件日常里的小事。` +
        `不要写"你比 ${aLabel} 更强"或"打脸/碾压/装到"这种胜负框架；写两个人一起做点什么、互相照顾、互相吐槽。每个选项 ≤ 14 字，三种风格各异（暖心 / 调皮 / 出人意料）。`;
    } else {
      task =
        `请生成第 ${sceneIndex + 1} / ${session.totalScenes} 幕。"你"必须比 ${aLabel} 更顺、更强、更有主角光环，` +
        `但口吻是朋友之间的玩笑——可以调侃，不能贬低。每个选项 ≤ 14 字，三种风格各异（稳健 / 作死 / 出其不意）。`;
    }
  }

  const sysIntro = isWarm
    ? '你是一名擅长写治愈系小短剧的中文编剧，正在为一款"朋友共度日常"的娱乐应用写分镜剧本。'
    : '你是一名擅长写中文短剧的网络爽文编剧，正在为一款"朋友互怼"的娱乐应用写分镜剧本。';

  const worldLine = isWarm
    ? `世界观背景：玩家用一台魔法相机把好朋友 ${aLabel} 拽进了照片中的一段温暖小日常——相机只是入口，落到剧情里之后**不需要继续提到相机或拍照这件事**。叙述用第二人称"你"指代玩家本人，"你"是这段温暖小剧的主角，画面里会同时出现"你"和 ${aLabel}。`
    : `世界观背景：玩家用一台魔法相机把朋友 ${aLabel} 拽进了照片中的平行世界——相机只是入口，落到剧情里之后**不需要继续提到相机或拍照这件事**。叙述用第二人称"你"指代玩家本人，"你"是这段剧情的主角，画面里会同时出现"你"和 ${aLabel}。`;

  const openLine = sceneIndex === 0
    ? (isWarm
        ? `开场第一幕需要一个明确的"入画引子"：交代你刚走进这张照片里的小世界，迅速点出 ${aLabel} 在这个温暖场景里的身份/状态（例如：在咖啡馆等你、坐在毕业典礼前排、抱着行李在火车站台），让观众一眼明白这是哪一段温暖的小日常。`
        : `开场第一幕需要一个明确的"入画引子"：交代你刚从现实坠入这张照片的平行世界，迅速点出 ${aLabel} 在这个世界里的身份/位置（例如：这是宫斗剧的话他/她是某位皇子/某位侍卫；穿越的话他/她已经成了某个NPC；探案的话他/她是嫌犯/同侦探等等），让观众一眼明白现在身处什么故事里。`)
    : '继续推进剧情，不要再重复入画的设定，也不要再提相机/拍照。';

  const goodwillLine = isWarm
    ? `调侃 ${aLabel} 时要带十足的善意，可以互相揶揄但绝不贬低，最终目标是让两个人的友谊更近一步。`
    : `调侃 ${aLabel} 时要带善意，最终目标是增进现实里两人的友谊。`;

  const choiceFlavorHint = isWarm
    ? `（例如「替${session.name}撑伞」「给${session.name}留半块蛋糕」）`
    : `（例如「踹翻${session.name}的桌子」「替${session.name}挡一刀」）`;

  const cameraVariety = isWarm
    ? '回眸微笑、低头搅咖啡、靠窗远望、并肩走路、侧身递东西、抬手指向远方等'
    : '奔跑、挥剑、施法、回眸、俯视、仰拍、过肩、特写、跪姿、跳跃等';

  const narrativeMoodLine = isWarm
    ? '画面温暖、有生活质感'
    : '戏剧化、带网感';

  const sys = `${sysIntro}
当前主题：${themeLabel} —— ${themeHint}
画风提示（仅供你脑补氛围，不需要写进 narrative）：${styleLabel}

${worldLine}

${openLine}

硬性要求：
- 每幕 narrative 用**第二人称中文**（"你抬眼…"、"你冷笑一声…"），2-4 句话，画面感强、${narrativeMoodLine}。叙述里不要再出现"我"。
- **narrative 中必须至少出现 2 次「${session.name}」这个名字**（直接写名字，而不是只用"他/她/对方/那家伙"代称）。${session.nickname ? `也可以穿插使用外号「${session.nickname}」，但「${session.name}」这个本名出现次数必须 ≥ 2。` : ''}名字要自然嵌进句子里，像朋友间叫对方那样脱口而出，不要硬塞、不要堆叠成"${session.name}${session.name}"这种重复。
- 三个 choices 里至少要有 1 条把「${session.name}」直接写进去${choiceFlavorHint}，其他选项可以不带名字。选项用第二人称口吻，主语是"你"。
- ${goodwillLine}
- imagePrompt 用英文一句话，描述本幕画面里"the player (you)"和 ${session.name} **两个人**的穿着/动作/姿态/相对位置/环境/情绪，不要出现任何文字或标志。两人都要在画面里。
- imagePrompt 必须明确写出本幕的头部朝向和镜头角度（front view / three-quarter / profile / over-the-shoulder / low-angle / two-shot 等），且每幕都不一样。可以是${cameraVariety}。
- 严格只输出符合下述结构的 JSON，不要任何多余解释或 Markdown。`;

  const user = `${task}

前情提要：
${summary}

请严格输出以下 JSON：
{
  "narrative": "本幕第二人称中文叙述（主语用「你」，不要出现「我」）",
  "imagePrompt": "English visual description of the panel showing BOTH the player (you) and ${session.name} together, single sentence, no text in image",
  "choices": ["选项A（≤14字）", "选项B（≤14字）", "选项C（≤14字）"]
}`;

  return [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];
}

app.post('/api/story/start', async (req, res) => {
  try {
    const { hash, name, nickname, theme, style, gender, posterStyle } = req.body || {};
    if (!hash) return res.status(400).json({ error: '缺少照片标识 hash' });
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: '缺少姓名' });
    }
    if (!findOriginalByHash(hash)) {
      return res
        .status(404)
        .json({ error: '原始照片未找到，请回到上一步重新生成通缉令。' });
    }

    // 整蛊 / 温暖 决定使用哪一套 theme/style 集合
    const ps = posterStyle === 'warm' ? 'warm' : 'prank';
    const themeMap  = themesFor(ps);
    const styleMap  = stylePromptsFor(ps);

    const sessionId = newSessionId();
    const session = {
      id: sessionId,
      hash,
      name: String(name).trim(),
      nickname: (nickname || '').trim(),
      gender: VALID_GENDERS.has(gender) ? gender : 'x',  // 玩家"我"自己的性别
      posterStyle: ps,
      theme: themeMap[theme] ? theme : defaultThemeFor(ps),
      style: styleMap[style] ? style : defaultStyleFor(ps),
      scenes: [],
      totalScenes: 3,           // 3 互动幕 + 1 终幕
      aWins: ps === 'warm' ? false : (Math.random() < 0.10),  // 温暖之域不用 aWins
      createdAt: Date.now(),
      touchedAt: Date.now(),
    };
    sessionStore.set(sessionId, session);

    // 先查永久缓存
    const cacheKey = storyCacheKey(session.hash, session.theme, session.style, [], session.name, session.nickname, session.gender, session.posterStyle);
    const cached = readStoryCache(cacheKey);
    let sceneEntry;
    if (cached) {
      console.log(`[story-cache] HIT  ${cacheKey}`);
      sceneEntry = {
        narrative: cached.narrative,
        imagePrompt: cached.imagePrompt,
        choices: cached.choices,
        image: cached.image,
        isFinale: false,
        pickedIndex: -1,
      };
      session.scenes.push(sceneEntry);
    } else {
      console.log(`[story-cache] MISS ${cacheKey}`);
      // 文字先跑完，立即返回；图像挂后台 Promise，前端再来拉
      const messages = buildStoryMessages(session, { sceneIndex: 0, isFinale: false });
      const sceneData = await generateText(messages);
      sceneEntry = {
        narrative: sceneData.narrative,
        imagePrompt: sceneData.imagePrompt,
        choices: Array.isArray(sceneData.choices) ? sceneData.choices.slice(0, 3) : [],
        image: null,
        isFinale: false,
        pickedIndex: -1,
        _cacheKey: cacheKey,
      };
      session.scenes.push(sceneEntry);
      kickoffSceneImage(session, sceneEntry, 0);
    }

    res.json({
      sessionId,
      sceneIndex: 0,
      totalScenes: session.totalScenes,
      isFinale: false,
      themeLabel: themesFor(session.posterStyle)[session.theme],
      styleLabel: styleLabelsFor(session.posterStyle)[session.style],
      scene: {
        narrative: sceneEntry.narrative,
        choices: sceneEntry.choices,
        image: sceneEntry.image,
        imageReady: !!sceneEntry.image,
      },
    });
  } catch (err) {
    const detail =
      (err.response && err.response.data) || err.message || String(err);
    console.error('[story/start] error:', detail);
    return res
      .status(500)
      .json({ error: '剧情开局失败', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

// 把场景图像挂成后台 Promise。caller 先 push scene 再调本函数，这样
// getChoicePath(session) 拿到的就是当前应有的选择路径。
function kickoffSceneImage(session, scene, sceneIndex) {
  const choicePath = getChoicePath(session);
  scene._imagePromise = generateSceneImage({
    hash: session.hash,
    imagePrompt: scene.imagePrompt,
    styleKey: session.style,
    sceneIndex,
    choicePath,
    gender: session.gender,
    posterStyle: session.posterStyle,
  }).then((image) => {
    scene.image = image;
    if (scene._cacheKey) {
      writeStoryCache(scene._cacheKey, {
        narrative: scene.narrative,
        imagePrompt: scene.imagePrompt,
        choices: scene.choices,
        isFinale: scene.isFinale,
        aWins: scene.aWins,
        image,
      });
    }
    return image;
  });
  // 防止没人 poll 时 unhandled rejection 把 node 干掉
  scene._imagePromise.catch((err) => {
    scene._imageError = err;
  });
}

// 长轮询：前端在拿到 narrative 后调这个接口等图
app.get('/api/story/scene-image', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const sceneIndex = parseInt(req.query.sceneIndex, 10);
    const session = sessionStore.get(sessionId);
    if (!session) return res.status(404).json({ error: '会话已过期，请重新开始剧情。' });
    if (!Number.isFinite(sceneIndex) || sceneIndex < 0 || sceneIndex >= session.scenes.length) {
      return res.status(404).json({ error: '场景不存在' });
    }
    session.touchedAt = Date.now();
    const scene = session.scenes[sceneIndex];
    if (scene.image) return res.json({ image: scene.image });
    if (!scene._imagePromise) {
      return res.status(500).json({ error: '该场景没有进行中的图像生成任务' });
    }
    const image = await scene._imagePromise;
    return res.json({ image });
  } catch (err) {
    const detail = (err.response && err.response.data) || err.message || String(err);
    console.error('[story/scene-image] error:', detail);
    return res.status(500).json({
      error: '图像生成失败',
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  }
});

app.post('/api/story/next', async (req, res) => {
  try {
    const { sessionId, choiceIndex } = req.body || {};
    const session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: '会话已过期，请重新开始剧情。' });
    }
    session.touchedAt = Date.now();

    const lastScene = session.scenes[session.scenes.length - 1];
    if (lastScene) {
      const ci = Number(choiceIndex);
      if (
        Number.isFinite(ci) &&
        ci >= 0 &&
        ci < ((lastScene.choices && lastScene.choices.length) || 0)
      ) {
        lastScene.pickedIndex = ci;
      } else {
        lastScene.pickedIndex = 0;
      }
    }

    const nextIndex = session.scenes.length;
    // 前 totalScenes 幕是互动幕；第 totalScenes 幕（含）开始是终幕
    const isFinale = nextIndex >= session.totalScenes;

    // 先查永久缓存（键含当前已选的 choicePath）
    const cacheKey = storyCacheKey(
      session.hash,
      session.theme,
      session.style,
      getChoicePath(session),
      session.name,
      session.nickname,
      session.gender,
      session.posterStyle
    );
    const cached = readStoryCache(cacheKey);
    let sceneEntry;
    if (cached) {
      console.log(`[story-cache] HIT  ${cacheKey}`);
      // 终幕缓存里包含 aWins，按缓存覆盖，保证 payload 文案与画面一致
      if (cached.isFinale && typeof cached.aWins === 'boolean') {
        session.aWins = cached.aWins;
      }
      sceneEntry = {
        narrative: cached.narrative,
        imagePrompt: cached.imagePrompt,
        choices: cached.choices,
        image: cached.image,
        isFinale,
        pickedIndex: -1,
      };
      if (isFinale) sceneEntry.aWins = session.aWins;
      session.scenes.push(sceneEntry);
    } else {
      console.log(`[story-cache] MISS ${cacheKey}`);
      const messages = buildStoryMessages(session, {
        sceneIndex: nextIndex,
        isFinale,
      });
      const sceneData = await generateText(messages);
      sceneEntry = {
        narrative: sceneData.narrative,
        imagePrompt: sceneData.imagePrompt,
        choices: Array.isArray(sceneData.choices) ? sceneData.choices.slice(0, 3) : [],
        image: null,
        isFinale,
        pickedIndex: -1,
        _cacheKey: cacheKey,
      };
      if (isFinale) sceneEntry.aWins = session.aWins;
      session.scenes.push(sceneEntry);
      kickoffSceneImage(session, sceneEntry, nextIndex);
    }

    const payload = {
      sessionId,
      sceneIndex: nextIndex,
      totalScenes: session.totalScenes,
      isFinale,
      scene: {
        narrative: sceneEntry.narrative,
        choices: isFinale ? [] : sceneEntry.choices,
        image: sceneEntry.image,
        imageReady: !!sceneEntry.image,
      },
    };

    if (isFinale) {
      payload.aWins = session.aWins;
      // 不再返回 allScenes：前端用自己的 state.scenes（已经通过 /scene-image 拉齐图）
    }

    res.json(payload);
  } catch (err) {
    const detail =
      (err.response && err.response.data) || err.message || String(err);
    console.error('[story/next] error:', detail);
    return res
      .status(500)
      .json({ error: '剧情推进失败', detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  }
});

app.listen(PORT, () => {
  console.log(`咔嚓剧场 → http://localhost:${PORT}`);
});
