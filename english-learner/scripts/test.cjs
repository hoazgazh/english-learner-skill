const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Use a temp directory for test data
const TEST_ROOT = path.join(os.tmpdir(), 'english-learner-test-' + Date.now());
process.env.ENGLISH_LEARNER_DATA_ROOT = TEST_ROOT;

// We need to override DATA_ROOT before requiring modules.
// Since the modules use const at top level, we patch via a helper.
function setupTestDir() {
  fs.mkdirSync(path.join(TEST_ROOT, 'words'), { recursive: true });
  fs.mkdirSync(path.join(TEST_ROOT, 'phrases'), { recursive: true });
  fs.mkdirSync(path.join(TEST_ROOT, 'history'), { recursive: true });
}

function cleanTestDir() {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
}

// Since modules hardcode DATA_ROOT, we'll test via CLI subprocess
const { execFileSync } = require('child_process');
const SCRIPTS = path.join(__dirname);

function run(script, args = []) {
  const result = execFileSync('node', [path.join(SCRIPTS, script), ...args], {
    cwd: SCRIPTS,
    encoding: 'utf-8',
    env: { ...process.env, HOME: TEST_ROOT.replace(/\/.english-learner.*/, ''), USERPROFILE: TEST_ROOT.replace(/\/.english-learner.*/, '') },
    timeout: 10000,
  });
  return result.trim();
}

// Override HOME so scripts write to temp dir
const FAKE_HOME = path.join(TEST_ROOT, 'home');

function runWithHome(script, args = []) {
  fs.mkdirSync(FAKE_HOME, { recursive: true });
  const result = execFileSync('node', [path.join(SCRIPTS, script), ...args], {
    cwd: SCRIPTS,
    encoding: 'utf-8',
    env: { ...process.env, HOME: FAKE_HOME },
    timeout: 10000,
  });
  return result.trim();
}

function runJSON(script, args = []) {
  return JSON.parse(runWithHome(script, args));
}

// --- sentence_parser tests ---
describe('sentence_parser', () => {
  it('classifies single word', () => {
    const r = runJSON('sentence_parser.cjs', ['hello']);
    assert.equal(r.type, 'word');
    assert.equal(r.tokens, 1);
  });

  it('classifies phrase (2-5 tokens, no punctuation)', () => {
    const r = runJSON('sentence_parser.cjs', ['break', 'the', 'ice']);
    assert.equal(r.type, 'phrase');
    assert.equal(r.tokens, 3);
  });

  it('classifies sentence (has punctuation)', () => {
    const r = runJSON('sentence_parser.cjs', ['Hello', 'world.']);
    assert.equal(r.type, 'sentence');
  });

  it('classifies sentence (6+ tokens)', () => {
    const r = runJSON('sentence_parser.cjs', ['The', 'quick', 'brown', 'fox', 'jumps', 'over']);
    assert.equal(r.type, 'sentence');
    assert.equal(r.tokens, 6);
  });

  it('exits with error on empty input', () => {
    assert.throws(() => {
      execFileSync('node', [path.join(SCRIPTS, 'sentence_parser.cjs')], {
        encoding: 'utf-8',
        timeout: 5000,
      });
    });
  });
});

// --- vocab_manager tests ---
describe('vocab_manager', () => {
  beforeEach(() => {
    // Clean data between tests
    const dataDir = path.join(FAKE_HOME, '.english-learner');
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('returns null for unknown word', () => {
    const r = runJSON('vocab_manager.cjs', ['get_word', 'nonexistent']);
    assert.equal(r, null);
  });

  it('saves and retrieves a word', () => {
    const word = { word: 'test', definitions: [{ pos: 'n.', meaning: 'a trial' }], phonetic: '/tɛst/' };
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify(word)]);
    const r = runJSON('vocab_manager.cjs', ['get_word', 'test']);
    assert.equal(r.word, 'test');
    assert.equal(r.phonetic, '/tɛst/');
    assert.equal(r.definitions[0].pos, 'n.');
    assert.ok(r.created_at);
    assert.equal(r.lookup_count, 0);
    assert.equal(r.fsrs, null);
  });

  it('preserves created_at on update', () => {
    const word = { word: 'hello', definitions: [{ pos: 'interj.', meaning: 'greeting' }] };
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify(word)]);
    const r1 = runJSON('vocab_manager.cjs', ['get_word', 'hello']);

    const updated = { word: 'hello', definitions: [{ pos: 'interj.', meaning: 'a greeting' }] };
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify(updated)]);
    const r2 = runJSON('vocab_manager.cjs', ['get_word', 'hello']);

    assert.equal(r1.created_at, r2.created_at);
    assert.equal(r2.definitions[0].meaning, 'a greeting');
  });

  it('saves and retrieves a phrase', () => {
    const phrase = { phrase: 'break the ice', definition: 'to initiate conversation' };
    runWithHome('vocab_manager.cjs', ['save_phrase', JSON.stringify(phrase)]);
    const r = runJSON('vocab_manager.cjs', ['get_phrase', 'break the ice']);
    assert.equal(r.phrase, 'break the ice');
    assert.equal(r.definition, 'to initiate conversation');
  });

  it('batch_get returns results for multiple words', () => {
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify({ word: 'alpha' })]);
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify({ word: 'beta' })]);
    const r = runJSON('vocab_manager.cjs', ['batch_get', '["alpha","beta","gamma"]']);
    assert.equal(r.length, 3);
    assert.ok(r[0].data);
    assert.ok(r[1].data);
    assert.equal(r[2].data, null);
  });

  it('batch_save saves multiple entries', () => {
    const entries = [{ word: 'one' }, { word: 'two' }];
    runWithHome('vocab_manager.cjs', ['batch_save', JSON.stringify(entries)]);
    const r1 = runJSON('vocab_manager.cjs', ['get_word', 'one']);
    const r2 = runJSON('vocab_manager.cjs', ['get_word', 'two']);
    assert.ok(r1);
    assert.ok(r2);
  });

  it('stats returns correct counts', () => {
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify({ word: 'cat' })]);
    runWithHome('vocab_manager.cjs', ['save_word', JSON.stringify({ word: 'dog' })]);
    const r = runJSON('vocab_manager.cjs', ['stats']);
    assert.equal(r.total_words, 2);
    assert.equal(r.total, 2);
    assert.equal(r.not_started, 2);
  });

  it('log_query creates history entry', () => {
    const r = runJSON('vocab_manager.cjs', ['log_query', 'hello', 'word']);
    assert.equal(r.ok, true);
  });
});

