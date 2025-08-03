# SoYume AI Creative Assistant

A next-generation, modular AI system designed specifically for creative writers, story developers, and neurodivergent users. SoYume provides intelligent assistance for story development, character creation, and narrative analysis with complete offline capabilities and universal accessibility.

## 🌟 Features

### Core Capabilities
- **Multi-tier AI Architecture**: Custom Co-writer AI + Local AI options + Cloud AI providers
- **Offline-First Design**: Full functionality without internet connectivity
- **Universal Accessibility**: Built-in support for dyslexia, ADHD, autism, and assistive technologies
- **Cross-Platform**: Windows, macOS, and Linux support
- **Modular Design**: Works as standalone app or plugin for other writing tools

### AI Intelligence
- **Story Structure Analysis**: Identify and improve narrative patterns (Save the Cat, Hero's Journey, etc.)
- **Character Development**: Deep character modeling with relationship mapping
- **Scene Generation**: Intelligent scene creation with mood and atmosphere
- **Plot Analysis**: Automated plot hole detection and pacing analysis
- **Manuscript Analysis**: Extract story elements from existing manuscripts

### Accessibility Features
- **Screen Reader Support**: Full NVDA, JAWS, and VoiceOver compatibility
- **Text-to-Speech**: Built-in TTS with customizable voices and settings
- **Dyslexia Support**: OpenDyslexic fonts and optimized spacing
- **Focus Modes**: Distraction-free environments for ADHD users
- **Keyboard Navigation**: Complete keyboard accessibility
- **High Contrast**: Multiple color schemes and contrast options

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/soyume/ai-creative-assistant.git
   cd ai-creative-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

The application will start with:
- Main process running the Electron app
- Renderer process serving the React UI on http://localhost:3000

### Building for Production

```bash
# Build the application
npm run build

# Package for distribution
npm run package
```

## 🏗️ Architecture

### Project Structure
```
src/
├── main/                 # Electron main process
│   ├── ai/              # AI engine and providers
│   ├── database/        # SQLite database management
│   ├── config/          # Configuration management
│   └── accessibility/   # Accessibility features
├── renderer/            # React frontend
├── shared/              # Shared types and utilities
└── test/               # Test utilities and setup
```

### Core Components

#### AI Engine (`src/main/ai/AIEngine.ts`)
- Manages multiple AI providers (Co-writer, local, cloud)
- Intelligent routing based on task type and user preferences
- Provider abstraction for consistent API

#### Database Manager (`src/main/database/DatabaseManager.ts`)
- Encrypted SQLite storage for stories, characters, and settings
- Automatic data migration and backup
- Analysis result caching

#### Configuration Manager (`src/main/config/ConfigManager.ts`)
- User preferences and settings management
- AI provider configuration
- Accessibility settings

#### Accessibility Manager (`src/main/accessibility/AccessibilityManager.ts`)
- Screen reader integration
- Text-to-speech functionality
- Focus modes and visual adjustments

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint
```

### Test Coverage
- Unit tests for all core components
- Database operation testing
- AI provider integration tests
- Accessibility compliance testing

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run package` - Create distribution packages

### Development Workflow
1. The app uses a multi-tier AI architecture with mock providers initially
2. External AI providers will be integrated in subsequent development phases
3. The custom Co-writer AI will be trained and integrated as the project progresses

## 🎯 Roadmap

### Phase 1: Foundation ✅
- [x] Project setup and core architecture
- [x] Database with encryption
- [x] AI provider abstraction
- [x] Basic accessibility features

### Phase 2: AI Integration (In Progress)
- [ ] External AI provider integrations (OpenAI, Anthropic, etc.)
- [ ] Local AI setup wizard (Ollama, LM Studio)
- [ ] SoYume Co-writer AI development

### Phase 3: Advanced Features
- [ ] Complete story intelligence features
- [ ] Advanced accessibility customization
- [ ] Plugin architecture for third-party integration

### Phase 4: Production Ready
- [ ] Comprehensive testing and QA
- [ ] Performance optimization
- [ ] Cross-platform distribution

## 🤝 Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Electron and React for cross-platform compatibility
- Uses better-sqlite3 for high-performance local storage
- Accessibility features inspired by WCAG 2.1 AAA guidelines
- Special thanks to the neurodivergent writing community for feedback and guidance

## 📞 Support

- **Documentation**: [docs.soyume.ai](https://docs.soyume.ai)
- **Issues**: [GitHub Issues](https://github.com/soyume/ai-creative-assistant/issues)
- **Community**: [Discord Server](https://discord.gg/soyume)
- **Email**: support@soyume.ai

---

**SoYume AI Creative Assistant** - Empowering creative writers with intelligent, accessible AI assistance.