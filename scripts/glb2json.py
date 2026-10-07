"""Convert an optimized .glb into a self-contained glTF JSON (buffer as data URI) for hosts that don't serve .glb."""
import struct, json, base64, sys
src, out = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
_, _, length = struct.unpack('<III', b[:12]); off = 12; js = binc = None
while off < length:
    cl, ct = struct.unpack('<II', b[off:off + 8]); chunk = b[off + 8:off + 8 + cl]; off += 8 + cl
    if ct == 0x4E4F534A: js = json.loads(chunk)
    elif ct == 0x004E4942: binc = chunk
js['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binc).decode()
json.dump(js, open(out, 'w'), separators=(',', ':'))