// --- quiz_manager tests ---
describe('quiz_manager', () => {
  beforeEach(() => {
    const dataDir = path.join(FAKE_HOME, '.english-learner');
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  function seedWord(word, fsrs = null) {
    const dataDir = path.join(FAKE_HOME, '.english-learner', 'words');
    fs.mkdirSync(dataDir, { recursive: true });
    const prefix = word.slice(0, 2).toLowerCase();
    const fp = path.join(dataDir, prefix + '.json');
    let data = {};
    if (fs.existsSync(fp)) data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    data[word] = {
      word,
      definitions: [{ pos: 'n.', meaning: 'test meaning', examples: ['example sentence'] }],
      phonetic: '/test/',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lookup_count: 1,
      fsrs,
    };
    fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  }

  it('summary returns zeros for empty data', () => {
    // Ensure dir exists
    fs.mkdirSync(path.join(FAKE_HOME, '.english-learner', 'words'), { recursive: true });
    const r = runJSON('quiz_manager.cjs', ['summary']);
    assert.equal(r.total, 0);
    assert.equal(r.due_now, 0);
  });

  it('generate returns new words when no FSRS data', () => {
    seedWord('apple');
    seedWord('banana');
    const r = runJSON('quiz_manager.cjs', ['generate', '5', 'new']);
    assert.ok(r.length > 0);
    assert.ok(r.length <= 2);
    assert.equal(r[0].state, 'New');
  });

  it('grade assigns FSRS state to a word', () => {
    seedWord('cherry');
    const r = runJSON('quiz_manager.cjs', ['grade', 'cherry', 'good']);
    assert.ok(!r.error);
    assert.equal(r.word, 'cherry');
    assert.equal(r.rating, 'good');
    assert.ok(r.next_review);
    assert.ok(r.stability > 0);
  });

  it('grade returns error for invalid rating', () => {
    seedWord('date');
    const r = runJSON('quiz_manager.cjs', ['grade', 'date', 'invalid']);
    assert.equal(r.error, 'invalid_rating');
  });

  it('grade returns error for unknown word', () => {
    fs.mkdirSync(path.join(FAKE_HOME, '.english-learner', 'words'), { recursive: true });
    const r = runJSON('quiz_manager.cjs', ['grade', 'nonexistent', 'good']);
    assert.equal(r.error, 'not_found');
  });

  it('review returns due items', () => {
    // Seed a word with past due date
    seedWord('elder', {
      due: '2020-01-01T00:00:00Z',
      stability: 1, difficulty: 5, elapsed_days: 0,
      scheduled_days: 1, reps: 1, lapses: 0, state: 2,
      last_review: '2020-01-01T00:00:00Z',
    });
    const r = runJSON('quiz_manager.cjs', ['review', '10']);
    assert.ok(r.due_count >= 1);
  });

  it('summary counts states correctly', () => {
    seedWord('fig');
    seedWord('grape', {
      due: '2099-01-01T00:00:00Z',
      stability: 5, difficulty: 5, elapsed_days: 0,
      scheduled_days: 5, reps: 2, lapses: 0, state: 2,
      last_review: new Date().toISOString(),
    });
    const r = runJSON('quiz_manager.cjs', ['summary']);
    assert.equal(r.total, 2);
    assert.equal(r.new, 1);
    assert.equal(r.review, 1);
  });
});

// Cleanup
after(() => {
  fs.rmSync(FAKE_HOME, { recursive: true, force: true });
});
