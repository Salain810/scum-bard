# scum-bard

Converts MIDI files into keyboard input to play music instruments in the game SCUM.

## Architecture

- `index.js` — CLI entry point. Parses args, loads MIDI, batches key events, sends them.
- `utils.js` — MIDI file parsing with tempo-aware timing. Uses `midi-file-parser` directly (not midiconvert) to build a tempo map that handles mid-song tempo changes correctly.
- `batchUtils.js` — Note/chord batching logic. Handles octave compression (folding notes into a 3-octave range), octave shifting via Ctrl/Shift keys, and timing calculations for key hold/rest durations.
- `midi.js` — Small helpers: `getMusicNotation` (MIDI number to note name), `getNoteOctave` (extract octave from note name string).
- `node-key-sender/` — Java-based key sender. Batches keyboard events with timing delays. Key format: `key.w{ms}[.up|.down]`.
- `keymap.json` — Maps note names (lowercase: c, c#, d, etc.) to keyboard keys for SCUM instruments.

## Key Design Decisions

### Tempo handling
We replaced midiconvert with direct `midi-file-parser` usage because midiconvert only captured the first `setTempo` event, ignoring all subsequent tempo changes. The current `buildTempoMap()` in utils.js handles multiple tempo changes by building a cumulative time map.

### Octave mapping — CRITICAL
SCUM instruments have 3 octave positions: LOW, MID, HIGH. Ctrl shifts down, Shift shifts up. The instrument resets to LOW via repeated Ctrl presses at the start.

**LOW must be the primary playing position.** The old code used a 1ms SHIFT_DELAY that was too fast for the game to register, so everything effectively played at LOW — and that sounded correct. Playing notes at MID or HIGH positions makes them sound higher than intended.

`getBaseOctave()` uses center-optimization to map the densest octave to LOW (offset 0). For 1-2 octave songs, ALL notes play at LOW. For 3-octave songs, only the highest octave shifts to MID. Avoid mappings that put the majority of notes at MID/HIGH — this was the cause of the "playing too high" bug.

### Octave compression
`compressChords()` folds notes into a 3-octave window by shifting whole octaves. It finds the window containing the most notes and folds outliers. Runs before octave mapping.

### Timing model
For each note/chord:
1. Octave shift overhead (SHIFT_DELAY per shift step)
2. Key down for holdTime (capped by gap to next note minus overhead)
3. Key up for restTime (remaining gap)

Total time per note = shift overhead + holdTime + restTime = gap to next note.

## Testing

No automated tests. Test by running against MIDI files in `data/`:
```bash
node index.js -f data/foggymtn.mid -t 2
node index.js -f "data/Red Hot Chili Peppers — Under the Bridge Acoustic Version [MIDIfind.com].mid" -t 0
node index.js -f <file> --list-tracks  # see available tracks
```

## Git

- Remote `origin` is GitHub: `Salain810/scum-bard`
- Push to `origin` (GitHub), not GitLab
