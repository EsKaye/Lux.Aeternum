# Changelog

All notable changes to the Lux Aeternum project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup with TypeScript configuration
- Core interfaces for devices, commands, and events
- Base adapter abstraction for lighting systems
- Govee adapter implementation
- Philips Hue adapter implementation (in progress)
- Test suite for adapters
- Documentation and examples
- GitHub Actions CI/CD pipeline
- Automated testing and code coverage
- Release automation

### Changed
- Updated project structure for better modularity
- Improved error handling and logging
- Enhanced type safety throughout the codebase
- Refactored adapter interfaces for better extensibility

### Fixed
- Resolved TypeScript type errors
- Fixed test mocks and improved test coverage
- Addressed security vulnerabilities in dependencies

## [0.1.0] - 2025-07-27

### Added
- Initial release of Lux Aeternum SDK
- Support for Govee and Philips Hue lighting systems
- Basic light control functionality (on/off, color, brightness)
- Event system for reactive lighting control
- Basic documentation and examples

[Unreleased]: https://github.com/EsKaye/Lux.Aeternum/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/EsKaye/Lux.Aeternum/releases/tag/v0.1.0
