# loop engineering：大观园真实度迭代

把“越来越像原著和 87 版大观园”变成一个可重复的循环：**拍照 → 按清单打分 → 改 3 项 → 复拍对比 → 记录提交**。

| 文件 | 作用 |
|---|---|
| `config.json` | 视角列表（相机位置，或 景点 id + 距离，可选时辰）+ 每个景点的真实度清单（权重 1–3，标出处） |
| `run.mjs` | 用无头 Chrome 渲染全部视角，测 fps，收集控制台错误，输出 `runs/<stamp>/`（png、manifest.json、report.html） |
| `PROMPT.md` | 每轮迭代的指令和护栏，给 `/loop` 用 |
| `LOG.md` | 迭代日志 |
| `../research/refs.md` | 原著 + 北京/上海大观园实景的建模参考、全局配色和尺度 |
| `../research/tv86/` | 本地参考图（Wikimedia Commons，CC 协议），只作参考，不进构建 |

## 运行
```bash
cd web && npm run dev            # 本地网页 http://localhost:5173/
node loop/run.mjs                # 在项目根目录另开终端运行：渲染全部视角
node loop/run.mjs --only overview,xiaoxiang,yihong_in
node loop/run.mjs --diff latest  # 和上一轮并排对比
node loop/run.mjs --ui           # 截图保留界面
node loop/run.mjs --url http://localhost:4173/   # 对 vite preview（构建产物）截图，避免热更新干扰
```
报告：`loop/runs/<stamp>/report.html`（用浏览器直接打开）。勾选和评分保存在浏览器 localStorage 里；“生成未满足清单”按钮按权重导出待办。
dev server 热更新导致页面重载时，run.mjs 会自动等待场景重新加载并重试，重载记录写进 errors。

## 自动循环
在 Claude Code 中：
```
/loop 30m 按 loop/PROMPT.md 跑一轮大观园真实度迭代
```
不写间隔则由模型自定节奏。每轮结束会往 `LOG.md` 追加一段，并产生一个 `loop iter N` commit。

## 扩展
- 加视角：在 `viewpoints` 里加 `{id, label, place, dist}` 或 `{id, label, pos, target}`；`time` 可填 0/1/2，或者填名称（需要页面提供 `__dgy.setTimeByName`），可选的视角标 `"optional": true`。
- 加清单项：`checklists.<spot>` 里加 `{id, text, weight, source}`；出处写回目或 refs 图号。
