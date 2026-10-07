# 大观园 3D 复原

依《红楼梦》原著（第十六、十七、十八、二十三、三十八、四十、四十九、五十、七十五、七十六回）复原的可漫游 3D 大观园。

- `research/yuanwen/`：维基文库原文；`research/layout.json`：每处景致的坐标、匾额楹联、原文引文与取舍说明（单一数据源，构建时复制到 `web/src/layout.json`）
- `scripts/gen_assets.py`：调用 fal 生成 AI 道具（nano-banana-pro 概念图 → Tripo v2.5 image-to-3D），提示词在 `assets/prompts.json`
- `web/`：Vite + Three.js。`arch.js` 程序化清式构件，`places.js` 各景点，`terrain.js`/`water.js` 地形与沁芳水系，`flora.js` 植被，`props.js` AI 模型
- `details.js`：自动桥梁、湖石驳岸、元宵灯海；`dynamics.js`：流水、风摆、落花、蝴蝶、锦鲤、鹅鸭鸡、萤火
- 模型压缩后转为内嵌 buffer 的 glTF JSON（`web/public/models/*.json`，`scripts/glb2json.py`）

## 本地运行（本地网页）
```bash
cd web && npm install
npm run dev                     # 开发：自动打开 http://localhost:5173/
npm start                       # 构建并预览产物：http://localhost:4173/
```

## 真实度迭代（loop engineering）
见 `loop/README.md`：`node loop/run.mjs` 渲染全部视角并生成对照报告，`loop/PROMPT.md` 为每轮迭代流程（可配合 `/loop`）。

## 其他
```bash
cd web && npm run dev           # 本地预览
node shoot.mjs http://localhost:5173/ ../shots overview,xiaoxiang,tour3   # 无头截图
npm run build                   # 产出 dist/
```
