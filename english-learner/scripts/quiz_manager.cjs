#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { fsrs, createEmptyCard, Rating, State } = require('ts-fsrs');

const DATA_ROOT = path.join(os.homedir(), '.english-learner');
const WORDS_DIR = path.join(DATA_ROOT, 'words');
const PHRASES_DIR = path.join(DATA_ROOT, 'phrases');

const f = fsrs();

function loadJson(fp) {
  if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  return {};
}

function saveJson(fp, data) {
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function getAllItems() {
  const items = [];
  for (const [dir, type] of [[WORDS_DIR, 'word'], [PHRASES_DIR, 'phrase']]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
      const data = loadJson(path.join(dir, file));
      for (const v of Object.values(data)) {
        items.push({ ...v, _type: type, _file: path.join(dir, file), _key: type === 'word' ? v.word : v.phrase });
      }
    }
  }
  return items;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Generate quiz: pick items due for review ---
function generateQuiz(count = 10, mode = 'due') {
  const now = new Date();
  const items = getAllItems();

  let selected;
  if (mode === 'due') {
    // Items with FSRS that are due + items without FSRS (new)
    const due = items.filter(i => i.fsrs && new Date(i.fsrs.due) <= now);
    const newItems = items.filter(i => !i.fsrs);
    // Prioritize due items, then fill with new
    selected = [...shuffle(due), ...shuffle(newItems)].slice(0, count);
  } else if (mode === 'new') {
    selected = shuffle(items.filter(i => !i.fsrs)).slice(0, count);
  } else if (mode === 'hard') {
    // Items with high difficulty or in relearning state
    const hard = items.filter(i => i.fsrs && (i.fsrs.difficulty > 7 || i.fsrs.state === 3));
    selected = shuffle(hard).slice(0, count);
  } else {
    selected = shuffle(items).slice(0, count);
  }

  return selected.map(item => {
    const defs = item.definitions || [];
    const label = item._type === 'word' ? item.word : item.phrase;
    return {
      id: label,
      type: item._type,
      question: label,
      phonetic: item.phonetic || '',
      answer: item._type === 'word'
        ? defs.map(d => `${d.pos} ${d.meaning}`).join('; ')
        : (item.definition || ''),
      examples: item._type === 'word'
        ? defs.flatMap(d => d.examples || [])
        : (item.examples || []),
      fsrs: item.fsrs || null,
      state: item.fsrs ? ['New', 'Learning', 'Review', 'Relearning'][item.fsrs.state] : 'New',
      stability: item.fsrs?.stability || 0,
      difficulty: item.fsrs?.difficulty || 0,
    };
  });
}

// --- Grade a card and return updated FSRS state ---
function gradeCard(word, rating) {
  const ratingMap = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy };
  const r = ratingMap[rating.toLowerCase()];
  if (r === undefined) return { error: 'invalid_rating', valid: 'again, hard, good, easy' };

  const items = getAllItems();
  const item = items.find(i => i._key === word.toLowerCase());
  if (!item) return { error: 'not_found' };

  const card = item.fsrs || createEmptyCard();
  const now = new Date();
  const result = f.next(card, now, r);

  // Save back to file
  const data = loadJson(item._file);
  const key = item._key;
  data[key].fsrs = result.card;
  data[key].updated_at = now.toISOString();
  saveJson(item._file, data);

  return {
    word: key,
    rating,
    card: result.card,
    log: result.log,
    next_review: result.card.due,
    state: ['New', 'Learning', 'Review', 'Relearning'][result.card.state],
    stability: result.card.stability,
    difficulty: result.card.difficulty,
  };
}

// --- Review candidates: items due now ---
function reviewList(limit = 20) {
  const now = new Date();
  const items = getAllItems();
  const due = items.filter(i => i.fsrs && new Date(i.fsrs.due) <= now);
  const newItems = items.filter(i => !i.fsrs);

  return {
    due_count: due.length,
    new_count: newItems.length,
    items: [...shuffle(due), ...shuffle(newItems)].slice(0, limit).map(i => ({
      id: i._key,
      type: i._type,
      state: i.fsrs ? ['New', 'Learning', 'Review', 'Relearning'][i.fsrs.state] : 'New',
      due: i.fsrs?.due || null,
      stability: i.fsrs?.stability || 0,
      difficulty: i.fsrs?.difficulty || 0,
    })),
  };
}

// --- Summary ---
function summary() {
  const items = getAllItems();
  const now = new Date();
  const due = items.filter(i => i.fsrs && new Date(i.fsrs.due) <= now).length;
  const newCount = items.filter(i => !i.fsrs).length;
  const learning = items.filter(i => i.fsrs && i.fsrs.state === 1).length;
  const review = items.filter(i => i.fsrs && i.fsrs.state === 2).length;
  const relearning = items.filter(i => i.fsrs && i.fsrs.state === 3).length;
  const mature = items.filter(i => i.fsrs && i.fsrs.stability >= 21).length;

  return { total: items.length, due_now: due, new: newCount, learning, review, relearning, mature };
}

// --- Exports for testing ---
module.exports = { getAllItems, generateQuiz, gradeCard, reviewList, summary, DATA_ROOT, WORDS_DIR, PHRASES_DIR };

// --- CLI ---
if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
  case 'generate':
    console.log(JSON.stringify(generateQuiz(
      args[0] ? parseInt(args[0]) : 10,
      args[1] || 'due'
    ), null, 2));
    break;
  case 'grade':
    console.log(JSON.stringify(gradeCard(args[0], args[1]), null, 2));
    break;
  case 'review':
    console.log(JSON.stringify(reviewList(args[0] ? parseInt(args[0]) : 20), null, 2));
    break;
  case 'summary':
    console.log(JSON.stringify(summary(), null, 2));
    break;
  default:
    console.log('Commands: generate [count] [due|new|hard|random], grade <word> <again|hard|good|easy>, review [limit], summary');
    process.exit(1);
  }
}
