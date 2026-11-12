import { liveFrames } from '../report/liveFrames';
import { MjpegParts } from './mjpegParts';
import { PhoneFilm } from './phoneFilm';

/** reads the phone's picture stream on this computer's port into the film until stopped; a dropped stream is joined again */
async function play(port: number, film: PhoneFilm, stop: AbortController): Promise<void> {
  while (!stop.signal.aborted) {
    try {
      const answer = await fetch(`http://127.0.0.1:${port}/`, { signal: stop.signal });
      const reader = answer.body?.getReader();
      const parts = new MjpegParts();
      for (let piece = await reader?.read(); piece && !piece.done; piece = await reader?.read()) {
        for (const jpeg of parts.push(Buffer.from(piece.value))) await film.frame(jpeg);
      }
    } catch {
      // the stream is not up yet or dropped: try again while the test runs
    }
    if (!stop.signal.aborted) await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * The run's film of this phone test (the run screen's pictures, as the Java phone suites record them): started only for a
 * run started by Trova; gives back how to stop it. Never fails the test - without the stream the steps take screenshots.
 */
export function startFilm(port: number): () => void {
  if (!liveFrames.on()) return () => undefined;
  const film = new PhoneFilm((jpeg, step, every) => liveFrames.add(jpeg, step, 'jpg', every));
  const stop = new AbortController();
  PhoneFilm.current = film;
  void play(port, film, stop);
  return () => {
    if (PhoneFilm.current === film) PhoneFilm.current = undefined;
    stop.abort();
  };
}
