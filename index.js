#!/usr/bin/env node
const yargs = require('yargs')
const ks = require('./node-key-sender/key-sender.js')
const path = require('path')

const { loadKeymap, loadChords, loadTracks } = require('./utils.js')
const { compressChords, getFirstOctave, batchSingleNote, batchChord, resetCharacterOctave } = require('./batchUtils.js')
const { exit } = require('process')

const argv = yargs
    .usage('Usage: scum-bard.cmd --file [midi file]')
    .option('file', {
        alias: 'f',
        description: 'Midi file to play',
        type: 'string',
        demandOption: true
    })
    .option('track', {
        alias: 't',
        type: 'number',
        default: 0,
        description: 'Track in midi file to play'
    })
    .option('keymap', {
        alias: 'k',
        type: 'string',
        description: 'Custom keymap.json file'
    })
    .option('list-tracks', {
        alias: 'l',
        type: 'boolean',
        default: false,
        description: 'List available tracks'
    })
    .argv

if (argv["list-tracks"]) {
    loadTracks(argv.file, (tracks) => {
        tracks.forEach(track => {
            const { id, name, instrument, instrumentFamily} = track
            console.log(`Track ${id}: ${name} - Instrument: ${instrument} (${instrumentFamily})`)
        });
        exit(0)
    })
}

const defaultKeymap = [
    __dirname,
    'keymap.json'
].join(path.sep)

const keymap = loadKeymap(argv.keymap || defaultKeymap)

loadChords(argv.file, argv.track, (chords) => {
    ks.startBatch()
    resetCharacterOctave()
    let notesCount = 0
    compressChords(chords)
    const firstOctave = getFirstOctave(chords)

    // Sort chord events by time for correct playback order and gap calculation
    const chordTimes = Object.keys(chords).map(Number).sort((a, b) => a - b)

    chordTimes.forEach((time, i) => {
        const chord = chords[time]
        const nextTime = i < chordTimes.length - 1 ? chordTimes[i + 1] : time + chord[0].duration
        const gap = nextTime - time

        if (chord.length == 1) {
            batchSingleNote(chord[0], firstOctave, keymap, gap)
            notesCount++
        } else {
            batchChord(chord, firstOctave, keymap, gap)
            notesCount += chord.length
        }
    })
    console.log(`\nTotal notes: ${notesCount}`)
    ks.sendBatch()
})