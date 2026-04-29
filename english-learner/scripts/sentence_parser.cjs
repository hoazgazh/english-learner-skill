#!/usr/bin/env node
// Classify input as word, phrase, or sentence

function classify(input) {
  if (!input || !input.trim()) return { error: 'no_input' };
  input = input.trim();
  const tokens = input.split(/\s+/);
  const hasPunct = /[.!?]/.test(input);

  let type;
  if (tokens.length === 1) type = 'word';
  else if (tokens.length <= 5 && !hasPunct) type = 'phrase';
  else type = 'sentence';

  return { input, type, tokens: tokens.length };
}

module.exports = { classify };

if (require.main === module) {
  const input = process.argv.slice(2).join(' ').trim();
  const result = classify(input);
  if (result.error) process.exit(1);
  console.log(JSON.stringify(result));
}
