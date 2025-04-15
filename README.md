# <img src="images/icon48.png" width="32" height="32" alt="UnBait logo"> UnBait

## Overview

UnBait is a Chrome extension that helps you avoid clickbait traps by revealing the actual content of articles without needing to visit the page. It uses AI to analyse article content and provide concise answers to clickbait headlines.

## How It Works

1. **Right-click on any clickbait link** you encounter while browsing
2. Select **"UnBait this link"** from the context menu
3. The extension will:
   - Open the page in a background tab
   - Extract the main content
   - Process it with an AI language model
   - Show you a concise answer
   - Close the background tab automatically

## Features

- **Quick Analysis**: Get article summaries in seconds without leaving your current page
- **Dismissible Results**: Click anywhere outside the result popup to dismiss it
- **Multiple AI Options**: Configure to use either OpenAI or Anthropic APIs
- **Customisable**: Use any model ID and customise the system prompt to your liking

## Setup

1. Install the extension
2. Click the extension icon in your toolbar
3. Go to **Settings**
4. Enter your API key for either OpenAI or Anthropic
5. Optionally customise the model ID and system prompt
6. Start UnBaiting clickbait links!

## Privacy & Data Usage

- The extension only processes the links you explicitly right-click and select for analysis
- Your API key is stored locally on your device
- Content is sent directly to the AI provider you select (OpenAI or Anthropic)
- No data is collected by the extension itself

## Technical Details

UnBait uses Mozilla's Readability library to extract the main content from webpages and either the OpenAI or Anthropic API to generate the summaries. All processing happens on-demand only when you explicitly request it.