const fs = require('fs')
const { exit } = require('process')
const parseMidi = require('midi-file-parser')

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const INSTRUMENT_NAMES = [
    "acoustic grand piano", "bright acoustic piano", "electric grand piano",
    "honky-tonk piano", "electric piano 1", "electric piano 2", "harpsichord",
    "clavi", "celesta", "glockenspiel", "music box", "vibraphone", "marimba",
    "xylophone", "tubular bells", "dulcimer", "drawbar organ", "percussive organ",
    "rock organ", "church organ", "reed organ", "accordion", "harmonica",
    "tango accordion", "acoustic guitar (nylon)", "acoustic guitar (steel)",
    "electric guitar (jazz)", "electric guitar (clean)", "electric guitar (muted)",
    "overdriven guitar", "distortion guitar", "guitar harmonics", "acoustic bass",
    "electric bass (finger)", "electric bass (pick)", "fretless bass", "slap bass 1",
    "slap bass 2", "synth bass 1", "synth bass 2", "violin", "viola", "cello",
    "contrabass", "tremolo strings", "pizzicato strings", "orchestral harp", "timpani",
    "string ensemble 1", "string ensemble 2", "synthstrings 1", "synthstrings 2",
    "choir aahs", "voice oohs", "synth voice", "orchestra hit", "trumpet", "trombone",
    "tuba", "muted trumpet", "french horn", "brass section", "synthbrass 1",
    "synthbrass 2", "soprano sax", "alto sax", "tenor sax", "baritone sax", "oboe",
    "english horn", "bassoon", "clarinet", "piccolo", "flute", "recorder", "pan flute",
    "blown bottle", "shakuhachi", "whistle", "ocarina", "lead 1 (square)",
    "lead 2 (sawtooth)", "lead 3 (calliope)", "lead 4 (chiff)", "lead 5 (charang)",
    "lead 6 (voice)", "lead 7 (fifths)", "lead 8 (bass + lead)", "pad 1 (new age)",
    "pad 2 (warm)", "pad 3 (polysynth)", "pad 4 (choir)", "pad 5 (bowed)",
    "pad 6 (metallic)", "pad 7 (halo)", "pad 8 (sweep)", "fx 1 (rain)",
    "fx 2 (soundtrack)", "fx 3 (crystal)", "fx 4 (atmosphere)", "fx 5 (brightness)",
    "fx 6 (goblins)", "fx 7 (echoes)", "fx 8 (sci-fi)", "sitar", "banjo", "shamisen",
    "koto", "kalimba", "bag pipe", "fiddle", "shanai", "tinkle bell", "agogo",
    "steel drums", "woodblock", "taiko drum", "melodic tom", "synth drum",
    "reverse cymbal", "guitar fret noise", "breath noise", "seashore", "bird tweet",
    "telephone ring", "helicopter", "applause", "gunshot"
]

const INSTRUMENT_FAMILIES = [
    "piano", "chromatic percussion", "organ", "guitar", "bass", "strings",
    "ensemble", "brass", "reed", "pipe", "synth lead", "synth pad",
    "synth effects", "ethnic", "percussive", "sound effects"
]

function midiToNoteName(midi) {
    const octave = Math.floor(midi / 12) - 1
    return NOTE_NAMES[midi % 12] + octave
}

/**
 * Build a tempo map from all tracks in the MIDI file.
 * Returns sorted array of { tick, timeSeconds, microsecondsPerBeat }.
 */
