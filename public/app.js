const $ = (id) => document.getElementById(id);

const els = {
  // 第一部分
  form: $('form'),
  formSection: $('formSection'),
  uploadArea: $('uploadArea'),
  uploadPlaceholder: $('uploadPlaceholder'),
  uploadExampleTag: $('uploadExampleTag'),
  image: $('image'),
  preview: $('preview'),
  name: $('name'),
  nickname: $('nickname'),
  submitBtn: $('submitBtn'),
  loading: $('loading'),
  resultSection: $('resultSection'),
  poster: $('poster'),
  posterImage: $('posterImage'),
  posterName: $('posterName'),
  posterNickname: $('posterNickname'),
  posterCrime: $('posterCrime'),
  posterLevel: $('posterLevel'),
  posterBounty: $('posterBounty'),
  posterStatus: $('posterStatus'),
  posterSuggestion: $('posterSuggestion'),
  downloadBtn: $('downloadBtn'),
  restartBtn: $('restartBtn'),
  errorBox: $('errorBox'),

  // 第二部分
  enterDreamBtn: $('enterDreamBtn'),
  storySetup: $('storySetup'),
  startStoryBtn: $('startStoryBtn'),
  backToPosterBtn: $('backToPosterBtn'),
  storyOpening: $('storyOpening'),
  openingSubject: $('openingSubject'),
  openingThemeLabel: $('openingThemeLabel'),
  openingStyleLabel: $('openingStyleLabel'),
  storyScene: $('storyScene'),
  sceneChapter: $('sceneChapter'),
  sceneTheme: $('sceneTheme'),
  scenePanel: $('scenePanel'),
  sceneImage: $('sceneImage'),
  sceneNarrative: $('sceneNarrative'),
  choices: $('choices'),
  storyProgress: $('storyProgress'),
  storyFinale: $('storyFinale'),
  comicStrip: $('comicStrip'),
  finaleSub: $('finaleSub'),
  downloadComicBtn: $('downloadComicBtn'),
  replayStoryBtn: $('replayStoryBtn'),
  finaleResetBtn: $('finaleResetBtn'),
  openingLoader: $('openingLoader'),
  openingLoaderSub: $('openingLoaderSub'),
  panelLoader: $('panelLoader'),
  panelLoaderText: $('panelLoaderText'),
  panelLoaderSub: $('panelLoaderSub'),
  wakeOverlay: $('wakeOverlay'),
};

const allSections = [
  els.formSection, els.loading, els.resultSection,
  els.storySetup, els.storyOpening, els.storyScene, els.storyFinale,
  els.errorBox,
].filter(Boolean);

