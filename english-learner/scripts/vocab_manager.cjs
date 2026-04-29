#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_ROOT = path.join(os.homedir(), '.english-learner');
const WORDS_DIR = path.join(DATA_ROOT, 'words');
const PHRASES_DIR = path.join(DATA_ROOT, 'phrases');
const HISTORY_DIR = path.join(DATA_ROOT, 'history');

function ensureDirs() {
  for (const d of [WORDS_DIR, PHRASES_DIR, HISTORY_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function loadJson(fp) {
  if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  return {};
}

function saveJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function wordFile(word) {
  return path.join(WORDS_DIR, word.slice(0, 2).toLowerCase() + '.json');
}

function phraseFile(phrase) {
  return path.join(PHRASES_DIR, phrase.split(/\s+/)[0].toLowerCase() + '.json');
}

// --- Word CRUD ---
function getWord(word) {
  const data = loadJson(wordFile(word));
  return data[word.toLowerCase()] || null;
}

function saveWord(entry) {
  if (!entry || !entry.word || typeof entry.word !== 'string') {
    return { error: 'invalid_entry', message: 'word field is required' };
  }
  const fp = wordFile(entry.word);
  const data = loadJson(fp);
  const key = entry.word.toLowerCase();
  const existing = data[key];
  const now = new Date().toISOString();
  data[key] = {
    ...existing,
    ...entry,
    word: key,
    created_at: existing?.created_at || now,
    updated_at: now,
    lookup_count: existing?.lookup_count || 0,
    // FSRS fields — preserve if exist
    fsrs: existing?.fsrs || null,
  };
  saveJson(fp, data);
  return data[key];
}

function updateFsrs(word, fsrsCard, reviewLog) {
  const fp = wordFile(word);
  const data = loadJson(fp);
  const key = word.toLowerCase();
  if (!data[key]) return null;
  data[key].fsrs = fsrsCard;
  data[key].updated_at = new Date().toISOString();
  if (!data[key].review_logs) data[key].review_logs = [];
  if (reviewLog) data[key].review_logs.push(reviewLog);
  saveJson(fp, data);
  return data[key];
}

// --- Phrase CRUD ---
function getPhrase(phrase) {
  const data = loadJson(phraseFile(phrase));
  return data[phrase.toLowerCase()] || null;
}

function savePhrase(entry) {
  if (!entry || !entry.phrase || typeof entry.phrase !== 'string') {
    return { error: 'invalid_entry', message: 'phrase field is required' };
  }
  const fp = phraseFile(entry.phrase);
  const data = loadJson(fp);
  const key = entry.phrase.toLowerCase();
  const existing = data[key];
  const now = new Date().toISOString();
  data[key] = {
    ...existing,
    ...entry,
    phrase: key,
    created_at: existing?.created_at || now,
    updated_at: now,
    lookup_count: existing?.lookup_count || 0,
    fsrs: existing?.fsrs || null,
  };
  saveJson(fp, data);
  return data[key];
}

// --- Batch ops ---
function batchGet(words) {
  return words.map(w => ({ word: w, data: getWord(w) }));
}

function batchSave(entries) {
  return entries.map(e => e.phrase ? savePhrase(e) : saveWord(e));
}

// --- All items ---
function getAllWords() {
  const words = [];
  if (fs.existsSync(WORDS_DIR)) {
    for (const f of fs.readdirSync(WORDS_DIR).filter(n => n.endsWith('.json'))) {
      const data = loadJson(path.join(WORDS_DIR, f));
      words.push(...Object.values(data));
    }
  }
  return words;
}

function getAllPhrases() {
  const phrases = [];
  if (fs.existsSync(PHRASES_DIR)) {
    for (const f of fs.readdirSync(PHRASES_DIR).filter(n => n.endsWith('.json'))) {
      const data = loadJson(path.join(PHRASES_DIR, f));
      phrases.push(...Object.values(data));
    }
  }
  return phrases;
}

// --- Stats ---
function stats() {
  const words = getAllWords();
  const phrases = getAllPhrases();
  const all = [...words, ...phrases];

  const hasFsrs = all.filter(i => i.fsrs);
  const noFsrs = all.filter(i => !i.fsrs);

  // FSRS states: 0=New, 1=Learning, 2=Review, 3=Relearning
  const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
  for (const i of hasFsrs) {
    const s = i.fsrs.state;
    if (s === 0) byState.new++;
    else if (s === 1) byState.learning++;
    else if (s === 2) byState.review++;
    else if (s === 3) byState.relearning++;
  }

  return {
    total_words: words.length,
    total_phrases: phrases.length,
    total: all.length,
    not_started: noFsrs.length + byState.new,
    learning: byState.learning,
    review: byState.review,
    relearning: byState.relearning,
    total_lookups: all.reduce((s, i) => s + (i.lookup_count || 0), 0),
  };
}

// --- Log query ---
function logQuery(query, type) {
  const today = new Date().toISOString().slice(0, 10);
  const fp = path.join(HISTORY_DIR, today + '.json');
  const data = loadJson(fp);
  if (!data.queries) data.queries = [];
  data.queries.push({ query, type, timestamp: new Date().toISOString() });
  saveJson(fp, data);
}

// --- Exports for testing ---
module.exports = { ensureDirs, getWord, saveWord, updateFsrs, getPhrase, savePhrase, batchGet, batchSave, getAllWords, getAllPhrases, stats, logQuery, DATA_ROOT, WORDS_DIR, PHRASES_DIR, HISTORY_DIR };

// --- CLI ---
if (require.main === module) {
  ensureDirs();
  const [cmd, ...args] = process.argv.slice(2);

  function tryParseJSON(str, label) {
    try { return JSON.parse(str); }
    catch { console.log(JSON.stringify({ error: 'invalid_json', field: label })); process.exit(1); }
  }

  switch (cmd) {
    case 'get_word':
      if (!args[0]) { console.log(JSON.stringify({ error: 'missing_word' })); process.exit(1); }
      console.log(JSON.stringify(getWord(args[0])));
      break;
    case 'save_word':
      console.log(JSON.stringify(saveWord(tryParseJSON(args[0], 'word_json'))));
      break;
    case 'update_fsrs':
      if (!args[0]) { console.log(JSON.stringify({ error: 'missing_word' })); process.exit(1); }
      console.log(JSON.stringify(updateFsrs(args[0], tryParseJSON(args[1], 'fsrs_json'), args[2] ? tryParseJSON(args[2], 'log_json') : null)));
      break;
    case 'get_phrase':
      if (!args[0]) { console.log(JSON.stringify({ error: 'missing_phrase' })); process.exit(1); }
      console.log(JSON.stringify(getPhrase(args[0])));
      break;
    case 'save_phrase':
      console.log(JSON.stringify(savePhrase(tryParseJSON(args[0], 'phrase_json'))));
      break;
    case 'batch_get':
      console.log(JSON.stringify(batchGet(tryParseJSON(args[0], 'words_array'))));
      break;
    case 'batch_save':
      console.log(JSON.stringify(batchSave(tryParseJSON(args[0], 'entries_array'))));
      break;
    case 'stats':
      console.log(JSON.stringify(stats(), null, 2));
      break;
    case 'log_query':
      if (!args[0]) { console.log(JSON.stringify({ error: 'missing_query' })); process.exit(1); }
      logQuery(args[0], args[1] || 'word');
      console.log('{"ok":true}');
      break;
    case 'all_words':
      console.log(JSON.stringify(getAllWords()));
      break;
    case 'all_phrases':
      console.log(JSON.stringify(getAllPhrases()));
      break;
    default:
      console.log('Commands: get_word, save_word, update_fsrs, get_phrase, save_phrase, batch_get, batch_save, stats, log_query, all_words, all_phrases');
      process.exit(1);
  }
}
