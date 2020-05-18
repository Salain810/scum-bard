# scum-bard

Scum bard is a Node.js script wich converts MIDI commands into keyboard key presses in order to play music instruments in SCUM game.

The quality of the "output" heavily depends on the midi file.  
So, for example, if you are using tabbing software to create a tab first and then export it to midi, keep the source tab as simple as you can: e.g., no odd time signatures, no fancy legatos, dead notes, palm mutes and so on.  

## Installation

### Install dependencies
This project requires that Node.js and Java are both installed.
* Install Node.js from https://nodejs.org/
* Install Java from https://www.java.com/en/download/manual.jsp

### Install scum-bard
After Node.js has been installed, the `scum-bard` application can be install with `npm` (node package manager):
```shell
npm install -g gitlab:douglasmiller/scum-bard
```

## Preparing MIDI file
But if you still managed to find a suitable midi, keep in mind the fact that midi files are polyphonic, meaning that there can be more than 1 midi track playing at the same time. You have to feed a specific track number to scum-bard in that case.

>
>There are some sample midi files in /data directory.
>

Alternatively, you can use any tabbing software to export tabs to MIDI. I'm personally using Guitar Pro.

## Running scum-bard

The `scum-bard` application expects that the filename of the MIDI file be specified with the `--file` flag when running the command:

```shell
scum-bard.cmd --file path/to/file.mid
```

Before launching a script make sure that your character is holding an instrument and is in "play instrument" mode.

You will have ~2 seconds to Alt-Tab back into Scum before the script starts sending keystrokes.

### Additional Parameters

#### Select Track To Play

Many MIDI files contain multiple tracks. `scum-bard` will try to play the first track (track `0`) by default. If you want to play a different track, then the track number can be specified on the command line with the `--track` flag:

```shell
scum-bard.cmd --file path/to/file.mid --track 1
```
#### Define Custom Keybindings

If you want to specify keybindings that are different from the default keybindings for instruments in Scum, then you can provide a custom keymap file with the `--keymap` flag:

```shell
scum-bard.cmd --file path\to\file.mid --keymap path\to\custom-keymap.json
```

A custom keymap file **must** be written as a valid JSON file. See the [default keymap.json](keymap.json) for reference.

#### Listing Available Tracks

The `--list-tracks` flag can be specified to list the tracks that can be played using `scum-bard`. This is useful when you are unsure about which track to play.

```shell
```

## Stopping scum-bard

The applicaion will exit automatically when it has finished playing all of the notes/chords in the MIDI file. If you want to exit `scum-bard` before the song has completed, then press Ctrl+c in the shell where you are running the command.