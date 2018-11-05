const ks = require('node-key-sender')
const fs = require('fs')
const mc = require('midiconvert')
const _ = require('lodash')
const musicNotation = require('./midi')

// Get command line args
const args = process.argv.slice(2)
let midiFileName = '' // MIDI file to read
let midiTrackNumber = 0 // MIDI track number to play
if (args.length != 0) {
    midiFileName = args[0]
    midiTrackNumber = args[1]
} else {
    console.log('Error: invalid number of arguments')
    process.exit(1)
}

// Default key mappings
let noteToKey = new Map()
noteToKey.set('c', 'r')
noteToKey.set('c#', '5')
noteToKey.set('d', 't')
noteToKey.set('d#', '6')
noteToKey.set('e', 'y')
noteToKey.set('f', 'u')
noteToKey.set('f#', '8')
noteToKey.set('g', 'i')
noteToKey.set('g#', '9')
noteToKey.set('a', 'o')
noteToKey.set('a#', '0')
noteToKey.set('b', 'p')

ks.setOption('globalDelayPressMillisec', 0)

/**
 * @function  play
 * @param {Object} newChunk Parsed MIDI object
 */
function play(newChunk) {
    ks.startBatch()
    let notesCount = 0
    _.forEach(newChunk, (key, value) => {
        // Single note
        if (key.length == 1) {
            let noteDuration = key[0].duration * 1000 // to get ms 
            let noteName = musicNotation(key[0].midi)
            let keyName = noteToKey.get(noteName)
            // console.log('----- single note ------')
            // console.log('note: ' + noteName)
            // console.log('duration: ' + noteDuration)
            ks.batchTypeKey(keyName, noteDuration, ks.BATCH_EVENT_KEY_DOWN)
            ks.batchTypeKey(keyName, ks.BATCH_EVENT_KEY_UP)
            notesCount++
        } else {
            // Chord
            // console.log('----- chord -----')
            let chord = [] // notes in chord
            let keyBoardChord = [] // notes mapped to keyboard keys
            let duration = 0 // chord duration in ms
            for (const note of key) {
                // console.log('note: ' + musicNotation(note.midi))
                // console.log('duration: ' + note.duration * 1000)
                // chord.push(musicNotation(note.midi))
                keyBoardChord.push(noteToKey.get(musicNotation(note.midi)))
                duration = note.duration * 1000 // to get ms
                notesCount++
            }
            console.log('chord notes: ' + chord)
            console.log('Length: ' + key.length)
            ks.batchTypeCombination(keyBoardChord, duration, ks.BATCH_EVENT_KEY_DOWN)
            ks.batchTypeCombination(keyBoardChord, ks.BATCH_EVENT_KEY_UP)
        }
    })
    console.log(`\nTotal notes: ${notesCount}`)
    const prom = ks.sendBatch()
    return prom
}


fs.readFile(__dirname + `/data/${midiFileName}.mid`, "binary", (err, midiBlob) => {
    if (!err) {
        let midi = mc.parse(midiBlob)
        // Find chords. Notes with the same time value form an chord.
        let chords = _.groupBy(midi.tracks[midiTrackNumber].notes, (n) => {
            return n.time;
        })
        // No chords found
        if (chords == '') {
            chords = midi.tracks[midiTrackNumber]
        }
        //console.log(chords)
        play(chords)
    } else {
        console.log(err.message)
        process.exit(1)
    }
})