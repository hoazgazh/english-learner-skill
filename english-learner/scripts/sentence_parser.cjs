#!/usr/bin/env node
// Classify input as word, phrase, or sentence
const input = process.argv.slice(2).join(' ').trim();
if (!input) { console.log(JSON.stringify({ error: 'no_input' })); process.exit(1); }

const tokens = input.split(/\s+/);
const hasPunct = /[.!?]/.test(input);

let type;
if (tokens.length === 1) type = 'word';
else if (tokens.length <= 5 && !hasPunct) type = 'phrase';
else type = 'sentence';

console.log(JSON.stringify({ input, type, tokens: tokens.length }));
