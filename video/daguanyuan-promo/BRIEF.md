---
workflow: general-video
flow: automation
storyboard: no
message: "《红楼梦》里的大观园，依原著被一砖一瓦复原成可漫游的 3D 园林"
destination: 抖音 / 小红书 / 视频号 / Reels
aspect: "9:16"
language: zh-CN
length: 45-60s
audience: 红楼梦爱好者、国风/园林/3D 内容的泛社媒受众
---

## Intent
竖屏社媒短片。开头 3 秒钩子（曹雪芹用一支笔盖了园子 → 我用代码把它盖了出来），随第十七回贾政游园走过名景，
每处配原著引文；中段刘姥姥“竟比那画儿还强十倍”做趣味点，宝黛共读/宝钗扑蝶/黛玉葬花快切；
同一机位一镜到底切换 昼/暮/元宵/雪/月夜；结尾大观园题字 + 评论互动 CTA。

## Assets
- 画面：项目自身的 Three.js 场景，用确定性虚拟时钟逐帧采集（1080×1920，30fps）。
- 音乐：用户自行提供（待接入）。

## Customizations
- 字体：马善政毛笔体（地名/标题）+ 思源宋体（引文），子集化嵌入。
- 配色：墨 #17130e / 宣纸 #f3ecdc / 朱砂 #b8322a / 金 #e2b45a；朱印“大观”。

## Notes
- 引文均已对照 research/yuanwen 原文核实。
