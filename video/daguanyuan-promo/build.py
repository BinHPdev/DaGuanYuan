#!/usr/bin/env python3
"""Generate index.html (static HyperFrames composition) from the edit decision list below,
and subset the CJK fonts to exactly the characters on screen.

usage: python3 build.py            (fonts are read from $FONT_SRC, default ./_fontsrc)
"""
import json, os, subprocess, html

W, H = 1080, 1920
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- edit decision list
# kind: hook | place | laolao | story | montage | outro
# clip: footage file in assets/footage, src: source in-point (s)
EDL = [
    dict(kind="hook", dur=3.6, clip="s01_dive", src=0.0,
         a=["曹雪芹用", "一支笔", "，盖了一座园子"], b=["两百多年后", "我用", "代码", "把它盖了出来"]),
    dict(kind="place", dur=3.0, clip="s02_gate", src=0.6, name="大观园正门", banner="随贾政一行 · 游园",
         quote="只见正门五间，上面筒瓦泥鳅脊", ch="第十七回"),
    dict(kind="place", dur=2.8, clip="s04_qinfang", src=0.8, name="沁芳亭",
         quote="石桥三港，兽面衔吐。桥上有亭。", ch="第十七回"),
    dict(kind="place", dur=2.8, clip="s05_xiaoxiang", src=0.6, name="潇湘馆",
         quote="有千百竿翠竹遮映", ch="第十七回"),
    dict(kind="place", dur=2.8, clip="s06_yihong", src=0.6, name="怡红院",
         quote="一边种着数本芭蕉，那一边乃是一棵西府海棠", ch="第十七回"),
    dict(kind="place", dur=2.6, clip="s07_liaoting", src=0.8, name="蓼汀花溆",
         quote="忽闻水声潺湲，泻出石洞", ch="第十七回"),
    dict(kind="place", dur=3.6, clip="s08_palace", src=0.9, name="省亲别墅",
         quote="崇阁巍峨，层楼高起", ch="第十七回"),
    dict(kind="place", dur=2.6, clip="s09_ouxiang", src=0.8, name="藕香榭",
         quote="盖在池中，四面有窗", ch="第三十八回"),
    dict(kind="laolao", dur=3.4, clip="s18_jiamu", src=0.4, who="刘姥姥",
         line="竟比那画儿还强十倍！", ch="第四十回"),
    dict(kind="story", dur=2.0, clip="s10_gongdu", src=1.2, title="宝黛共读", ch="第二十三回"),
    dict(kind="story", dur=2.0, clip="s19_baochai", src=1.2, title="宝钗扑蝶", ch="第二十七回"),
    dict(kind="story", dur=2.2, clip="s17_huazhong", src=1.0, title="黛玉葬花", ch="第二十七回",
         sub="花谢花飞花满天"),
    dict(kind="place", dur=2.4, clip="s12_interior", src=1.0, name="秋爽斋",
         quote="当地放着一张花梨大理石大案", ch="第四十回"),
    dict(kind="montage", dur=9.0, src=0.4, lead="一座园子 · 五种光阴",
         beats=[("t0_day", "昼", "白昼"), ("t1_dusk", "暮", "黄昏"), ("t2_lantern", "灯", "元宵"),
                ("t3_snow", "雪", "初雪"), ("t4_moon", "月", "月夜")]),
    dict(kind="place", dur=2.6, clip="s13_lantern_close", src=0.8, name="元宵",
         quote="处处灯光相映，时时细乐声喧", ch="第十八回"),
    dict(kind="place", dur=2.8, clip="s14_snowplum", src=0.6, name="栊翠庵",
         quote="红梅如胭脂一般，映着雪色", ch="第四十九回"),
    dict(kind="outro", dur=7.0, clip="s16_outro", src=0.0),
]
OUTRO = dict(title="大观园", sub="依《红楼梦》原著复原 · 可漫游的 3D 园林", cta="你最想住进哪一处？", seal="大观")

# ---------------------------------------------------------------- build
t = 0.0
for s in EDL:
    s["t"] = round(t, 3)
    t += s["dur"]
TOTAL = round(t, 3)

vid, ovl, js = [], [], []
E = html.escape


