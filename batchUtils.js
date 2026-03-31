const ks = require('./node-key-sender/key-sender.js')
const midi = require('./midi')

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Compress all notes into a 3-octave range playable by SCUM instruments.
 * Out-of-range notes are folded by whole octaves (preserving pitch class)
 * to maintain melody and chord structure as faithfully as possible.
 */
const compressChords = (chords) => {
    // Collect all MIDI note numbers
    const allMidi = []
    Object.values(chords).forEach(chord => {
        chord.forEach(note => allMidi.push(note.midi))
    })

    if (allMidi.length === 0) return chords

    // Calculate octave range directly from MIDI numbers
    // MIDI octave: floor(midi / 12) - 1  (MIDI 60 = C4)
    const minOctave = Math.floor(Math.min(...allMidi) / 12) - 1
    const maxOctave = Math.floor(Math.max(...allMidi) / 12) - 1
    const span = maxOctave - minOctave

    if (span <= 2) {
        console.log(`Note range: octaves ${minOctave}-${maxOctave} (${span + 1} octave(s)) — no compression needed`)
        return chords
    }

    console.log(`Note range: octaves ${minOctave}-${maxOctave} (${span + 1} octaves) — compressing to fit 3`)

    // Find the 3-octave window (center ± 1) that contains the most notes
    const allOctaves = allMidi.map(m => Math.floor(m / 12) - 1)
    let bestCenter = minOctave + 1
    let bestCount = 0

    for (let center = minOctave; center <= maxOctave; center++) {
        const inRange = allOctaves.filter(o => o >= center - 1 && o <= center + 1).length
        if (inRange > bestCount) {
            bestCount = inRange
            bestCenter = center
        }
    }

    const lowOct = bestCenter - 1
    const highOct = bestCenter + 1
    // MIDI bounds for the window: C of lowOct through B of highOct
    const midiLow = (lowOct + 1) * 12
    const midiHigh = (highOct + 1) * 12 + 11

    let folded = 0

    // Fold out-of-range notes by shifting whole octaves
    Object.values(chords).forEach(chord => {
        chord.forEach(note => {
            const origMidi = note.midi
            let m = note.midi

            while (m < midiLow) m += 12
            while (m > midiHigh) m -= 12

            if (m !== origMidi) {
                note.midi = m
                const octave = Math.floor(m / 12) - 1
                note.name = NOTE_NAMES[m % 12] + octave
                folded++
            }
        })
    })

    // Deduplicate chord notes that collapsed to the same pitch after folding
    Object.keys(chords).forEach(time => {
        const seen = new Set()
        chords[time] = chords[time].filter(note => {
            if (seen.has(note.midi)) return false
            seen.add(note.midi)
            return true
        })
    })

    console.log(`Compressed: ${folded}/${allMidi.length} notes folded into octaves ${lowOct}-${highOct}`)
    return chords
}

// Delay for the one-time octave reset at start
const RESET_DELAY = 50
// Delay for per-note octave shifts (needs to be long enough for game to register)
const SHIFT_DELAY = 20

// Track the instrument's current octave offset (0=LOW, 1=MID, 2=HIGH)
let currentOctaveOffset = 0

const resetCharacterOctave = () => {
    // Spam ctrl to guarantee we hit the lowest octave regardless of starting position
    for (let i = 0; i < 5; i++) {
        ks.batchTypeKey('control', RESET_DELAY, ks.BATCH_EVENT_KEY_PRESS)
    }
    currentOctaveOffset = 0
}

