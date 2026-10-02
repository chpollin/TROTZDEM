# TROTZDEM

TROTZDEM is an album of personal songs written over the last two years, together with a series of music videos rendered entirely from code. The album page is published at https://chpollin.github.io/TROTZDEM/.

The songs are AI-generated. The music comes from Suno (model v5), the lyrics from Claude Opus, based on prompts, reflections and deep-research results selected and assembled by Christopher Pollin. The videos and the website were written by Claude Opus 5.5 in Claude Code. Each video is a JavaScript program that draws every frame as a function of time, without any image or video model.

## Repository

- `index.html` is the album page, carried by `video/album.css`, `video/album.js` and the generated `video/album.json`.
- `video/` holds one folder per song with its scene, timeline and audio analysis, plus the Python tools for preparation, rendering and publishing. [video/README.md](video/README.md) has the commands.
- `knowledge/` holds the project knowledge, starting at [knowledge/INDEX.md](knowledge/INDEX.md). How the videos are produced is described in [knowledge/video-pipeline-architecture.md](knowledge/video-pipeline-architecture.md).
- `chat.html` with `style.css` and `img/` is the first version of the album site (2025).

The rendered videos are attached to the GitHub release `videos` because they are too large for the repository.

## License

Code is MIT licensed, text and documentation CC BY 4.0. The fonts in `video/fonts/` keep their SIL Open Font License. The songs, their audio and lyrics are not covered by these licenses.