function buildTempoMap(tracks, ppq) {
    const tempoEvents = []
    tracks.forEach(track => {
        let tickPos = 0
        track.forEach(event => {
            tickPos += event.deltaTime
            if (event.type === 'meta' && event.subtype === 'setTempo') {
                tempoEvents.push({ tick: tickPos, microsecondsPerBeat: event.microsecondsPerBeat })
            }
        })
    })

    tempoEvents.sort((a, b) => a.tick - b.tick)

    // Default 120 BPM if no tempo events or none at tick 0
    if (tempoEvents.length === 0 || tempoEvents[0].tick > 0) {
        tempoEvents.unshift({ tick: 0, microsecondsPerBeat: 500000 })
    }

    // Deduplicate same-tick entries (keep last)
    const deduped = []
    for (let i = 0; i < tempoEvents.length; i++) {
        if (i < tempoEvents.length - 1 && tempoEvents[i + 1].tick === tempoEvents[i].tick) continue
        deduped.push(tempoEvents[i])
    }

    // Build cumulative seconds at each tempo change
    const map = []
    let cumSeconds = 0
    for (let i = 0; i < deduped.length; i++) {
        if (i > 0) {
            const prev = map[i - 1]
            const deltaTicks = deduped[i].tick - prev.tick
            cumSeconds += deltaTicks * (prev.microsecondsPerBeat / 1000000 / ppq)
        }
        map.push({
            tick: deduped[i].tick,
            timeSeconds: cumSeconds,
            microsecondsPerBeat: deduped[i].microsecondsPerBeat
        })
    }

    return map
}

/**
 * Convert an absolute tick position to seconds using the tempo map.
 */
function tickToSeconds(absoluteTick, tempoMap, ppq) {
    let idx = 0
    for (let i = tempoMap.length - 1; i >= 0; i--) {
        if (absoluteTick >= tempoMap[i].tick) {
            idx = i
            break
        }
    }
    const seg = tempoMap[idx]
    const deltaTicks = absoluteTick - seg.tick
    return seg.timeSeconds + deltaTicks * (seg.microsecondsPerBeat / 1000000 / ppq)
}

/**
 * Parse notes from a raw MIDI track using tempo-aware timing.
 */
function parseTrackNotes(trackData, tempoMap, ppq) {
    const notes = []
    const pending = new Map() // noteNumber -> [note objects awaiting noteOff]
    let absoluteTick = 0

    trackData.forEach(event => {
        absoluteTick += event.deltaTime

        if (event.subtype === 'noteOn' && event.velocity > 0) {
            const note = {
                midi: event.noteNumber,
                name: midiToNoteName(event.noteNumber),
                time: tickToSeconds(absoluteTick, tempoMap, ppq),
                duration: 0,
                velocity: event.velocity / 127
            }
            if (!pending.has(event.noteNumber)) pending.set(event.noteNumber, [])
            pending.get(event.noteNumber).push(note)
            notes.push(note)
        } else if (event.subtype === 'noteOff' || (event.subtype === 'noteOn' && event.velocity === 0)) {
            const queue = pending.get(event.noteNumber)
            if (queue && queue.length > 0) {
                const note = queue.shift()
                note.duration = tickToSeconds(absoluteTick, tempoMap, ppq) - note.time
            }
        }
    })

    return notes
}

const loadKeymap = (keymapFile) => {
    if (!fs.existsSync(keymapFile)) {
        console.log(`[ERROR] Keymap file not found: ${keymapFile}`)
        exit(1)
    }
    const keymapData = fs.readFileSync(keymapFile)
    try {
        return JSON.parse(keymapData)
    } catch (error) {
        console.log(`[ERROR] Unable to load keymap file: ${error}`)
        exit(1)
    }
}

const safeReadFile = (filename, callback) => {
    if (!fs.existsSync(filename)) {
        console.log(`[ERROR] Unable to load midi file: ${filename}`)
        exit(1)
    }
    fs.readFile(filename, "binary", (err, midiBlob) => {
        if (!err) {
            callback(midiBlob)
        } else {
            console.error('[ERROR]', err.message)
            exit(1)
        }
    })
}

