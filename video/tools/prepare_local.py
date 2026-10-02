"""Derive everything a scene needs from a local song file, for songs outside the Suno playlist.

Expects <song>/source/audio.wav and, optionally, <song>/source/lyrics.txt with
one sung line per line. Writes vocals.wav, instrumental.wav, transcript.json,
align.json (with lyrics) and timing-report.md into <song>/source/ and
<song>/analysis.js. Needs a venv with CUDA torch, stable-ts and audio-separator.

    python tools/prepare_local.py my-song
    python tools/prepare_local.py my-song --language de

Whisper invents text where it hears no speech ("Thanks for watching!") and
often fails on dialect, so a transcription without written lyrics is a hint,
never text for the video.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import HOP, SR, analyze, flux_frames, load, rms_frames  # noqa: E402
from prepare import phrase_starts, sung_lines  # noqa: E402

VIDEO = Path(__file__).resolve().parent.parent


def tempo_windows(instrumental, win=16.0):
    # prepare.tempo_windows narrows the search with the BPM from a Suno prompt; a local song has none
    flux = flux_frames(instrumental)
    dt = HOP / SR
    rows = []
    for a in np.arange(0, len(flux) * dt - 4, win):
        b = min(len(flux) * dt, a + win)
        best = (-1, 0, 0)
        for bpm in np.arange(60, 190.01, 0.25):
            p = 60 / bpm
            for ph in np.arange(0, p, 0.01):
                idx = np.minimum((np.arange(a + ph, b, p) / dt).astype(int), len(flux) - 1)
                sc = flux[idx].mean() / (flux[int(a / dt):int(b / dt)].mean() + 1e-9)
                if sc > best[0]:
                    best = (sc, bpm, a + ph)
        rows.append((a, b, best[1], best[2], best[0]))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("song")
    ap.add_argument("--language", help="language code for Whisper; detected when omitted")
    args = ap.parse_args()
    song = VIDEO / args.song
    src = song / "source"
    if not (src / "audio.wav").exists():
        sys.exit(f"missing {src / 'audio.wav'}")

    if not (src / "vocals.wav").exists():
        from audio_separator.separator import Separator
        sep = Separator(output_format="WAV", output_dir=str(src))
        sep.load_model("model_bs_roformer_ep_317_sdr_12.9755.ckpt")
        for f in sep.separate(str(src / "audio.wav")):
            f = Path(f) if Path(f).is_absolute() else src / Path(f).name
            f.replace(src / ("vocals.wav" if "(Vocals)" in f.name else "instrumental.wav"))
        del sep
    analyze(song)

    import stable_whisper
    whisper = stable_whisper.load_model("large-v3", device="cuda")
    lyrics_path = src / "lyrics.txt"
    lines = sung_lines(lyrics_path.read_text(encoding="utf-8")) if lyrics_path.exists() else []
    if lines:
        whisper.align(str(src / "vocals.wav"), "\n".join(lines), language=args.language or "de",
                      original_split=True).save_as_json(str(src / "align.json"))
    whisper.transcribe(str(src / "vocals.wav"), language=args.language, word_timestamps=True,
                       vad=True).save_as_json(str(src / "transcript.json"))
    del whisper

    starts = phrase_starts(load(src / "vocals.wav"))
    tempo = tempo_windows(load(src / "instrumental.wav"))
    mix = load(src / "audio.wav")
    loud = 20 * np.log10(rms_frames(mix) + 1e-6)
    per2 = [loud[int(t / (HOP / SR)):int((t + 2) / (HOP / SR))].mean() for t in np.arange(0, len(mix) / SR - 1, 2)]

    rep = [f"# Timing report: {args.song}", "", f"Duration {len(mix) / SR:.2f} s.", ""]
    if lines:
        al = json.loads((src / "align.json").read_text(encoding="utf-8"))
        rep += ["## Forced alignment of the written lines on the vocal stem", "",
                "Start and end per line, then word onsets. First words are often stretched.", ""]
        for s in al["segments"]:
            rep.append(f"- {s['start']:7.2f} {s['end']:7.2f}  {s['text'].strip()}")
            rep.append("  " + " | ".join(f"{w['word'].strip()}@{w['start']:.2f}" for w in s["words"]))
        rep.append("")
    tr = json.loads((src / "transcript.json").read_text(encoding="utf-8"))
    rep += ["## Free transcription of the vocal stem (a hint, may be invented)", ""]
    for s in tr["segments"]:
        rep.append(f"- {s['start']:7.2f} {s['end']:7.2f}  {s['text'].strip()}")
    rep += ["", "## Vocal phrase starts (after at least 0.25 s of silence)", "",
            " ".join(f"{t:.2f}" for t in starts), "",
            "## Tempo per 16 s window (instrumental stem; bpm, first beat, fit score; scores near 1 mean no pulse)", ""]
    for a, b, bpm, first, sc in tempo:
        rep.append(f"- {a:6.1f}-{b:6.1f}  {bpm:6.2f} BPM  first beat {first:7.3f}  score {sc:.2f}")
    rep += ["", "## Mix loudness per 2 s (dBFS), for sections", "",
            " ".join(f"{i * 2}:{v:.0f}" for i, v in enumerate(per2)), ""]
    (src / "timing-report.md").write_text("\n".join(rep), encoding="utf-8")
    print(f"{args.song}: {len(lines)} written lines, {len(starts)} phrase starts, report written")


if __name__ == "__main__":
    main()
