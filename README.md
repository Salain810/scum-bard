# scum-bard

Scum bard is a Node.js script wich converts MIDI commands into keyboard key presses in order to play music instruments in SCUM game.

The quality of the "output" heavily depends on the midi file.  
So, for example, if you are using tabbing software to create a tab first and then export it to midi, keep the source tab as simple as you can: e.g., no odd time signatures, no fancy legatos, dead notes, palm mutes and so on.  

## Installation
In order to run this script, you need to have a Node.js installed. You can grab it here https://nodejs.org/en/.
If you have no JRE installed, grab it from Oracle's website.

### Clone this repo
To clone this repo run:
```console
git clone https://gitlab.com/megahartz/scum-bard.git
```
or download it as a *.zip file

### Install dependencies
Inside you project directory run

```bash
npm install
```
This will download all the needed node packages.

## Preparing MIDI file
But if you still managed to find a suitable midi, keep in mind the fact that midi files are polyphonic, meaning that there can be more than 1 midi track playing at the same time. You have to feed a specific track number to scum-bard in that case.

>
>There are some sample midi files in /data directory.
>

Alternatively, you can use any tabbing software to export tabs to MIDI. I'm personally using Guitar Pro.

## Starting the show
Script accepts 2 parameters: `midiFileName` and `midiTrackNumber`.

`midiFileName` - file name without extention, relative to /data dir.  
`midiTrackNumber` - MIDI track number, starts from 0

Before launching a script make sure that your character is holding an instrument and is in "play instrument" mode.

Tab out and type in console:

```console
node index.js 13 0
```
Hit enter. You'll have ~2s to tab back into the game before script starts sending keystrokes.