def video(id_, clip, start, dur, src):
    vid.append(f'''      <div class="vw" id="vw-{id_}"><video id="v-{id_}" class="clip" src="assets/footage/{clip}.mp4" muted playsinline
        data-start="{start}" data-duration="{dur}" data-media-start="{src}" data-track-index="0"></video></div>''')
    # slow push-in on the untimed wrapper keeps every shot alive
    js.append(f'tl.fromTo("#vw-{id_}", {{ scale: 1.0 }}, {{ scale: 1.045, duration: {dur}, ease: "none" }}, {start});')


def chars(text, cls="ch"):
    return "".join(f'<span class="{cls}">{E(c)}</span>' for c in text)


for i, s in enumerate(EDL):
    sid, st, d = f"s{i:02d}", s["t"], s["dur"]
    if s["kind"] == "montage":
        n = len(s["beats"]); seg = d / n
        for k, (clip, big, small) in enumerate(s["beats"]):
            bst = round(st + k * seg, 3)
            # continuous camera: every time-of-day take was shot on the same path, so the
            # in-point follows the edit position and the motion never jumps
            video(f"{sid}{k}", clip, bst, round(seg, 3), round(s["src"] + k * seg, 3))
            ovl.append(f'''      <div class="clip ov mont" id="{sid}{k}" data-start="{bst}" data-duration="{round(seg, 3)}" data-track-index="1">
        <div class="mont-big" id="{sid}{k}-big">{E(big)}</div>
        <div class="mont-small" id="{sid}{k}-small">{E(small)}</div>
        <div class="flash" id="{sid}{k}-flash"></div>
      </div>''')
            js.append(f'tl.fromTo("#{sid}{k}-flash", {{ opacity: {0 if k == 0 else 0.55} }}, {{ opacity: 0, duration: 0.35, ease: "power2.out" }}, {bst});')
            js.append(f'tl.fromTo("#{sid}{k}-big", {{ scale: 1.35, opacity: 0, filter: "blur(18px)" }}, {{ scale: 1, opacity: 0.92, filter: "blur(0px)", duration: 0.38, ease: "expo.out" }}, {bst + 0.02});')
            js.append(f'tl.fromTo("#{sid}{k}-big", {{ y: 0 }}, {{ y: -24, duration: {round(seg, 3)}, ease: "none" }}, {bst});')
            js.append(f'tl.fromTo("#{sid}{k}-small", {{ opacity: 0, letterSpacing: "0.9em" }}, {{ opacity: 1, letterSpacing: "0.5em", duration: 0.5, ease: "power3.out" }}, {bst + 0.12});')
        ovl.append(f'''      <div class="clip ov" id="{sid}-lead" data-start="{st}" data-duration="1.6" data-track-index="2">
        <div class="lead" id="{sid}-leadtxt">{chars(s["lead"])}</div>
      </div>''')
        js.append(f'tl.fromTo("#{sid}-leadtxt .ch", {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power4.out", stagger: 0.035 }}, {st + 0.05});')
        js.append(f'tl.to("#{sid}-leadtxt", {{ opacity: 0, duration: 0.25 }}, {st + 1.3});')
        continue

    video(sid, s["clip"], st, d, s["src"])
    if s["kind"] == "hook":
        a = "".join(f'<span class="w{" hl" if j == 1 else ""}">{E(w)}</span>' for j, w in enumerate(s["a"]))
        b = "".join(f'<span class="w{" hl" if j == 2 else ""}">{E(w)}</span>' for j, w in enumerate(s["b"]))
        ovl.append(f'''      <div class="clip ov" id="{sid}" data-start="{st}" data-duration="{d}" data-track-index="1">
        <div class="hook-scrim"></div>
        <div class="hook">
          <div class="hook-a" id="{sid}-a">{a}</div>
          <div class="hook-b" id="{sid}-b">{b}</div>
        </div>
      </div>''')
        js.append(f'tl.fromTo("#{sid}-a .w", {{ opacity: 0, y: 60 }}, {{ opacity: 1, y: 0, duration: 0.28, ease: "power4.out", stagger: 0.12 }}, 0.1);')
        js.append(f'tl.to("#{sid}-a", {{ opacity: 0, y: -40, duration: 0.25, ease: "power2.in" }}, 1.65);')
        js.append(f'tl.fromTo("#{sid}-b .w", {{ opacity: 0, y: 70, scale: 0.92 }}, {{ opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "expo.out", stagger: 0.14 }}, 1.85);')
        js.append(f'tl.fromTo("#{sid}-b .hl", {{ color: "#f3ecdc" }}, {{ color: "#e2b45a", duration: 0.3 }}, 2.45);')
    elif s["kind"] == "place":
        banner = f'<div class="banner" id="{sid}-banner"><span>{E(s["banner"])}</span></div>' if s.get("banner") else ""
        ovl.append(f'''      <div class="clip ov" id="{sid}" data-start="{st}" data-duration="{d}" data-track-index="1">
        <div class="scrim"></div>
        {banner}
        <div class="name-col">
          <div class="name" id="{sid}-name">{E(s["name"])}</div>
          <div class="seal" id="{sid}-seal"><span>大</span><span>观</span></div>
        </div>
        <div class="quote-box">
          <div class="quote" id="{sid}-q"><span class="qm">「</span>{chars(s["quote"])}<span class="qm">」</span></div>
          <div class="attr" id="{sid}-attr">——《红楼梦》{E(s["ch"])}</div>
        </div>
      </div>''')
        js.append(f'tl.fromTo("#{sid}-name", {{ clipPath: "inset(0 0 100% 0)" }}, {{ clipPath: "inset(0 0 0% 0)", duration: 0.55, ease: "power3.out" }}, {st + 0.08});')
        js.append(f'tl.fromTo("#{sid}-seal", {{ scale: 1.6, opacity: 0, rotation: -12 }}, {{ scale: 1, opacity: 1, rotation: -4, duration: 0.32, ease: "back.out(2.2)" }}, {st + 0.45});')
        js.append(f'tl.fromTo("#{sid}-q .ch, #{sid}-q .qm", {{ opacity: 0, y: 26 }}, {{ opacity: 1, y: 0, duration: 0.26, ease: "power4.out", stagger: {min(0.045, 0.5 / max(1, len(s["quote"])))} }}, {st + 0.3});')
        js.append(f'tl.fromTo("#{sid}-attr", {{ opacity: 0, x: -20 }}, {{ opacity: 1, x: 0, duration: 0.35, ease: "power2.out" }}, {st + 0.75});')
        if s.get("banner"):
            js.append(f'tl.fromTo("#{sid}-banner span", {{ opacity: 0, letterSpacing: "0.8em" }}, {{ opacity: 1, letterSpacing: "0.35em", duration: 0.6, ease: "power3.out" }}, {st + 0.1});')
    elif s["kind"] == "laolao":
        ovl.append(f'''      <div class="clip ov" id="{sid}" data-start="{st}" data-duration="{d}" data-track-index="1">
        <div class="scrim"></div>
        <div class="bubble-wrap">
          <div class="bubble" id="{sid}-bub">
            <div class="who">{E(s["who"])}</div>
            <div class="line" id="{sid}-line">{chars(s["line"])}</div>
          </div>
          <div class="attr attr-b" id="{sid}-attr">——《红楼梦》{E(s["ch"])} · 刘姥姥进大观园</div>
        </div>
      </div>''')
        js.append(f'tl.fromTo("#{sid}-bub", {{ scale: 0.4, opacity: 0, rotation: -6 }}, {{ scale: 1, opacity: 1, rotation: -2, duration: 0.42, ease: "back.out(2)" }}, {st + 0.15});')
        js.append(f'tl.fromTo("#{sid}-line .ch", {{ opacity: 0, scale: 1.6 }}, {{ opacity: 1, scale: 1, duration: 0.2, ease: "power4.out", stagger: 0.06 }}, {st + 0.4});')
        js.append(f'tl.fromTo("#{sid}-bub", {{ y: 0 }}, {{ y: -10, duration: 0.18, yoyo: true, repeat: 3, ease: "sine.inOut" }}, {st + 1.2});')
        js.append(f'tl.fromTo("#{sid}-attr", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.4 }}, {st + 1.0});')
    elif s["kind"] == "story":
        sub = f'<div class="story-sub" id="{sid}-sub">{chars(s["sub"])}</div>' if s.get("sub") else ""
        ovl.append(f'''      <div class="clip ov" id="{sid}" data-start="{st}" data-duration="{d}" data-track-index="1">
        <div class="scrim"></div>
        <div class="story">
          <div class="story-ch" id="{sid}-ch">{E(s["ch"])}</div>
          <div class="story-title" id="{sid}-title">{chars(s["title"], "sc")}</div>
          {sub}
        </div>
      </div>''')
        js.append(f'tl.fromTo("#{sid}-ch", {{ opacity: 0, y: -16 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, {st + 0.05});')
        js.append(f'tl.fromTo("#{sid}-title .sc", {{ opacity: 0, y: 70, rotation: 8 }}, {{ opacity: 1, y: 0, rotation: 0, duration: 0.3, ease: "expo.out", stagger: 0.07 }}, {st + 0.1});')
        if s.get("sub"):
            js.append(f'tl.fromTo("#{sid}-sub .ch", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.25, stagger: 0.06 }}, {st + 0.6});')
    elif s["kind"] == "outro":
        o = OUTRO
        ovl.append(f'''      <div class="clip ov" id="{sid}" data-start="{st}" data-duration="{d}" data-track-index="1">
        <div class="outro-veil" id="{sid}-veil"></div>
        <div class="outro">
          <div class="outro-title" id="{sid}-title">{chars(o["title"], "sc")}</div>
          <div class="outro-sub" id="{sid}-sub">{E(o["sub"])}</div>
          <div class="cta" id="{sid}-cta">{E(o["cta"])}</div>
        </div>
        <div class="seal seal-big" id="{sid}-seal"><span>大</span><span>观</span></div>
      </div>''')
        js.append(f'tl.fromTo("#{sid}-veil", {{ opacity: 0 }}, {{ opacity: 1, duration: 1.4, ease: "power1.inOut" }}, {st + 0.6});')
        js.append(f'tl.fromTo("#{sid}-title .sc", {{ opacity: 0, y: 90, filter: "blur(14px)" }}, {{ opacity: 1, y: 0, filter: "blur(0px)", duration: 0.7, ease: "expo.out", stagger: 0.16 }}, {st + 1.0});')
        js.append(f'tl.fromTo("#{sid}-seal", {{ scale: 1.8, opacity: 0, rotation: -14 }}, {{ scale: 1, opacity: 1, rotation: -4, duration: 0.35, ease: "back.out(2.4)" }}, {st + 1.75});')
        js.append(f'tl.fromTo("#{sid}-sub", {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }}, {st + 2.0});')
        js.append(f'tl.fromTo("#{sid}-cta", {{ opacity: 0, scale: 0.85 }}, {{ opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.8)" }}, {st + 3.3});')
        js.append(f'tl.fromTo("#{sid}-cta", {{ y: 0 }}, {{ y: -8, duration: 0.6, yoyo: true, repeat: 3, ease: "sine.inOut" }}, {st + 3.9});')

