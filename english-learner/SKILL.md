---
name: english-learner
description: "Use this skill on EVERY user message written in English to auto-detect grammar, word choice, and expression issues — teach corrections before proceeding with the task. Also use when the user looks up a single word, asks about a phrase like 'break the ice', requests translation, or asks for quiz/review. Triggers on: any English message, single English words, idioms, 'quiz', 'review', 'stats', vocabulary review. Stores vocabulary in ~/.english-learner/ with FSRS spaced repetition scheduling."
metadata:
  author: "hoazgazh"
  version: "4.0"
  trigger: "always"
---

# English Learner v4 — FSRS Edition

Personal vocabulary assistant with **FSRS spaced repetition** (same algorithm as Anki 23.10+).

## When to Use

**Invoke when:**
- User inputs a single English word (e.g. `run`, `ephemeral`)
- User inputs an English phrase or idiom (e.g. `break the ice`)
- User inputs a sentence to translate or analyze
- User asks to quiz/review vocabulary (`quiz`, `review`, `stats`)
- **Auto-intercept**: User writes English with detectable grammar issues

**Do NOT invoke when:**
- Code, programming, or technical questions
- File paths, commands, technical output
- User's English is already fluent (skip silently)

## Auto-Intercept Mode

When user writes English with issues, prepend before your response:

```
💡 **English Tip:**

| Your Expression | Better Expression | Why |
|----------------|-------------------|-----|
| {original} | {corrected} | {brief explanation} |

---
```

Rules: max 3 corrections, never block the task, save corrected words via batch_save.

## Scripts

All in `{skill_root}/scripts/`. Data at `~/.english-learner/`.

```bash
# vocab_manager.cjs — Word/Phrase CRUD
node vocab_manager.cjs get_word <word>
node vocab_manager.cjs save_word '<json>'
node vocab_manager.cjs get_phrase <phrase>
node vocab_manager.cjs save_phrase '<json>'
node vocab_manager.cjs batch_get '["word1","word2"]'
node vocab_manager.cjs batch_save '[{...}]'
node vocab_manager.cjs update_fsrs <word> '<fsrs_card_json>' '<review_log_json>'
node vocab_manager.cjs stats
node vocab_manager.cjs log_query <query> <type>

# quiz_manager.cjs — FSRS-powered quiz
node quiz_manager.cjs generate [count] [due|new|hard|random]
node quiz_manager.cjs grade <word> <again|hard|good|easy>
node quiz_manager.cjs review [limit]
node quiz_manager.cjs summary
```

## FSRS Rating Guide

When user answers a quiz question, grade with:

| Rating | When to use | Effect |
|--------|------------|--------|
| `again` | Completely forgot | Reset to short interval, increase difficulty |
| `hard` | Recalled with significant difficulty | Shorter next interval |
| `good` | Recalled with some effort | Normal interval growth |
| `easy` | Instant recall, no effort | Longer interval, decrease difficulty |

## Workflow

```
[0. Auto-Intercept] → English issues? → Show tip, continue
        ↓
[1. Detect Mode] → quiz/review/stats? → Learning Mode
        ↓
[2. Classify Input] → word / phrase / sentence
        ↓
[3. Batch Lookup] → check existing vocabulary
        ↓
[4. AI Generate] → definitions, phonetics, examples for unknowns
        ↓
[5. Batch Save] ← MANDATORY before responding
        ↓
[6. Log Query]
        ↓
[7. Respond]
```

## Input Classification

Use `sentence_parser.cjs`:

| Type | Rule | Example |
|------|------|---------|
| word | 1 token | `run`, `ephemeral` |
| phrase | 2-5 tokens, no `.!?` | `break the ice` |
| sentence | 6+ tokens or has `.!?` | `The early bird catches the worm.` |

## Response Formats

### Word

```
📖 **{word}** {phonetic}

**Definitions:**
1. **{pos}** {vietnamese_meaning}
   - {example_en}
   - {example_vi}

**Synonyms:** {synonyms}
**Antonyms:** {antonyms}

---
📊 Lookups: {count} | FSRS: {state} | Stability: {days}d | Next review: {date}
```

