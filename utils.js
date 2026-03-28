const fs = require('fs')
const { exit } = require('process')
const mc = require('midiconvert')

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
        let midi = mc.parse(midiBlob)
        // Map track information
        callback(midi.tracks.filter(track => track.notes.length > 0))
    })
}

const CHORD_TIME_TOLERANCE = 0.05 // seconds — notes within 50ms are the same chord

const loadChords = (midiFileName, midiTrackNumber, callback) => {
    safeReadFile(midiFileName, (midiBlob) => {
        let midi = mc.parse(midiBlob)
        // Ensure that the requested track exists
        if (midiTrackNumber >= midi.tracks.length) {
            console.error('[ERROR]', `Invalid track number: ${midiTrackNumber}. Total available tracks: ${midi.tracks.length}`)
            exit(1)
        }

        const beforeCount = midi.tracks[midiTrackNumber].notes.length
        const notes = midi.tracks[midiTrackNumber].notes.slice().sort((a, b) => a.time - b.time)

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

        // Ensure that chords were found in the midi file
        if (Object.keys(chords).length == 0) {
            console.error(`[ERROR] Track ${midiTrackNumber} has no playable notes.`)
            const playable = midi.tracks
                .map((t, i) => ({ id: i, name: t.name, notes: t.notes.length }))
                .filter(t => t.notes > 0)
            if (playable.length > 0) {
                console.error('Available tracks:')
                playable.forEach(t => console.error(`  --track ${t.id}: ${t.name} (${t.notes} notes)`))
            }
            exit(1)
        }
        callback(chords)
    })
}

module.exports = {
    loadKeymap,
    loadChords,
    loadTracks
}