const getBaseOctave = (chords) => {
    // Find the optimal base octave that keeps the most notes at LOW (offset 0).
    // Uses the center of the densest 3-octave window, then maps center-1 to LOW
    // so center lands on MID — matching how SCUM instruments play from the lowest position.
    const allOctaves = []
    Object.values(chords).forEach(chord => {
        chord.forEach(note => allOctaves.push(parseInt(midi.getNoteOctave(note.name))))
    })
    const minOct = Math.min(...allOctaves)
    const maxOct = Math.max(...allOctaves)
    const span = maxOct - minOct

    // For 1-2 octave songs, just use the max octave as base so everything stays at LOW
    if (span <= 1) {
        console.log(`Octave mapping: all notes at LOW (${span + 1} octave(s), range ${minOct}-${maxOct})`)
        return maxOct
    }

    // For 3-octave songs, find the center with the most notes and map it to LOW
    let bestCenter = minOct + 1
    let bestCount = 0
    for (let center = minOct; center <= maxOct; center++) {
        const inRange = allOctaves.filter(o => o >= center - 1 && o <= center + 1).length
        if (inRange > bestCount) {
            bestCount = inRange
            bestCenter = center
        }
    }

    // Map bestCenter to LOW (offset 0) — notes below get clamped to LOW,
    // notes above shift to MID/HIGH
    const base = bestCenter
    console.log(`Octave mapping: LOW=${base} MID=${base + 1} HIGH=${base + 2} (center=${bestCenter}, range ${minOct}-${maxOct})`)
    return base
}

const shiftToOctave = (targetOffset) => {
    const diff = targetOffset - currentOctaveOffset
    if (diff > 0) {
        for (let i = 0; i < diff; i++) {
            ks.batchTypeKey('shift', SHIFT_DELAY, ks.BATCH_EVENT_KEY_PRESS)
        }
    } else if (diff < 0) {
        for (let i = 0; i < -diff; i++) {
            ks.batchTypeKey('control', SHIFT_DELAY, ks.BATCH_EVENT_KEY_PRESS)
        }
    }
    currentOctaveOffset = targetOffset
    return Math.abs(diff) * SHIFT_DELAY
}

const batchSingleNote = (note, baseOctave, keymap, gapSeconds) => {
    const noteOctave = parseInt(midi.getNoteOctave(note.name))
    const targetOffset = Math.max(0, Math.min(2, noteOctave - baseOctave))

    const shiftOverhead = Math.abs(targetOffset - currentOctaveOffset) * SHIFT_DELAY
    const noteDuration = note.duration * 1000
    const gapMs = gapSeconds * 1000
    const availableMs = Math.max(1, gapMs - shiftOverhead)
    const holdTime = Math.round(Math.min(noteDuration, availableMs))
    const restTime = Math.round(Math.max(0, availableMs - holdTime))
    const noteName = midi.getMusicNotation(note.midi)

    shiftToOctave(targetOffset)
    ks.batchTypeKey(keymap[noteName], holdTime, ks.BATCH_EVENT_KEY_DOWN)
    ks.batchTypeKey(keymap[noteName], restTime, ks.BATCH_EVENT_KEY_UP)
}

const batchChord = (notes, baseOctave, keymap, gapSeconds) => {
    const { chordKeys, chordOctaves } = notes.reduce((acc, note) => {
        acc.chordOctaves.push(parseInt(midi.getNoteOctave(note.name)))
        acc.chordKeys.push(keymap[midi.getMusicNotation(note.midi)])
        return acc
    }, { chordKeys: [], chordOctaves: [] })

    const chordBaseOctave = Math.min(...chordOctaves)
    const targetOffset = Math.max(0, Math.min(2, chordBaseOctave - baseOctave))

    const shiftOverhead = Math.abs(targetOffset - currentOctaveOffset) * SHIFT_DELAY
    const maxDuration = Math.max(...notes.map(n => n.duration)) * 1000
    const gapMs = gapSeconds * 1000
    const availableMs = Math.max(1, gapMs - shiftOverhead)
    const holdTime = Math.round(Math.min(maxDuration, availableMs))
    const restTime = Math.round(Math.max(0, availableMs - holdTime))

    shiftToOctave(targetOffset)
    ks.batchTypeCombination(chordKeys, holdTime, ks.BATCH_EVENT_KEY_DOWN)
    ks.batchTypeCombination(chordKeys, restTime, ks.BATCH_EVENT_KEY_UP)
}

module.exports = {
    compressChords,
    resetCharacterOctave,
    getBaseOctave,
    batchSingleNote,
    batchChord
}
