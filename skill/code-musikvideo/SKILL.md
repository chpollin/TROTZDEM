---
name: code-musikvideo
description: Baut zu einem Song ein Musikvideo, das vollständig aus Code entsteht, ohne Bild- oder Videomodell. Ein JavaScript-Programm berechnet jedes Bild aus Takt, Lautstärke und Gesang, ein Browser rendert es, ffmpeg setzt das Video zusammen. Verwenden, wenn jemand aus einer Audiodatei (mit oder ohne Liedtext) ein Musikvideo, mehrere Fassungen eines Videos oder ein Erklärvideo ohne Musik aus Code erzeugen will.
---

# Code-Musikvideo

Ein Video als Programm. Die Funktion `drawScene(ctx, t)` malt zu jedem Zeitpunkt `t` ein vollständiges Bild auf eine Zeichenfläche mit 1920 × 1080 Pixeln. Python bereitet das Audio auf und misst es, ein Browser ohne Fenster ruft die Funktion Bild für Bild auf, und ffmpeg setzt die Bilder mit der Tonspur zusammen. Die Referenzimplementierung ist das Album TROTZDEM, https://github.com/chpollin/TROTZDEM, mit den Werkzeugen in `video/` (MIT-Lizenz) und der Beschreibung der Pipeline in `knowledge/video-pipeline-architecture.md`.

## Prinzip

Jedes Video durchläuft dieselben Stufen. Jede Stufe hat eine Datei und eine Regel, an der sie geprüft wird.

| Stufe | Datei | Regel |
|---|---|---|
| Messen | `<song>/source/timing-report.md`, `<song>/analysis.js` | erzeugt, nie von Hand geändert |
| Belegen | `<song>/timeline.js` | jeder Zeitpunkt ist im Bericht oder in der Lautstärke der Stimme belegt, die Belege stehen im Kopf der Datei |
| Zeichnen | `<song>/scene.js` | reine Funktion der Zeit, gleiche Eingabe ergibt das gleiche Bild |
| Prüfen | `<song>/out/still-*.png` | Standbilder in mehreren Runden, streng beurteilt |
| Rendern | `<song>/out/<song>.mp4` | Bild und Ton gleich lang, Bilder aus dem Video entsprechen den Standbildern |

Ein Video aus Code behauptet etwas über die Musik und den Text. Es zeigt deshalb nur, was gemessen oder belegt ist. Liedtext, der nur geraten ist, erscheint nicht als Liedtext.

## Voraussetzungen

- Python 3.11 mit Playwright (`pip install playwright`, danach `playwright install chromium`) und numpy
- ffmpeg im Pfad
- Für Stimmtrennung und Spracherkennung eine eigene virtuelle Umgebung mit `audio-separator` und `stable-ts` (Whisper large-v3). Mit einer NVIDIA-Grafikkarte dauert ein Song wenige Minuten, auf der CPU deutlich länger. Unter Windows torch 2.8 verwenden und nach `stable-ts` die CUDA-Fassung von torch mit `--force-reinstall --no-deps` erneut installieren, weil `stable-ts` sie durch eine CPU-Fassung ersetzt.
- Die Audiodatei als WAV und, wenn vorhanden, der Liedtext mit einer gesungenen Zeile pro Zeile

## Ablauf

1. **Projekt anlegen.** Das TROTZDEM-Repository klonen und in ein eigenes Projekt übernehmen: `video/player.html`, `video/fonts/` sowie aus `video/tools/` die Dateien `render.py`, `analyze.py`, `prepare.py`, `prepare_local.py` und `serve.py`. Pro Song entsteht ein Ordner `<song>/` mit `source/audio.wav` und gegebenenfalls `source/lyrics.txt`. `*/source/` und `*/out/` kommen in `.gitignore`, weil Audio und Renderings groß sind und sich jederzeit neu erzeugen lassen.

2. **Audio messen.** `python tools/prepare_local.py <song>` in der Umgebung mit `audio-separator` und `stable-ts` ausführen, bei bekannter Sprache mit `--language de`. Das Skript schreibt nach `<song>/source/` und `<song>/analysis.js`:
   1. Stimme und Instrumente getrennt als `vocals.wav` und `instrumental.wav`, mit dem Modell `model_bs_roformer_ep_317_sdr_12.9755.ckpt`
   2. Lautstärke, Anschlagstärke und Anschläge in 50 Werten pro Sekunde sowie die Lautstärke der Stimme (`AUDIO_VOX`) in `analysis.js`
   3. bei vorhandenem Liedtext die zeilen- und wortweise Ausrichtung auf die Stimme, dazu immer eine freie Transkription
   4. Phrasenanfänge aus der Stimme und das Tempo in Fenstern von 16 Sekunden aus der Instrumentalspur
   5. alles zusammen im Bericht `timing-report.md`

