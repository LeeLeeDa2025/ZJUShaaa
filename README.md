# 咔嚓剧场 (Kacha Theater)

一款 AI 娱乐应用：上传一张朋友的日常照片，生成"通缉令 / 暖卡"，再带你走进照片里的平行世界，把一张抓拍变成一组可分享的连环画小剧场。

## 功能概览

- **部分一 · 海报生成**
  - 整蛊风：风格化通缉令（罪名、危险等级 F–S、悬赏金额、流口水细节），保留本人五官。
  - 温暖之域：治愈系日常美照，配上夸夸 / 安慰文案。
  - 其他风格：根据用户输入自由发挥。
- **部分二 · 进入平行世界**
  - 第一幕：手伸出"咔嚓"拍照的入画动画。
  - 整蛊风剧情主题：宫斗 / 穿越重生 / 悬疑探案 / 打脸 / 爽文；画风：恋与深空 / 蓝色监狱 / 仙逆。
  - 温暖之域剧情主题：治愈日常 / 童话奇遇 / 校园回忆 / 旅途同行 / 节日温馨；画风：吉卜力 / 新海诚 / 绘本水彩。
  - 每幕 3 个选项分支，终幕生成可收藏的连环画。
- **部分三 · 演示缓存**
  - 基于照片内容哈希 + 表单字段的本地永久缓存，跨进程 / 跨重启有效。
  - 提供预热脚本一键灌满指定示例的全分支路径。

## 技术栈

- Node.js + Express（`server.js`）
- multer 上传 / axios + form-data 调外部模型
- 文本模型：`gpt-4o-mini`（默认）
- 生图模型：`gpt-image-2`（默认）
- 前端：原生 HTML / CSS / JS（`public/`），手机屏幕居中布局

## 目录结构

```
.
├── server.js              # Express 后端入口
├── public/                # 前端静态资源（index.html / app.js / style.css）
├── scripts/
│   ├── prewarm-demo.js    # 演示路径预热脚本
│   ├── prewarm-story.js   # 通用剧情节点预热
│   └── demos.example.json # 示例配置模板
├── test/                  # node --test 测试用例
├── cache/                 # 海报 / 剧情磁盘缓存（gitignore）
├── uploads/               # 用户上传原图（gitignore）
├── docs/                  # 相关文档
├── 剧情.txt                # 产品需求说明
└── 演示路径.md             # 现场演示速查
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 API（任选其一）
#    - 直接通过环境变量：
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.openai-next.com   # 可选
export IMAGE_MODEL=gpt-image-2                       # 可选
export TEXT_MODEL=gpt-4o-mini                        # 可选
#    - 或在 server.js 的默认值中替换。

# 3. 启动服务（默认 http://localhost:3000）
npm start

# 4.（可选）预热演示缓存
node scripts/prewarm-demo.js
```

## 测试

```bash
npm test
```

## 演示路径

现场演示前请先按 [`演示路径.md`](./演示路径.md) 跑一遍预热，并严格按文档中的姓名 / 外号 / 性别 / 风格 / 主题 / 画风 / 选项编号操作，任意字段不一致都会 cache miss 走实时生成。

## 缓存版本

- 缓存键带版本号 `STORY_CACHE_VERSION`（见 `server.js`），bump 后旧缓存自动失效。
- 手动清空：删除 `cache/`（或仅删 `cache/story/v*__*`）即可。

## 注意事项

- `uploads/`、`cache/`、`.env`、`API.txt` 已被 `.gitignore` 忽略，请勿把真实密钥提交进仓库。
- 生图调用单次较慢（约 30–60s/幕），演示请优先走预热路径。
