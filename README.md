# 咔嚓劇場 · 进入照片的平行世界

> 一张随手抓拍的朋友照片 → AI 真的「看」一眼 → 一份风格化通缉令 / 暖光纪事卡 → 走进照片里的平行世界,跟朋友演一场可分享的连环画。

```
拍朋友  →  AI 看图  →  整蛊風 / 温暖之域 / 自定义風格 任选
        ↓
     通缉令 / 暖卡 (罪名 / 留言 = AI 真的看了照片说的话)
        ↓
     选剧情主题 + 画风  →  「咔嚓」入画动画  →  3 互动幕 + 1 终幕
        ↓
     四格连环画,玩家本人按性别出现在画面里 → 一键下载分享
```

---

## 1 · 场景与问题洞察

**单次场景**:看到朋友打哈欠 / 摸鱼 / 发呆的抓拍 → 30 秒生成一份通缉令甩到群里。

**重复场景**:
- 朋友群里每个人各传一张 → 互相生成连环画 → 群内"AI 评分大会"
- 情侣 / 闺蜜每月一张温暖卡 → 一年攒成一本小纪念册
- 毕业季用合照生成"温暖之域"卷 → 当作告别礼物

**解决什么问题**:朋友圈的"原图直发"已经审美疲劳。这个产品把"日常抓拍"升级成可以**收藏、传播、玩起来**的故事卡。

---

## 2 · AI 能力链路

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ ① 视觉理解        │    │ ② 编剧生成        │    │ ③ 场景图生成      │
│ gpt-4o-mini      │───▶│ gpt-4o-mini      │───▶│ gpt-image-2      │
│ (vision)         │    │ (chat / JSON)    │    │ (images/edits)   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
        ↓                       ↓                       ↓
   meta.json:vision       第二人称 narrative      连环画每一格 1024×1024
   ├ sceneZh              imagePrompt(含两人) ←┐   ├ Character A(脸照原图)
   ├ vibe                 choices ×3 (≤14 字)  │   ├ Character YOU(按性别)
   ├ objectsZh            ↑                    │   ├ 6 种镜头角度轮换
   ├ oneSentenceObs       │                    │   └ 头部朝向硬覆盖原图角度
   ├ prankCrime/Status    │                    │
   └ storyContext ────────┴────────────────────┘
              (灌进 system prompt,让入画引子引用照片真实细节)
```

**每个 AI 调用的产品职责**:

| 调用 | 模型 | 在哪 | 解决什么体验问题 |
| --- | --- | --- | --- |
| 看图 | `gpt-4o-mini` vision | `server.js: analyzePhoto()` | 通缉令罪名 / 暖卡留言 = AI 真的看到的内容,而不是模板 |
| 编剧 | `gpt-4o-mini` chat | `server.js: buildStoryMessages()` | 第二人称、强制点名朋友 ≥ 2 次、3 个性格各异的选项、终幕收束 |
| 出画 | `gpt-image-2` edit | `server.js: generateSceneImage()` | 双人同框、玩家按性别画身形、头部角度跨幕变化(避免侧脸锁死) |

**工程性细节**:

- 视觉理解结果**永久缓存到 `cache/{hash}.meta.json` 的 `vision` 字段** — 二次上传同一张照片不重复烧 token
- 剧情节点按 `(hash, name+nickname, gender, posterStyle, theme, style, choicePath)` 分桶缓存到 `cache/story/v5__*` — 演示路径秒回
- 上游 524/ECONNRESET 用指数退避重试 — 演示中不会因为一次抖动就崩
- 场景图 prompt 里 `PLAYER GENDER (HARD CONSTRAINT)` 拉成最高优先级 — 防止模型把玩家画错性别

---

## 3 · 用户旅程(体验完整性)

| 步骤 | 用户动作 | 系统反馈 |
| --- | --- | --- |
| ① 触发 | 看到朋友的照片想整蛊 / 想保存 | 打开 `咔嚓劇場` |
| ② 选风格 | 整蛊風 / 温暖之域 / 其他(占位) | 风格 chip + 性别 chip |
| ③ 上传 | 拖入照片 + 姓名 + 外号 | 后台 vision 跑一遍 |
| ④ 出卡 | 看通缉令 / 暖卡 | 罪名/留言由 AI 根据照片真实内容生成 |
| ⑤ 入画 | 点「進入照片中的平行世界」 | 「咔嚓」拍照动画 → 入画 |
| ⑥ 选剧情 | 5 主题 × 3 画风 | 整蛊和温暖各用一套主题池 |
| ⑦ 演剧情 | 4 幕 × 每幕 3 选 | 场景图玩家按性别出现,头部角度跨幕变 |
| ⑧ 出画 | 「出画」过渡 → 终幕 | 4 格漫画 + 封面 + 落款 |
| ⑨ 收藏 | 一键下载 png | html2canvas 截整张连环画 |

每个环节有过渡动画 / 加载文案 — **衔接是手感而不是分页跳转**。

**剧情池**:

| 风格 | 主题 | 画风 |
| --- | --- | --- |
| 整蛊風 | 宫斗 / 穿越重生 / 悬疑探案 / 打脸 / 爽文 | 恋与深空 / 蓝色监狱 / 仙逆 |
| 温暖之域 | 治愈日常 / 童话奇遇 / 校园回忆 / 旅途同行 / 节日温馨 | 吉卜力 / 新海诚 / 绘本水彩 |

---

## 4 · 用户价值感

**整蛊风**:不只是娱乐,是**关系润滑剂** — 群里发一份通缉令,朋友会回一份打回来。

**温暖之域**:超越"知道是什么"。AI 真的看了你的照片,然后用一句话告诉你它看到了什么:

> 「在窗边把书放在膝盖上的你,看起来不急着赶到任何地方 — 这种自洽我很喜欢。」

— 这一句话是用户截图发朋友圈的**理由**。

**终幕连环画**:一段完整的 4 格故事,有封面、有落款、有可下载的 png,**用户带得走**。

---

## 5 · 创新性与延展潜力

**已实现的创新**:
- **「进入照片的平行世界」**这一隐喻把单次产品变成**可探索的世界观**
- **整蛊 / 温暖**双风格 × **三种画风** × **5 种剧情** = 30+ 体验路径
- **玩家按性别出现在画面里**:用户不只是观众,自己就是连环画的角色
- **头部角度跨幕硬轮换**(6 种角度):解决 image-edit 模型最容易翻车的"全是侧脸"问题
- **视觉理解链路**:照片真实内容 → 罪名 / 留言 / 入画引子,避免"AI 装作看到了"

**延展路线图**:
- `其他风格(自定义)` chip 现在是占位,后端 `stylePromptsFor` 已经预留接口 → 用户输入自由词("赛博朋克 / 国风武侠"等)即可解锁
- **多人模式**:两张朋友照片 → 各自扮一角 → 群内对战
- **跨次角色档案**:同一张朋友照片在多次入画后形成稳定 NPC 设定,联机时可复用
- **录像 / 配音**:把整段剧情打包成 mp4 或加 TTS 朗读 narrative

---

## 6 · 本地运行

```bash
git clone https://github.com/LeeLeeDa2025/ZJUShaaa.git
cd ZJUShaaa
npm install

