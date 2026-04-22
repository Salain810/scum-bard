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

const getBaseOctave = (chords) => {
    // Find the optimal base octave that keeps the most notes at LOW (offset 0).
    // Uses the center of the densest 3-octave window, then maps center-1 to LOW
    // so center lands on MID — matching how SCUM instruments play from the lowest position.
    const allOctaves = []
    Object.values(chords).forEach(chord => {
        chord.forEach(note => allOctaves.push(Math.floor(note.midi / 12) - 1))
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

/**
 * Build an absolute-time event timeline and emit it to the key-sender batch.
 * Each note's release fires at its real end time, so long notes sustain past
 * subsequent note events instead of being truncated to the gap-to-next-chord.
 */
const buildAndEmitEvents = (chords, baseOctave, keymap) => {
    const events = []
    let t = 0

    for (let i = 0; i < 5; i++) {
        events.push({ time: t, type: 'press', key: 'control' })
        t += RESET_DELAY
    }
    const notesStart = t

    const chordTimes = Object.keys(chords).map(Number).sort((a, b) => a - b)
    const firstChord = chordTimes[0]
    let currentOffset = 0
    let notesCount = 0
    let nextId = 0

    chordTimes.forEach(chordTime => {
        const chord = chords[chordTime]
        let absMs = (chordTime - firstChord) * 1000 + notesStart

        const chordOcts = chord.map(n => Math.floor(n.midi / 12) - 1)
        const chordBase = Math.min(...chordOcts)
        const target = Math.max(0, Math.min(2, chordBase - baseOctave))
        const diff = target - currentOffset

        if (diff !== 0) {
            const shiftKey = diff > 0 ? 'shift' : 'control'
            const steps = Math.abs(diff)
            for (let i = 0; i < steps; i++) {
                events.push({ time: absMs, type: 'press', key: shiftKey })
                absMs += SHIFT_DELAY
            }
            currentOffset = target
        }

        // All notes in a chord release together at the longest duration —
        // SCUM instruments end the chord sound when any chord key releases.
        const chordDurMs = Math.max(10, Math.round(Math.max(...chord.map(n => n.duration)) * 1000))
        const seenKeys = new Set()
        chord.forEach(note => {
            const key = keymap[midi.getMusicNotation(note.midi)]
            if (!key || seenKeys.has(key)) return
            seenKeys.add(key)
            const id = nextId++
            events.push({ time: absMs, type: 'down', key, id, offset: target })
            events.push({ time: absMs + chordDurMs, type: 'up', key, id })
            notesCount++
        })
    })

    // Sort by time; at same time: up < press < down so chord-boundary
    // releases happen before the next shift/press.
    const order = { up: 0, press: 1, down: 2 }
    events.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time
        return order[a.type] - order[b.type]
    })

    // Same-key retrigger with id ownership: if a key is held when a new down
    // arrives, release old + press new. The old note's up event is tagged
    // stale via shadowed and discarded so it can't cut the new hold short.
    // Preserves per-strum articulation (vs merging which absorbs repeated
    // strikes into one long hold).
    const owner = new Map()
    const shadowed = new Set()
    const finalEvents = []
    for (const ev of events) {
        if (ev.type === 'down') {
            if (owner.has(ev.key)) {
                finalEvents.push({ time: ev.time, type: 'up', key: ev.key })
                shadowed.add(owner.get(ev.key))
            }
            finalEvents.push(ev)
            owner.set(ev.key, ev.id)
        } else if (ev.type === 'up') {
            if (shadowed.has(ev.id)) continue
            if (owner.get(ev.key) === ev.id) {
                finalEvents.push(ev)
                owner.delete(ev.key)
            }
        } else {
            finalEvents.push(ev)
        }
    }

    // Before each octave shift, release currently-held note keys. Otherwise
    // SCUM re-pitches the sustained keys to the new octave, which sounds like
    // sustained notes suddenly "drop" when the game shifts octave for a new
    // melody note. Cuts sustain at shift boundaries but preserves pitch.
    // Release held keys slightly before the shift so SCUM registers the up
    // before processing the ctrl/shift — same-timestamp up+press with 0ms
    // wait between them is too fast and the held key gets re-pitched anyway.
    const KEY_RELEASE_BUFFER = 10
    const held = new Set()
    const emitted = []
    for (const ev of finalEvents) {
        if (ev.type === 'press') {
            if (held.size > 0) {
                const upTime = Math.max(0, ev.time - KEY_RELEASE_BUFFER)
                for (const k of held) emitted.push({ time: upTime, type: 'up', key: k })
                held.clear()
            }
            emitted.push(ev)
        } else if (ev.type === 'down') {
            emitted.push(ev)
            held.add(ev.key)
        } else if (held.has(ev.key)) {
            emitted.push(ev)
            held.delete(ev.key)
        }
    }

    for (let i = 0; i < emitted.length; i++) {
        const ev = emitted[i]
        const next = emitted[i + 1]
        const wait = next ? Math.max(0, Math.round(next.time - ev.time)) : 0
        const batchType = ev.type === 'down' ? ks.BATCH_EVENT_KEY_DOWN
                        : ev.type === 'up' ? ks.BATCH_EVENT_KEY_UP
                        : ks.BATCH_EVENT_KEY_PRESS
        ks.batchTypeKey(ev.key, wait, batchType)
    }

    return notesCount
}

module.exports = {
    compressChords,
    getBaseOctave,
    buildAndEmitEvents
}
