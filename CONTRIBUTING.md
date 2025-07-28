# Contributing to Lux Aeternum

Thank you for considering contributing to Lux Aeternum! We welcome all forms of contributions, including bug reports, feature requests, documentation improvements, and code contributions.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Requests](#pull-requests)
- [License](#license)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🚀 Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
   ```bash
   git clone https://github.com/your-username/Lux.Aeternum.git
   cd Lux.Aeternum
   ```
3. **Install** dependencies
   ```bash
   npm install
   ```
4. **Build** the project
   ```bash
   npm run build
   ```
5. **Run** tests
   ```bash
   npm test
   ```

## 🔄 Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. Make your changes following the code style guidelines

3. Add tests for your changes

4. Run the test suite and ensure all tests pass:
   ```bash
   npm test
   ```

5. Commit your changes with a descriptive commit message:
   ```bash
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve issue with light control"
   ```

6. Push your changes to your fork:
   ```bash
   git push origin your-branch-name
   ```

7. Open a Pull Request against the `main` branch

## 🎨 Code Style

- Use TypeScript with strict type checking
- Follow the [TypeScript Coding Guidelines](https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines)
- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Maximum line length: 100 characters
- Always include JSDoc comments for public APIs

## 🧪 Testing

We use Jest for testing. Follow these guidelines:

- Write tests for all new features and bug fixes
- Keep tests focused and isolated
- Mock external dependencies
- Use descriptive test names
- Aim for high test coverage

Run tests with:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📚 Documentation

- Update relevant documentation when adding new features
- Keep JSDoc comments up to date
- Add examples for complex functionality
- Document any breaking changes

## 🔄 Pull Requests

1. Keep PRs focused on a single feature or bugfix
2. Include a clear description of the changes
3. Reference any related issues
4. Update documentation as needed
5. Ensure all tests pass
6. Get at least one code review before merging

## 📄 License

By contributing to Lux Aeternum, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## 🙏 Thank You!

Your contributions help make Lux Aeternum better for everyone. Thank you for your time and effort!
