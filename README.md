# scum-bard

Scum bard is a Node.js script which converts MIDI files into keyboard key presses to play music instruments in SCUM.

It automatically compresses songs to fit SCUM's 3-octave instrument range, cleans up duplicate notes, and handles timing so playback stays on beat.

## Requirements

* **Node.js** 20.19.0 or higher - [Download here](https://nodejs.org/)
* **Java** - Required for the key-sender component - [Download here](https://www.java.com/en/download/manual.jsp)

## Installation

After installing Node.js and Java (see Requirements above), clone this repository and install dependencies:

```shell
git clone https://github.com/Salain810/scum-bard.git
cd scum-bard
npm install
```

## Preparing MIDI Files

The quality of the output heavily depends on the MIDI file. Keep these tips in mind:

- **Simpler is better** - Avoid odd time signatures, legatos, dead notes, and palm mutes when exporting from tabbing software.
- **Pick the right track** - MIDI files are polyphonic (multiple tracks playing at once). Use `--list-tracks` to find the track you want, then specify it with `--track`.
- **Guitar tracks work best** - Single instrument tracks (especially guitar) give the cleanest results.

There are sample MIDI files in the `/data` directory to get started.

You can use tabbing software like **Guitar Pro** or **MuseScore** (free) to export tabs as MIDI files.

## How It Works

### Octave Compression

SCUM instruments only support 3 octaves. When a MIDI file spans more than that, scum-bard automatically compresses it:

1. Finds the 3-octave window that fits the most notes
2. Folds out-of-range notes by whole octaves to keep them in key
3. Removes duplicate pitches within chords that collapse after folding

This preserves melody and chord quality — a C stays a C, an Am chord stays Am.

### Timing

Each note is held for its MIDI duration or until the next note starts, whichever comes first. Gaps between notes are preserved as rests. This keeps playback locked to the original tempo with zero drift.

### Chord Detection

Notes that occur within 50ms of each other are grouped as chords and played simultaneously. Duplicate pitches within a chord are automatically cleaned.

## Available Instruments in SCUM

As of SCUM 1.2 (2026), the following instruments are available in-game:

- **Guitar** - Works with all standard guitar melodies and tabs
- **Banjo** - Same keyboard controls as guitar
- **Harmonica** (Mouth Organ) - Same keyboard controls as guitar

All instruments use the same keyboard controls. While they share the same keybindings, different instruments may sound better for certain songs.

## Where to Find MIDI Files

### General MIDI Libraries
- **[BitMidi](https://bitmidi.com/)** - 113,000+ free MIDI files ranging from video game music to classical
- **[MidiWorld](https://www.midiworld.com/)** - Large collection organized by genre
- **[Hyperbits](https://hyperbits.com/free-midi-files/)** - 1,368+ free MIDI files with melodies and chord progressions

### Classical & Folk Music
- **[Kunstderfuge](https://www.kunstderfuge.com/)** - 19,300+ classical MIDI files, public domain
- **[Classical Archives](https://www.classicalarchives.com/midi.html)** - Hundreds of thousands of classical music files
- **[Mfiles](https://www.mfiles.co.uk/midi-files.htm)** - Classical and folk music, includes traditional songs

### Guitar-Specific
- **[Slooply](https://slooply.com/midi/instrument/guitar)** - Royalty-free guitar MIDI files and loops
- **Ultimate Guitar** - Use Guitar Pro tabs and export to MIDI (requires Guitar Pro software)

### Creating Your Own
If you have **Guitar Pro** or **MuseScore** (free), you can:
1. Download guitar tabs from sites like Ultimate Guitar
2. Open in Guitar Pro or MuseScore
3. Export as MIDI file (File > Export > MIDI)
4. Simplify the tab before export (remove complex techniques, stick to single notes and simple chords)

## Usage

Make sure your character is holding an instrument and is in "play instrument" mode before running. You will have ~2 seconds to Alt-Tab back into SCUM before playback starts.

### Play a MIDI file

```shell
node index.js --file path/to/file.mid
```

### List available tracks

```shell
node index.js --file path/to/file.mid --list-tracks
```

### Play a specific track

```shell
node index.js --file path/to/file.mid --track 1
```

### Use a custom keymap

If your in-game keybindings differ from the defaults, provide a custom keymap JSON file:

```shell
node index.js --file path/to/file.mid --keymap path/to/custom-keymap.json
```

See [keymap.json](keymap.json) for the default mapping format.

### All options

| Flag | Alias | Description | Default |
|------|-------|-------------|---------|
| `--file` | `-f` | MIDI file to play (required) | |
| `--track` | `-t` | Track number to play | `0` |
| `--keymap` | `-k` | Custom keymap JSON file | built-in `keymap.json` |
| `--list-tracks` | `-l` | List available tracks and exit | `false` |

## Stopping Playback

The application exits automatically when the song finishes. To stop early, press `Ctrl+C` in the terminal.

## Credits

Originally created by [Paul Rin (megahartz)](https://gitlab.com/megahartz/scum-bard). This fork adds automatic octave compression, timing fixes, chord detection improvements, and duplicate note cleanup.

## License

ISC
