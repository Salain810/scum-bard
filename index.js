#!/usr/bin/env node
const yargs = require('yargs')
const ks = require('./node-key-sender/key-sender.js')
const path = require('path')

const { loadKeymap, loadChords } = require('./utils.js')
const { getFirstOctave, batchSingleNote, batchChord, resetCharacterOctave } = require('./batchUtils.js')

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
    .argv

const defaultKeymap = [
    __dirname,
    'keymap.json'
].join(path.sep)

const keymap = loadKeymap(argv.keymap || defaultKeymap)

loadChords(argv.file, argv.track, (chords) => {
    ks.startBatch()
    resetCharacterOctave()
    let notesCount = 0
    const firstOctave = getFirstOctave(chords)

    Object.values(chords).forEach(chord => {
        // Single note
        if (chord.length == 1) {
            batchSingleNote(chord[0], firstOctave, keymap)
            notesCount++
        } else {
            batchChord(chord, firstOctave, keymap)
            notesCount += chord.length
        }
    })
    console.log(`\nTotal notes: ${notesCount}`)
    ks.sendBatch()
})