"""Generate 3D props for the garden: nano-banana-pro concept image -> Tripo v2.5 image-to-3D (via fal)."""
import json, os, sys, time, requests, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "gen")
KEY = os.environ["FAL_KEY"]
H = {"Authorization": f"Key {KEY}", "Content-Type": "application/json"}
STYLE = (" Single object, entire object fully visible and centered, isolated on a pure white background, "
         "three-quarter view from slightly above, soft even studio lighting, no cast shadow, photorealistic, no text.")


def run(endpoint, payload, timeout=900):
    r = requests.post(f"https://queue.fal.run/{endpoint}", headers=H, json=payload, timeout=60)
    r.raise_for_status()
    j = r.json()
    t0 = time.time()
    while time.time() - t0 < timeout:
        s = requests.get(j["status_url"], headers=H, timeout=60).json()
        if s.get("status") == "COMPLETED":
            return requests.get(j["response_url"], headers=H, timeout=60).json()
        if s.get("status") not in ("IN_QUEUE", "IN_PROGRESS"):
            raise RuntimeError(f"{endpoint}: {s}")
        time.sleep(5)
    raise TimeoutError(endpoint)


def gen(name, prompt):
    glb = os.path.join(OUT, f"{name}.glb")
    if os.path.exists(glb):
        return name, "cached"
    img = run("fal-ai/nano-banana-pro", {"prompt": prompt + STYLE, "aspect_ratio": "1:1", "num_images": 1})
    url = img["images"][0]["url"]
    open(os.path.join(OUT, f"{name}.png"), "wb").write(requests.get(url, timeout=120).content)
    m = run("tripo3d/tripo/v2.5/image-to-3d", {"image_url": url, "texture": "standard", "face_limit": 20000})
    mesh = m.get("pbr_model") or m.get("model_mesh") or m.get("base_model")
    open(glb, "wb").write(requests.get(mesh["url"], timeout=300).content)
    return name, "ok"


if __name__ == "__main__":
    prompts = json.load(open(os.path.join(ROOT, "assets", "prompts.json")))
    names = sys.argv[1:] or list(prompts)
    with cf.ThreadPoolExecutor(4) as ex:
        futs = {ex.submit(gen, n, prompts[n]): n for n in names}
        for f in cf.as_completed(futs):
            try:
                print(*f.result(), flush=True)
            except Exception as e:
                print(futs[f], "FAILED", e, flush=True)