function showOnly(section) {
  allSections.forEach((el) => { if (el) el.hidden = el !== section; });
  if (section) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const phone = document.querySelector('.phone-screen');
    if (phone && typeof phone.scrollTo === 'function') {
      phone.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

const THEME_CN = {
  // 整蛊风
  gongdou: '宫斗剧', chuanyue: '穿越重生', xuanyi: '悬疑探案',
  dalian: '打　脸', shuangwen: '爽　文',
  // 温暖之域
  zhiyu: '治愈日常', tonghua: '童话奇遇', xiaoyuan: '校园回忆',
  lvtu: '旅途同行', jieri: '节日温馨',
};
const STYLE_CN = {
  // 整蛊风
  lianyu: '恋与深空', bluelock: '蓝色监狱', xianni: '仙　逆',
  // 温暖之域
  ghibli: '吉卜力', shinkai: '新海诚', picturebook: '绘本水彩',
};

// 第二部分主题 / 画风按 posterStyle 分两套
const THEME_DEFS = {
  prank: [
    { id: 'gongdou',   cn: '宫斗剧',   hint: '深宫心计，杯盏藏刀' },
    { id: 'chuanyue',  cn: '穿越重生', hint: '魂回古今，开挂逆袭' },
    { id: 'xuanyi',    cn: '悬疑探案', hint: '阴雨长巷，蛛丝马迹' },
    { id: 'dalian',    cn: '打　脸',   hint: '先被小看，后被惊呼' },
    { id: 'shuangwen', cn: '爽　文',   hint: '一路碾压，装到爽到' },
  ],
  warm: [
    { id: 'zhiyu',    cn: '治愈日常', hint: '热茶 · 慵懒午后' },
    { id: 'tonghua',  cn: '童话奇遇', hint: '绘本里的小冒险' },
    { id: 'xiaoyuan', cn: '校园回忆', hint: '操场 · 毕业册 · 蝉鸣' },
    { id: 'lvtu',     cn: '旅途同行', hint: '车窗 · 夕阳 · 海岸' },
    { id: 'jieri',    cn: '节日温馨', hint: '灯火 · 烟花 · 小礼物' },
  ],
};
const STYLE_DEFS = {
  prank: [
    { id: 'lianyu',   cn: '恋与深空', hint: '乙游 · 柔光晕染' },
    { id: 'bluelock', cn: '蓝色监狱', hint: '运动番 · 锋利线条' },
    { id: 'xianni',   cn: '仙　逆',   hint: '仙侠 · 流光水墨' },
  ],
  warm: [
    { id: 'ghibli',      cn: '吉卜力',   hint: '水彩自然 · 风与光' },
    { id: 'shinkai',     cn: '新海诚',   hint: '高饱和天空 · 城市夜' },
    { id: 'picturebook', cn: '绘本水彩', hint: '平涂柔色 · 童趣线条' },
  ],
};

// 全局状态
const state = {
  hash: null,
  name: '',
  nickname: '',
  posterStyle: 'prank',     // prank | warm
  gender: 'x',              // m | f | x
  theme: 'shuangwen',
  style: 'lianyu',
  sessionId: null,
  scenes: [], // 已确定的幕（带 chosenIndex）
  posterImageUrl: '',
  usingDefaultImage: true,  // 未上传时使用 /example-photo.jpg（命中演示缓存）
};

const DEFAULT_EXAMPLE_IMAGE_URL = '/example-photo.jpg';
const DEFAULT_EXAMPLE_FILENAME = '示例图片.small.jpg';

const POSTER_STYLE_PRESET = {
  prank: {
    submitCn: '立　案　通　緝',
    submitMark: '緝',
    posterEn: 'WANTED',
    posterZh: '通　緝　状',
    verticalTitle: ['人', '相', '書'],
    verticalSub:   ['影', '域', '奉', '行', '所'],
    fieldKeys: ['罪　状', '危險之等', '懸　賞', '當下狀', '處置之策'],
  },
  warm: {
    submitCn: '印　一　张　暖　卡',
    submitMark: '暖',
    posterEn: 'WARMTH',
    posterZh: '暖　光　纪　事',
    verticalTitle: ['暖', '光', '記'],
    verticalSub:   ['日', '光', '小', '室'],
    fieldKeys: ['主　題　詞', '暖意之度', '心　情　值', '當下感受', '入域指引'],
  },
};

/* ========================================================
   第一部分（保持原有逻辑）
   ======================================================== */

// 风格 chip（整蛊 / 温暖 / 自定义）
document.querySelectorAll('.poster-style-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    document.querySelectorAll('.poster-style-chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.posterStyle = btn.dataset.posterStyle;
    applySubmitButtonText();
  });
});

// 性别 chip
document.querySelectorAll('.gender-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.gender = btn.dataset.gender;
  });
});

function applySubmitButtonText() {
  const preset = POSTER_STYLE_PRESET[state.posterStyle] || POSTER_STYLE_PRESET.prank;
  const cn = els.submitBtn.querySelector('.btn-cn');
  const mk = els.submitBtn.querySelector('.btn-mark');
  if (cn) cn.textContent = preset.submitCn;
  if (mk) mk.textContent = preset.submitMark;
}
applySubmitButtonText();
els.image.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    els.preview.src = reader.result;
    els.preview.hidden = false;
    els.uploadPlaceholder.style.display = 'none';
    if (els.uploadExampleTag) els.uploadExampleTag.hidden = true;
    state.usingDefaultImage = false;
  };
  reader.readAsDataURL(file);
});