# 在 .env 写自己的 key
echo "OPENAI_API_KEY=sk-xxxx" > .env
echo "OPENAI_BASE_URL=https://api.openai-next.com" >> .env

npm start            # 等价于 node server.js
# 浏览器打开 http://localhost:3000
```

预热演示缓存(改了 prompt 后重灌时用):

```bash
node server.js                  # 一个终端
node scripts/prewarm-demo.js    # 另一个终端
```

测试:

```bash
npm test
```

---

## 7 · 演示路径速查

完整步骤见 [`演示路径.md`](./演示路径.md)。摘要:

| 路径 | 风格 | 性别 | 姓名 / 外号 | 主题 / 画风 | 每幕选 |
| --- | --- | --- | --- | --- | --- |
| 整蛊风 | 整蛊風 | 女 | 示例同学 / 梦中梦 | 爽文 / 恋与深空 | 最上面那一个(共 3 次) |
| 温暖之域 | 温暖之域 | 女 | 示例同学 / 梦中梦 | 旅途同行 / 新海诚 | 最上面那一个(共 3 次) |

任一字段不一致 → cache miss → 现场跑 30-60s 一幕(可作 fallback 演示)。

---

## 8 · 目录结构

```
.
├── server.js               # Express 后端入口 / 三条 AI 链路
├── public/
│   ├── index.html          # 表单 + 通缉令 + 入画 + 剧情 + 终幕
│   ├── app.js              # 前端状态机
│   └── style.css           # 浮世绘 / 暖橘双套配色
├── scripts/
│   ├── prewarm-demo.js     # 演示路径预热
│   ├── prewarm-story.js    # 通用剧情节点预热
│   └── demos.json          # 示例 hash + 主题 + 画风配置
├── test/
│   └── generate-poster.test.js
├── cache/                  # 海报 / 剧情磁盘缓存(gitignore)
├── uploads/                # 用户上传原图(gitignore)
├── docs/                   # 设计稿 / 规约
├── 剧情.txt                 # 产品需求 / 设计原则
└── 演示路径.md              # 现场演示速查
```

---

## 9 · 关键代码索引

| 想看 | 文件 : 位置 |
| --- | --- |
| 视觉理解 | `server.js` → `analyzePhoto()` |
| 整蛊 / 暖卡逻辑 + vision 增量字段 | `server.js` → `/api/generate-poster` |
| 编剧 prompt + 二人称 + 双人物 | `server.js` → `buildStoryMessages()` |
| 场景图 + 性别硬约束 + 镜头轮换 | `server.js` → `generateSceneImage()` + `HEAD_ANGLES` |
| 剧情节点缓存 | `server.js` → `storyCacheKey()` / `readStoryCache()` |
| 前端表单 + 风格 / 性别 chip | `public/index.html` `#form` |
| 暖卡 AI 留言渲染 | `public/app.js` → `renderPoster()` + `.warm-blessing` |
| 连环画下载 | `public/app.js` → `els.downloadComicBtn` |

---

## 10 · 注意事项

- `uploads/`、`cache/`、`.env`、`API.txt` 已在 `.gitignore` 中
- 生图调用单次较慢(30–60s/幕)— 演示请优先走预热路径
- `STORY_CACHE_VERSION` bump 后旧缓存自动失效,手动清空:`rm cache/story/v*__*`

---

**Made for ZJU Shaaa** · 戊辰戯作
