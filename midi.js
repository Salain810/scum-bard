const midiToNotes = new Map;
midiToNotes.set(0, 'c')
midiToNotes.set(1, 'c#')
midiToNotes.set(2, 'd')
midiToNotes.set(3, 'd#')
midiToNotes.set(4, 'e')
midiToNotes.set(5, 'f')
midiToNotes.set(6, 'f#')
midiToNotes.set(7, 'g')
midiToNotes.set(8, 'g#')
midiToNotes.set(9, 'a')
midiToNotes.set(10, 'a#')
midiToNotes.set(11, 'b')

/**
 * @function getMusicNotation
 * @param {integer} midiNote MIDI note value (int)
 */
const getMusicNotation = (midiNote) => {
    // We wont be using octaves (A3==A4==A0),
    // because SCUM doesn't support octaves
    let keysArray = [...midiToNotes.keys()]
    while (!keysArray.includes(midiNote)) {
        // keep substracting a full octave (12 notes)
        // until we get the base value of octave -2
        midiNote -= 12
    }
    return midiToNotes.get(midiNote);
}

const getNoteOctave = (midiNoteName) => {
    let octave = ''
    octave = midiNoteName.toString()
    octave = octave.slice(octave.length - 1)
    return octave
}

/**
 * 
 * @param {array} chordOctaves 
 * @returns {integer} Chord base octave
 */
const getChordBaseOctave = (chordOctaves) => {
    return Math.min(...chordOctaves)
}

module.exports = {
    getMusicNotation,
    getNoteOctave,
    getChordBaseOctave
}