['dragenter', 'dragover'].forEach((evt) => {
  els.uploadArea.addEventListener(evt, (e) => {
    e.preventDefault();
    els.uploadArea.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach((evt) => {
  els.uploadArea.addEventListener(evt, (e) => {
    e.preventDefault();
    els.uploadArea.classList.remove('dragover');
  });
});
els.uploadArea.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  els.image.files = e.dataTransfer.files;
  els.image.dispatchEvent(new Event('change'));
});

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let file = els.image.files[0];
  const name = els.name.value.trim();
  const nickname = els.nickname.value.trim();

  if (!name) { alert('请输入姓名'); return; }

  // 用户没自选文件 → 用默认示例图（命中演示缓存）
  if (!file) {
    try {
      const resp = await fetch(DEFAULT_EXAMPLE_IMAGE_URL);
      if (!resp.ok) throw new Error('默认示例图加载失败');
      const blob = await resp.blob();
      file = new File([blob], DEFAULT_EXAMPLE_FILENAME, { type: blob.type || 'image/jpeg' });
    } catch (err) {
      alert('请上传一张照片');
      return;
    }
  }

  const fd = new FormData();
  fd.append('image', file);
  fd.append('name', name);
  fd.append('nickname', nickname);
  fd.append('style', state.posterStyle);
  fd.append('gender', state.gender);

  showOnly(els.loading);

  try {
    const resp = await fetch('/api/generate-poster', { method: 'POST', body: fd });
    const data = await resp.json();
    if (!resp.ok) throw data;

    state.hash = data.hash;
    state.name = name;
    state.nickname = nickname;
    state.posterStyle = data.style || state.posterStyle;
    state.gender = data.gender || state.gender;
    state.posterImageUrl = data.image;

    renderPoster(data);
    showOnly(els.resultSection);
    els.poster.classList.remove('stamped');
    requestAnimationFrame(() => {
      setTimeout(() => els.poster.classList.add('stamped'), 700);
    });
  } catch (err) {
    showError(err);
  }
});

function renderPoster({ image, poster, style }) {
  const mode = style || state.posterStyle || 'prank';
  const preset = POSTER_STYLE_PRESET[mode] || POSTER_STYLE_PRESET.prank;

  // 暖系切换
  els.poster.classList.toggle('warm-mode', mode === 'warm');

  // 顶部 / 竖排标题
  const posterEnEl = els.poster.querySelector('.poster-en');
  const posterZhEl = els.poster.querySelector('.poster-zh');
  if (posterEnEl) posterEnEl.textContent = preset.posterEn;
  if (posterZhEl) posterZhEl.textContent = preset.posterZh;

  const vTitle = els.poster.querySelector('.poster-vertical-title');
  if (vTitle) {
    vTitle.innerHTML = preset.verticalTitle.map((c) => `<span>${c}</span>`).join('');
  }
  const vSub = els.poster.querySelector('.poster-vertical-sub');
  if (vSub) {
    vSub.innerHTML = preset.verticalSub.map((c) => `<span>${c}</span>`).join('');
  }

  // 字段标签 .k
  const keyEls = els.poster.querySelectorAll('.poster-fields li .k');
  keyEls.forEach((el, i) => {
    if (preset.fieldKeys[i]) el.textContent = preset.fieldKeys[i];
  });

  // 内容
  els.posterImage.src = image;
  els.posterName.textContent = poster.name;
  els.posterNickname.textContent = poster.nickname || '';
  els.posterCrime.textContent = poster.crime;
  if (mode === 'warm') {
    els.posterLevel.textContent = poster.dangerLevel;                   // ★★★★ 直接显示
    els.posterBounty.textContent = `${poster.bounty}　分`;
  } else {
    els.posterLevel.textContent = `${poster.dangerLevel}　等`;
    els.posterBounty.textContent = `${poster.bounty.toLocaleString('zh-CN')} 文`;
  }
  els.posterStatus.textContent = poster.status;
  els.posterSuggestion.textContent = poster.suggestion;

  // 暖系：AI 看图说的一句话（只在 warm 模式 + 有 blessing 时显示）
  const blessingEl = els.poster.querySelector('.warm-blessing');
  if (blessingEl) {
    if (mode === 'warm' && poster.blessing) {
      blessingEl.querySelector('.warm-blessing-text').textContent = poster.blessing;
      blessingEl.hidden = false;
    } else {
      blessingEl.hidden = true;
    }
  }
}

function reset() {
  els.form.reset();
  // 恢复默认示例图（保持上传区不空白）
  els.preview.src = DEFAULT_EXAMPLE_IMAGE_URL;
  els.preview.hidden = false;
  els.uploadPlaceholder.style.display = 'none';
  if (els.uploadExampleTag) els.uploadExampleTag.hidden = false;
  state.usingDefaultImage = true;
  els.poster.classList.remove('stamped');
  state.hash = null;
  state.sessionId = null;
  state.scenes = [];
  showOnly(els.formSection);
}
els.restartBtn.addEventListener('click', reset);
if (els.finaleResetBtn) els.finaleResetBtn.addEventListener('click', reset);