const loadTracks = (midiFileName, callback) => {
    safeReadFile(midiFileName, (midiBlob) => {
        const midi = parseMidi(midiBlob)
        const ppq = midi.header.ticksPerBeat
        const tempoMap = buildTempoMap(midi.tracks, ppq)

        const tracks = midi.tracks.map((trackData, i) => {
            let name = ''
            let instrumentNumber = -1
            let channelNumber = -1

            trackData.forEach(event => {
                if (event.type === 'meta' && event.subtype === 'trackName') {
                    name = event.text.replace(/\u0000/g, '')
                } else if (event.type === 'channel' && event.subtype === 'programChange') {
                    instrumentNumber = event.programNumber
                    channelNumber = event.channel
                } else if (event.subtype === 'noteOn' && channelNumber === -1) {
                    channelNumber = event.channel
                }
            })

            const notes = parseTrackNotes(trackData, tempoMap, ppq)
            const isPercussion = [0x9, 0xA].includes(channelNumber)

            return {
                id: i,
                name,
                notes,
                instrument: isPercussion ? 'drums' :
                    (instrumentNumber >= 0 ? INSTRUMENT_NAMES[instrumentNumber] : 'unknown'),
                instrumentFamily: isPercussion ? 'drums' :
                    (instrumentNumber >= 0 ? INSTRUMENT_FAMILIES[Math.floor(instrumentNumber / 8)] : 'unknown')
            }
        })

        callback(tracks.filter(track => track.notes.length > 0))
    })
}

const CHORD_TIME_TOLERANCE = 0.05 // seconds — notes within 50ms are the same chord

const loadChords = (midiFileName, midiTrackNumber, callback) => {
    safeReadFile(midiFileName, (midiBlob) => {
        const midi = parseMidi(midiBlob)
        const ppq = midi.header.ticksPerBeat
        const tempoMap = buildTempoMap(midi.tracks, ppq)

        if (midiTrackNumber >= midi.tracks.length) {
            console.error('[ERROR]', `Invalid track number: ${midiTrackNumber}. Total available tracks: ${midi.tracks.length}`)
            exit(1)
        }

        const notes = parseTrackNotes(midi.tracks[midiTrackNumber], tempoMap, ppq)
        const beforeCount = notes.length
        notes.sort((a, b) => a.time - b.time)

        // Group notes into chords using time tolerance
        const chords = {}
        let currentTime = null
        notes.forEach(note => {
            if (currentTime === null || note.time - currentTime >= CHORD_TIME_TOLERANCE) {
                currentTime = note.time
            }
            if (!chords[currentTime]) {
                chords[currentTime] = []
            }
            chords[currentTime].push(note)
        })

        // Deduplicate within each chord — same pitch can't be played twice simultaneously
        let removed = 0
        Object.keys(chords).forEach(time => {
            const seen = new Set()
            const before = chords[time].length
            chords[time] = chords[time].filter(note => {
                if (seen.has(note.midi)) return false
                seen.add(note.midi)
                return true
            })
            removed += before - chords[time].length
        })

        if (removed > 0) {
            let totalNotes = 0
            Object.values(chords).forEach(c => totalNotes += c.length)
            console.log(`Cleaned ${removed} duplicate notes (${beforeCount} -> ${totalNotes})`)
        }

        if (Object.keys(chords).length == 0) {
            console.error(`[ERROR] Track ${midiTrackNumber} has no playable notes.`)
            const playable = midi.tracks.map((t, i) => {
                let noteCount = 0
                let trackName = ''
                t.forEach(ev => {
                    if (ev.subtype === 'noteOn' && ev.velocity > 0) noteCount++
                    if (ev.type === 'meta' && ev.subtype === 'trackName') trackName = ev.text
                })
                return { id: i, name: trackName, notes: noteCount }
            }).filter(t => t.notes > 0)
            if (playable.length > 0) {
                console.error('Available tracks:')
                playable.forEach(t => console.error(`  --track ${t.id}: ${t.name} (${t.notes} notes)`))
            }
            exit(1)
        }

        // Log tempo info
        const bpm = Math.round(60000000 / tempoMap[0].microsecondsPerBeat)
        if (tempoMap.length > 1) {
            console.log(`Tempo: ${bpm} BPM initial (${tempoMap.length} tempo changes in file)`)
        } else {
            console.log(`Tempo: ${bpm} BPM`)
        }

        callback(chords)
    })
}

module.exports = {
    loadKeymap,
    loadChords,
    loadTracks
}
