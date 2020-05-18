const ks = require('./node-key-sender/key-sender.js')
const midi = require('./midi')

const resetCharacterOctave = () => {
    // Send ctrl, ctrl, shift to reset the character to the neutral octave
    ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
    ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
    ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
}

const getFirstOctave = (chords) => {
    const firstElementIndex = Object.keys(chords)[0]
    // Get chord base octave
    const noteOctaves = chords[firstElementIndex].map(el => midi.getNoteOctave(el.name))
    return midi.getChordBaseOctave(noteOctaves)
}

const batchSingleNote = (note, firstOctave, keymap) => {
    const noteDuration = note.duration * 1000 // to get ms 
    const noteName = midi.getMusicNotation(note.midi)
    const baseOctave = midi.getNoteOctave(note.name)
    // console.log('----- single note ------')
    // console.log(`Base octave: ${firstOctave}`)
    // console.log(`Current octave: ${baseOctave}`)
    // console.log('note: ' + noteName)
    // console.log('note name: ' + note.name)
    // console.log('duration: ' + noteDuration)

    runBatch(baseOctave, firstOctave, () => {
        ks.batchTypeKey(keymap[noteName], noteDuration, ks.BATCH_EVENT_KEY_DOWN)
        ks.batchTypeKey(keymap[noteName], ks.BATCH_EVENT_KEY_UP)
    })
}

const batchChord = (notes, firstOctave, keymap) => {
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
    const baseOctave = midi.getChordBaseOctave(chordOctaves)
    // console.log(`Current chord base: ${baseOctave}`)
    runBatch(baseOctave, firstOctave, () => {
        ks.batchTypeCombination(chordKeys, duration, ks.BATCH_EVENT_KEY_DOWN)
        ks.batchTypeCombination(chordKeys, ks.BATCH_EVENT_KEY_UP)
    })

    // console.log('chord notes: ' + chord)
    // console.log('Length: ' + key.length)
}

const runBatch = (batchOctave, firstOctave, callback) => {
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
        batchFunction = batchSameOctave
    }
    batchFunction(callback)
}

const batchHigherOctave = (callback) => {
    ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
    callback()
    ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
}

const batchLowerOctave = (callback) => {
    ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
    callback()
    ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
}

const batchSameOctave = (callback) => {
    callback()
}

module.exports = {
    resetCharacterOctave,
    getFirstOctave,
    batchSingleNote,
    batchChord
}
