const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']

/**
 * @function getMusicNotation
 * @param {number} midiNote MIDI note value (0-127)
 * @returns {string} Note name in lowercase (e.g. 'c', 'f#')
 */
const getMusicNotation = (midiNote) => {
  return NOTE_NAMES[midiNote % 12]
}

/**
 * @function getNoteOctave
 * @param {string} midiNoteName Note name with octave (e.g. 'C4', 'F#5')
 * @returns {string} Octave number as string
 */
const getNoteOctave = (midiNoteName) => {
  return midiNoteName.toString().slice(-1)
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
  getChordBaseOctave,
}
