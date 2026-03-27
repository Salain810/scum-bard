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

const resetCharacterOctave = () => {
    // Send ctrl, ctrl, shift to reset the character to the neutral octave
    ks.batchTypeKey('control', 0, ks.BATCH_EVENT_KEY_PRESS)
    ks.batchTypeKey('control', 0, ks.BATCH_EVENT_KEY_PRESS)
    ks.batchTypeKey('shift', 0, ks.BATCH_EVENT_KEY_PRESS)
}

const getFirstOctave = (chords) => {
    // Find the optimal center octave that fits the most notes within ±1
    // This maximizes accuracy within SCUM's 3-octave limit
    const allOctaves = []
    Object.values(chords).forEach(chord => {
        chord.forEach(note => allOctaves.push(parseInt(midi.getNoteOctave(note.name))))
    })
    const minOct = Math.min(...allOctaves)
    const maxOct = Math.max(...allOctaves)
    let bestCenter = minOct + 1
    let bestCount = 0
    for (let center = minOct; center <= maxOct; center++) {
        const inRange = allOctaves.filter(o => o >= center - 1 && o <= center + 1).length
        if (inRange > bestCount) {
            bestCount = inRange
            bestCenter = center
        }
    }
    const total = allOctaves.length
    const clamped = total - bestCount
    if (clamped > 0) {
        console.log(`Octave optimization: ${bestCount}/${total} notes in range (octaves ${bestCenter - 1}-${bestCenter + 1}), ${clamped} notes clamped`)
    }
    return String(bestCenter)
}

const batchSingleNote = (note, firstOctave, keymap, gapSeconds) => {
    const noteDuration = note.duration * 1000
    const gapMs = gapSeconds * 1000
    const holdTime = Math.round(Math.min(noteDuration, gapMs))
    const restTime = Math.round(Math.max(0, gapMs - holdTime))
    const noteName = midi.getMusicNotation(note.midi)
    const baseOctave = midi.getNoteOctave(note.name)

    runBatch(baseOctave, firstOctave, () => {
        ks.batchTypeKey(keymap[noteName], holdTime, ks.BATCH_EVENT_KEY_DOWN)
        ks.batchTypeKey(keymap[noteName], restTime, ks.BATCH_EVENT_KEY_UP)
    })
}

const batchChord = (notes, firstOctave, keymap, gapSeconds) => {
    const { chordKeys, chordOctaves } = notes.reduce((acc, note) => {
        acc.chordOctaves.push(midi.getNoteOctave(note.name))
        acc.chordKeys.push(keymap[midi.getMusicNotation(note.midi)])
        return acc
    }, { chordKeys: [], chordOctaves: [] })

    const maxDuration = Math.max(...notes.map(n => n.duration)) * 1000
    const gapMs = gapSeconds * 1000
    const holdTime = Math.round(Math.min(maxDuration, gapMs))
    const restTime = Math.round(Math.max(0, gapMs - holdTime))

    const baseOctave = midi.getChordBaseOctave(chordOctaves)
    runBatch(baseOctave, firstOctave, () => {
        ks.batchTypeCombination(chordKeys, holdTime, ks.BATCH_EVENT_KEY_DOWN)
        ks.batchTypeCombination(chordKeys, restTime, ks.BATCH_EVENT_KEY_UP)
    })
}

const runBatch = (batchOctave, firstOctave, callback) => {
    // Clamp to ±1 octave (SCUM instruments only support 3 octaves)
    const diff = Math.max(-1, Math.min(1, batchOctave - firstOctave))
    if (diff > 0) {
        ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
    } else if (diff < 0) {
        ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
    }
    callback()
    if (diff > 0) {
        ks.batchTypeKey('control', ks.BATCH_EVENT_KEY_PRESS)
    } else if (diff < 0) {
        ks.batchTypeKey('shift', ks.BATCH_EVENT_KEY_PRESS)
    }
}

module.exports = {
    compressChords,
    resetCharacterOctave,
    getFirstOctave,
    batchSingleNote,
    batchChord
}
