# Third-party licenses

This project's own code is MIT-licensed (see `LICENSE`). It depends on two
runtime components that carry their own, different terms. Read these before you
self-host commercially.

## Remotion (the rich render and preview engine)

Remotion is **not** open source. It is source-available under the
[Remotion License](https://www.remotion.dev/docs/license):

- Free for individuals and for companies of up to 3 people.
- Companies with 4 or more people need a paid company license (per seat).

The obligation falls on whoever runs Remotion. That means you, the self-hoster,
not this project. Publishing this MIT code that depends on Remotion does not grant
you Remotion's paid rights.

If you are a company over that threshold you have two options:

1. Buy Remotion seats, or
2. Use only the ffmpeg render lane (`FfmpegDriver`) and do not invoke the
   Remotion-backed compositions. The render seam (`RenderDriver`) exists so a
   fully license-free backend can replace Remotion without touching the rest of
   the app. Note the browser preview also uses `@remotion/player`, which is
   under the same license.

## FFmpeg (the fast render lane)

The `FfmpegDriver` invokes the `ffmpeg` binary as a separate process. FFmpeg is
distributed under the LGPL or GPL depending on how it was built. Because it is
called as an external executable (not linked), it stays a runtime dependency;
supply your own `ffmpeg` build appropriate to your distribution terms.
