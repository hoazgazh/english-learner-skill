# Contributing to English Learner Skill

Thanks for your interest in contributing! 🎉

## How to Contribute

1. **Fork** the repo
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## Development Setup

```bash
git clone https://github.com/hoazgazh/english-learner-skill.git
cd english-learner-skill/english-learner/scripts
npm install
```

### Test scripts

```bash
node vocab_manager.cjs stats
node quiz_manager.cjs summary
node sentence_parser.cjs "hello world"
```

## What to Contribute

- 🐛 Bug fixes
- 🌍 Multi-language support (beyond Vietnamese)
- 📝 Better word definitions and examples
- 🧪 Tests
- 📖 Documentation improvements

## Code Style

- Use CommonJS (`.cjs`) for Node.js scripts
- Keep scripts dependency-light (only `ts-fsrs`)
- Data stored at `~/.english-learner/`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
