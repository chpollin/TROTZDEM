"""Separate the vocals and force-align the known lyrics to them.

Runs in the project venv (see README). Writes source/vocals.wav and
source/align.json and prints one start time per sung line, which are then
copied into timeline.js by hand: screamed passages need a human ear.
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "source"

# Sung lines without Suno's stage directions, one per line.
LINES = """Tab eins: Therapeuten Graz
Tab zwei: Warum bin ich müde
Tab siebzehn: Wohnungen unter tausend
Tab dreißig: Kündigungsschreiben Vorlagen
Tab fünfzig: Harald Schmidt Best Of
Tab achtzig: Wie lösche ich mich selbst
Jeder Tab ein ungelebtes Leben
Jeder Tab ein stummer Schrei
Neunundachtzig Parallelfluchtpunkte
Keiner führt hier raus, nur tiefer rein
Die Summe meiner offenen Tabs
Ist größer als ich selbst
Tab neunzig
Neunundachtzig Tabs
Tab hundert: Lass uns bleiben
Tab hundert und eins: was wir sind
Neunundachtzig Tabs
Lass uns bleiben, was wir sind"""


def separate():
    vocals = SRC / "vocals.wav"
    if vocals.exists():
        return vocals
    from audio_separator.separator import Separator

    sep = Separator(output_dir=str(SRC), output_format="WAV")
    sep.load_model("model_bs_roformer_ep_317_sdr_12.9755.ckpt")
    for f in sep.separate(str(SRC / "audio.wav")):
        f = SRC / Path(f).name
        if "(Vocals)" in f.name:
            f.replace(vocals)
        else:
            f.replace(SRC / "instrumental.wav")
    return vocals


def main():
    import stable_whisper

    vocals = separate()
    model = stable_whisper.load_model("large-v3", device="cuda")
    result = model.align(str(vocals), LINES, language="de", original_split=True)
    result.save_as_json(str(SRC / "align.json"))
    for seg in json.loads((SRC / "align.json").read_text(encoding="utf-8"))["segments"]:
        print(f"{seg['start']:7.2f} {seg['end']:7.2f}  {seg['text'].strip()}")


if __name__ == "__main__":
    main()
