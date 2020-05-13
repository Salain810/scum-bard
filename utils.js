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

const loadChords = (midiFileName, midiTrackNumber, callback) => {
    if (!fs.existsSync(midiFileName)) {
        console.log(`[ERROR] Unable to load midi file: ${midiFileName}`)
        exit(1)
    }

    fs.readFile(midiFileName, "binary", (err, midiBlob) => {
        if (!err) {
            let midi = mc.parse(midiBlob)
            // Ensure that the requested track exists
            if (midiTrackNumber >= midi.tracks.length) {
                console.error('[ERROR]', `Invalid track number: ${midiTrackNumber}. Total available tracks: ${midi.tracks.length}`)
                exit(1)
            }
            // Find chords. Notes with the same time value form a chord.
            const chords = midi.tracks[midiTrackNumber].notes.reduce((obj, note) => {
                if (!obj.hasOwnProperty(note.time)) {
                    obj[note.time] = [];
                }
                obj[note.time].push(note)
                return obj
            }, {})
            // Ensure that chords were found in the midi file
            if (Object.keys(chords).length == 0) {
                console.error('[ERROR]', `Unable to load chords for ${midiFileName} track ${midiTrackNumber}`)
                exit(1)
            }
            callback(chords)
        } else {
            console.error('[ERROR]', err.message)
            exit(1)
        }
    })
}

module.exports = {
    loadKeymap,
    loadChords
}