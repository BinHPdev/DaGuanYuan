#!/bin/bash
# Grade raw captures (from the scene capture rig) into assets/footage.
# usage: ./stage_footage.sh <raw_dir>
set -e
RAW="$1"; OUT="$(dirname "$0")/assets/footage"; mkdir -p "$OUT"
BASE="eq=contrast=1.06:saturation=1.14:gamma=0.98,colorbalance=rm=0.025:gm=0.0:bm=-0.03:rh=0.02:bh=-0.02"
for f in "$RAW"/*.mp4; do
  id=$(basename "$f" .mp4)
  case "$id" in
    t4_moon|s15_moon_xiaoxiang) G="eq=gamma=1.55:contrast=1.08:saturation=1.1,colorbalance=bs=0.06:bm=0.04" ;;
    t2_lantern|s13_lantern_close) G="eq=gamma=1.28:contrast=1.08:saturation=1.22" ;;
    t3_snow|s14_snowplum) G="eq=contrast=1.08:saturation=1.1:gamma=0.97" ;;
    *) G="$BASE" ;;
  esac
  ffmpeg -y -loglevel error -i "$f" -vf "$G" -c:v libx264 -preset slow -crf 16 -g 15 -pix_fmt yuv420p -movflags +faststart -an "$OUT/$id.mp4"
  echo "graded $id"
done
