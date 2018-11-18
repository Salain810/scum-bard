const ks = require('./node-key-sender/key-sender')
const fs = require('fs')
const mc = require('midiconvert')
const _ = require('lodash')
const midi = require('./midi')

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

//ks.setOption('globalDelayPressMillisec', 0)

/**
 * @function  play
 * @param {Object} newChunk Parsed MIDI object
 */
function play(newChunk) {
    ks.startBatch()
    let notesCount = 0
    let baseOctave = 0
    let chordBaseOctave = 0
    let arChordOctaves = []

    let firstElementIndex = Object.keys(newChunk)[0]

    // First note is a chord
    if (newChunk[firstElementIndex].length > 1) {
        // get chord base octave
        console.log(`> First note is a chord`)
        newChunk[firstElementIndex].forEach(el => {
            arChordOctaves.push(midi.getNoteOctave(el.name))
        })
        chordBaseOctave = midi.getChordBaseOctave(arChordOctaves)
        baseOctave = chordBaseOctave
    } else {
        // First note is a single note
        console.log(`> First note is a single note`)
        let obj = [...newChunk[firstElementIndex]].forEach(el => {
            baseOctave = midi.getNoteOctave(el.midi)
        })
        chordBaseOctave = baseOctave
    }
    _.forEach(newChunk, (key, value) => {
        // Single note
        if (key.length == 1) {
            let noteDuration = key[0].duration * 1000 // to get ms 
            let noteName = midi.getMusicNotation(key[0].midi)
            const currentNoteOctave = midi.getNoteOctave(key[0].name)
            let keyName = noteToKey.get(noteName)
            console.log('----- single note ------')
            console.log(`Base octave: ${baseOctave}`)
            console.log(`Current octave: ${currentNoteOctave}`)
            console.log('note: ' + noteName)
            console.log('note name: ' + key[0].name)
            console.log('duration: ' + noteDuration)

            // Higher octave note
            if (currentNoteOctave > baseOctave) {
                // set octave switch to high
                console.log(`OSwitch: high`)
                ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
                ks.batchTypeKey(keyName, noteDuration, ks.BATCH_EVENT_KEY_DOWN)
                ks.batchTypeKey(keyName, ks.BATCH_EVENT_KEY_UP)
                ks.batchTypeKey('control', 10, ks.BATCH_EVENT_KEY_PRESS)
            }
            if (currentNoteOctave < baseOctave) {
                // set octave switch to low
                console.log(`OSwitch: low`)
                ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
                ks.batchTypeKey(keyName, noteDuration, ks.BATCH_EVENT_KEY_DOWN)
                ks.batchTypeKey(keyName, ks.BATCH_EVENT_KEY_UP)
                ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
            }
            if (currentNoteOctave == baseOctave) {
                // no changes needed
                console.log(`OSwitch: neutral`)
                ks.batchTypeKey(keyName, noteDuration, ks.BATCH_EVENT_KEY_DOWN)
                ks.batchTypeKey(keyName, ks.BATCH_EVENT_KEY_UP)
            }
            notesCount++
        } else {
            // Chord
            console.log('----- chord -----')
            console.log(`Chord base octave: ${chordBaseOctave}`)
            let chord = [] // notes in chord
            let keyBoardChord = [] // notes mapped to keyboard keys
            let duration = 0 // chord duration in ms
            for (const note of key) {
                console.log('note: ' + midi.getMusicNotation(note.midi))
                console.log('duration: ' + note.duration * 1000)
                chord.push(note.name)
                keyBoardChord.push(noteToKey.get(midi.getMusicNotation(note.midi)))
                duration = note.duration * 1000 // to get ms
                notesCount++
            }
            // get current chord octave
            const chordOctaves = chord.map(value => value = midi.getNoteOctave(value))
            const currChordOctave = midi.getChordBaseOctave(chordOctaves)
            console.log(`Current chord base: ${currChordOctave}`)
            // Current chord is higher than tha base
            if (currChordOctave > chordBaseOctave) {
                // set octave switch to high
                console.log(`OSwitch: high`)
                ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
                ks.batchTypeCombination(keyBoardChord, duration, ks.BATCH_EVENT_KEY_DOWN)
                ks.batchTypeCombination(keyBoardChord, ks.BATCH_EVENT_KEY_UP)
                ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
            }
            // Current chord is lower than the base
            if (currChordOctave < chordBaseOctave) {
                // set octave switch to low
                console.log(`OSwitch: low`)
                ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
                ks.batchTypeCombination(keyBoardChord, duration, ks.BATCH_EVENT_KEY_DOWN)
                ks.batchTypeCombination(keyBoardChord, ks.BATCH_EVENT_KEY_UP)
                ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
            }
            // Current chord is equal to base
            if (currChordOctave == chordBaseOctave) {
                console.log(`OSwitch: neutral`)
                ks.batchTypeCombination(keyBoardChord, duration, ks.BATCH_EVENT_KEY_DOWN)
                ks.batchTypeCombination(keyBoardChord, ks.BATCH_EVENT_KEY_UP)
            }

            console.log('chord notes: ' + chord)
            console.log('Length: ' + key.length)
        }
    })
    console.log(`\nTotal notes: ${notesCount}`)
    const prom = ks.sendBatch()
    return prom
}


fs.readFile(__dirname + `/data/${midiFileName}.mid`, "binary", (err, midiBlob) => {
    if (!err) {
        let midi = mc.parse(midiBlob)
        // Find chords. Notes with the same time value form a chord.
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