# whole-film fade from/to black
js.append(f'tl.fromTo("#fade", {{ opacity: 1 }}, {{ opacity: 0, duration: 0.25, ease: "power1.out" }}, 0);')
js.append(f'tl.to("#fade", {{ opacity: 1, duration: 0.5, ease: "power1.in" }}, {TOTAL - 0.5});')
# film grain drift, stepped so it reads as grain rather than a slide
js.append(f'tl.fromTo("#grain", {{ backgroundPosition: "0px 0px" }}, {{ backgroundPosition: "{37 * int(TOTAL * 12)}px {53 * int(TOTAL * 12)}px", duration: {TOTAL}, ease: "steps({int(TOTAL * 12)})" }}, 0);')

# ---------------------------------------------------------------- fonts: subset to on-screen text
texts = json.dumps(EDL, ensure_ascii=False) + json.dumps(OUTRO, ensure_ascii=False) + "「」——《》·！？，。"
charset = "".join(sorted(set(c for c in texts if ord(c) > 0x2000))) + "0123456789 3D"
fsrc = os.environ.get("FONT_SRC", os.path.join(HERE, "_fontsrc"))
os.makedirs(os.path.join(HERE, "assets/fonts"), exist_ok=True)
for name, src in [("brush", "MaShanZheng.ttf"), ("serif", "NotoSerifSC.ttf")]:
    p = os.path.join(fsrc, src)
    if os.path.exists(p):
        subprocess.run(["pyftsubset", p, f"--text={charset}", "--layout-features=*",
                        f"--output-file={os.path.join(HERE, 'assets/fonts', name + '.ttf')}"], check=True)

page = open(os.path.join(HERE, "src", "template.html"), encoding="utf-8").read()
page = (page.replace("__TOTAL__", str(TOTAL)).replace("__W__", str(W)).replace("__H__", str(H))
        .replace("__VIDEOS__", "\n".join(vid)).replace("__OVERLAYS__", "\n".join(ovl))
        .replace("__JS__", "\n      ".join(js)))
open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(page)
print(f"index.html: {len(EDL)} scenes, {TOTAL}s, {len(charset)} glyphs")
