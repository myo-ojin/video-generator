#!/bin/bash

# AI News Video Generator - Setup Script (Linux/macOS)
# This script sets up the project environment

set -e

echo "=========================================="
echo "AI News Video Generator - Setup"
echo "=========================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js v18.0.0 or higher"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version must be 18.0.0 or higher"
    echo "Current version: $(node -v)"
    exit 1
fi

echo "✓ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Create directories
echo "Creating directories..."
mkdir -p output
mkdir -p cache
mkdir -p logs
mkdir -p assets
echo "✓ Directories created"
echo ""

# Copy configuration files
echo "Setting up configuration files..."

if [ ! -f "config/pipeline-config.json" ]; then
    cp config/pipeline-config.example.json config/pipeline-config.json
    echo "✓ Created config/pipeline-config.json"
else
    echo "  config/pipeline-config.json already exists"
fi

if [ ! -f "config/research-config.json" ]; then
    cp config/research-config.example.json config/research-config.json
    echo "✓ Created config/research-config.json"
else
    echo "  config/research-config.json already exists"
fi

if [ ! -f "config/script-generation-config.json" ]; then
    cp config/script-generation-config.example.json config/script-generation-config.json
    echo "✓ Created config/script-generation-config.json"
else
    echo "  config/script-generation-config.json already exists"
fi

if [ ! -f "config/subtitle-generation-config.json" ]; then
    cp config/subtitle-generation-config.example.json config/subtitle-generation-config.json
    echo "✓ Created config/subtitle-generation-config.json"
else
    echo "  config/subtitle-generation-config.json already exists"
fi

if [ ! -f "config/voice-synthesis-config.json" ]; then
    cp config/voice-synthesis-config.example.json config/voice-synthesis-config.json
    echo "✓ Created config/voice-synthesis-config.json"
else
    echo "  config/voice-synthesis-config.json already exists"
fi

if [ ! -f "config/video-composition-config.json" ]; then
    cp config/video-composition-config.example.json config/video-composition-config.json
    echo "✓ Created config/video-composition-config.json"
else
    echo "  config/video-composition-config.json already exists"
fi

if [ ! -f "config/youtube-upload-config.json" ]; then
    cp config/youtube-upload-config.example.json config/youtube-upload-config.json
    echo "✓ Created config/youtube-upload-config.json"
else
    echo "  config/youtube-upload-config.json already exists"
fi

if [ ! -f "config/credentials.json" ]; then
    cp config/credentials.example.json config/credentials.json
    echo "✓ Created config/credentials.json (PLEASE UPDATE WITH YOUR CREDENTIALS)"
else
    echo "  config/credentials.json already exists"
fi

echo ""

# Build TypeScript
echo "Building TypeScript..."
npm run build
echo "✓ Build completed"
echo ""

# Check external tools
echo "Checking external tools..."

if command -v codex &> /dev/null; then
    echo "✓ Codex CLI: $(codex --version 2>&1 | head -n 1)"
else
    echo "⚠ Codex CLI: Not found (required for Research Node)"
fi

if command -v claude &> /dev/null; then
    echo "✓ Claude CLI: Found"
else
    echo "⚠ Claude CLI: Not found (required for Script Generation Node)"
fi

if command -v ffmpeg &> /dev/null; then
    echo "✓ FFmpeg: $(ffmpeg -version 2>&1 | head -n 1)"
else
    echo "⚠ FFmpeg: Not found (required for Video Composition Node)"
fi

echo ""
echo "=========================================="
echo "Setup completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Update config/credentials.json with your YouTube API credentials"
echo "2. Start VOICEVOX (http://localhost:50021)"
echo "3. Run the pipeline: npm run run:pipeline"
echo ""
echo "For more information, see README.md"
echo ""