### Phrase

```
📖 **{phrase}** {phonetic}

**Meaning:** {vietnamese_meaning}
**Literal:** {literal_meaning}

**Examples:**
- {example_en}
  {example_vi}

---
📊 Lookups: {count} | FSRS: {state} | Stability: {days}d
```

### Sentence

```
📝 **Sentence Analysis**

**Original:** {original}
**Translation:** {vietnamese}

---
**Vocabulary Breakdown:**
{For each key word, use Word format}

---
📊 New words added: {list}
```

## Quiz Mode (FSRS)

When user says `quiz`:

```
1. Generate quiz: node quiz_manager.cjs generate 10 due
2. If empty → "No words due for review! Try looking up new words."
3. For EACH quiz item, show:
   📖 **{word}** {phonetic}
   > "{example sentence}"
   Do you remember the meaning?
4. Wait for user answer
5. Show correct answer
6. Grade: node quiz_manager.cjs grade <word> <rating>
7. Show FSRS result: next review date, stability, state
8. Continue or show summary
```

### Quiz answer evaluation

After user answers:
- If correct → grade `good` (or `easy` if instant)
- If partially correct → grade `hard`
- If wrong → grade `again`
- Show the correct answer with full definition
- Show next review date from FSRS

### Empty quiz

```
📚 **No words due for review!**

Total vocabulary: {total} | Learning: {learning} | Mastered: {mature}

Try:
- `quiz new` — Quiz unlearned words
- `quiz hard` — Quiz difficult words
- `quiz random` — Random quiz
- Look up new words to add to your vocabulary
```

## Review Mode

When user says `review`:
```
1. node quiz_manager.cjs review 20
2. Show list of due items with state, stability, difficulty
3. Offer to start quiz from due items
```

## Stats Mode

When user says `stats`:
```
1. node quiz_manager.cjs summary
2. node vocab_manager.cjs stats

📊 **Learning Statistics**

| Category | Count |
|----------|-------|
| Total vocabulary | {total} |
| Due now | {due_now} |
| New (not started) | {new} |
| Learning | {learning} |
| Review (known) | {review} |
| Relearning | {relearning} |
| Mature (stability ≥21d) | {mature} |
| Total lookups | {lookups} |
```

## Data Structure

```
~/.english-learner/
├── words/{prefix}.json       # Words by first 2 letters
├── phrases/{first_word}.json # Phrases by first word
└── history/{date}.json       # Daily query logs
```

### Word Schema (with FSRS)

```json
{
  "word": "ephemeral",
  "definitions": [{ "pos": "adj.", "meaning": "short-lived, fleeting", "examples": [...] }],
  "phonetic": "/ɪˈfem.ər.əl/",
  "synonyms": ["transient", "fleeting"],
  "antonyms": ["permanent", "enduring"],
  "created_at": "2026-04-28T02:01:07Z",
  "updated_at": "2026-04-28T14:00:00Z",
  "lookup_count": 2,
  "fsrs": {
    "due": "2026-04-30T00:00:00Z",
    "stability": 3.17,
    "difficulty": 5.28,
    "elapsed_days": 0,
    "scheduled_days": 2,
    "reps": 1,
    "lapses": 0,
    "state": 2,
    "last_review": "2026-04-28T14:00:00Z"
  }
}
```

## FSRS States Explained

| State | Meaning | What happens |
|-------|---------|-------------|
| 0 - New | Never reviewed | First quiz will set initial schedule |
| 1 - Learning | Just started | Short intervals (minutes to hours) |
| 2 - Review | Known, scheduled | Intervals grow: days → weeks → months |
| 3 - Relearning | Forgot, restarting | Back to short intervals |

## Execution Checklist

Before responding:
- [ ] Auto-intercept: scanned English for issues
- [ ] All words/phrases extracted
- [ ] Batch lookup via batch_get
- [ ] New words SAVED via batch_save (MANDATORY)
- [ ] Query logged via log_query
- [ ] Response uses format above
- [ ] FSRS state shown in response footer