els.downloadBtn.addEventListener('click', async () => {
  els.downloadBtn.disabled = true;
  const original = els.downloadBtn.innerHTML;
  els.downloadBtn.textContent = '生成中…';
  try {
    const canvas = await html2canvas(els.poster, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const link = document.createElement('a');
    link.download = `通缉令_${els.posterName.textContent}_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (e) {
    alert('下载失败：' + (e && e.message));
  } finally {
    els.downloadBtn.disabled = false;
    els.downloadBtn.innerHTML = original;
  }
});

/* ========================================================
   错误展示
   ======================================================== */
function showError(err) {
  const msg = (err && err.error) || (err && err.message) || '未知错误';
  const detail = err && err.detail
    ? (typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail, null, 2))
    : '';
  els.errorBox.innerHTML = `
    <div class="err-title">${msg}</div>
    <pre>${escapeHtml(detail)}</pre>
    <button id="errBackBtn" class="secondary">
      <span class="btn-cn">回　頭　再　試</span>
    </button>
  `;
  showOnly(els.errorBox);
  const back = document.getElementById('errBackBtn');
  if (back) back.addEventListener('click', () => {
    if (state.scenes.length === 0 && !state.sessionId) {
      // 出错在通缉令阶段或更早
      if (state.posterImageUrl) showOnly(els.resultSection);
      else reset();
    } else if (els.storyFinale.hidden === false) {
      showOnly(els.resultSection);
    } else {
      // 剧情阶段出错 → 回到选剧情
      showOnly(els.storySetup);
    }
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ========================================================
   第二部分 · 进入照片中的平行世界
   ======================================================== */

els.enterDreamBtn.addEventListener('click', () => {
  if (!state.hash) { alert('请先生成通缉令'); return; }
  renderSetupChips();
  showOnly(els.storySetup);
});

els.backToPosterBtn.addEventListener('click', () => {
  showOnly(els.resultSection);
});

// 第二部分 chip 事件委托 — 容器一直在，innerHTML 重建后仍有效
const themeGridEl = document.getElementById('themeGrid');
const styleGridEl = document.getElementById('styleGrid');
themeGridEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-chip');
  if (!btn || !themeGridEl.contains(btn)) return;
  themeGridEl.querySelectorAll('.theme-chip').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.theme = btn.dataset.theme;
});
styleGridEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.style-chip');
  if (!btn || !styleGridEl.contains(btn)) return;
  styleGridEl.querySelectorAll('.style-chip').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  state.style = btn.dataset.style;
});

// 按 state.posterStyle 渲染主题/画风 chip，并把 state.theme/style 重置为该模式的第一个
function renderSetupChips() {
  const ps = state.posterStyle === 'warm' ? 'warm' : 'prank';
  const themes = THEME_DEFS[ps];
  const styles = STYLE_DEFS[ps];

  themeGridEl.innerHTML = themes.map((t) => `
    <button type="button" class="chip theme-chip" data-theme="${t.id}">
      <span class="chip-cn">${t.cn}</span>
      <span class="chip-hint">${t.hint}</span>
    </button>
  `).join('');
  styleGridEl.innerHTML = styles.map((s) => `
    <button type="button" class="chip style-chip" data-style="${s.id}">
      <span class="chip-cn">${s.cn}</span>
      <span class="chip-hint">${s.hint}</span>
    </button>
  `).join('');

  // 切到该模式的首个主题/画风
  state.theme = themes[0].id;
  state.style = styles[0].id;
  themeGridEl.querySelector(`[data-theme="${state.theme}"]`).classList.add('active');
  styleGridEl.querySelector(`[data-style="${state.style}"]`).classList.add('active');

  // 文案随风格切换
  const setupSub = document.getElementById('setupSub');
  if (setupSub) {
    setupSub.textContent = ps === 'warm'
      ? '挑一段日常，挑一种画风，和他/她一起入画喝杯热的'
      : '挑一段故事，挑一种画风，把他/她拽进照片里';
  }
}

els.startStoryBtn.addEventListener('click', startStory);

async function startStory() {
  // 1. 播放开场动画
  els.openingSubject.style.backgroundImage = `url(${state.posterImageUrl})`;
  els.openingThemeLabel.textContent = THEME_CN[state.theme] || '';
  els.openingStyleLabel.textContent = STYLE_CN[state.style] || '';
  els.openingLoader.hidden = true;
  showOnly(els.storyOpening);

  // 2. 同时向后端请求开局
  const startPromise = fetch('/api/story/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hash: state.hash,
      name: state.name,
      nickname: state.nickname,
      gender: state.gender,
      posterStyle: state.posterStyle,
      theme: state.theme,
      style: state.style,
    }),
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw d;
    return d;
  });

  // 3. 咔嚓动画播完 ~2.8 秒后，浮起 "影域凝聚中" 等待层
  const loaderTimer = setTimeout(() => {
    els.openingLoader.hidden = false;
    startLoaderHints(els.openingLoaderSub, [
      '画师正在落笔，文字先到',
      `${state.name} 的角色正在登场…`,
      '正在为这一幕铺光、铺色…',
      '影中主角已就位，等待入场…',
    ]);
  }, 2800);

  // 后端文字大约 ~5s 就回；图像挂在后台慢慢出。我们等"动画播完 + 文字到位"
  // 两边都 ready 后再切到场景视图（场景视图里图位会继续等图）。
  const minOpeningPromise = new Promise((res) => setTimeout(res, 2800));

  state.scenes = [];

  try {
    const [data] = await Promise.all([startPromise, minOpeningPromise]);
    clearTimeout(loaderTimer);
    stopLoaderHints();
    await new Promise((res) => setTimeout(res, 300));
    state.sessionId = data.sessionId;
    enterScene(data);
  } catch (err) {
    clearTimeout(loaderTimer);
    stopLoaderHints();
    showError(err);
  }
}

// 在 loader 副文案上轮播提示
let _hintTimer = null;
function startLoaderHints(el, hints) {
  if (!el || !hints || hints.length === 0) return;
  let i = 0;
  el.textContent = hints[0];
  stopLoaderHints();
  _hintTimer = setInterval(() => {
    i = (i + 1) % hints.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = hints[i];
      el.style.opacity = '';
    }, 220);
  }, 3200);
}
function stopLoaderHints() {
  if (_hintTimer) { clearInterval(_hintTimer); _hintTimer = null; }
}

function enterScene(data) {
  // data: { sceneIndex, totalScenes, isFinale, scene: {narrative, choices, image, imageReady}, aWins? }
  showOnly(els.storyScene);
  renderScene(data);

  const entry = {
    narrative: data.scene.narrative,
    image: data.scene.image || null,
    choices: data.isFinale ? [] : (data.scene.choices || []),
    chosenIndex: -1,
    isFinale: !!data.isFinale,
    sceneIndex: data.sceneIndex,
    aWins: data.aWins,  // 仅终幕有
  };
  state.scenes.push(entry);

  if (data.scene.imageReady && entry.image) {
    if (entry.isFinale) scheduleFinaleTransition(entry);
  } else {
    // 文字已到位、图还在路上：后台拉图，回来再淡入
    fetchAndApplyImage(entry);
  }
}

async function fetchAndApplyImage(entry) {
  try {
    const resp = await fetch(
      `/api/story/scene-image?sessionId=${encodeURIComponent(state.sessionId)}&sceneIndex=${entry.sceneIndex}`
    );
    const body = await resp.json();
    if (!resp.ok) throw body;
    entry.image = body.image;
    // 用户还停在这一幕才更新画面（race：用户已点下一幕的话就让它静默落地）
    if (state.scenes[state.scenes.length - 1] === entry) {
      revealSceneImage(body.image);
      if (entry.isFinale) scheduleFinaleTransition(entry);
    }
  } catch (err) {
    if (state.scenes[state.scenes.length - 1] === entry) {
      stopLoaderHints();
      els.panelLoader.hidden = true;
      els.scenePanel.classList.remove('loading');
      showError(err);
    } else {
      console.warn('[image-poll] background image fetch failed', err);
    }
  }
}

function revealSceneImage(src) {
  stopLoaderHints();
  els.panelLoader.hidden = true;
  els.scenePanel.classList.remove('loading');
  els.sceneImage.src = src;
  els.sceneImage.classList.remove('panel-img-in');
  void els.sceneImage.offsetWidth;
  els.sceneImage.classList.add('panel-img-in');
}

function scheduleFinaleTransition(entry) {
  setTimeout(() => {
    const allScenes = state.scenes.map((s) => ({
      narrative: s.narrative, image: s.image,
    }));
    playWakeTransition(() => renderFinale(allScenes, entry.aWins));
  }, 2400);
}

function renderScene({ sceneIndex, totalScenes, isFinale, scene }) {
  const total = totalScenes + 1; // 含终幕
  const current = sceneIndex + 1;
  const chapters = ['壹', '貳', '參', '肆', '伍', '陸'];
  els.sceneChapter.textContent = isFinale
    ? '終　幕'
    : `第　${chapters[sceneIndex] || (sceneIndex + 1)}　幕`;
  els.sceneTheme.textContent = `${THEME_CN[state.theme] || ''} · ${STYLE_CN[state.style] || ''}`;

  if (scene.image) {
    stopLoaderHints();
    els.panelLoader.hidden = true;
    els.scenePanel.classList.remove('loading');
    els.sceneImage.src = scene.image;
    // 重新触发图片入场动画
    els.sceneImage.classList.remove('panel-img-in');
    void els.sceneImage.offsetWidth;
    els.sceneImage.classList.add('panel-img-in');
  } else {
    // 文字先到、图还在路上：图位放骨架/loader，叙述和选项照常显示
    els.sceneImage.removeAttribute('src');
    els.scenePanel.classList.add('loading');
    els.panelLoader.hidden = false;
    els.panelLoaderText.textContent = isFinale ? '影像收束中' : '画师作画中';
    startLoaderHints(els.panelLoaderSub, [
      '影像正在显影，约十至二十秒',
      `${state.name} 这一幕的角色正在登场…`,
      '正在为这一幕铺光、铺色…',
      '剧情画面即将落定…',
    ]);
  }

  els.sceneNarrative.textContent = scene.narrative;

  // 进度条
  const pct = Math.min(100, Math.round((current / total) * 100));
  els.storyProgress.style.width = pct + '%';

  // 选项
  els.choices.innerHTML = '';
  if (isFinale || !scene.choices || scene.choices.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'finale-tip';
    tip.style.cssText = 'text-align:center;padding:14px;font-family:var(--f-mincho);letter-spacing:4px;color:var(--shu);font-weight:700;';
    tip.textContent = '· 終 ·';
    els.choices.appendChild(tip);
  } else {
    const marks = ['壹', '貳', '參'];
    scene.choices.forEach((text, idx) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.innerHTML = `<span class="choice-mark">${marks[idx] || (idx + 1)}</span>${escapeHtml(text)}`;
      btn.addEventListener('click', () => pickChoice(idx, btn));
      els.choices.appendChild(btn);
    });
  }
}

async function pickChoice(index, btn) {
  // 锁定所有选项，高亮选中
  const buttons = els.choices.querySelectorAll('.choice');
  buttons.forEach((b) => b.classList.add('disabled'));
  if (btn) btn.classList.add('picked');

  // 记录用户选择
  const last = state.scenes[state.scenes.length - 1];
  if (last) last.chosenIndex = index;

  // 文字 gen 这段先把面板罩起来；text 回来后 renderScene 会按需保留/解除 loader
  els.scenePanel.classList.add('loading');
  els.panelLoader.hidden = false;
  els.panelLoaderText.textContent =
    state.scenes.length >= 3 ? '影像收束中' : '画师作画中';
  startLoaderHints(els.panelLoaderSub, [
    '影像正在显影，约十至二十秒',
    `${state.name} 这一幕的角色正在登场…`,
    '正在为这一幕铺光、铺色…',
    '剧情画面即将落定…',
  ]);

  try {
    const resp = await fetch('/api/story/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, choiceIndex: index }),
    });
    const data = await resp.json();
    if (!resp.ok) throw data;
    // 不在这里手动清 loader：enterScene → renderScene 会根据 imageReady 决定
    // 是直接显示图片，还是把 loader 留着等后台轮询。
    enterScene(data);
  } catch (err) {
    stopLoaderHints();
    els.panelLoader.hidden = true;
    els.scenePanel.classList.remove('loading');
    showError(err);
  }
}

/* ========================================================
   "出画" 过渡：1.6s 黑场 → 揭幕回调
   ======================================================== */
function playWakeTransition(onMidway) {
  if (!els.wakeOverlay) { onMidway && onMidway(); return; }
  // 重新触发动画
  els.wakeOverlay.hidden = false;
  els.wakeOverlay.style.animation = 'none';
  void els.wakeOverlay.offsetWidth;
  els.wakeOverlay.style.animation = '';

  // 黑场最深处（约 0.55s 后）切换底层 section，这样揭幕时已经是连环画
  setTimeout(() => onMidway && onMidway(), 700);
  // 1.6s 后隐藏覆盖层
  setTimeout(() => { els.wakeOverlay.hidden = true; }, 1700);
}

/* ========================================================
   终幕 · 连环画
   ======================================================== */
function renderFinale(allScenes, aWins) {
  els.comicStrip.innerHTML = '';

  // 封面
  const cover = document.createElement('div');
  cover.className = 'comic-cover';
  cover.innerHTML = `
    <div class="cover-en">KACHA · PHOTO COMICS</div>
    <div class="cover-zh">${escapeHtml(state.name)}　的　影　像　錄</div>
    <div class="cover-meta">
      <span>${THEME_CN[state.theme] || ''}</span>
      <span class="dot">·</span>
      <span>${STYLE_CN[state.style] || ''}</span>
      <span class="dot">·</span>
      <span>全 ${allScenes.length} 幕</span>
    </div>
  `;
  els.comicStrip.appendChild(cover);

  const marks = ['第壹幕', '第貳幕', '第參幕', '終　幕', '番外'];
  allScenes.forEach((s, i) => {
    const isFinal = (i === allScenes.length - 1);
    const panel = document.createElement('div');
    panel.className = 'comic-panel' + (isFinal ? ' finale-panel' : '');
    panel.innerHTML = `
      <div class="num">${marks[i] || ('第' + (i + 1) + '幕')}</div>
      <img class="comic-panel-img" src="${s.image}" alt="第${i + 1}幕" />
      <div class="comic-panel-cap">${escapeHtml(s.narrative)}</div>
    `;
    els.comicStrip.appendChild(panel);
  });

  // 落款
  const footer = document.createElement('div');
  footer.className = 'comic-footer';
  footer.innerHTML = `
    <span>影　域　奉　行　所　戊辰戯作</span>
    <span class="seal-mini">咔嚓劇場</span>
  `;
  els.comicStrip.appendChild(footer);

  els.finaleSub.textContent = aWins
    ? `${state.name} 最后的反转把我惊到了，朋友升级 ✦`
    : '一次酣畅淋漓的入画，醒来记得截图给他/她看 ✦';

  showOnly(els.storyFinale);
}

els.downloadComicBtn.addEventListener('click', async () => {
  els.downloadComicBtn.disabled = true;
  const original = els.downloadComicBtn.innerHTML;
  els.downloadComicBtn.innerHTML = '<span class="btn-cn">合　卷　中　…</span>';
  try {
    // 1. 等连环画里所有 <img> 解码完，html2canvas 才不会截到半张图
    const imgs = Array.from(els.comicStrip.querySelectorAll('img'));
    await Promise.all(imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      if (typeof img.decode === 'function') {
        return img.decode().catch(() => new Promise((res) => {
          img.onload = res; img.onerror = res;
        }));
      }
      return new Promise((res) => { img.onload = res; img.onerror = res; });
    }));

    // 2. 截图
    const canvas = await html2canvas(els.comicStrip, {
      backgroundColor: '#ecddb8',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 0,
    });

    const fileName = `咔嚓连环画_${state.name || '无名'}_${Date.now()}.png`;

    // 3. 直接触发浏览器下载（不再走 Web Share，省得移动端弹分享面板而不是下载）
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 0);
  } catch (e) {
    console.error('[download comic] failed:', e);
    alert('保存失败：' + ((e && e.message) || e));
  } finally {
    els.downloadComicBtn.disabled = false;
    els.downloadComicBtn.innerHTML = original;
  }
});

els.replayStoryBtn.addEventListener('click', () => {
  state.sessionId = null;
  state.scenes = [];
  showOnly(els.storySetup);
});
