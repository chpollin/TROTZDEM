---
name: code-musikvideo
description: Baut zu einem eigenen Song ein Musikvideo, das vollständig aus Code entsteht. Ein JavaScript-Programm berechnet jedes Bild aus Takt, Lautstärke und Gesang, ein Browser rendert es, ffmpeg setzt das Video zusammen. Verwenden, wenn jemand aus einer Audiodatei (und optional dem Liedtext) ein Musikvideo ohne Bild- oder Videomodell erzeugen will.
---

# Code-Musikvideo

Ein Musikvideo als Programm. Die Funktion `drawScene(ctx, t)` malt zu jedem Zeitpunkt `t` des Songs ein vollständiges Bild auf eine Zeichenfläche mit 1920 × 1080 Pixeln. Python bereitet das Audio auf, ein Browser ohne Fenster ruft die Funktion Bild für Bild auf, und ffmpeg setzt die Bilder mit der Tonspur zum Video zusammen. Die Referenzimplementierung ist das Album TROTZDEM, https://github.com/chpollin/TROTZDEM, mit der Beschreibung der Pipeline in `knowledge/video-pipeline-architecture.md` und den Werkzeugen in `video/` (MIT-Lizenz).

## Voraussetzungen

- Python 3.11 mit Playwright (`pip install playwright`, danach `playwright install chromium`) und numpy
- ffmpeg im Pfad
- Für Stimmtrennung und Textausrichtung eine eigene virtuelle Umgebung mit `audio-separator` und `stable-ts` (Whisper). Mit NVIDIA-Grafikkarte geht das in Minuten, auf der CPU dauert es deutlich länger. Unter Windows torch 2.8 verwenden und nach `stable-ts` die CUDA-Fassung von torch mit `--force-reinstall --no-deps` erneut installieren, weil `stable-ts` sie durch eine CPU-Fassung ersetzt.
- Die Audiodatei als WAV und, wenn vorhanden, der Liedtext

## Ablauf

1. **Projekt anlegen.** Aus dem TROTZDEM-Repository `video/player.html`, `video/fonts/` und aus `video/tools/` die Dateien `render.py`, `analyze.py`, `prepare.py`, `prepare_local.py` und `serve.py` übernehmen. Pro Song entsteht ein Ordner `<song>/` mit `source/audio.wav` und, wenn vorhanden, `source/lyrics.txt` mit einer gesungenen Zeile pro Zeile. `source/` und `out/` kommen in `.gitignore`.

2. **Audio aufbereiten.** `python tools/prepare_local.py <song>` in der Umgebung mit `audio-separator` und `stable-ts` ausführen, bei bekannter Sprache mit `--language de`. Das Skript schreibt alles nach `<song>/source/` und `<song>/analysis.js`:
   1. Stimme und Instrumente getrennt, mit dem Modell `model_bs_roformer_ep_317_sdr_12.9755.ckpt`, als `vocals.wav` und `instrumental.wav`
   2. Lautstärke, Anschlagstärke und Anschläge in 50 Werten pro Sekunde sowie die Lautstärke der Stimme in `analysis.js`
   3. bei vorhandenem Liedtext seine zeilenweise Ausrichtung auf die Stimme mit Whisper large-v3, dazu immer eine freie Transkription
   4. Phrasenanfänge aus der Lautstärke der Stimme und das Tempo in Fenstern von 16 Sekunden aus der Instrumentalspur
   5. alles zusammen im Bericht `timing-report.md`

3. **Text prüfen.** Whisper halluziniert bei Gesang, typisch ist „Thanks for watching!“ an Stellen ohne Sprache, und Dialekt erkennt es oft nicht. Ohne verlässlichen Liedtext erscheinen im Video keine Liedzeilen. Dann den Menschen nach dem Text fragen oder das Video ohne Liedtext gestalten, etwa nur mit dem Titel. Der Aligner zieht das erste Wort einer Zeile oft zu früh. Wo Ausrichtung und Phrasenanfang auseinanderliegen, gilt der Phrasenanfang.

4. **Konzept festlegen.** Eine einzige starke Bildidee pro Song, die aus Titel, Text und Klang folgt, und eine Akzentfarbe, die eine feste Bedeutung trägt. Die lautesten Stellen bekommen die stärksten Bilder, die stillste Stelle ist wirklich still. Das Konzept steht in fünf bis acht Zeilen als Kommentar am Anfang von `scene.js`.

5. **Zeitleiste schreiben.** `<song>/timeline.js` definiert `TL` mit Abschnitten und Zeilenanfängen, `SCENE_END` (die Länge des Audios) und `SCENE_TITLE`. Jeder Zeitpunkt ist aus dem Bericht belegt, die Belege stehen als Kommentar im Kopf der Datei.

6. **Szene programmieren.** `<song>/scene.js` definiert `function drawScene(ctx, t)` als klassisches Skript. Die Funktion hängt nur von `t`, der Zeitleiste und `analysis.js` ab. Zufall kommt ausschließlich aus Generatoren mit festem Startwert (etwa mulberry32), `Math.random` und `Date` sind verboten. Der Grund ist das parallele Rendern, bei dem Bilder in beliebiger Reihenfolge entstehen und trotzdem identisch sein müssen. Zusätzliche Schriften nur unter SIL Open Font License, lokal im Songordner und über `SCENE_FONT_FACES` geladen. Zur Laufzeit gibt es keine Netzwerkzugriffe.

7. **Mit Standbildern iterieren.** `python tools/render.py <song> --still 12 40 95 130` rendert einzelne Bilder nach `out/`. Die Bilder ansehen und streng wie ein Art Director beurteilen, dann überarbeiten. Mindestens drei Runden, dazu dichte Standbilder um jeden Abschnittswechsel. Für Übersichten die Bilder auf höchstens 320 Pixel Breite verkleinern und zu einem Kontaktbogen zusammensetzen. Ein zweiter Agent kann einen Kontaktbogen unabhängig kritisieren.

8. **Video rendern.** `python tools/render.py <song> --workers 2` schreibt `out/<song>.mp4` mit 30 Bildern pro Sekunde. Danach mit ffprobe prüfen, dass Bild und Ton gleich lang sind, und einige Bilder aus dem fertigen Video gegen die Standbilder halten.

9. **Machart beschreiben.** Ein Absatz in `<song>/making.txt` beschreibt Bühne, zentrale Idee und die stärksten Bilder, sachlich und konkret.

## Ressourcen

Das Rendern läuft lokal, auch wenn das Sprachmodell in der Cloud arbeitet. Jeder Worker startet einen Browser und einen ffmpeg-Prozess. Acht gleichzeitig rendernde Agenten haben einen Rechner mit Grafikkarte und reichlich Arbeitsspeicher fast einfrieren lassen. Deshalb rendert immer nur ein Agent, mit höchstens zwei Workern, Standbilder entstehen in Stapeln von höchstens acht, und zwei schwere Befehle laufen nie gleichzeitig.

## Grenzen

- Keine echten Marken, Logos und keine Nachbildung echter Software-Oberflächen.
- Großflächiges Blitzen höchstens dreimal pro Sekunde.
- Liedtext erscheint nur, wenn er verlässlich ist.
- Bei Songs aus Suno erlauben die Nutzungsbedingungen eine öffentliche Verwendung nur für Audio aus dem offiziellen Download eines bezahlten Abos.
