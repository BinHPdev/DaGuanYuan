# 大观园 loop：每轮迭代指令

> 用法：在 Claude Code 里执行 `/loop 30m 按 loop/PROMPT.md 跑一轮大观园真实度迭代`，也可以手动把本文件当作提示词。
> 每轮只做一件事：把 3 个最高权重的未满足项变成满足项，并留下证据。

## 0. 前置
- 确认 dev server 在跑：`curl -s localhost:5173 >/dev/null || (cd web && npx vite --port 5173 &)`。
- 读 `loop/LOG.md` 末尾，拿到上一轮编号 N-1、run 目录和“剩余缺口”。

## 1. 先拍现状
`node loop/run.mjs --diff latest --tag "iter N before"`
- 打开 `loop/runs/<stamp>/report.html`，同时用 Read 逐张看 png。
- 对照 `loop/config.json` 的 checklists 和 `research/refs.md`（必要时看 `research/tv86/ref*.jpg`），给每一项判定“满足 / 不满足”。判定要从截图上看得到，不能凭代码推断。
- 如果 manifest 里 `minFps < fpsBudget` 或 `errors` 非空，**本轮先修这些，不做新功能**。

## 2. 选题
- 把不满足项按 `weight` 从高到低排；同权重时，优先能同时改善多个视角的项（全局项 > 单景点项）。
- 选 **3 项**，写下验收标准（看哪个视角、看到什么算过）。

## 3. 实现
- 数据以 `research/layout.json` 为准（复制到 `web/src/layout.json`，两份保持一致）。新增匾额、楹联、引文**一律从 `research/yuanwen/*.txt` 原样摘录**（繁简可转换，但不改字、不臆造）。
- 构件进 `web/src/arch.js`，景点进 `web/src/places.js`，动态效果进 `web/src/dynamics.js`、`water.js`、`flora.js`。
- 颜色和尺度按 `research/refs.md` 的全局样式表取值。
- 性能：大量重复构件用 InstancedMesh，或交给 main.js 的 `batch()` 合并；每轮新增 draw call 不超过 30。

## 4. 复拍验收
`node loop/run.mjs --diff <本轮 before 的 stamp> --tag "iter N after"`
- 逐项核对验收标准。没过的要么接着修，要么在 LOG 里明确标“未完成”。
- 再次确认 fps ≥ 30、控制台 0 错误。

## 5. 记录与提交
在 `loop/LOG.md` 末尾追加：
```
## iter N — YYYY-MM-DD HH:MM
- 目标：<3 个 checklist id + 一句话>
- 改动：<文件 / 要点>
- 证据：before loop/runs/<stamp1>/  after loop/runs/<stamp2>/（关键视角：xxx.png）
- 指标：fps <min>/<global>，errors <n>，加权满足度 <x/y>（自评）
- 剩余缺口（按权重）：<id 列表>
```
然后 `git add -A && git commit -m "loop iter N: <摘要>"`。loop/runs 已在 .gitignore 里，截图不入库。

## 护栏
1. **性能**：harness 测得 fps ≥ 30（config.fpsBudget），加载时间不超过上一轮的 1.5 倍。
2. **版权**：87 版剧照和 `research/tv86/` 里的图片只能作参考，绝不复制进 `web/` 或打包产物；贴图要么程序生成，要么是自己用 AI 生成的素材。
3. **考据**：`layout.json` 是唯一数据源；改方位要在条目的 `note` 里写理由并注明回目。原文引文必须能在 `research/yuanwen` 中 grep 到。
4. **不回退**：上一轮已满足的项，本轮截图里不能变成不满足；有冲突时优先保留已满足项。
5. **小步**：每轮最多 3 项，每轮一个 commit。改动大的拆成多轮。
6. **不发布**：本地网页是交付形式（`cd web && npm run dev`），不生成 claude.ai artifact。