3. **Text klären.** Spracherkennung ist bei Gesang unzuverlässig, und die Fehler sind systematisch.
   - Whisper erfindet Text an Stellen ohne Sprache, typisch ist „Thanks for watching!“, und versteht Dialekt oft gar nicht. Fehlt ein verlässlicher Liedtext, den Menschen danach fragen, etwa nach dem Text von der Website der Band oder aus dem Feld „Lyrics“ bei Suno. Bis dahin das Video ohne Liedzeilen gestalten.
   - Die Ausrichtung zieht das erste Wort einer Zeile oft weit in die Pause davor. Wo sie und der Phrasenanfang oder der Anstieg von `AUDIO_VOX` auseinanderliegen, gilt der Anstieg der Stimme.
   - In Refrains mit Wiederholungen bricht die Ausrichtung oft zusammen. Dort die Zeitpunkte aus der freien Transkription nehmen, wenn sie die Wörter klar erkennt, sonst aus der Lautstärke der Stimme.
   - Gesungen wird oft anders als geschrieben: zusätzliche Wiederholungen, Ausrufe, wortlose Schreie, fehlende Zeilen. Was im Text fehlt, wird anhand der Stimme entschieden und im Kopf von `timeline.js` begründet. Wortlose Passagen bekommen keinen Text.
   - Bei Unsicherheit kurze Fenster von wenigen Sekunden erneut transkribieren, wenn nötig mit dem bekannten Text als Vorgabe.

4. **Takt selbst messen.** Angaben im Stil-Prompt zu Tempo und Taktart stimmen oft nicht. Tempo und erste Zählzeit aus der Instrumentalspur bestimmen, bei Tempowechseln abschnittsweise. Ob eine Taktart wie 7/8 tatsächlich gespielt wird, zeigt sich, wenn man die Anschläge auf die vermutete Taktlänge faltet und eine Betonung sichtbar wird.

5. **Konzept festlegen.** Eine einzige Bildidee pro Song, die aus Titel, Text und Klang folgt, ausgeführt mit Tiefe statt mit vielen Effekten. Dazu eine Akzentfarbe, die genau eine Bedeutung trägt und sonst nirgends vorkommt. Das Konzept steht in fünf bis acht Zeilen als Kommentar am Anfang von `scene.js`. Bewährte Regeln:
   - Die lautesten Stellen bekommen die stärksten Bilder, die stillste Stelle ist wirklich still.
   - Keine toten Strecken von mehr als wenigen Sekunden, keine zu dunkle Gesamtbelichtung.
   - Jede Liedzeile erscheint Wort für Wort, während sie gesungen wird, in einem freien Bereich und mindestens etwa 70 Pixel hoch.
   - Übergänge sind gestaltet, keine Nähte zwischen Abschnitten.
   - Ernste Zeilen, etwa über Tod oder Selbstzweifel, werden zurückhaltend inszeniert, ohne Effekte und ohne Melodram.
   - Mehrere Fassungen eines Songs unterscheiden sich im Medium, nicht nur in Farben, zum Beispiel Kreidezeichnung, kinetische Typografie und Linolschnitt.

6. **Zeitleiste schreiben.** `<song>/timeline.js` definiert `TL` mit Abschnitten, Zeilen und Schlüsselmomenten, `SCENE_END` als Länge des Audios und `SCENE_TITLE`. Im Kopf steht für jeden korrigierten Zeitpunkt der Beleg.

7. **Szene programmieren.** `<song>/scene.js` definiert `function drawScene(ctx, t)` als klassisches Skript, das `player.html` nach `analysis.js` und `timeline.js` lädt.
   - Die Funktion hängt nur von `t`, der Zeitleiste und den Messdaten ab. Zufall kommt nur aus Generatoren mit festem Startwert, etwa mulberry32. `Math.random`, `Date` und Zustand zwischen zwei Bildern sind ausgeschlossen, weil Bilder parallel und in beliebiger Reihenfolge entstehen und trotzdem gleich sein müssen.
   - Zusätzliche Schriften nur unter SIL Open Font License, lokal im Songordner mit Lizenzdatei, geladen über `SCENE_FONT_FACES`.
   - Bilder wie ein Faksimile nur mit freier Lizenz und als Data-URI einbinden. Ein lokaler Bildpfad sperrt unter `file://` den Export der Zeichenfläche.
   - Zur Laufzeit gibt es keine Netzwerkzugriffe.

