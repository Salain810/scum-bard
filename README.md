# scum-bard

Scum bard is a Node.js script wich converts MIDI commands into keyboard key presses in order to play music instruments in SCUM game.

Currently there is a limitation for a total amount of notes that can be played. Right now it's 400... ish. Under the hood this script executes a jar file and passes in tons of command line arguments in a single batch. OS has a limitation on the maximum command line arguments wich can be passed to a an exutable, therefore this fact limits the amount of notes you can play.

The quality of the "output" heavily depends on the midi file.  
So, for example, if you are using tabbing software to create a tab first and then export it to midi, keep the source tab as simple as you can: e.g.: no odd time signatures, no fancy legatos, dead notes, palm mutes and so on.  

## Installation
In order to run this script, you need to have a Node.js installed. You can grab it here https://nodejs.org/en/.

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

### Fix the bug in 'node-key-sender' module
There is a bug (still) wich prevents module from finding its own jar executable. To fix that:

```console
cd node_modules/node-key-sender
```
in file 'key-sender.js' change the line 115 to be 
```javascript
var command = 'java -jar "' + jarPath + '" ' + arrParams.join(' ') + module.getCommandLineOptions();
```

## Preparing MIDI file
Because there is currently a limitation on the total amount of notes that can be played (~400), you probably wount be able to use midi files that you can download from the web, because the majority of them is more than 400 notes in length.

But if you still managed to find a suitable midi, keep in mind the fact that midi files are polyphonic, meaning that there is more than 1 midi track can be playing at a given time. You have to feed a specific track number to scum-bard in that case.

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

If you encounter an `"The command line is too long"` exception, that means that the midi file you are using has more than 400 notes. For now, all you can do is trim the file to be less than 400 notes in length