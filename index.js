#!/usr/bin/env node
const yargs = require('yargs')
const ks = require('./node-key-sender/key-sender.js')
const path = require('path')

const { loadKeymap, loadChords, loadTracks } = require('./utils.js')
const { compressChords, getBaseOctave, buildAndEmitEvents } = require('./batchUtils.js')
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
    compressChords(chords)
    const firstOctave = getBaseOctave(chords)
    const notesCount = buildAndEmitEvents(chords, firstOctave, keymap)
    console.log(`\nTotal notes: ${notesCount}`)
    ks.sendBatch()
})