8. **Mit Standbildern iterieren.** `python tools/render.py <song> --still 12 40 95 130` rendert einzelne Bilder nach `out/`. Die Bilder ansehen und streng wie ein Art Director beurteilen, dann überarbeiten. Mindestens drei Runden, dazu dichte Standbilder um jeden Abschnittswechsel und Zeilenanfang. Für Übersichten die Bilder auf höchstens 320 Pixel Breite verkleinern und zu einem Kontaktbogen zusammensetzen.

9. **Rendern und prüfen.** `python tools/render.py <song> --workers 2` schreibt `out/<song>.mp4` mit 30 Bildern pro Sekunde, `--phone` zusätzlich eine 720p-Kopie. Danach prüfen:
   - mit ffprobe, dass Bild und Ton gleich lang sind
   - einige Bilder aus dem fertigen Video gegen die Standbilder
   - `node --check` für `scene.js` und `timeline.js`
   - die Reinheit, indem ein Bild nach anderen erneut gerendert wird und gleich bleibt

10. **Machart beschreiben.** Ein Absatz in `<song>/making.txt` beschreibt Bühne, zentrale Idee und die stärksten Bilder, sachlich und konkret.

11. **Weitergeben.** Für eine Website eine kleinere Fassung (libx264, CRF 28, `-movflags +faststart`), für Messenger 720p mit CRF 25 und AAC mit 128 kbit/s. Drei Minuten ergeben dann meist 10 bis 25 MB. Große Videos gehören nicht ins Repository. GitHub-Release-Assets unterstützen Byte-Bereiche und lassen sich im Browser spulen.

## Ohne Musik

Ein Erklärvideo nutzt dieselbe Pipeline. `source/audio.wav` ist dann Stille (`ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo -t 240 audio.wav`), `analysis.js` enthält leere Felder, und `SCENE_END` bestimmt die Länge. Das Tempo gibt die Lesezeit vor, kein Element ändert sich schneller, als man folgen kann. Was das Video als Tatsache zeigt, stammt aus belegten Quellen, etwa eine veröffentlichte Transkription oder Normdaten, die über eine Schnittstelle wie lobid.org bestätigt sind. Quellen und Lizenzen stehen in einer `SOURCES.md` im Projekt.

## Mit mehreren Agenten

Pro Video arbeitet ein eigener Agent. Die koordinierende Sitzung übergibt ein Briefing und prüft das Ergebnis selbst, bevor es veröffentlicht wird.

Das Briefing enthält:
- Song, Ordner, Länge und was über Text und Takt schon bekannt ist
- die fertigen Videos als Referenz für Handwerk, mit der Vorgabe, dass sich die neue Bühne davon unterscheidet
- eine Bühnenidee als Vorschlag, den der Agent verbessern darf
- die Regeln aus den Schritten 3 bis 10 und die Grenzen der Ressourcen
- die erlaubten Schreibpfade und das Verbot, zu committen oder zu veröffentlichen
- den Hinweis, Liedtexte und Gedichte in eigenen Ausgaben nicht in längeren Passagen zu zitieren, weil Inhaltsfilter sonst Ausgaben blockieren können

Der Bericht des Agenten enthält Konzept, Abschnitte mit Zeiten, die stärksten Momente, was wie geprüft wurde, bekannte Schwächen, einen Zeitpunkt für das Vorschaubild, die Akzentfarbe und die Dateipfade. Die koordinierende Sitzung prüft Länge, Code und einige Bilder aus dem fertigen Video, bevor sie den Bericht weitergibt.

## Ressourcen

Das Rendern läuft lokal, auch wenn das Sprachmodell in der Cloud arbeitet. Jeder Worker startet einen Browser und einen ffmpeg-Prozess. Rund acht gleichzeitige Renderings haben einen gut ausgestatteten Rechner fast einfrieren lassen. Deshalb gilt:
- höchstens zwei Worker pro Agent
- Standbilder in Stapeln von höchstens vier bis acht
- ein vollständiges Rendern nur, wenn gerade kein anderes ffmpeg läuft (Windows `tasklist | findstr ffmpeg`, macOS und Linux `pgrep ffmpeg`)
- nie zwei schwere Befehle wie Stimmtrennung und Rendern gleichzeitig

Mehrere Agenten können unter diesen Grenzen nebeneinander Code schreiben und Standbilder prüfen.

## Grenzen

- Keine echten Marken, Logos und keine Nachbildung echter Software-Oberflächen.
- Großflächiges Blitzen höchstens dreimal pro Sekunde.
- Liedtext und Fakten erscheinen nur, wenn sie verlässlich sind.
- Bei Songs aus Suno erlauben die Nutzungsbedingungen eine öffentliche Verwendung nur für Audio aus dem offiziellen Download eines bezahlten Abos. Fremde Songs nur mit Zustimmung der Urheber.
