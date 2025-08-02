# Changelog

All notable changes to the Lux Aeternum project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Divina-L3 Ecosystem Integration**
  - New Divina-L3 adapter for spiritual and ambient lighting experiences
  - Profile sync service for cross-platform user state synchronization
  - Support for emotional and ritual-based lighting presets
  - Real-time WebSocket integration with Divina-L3 platform
  - Comprehensive type definitions for Divina-L3 data models
  - Documentation and examples for Divina-L3 integration

### Changed
- Updated README with Divina-L3 integration details and usage examples
- Enhanced type safety across the codebase
- Improved error handling and reconnection logic for adapters

### Fixed
- Various TypeScript type definitions and interfaces
- Event emission and handling in adapters
- WebSocket connection stability

### Added (Previous)
- Initial project setup with TypeScript configuration
- Core interfaces for devices, commands, and events
- Base adapter abstraction for lighting systems
- Govee adapter implementation
- Philips Hue adapter implementation
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
