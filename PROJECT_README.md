# Farsight Keep - Project Documentation

**Last Updated:** 2026-07-17  
**Version:** 1.0 (pre-release)  
**Status:** Feature-complete, preparing for distribution

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [File Structure](#file-structure)
4. [Architecture & Design Patterns](#architecture--design-patterns)
5. [Data Model](#data-model)
6. [Key Utilities & Functions](#key-utilities--functions)
7. [Development Environment](#development-environment)
8. [Current State](#current-state)
9. [Known Invariants & Constraints](#known-invariants--constraints)

---

## Project Overview

### What is Farsight Keep?

Farsight Keep is an **Electron-based desktop application** for running Dungeons & Dragons 5/5.5e. It serves as a comprehensive toolkit for Dungeon Masters to:

- Manage campaigns with multiple player characters and NPCs
- Build and store custom monsters, NPCs, player characters, and spells
- Run combat encounters with initiative tracking, HP management, and condition tracking
- Import existing creatures from Game Master 5e (no affiliation) XML format
- Take session notes organized by campaign

### Target Users

- **Dungeon Masters** running D&D 5e games (online or in-person)
- Users seeking a **lightweight, offline-capable** alternative to web-based tools
- DMs who want **custom content creation** without subscriptions or account requirements

### Key Features

#### Campaign Management
- Create multiple campaigns with independent character rosters
- Track player characters and non-player characters
- Organize encounters and session notes per campaign
- Switch between multiple campaigns seamlessly

#### Creature Builders
- **Monster & NPC Builders**: Create monsters/NPCs from scratch or copy from pre-existing stat blocks
- **PC Builder**: Full player character creator
- **Spell Builder**: Custom spell creation

#### Encounter System
- Initiative tracking with automatic sorting
- HP tracking with visual HP bars
- Condition/status effect toggles
- Limited-use ability tracking (spell slots, charges, recharges, daily uses)
- Roll attacks and damage, and check spell details directly from combatant cards
- Notes per combatant

#### Data Management
- **XML Import**: Import creatures from Game Master 5e (no affiliation) format
- **XML Export**: Export individual creatures or entire campaigns
- **Local Storage**: All data stored locally in Electron's userData directory, no cloud sync

---

## Tech Stack

### Core Technologies

- **Runtime**: Electron 34.0.0 (Node.js 20.x, Chromium 130)
- **Language**: Vanilla JavaScript (ES6+)
- **UI**: Pure HTML/CSS (no frameworks)
- **Storage**: LocalStorage-based JSON persistence
- **Packaging**: electron-builder (planned)

### Dependencies

**Production:**
- `electron`: 34.0.0 - Desktop app framework
- `electron-log`: 5.2.4 - Logging for main/renderer processes

**Development:**
- `electron-builder`: 25.1.8 - Distribution packaging (planned)

---

## File Structure

```
farsight-keep/
├── main.js                      # Electron main process entry point
├── renderer.js                  # Core UI logic, data management, encounters
├── monster-builder.js           # Monster builder UI and logic
├── npc-builder.js               # NPC builder UI and logic
├── pc-builder.js                # PC builder UI and logic
├── spell-builder.js             # Spell builder UI and logic
├── storage.js                   # LocalStorage persistence layer
├── index.html                   # Main application HTML
├── package.json                 # Node dependencies and scripts
│
├── assets/                      # Images and fonts
│   ├── Background.png           # Main UI background texture
│   ├── *.png                    # Tab icons, builder images
│   └── Fonts/                   # Custom fonts (Germania One, Jersey 10)
│
├── .claude/                     # Claude Code configuration
│   └── settings.local.json      # Project-specific settings
│
└── PROJECT_README.md            # This file
```

### Key Files Explained

#### `main.js`
- Electron main process
- Creates browser window
- Handles window state persistence
- Minimal - most logic is in renderer

#### `renderer.js` (384KB, ~8200 lines)
- **Largest file** - core application logic
- Navigation system (tabs, screens, history)
- Data import/export (XML parsing)
- Encounter builder and combat tracker
- Monster/NPC/PC display (stat blocks)
- One-time data migrations
- Shared utilities (expandSize, parseDamageString, parseAttackFromText, renderMarkdown)

#### `monster-builder.js` (142KB, ~3100 lines)
- Monster creation/editing form
- Drag-and-drop ability reordering
- Attack picker with damage calculation
- Spellcasting integration
- Shared by NPC builder (reuses rendering)

#### `npc-builder.js` (44KB, ~900 lines)
- NPC creation with proper name vs. title distinction
- Converts Monster Builder format ↔ NPC format
- Reuses Monster Builder rendering via `mb.draft` pattern

#### `pc-builder.js` (47KB, ~1000 lines)
- Player character creation
- Class/level/race management
- Spell slot auto-calculation by caster type
- Reuses Monster Builder rendering

#### `spell-builder.js` (33KB, ~800 lines)
- Spell creation/editing
- Component management (V/S/M)
- Ritual and concentration toggles
- School and level selection

#### `storage.js` (1.5KB)
- Thin wrapper around LocalStorage
- JSON serialization/deserialization
- Keys: `compendium` (monsters/spells), `campaigns`, `encounters`

---

## Architecture & Design Patterns

### 1. Builder Pattern

All creators (Monster, NPC, PC, Spell) follow a consistent pattern:

```javascript
// State management
window.mb = {
  draft: null,           // Current editing state
  originalName: null,    // Name being edited (null = new)
  dirty: false,          // Unsaved changes flag
  step: 'choice',        // 'choice' | 'form'
}

// Entry point
function openMonsterBuilder(name) {
  if (name) {
    // Edit existing
    mb.draft = mbFromCompendium(existingMonster)
    mb.originalName = name
    mb.step = 'form'
  } else {
    // Create new
    mb.step = 'choice'  // Show "scratch vs copy" choice
  }
  renderMonsterBuilder()
}

// Conversion functions
mbFromCompendium(m)  // Compendium → Draft
mbToCompendium(d)    // Draft → Compendium
```

### 2. Shared Component Reuse (mb.draft Pattern)

NPC Builder and PC Builder reuse Monster Builder's rendering by setting `window.mb.draft`:

```javascript
// In npc-builder.js
function openNPCBuilder(uid) {
  npcb.draft = npcbDraftFromNPC(existing)
  window.mb.draft = npcb.draft  // Share with Monster Builder renderer
  renderMonsterBuilder()         // Reuse MB rendering
}
```

This allows:
- **Code reuse**: One stat block renderer for all creature types
- **Consistency**: Same UI/UX across builders
- **Maintainability**: Fix bugs in one place

### 3. Navigation System

Two-level navigation: Tabs + Screen History

```javascript
// Tab-level navigation (home, monsters, spells, characters, encounters, notes, settings)
function showSection(section) {
  navHistory = []  // Clear history on tab switch
  currentScreen = { screen: section, uid: null }
  renderCurrentScreen()
}

// Screen-level navigation (drill-down with back button)
function pushNav(screen, uid) {
  navHistory.push({ ...currentScreen })  // Save current
  currentScreen = { screen, uid }
  renderCurrentScreen()
}

function popNav() {
  const prev = navHistory.pop()
  currentScreen = prev
  renderCurrentScreen()
}
```

**Pattern**: User can drill down (monster list → monster detail → monster builder) and use back buttons to return through history, but switching tabs resets history to avoid cross-tab confusion.

### 4. Data-Driven UI Updates

Many sections use the "refresh pattern":

```javascript
function mbRefreshSection(sectionId) {
  const container = document.getElementById(sectionId)
  if (!container) return
  container.innerHTML = mbRenderSection()  // Re-render from draft state
}
```

This allows updating specific sections without full re-render, improving performance and preserving focus state.

### 5. Drum Picker (iOS-style Scroll Picker)

Used for size, CR, AC, spell level, etc:

```javascript
mbDrumPicker(id, items, selectedValue, onChange, width, scale)
// Creates a 3-slot vertical picker with perspective transform
// Handles wheel events and click-to-scroll
// State stored in mbDrumState[id]
```

Shared across builders with consistent UX.

### 6. Attack Data Format

**Problem**: Attacks have complex damage structures (primary + additional + alternate)

**Solution**: Structured attack object:

```javascript
attack: {
  atk: "+7",              // Attack bonus
  diceCount: "1",         // Primary damage dice count
  dieType: "d8",          // Primary die size
  dmgBonus: "4",          // Primary damage bonus
  dmgType: "slashing",    // Primary damage type
  additionalDiceCount: "2", // Additional damage (e.g., "plus 2d6 fire")
  additionalDieType: "d6",
  additionalDmgType: "fire",
  altDiceCount: "1",      // Alternate damage (e.g., "or 1d10 if two-handed")
  altDieType: "d10",
  altDmgBonus: "4",
  altDmgType: "slashing",
  showAdditional: true,   // UI toggle
  showAlternate: false,   // UI toggle
}
```

**Parsing functions**:
- `parseDamageString(str)`: "1d8+4 slashing plus 2d6 fire" → structured object
- `parseAttackFromText(desc)`: Extract attack from description text (most reliable)

---

## Data Model

### Compendium Structure

```javascript
compendiumData = {
  monsters: [
    {
      name: "Goblin",
      size: "S",              // T/S/M/L/H/G
      type: "Humanoid",
      tag: "Goblinoid",       // Subtype (optional)
      alignment: "Neutral Evil",
      ac: "15 (Leather Armor)",
      hp: "7 (2d6)",
      speed: "30 ft.",
      str: "8", dex: "14", con: "10", int: "10", wis: "8", cha: "8",
      skills: [{name: "Stealth", modifier: 6}],
      savingThrows: [{ability: "DEX", modifier: 4}],
      senses: "Darkvision 60 ft.",
      passive: "9",
      languages: "Common, Goblin",
      cr: "1/4",
      traits: [{name: "Nimble Escape", desc: "...", limitedUsage: {type: 'none'}}],
      actions: [{name: "Scimitar", desc: "...", attack: {...}, limitedUsage: {...}}],
      spells: "light,mage hand",  // Spell names (comma-separated)
      spellsAtWill: "light",
      spellsDaily: "mage hand:3",  // name:count
      slots: "4,3,3,0,0,0,0,0,0",  // Spell slots by level
      _custom: true,          // User-created
      _draft: {...},          // Builder state
      homebrew: true,         // Homebrew flag
      thirdParty: false,      // Third-party content flag
    }
  ],
  spells: [
    {
      name: "Fireball",
      level: "3",
      school: "Evocation",
      ritual: false,
      concentration: false,
      time: "1 action",
      range: "150 feet",
      components: "V, S, M (bat guano)",
      verbal: true, somatic: true, material: true,
      materials: "a tiny ball of bat guano and sulfur",
      duration: "Instantaneous",
      text: "...",
      classes: "Sorcerer, Wizard",
      source: "Player's Handbook p. 241",
      _custom: false,
    }
  ],
  campaigns: {
    "My Campaign": [
      {
        uid: "pc_123",
        name: "Theron Brightblade",
        isNPC: false,
        class: "Paladin",
        subclass: "Devotion",
        level: 5,
        race: "Human",
        // ... (same structure as monsters, plus PC-specific fields)
      }
    ]
  },
  activeCampaign: "My Campaign",
  players: [...],  // Current campaign PCs (filtered)
  npcs: [...],     // Current campaign NPCs (filtered)
}
```

### Encounter Structure

```javascript
encounters = {
  "encounter_uid": {
    name: "Goblin Ambush",
    campaign: "My Campaign",
    combatants: [
      {
        uid: "combatant_uid",
        name: "Goblin 1",
        type: "monster",
        initiative: 15,
        hpMax: 7,
        hpCurrent: 4,
        ac: 15,
        conditions: ["poisoned", "prone"],
        isEnemy: true,
        isPC: false,
        // ... (full creature data copied to combatant)
        notes: [
          {text: "Hiding behind rock", timestamp: 1626384000}
        ],
        spellSlots: [
          {level: 1, total: 4, used: 2}
        ],
        // Limited-use abilities with current charges
        actions: [
          {name: "Breath Weapon", charges: 1, chargesCurrent: 0, recharge: 5}
        ]
      }
    ],
    inCombat: true,
    currentTurn: 0,  // Index in sorted combatants
    round: 2,
  }
}
```

---

## Key Utilities & Functions

### Size Expansion

```javascript
// renderer.js:5-9
function expandSize(size) {
  const map = {T:'Tiny', S:'Small', M:'Medium', L:'Large', H:'Huge', G:'Gargantuan'}
  return map[size] || size
}
window.expandSize = expandSize
```

**Usage**: Convert single-letter abbreviations to full names throughout the UI.

### Circle Toggle (Universal Checkbox)

```javascript
// renderer.js:12-26 (primary definition)
function circleToggle(id, isOn, onClickCode, labelText, boldLabel = false) {
  const circleColor = isOn ? '#4587A2' : 'transparent'
  const borderColor = isOn ? '#4587A2' : '#666'
  return `<div style="...">
    <div id="circle-${id}" onclick="...${onClickCode}">...</div>
    <span onclick="...${onClickCode}">${labelText}</span>
  </div>`
}
```

**Usage**: Standardized toggle UI for homebrew flags, ritual spells, conditions, etc.  
**Note**: Exposed as `window.circleToggle` for use in all builders.

### Damage String Parser

```javascript
// renderer.js (exposed as window.parseDamageString)
function parseDamageString(dmgStr) {
  // "1d8+4 slashing plus 2d6 fire" → structured object
  // "2d6 or 3d6 if wielded two-handed" → includes alternate damage
  return {
    diceCount, dieType, dmgBonus, dmgType,
    additionalDiceCount, additionalDieType, additionalDmgType,
    altDiceCount, altDieType, altDmgBonus, altDmgType
  }
}
```

**Handles**:
- "1d8+4 slashing" → primary damage
- "plus 2d6 fire" → additional damage
- "or 3d6 if wielded two-handed" → alternate damage

### Attack Text Parser

```javascript
// renderer.js (exposed as window.parseAttackFromText)
function parseAttackFromText(text) {
  // Extract attack bonus and damage from description text
  // "Melee Weapon Attack: +7 to hit, ... Hit: 11 (2d6+4) slashing damage."
  // Returns: {atk: "+7", diceCount: "2", dieType: "d6", dmgBonus: "4", dmgType: "slashing"}
}
```

**Most reliable source** for attack data - always prefers text-parsed values over structured data.

### Markdown Renderer

```javascript
// renderer.js:2221-2278
function renderMarkdown(text) {
  // Converts markdown to HTML for notes/descriptions
  // Supports: **bold**, *italic*, # headers, - lists, > blockquotes
}
```

**Usage**: Render creature descriptions and session notes with formatting.

### Speed Parser

```javascript
// renderer.js (exposed as window.mbParseSpeed)
function mbParseSpeed(str) {
  // "30 ft., fly 60 ft., swim 30 ft." → [{type:'Walk',ft:30}, {type:'Fly',ft:60}, {type:'Swim',ft:30}]
}
```

### Proficiency Bonus Calculator

```javascript
// monster-builder.js:183-193
function mbProficiencyFromCR(cr) {
  const crNum = cr === '1/8' ? 0.125 : cr === '1/4' ? 0.25 : cr === '1/2' ? 0.5 : parseFloat(cr)
  if (crNum <= 4) return 2
  if (crNum <= 8) return 3
  // ... (follows 5e proficiency table)
}
```

**Auto-calculated** when CR changes in Monster Builder.

---

## Development Environment

### Node Version Requirement

**CRITICAL**: This project requires **Node.js v20.x**

```bash
# Check version
node --version  # Must be v20.x

# If using nvm (recommended)
nvm use 20
nvm alias default 20
```

**Why Node v20?**
- Electron 34 bundles Node v20
- Native module compatibility (if any are added)
- Consistent runtime environment across dev and production

### Package Manager

**npm** (comes with Node)

```bash
npm install          # Install dependencies
npm start            # Run in development
npm run build        # Build distributables (planned)
```

### Two-Tab Development Workflow

**Tab 1**: Application running
```bash
npm start
# Leave running, auto-reloads on JS changes
```

**Tab 2**: Command execution
```bash
# Run commands here (git, file operations, etc.)
# Don't interrupt running app
```

### Hot Reload

Electron automatically reloads when JavaScript files change. No build step needed during development.

---

## Current State

### What's Working ✅

#### Core Features
- ✅ Full campaign management (create, switch, delete)
- ✅ Monster builder (create from scratch, copy existing, full stat blocks)
- ✅ NPC builder (proper name/title distinction, reuses monster rendering)
- ✅ PC builder (class/level/race, spell slots auto-calc)
- ✅ Spell builder (component management, ritual/concentration)
- ✅ Encounter builder (initiative, HP tracking, conditions, spell slots)
- ✅ Notes system (per campaign, markdown support)
- ✅ XML import (Game Master 5e (no affiliation) format)
- ✅ XML export (creatures and campaigns)

#### Data Management
- ✅ LocalStorage persistence
- ✅ Data migrations (spell format, monster types, PC format, encounter refresh)
- ✅ Homebrew and third-party content flags
- ✅ Search/filter for monsters and spells

#### UI/UX
- ✅ Responsive layout (sidebar + content)
- ✅ Drag-and-drop ability reordering
- ✅ Attack/damage roll integration
- ✅ HP bars with visual feedback
- ✅ Condition toggles
- ✅ Limited-use ability tracking (charges, recharges, daily)
- ✅ Background texture and custom fonts
- ✅ Consistent button/input styling

---

## Known Invariants & Constraints

### Hard Requirements

1. **Node v20**: Electron 34 requires it, don't downgrade
2. **nvm**: Use nvm to manage Node versions if working on multiple projects
3. **LocalStorage size limits**: ~10MB typical, ~50MB possible (monitor if data grows)
4. **Electron userData**: Data stored in OS-specific location:
   - macOS: `~/Library/Application Support/dms-companion/`
   - Windows: `%APPDATA%\dms-companion\`
   - Linux: `~/.config/dms-companion/`

### Design Invariants

1. **No frameworks**: Vanilla JS only, no React/Vue/Angular
2. **Single window**: Multi-window would complicate state management
3. **Shared mb.draft**: NPC/PC builders reuse Monster Builder rendering via this pattern
4. **Two-tab workflow**: Development always uses two terminal tabs (app + commands)
5. **window.* exports**: Shared utilities must be exposed on window object for cross-file access

### UI Patterns

1. **Circle toggles**: All boolean inputs use `circleToggle()` for consistency
2. **Drum pickers**: Size/CR/level use iOS-style drum pickers, not dropdowns
3. **Back buttons**: Style `${MBS.btnSecondary}padding:6px 14px;`
4. **Color palette**:
   - Primary: `#4587A2` (teal)
   - Background: `#262F35` (dark blue-gray)
   - Text: `#e0d5c5` (cream)
   - Border: `#2E2F2D` (dark gray)
   - Error: `#E85D75` (red)

### Data Invariants

1. **Size codes**: T/S/M/L/H/G (single letter, expanded for display)
2. **Attack format**: Always structured object, never just strings
3. **Spell slots**: Always 9-element array `[0,0,0,0,0,0,0,0,0]` for levels 1-9
4. **UIDs**: Auto-generated, format: `{type}_{timestamp}_{random}`
5. **_custom flag**: All user-created content has `_custom: true`

---

**End of Project README**
