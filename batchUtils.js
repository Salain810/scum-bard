const ks = require('node-key-sender')
const midi = require('./midi')

function getFirstOctave(chords) {
    const firstElementIndex = Object.keys(chords)[0]
    const firstChord = chords[firstElementIndex]
    // First note is a single note
    if (firstChord.length === 0) {
        return midi.getNoteOctave(firstChord.midi)
    }

    // Get chord base octave
    const noteOctaves = firstChord.map(el => {
        midi.getNoteOctave(el.name)
    })
    return midi.getChordBaseOctave(noteOctaves)
}

function batchSingleNote(note, firstOctave, keymap) {
    const noteDuration = note.duration * 1000 // to get ms 
    const noteName = midi.getMusicNotation(note.midi)
    const currentNoteOctave = midi.getNoteOctave(note.name)
    // console.log('----- single note ------')
    // console.log(`Base octave: ${firstOctave}`)
    // console.log(`Current octave: ${currentNoteOctave}`)
    // console.log('note: ' + noteName)
    // console.log('note name: ' + note.name)
    // console.log('duration: ' + noteDuration)

    runBatch(currentNoteOctave, firstOctave, () => {
        ks.batchTypeKey(keymap[noteName], noteDuration, ks.BATCH_EVENT_KEY_DOWN)
        ks.batchTypeKey(keymap[noteName], ks.BATCH_EVENT_KEY_UP)
    })
}

function batchChord(notes, firstOctave, keymap) {
    // Chord
    // console.log('----- chord -----')
    // console.log(`Chord base octave: ${firstOctave}`)
    const { chordKeys, chordOctaves } = notes.reduce((acc, note) => {
        acc.chordOctaves.push(midi.getNoteOctave(note.name))
        acc.chordKeys.push(keymap[midi.getMusicNotation(note.midi)])
        return acc
    }, { chordKeys: [], chordOctaves: [] })

    const duration = notes[0].duration * 1000
    // get current chord octave
    const currChordOctave = midi.getChordBaseOctave(chordOctaves)
    // console.log(`Current chord base: ${currChordOctave}`)
    runBatch(currChordOctave, firstOctave, () => {
        ks.batchTypeCombination(chordKeys, duration, ks.BATCH_EVENT_KEY_DOWN)
        ks.batchTypeCombination(chordKeys, ks.BATCH_EVENT_KEY_UP)
    })

    // console.log('chord notes: ' + chord)
    // console.log('Length: ' + key.length)
}

function runBatch(batchOctave, firstOctave, callback) {
    let batchFunction
    if (batchOctave > firstOctave) {
        // Current octave is higher than the base
        // console.log(`OSwitch: high`)
        batchFunction = batchHigherOctave
    } else if (batchOctave < firstOctave) {
        // Current octave is lower than the base
        // console.log(`OSwitch: low`)
        batchFunction = batchLowerOctave
    } else {
        // Current octave is equal to base
        // console.log(`OSwitch: neutral`)
        batchFunction = callback
    }
    batchFunction(callback)
}

function batchHigherOctave(callback) {
    ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
    callback()
    ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
}

function batchLowerOctave(callback) {
    ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
    callback()
    ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
}

module.exports = {
    getFirstOctave,
    batchSingleNote,
    batchChord
}
