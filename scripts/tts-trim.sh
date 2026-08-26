#!/bin/bash
# edge-tts pads every short utterance out to a fixed 1.776s: a quarter second of
# silence before the word and up to a second after. That padding is the gap
# between tapping and hearing, and the dead air between a word and its example
# in the auto-play sequence. Strip it, keeping 50ms so the first consonant
# isn't clipped.
#
# Only the silence at each end is stripped: the pause a sentence takes at its
# comma is in the middle, and reversing around the filter leaves it alone.
#
# Usage: bash scripts/tts-trim.sh [資料夾]   # 預設 public/audio
set -euo pipefail
cd "$(dirname "$0")/.."
src=${1:-public/audio}
out=$src-trimmed
trim="silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB:detection=peak"

mkdir -p "$out"
n=0
for f in "$src"/*.mp3; do
  ffmpeg -v error -y -i "$f" -af "$trim,areverse,$trim,areverse" \
    -c:a libmp3lame -b:a 48k -ar 24000 -ac 1 "$out/$(basename "$f")" &
  # Eight at a time: enough to use the machine, few enough that the job table
  # doesn't need managing.
  if [ $(( ++n % 8 )) -eq 0 ]; then wait; fi
done
wait

before=$(ls "$src"/*.mp3 | wc -l | tr -d ' ')
after=$(ls "$out"/*.mp3 | wc -l | tr -d ' ')
# A dropped or emptied file would be a silent card in the app, so refuse to
# swap unless every word survived with real audio in it.
tiny=$(find "$out" -name '*.mp3' -size -1k | wc -l | tr -d ' ')
if [ "$before" != "$after" ] || [ "$tiny" != "0" ]; then
  echo "不換：原本 $before 個、修好 $after 個、太小的 $tiny 個。原檔沒動。"
  exit 1
fi

# Only the mp3s move: public/audio also holds the ex/ folder, and blowing the
# whole directory away would take the examples with it.
rm -f "$src"/*.mp3 && mv "$out"/*.mp3 "$src"/ && rmdir "$out"
echo "完成 $after 個，現在總共 $(du -sh "$src" | cut -f1)"
