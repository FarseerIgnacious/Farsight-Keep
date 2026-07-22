const { saveCompendium, loadCompendium, saveCampaigns, loadCampaigns, saveEncounters, loadEncounters, saveHasSeenWelcome, loadHasSeenWelcome } = require('./storage.js')
const { shell } = require('electron')

function openBuyMeACoffee() {
  shell.openExternal('https://buymeacoffee.com/farseerignacious')
}
window.openBuyMeACoffee = openBuyMeACoffee

// ── Size Expansion Utility ────────────────────────────────────────
// Converts single-letter size abbreviations to full names
function expandSize(size) {
  const map = {T:'Tiny', S:'Small', M:'Medium', L:'Large', H:'Huge', G:'Gargantuan'}
  return map[size] || size
}
window.expandSize = expandSize

// ── Universal Circle Toggle (FIX 2 & 6) ───────────────────────────
function circleToggle(id, isOn, onClickCode, labelText, boldLabel = false) {
  const circleColor = isOn ? '#4587A2' : 'transparent'
  const borderColor = isOn ? '#4587A2' : '#666'
  const labelStyle = boldLabel
    ? 'color:#4587A2;font-size:13px;font-weight:bold;letter-spacing:0.05em;'
    : 'color:#e0d5c5;font-size:14px;'

  return `<div style="display:flex;align-items:center;gap:10px;">
    <div id="circle-${id}" style="width:20px;height:20px;border-radius:50%;border:2px solid ${borderColor};
                background:${circleColor};flex-shrink:0;transition:all 0.2s;cursor:pointer;"
      onclick="const circle = document.getElementById('circle-${id}'); const newState = circle.style.background === 'transparent'; circle.style.background = newState ? '#4587A2' : 'transparent'; circle.style.borderColor = newState ? '#4587A2' : 'rgb(102, 102, 102)'; ${onClickCode}"></div>
    <span style="${labelStyle}cursor:pointer;"
      onclick="const circle = document.getElementById('circle-${id}'); const newState = circle.style.background === 'transparent'; circle.style.background = newState ? '#4587A2' : 'transparent'; circle.style.borderColor = newState ? '#4587A2' : 'rgb(102, 102, 102)'; ${onClickCode}">${labelText}</span>
  </div>`
}

// ── Three-State Filter Toggle Button ──────────────────────────────
// Creates a button that cycles: Grey (all) → Blue (only) → Red (exclude) → Grey
// filterKey: 'homebrew', 'thirdParty', 'spellcaster'
// label: button text

// Define state values for each filter type
const threeStateMap = {
  homebrew: { grey: '', blue: 'homebrew', red: 'non-homebrew' },
  thirdParty: { grey: '', blue: 'third-party', red: 'non-third-party' },
  spellcaster: { grey: '', blue: 'spellcaster', red: 'non-spellcaster' },
  ritual: { grey: '', blue: 'ritual', red: 'non-ritual' },
  concentration: { grey: '', blue: 'concentration', red: 'non-concentration' }
}

// State styles for three-state buttons
const threeStateStyles = {
  grey: { background: '#5C5C5C', color: '#1E231A', border: '1px solid #2E2F2D' },
  blue: { background: '#4587A2', color: '#e0d5c5', border: '1px solid #4587A2' },
  red: { background: '#5C1A1A', color: '#E85D75', border: '1px solid #E85D75' }
}

// Toggle function - cycles through grey → blue → red → grey
function toggleMonsterFilter(filterKey) {
  const current = monsterFilters[filterKey] || ''
  const map = threeStateMap[filterKey]
  let nextState = 'blue'
  if (current === map.grey) nextState = 'blue'
  else if (current === map.blue) nextState = 'red'
  else if (current === map.red) nextState = 'grey'

  monsterFilters[filterKey] = map[nextState]
  applyMonsterFilters()

  // Update button visual state directly
  const btn = document.getElementById(`filter-btn-${filterKey}`)
  if (btn) {
    const style = threeStateStyles[nextState]
    btn.style.background = style.background
    btn.style.color = style.color
    btn.style.border = style.border
  }
}
// Expose to window for onclick handlers
window.toggleMonsterFilter = toggleMonsterFilter

// Toggle function for spell filters - same pattern as monster filters
function toggleSpellFilter(filterKey) {
  const current = spellFilters[filterKey] || ''
  const map = threeStateMap[filterKey]
  let nextState = 'blue'
  if (current === map.grey) nextState = 'blue'
  else if (current === map.blue) nextState = 'red'
  else if (current === map.red) nextState = 'grey'

  spellFilters[filterKey] = map[nextState]
  applySpellFilters()

  // Update button visual state directly
  const btn = document.getElementById(`filter-btn-${filterKey}`)
  if (btn) {
    const style = threeStateStyles[nextState]
    btn.style.background = style.background
    btn.style.color = style.color
    btn.style.border = style.border
  }
}
// Expose to window for onclick handlers
window.toggleSpellFilter = toggleSpellFilter

function threeStateToggle(filterKey, label, filterSource = 'monster') {
  const currentValue = filterSource === 'monster'
    ? (monsterFilters[filterKey] || '')
    : (spellFilters[filterKey] || '')

  // Determine current state based on filter value
  let state = 'grey' // default/all
  if (currentValue === filterKey || currentValue === 'third-party' || currentValue === 'spellcaster' || currentValue === 'ritual' || currentValue === 'concentration') {
    state = 'blue' // only
  } else if (currentValue.startsWith('non-')) {
    state = 'red' // exclude
  }

  // Get style for current state
  const style = threeStateStyles[state]
  const styleString = `background:${style.background};color:${style.color};border:${style.border}`

  const toggleFn = filterSource === 'monster' ? 'toggleMonsterFilter' : 'toggleSpellFilter'

  return `<button id="filter-btn-${filterKey}" onclick="${toggleFn}('${filterKey}')"
    style="${styleString};padding:6px 12px;border-radius:4px;font-family:var(--app-font);
           font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;transition:all 0.15s;">
    ${label}
  </button>`
}

// ── State ─────────────────────────────────────────────────────────
let compendiumData = {
  monsters: [],
  spells: [],
  players: [],
  npcs: [],
  campaigns: {},
  activeCampaign: null
}

let enc = {
  list: {},        // { campaignName: Encounter[] }
  current: null,   // Encounter being built/run
  inCombat: false,
  turn: 0,
  round: 1,
  addOpen: false,
  notesOpen: false,
  monsterQ: '',
  filteredMonsters: [],
}

const SKILL_NAMES = {
  0: 'Athletics', 1: 'Acrobatics', 2: 'Sleight of Hand', 3: 'Stealth',
  4: 'Arcana', 5: 'History', 6: 'Investigation', 7: 'Nature', 8: 'Religion',
  9: 'Animal Handling', 10: 'Insight', 11: 'Medicine', 12: 'Perception',
  13: 'Survival', 14: 'Deception', 15: 'Intimidation', 16: 'Performance', 17: 'Persuasion'
}

// ── Shared Confirmation Modal ────────────────────────────────────────
function confirmDelete(message, onConfirm) {
  // Remove any existing confirmation modal
  const existing = document.getElementById('confirm-delete-modal')
  if (existing) existing.remove()

  // Create modal
  const modal = document.createElement('div')
  modal.id = 'confirm-delete-modal'
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `

  modal.innerHTML = `
    <div id="confirm-delete-dialog" style="
      background: #262F35;
      border: 2px solid #4a9a9a;
      border-radius: 8px;
      padding: 24px;
      min-width: 300px;
      max-width: 400px;
      text-align: center;
      font-family: var(--app-font);
    ">
      <div style="font-size: 16px; color: #e0d5c5; margin-bottom: 20px;">
        ${message}
      </div>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="confirm-delete-yes" style="
          background: #8b0000;
          color: #e0d5c5;
          border: none;
          padding: 8px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--app-font);
          font-size: 14px;
          font-weight: 600;
        ">Yes</button>
        <button id="confirm-delete-cancel" style="
          background: #3E3E3D;
          color: #e0d5c5;
          border: 2px solid #2E2F2D;
          padding: 8px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--app-font);
          font-size: 14px;
          font-weight: 600;
        ">Cancel</button>
      </div>
    </div>
  `

  function closeModal() {
    modal.remove()
  }

  function handleYes() {
    closeModal()
    onConfirm()
  }

  // Event listeners
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  // Escape key closes modal
  function handleEscape(e) {
    if (e.key === 'Escape') {
      closeModal()
      document.removeEventListener('keydown', handleEscape)
    }
  }
  document.addEventListener('keydown', handleEscape)

  // Add to DOM
  document.body.appendChild(modal)

  // Attach button event listeners AFTER modal is in DOM
  document.getElementById('confirm-delete-yes').addEventListener('click', handleYes)
  document.getElementById('confirm-delete-cancel').addEventListener('click', closeModal)
}
window.confirmDelete = confirmDelete

// Render Discord-style markdown formatting
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*\*\*(.+?)\*\*\*\*/g, '<u>$1</u>')           // ****underline****
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>') // ***bold+italic***
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')           // **bold**
    .replace(/\*(.+?)\*/g, '<em>$1</em>')                       // *italic*
}
window.renderMarkdown = renderMarkdown

// 5e 2024 XP Budget per character (level -> {low, moderate, high})
const XP_BUDGET_2024 = {
  1: {low: 25, moderate: 50, high: 75},
  2: {low: 50, moderate: 100, high: 150},
  3: {low: 75, moderate: 150, high: 225},
  4: {low: 125, moderate: 250, high: 375},
  5: {low: 250, moderate: 500, high: 750},
  6: {low: 300, moderate: 600, high: 900},
  7: {low: 350, moderate: 750, high: 1100},
  8: {low: 450, moderate: 900, high: 1400},
  9: {low: 550, moderate: 1100, high: 1600},
  10: {low: 600, moderate: 1200, high: 1900},
  11: {low: 800, moderate: 1600, high: 2400},
  12: {low: 1000, moderate: 2000, high: 3000},
  13: {low: 1100, moderate: 2200, high: 3400},
  14: {low: 1250, moderate: 2500, high: 3800},
  15: {low: 1400, moderate: 2800, high: 4300},
  16: {low: 1600, moderate: 3200, high: 4800},
  17: {low: 2000, moderate: 3900, high: 5900},
  18: {low: 2100, moderate: 4200, high: 6300},
  19: {low: 2400, moderate: 4900, high: 7300},
  20: {low: 2800, moderate: 5700, high: 8500}
}

const ABILITY_NAMES = {
  0: 'STR', 1: 'DEX', 2: 'CON', 3: 'INT', 4: 'WIS', 5: 'CHA'
}

const CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled',
  'Incapacitated','Invisible','Paralyzed','Petrified','Poisoned',
  'Prone','Restrained','Stunned','Unconscious'
]

// ── Navigation History ────────────────────────────────────────────
let navHistory = []
let currentScreen = { screen: 'home', uid: null }

function pushNav(screen, uid = null) {
  // Push CURRENT state before navigating to new screen
  navHistory.push({ ...currentScreen })

  // Update current screen to the new screen
  currentScreen = { screen, uid }
}

function popNav() {
  if (navHistory.length === 0) {
    showSection('home', true)
    return
  }

  const prevState = navHistory.pop()

  // Restore the previous screen without pushing to history again
  switch (prevState.screen) {
    case 'home':
      showSection('home', true)
      break
    case 'monsters':
      showSection('monsters', true)
      break
    case 'spells':
      showSection('spells', true)
      break
    case 'characters':
      showSection('characters', true)
      break
    case 'encounter':
      showSection('encounter', true)
      break
    case 'notes':
      showSection('notes', true)
      break
    case 'campaign':
      showSection('campaign', true)
      break
    case 'monster-detail':
      if (prevState.uid) showMonster(prevState.uid, true)
      else showSection('monsters', true)
      break
    case 'npc-detail':
      if (prevState.uid) showNPC(prevState.uid, true)
      else showSection('home', true)
      break
    case 'pc-detail':
      if (prevState.uid) showPC(prevState.uid, true)
      else showSection('home', true)
      break
    case 'spell-detail':
      if (prevState.uid) showSpell(prevState.uid, true)
      else showSection('spells', true)
      break
    case 'player-detail':
      if (prevState.uid) showPlayer(prevState.uid, true)
      else showSection('characters', true)
      break
    case 'adventure-detail':
      if (prevState.uid) openAdventure(prevState.uid, true)
      else showSection('home', true)
      break
    default:
      showSection('home', true)
  }
}

// Export navigation functions to window for onclick handlers
window.pushNav = pushNav
window.popNav = popNav
window.createAdventure = createAdventure
window.submitCreateAdventure = submitCreateAdventure
window.openAdventure = openAdventure
window.updateAdventureStatus = updateAdventureStatus
window.updateAdventureDescription = updateAdventureDescription
window.toggleAdventureNPC = toggleAdventureNPC
window.removeAdventureEncounter = removeAdventureEncounter
window.showAddEncounterToAdventure = showAddEncounterToAdventure
window.addEncounterToAdventure = addEncounterToAdventure
window.runEncounter = runEncounter
window.showMonsterChoice = showMonsterChoice
window.showMonsterChoiceByIndex = showMonsterChoiceByIndex
window.addMonsterAsIsByIndex = addMonsterAsIsByIndex
window.modifyMonsterByIndex = modifyMonsterByIndex
window.addMonsterAsIs = addMonsterAsIs
window.modifyMonster = modifyMonster
window.filterEncMonsters = filterEncMonsters
window.startCombat = startCombat
window.nextTurn = nextTurn
window.endCombat = endCombat
window.addFromPC = addFromPC
window.addFromNPC = addFromNPC
window.openSettings = openSettings
window.setAppFont = setAppFont
window.toggleDieLabels = toggleDieLabels
window.exportCompendium = exportCompendium
window.exportActiveCampaign = exportActiveCampaign
window.exportFullBackup = exportFullBackup
window.restoreFromBackup = restoreFromBackup
window.showNewCampaignForm = showNewCampaignForm
window.createNewCampaign = createNewCampaign
window.cancelNewCampaign = cancelNewCampaign
window.showRenameCampaignForm = showRenameCampaignForm
window.confirmRenameCampaign = confirmRenameCampaign
window.cancelRenameCampaign = cancelRenameCampaign
window.switchCampaign = switchCampaign
window.applyMonsterFilters = applyMonsterFilters
window.clearMonsterFilters = clearMonsterFilters
window.applySpellFilters = applySpellFilters
window.clearSpellFilters = clearSpellFilters
window.parseDamageString = parseDamageString
window.parseAttackFromText = parseAttackFromText

// Export currentScreen as getter/setter so it stays in sync
Object.defineProperty(window, 'currentScreen', {
  get: () => currentScreen,
  set: (val) => { currentScreen = val }
})

// ── XML Helpers ───────────────────────────────────────────────────
function getText(node, tag) {
  const el = node.querySelector(tag)
  return el ? el.textContent.trim() : ''
}

// Parse damage string into structured fields
// Moved from monster-builder.js to ensure availability during XML import
function parseDamageString(dmgStr) {
  if (!dmgStr || typeof dmgStr !== 'string') {
    return { diceCount: '', dieType: 'd6', dmgBonus: '', dmgType: '', additionalDiceCount: '', additionalDieType: '', additionalDmgType: '' }
  }

  dmgStr = dmgStr.trim()

  // Match: XdY + optional numeric bonus + optional additional dice + optional damage type text
  // Examples: "2d10+8 slashing", "1d6", "2d6+3 piercing", "2d10+8+2d8 fire", "1d6 + 2" (with spaces)
  const diceMatch = dmgStr.match(/^(\d+)d(\d+)\s*([\+\-]\s*\d+)?\s*([\+\-]\s*(\d+)d(\d+))?\s*(.*)/)

  if (diceMatch) {
    const diceCount = diceMatch[1]
    const dieType = 'd' + diceMatch[2]
    const numericBonus = diceMatch[3] ? diceMatch[3].replace(/\s+/g, '') : '' // Remove spaces from "+2" or "+ 2"
    const additionalDiceFull = diceMatch[4] || '' // e.g., "+2d8" or "+ 2d8"
    const additionalDiceCount = diceMatch[5] || '' // e.g., "2"
    const additionalDieSize = diceMatch[6] || '' // e.g., "8"
    const remainingText = diceMatch[7] ? diceMatch[7].trim() : ''

    // Extract damage type from remaining text - only word characters, skip any leading numbers/operators
    // Pattern: "1d4 + 2 Slashing" → remainingText="Slashing" → dmgType="Slashing"
    // Pattern: "2d6+3 piercing damage" → remainingText="piercing damage" → dmgType="piercing"
    let damageTypeText = ''
    const typeMatch = remainingText.match(/\b([a-zA-Z][a-zA-Z]*)\b/)
    if (typeMatch) {
      damageTypeText = typeMatch[1].toLowerCase()
    }

    // Build result
    const result = {
      diceCount,
      dieType,
      dmgBonus: numericBonus,
      dmgType: damageTypeText,
      additionalDiceCount: '',
      additionalDieType: '',
      additionalDmgType: ''
    }

    // If additional dice exists, parse it
    if (additionalDiceCount && additionalDieSize) {
      result.additionalDiceCount = additionalDiceCount
      result.additionalDieType = 'd' + additionalDieSize
      result.additionalDmgType = damageTypeText // Same damage type applies to both
    }

    return result
  }

  // Check for flat damage (just a number + optional damage type)
  const flatMatch = dmgStr.match(/^(\d+)\s*(.*)/)
  if (flatMatch) {
    return {
      diceCount: '',
      dieType: 'd6',
      dmgBonus: flatMatch[1],
      dmgType: flatMatch[2].trim(),
      additionalDiceCount: '',
      additionalDieType: '',
      additionalDmgType: ''
    }
  }

  // Fallback
  return {
    diceCount: '',
    dieType: 'd6',
    dmgBonus: '',
    dmgType: dmgStr,
    additionalDiceCount: '',
    additionalDieType: '',
    additionalDmgType: ''
  }
}

function parseAttackFromText(text) {
  if (!text || typeof text !== 'string') return null

  const result = {
    atk: null,
    diceCount: null,
    dieType: null,
    dmgBonus: null,
    dmgType: null,
    altDiceCount: null,
    altDieType: null,
    altDmgBonus: null,
    altDmgType: null
  }

  // Pattern 1: Attack bonus - "+4 to hit" or "-2 to hit"
  const atkMatch = text.match(/([\+\-]\d+)\s+to\s+hit/i)
  if (atkMatch) {
    result.atk = atkMatch[1]
  }

  // Pattern 2: Damage dice in parentheses - "Hit: 5 (1d6 + 2) slashing damage"
  const dmgMatch = text.match(/\((\d+d\d+(?:\s*[\+\-]\s*\d+)?)\)/)
  if (dmgMatch) {
    const diceExpr = dmgMatch[1]
    const parsed = parseDamageString(diceExpr)
    result.diceCount = parsed.diceCount
    result.dieType = parsed.dieType
    result.dmgBonus = parsed.dmgBonus
    result.dmgType = parsed.dmgType
  }

  // Pattern 3: Damage type - extract from "X damage" after the dice
  if (!result.dmgType && dmgMatch) {
    const afterDice = text.substring(text.indexOf(dmgMatch[0]) + dmgMatch[0].length)
    const typeMatch = afterDice.match(/^\s*(\w+)\s+damage/i)
    if (typeMatch) {
      result.dmgType = typeMatch[1].toLowerCase()
    }
  }

  // Pattern 4: Alternate damage - ", or X (YdZ + W) Type damage if [condition]"
  // Example: ", or 9 (3d4 + 2) Slashing damage if the aarakocra moved"
  const altMatch = text.match(/,\s*or\s+\d+\s*\((\d+d\d+(?:\s*[\+\-]\s*\d+)?)\)\s*(\w+)?\s*damage/i)
  if (altMatch) {
    const altDiceExpr = altMatch[1]
    const altParsed = parseDamageString(altDiceExpr)
    result.altDiceCount = altParsed.diceCount
    result.altDieType = altParsed.dieType
    result.altDmgBonus = altParsed.dmgBonus
    // Use damage type from regex capture if present, otherwise use same as primary
    result.altDmgType = altMatch[2] ? altMatch[2].toLowerCase() : result.dmgType
  }

  // Return null if we didn't find any attack data
  if (!result.atk && !result.diceCount) {
    return null
  }

  return result
}

function getBlocks(node, tag) {
  return Array.from(node.querySelectorAll(tag)).map(el => {
    const nameEl = el.querySelector('name')
    const texts = Array.from(el.querySelectorAll('text')).map(t => t.textContent.trim()).join('\n')

    const block = {
      name: nameEl ? nameEl.textContent.trim() : (el.getAttribute('name') || ''),
      text: texts || el.textContent.trim(),
      charges: el.querySelector('charges') ? parseInt(el.querySelector('charges').textContent) : null,
      chargesCurrent: el.querySelector('chargesCurrent') ? parseInt(el.querySelector('chargesCurrent').textContent) : null,
      recharge: el.querySelector('recharge') ? parseInt(el.querySelector('recharge').textContent) : null,
    }

    // Parse attack data from XML <attack> element (format: Name|Bonus|Damage)
    const attackEl = el.querySelector('attack')
    if (attackEl) {
      const parts = attackEl.textContent.trim().split('|')
      const atkBonus = parts[1] ? parts[1].trim() : '0'
      const dmgString = parts[2] ? parts[2].trim() : ''

      // Parse damage string using parseDamageString (defined above in renderer.js)
      if (dmgString) {
        const parsed = parseDamageString(dmgString)

        block.attack = {
          atk: atkBonus,
          diceCount: parsed.diceCount,
          dieType: parsed.dieType,
          dmgBonus: parsed.dmgBonus,
          dmgType: parsed.dmgType || '',
          additionalDiceCount: parsed.additionalDiceCount || '',
          additionalDieType: parsed.additionalDieType || '',
          additionalDmgType: parsed.additionalDmgType || '',
          dmg: dmgString  // keep raw string for backward compat
        }

        // If dmgType is empty, try to extract from action text
        // Pattern: "Hit: 17 (2d10+6) piercing damage" or "Hit: 17 (2d10+6) piercing damage plus 4 (1d8) acid damage"
        if (!block.attack.dmgType && block.text) {
          const damagePattern = /Hit:.*?\(.*?\)\s*(\w+)\s*damage(?:.*?plus.*?\(.*?\)\s*(\w+)\s*damage)?/i
          const match = block.text.match(damagePattern)
          if (match) {
            block.attack.dmgType = match[1] || ''  // Primary damage type
            if (match[2] && block.attack.additionalDiceCount) {
              block.attack.additionalDmgType = match[2]  // Additional damage type
            }
          }
        }

        // Check for alternate damage pattern: ", or X (YdZ + W) Type damage if [condition]"
        if (block.text) {
          const altMatch = block.text.match(/,\s*or\s+\d+\s*\((\d+d\d+(?:\s*[\+\-]\s*\d+)?)\)\s*(\w+)?\s*damage/i)
          if (altMatch) {
            const altDiceExpr = altMatch[1]
            const altParsed = parseDamageString(altDiceExpr)
            block.attack.altDiceCount = altParsed.diceCount
            block.attack.altDieType = altParsed.dieType
            block.attack.altDmgBonus = altParsed.dmgBonus
            // Use damage type from regex capture if present, otherwise use same as primary
            block.attack.altDmgType = altMatch[2] ? altMatch[2].toLowerCase() : block.attack.dmgType
            block.attack.showAlternate = true

            // FIX: Prevent double-counting - if additional damage matches alternate damage, clear additional
            // This happens when parseDamageString() extracts "or 3d4" as additional dice
            if (block.attack.altDiceCount === block.attack.additionalDiceCount &&
                block.attack.altDieType === block.attack.additionalDieType) {
              block.attack.additionalDiceCount = ''
              block.attack.additionalDieType = ''
              block.attack.additionalDmgType = ''
              block.attack.showAdditional = false
            }
          }
        }
      } else {
        // Attack with no damage (e.g., save-based abilities)
        block.attack = {
          atk: atkBonus,
          dmg: ''
        }
      }
    }

    return block
  })
}

// ── Math Helpers ──────────────────────────────────────────────────
function parseUsesFromName(name) {
  const day = (name || '').match(/\((\d+)\/day(?:\s+each)?\)/i)
  if (day) return { charges: parseInt(day[1]), recharge: null }
  const rch = (name || '').match(/\(recharge\s+(\d+)(?:-\d+)?\)/i)
  if (rch) return { charges: null, recharge: parseInt(rch[1]) }
  return { charges: null, recharge: null }
}

function abilityMod(score) {
  const num = parseInt(score)
  return isNaN(num) ? 0 : Math.floor((num - 10) / 2)
}

function modStr(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

// ── HTML Helpers ──────────────────────────────────────────────────
function statRow(label, value) {
  if (!value) return ''
  return `<p style="margin-bottom:6px;"><strong style="color:#c9a87c;">${label}:</strong> ${value}</p>`
}

function abilityBox(label, score) {
  const mod = abilityMod(score)
  return `
    <div style="background:#1A1C1E;padding:8px 4px;border-radius:4px;text-align:center;">
      <div style="font-size:11px;color:#4a9a9a;letter-spacing:.06em;font-weight:700;margin-bottom:4px;">${label}</div>
      <div style="font-size:18px;font-weight:bold;">${score || '—'}</div>
      <div style="font-size:12px;color:#888;">${modStr(mod)}</div>
    </div>
  `
}

// ── Compendium Parser ─────────────────────────────────────────────
function parseMonsterNode(m) {
  // Parse type and extract subtype/tag
  const rawType = getText(m, 'type')
  let baseType = rawType
  let subtypeTag = ''

  // Check if type has subtype - handle both "(subtype)" and "(subtype" (missing closing paren)
  if (rawType.includes('(')) {
    const parts = rawType.split('(')
    baseType = parts[0].trim()
    // Everything after "(" - strip any trailing ")" if present
    subtypeTag = parts[1] ? parts[1].replace(/\)\s*$/, '').trim() : ''
  }

  // Title-case the base type unless it's garbage data (single char, special codes)
  function titleCase(str) {
    // Don't title-case if it's a single character, "$", or other garbage
    if (!str || str.length <= 1 || str === '$' || /^[A-Z]{1,3}$/.test(str)) {
      return str
    }
    // Don't title-case special keywords
    if (str.toLowerCase() === 'varies') {
      return str.toLowerCase()
    }

    // Words to keep lowercase (unless first word)
    const lowercase = ['of', 'the', 'a', 'an', 'in', 'from', 'with', 'and', 'or', 'but', 'for', 'to', 'at', 'by', 'on']

    // Title-case: first letter of each word uppercase, except articles/prepositions
    return str.split(' ').map((word, index) => {
      if (!word) return word
      const lower = word.toLowerCase()
      // First word is always capitalized
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      // Keep articles/prepositions lowercase
      if (lowercase.includes(lower)) {
        return lower
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }).join(' ')
  }

  const normalizedType = titleCase(baseType)
  // Only set tag if subtypeTag is non-empty
  const normalizedTag = subtypeTag ? titleCase(subtypeTag) : undefined

  return {
    name: getText(m, 'name'),
    size: getText(m, 'size'),
    type: normalizedType,
    tag: normalizedTag,  // Will be undefined if no subtype
    alignment: getText(m, 'alignment'),
    ac: getText(m, 'ac'),
    hp: getText(m, 'hp'),
    speed: getText(m, 'speed'),
    str: getText(m, 'str'),
    dex: getText(m, 'dex'),
    con: getText(m, 'con'),
    int: getText(m, 'int'),
    wis: getText(m, 'wis'),
    cha: getText(m, 'cha'),
    save: Array.from(m.querySelectorAll('save')).map(el => el.textContent.trim()).filter(Boolean).join(', '),
    skill: Array.from(m.querySelectorAll('skill')).map(el => el.textContent.trim()).filter(Boolean).join(', '),
    immune: getText(m, 'immune'),
    resist: getText(m, 'resist'),
    vulnerable: getText(m, 'vulnerable'),
    conditionImmune: getText(m, 'conditionImmune'),
    senses: getText(m, 'senses'),
    passive: getText(m, 'passive'),
    languages: getText(m, 'languages'),
    cr: getText(m, 'cr'),
    traits: getBlocks(m, 'trait'),
    actions: getBlocks(m, 'action'),
    bonusActions: getBlocks(m, 'bonus'),
    reactions: getBlocks(m, 'reaction'),
    legendaryActions: getBlocks(m, 'legendary'),
    lairActions: getBlocks(m, 'lair'),
    spells: getText(m, 'spells'),
    slots: getText(m, 'slots'),
  }
}

function parseSpellNode(s) {
  const ritualText = getText(s, 'ritual')
  const schoolNum = getText(s, 'school')
  const spellName = getText(s, 'name')

  // Map school numbers AND letter codes to full names
  const schoolNames = {
    '0': 'None',
    '1': 'Abjuration', 'A': 'Abjuration',
    '2': 'Conjuration', 'C': 'Conjuration',
    '3': 'Divination', 'D': 'Divination',
    '4': 'Enchantment', 'EN': 'Enchantment',
    '5': 'Evocation', 'EV': 'Evocation',
    '6': 'Illusion', 'I': 'Illusion',
    '7': 'Necromancy', 'N': 'Necromancy',
    '8': 'Transmutation', 'T': 'Transmutation'
  }

  // Handle TWO different XML formats for components:
  // FORMAT A (Fight Club 5e): <v>1</v>, <s>1</s>, <m>1</m>, <materials>text</materials>
  // FORMAT B (Game Master 5e/other): <components>V, S, M (text)</components>

  let verbal, somatic, material, materials, components

  const vTag = getText(s, 'v')
  if (vTag) {
    // FORMAT A: Separate component tags
    verbal = vTag === '1'
    somatic = getText(s, 's') === '1'
    material = getText(s, 'm') === '1'
    materials = getText(s, 'materials')

    // Build formatted components string
    const compParts = []
    if (verbal) compParts.push('V')
    if (somatic) compParts.push('S')
    if (material) {
      if (materials) {
        compParts.push(`M (${materials})`)
      } else {
        compParts.push('M')
      }
    }
    components = compParts.join(', ')
  } else {
    // FORMAT B: Single components string
    components = getText(s, 'components') || ''
    verbal = components.includes('V')
    somatic = components.includes('S')
    material = components.includes('M')

    // Extract materials text from parentheses
    materials = ''
    if (material) {
      const match = components.match(/M \(([^)]+)\)/)
      if (match) {
        materials = match[1]
      }
    }
  }

  // Handle TWO different XML formats for classes:
  // FORMAT A (Fight Club 5e): <sclass>Sorcerer</sclass>, <sclass>Wizard</sclass>
  // FORMAT B (Game Master 5e/other): <classes>Sorcerer, Wizard</classes>

  let classes
  const sclassTags = Array.from(s.querySelectorAll('sclass'))
  if (sclassTags.length > 0) {
    // FORMAT A: Multiple sclass tags
    classes = sclassTags.map(el => el.textContent.trim()).join(', ')
  } else {
    // FORMAT B: Single classes string
    classes = getText(s, 'classes') || ''
  }

  // Normalize level: cantrips may have empty/missing <level> tag, store as '0'
  const rawLevel = getText(s, 'level')
  const level = (!rawLevel || rawLevel === '') ? '0' : rawLevel

  // Parse concentration from duration field
  const duration = getText(s, 'duration')
  const concentration = duration?.toLowerCase().includes('concentration') || false

  return {
    name: spellName,
    level: level,
    school: schoolNames[schoolNum] || schoolNum,
    ritual: ritualText === '1' || ritualText.toUpperCase() === 'YES',
    time: getText(s, 'time'),
    range: getText(s, 'range'),
    components: components,
    verbal: verbal,
    somatic: somatic,
    material: material,
    materials: materials,
    duration: duration,
    concentration: concentration,
    classes: classes,
    text: Array.from(s.querySelectorAll('text')).map(t => t.textContent.trim()).join('\n'),
    roll: getText(s, 'roll'),
  }
}

function parseCompendium(xml) {
  // Preserve existing custom entries
  const existingCustomMonsters = compendiumData.monsters.filter(m => m._custom)
  const existingCustomSpells = compendiumData.spells.filter(s => s._custom)

  // Parse XML entries (these will NOT have _custom flag)
  const xmlMonsters = Array.from(xml.querySelectorAll('monster'))
    .map(m => parseMonsterNode(m))

  const xmlSpells = Array.from(xml.querySelectorAll('spell'))
    .map(s => parseSpellNode(s))

  // Merge: XML entries + custom entries
  compendiumData.monsters = [...xmlMonsters, ...existingCustomMonsters]
    .sort((a, b) => a.name.localeCompare(b.name))

  compendiumData.spells = [...xmlSpells, ...existingCustomSpells]
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ── Campaign Parser ───────────────────────────────────────────────
function parseCampaign(xml) {
  const campaignNode = xml.querySelector('campaign')
  const campaignName = campaignNode ? getText(campaignNode, 'name') : 'Campaign'

  function parseCharNode(node, isNPC) {
    const abilitiesRaw = getText(node, 'abilities')
    const abilities = abilitiesRaw
      ? abilitiesRaw.split(',').map(a => a.trim())
      : ['10', '10', '10', '10', '10', '10']
    const label = getText(node, 'label')
    const name  = getText(node, 'name')
    const enemy = getText(node, 'enemy')
    const cr = getText(node, 'cr')

    // For PCs: <cr> tag contains level, <name> contains class info like "Shifter Paladin (Conquest)"
    // For NPCs: <cr> is actual CR
    const level = !isNPC ? cr : null
    const classInfo = !isNPC ? name : null


    // Parse size - can be numeric (0-5) or letter abbreviation
    // Game Master 5e format: 0=Tiny, 1=Small, 2=Medium, 3=Large, 4=Huge, 5=Gargantuan
    const sizeRaw = getText(node, 'size')
    const sizeMap = { '0': 'T', '1': 'S', '2': 'M', '3': 'L', '4': 'H', '5': 'G' }
    const size = sizeMap[sizeRaw] || sizeRaw
    const type = getText(node, 'type')

    return {
      uid: getText(node, 'uid'),
      label,
      name,
      level,
      classInfo,
      campaignName,
      isNPC,
      size,
      type,
      ac: getText(node, 'ac'),
      armor: getText(node, 'armor'),
      abilities,
      hpMax: getText(node, 'hpMax'),
      hpCurrent: getText(node, 'hpCurrent'),
      hd: getText(node, 'hd'),
      speed: getText(node, 'speed'),
      init: getText(node, 'init'),
      savingThrows: Array.from(node.querySelectorAll('savingThrow')).map(st => ({
        ability: st.querySelector('ability') ? parseInt(st.querySelector('ability').textContent) : 0,
        modifier: st.querySelector('modifier') ? parseInt(st.querySelector('modifier').textContent) : 0
      })),
      skills: Array.from(node.querySelectorAll('skill')).map(sk => ({
        id: sk.querySelector('id') ? parseInt(sk.querySelector('id').textContent) : 0,
        modifier: sk.querySelector('modifier') ? parseInt(sk.querySelector('modifier').textContent) : 0
      })),
      resist: getText(node, 'resist'),
      senses: getText(node, 'senses'),
      passive: getText(node, 'passive'),
      languages: getText(node, 'languages'),
      cr: getText(node, 'cr'),
      traits: Array.from(node.querySelectorAll('trait')).map(t => ({
        name: getText(t, 'name'),
        text: getText(t, 'text'),
        charges: getText(t, 'charges') ? parseInt(getText(t, 'charges')) : null,
        chargesCurrent: getText(t, 'chargesCurrent') ? parseInt(getText(t, 'chargesCurrent')) : null,
        recharge: getText(t, 'recharge') ? parseInt(getText(t, 'recharge')) : null,
      })),
      actions: Array.from(node.querySelectorAll('action')).map(a => ({
        name: getText(a, 'name'),
        text: getText(a, 'text'),
        attack: a.querySelector('attack') ? {
          name: getText(a.querySelector('attack'), 'name'),
          atk: getText(a.querySelector('attack'), 'atk'),
          dmg: getText(a.querySelector('attack'), 'dmg'),
        } : null
      })),
      slots: getText(node, 'slots'),
      slotsCurrent: getText(node, 'slotsCurrent'),
      text: getText(node, 'text'),
      spells: Array.from(node.querySelectorAll('spell')).map(s => ({
        name: getText(s, 'name'),
        level: getText(s, 'level'),
        school: getText(s, 'school'),
        time: getText(s, 'time'),
        range: getText(s, 'range'),
        duration: getText(s, 'duration'),
        text: Array.from(s.querySelectorAll('text')).map(t => t.textContent.trim()).join('\n'),
        classes: Array.from(s.querySelectorAll('sclass')).map(c => c.textContent.trim()).join(', '),
      }))
    }
  }

  // <pc> elements are player characters; <npc> elements are NPCs
  const players = Array.from(xml.querySelectorAll('pc'))
    .map(node => parseCharNode(node, false))
    .sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name))

  const npcs = Array.from(xml.querySelectorAll('npc'))
    .map(node => parseCharNode(node, true))
    .sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name))

  compendiumData.players = players
  compendiumData.npcs    = npcs
}

// ── Import ────────────────────────────────────────────────────────
function importXML() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xml'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parser = new DOMParser()
        const xml = parser.parseFromString(event.target.result, 'text/xml')
        if (xml.querySelector('parsererror')) {
          showToast('XML parse error — check the file format')
          return
        }
        parseCompendium(xml)
        saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })
        showToast(`Compendium loaded: ${compendiumData.monsters.length} monsters, ${compendiumData.spells.length} spells`)
        showSection('home')
      } catch (err) {
        showToast('Error: ' + err.message)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function addToCompendium() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xml'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parser = new DOMParser()
        const xml = parser.parseFromString(event.target.result, 'text/xml')
        if (xml.querySelector('parsererror')) {
          showToast('XML parse error — check the file format')
          return
        }

        // Parse the new data into temporary arrays
        const tempData = { monsters: [], spells: [] }
        const monsterNodes = Array.from(xml.querySelectorAll('monster'))
        monsterNodes.forEach(node => {
          try {
            const monster = parseMonsterNode(node)
            if (monster && monster.name) tempData.monsters.push(monster)
          } catch (err) {
            console.error('Error parsing monster:', err)
          }
        })

        const spellNodes = Array.from(xml.querySelectorAll('spell'))
        spellNodes.forEach(node => {
          try {
            const spell = parseSpellNode(node)
            if (spell && spell.name) tempData.spells.push(spell)
          } catch (err) {
            console.error('Error parsing spell:', err)
          }
        })

        // Check for duplicates
        const existingMonsterNames = new Set(compendiumData.monsters.map(m => m.name))
        const existingSpellNames = new Set(compendiumData.spells.map(s => s.name))

        const duplicateMonsters = tempData.monsters.filter(m => existingMonsterNames.has(m.name))
        const duplicateSpells = tempData.spells.filter(s => existingSpellNames.has(s.name))

        const dupMonCount = duplicateMonsters.length
        const dupSpellCount = duplicateSpells.length

        // Function to perform the merge
        const performMerge = (replaceExisting) => {
          let addedMonsters = 0
          let addedSpells = 0
          let replacedMonsters = 0
          let replacedSpells = 0

          // Merge monsters
          tempData.monsters.forEach(newMonster => {
            const existingIndex = compendiumData.monsters.findIndex(m => m.name === newMonster.name)
            if (existingIndex >= 0) {
              const existingMonster = compendiumData.monsters[existingIndex]
              if (existingMonster._custom) {
                // Never overwrite custom monsters — add XML version alongside it
                compendiumData.monsters.push(newMonster)
                addedMonsters++
              } else if (replaceExisting) {
                compendiumData.monsters[existingIndex] = newMonster
                replacedMonsters++
              }
              // If not replaceExisting and not custom, skip (keep existing)
            } else {
              compendiumData.monsters.push(newMonster)
              addedMonsters++
            }
          })

          // Merge spells
          tempData.spells.forEach(newSpell => {
            const existingIndex = compendiumData.spells.findIndex(s => s.name === newSpell.name)
            if (existingIndex >= 0) {
              const existingSpell = compendiumData.spells[existingIndex]
              if (existingSpell._custom) {
                // Never overwrite custom spells — add XML version alongside it
                compendiumData.spells.push(newSpell)
                addedSpells++
              } else if (replaceExisting) {
                compendiumData.spells[existingIndex] = newSpell
                replacedSpells++
              }
              // If not replaceExisting and not custom, skip (keep existing)
            } else {
              compendiumData.spells.push(newSpell)
              addedSpells++
            }
          })

          // Sort and save
          compendiumData.monsters.sort((a, b) => a.name.localeCompare(b.name))
          compendiumData.spells.sort((a, b) => a.name.localeCompare(b.name))
          saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })

          // Show summary
          const parts = []
          if (addedMonsters > 0) parts.push(`${addedMonsters} monsters added`)
          if (addedSpells > 0) parts.push(`${addedSpells} spells added`)
          if (replacedMonsters > 0) parts.push(`${replacedMonsters} monsters replaced`)
          if (replacedSpells > 0) parts.push(`${replacedSpells} spells replaced`)

          showToast(parts.length > 0 ? parts.join(', ') : 'No new entries added')
          showSection('home')
        }

        // Show confirmation if there are duplicates
        if (dupMonCount > 0 || dupSpellCount > 0) {
          const overlay = document.createElement('div')
          overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;
            display:flex;align-items:center;justify-content:center;`

          const parts = []
          if (dupMonCount > 0) parts.push(`${dupMonCount} monster${dupMonCount === 1 ? '' : 's'}`)
          if (dupSpellCount > 0) parts.push(`${dupSpellCount} spell${dupSpellCount === 1 ? '' : 's'}`)

          overlay.innerHTML = `
            <div style="background:#262F35;border:2px solid #4a9a9a;border-radius:8px;
                        padding:28px 32px;max-width:400px;text-align:center;font-family:var(--app-font);">
              <div style="font-size:16px;font-weight:bold;color:#e0d5c5;margin-bottom:10px;">Duplicate Entries Found</div>
              <div style="color:#888;font-size:13px;margin-bottom:22px;line-height:1.6;">
                ${parts.join(' and ')} already exist. Replace existing entries or keep them?
              </div>
              <div style="display:flex;gap:10px;justify-content:center;">
                <button onclick="this.closest('div[style*=fixed]').remove();window.mergeCompendiumData(true)"
                  style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 20px;
                         cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
                  Replace
                </button>
                <button onclick="this.closest('div[style*=fixed]').remove();window.mergeCompendiumData(false)"
                  style="background:none;border:1px solid #2a3a5a;color:#888;padding:8px 20px;
                         cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
                  Keep Existing
                </button>
              </div>
            </div>
          `
          document.body.appendChild(overlay)

          // Store the merge function temporarily
          window.mergeCompendiumData = performMerge
        } else {
          // No duplicates, just merge everything
          performMerge(false)
        }

      } catch (err) {
        showToast('Error: ' + err.message)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function importCampaignXML() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xml'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parser = new DOMParser()
        const xml = parser.parseFromString(event.target.result, 'text/xml')
        if (xml.querySelector('parsererror')) {
          showToast('XML parse error — check the file format')
          return
        }
        parseCampaign(xml)
        const firstChar = [...compendiumData.players, ...compendiumData.npcs][0]
        const campaignName = firstChar?.campaignName || file.name.replace('.xml', '')
        if (!compendiumData.campaigns) compendiumData.campaigns = {}
        compendiumData.campaigns[campaignName] = {
          ...compendiumData.campaigns[campaignName],  // preserve ALL existing fields
          players: compendiumData.players,
          npcs: compendiumData.npcs,
          adventures: compendiumData.campaigns[campaignName]?.adventures || []
        }
        compendiumData.activeCampaign = campaignName
        saveCampaigns(compendiumData.campaigns)
        const npcPart = compendiumData.npcs.length > 0 ? `, ${compendiumData.npcs.length} NPCs` : ''
        showToast(`Campaign "${campaignName}" loaded: ${compendiumData.players.length} characters${npcPart}`)
        updateNavBar()
        showSection('home')
      } catch (err) {
        showToast('Error: ' + err.message)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

// ── Toast notification ────────────────────────────────────────────
function showToast(msg) {
  const bubble = document.getElementById('ignacious-speech')
  const tail = document.getElementById('ignacious-speech-tail')
  if (!bubble) return

  bubble.textContent = msg
  bubble.style.opacity = '1'
  bubble.style.transform = 'translateY(0)'
  if (tail) tail.style.opacity = '1'

  clearTimeout(bubble._hideTimer)
  bubble._hideTimer = setTimeout(() => {
    bubble.style.opacity = '0'
    bubble.style.transform = 'translateY(-10px)'
    if (tail) tail.style.opacity = '0'
  }, 3000)
}

// ── Ignacious Eye Tracking ────────────────────────────────────────
let eyeX = 0
let eyeY = 0
let targetEyeX = 0
let targetEyeY = 0

function updateEyePosition() {
  // Lerp for smooth movement
  eyeX += (targetEyeX - eyeX) * 0.15
  eyeY += (targetEyeY - eyeY) * 0.15

  const eye = document.getElementById('ignacious-eye')
  if (eye) {
    eye.style.transform = `translate(${eyeX}px, ${eyeY}px)`
  }

  requestAnimationFrame(updateEyePosition)
}

function initIgnaciousEyeTracking() {
  document.addEventListener('mousemove', (e) => {
    const container = document.getElementById('ignacious-container')
    if (!container) return

    const rect = container.getBoundingClientRect()
    // Eye socket position (38% from top, 48% from left of the container)
    const eyeSocketX = rect.left + (rect.width * 0.48)
    const eyeSocketY = rect.top + (rect.height * 0.38)

    // Calculate angle from eye socket to cursor
    const dx = e.clientX - eyeSocketX
    const dy = e.clientY - eyeSocketY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Normalize and limit to 8% of container size (about 18px movement at 220px)
    const maxMove = rect.width * 0.08
    const moveAmount = Math.min(distance / 200, 1) // Scale based on distance
    targetEyeX = (dx / distance) * maxMove * moveAmount
    targetEyeY = (dy / distance) * maxMove * moveAmount
  })

  updateEyePosition()
}

// ── Ignacious Blink Animation ─────────────────────────────────────
let isBlinking = false

const iggyPhrases = [
  "Cease this provocation.",
  "I said cease!",
  "Is there not another means of entertainment available?",
  "You leave me deeply disappointed...",
  "Surely that must be the final jab...?",
  "OW!"
]
let iggyPhraseIndex = 0

function iggyBlink() {
  if (isBlinking) return // Prevent re-triggering during animation

  const portrait = document.getElementById('iggy-portrait')
  if (!portrait) return

  isBlinking = true
  const originalSrc = portrait.src

  // Show phrase in speech bubble
  showToast(iggyPhrases[iggyPhraseIndex])
  iggyPhraseIndex = (iggyPhraseIndex + 1) % iggyPhrases.length

  // Step 1: Squint for 1/8 second
  portrait.src = 'assets/Ignacious_Squint.png'

  setTimeout(() => {
    // Step 2: Blink for 1/4 second
    portrait.src = 'assets/Ignacious_Blink.png'

    setTimeout(() => {
      // Step 3: Squint for 3/4 second
      portrait.src = 'assets/Ignacious_Squint.png'

      setTimeout(() => {
        // Step 4: Return to original
        portrait.src = originalSrc
        isBlinking = false
      }, 750)
    }, 250)
  }, 125)
}

// Expose to window for onclick handler
window.iggyBlink = iggyBlink

function reimportCampaignXML() {
  if (!compendiumData.activeCampaign) {
    showToast('No active campaign to re-import')
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.xml'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parser = new DOMParser()
        const xml = parser.parseFromString(event.target.result, 'text/xml')
        if (xml.querySelector('parsererror')) {
          showToast('XML parse error — check the file format')
          return
        }
        parseCampaign(xml)
        const campaignName = compendiumData.activeCampaign
        compendiumData.campaigns[campaignName] = {
          ...compendiumData.campaigns[campaignName],  // preserve ALL existing fields
          players: compendiumData.players,
          npcs: compendiumData.npcs
        }
        saveCampaigns(compendiumData.campaigns)
        const npcPart = compendiumData.npcs.length > 0 ? `, ${compendiumData.npcs.length} NPCs` : ''
        showToast(`Campaign "${campaignName}" re-imported: ${compendiumData.players.length} characters${npcPart}`)
        showSection('home')
      } catch (err) {
        showToast('Error: ' + err.message)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

// ── Settings Modal ────────────────────────────────────────────────
// Collapsible section state
let importExpanded = false
let exportExpanded = false

function toggleImportSection() {
  importExpanded = !importExpanded
  const arrow = document.getElementById('import-arrow')
  const options = document.getElementById('settings-import-options')
  if (arrow) arrow.textContent = importExpanded ? '▼' : '▶'
  if (options) options.style.display = importExpanded ? 'block' : 'none'
}
window.toggleImportSection = toggleImportSection

function toggleExportSection() {
  exportExpanded = !exportExpanded
  const arrow = document.getElementById('export-arrow')
  const options = document.getElementById('settings-export-options')
  if (arrow) arrow.textContent = exportExpanded ? '▼' : '▶'
  if (options) options.style.display = exportExpanded ? 'block' : 'none'
}
window.toggleExportSection = toggleExportSection

// ── First-Run Welcome Modal ───────────────────────────────────────
function closeWelcomeModal() {
  const modal = document.getElementById('welcome-modal')
  if (modal) modal.remove()
  saveHasSeenWelcome(true)

  const ignacious = document.getElementById('ignacious-container')
  if (ignacious) ignacious.style.display = ''
  const diceRoller = document.getElementById('dice-roller-container')
  if (diceRoller) diceRoller.style.display = ''
}
window.closeWelcomeModal = closeWelcomeModal

function openSettingsFromWelcome() {
  closeWelcomeModal()
  openSettings()
}
window.openSettingsFromWelcome = openSettingsFromWelcome

function showWelcomeModal() {
  const existing = document.getElementById('welcome-modal')
  if (existing) existing.remove()

  const ignacious = document.getElementById('ignacious-container')
  if (ignacious) ignacious.style.display = 'none'
  const diceRoller = document.getElementById('dice-roller-container')
  if (diceRoller) diceRoller.style.display = 'none'

  const modal = document.createElement('div')
  modal.id = 'welcome-modal'
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2100;
    display:flex;align-items:center;justify-content:center;
  `

  const bodyPara1 = renderMarkdown(
    'I am Ignacious, your humble servant. You may call me Iggy if you so desire. ' +
    'I keep watch over these decrepit halls, and with my arcane tablets I perceive all ' +
    'possibilities. The grand tales however, are *yours* to craft!'
  )
  const bodyPara2 = renderMarkdown(
    'To begin our work: import your existing campaign data **(XML)** from Settings, or ' +
    '**create a new campaign** to begin with an empty slate.'
  )

  modal.innerHTML = `
    <style>
      #welcome-text-overlay::-webkit-scrollbar { display: none; }
    </style>
    <div style="position:relative;width:min(700px, 92vw);aspect-ratio:3214/2993;">
      <img src="assets/Welcome_Asset.png" alt="Ignacious"
        style="width:100%;height:100%;object-fit:contain;display:block;" />

      <button onclick="closeWelcomeModal()"
        style="position:absolute;top:1%;right:2%;background:none;border:none;
               color:#e0d5c5;cursor:pointer;font-size:26px;line-height:1;padding:4px 8px;
               text-shadow:0 0 6px #000, 0 0 6px #000;"
        onmouseover="this.style.color='#4a9a9a'"
        onmouseout="this.style.color='#e0d5c5'">×</button>

      <div id="welcome-text-overlay" style="position:absolute;left:23%;top:58%;width:58%;height:20%;
                  box-sizing:border-box;padding:1% 2%;overflow-y:auto;scrollbar-width:none;
                  display:flex;flex-direction:column;justify-content:center;
                  font-family:var(--app-font);text-align:left;color:#1E231A;">
        <h2 style="font-size:17px;font-weight:bold;margin:0 0 6px 0;line-height:1.2;">
          Welcome, Game Master, to Farsight Keep
        </h2>
        <p style="font-size:11px;line-height:1.35;margin:0 0 6px 0;">
          ${bodyPara1}
        </p>
        <p style="font-size:11px;line-height:1.35;margin:0;">
          ${bodyPara2}
        </p>
      </div>

      <div id="welcome-button-row" style="position:absolute;left:36%;top:92%;width:26%;height:6%;
                  margin-top:14px;
                  display:flex;align-items:center;justify-content:center;gap:11px;">
        <button onclick="openSettingsFromWelcome()"
          style="background:#1E231A;color:#e0d5c5;border:2px solid #1E231A;padding:7px 16px;
                 cursor:pointer;border-radius:4px;font-size:15px;font-family:var(--app-font);white-space:nowrap;">
          Open Settings
        </button>
        <button onclick="closeWelcomeModal()"
          style="background:#1E231A;color:#e0d5c5;border:2px solid #1E231A;padding:7px 16px;
                 cursor:pointer;border-radius:4px;font-size:15px;font-family:var(--app-font);white-space:nowrap;">
          Get Started
        </button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeWelcomeModal()
  })
}
window.showWelcomeModal = showWelcomeModal

function openSettings() {
  const existing = document.getElementById('settings-modal')
  if (existing) {
    existing.remove()
    return
  }

  // Reset expanded state when modal opens
  importExpanded = false
  exportExpanded = false

  const modal = document.createElement('div')
  modal.id = 'settings-modal'
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;
    display:flex;align-items:center;justify-content:center;
  `

  const btnStyle = `
    display:block;width:100%;background:#262F35;border:1px solid #2a3a5a;
    color:#e0d5c5;padding:10px 16px;margin-bottom:8px;cursor:pointer;
    font-size:13px;text-align:left;font-family:var(--app-font);
    border-radius:4px;transition:background .15s,border-color .15s;
  `

  const subBtnStyle = `
    display:block;width:calc(100% - 20px);background:#262F35;border:1px solid #2a3a5a;
    color:#e0d5c5;padding:8px 14px;margin-bottom:6px;margin-left:20px;cursor:pointer;
    font-size:12px;text-align:left;font-family:var(--app-font);
    border-radius:4px;transition:background .15s,border-color .15s;box-sizing:border-box;
  `

  const headerStyle = `
    display:flex;align-items:center;width:100%;background:#262F35;
    border:1px solid #2a3a5a;color:#e0d5c5;padding:10px 16px;
    margin-bottom:8px;cursor:pointer;font-size:14px;font-weight:700;
    text-align:left;font-family:var(--app-font);border-radius:4px;
    transition:background .15s,border-color .15s;letter-spacing:.1em;
  `

  modal.innerHTML = `
    <style>
      #settings-scroll-container::-webkit-scrollbar {
        display: none;
      }
    </style>
    <div style="background:#0a1520;border:2px solid #4a9a9a;border-radius:8px;
                padding:24px;max-width:500px;width:90%;font-family:var(--app-font);
                position:relative;max-height:85vh;display:flex;flex-direction:column;">
      <button onclick="document.getElementById('settings-modal').remove()"
        style="position:absolute;top:12px;right:12px;background:none;border:none;
               color:#555;cursor:pointer;font-size:24px;line-height:1;padding:4px 8px;z-index:1;"
        onmouseover="this.style.color='#e0d5c5'"
        onmouseout="this.style.color='#555'">×</button>

      <h2 style="font-size:20px;color:#e0d5c5;margin:0 0 20px 0;flex-shrink:0;">Settings</h2>

      <div id="settings-scroll-container" style="overflow-y:auto;flex:1;scrollbar-width:none;-ms-overflow-style:none;">


      <div style="margin-bottom:16px;">
        <button onclick="toggleImportSection()"
          style="${headerStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          <span id="import-arrow" style="margin-right:8px;font-size:10px;">▶</span>
          IMPORT...
        </button>
        <div id="settings-import-options" style="display:none;">
          <button onclick="addToCompendium();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Add to Compendium (XML)
          </button>
          <button onclick="importXML();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Re-import Compendium (XML)
          </button>
          <button onclick="importCampaignXML();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Import New Campaign (XML)
          </button>
          <button onclick="reimportCampaignXML();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Re-import Existing Campaign (XML)
          </button>
          <button onclick="restoreFromBackup();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Restore from Backup (JSON)
          </button>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <button onclick="toggleExportSection()"
          style="${headerStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          <span id="export-arrow" style="margin-right:8px;font-size:10px;">▶</span>
          EXPORT...
        </button>
        <div id="settings-export-options" style="display:none;">
          <button onclick="exportCompendium();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Export Compendium
          </button>
          <button onclick="exportActiveCampaign();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Export Active Campaign
          </button>
          <button onclick="exportFullBackup();document.getElementById('settings-modal').remove()"
            style="${subBtnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            Full Backup (JSON)
          </button>
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:#e0d5c5;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          FONT
        </div>
        <button onclick="setAppFont('Cinzel')"
          style="${btnStyle}font-family:'Cinzel',Georgia,serif;"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          Cinzel (Default)
        </button>
        <button onclick="setAppFont('Grenze')"
          style="${btnStyle}font-family:'Grenze',serif;"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          Grenze
        </button>
        <button onclick="setAppFont('Times New Roman')"
          style="${btnStyle}font-family:'Times New Roman',Times,serif;"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          Times New Roman
        </button>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:#e0d5c5;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          DICE ROLLER
        </div>
        <div style="padding:10px 16px;background:#262F35;border:1px solid #2a3a5a;border-radius:4px;">
          ${circleToggle('die-labels-toggle', localStorage.getItem('showDieLabels') === 'true',
            `toggleDieLabels(!(localStorage.getItem('showDieLabels') === 'true'))`,
            'Show Die Labels')}
        </div>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:#e0d5c5;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          CAMPAIGN
        </div>
        <div id="new-campaign-container">
          <button onclick="showNewCampaignForm()"
            style="${btnStyle}"
            onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
            + New Campaign
          </button>
        </div>
        ${compendiumData.activeCampaign ? `
          <div id="campaign-selector-container">
            <button onclick="showRenameCampaignForm()"
              style="${btnStyle}"
              onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
              onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
              Rename Current Campaign
            </button>
          </div>
        ` : ''}
      </div>

      ${compendiumData.activeCampaign ? `
        <div>
          <div style="font-size:14px;color:#e0d5c5;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
            DANGER ZONE
          </div>
          <button onclick="showDeleteCampaignModal()"
            style="display:block;width:100%;background:#5a0000;border:1px solid #8b0000;
                   color:#ff6666;padding:10px 16px;margin-bottom:8px;cursor:pointer;
                   font-size:13px;text-align:left;font-family:var(--app-font);
                   border-radius:4px;transition:background .15s,border-color .15s;"
            onmouseover="this.style.background='#8b0000';this.style.borderColor='#ff0000'"
            onmouseout="this.style.background='#5a0000';this.style.borderColor='#8b0000'">
            Delete Active Campaign
          </button>
        </div>
      ` : ''}

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:#e0d5c5;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          HELP
        </div>
        <button onclick="showWelcomeModal()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          Show Welcome Guide
        </button>
      </div>

      <div style="border-top:1px solid #2a3a5a;padding-top:20px;">
        <div style="font-size:14px;color:#e0d5c5;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          ABOUT
        </div>

        <div style="font-size:12px;color:#999;line-height:1.7;margin-bottom:16px;
                    padding:12px 14px;background:#0d1416;border:1px solid #2a3a5a;border-radius:4px;">
          <div style="font-weight:700;color:#e0d5c5;margin-bottom:8px;">Text Formatting (Notes, etc.)</div>
          <div style="margin-bottom:8px;">Farsight Keep allows for different text formatting as seen below</div>
          <ul style="margin:0;padding-left:20px;">
            <li>*Italic*</li>
            <li>**Bold**</li>
            <li>***Italic and Bold***</li>
            <li>****Underline****</li>
            <li>Add a bullet point - Cmd/Ctrl + .</li>
          </ul>
        </div>

        <div style="font-size:13px;font-weight:700;color:#e0d5c5;margin-bottom:8px;">Disclaimer</div>
        <div style="font-size:12px;color:#999;line-height:1.7;">
          Because creativity is only truly achievable by humans, all creative aspects of
          Farsight Keep (art assets, writing, concepts) have been made by a human hand and
          mind. HOWEVER, the code for this program was completely made using AI, and Iggy
          and I feel it necessary to communicate this to all prospective users of Farsight Keep.
        </div>

        <button onclick="openBuyMeACoffee()"
          style="${btnStyle}margin-top:16px;"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
          &#9749; Buy Me a Coffee
        </button>
      </div>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
}

function toggleDieLabels(enabled) {
  localStorage.setItem('showDieLabels', enabled)
  renderDiceRoller()
}

function setAppFont(fontName) {
  const fontMap = {
    'Cinzel': "'Cinzel', Georgia, serif",
    'Grenze': "'Grenze', serif",
    'Times New Roman': "'Times New Roman', Times, serif"
  }

  const fontFamily = fontMap[fontName] || fontMap['Cinzel']
  document.documentElement.style.setProperty('--app-font', fontFamily)
  localStorage.setItem('dmCompanionFont', fontName)

  // Toggle font-specific classes
  document.body.classList.remove('font-grenze', 'font-times')
  if (fontName === 'Grenze') {
    document.body.classList.add('font-grenze')
  } else if (fontName === 'Times New Roman') {
    document.body.classList.add('font-times')
  }

  const modal = document.getElementById('settings-modal')
  if (modal) modal.remove()
}

function loadFontPreference() {
  const savedFont = localStorage.getItem('dmCompanionFont')
  if (savedFont) {
    // Check if saved font is still valid, otherwise reset to Cinzel
    const validFonts = ['Cinzel', 'Grenze', 'Times New Roman']
    if (validFonts.includes(savedFont)) {
      setAppFont(savedFont)
    } else {
      // Invalid/removed font in localStorage, reset to default
      setAppFont('Cinzel')
    }
  }
}

function showDeleteCampaignModal() {
  const campaignName = compendiumData.activeCampaign
  if (!campaignName) return

  // Close settings modal
  const settingsModal = document.getElementById('settings-modal')
  if (settingsModal) settingsModal.remove()

  const modal = document.createElement('div')
  modal.id = 'delete-campaign-modal'
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2500;
    display:flex;align-items:center;justify-content:center;
  `

  modal.innerHTML = `
    <div style="background:#0a1520;border:2px solid #8b0000;border-radius:8px;
                padding:24px;max-width:500px;width:90%;font-family:var(--app-font);">
      <h2 style="font-size:20px;color:#ff6666;margin:0 0 16px 0;">⚠️ Delete Campaign</h2>

      <div style="background:#1a0000;border:1px solid #8b0000;border-radius:4px;padding:12px;margin-bottom:16px;">
        <p style="color:#e0d5c5;margin:0 0 12px 0;font-size:14px;">
          This will <strong>permanently delete</strong> the campaign "<strong>${campaignName}</strong>" and ALL data within it:
        </p>
        <ul style="color:#ff9999;margin:0;padding-left:20px;font-size:13px;">
          <li>All PCs (${compendiumData.players.length})</li>
          <li>All NPCs (${compendiumData.npcs.length})</li>
          <li>All Adventures (${(compendiumData.campaigns[campaignName].adventures || []).length})</li>
          <li>All Encounters (${Object.keys(enc.list[campaignName] || {}).length})</li>
          <li>All Campaign Notes</li>
        </ul>
      </div>

      <p style="color:#e0d5c5;margin:0 0 12px 0;font-size:14px;">
        Type the campaign name <strong>"${campaignName}"</strong> to confirm:
      </p>

      <input type="text" id="delete-campaign-input" placeholder="Campaign name"
        style="width:100%;box-sizing:border-box;background:#262F35;border:1px solid #8b0000;
               color:#e0d5c5;padding:10px 12px;border-radius:4px;font-family:var(--app-font);
               font-size:14px;margin-bottom:16px;"
        oninput="document.getElementById('delete-campaign-confirm-btn').disabled = (this.value !== '${campaignName}')" />

      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button onclick="document.getElementById('delete-campaign-modal').remove()"
          style="background:#3E3E3D;border:2px solid #2E2F2D;color:#e0d5c5;padding:8px 24px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:14px;">
          Cancel
        </button>
        <button id="delete-campaign-confirm-btn" onclick="confirmDeleteCampaign('${campaignName}')" disabled
          style="background:#8b0000;border:none;color:#e0d5c5;padding:8px 24px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:14px;
                 opacity:0.5;"
          onmouseover="if(!this.disabled)this.style.opacity='1'"
          onmouseout="if(!this.disabled)this.style.opacity='1';else this.style.opacity='0.5'">
          Delete Campaign
        </button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  // Focus input
  setTimeout(() => document.getElementById('delete-campaign-input')?.focus(), 50)

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
}

function confirmDeleteCampaign(campaignName) {
  if (!compendiumData.campaigns[campaignName]) return

  // Delete all encounters for this campaign
  delete enc.list[campaignName]

  // Delete the campaign
  delete compendiumData.campaigns[campaignName]

  // Clear active campaign
  compendiumData.activeCampaign = null
  compendiumData.players = []
  compendiumData.npcs = []

  // Switch to another campaign if one exists
  const remainingCampaigns = Object.keys(compendiumData.campaigns)
  if (remainingCampaigns.length > 0) {
    switchCampaign(remainingCampaigns[0])
  }

  // Save changes
  saveCampaigns(compendiumData.campaigns)
  saveEncounters(enc.list)

  // Close modal and refresh
  document.getElementById('delete-campaign-modal')?.remove()
  showToast(`Campaign "${campaignName}" deleted`)

  // Re-render entire app to update sidebar campaign dropdown
  render()
  showSection('home')
}

// ── Export Functions ──────────────────────────────────────────────
function downloadFile(filename, content, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function showFormatChoice(onJSON, onXML) {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2100;
    display:flex;align-items:center;justify-content:center;
  `

  modal.innerHTML = `
    <div style="background:#0a1520;border:2px solid #4a9a9a;border-radius:8px;
                padding:24px;max-width:400px;width:90%;font-family:var(--app-font);">
      <h3 style="font-size:18px;color:#e0d5c5;margin:0 0 20px 0;text-align:center;">
        Choose Export Format
      </h3>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="format-json-btn"
          style="background:#262F35;border:1px solid #2a3a5a;color:#e0d5c5;
                 padding:12px;cursor:pointer;border-radius:4px;font-size:14px;
                 font-family:var(--app-font);transition:background .15s,border-color .15s;"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Export as JSON
        </button>
        <button id="format-xml-btn"
          style="background:#262F35;border:1px solid #2a3a5a;color:#e0d5c5;
                 padding:12px;cursor:pointer;border-radius:4px;font-size:14px;
                 font-family:var(--app-font);transition:background .15s,border-color .15s;"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Export as XML
        </button>
        <button id="format-cancel-btn"
          style="background:none;border:1px solid #2a3a5a;color:#888;
                 padding:10px;cursor:pointer;border-radius:4px;font-size:13px;
                 font-family:var(--app-font);transition:border-color .15s,color .15s;"
          onmouseover="this.style.borderColor='#555';this.style.color='#aaa'"
          onmouseout="this.style.borderColor='#2a3a5a';this.style.color='#888'">
          Cancel
        </button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  const jsonBtn = modal.querySelector('#format-json-btn')
  const xmlBtn = modal.querySelector('#format-xml-btn')
  const cancelBtn = modal.querySelector('#format-cancel-btn')

  jsonBtn.onclick = () => {
    modal.remove()
    onJSON()
  }

  xmlBtn.onclick = () => {
    modal.remove()
    onXML()
  }

  cancelBtn.onclick = () => {
    modal.remove()
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
}

function exportCompendium() {
  showFormatChoice(
    // JSON export
    () => {
      const data = {
        monsters: compendiumData.monsters,
        spells: compendiumData.spells
      }
      const json = JSON.stringify(data, null, 2)
      downloadFile('compendium.json', json, 'application/json')
      showToast('Compendium exported as JSON')
    },
    // XML export
    () => {
    // XML export - convert to Game Master 5e format
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<compendium>\n'

    // Export monsters
    compendiumData.monsters.forEach(m => {
      xml += '  <monster>\n'
      xml += `    <name>${escapeXML(m.name)}</name>\n`
      if (m.size) xml += `    <size>${escapeXML(m.size)}</size>\n`
      if (m.type) xml += `    <type>${escapeXML(m.type)}</type>\n`
      if (m.alignment) xml += `    <alignment>${escapeXML(m.alignment)}</alignment>\n`
      if (m.ac) xml += `    <ac>${escapeXML(m.ac)}</ac>\n`
      if (m.hp) xml += `    <hp>${escapeXML(m.hp)}</hp>\n`
      if (m.speed) xml += `    <speed>${escapeXML(m.speed)}</speed>\n`
      if (m.str) xml += `    <str>${m.str}</str>\n`
      if (m.dex) xml += `    <dex>${m.dex}</dex>\n`
      if (m.con) xml += `    <con>${m.con}</con>\n`
      if (m.int) xml += `    <int>${m.int}</int>\n`
      if (m.wis) xml += `    <wis>${m.wis}</wis>\n`
      if (m.cha) xml += `    <cha>${m.cha}</cha>\n`
      if (m.save) xml += `    <save>${escapeXML(m.save)}</save>\n`
      if (m.skill) xml += `    <skill>${escapeXML(m.skill)}</skill>\n`
      if (m.vulnerable) xml += `    <vulnerable>${escapeXML(m.vulnerable)}</vulnerable>\n`
      if (m.resist) xml += `    <resist>${escapeXML(m.resist)}</resist>\n`
      if (m.immune) xml += `    <immune>${escapeXML(m.immune)}</immune>\n`
      if (m.conditionImmune) xml += `    <conditionImmune>${escapeXML(m.conditionImmune)}</conditionImmune>\n`
      if (m.senses) xml += `    <senses>${escapeXML(m.senses)}</senses>\n`
      if (m.passive) xml += `    <passive>${m.passive}</passive>\n`
      if (m.languages) xml += `    <languages>${escapeXML(m.languages)}</languages>\n`
      if (m.cr) xml += `    <cr>${escapeXML(m.cr)}</cr>\n`

      if (m.traits && m.traits.length > 0) {
        m.traits.forEach(t => {
          xml += '    <trait>\n'
          xml += `      <name>${escapeXML(t.name)}</name>\n`
          xml += `      <text>${escapeXML(t.text)}</text>\n`
          xml += '    </trait>\n'
        })
      }

      if (m.actions && m.actions.length > 0) {
        m.actions.forEach(a => {
          xml += '    <action>\n'
          xml += `      <name>${escapeXML(a.name)}</name>\n`
          xml += `      <text>${escapeXML(a.text)}</text>\n`
          xml += '    </action>\n'
        })
      }

      if (m.reactions && m.reactions.length > 0) {
        m.reactions.forEach(r => {
          xml += '    <reaction>\n'
          xml += `      <name>${escapeXML(r.name)}</name>\n`
          xml += `      <text>${escapeXML(r.text)}</text>\n`
          xml += '    </reaction>\n'
        })
      }

      if (m.legendaryActions && m.legendaryActions.length > 0) {
        m.legendaryActions.forEach(l => {
          xml += '    <legendary>\n'
          xml += `      <name>${escapeXML(l.name)}</name>\n`
          xml += `      <text>${escapeXML(l.text)}</text>\n`
          xml += '    </legendary>\n'
        })
      }

      xml += '  </monster>\n'
    })

    // Export spells
    compendiumData.spells.forEach(s => {
      xml += '  <spell>\n'
      xml += `    <name>${escapeXML(s.name)}</name>\n`
      if (s.level !== undefined) xml += `    <level>${s.level}</level>\n`
      if (s.school) xml += `    <school>${escapeXML(s.school)}</school>\n`
      if (s.time) xml += `    <time>${escapeXML(s.time)}</time>\n`
      if (s.range) xml += `    <range>${escapeXML(s.range)}</range>\n`
      if (s.components) xml += `    <components>${escapeXML(s.components)}</components>\n`
      if (s.duration) xml += `    <duration>${escapeXML(s.duration)}</duration>\n`
      if (s.classes) xml += `    <classes>${escapeXML(s.classes)}</classes>\n`
      if (s.text) xml += `    <text>${escapeXML(s.text)}</text>\n`
      xml += '  </spell>\n'
    })

    xml += '</compendium>'
    downloadFile('compendium.xml', xml, 'application/xml')
    showToast('Compendium exported as XML')
    }
  )
}

function exportActiveCampaign() {
  if (!compendiumData.activeCampaign) {
    showToast('No active campaign to export')
    return
  }

  const campaign = compendiumData.activeCampaign
  const data = compendiumData.campaigns[campaign]

  showFormatChoice(
    // JSON export
    () => {
      const json = JSON.stringify(data, null, 2)
      downloadFile(`${campaign}.json`, json, 'application/json')
      showToast(`Campaign "${campaign}" exported as JSON`)
    },
    // XML export
    () => {
    // XML export - convert to Game Master 5e format
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<campaign>\n'

    const allCharacters = [...(data.players || []), ...(data.npcs || [])]

    allCharacters.forEach(char => {
      xml += '  <character>\n'
      xml += `    <name>${escapeXML(char.name)}</name>\n`
      if (char.label) xml += `    <label>${escapeXML(char.label)}</label>\n`
      if (char.properName) xml += `    <properName>${escapeXML(char.properName)}</properName>\n`
      if (char.race) xml += `    <race>${escapeXML(char.race)}</race>\n`
      if (char.class) xml += `    <class>${escapeXML(char.class)}</class>\n`
      if (char.level) xml += `    <level>${char.level}</level>\n`
      if (char.ac) xml += `    <ac>${escapeXML(String(char.ac))}</ac>\n`
      if (char.hpMax) xml += `    <hp>${char.hpMax}</hp>\n`
      if (char.speed) xml += `    <speed>${escapeXML(char.speed)}</speed>\n`
      if (char.isNPC !== undefined) xml += `    <isNPC>${char.isNPC ? '1' : '0'}</isNPC>\n`
      xml += '  </character>\n'
    })

    xml += '</campaign>'
    downloadFile(`${campaign}.xml`, xml, 'application/xml')
    showToast(`Campaign "${campaign}" exported as XML`)
    }
  )
}

function exportFullBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    compendium: {
      monsters: compendiumData.monsters,
      spells: compendiumData.spells
    },
    campaigns: compendiumData.campaigns,
    encounters: enc.list
  }

  const json = JSON.stringify(backup, null, 2)
  downloadFile(`farsight-keep-backup-${timestamp}.json`, json, 'application/json')
  showToast('Full backup exported')
}

function restoreFromBackup() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result)

        // Merge compendium with duplicate detection
        if (backup.compendium) {
          if (backup.compendium.monsters) {
            backup.compendium.monsters.forEach(m => {
              const existing = compendiumData.monsters.findIndex(x => x.name === m.name)
              if (existing >= 0) {
                compendiumData.monsters[existing] = m
              } else {
                compendiumData.monsters.push(m)
              }
            })
          }

          if (backup.compendium.spells) {
            backup.compendium.spells.forEach(s => {
              const existing = compendiumData.spells.findIndex(x => x.name === s.name)
              if (existing >= 0) {
                compendiumData.spells[existing] = s
              } else {
                compendiumData.spells.push(s)
              }
            })
          }

          saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })
        }

        // Merge campaigns
        if (backup.campaigns) {
          Object.keys(backup.campaigns).forEach(campaignName => {
            compendiumData.campaigns[campaignName] = backup.campaigns[campaignName]
          })
          saveCampaigns(compendiumData.campaigns)
        }

        // Merge encounters
        if (backup.encounters) {
          Object.keys(backup.encounters).forEach(campaignName => {
            if (!enc.list[campaignName]) enc.list[campaignName] = []
            backup.encounters[campaignName].forEach(encounter => {
              const existing = enc.list[campaignName].findIndex(e => e.id === encounter.id)
              if (existing >= 0) {
                enc.list[campaignName][existing] = encounter
              } else {
                enc.list[campaignName].push(encounter)
              }
            })
          })
          saveEncounters(enc.list)
        }

        showToast('Backup restored successfully')
        showSection('home')
        render()
      } catch (err) {
        showToast('Error restoring backup: ' + err.message)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function escapeXML(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Shell render (called once on boot) ───────────────────────────
function render() {
  const app = document.getElementById('app')
  const sections = ['home', 'monsters', 'spells', 'characters', 'encounters', 'notes']
  const tabImages = {
    home: 'Home_Tab.png',
    monsters: 'Monsters_Tab.png',
    spells: 'Spells_Tab.png',
    characters: 'Characters_Tab.png',
    encounters: 'Encounters_Tab.png',
    notes: 'Notes_Tab.png'
  }

  const campaigns = Object.keys(compendiumData.campaigns || {})
  const hasCampaigns = campaigns.length > 0

  app.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100vh;overflow:visible;
                background-color:rgba(0,0,0,0.3);">

      <!-- Ignacious floating mascot -->
      <div id="ignacious-container" style="position:fixed;top:0;left:0;width:220px;height:220px;
                                           z-index:9999;pointer-events:none;">
        <img id="ignacious-eye" src="assets/Ignacious_Eye.PNG"
          style="position:absolute;width:100%;height:100%;object-fit:contain;
                 transition:transform .2s ease-out;will-change:transform;" />
        <img id="iggy-portrait" src="assets/Ignacious.png"
          style="position:absolute;width:100%;height:100%;object-fit:contain;" />
        <!-- Clickable eye area -->
        <div onclick="iggyBlink()"
          style="position:absolute;top:84px;left:105px;width:40px;height:40px;
                 cursor:pointer;pointer-events:auto;z-index:10001;">
        </div>
      </div>

      <div style="position:relative;flex-shrink:0;height:157px;">
        <img src="assets/Header.png" alt="Header"
          style="position:absolute;top:0;left:0;width:1641px;height:auto;z-index:0;
                 pointer-events:none;display:block;" />
        <div style="display:flex;align-items:center;position:relative;z-index:1;
                    padding:10px 20px 10px 240px;min-height:100%;gap:0;justify-content:space-between;">
          <div style="display:flex;gap:0;">
            <div onclick="showSection('home')" class="nav-btn" id="nav-home"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0 4px 0 0;">
              <img src="assets/${tabImages.home}" alt="home"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
            <div onclick="showSection('characters')" class="nav-btn" id="nav-characters"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0 4px 0 0;">
              <img src="assets/${tabImages.characters}" alt="characters"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
            <div onclick="showSection('encounters')" class="nav-btn" id="nav-encounters"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0 4px 0 0;">
              <img src="assets/${tabImages.encounters}" alt="encounters"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
            <div onclick="showSection('notes')" class="nav-btn" id="nav-notes"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0 4px 0 0;">
              <img src="assets/${tabImages.notes}" alt="notes"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
          </div>

          ${hasCampaigns ? `
            <div style="display:flex;flex-direction:column;align-items:flex-start;">
              <label style="font-size:13px;color:#2E2F2D;letter-spacing:0.1em;font-weight:700;
                            font-family:var(--app-font);display:block;margin-bottom:3px;text-align:center;
                            width:100%;
                            text-shadow:0 0 3px #445E22, 0 0 6px #445E22, 0 0 9px #445E22,
                                        -1px -1px 0 #445E22, 1px -1px 0 #445E22,
                                        -1px 1px 0 #445E22, 1px 1px 0 #445E22;">
                CURRENT CAMPAIGN
              </label>
              <select id="campaign-selector" onchange="switchCampaign(this.value)"
                style="background:#5C5C5C;border:4px solid #2E2F2D;color:#1E231A;
                       padding:6px 12px;border-radius:4px;font-size:13px;font-family:var(--app-font);
                       cursor:pointer;min-width:150px;">
                ${campaigns.map(name => `
                  <option value="${name}" ${name === compendiumData.activeCampaign ? 'selected' : ''}>
                    ${name}
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <div style="display:flex;gap:0;">
            <div onclick="showSection('monsters')" class="nav-btn" id="nav-monsters"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0 4px 0 0;">
              <img src="assets/${tabImages.monsters}" alt="monsters"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
            <div onclick="showSection('spells')" class="nav-btn" id="nav-spells"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0 4px 0 0;">
              <img src="assets/${tabImages.spells}" alt="spells"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
            <div onclick="openSettings()" id="settings-button" title="Settings"
              style="cursor:pointer;pointer-events:auto;
                     display:block;margin:0;">
              <img src="assets/Settings_Tab.png" alt="Settings"
                style="display:block;height:90px;width:auto;object-fit:contain;
                       pointer-events:none;" />
            </div>
          </div>
        </div>
      </div>

      <div id="content" style="flex:1;overflow-y:auto;overflow-x:visible;padding:24px 24px 24px 260px;"></div>

      <div id="ignacious-speech"
        style="position:fixed;top:80px;left:240px;
               background:#EEEEEE;border:2px solid #0E1412;color:#0E1412;
               padding:12px 18px;border-radius:12px;font-size:14px;font-family:var(--app-font);
               opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;z-index:10000;
               max-width:350px;box-shadow:0 4px 12px rgba(0,0,0,.5);transform:translateY(-10px);">
      </div>
      <img id="ignacious-speech-tail" src="assets/Ignacious_Speech_2.png"
        style="position:fixed;top:57px;left:127px;width:138px;height:auto;
               opacity:0;
               transition:opacity .3s;pointer-events:none;z-index:10000;">
      </img>

      <!-- Dice Roller -->
      <div id="dice-roller-container" style="position:fixed;bottom:20px;left:20px;z-index:9998;">
      </div>
    </div>
  `
  initDiceRoller()
}

function updateNavBar() {
  // Re-render the entire nav bar to update campaign selector
  render()
  // Nav buttons are now styled purely by their images, no dynamic styling needed
}

// ── Navigation ────────────────────────────────────────────────────
function showSection(section, skipHistory = false) {
  if (!skipHistory) pushNav(section, null)
  else currentScreen = { screen: section, uid: null }

  // Nav buttons are now styled purely by their images, no dynamic styling needed

  const content = document.getElementById('content')
  if (!content) return

  // Reset content styles (encounter builder overrides these)
  content.style.padding = '24px 24px 24px 260px'
  content.style.overflow = ''
  content.style.overflowY = 'auto'

  // FIX 3: Reset filters when navigating to monsters or spells page
  if (section === 'monsters') {
    monsterFilters = {
      query: '',
      cr: '',
      type: '',
      homebrew: '',
      thirdParty: '',
      environment: '',
      spellcaster: ''
    }
  } else if (section === 'spells') {
    spellFilters = {
      query: '',
      level: '',
      school: '',
      ritual: '',
      concentration: '',
      homebrew: '',
      thirdParty: ''
    }
  }

  if (section === 'home')            renderHome(content)
  else if (section === 'monsters')   renderMonsters(content)
  else if (section === 'spells')     renderSpells(content)
  else if (section === 'characters') renderPlayers(content)
  else if (section === 'encounters') renderEncounters(content)
  else if (section === 'notes') {
    content.innerHTML = '<div id="campaign-notes-section"></div>'
    renderNotes('campaign')
  }
}

// ── Home / Campaign Hub ───────────────────────────────────────────
function renderHome(container) {
  const hasCompendium = compendiumData.monsters.length > 0 || compendiumData.spells.length > 0
  const hasCampaign   = compendiumData.players.length > 0 || compendiumData.npcs.length > 0
  const campaigns     = Object.keys(compendiumData.campaigns || {})

  const cardStyle = (active) =>
    `background:#262F35;border:2px solid ${active ? '#4a9a9a' : '#1e2d4a'};
     border-radius:6px;padding:22px;`

  const btnPrimary =
    `background:#1E231A;color:#909090;border:2px solid #445E22;padding:9px 18px;
     cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);`

  const btnSecondary =
    `background:none;color:#e0d5c5;border:1px solid #4a9a9a;padding:9px 18px;
     cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);`

  container.innerHTML = `
    <div style="margin:0;">

      <h1 style="font-size:26px;font-weight:bold;color:#e0d5c5;margin-bottom:28px;">
        Welcome to Farsight Keep
      </h1>

      ${(!compendiumData.activeCampaign || (compendiumData.players.length === 0 && compendiumData.npcs.length === 0)) ? `
        <p style="color:#e0d5c5;margin-bottom:20px;">Create a new campaign or import one in settings to get started!</p>
      ` : ''}

      ${compendiumData.activeCampaign ? `
        <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <span style="font-size:16px;color:#1E231A;letter-spacing:.1em;font-weight:700;">
              PARTY — ${compendiumData.activeCampaign}
            </span>
            <div style="display:flex;gap:10px;align-items:center;">
              <button onclick="openPCBuilder(null)"
                style="background:#1E231A;color:#8E8E8E;border:2px solid #445E22;padding:6px 14px;
                       cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                       white-space:nowrap;font-weight:700;">
                + Create PC
              </button>
              ${compendiumData.players.length > 0 ? `
                <button onclick="showSection('characters')"
                  style="background:none;border:none;color:#1E231A;font-size:12px;cursor:pointer;
                         font-family:var(--app-font);padding:0;">
                  View all →
                </button>
              ` : ''}
            </div>
          </div>
          ${compendiumData.players.length > 0 ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
              ${compendiumData.players.map(p => `
              <div onclick="showPC(decodeURIComponent(this.dataset.uid))" data-uid="${encodeURIComponent(p.uid)}"
                style="background:#262F35;border:1px solid #1e2d4a;padding:14px;border-radius:5px;
                       cursor:pointer;position:relative;"
                onmouseover="this.style.borderColor='#4a9a9a'"
                onmouseout="this.style.borderColor='#1e2d4a'">
                ${p.portrait ? `
                  <img src="${p.portrait}" style="position:absolute;top:8px;right:8px;width:40px;height:40px;
                       border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
                ` : ''}
                <div style="font-weight:bold;margin-bottom:2px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4587A2;
                            ${p.portrait ? 'padding-right:48px;' : ''}">
                  ${p.label || p.name}
                </div>
                <div style="font-size:12px;color:#888;margin-bottom:10px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${(() => {
                    const levelStr = p.level ? `LV ${p.level}` : ''
                    const classStr = p.race || p.class
                      ? `${p.race || ''} ${p.class || ''}`.trim()
                      : (p.classInfo || '')
                    const isNPC = p.isNPC === true

                    if (isNPC) {
                      return p.cr ? `CR ${p.cr} · ${p.name}` : p.name
                    } else if (classStr) {
                      return levelStr ? `${levelStr} · ${classStr}` : classStr
                    } else {
                      return levelStr || p.name
                    }
                  })()}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;">
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">HP</div>
                    <div style="font-weight:bold;">${p.hpCurrent}/${p.hpMax}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">AC</div>
                    <div style="font-weight:bold;">${(p.acValue ?? p.ac) != null ? (p.acValue ?? p.ac) : '—'}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">INIT</div>
                    <div style="font-weight:bold;">${(() => {
                      if (p.initiativeBonus != null) return modStr(parseInt(p.initiativeBonus))
                      const dex = parseInt(p.abilities?.[1]) || 10
                      const initBonus = Math.floor((dex - 10) / 2)
                      return modStr(initBonus)
                    })()}</div>
                  </div>
                </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <span style="font-size:16px;color:#1E231A;letter-spacing:.1em;font-weight:700;">
              NON-PLAYER CHARACTERS
            </span>
            <div style="display:flex;gap:10px;align-items:center;">
              <button onclick="openNPCBuilder(null)"
                style="background:#1E231A;color:#8E8E8E;border:2px solid #445E22;padding:6px 14px;
                       cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                       white-space:nowrap;font-weight:700;">
                + Create NPC
              </button>
              ${compendiumData.npcs.length > 0 ? `
                <button onclick="showSection('characters')"
                  style="background:none;border:none;color:#1E231A;font-size:12px;cursor:pointer;
                         font-family:var(--app-font);padding:0;">
                  View all →
                </button>
              ` : ''}
            </div>
          </div>
          ${compendiumData.npcs.length > 0 ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
              ${compendiumData.npcs.map(p => `
              <div onclick="showNPC(decodeURIComponent(this.dataset.uid))" data-uid="${encodeURIComponent(p.uid)}"
                style="background:#262F35;border:1px solid #1e2d4a;padding:14px;border-radius:5px;
                       cursor:pointer;position:relative;"
                onmouseover="this.style.borderColor='#4a9a9a'"
                onmouseout="this.style.borderColor='#1e2d4a'">
                ${p.portrait || p._draft?.portrait ? `
                  <img src="${p.portrait || p._draft?.portrait}" style="position:absolute;top:8px;right:8px;width:40px;height:40px;
                       border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
                ` : ''}
                <div style="font-weight:bold;font-size:14px;margin-bottom:2px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4587A2;
                            ${p.portrait || p._draft?.portrait ? 'padding-right:48px;' : ''}">
                  ${p.label || p.name}
                </div>
                <div style="font-size:11px;color:#888;margin-bottom:10px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${(() => {
                    const levelStr = p.level ? `LV ${p.level}` : ''
                    const classStr = p.race || p.class
                      ? `${p.race || ''} ${p.class || ''}`.trim()
                      : (p.classInfo || '')
                    const isNPC = p.isNPC === true

                    if (isNPC) {
                      return p.cr ? `CR ${p.cr} · ${p.name}` : p.name
                    } else if (classStr) {
                      return levelStr ? `${levelStr} · ${classStr}` : classStr
                    } else {
                      return levelStr || p.name
                    }
                  })()}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;">
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">HP</div>
                    <div style="font-weight:bold;">${p.hpCurrent}/${p.hpMax}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">AC</div>
                    <div style="font-weight:bold;">${(p.ac ?? p.acValue) != null ? (p.ac ?? p.acValue) : '—'}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">INIT</div>
                    <div style="font-weight:bold;">${(() => {
                      if (p.initiativeBonus != null) return modStr(parseInt(p.initiativeBonus))
                      const dex = parseInt(p.abilities?.[1]) || 10
                      const initBonus = Math.floor((dex - 10) / 2)
                      return modStr(initBonus)
                    })()}</div>
                  </div>
                </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
      ${renderAdventuresSection()}
      <div id="campaign-notes-section"></div>
    </div>
  `
  if (compendiumData.activeCampaign) renderNotes('campaign')
}

// ── Encounter List ────────────────────────────────────────────────
function renderEncounters(container) {
  const campaign = compendiumData.activeCampaign
  const list = campaign ? (enc.list[campaign] || []) : []

  container.innerHTML = `
    <div style="max-width:700px;margin:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
        <h2 style="font-size:22px;color:#e0d5c5;">Encounters</h2>
        ${campaign ? `
          <button onclick="openNewEncounter()"
            style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 18px;
                   cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);font-weight:700;">
            + Add Encounter
          </button>
        ` : ''}
      </div>
      ${!campaign ? `
        <p style="color:#e0d5c5;">Create a new campaign or import one in settings to manage encounters!</p>
      ` : list.length === 0 ? `
        <div style="color:#555;text-align:center;padding:60px 0;">
          <div style="font-size:40px;opacity:.2;margin-bottom:12px;">&#9876;</div>
          <p>No encounters saved yet. Click "+ Add Encounter" to create one.</p>
        </div>
      ` : list.map(e => {
        const { totalXP, difficulty } = calculateEncounterDifficulty(e)
        const difficultyColors = {
          Low: '#888',
          Moderate: '#d4a020',
          High: '#d9534f',
          Unknown: '#555'
        }
        const difficultyIcons = {
          Low: 'Light_Encounter.png',
          Moderate: 'Medium_Encounter.png',
          High: 'Difficult_Encounter.png'
        }
        const diffColor = difficultyColors[difficulty] || '#888'
        const diffIcon = difficultyIcons[difficulty]
        return `
        <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:6px;
                    padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;">
          <div style="flex:1;">
            <div style="font-weight:bold;font-size:15px;margin-bottom:3px;">${e.name}</div>
            <div style="font-size:12px;color:#1E231A;">${e.combatants.length} combatants</div>
          </div>
          ${totalXP > 0 ? `
            <div style="font-size:12px;color:#888;text-align:right;white-space:nowrap;">
              ${totalXP.toLocaleString()} XP<br>
              <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                ${diffIcon ? `<img src="assets/${diffIcon}" alt="${difficulty}"
                  style="width:20px;height:20px;object-fit:contain;" />` : ''}
                <span style="color:${diffColor};font-weight:600;">${difficulty}</span>
              </div>
            </div>
          ` : ''}
          <button onclick="runEncounter('${e.id}')"
            style="background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;padding:7px 14px;
                   cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
            ${e.combatState && e.combatState.inCombat ? '▶ Resume Combat' : '▶ Run'}
          </button>
          <button onclick="deleteEncounter('${e.id}')"
            style="background:none;color:#444;border:1px solid #2a3a5a;padding:7px 12px;
                   cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
            ✕
          </button>
        </div>
      `}).join('')}
    </div>
  `
}

// ── Encounter Difficulty Calculation ──────────────────────────────
function calculateEncounterDifficulty(encounter) {
  if (!encounter || !encounter.combatants || encounter.combatants.length === 0) {
    return { totalXP: 0, xpPerChar: 0, difficulty: 'Unknown', avgLevel: 0 }
  }

  // Count allies (PCs + non-PC allies)
  const allies = encounter.combatants.filter(c => c.isPC || !c.isEnemy)
  const allyCount = allies.length

  if (allyCount === 0) {
    return { totalXP: 0, xpPerChar: 0, difficulty: 'Unknown', avgLevel: 0 }
  }

  // Calculate average party level from PCs
  const pcs = encounter.combatants.filter(c => c.isPC)
  const avgLevel = pcs.length > 0
    ? Math.round(pcs.reduce((sum, pc) => sum + (pc.level || 1), 0) / pcs.length)
    : 1

  // Sum enemy XP
  const enemies = encounter.combatants.filter(c => !c.isPC && c.isEnemy !== false)
  const totalXP = enemies.reduce((sum, enemy) => {
    const cr = enemy.cr || '0'
    const crEntry = window.MB_CR_TABLE?.find(e => e.cr === String(cr))
    return sum + (crEntry?.xp || 0)
  }, 0)

  const xpPerChar = Math.round(totalXP / allyCount)

  // Determine difficulty based on average level
  const budget = XP_BUDGET_2024[Math.min(avgLevel, 20)] || XP_BUDGET_2024[1]
  let difficulty = 'Low'
  if (xpPerChar >= budget.high) difficulty = 'High'
  else if (xpPerChar >= budget.moderate) difficulty = 'Moderate'

  return { totalXP, xpPerChar, difficulty, avgLevel }
}

function openNewEncounter() {
  enc.current = { id: 'enc_' + Date.now(), name: 'New Encounter', combatants: [] }
  enc.inCombat = false; enc.turn = 0; enc.round = 1; enc.addOpen = false; enc.monsterQ = ''
  enterEncounterBuilder()
}

function runEncounter(id) {
  const campaign = compendiumData.activeCampaign
  const e = (enc.list[campaign] || []).find(x => x.id === id)
  if (!e) return
  enc.current = JSON.parse(JSON.stringify(e))

  // Check if there's saved combat state
  if (e.combatState && e.combatState.inCombat) {
    // Restore combat state
    enc.inCombat = true
    enc.turn = e.combatState.turn
    enc.round = e.combatState.round

    // Restore combatant states (only combat-specific fields, not static character data)
    enc.current.combatants.forEach(c => {
      const savedState = e.combatState.combatants.find(s => s.uid === c.uid)
      if (savedState) {
        // Restore truly dynamic combat state
        c.hpCurrent = savedState.hpCurrent
        // NOTE: Do NOT restore hpMax, ac, abilities - those are static character stats
        // that should come from the base combatant data (which migration updates)
        c.initiative = savedState.initiative
        c.conditions = savedState.conditions || []
        c.isEnemy = savedState.isEnemy

        // Restore spell usage and limited-use features
        if (savedState.spellSlots) c.spellSlots = savedState.spellSlots
        if (savedState.dailySpells) c.dailySpells = savedState.dailySpells
        if (savedState.spells) c.spells = savedState.spells
        if (savedState.traits) c.traits = savedState.traits
        if (savedState.actions) c.actions = savedState.actions
        if (savedState.reactions) c.reactions = savedState.reactions
        if (savedState.legendaries) c.legendaries = savedState.legendaries
        if (savedState.lairs) c.lairs = savedState.lairs
      }
    })

    // Sort by initiative for combat display
    enc.current.combatants.sort((a, b) => b.initiative - a.initiative)
  } else {
    // Fresh start - reset HP and combat state
    enc.current.combatants.forEach(c => {
      c.hpCurrent = c.hpMax
      // Backwards compatibility: default isEnemy for old saves
      if (c.isEnemy === undefined) {
        c.isEnemy = !c.isPC
      }
    })
    enc.inCombat = false; enc.turn = 0; enc.round = 1
  }

  enc.addOpen = false; enc.monsterQ = ''
  enterEncounterBuilder()
}

function deleteEncounter(id) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !enc.list[campaign]) return
  confirmDelete('Delete encounter?', () => {
    enc.list[campaign] = enc.list[campaign].filter(e => e.id !== id)
    saveEncounters(enc.list)
    showSection('encounters')
  })
}

function enterEncounterBuilder() {
  pushNav('encounter', null)

  // Nav buttons are now styled purely by their images, no dynamic styling needed
  const content = document.getElementById('content')
  content.style.padding = '0'
  content.style.overflow = 'hidden'
  content.style.overflowY = 'hidden'
  renderEncounterBuilder(content)

  // Set sidebar height after render to account for header
  setTimeout(() => {
    const topbar = document.getElementById('enc-topbar')
    const sidebar = document.getElementById('enc-left')
    if (topbar && sidebar) {
      const headerHeight = topbar.offsetHeight
      sidebar.style.height = `calc(100vh - ${headerHeight + 280}px)`
    }
  }, 0)
}

// ── Encounter Builder ─────────────────────────────────────────────
function renderEncounterBuilder(container) {
  container.innerHTML = `
    <div style="min-height:100%;background:linear-gradient(#5C5C5C 40px, transparent 40px),
                linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                url('assets/Background.png') left -40px/1641px auto no-repeat fixed;">
      <div id="enc-topbar"
        style="display:flex;align-items:center;gap:12px;
               padding:16px 20px 12px 20px;background:#5C5C5C;border-bottom:4px solid #2E2F2D;
               flex-shrink:0;padding-left:240px;box-sizing:border-box;">
        <button onclick="popNav()"
          style="background:#3E3E3D;border:4px solid #2E2F2D;color:#C8C8C8;padding:5px 12px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:12px;
                 white-space:nowrap;">
          ← Campaign
        </button>
        <input id="enc-name-input" value="${enc.current.name}"
          onchange="enc.current.name=this.value"
          style="background:transparent;border:none;border-bottom:1px solid #2a3a5a;
                 color:#e0d5c5;font-size:15px;font-family:var(--app-font);font-weight:bold;
                 padding:2px 6px;min-width:140px;max-width:220px;outline:none;" />
        <span id="enc-difficulty-label" style="font-size:12px;color:#888;white-space:nowrap;margin-right:auto;"></span>
        <button id="enc-add-btn" onclick="toggleAddPanel()"
          style="background:#4a9a9a;color:#fff;border:none;padding:6px 13px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;">
          + Add
        </button>
        <button id="btn-start-next" onclick="startCombat()"
          style="background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;padding:6px 13px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;">
          ▶ Start
        </button>
        <button id="btn-end-combat" onclick="endCombat()" disabled
          style="background:#262F35;color:#444;border:1px solid #2a3a5a;padding:6px 13px;
                 cursor:not-allowed;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;">
          ■ End
        </button>
        <button id="enc-notes-btn" onclick="toggleEncNotes()"
          style="background:#262F35;color:#e0d5c5;border:1px solid #2a3a5a;padding:6px 13px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:12px;
                 white-space:nowrap;">
          &#128203; Notes
        </button>
        <button onclick="saveEncounterPrompt()"
          style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 13px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;">
          Save
        </button>
      </div>

      <div style="display:flex;position:relative;flex:1;">

        <div id="enc-left"
          style="width:210px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;
                 height:calc(100vh - 336px) !important;
                 background:#0a1520;border:5px solid #262F35;
                 scrollbar-width:none;-ms-overflow-style:none;">
          <style>
            #enc-left::-webkit-scrollbar { display: none; }
          </style>
        </div>

        <div id="enc-center"
          style="flex:1;overflow-x:auto;overflow-y:hidden;display:flex;
                 align-items:flex-start;gap:12px;padding:16px;position:relative;z-index:1;">
        </div>

        <div id="enc-overlay" onclick="closeEncPanels()"
          style="position:absolute;inset:0;z-index:15;display:none;background:transparent;">
        </div>

        <div id="enc-notes-panel"
          style="position:absolute;right:0;top:0;bottom:0;width:0;
                 background:#0d1b2a;border-left:2px solid #4a9a9a;
                 transform:translateX(100%);transition:transform .2s, width .2s;
                 overflow:hidden;z-index:19;padding:0;box-sizing:border-box;">
          <div id="enc-notes-content"></div>
        </div>

        <div id="enc-add-panel"
          style="position:absolute;right:0;top:0;bottom:0;width:0;
                 background:#0d1b2a;border-left:2px solid #4a9a9a;
                 transform:translateX(100%);transition:transform .2s, width .2s;
                 overflow:hidden;z-index:20;padding:0;box-sizing:border-box;">
        </div>

      </div>
    </div>
  `


  refreshInitSidebar()
  refreshCards()

  // If resuming combat, update UI to combat state
  if (enc.inCombat) {
    const btn = document.getElementById('btn-start-next')
    const e = document.getElementById('btn-end-combat')
    if (btn) {
      btn.textContent = '⏭ Next'
      btn.onclick = nextTurn
    }
    if (e) { e.disabled = false; e.style.color = '#e08080'; e.style.background = '#2a0000'; e.style.border = '1px solid #6a0000'; e.style.cursor = 'pointer' }
  }
}

// ── Left Sidebar ──────────────────────────────────────────────────
function refreshInitSidebar() {
  const sidebar = document.getElementById('enc-left')
  if (!sidebar || !enc.current) return
  const combatants = enc.inCombat
    ? [...enc.current.combatants].sort((a, b) => b.initiative - a.initiative)
    : enc.current.combatants

  // Round counter at the top
  const roundDisplay = enc.inCombat
    ? `Round <strong>${enc.round}</strong>`
    : 'Round <strong>—</strong>'
  const roundHeader = `
    <div style="position:sticky;top:0;z-index:5;background:#0a1520;
                padding:12px 10px;border-bottom:2px solid #1e2d4a;
                text-align:center;font-size:13px;color:#aaa;">
      ${roundDisplay}
    </div>
  `

  if (combatants.length === 0) {
    sidebar.innerHTML = roundHeader + `<p style="color:#7B9BA8;font-size:12px;padding:14px;text-align:center;">
      Add combatants →</p>`
    return
  }
  sidebar.innerHTML = roundHeader + combatants.map((c, i) => {
    const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 100
    const barColor = pct > 50 ? '#2a7a2a' : pct > 25 ? '#7a6a00' : '#8a0000'
    const isActive = enc.inCombat && i === enc.turn
    return `
      <div id="sidebar-row-${c.uid}"
        style="padding:9px 10px;cursor:pointer;border-bottom:1px solid #111c2a;
               background:${isActive ? '#1e3d5c' : 'transparent'};
               border-left:3px solid ${isActive ? '#4587A2' : 'transparent'};
               position:relative;"
        onmouseover="if(!${isActive})this.style.background='#0e1c2e';document.getElementById('remove-btn-${c.uid}').style.opacity='1'"
        onmouseout="if(!${isActive})this.style.background='transparent';document.getElementById('remove-btn-${c.uid}').style.opacity='0'">
        <div onclick="scrollToCard('${c.uid}')" style="pointer-events:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
            <div style="font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;
                        text-overflow:ellipsis;max-width:138px;
                        color:${isActive ? '#ffffff' : '#e0d5c5'};">${c.name}</div>
            <div style="font-size:11px;color:#C8C8C8;flex-shrink:0;margin-left:4px;">${c.initiative}</div>
          </div>
          <div style="font-size:11px;color:#C8C8C8;margin-bottom:3px;">
            AC ${(() => { const n = parseInt(c.ac); return !isNaN(n) ? n : (c.ac || '—') })()} · ${c.hpCurrent}/${c.hpMax} HP
            ${c.hpCurrent <= 0 ? '<span style="font-weight:bold;color:#ff0000;margin-left:6px;">DEAD</span>' : ''}
          </div>
          <div style="height:4px;background:#1e2d4a;border-radius:2px;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px;"></div>
          </div>
        </div>
        <button id="remove-btn-${c.uid}"
          onclick="event.stopPropagation();removeCombatant('${c.uid}')"
          style="position:absolute;top:6px;right:6px;
                 background:rgba(26,28,30,0.95);border:1px solid #8b0000;color:#ff6666;
                 cursor:pointer;font-size:14px;width:20px;height:20px;
                 border-radius:3px;padding:0;display:flex;align-items:center;
                 justify-content:center;opacity:0;transition:opacity 0.15s ease;
                 font-weight:bold;line-height:1;"
          title="Remove from encounter">✕</button>
      </div>
    `
  }).join('')
}

function scrollToCard(uid) {
  const card = document.getElementById('card-' + uid)
  const container = document.getElementById('enc-center')
  if (!card || !container) return

  // Calculate position to scroll the card into center view
  const cardLeft = card.offsetLeft
  const cardWidth = card.offsetWidth
  const containerWidth = container.offsetWidth
  const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2)

  // Scroll only the cards container horizontally
  container.scrollTo({ left: scrollPosition, behavior: 'smooth' })
}

// ── Combatant Cards ───────────────────────────────────────────────
function updateDifficultyDisplay() {
  const label = document.getElementById('enc-difficulty-label')
  if (!label || !enc.current) return

  const { totalXP, difficulty } = calculateEncounterDifficulty(enc.current)

  const difficultyColors = {
    Low: '#888',
    Moderate: '#d4a020',
    High: '#d9534f',
    Unknown: '#555'
  }

  const difficultyIcons = {
    Low: 'Light_Encounter.png',
    Moderate: 'Medium_Encounter.png',
    High: 'Difficult_Encounter.png'
  }

  const color = difficultyColors[difficulty] || '#888'
  const icon = difficultyIcons[difficulty]

  if (totalXP > 0) {
    label.innerHTML = `${icon ? `<img src="assets/${icon}" alt="${difficulty}" style="width:64px;height:64px;object-fit:contain;vertical-align:middle;margin-right:10px;" />` : ''}<span style="color:#1E231A;font-size:15px;vertical-align:middle;">${difficulty}</span><span style="color:#1E231A;font-size:15px;vertical-align:middle;margin:0 8px;">·</span><span style="color:#1E231A;font-size:15px;vertical-align:middle;">Total XP: <strong>${totalXP.toLocaleString()}</strong></span>`
  } else {
    label.innerHTML = ''
  }
}

function refreshCards() {
  const center = document.getElementById('enc-center')
  if (!center || !enc.current) return
  const combatants = enc.inCombat
    ? [...enc.current.combatants].sort((a, b) => b.initiative - a.initiative)
    : enc.current.combatants

  updateDifficultyDisplay()
  if (combatants.length === 0) {
    center.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;
                  flex:1;color:#333;text-align:center;min-height:300px;">
        <div>
          <div style="font-size:48px;opacity:.1;margin-bottom:12px;">&#9876;</div>
          <p style="font-size:13px;">Use the <strong style="color:#555;">+</strong> button to add combatants</p>
        </div>
      </div>`
    return
  }
  const scrollLeft = center.scrollLeft
  const scrollPositions = {}
  center.querySelectorAll('[id^="card-"]').forEach(card => {
    scrollPositions[card.id] = card.scrollTop
  })
  center.innerHTML = combatants.map((c, i) => buildCard(c, enc.inCombat && i === enc.turn)).join('')
  requestAnimationFrame(() => {
    center.scrollLeft = scrollLeft
    Object.keys(scrollPositions).forEach(cardId => {
      const card = document.getElementById(cardId)
      if (card) card.scrollTop = scrollPositions[cardId]
    })
  })
}

function hpBarColor(pct) {
  return pct > 50 ? '#2a7a2a' : pct > 25 ? '#7a6a00' : '#8a0000'
}

function buildCard(c, isActive) {
  const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 100

  // Helper to calculate ability modifier
  function abilityMod(score) {
    const num = parseInt(score) || 10
    return Math.floor((num - 10) / 2)
  }

  function modStr(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`
  }

  // Get ability scores (handle different data formats)
  function getAbilityScore(ability) {
    const abMap = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 }

    // 1. Try c.abilities array
    if (c.abilities && Array.isArray(c.abilities)) {
      const score = parseInt(c.abilities[abMap[ability]])
      if (!isNaN(score)) return score
    }

    // 2. Try c.fullMonsterData.abilities array (for encounter-only monsters)
    if (c.fullMonsterData?.abilities && Array.isArray(c.fullMonsterData.abilities)) {
      const score = parseInt(c.fullMonsterData.abilities[abMap[ability]])
      if (!isNaN(score)) return score
    }

    // 3. Try c[ability] individual field
    if (c[ability] !== undefined) {
      const score = parseInt(c[ability])
      if (!isNaN(score)) return score
    }

    // 4. Try c.fullMonsterData[ability] individual field (for encounter-only monsters)
    if (c.fullMonsterData?.[ability] !== undefined) {
      const score = parseInt(c.fullMonsterData[ability])
      if (!isNaN(score)) return score
    }

    // 5. Default to 10 if all lookups failed
    return 10
  }

  const availConds = CONDITIONS.filter(cond => !c.conditions.includes(cond))
  const activeChips = c.conditions.map(cond => `
    <span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 10px;
                 border-radius:10px;font-size:12px;background:#4a9a9a;color:#e0d5c5;margin:2px;">
      ${cond}
      <button onclick="removeCondition('${c.uid}','${cond}')"
        style="background:none;border:none;color:#e0d5c5;cursor:pointer;font-size:14px;
               line-height:1;padding:0;margin-left:2px;opacity:.7;" title="Remove">×</button>
    </span>`).join('')
  const condDropItems = availConds.map(cond => `
    <div onclick="addCondFromDrop('${c.uid}','${cond}')"
      style="padding:6px 12px;cursor:pointer;font-size:12px;color:#aaa;white-space:nowrap;"
      onmouseover="this.style.background='#142840';this.style.color='#e0d5c5';"
      onmouseout="this.style.background='transparent';this.style.color='#aaa';">
      ${cond}</div>`).join('')

  function abilityBlock(label, items, section) {
    if (!items || items.length === 0) return ''
    return `
      <div style="margin-top:12px;">
        <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                    margin-bottom:6px;">${label}</div>
        ${items.map((item, idx) => {
          const text = item.text || ''
          const long = text.length > 120 || text.includes('\n')
          const tid = `trait-${c.uid}-${section}-${idx}`

          // Fallback: if charges is undefined/null, try reading from limitedUsage
          const charges = item.charges ?? (item.limitedUsage?.type === 'per_day' || item.limitedUsage?.type === 'charges' ? item.limitedUsage.count : null)
          const chargesCurrent = item.chargesCurrent ?? (item.limitedUsage?.type === 'per_day' || item.limitedUsage?.type === 'charges' ? item.limitedUsage.count : null)

          // Extract recharge with fallback
          let recharge = item.recharge
          if (recharge === null || recharge === undefined) {
            if (item.limitedUsage?.type === 'recharge_5_6') recharge = 5
            else if (item.limitedUsage?.type === 'recharge_6') recharge = 6
            else if (item.limitedUsage?.type?.startsWith('recharge_')) {
              const match = item.limitedUsage.type.match(/recharge_(\d+)/)
              if (match) recharge = parseInt(match[1])
            }
          }

          // Build display name (recharge moved to separate line below)
          const displayName = item.name || ''
          const rechargeText = (recharge !== null && recharge !== undefined && recharge !== '' && charges === null)
            ? `(Recharge ${recharge}${recharge === 6 ? '' : `-6`})`
            : ''

          return `
          <div style="margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
              <div onclick="toggleTraitText('${tid}')"
                style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;
                       ${long ? 'cursor:pointer;' : ''}">
                <div style="display:flex;align-items:center;gap:4px;">
                  <strong style="font-size:13px;overflow:hidden;text-overflow:ellipsis;
                                 white-space:nowrap;">${displayName}</strong>
                  ${long ? `<span id="${tid}-arrow"
                    style="font-size:11px;color:#555;flex-shrink:0;">▼</span>` : ''}
                </div>
                ${rechargeText ? `<div style="font-size:12px;color:#b8b0a0;">${rechargeText}</div>` : ''}
              </div>
              ${item.attack && item.attack.atk ? `
                <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;position:relative;">
                  ${item.attack.atk !== '—' ? `
                    <button onclick="rollAttack('${c.uid}','${(item.name || '').replace(/'/g, "\\'")}',${JSON.stringify(item.attack || {}).replace(/"/g, '&quot;')})"
                      style="background:#0f3460;border:none;color:#e0d5c5;padding:3px 8px;
                             cursor:pointer;border-radius:3px;font-size:11px;line-height:1.3;
                             white-space:nowrap;"
                      title="Roll attack">Roll Attack</button>
                  ` : ''}
                  <button id="dmg-btn-${c.uid}-${idx}" onclick="${item.attack.altDiceCount ?
                    `showDamagePopup('${c.uid}','${(item.name || '').replace(/'/g, "\\'")}',${JSON.stringify(item.attack || {}).replace(/"/g, '&quot;')},this)` :
                    `rollDamage('${c.uid}','${(item.name || '').replace(/'/g, "\\'")}',${JSON.stringify(item.attack || {}).replace(/"/g, '&quot;')},'standard')`}"
                    style="background:#0f3460;border:none;color:#e0d5c5;padding:3px 8px;
                           cursor:pointer;border-radius:3px;font-size:11px;line-height:1.3;
                           white-space:nowrap;"
                    title="Roll damage">Roll Damage</button>
                </div>
              ` : ''}
              ${charges !== null ? `
                <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
                  <button onclick="adjustCharge('${c.uid}','${section}',${idx},-1)"
                    style="background:#0f3460;border:none;color:#e0d5c5;width:22px;height:22px;
                           cursor:pointer;border-radius:3px;font-size:14px;line-height:1;
                           padding:0;display:flex;align-items:center;justify-content:center;">-</button>
                  <span style="font-size:12px;color:#aaa;min-width:36px;text-align:center;">
                    ${chargesCurrent}/${charges}</span>
                  <button onclick="adjustCharge('${c.uid}','${section}',${idx},1)"
                    style="background:#0f3460;border:none;color:#e0d5c5;width:22px;height:22px;
                           cursor:pointer;border-radius:3px;font-size:14px;line-height:1;
                           padding:0;display:flex;align-items:center;justify-content:center;">+</button>
                </div>
              ` : ''}
            </div>
            <div id="${tid}"
              style="color:#b8b0a0;font-size:13px;line-height:1.5;margin-top:1px;white-space:pre-wrap;
                     ${long ? 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;' : ''}">${renderMarkdown(text.trim())}</div>
          </div>`
        }).join('')}
      </div>`
  }

  const slotsHTML = c.spellSlots && c.spellSlots.length > 0 ? `
    <div style="margin-top:12px;">
      <div style="font-size:12px;color:#e0d5c5;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">SPELL SLOTS</div>
      ${c.spellSlots.map((slot, si) => {
        const avail = slot.total - slot.used
        return `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <span style="font-size:12px;color:#e0d5c5;width:30px;">Lv ${slot.level}</span>
            <button onclick="adjustSlot('${c.uid}',${si},1)"
              ${avail === 0 ? 'disabled' : ''}
              style="background:#2a0000;border:none;color:${avail === 0 ? '#333' : '#e08080'};width:22px;height:22px;
                     cursor:${avail === 0 ? 'default' : 'pointer'};border-radius:3px;font-size:14px;
                     line-height:1;padding:0;display:flex;align-items:center;justify-content:center;">−</button>
            <span style="font-size:13px;color:#aaa;min-width:36px;text-align:center;">
              ${avail}/${slot.total}</span>
            <button onclick="adjustSlot('${c.uid}',${si},-1)"
              ${slot.used === 0 ? 'disabled' : ''}
              style="background:#082012;border:none;color:${slot.used === 0 ? '#333' : '#80c880'};width:22px;height:22px;
                     cursor:${slot.used === 0 ? 'default' : 'pointer'};border-radius:3px;font-size:14px;
                     line-height:1;padding:0;display:flex;align-items:center;justify-content:center;">+</button>
          </div>`
      }).join('')}
    </div>
  ` : ''

  const dailySpellsHTML = c.dailySpells && c.dailySpells.length > 0 ? `
    <div style="margin-top:12px;">
      <div style="font-size:12px;color:#e0d5c5;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">SPELLS</div>
      ${c.dailySpells.map((grp, gi) => `
        <div style="margin-bottom:7px;">
          <div style="font-size:11px;color:#e0d5c5;letter-spacing:.05em;margin-bottom:4px;
                      text-transform:uppercase;">${grp.group}</div>
          ${grp.tracked
            ? grp.spells.map((sp, si) => {
                const rem = sp.total - sp.used
                return `
                  <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
                    <button onclick="adjustDailySpell('${c.uid}',${gi},${si},1)"
                      ${rem === 0 ? 'disabled' : ''}
                      style="background:#2a0000;border:none;color:${rem === 0 ? '#333' : '#e08080'};
                             width:20px;height:20px;cursor:${rem === 0 ? 'default' : 'pointer'};
                             border-radius:3px;font-size:13px;line-height:1;padding:0;
                             display:flex;align-items:center;justify-content:center;flex-shrink:0;">−</button>
                    <span style="font-size:12px;color:${rem === 0 ? '#333' : '#aaa'};
                                 text-decoration:${rem === 0 ? 'line-through' : 'none'};
                                 flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
                                 white-space:nowrap;" title="${sp.name}">${sp.name}</span>
                    <span style="font-size:12px;color:#555;flex-shrink:0;">${rem}/${sp.total}</span>
                    <button onclick="adjustDailySpell('${c.uid}',${gi},${si},-1)"
                      ${sp.used === 0 ? 'disabled' : ''}
                      style="background:#082012;border:none;color:${sp.used === 0 ? '#333' : '#80c880'};
                             width:20px;height:20px;cursor:${sp.used === 0 ? 'default' : 'pointer'};
                             border-radius:3px;font-size:13px;line-height:1;padding:0;
                             display:flex;align-items:center;justify-content:center;flex-shrink:0;">+</button>
                  </div>`
              }).join('')
            : `<div style="font-size:12px;color:#666;line-height:1.6;">
                ${grp.spells.join(', ')}</div>`
          }
        </div>
      `).join('')}
    </div>
  ` : ''

  const knownSpellsHTML = (() => {
    if (!c.selectedSpells || c.selectedSpells.length === 0) return ''
    const sorted = [...c.selectedSpells].sort((a, b) => (parseInt(a.level) || 0) - (parseInt(b.level) || 0))
    const levelMap = new Map()
    sorted.forEach((s, i) => {
      const lvl = parseInt(s.level) || 0
      if (!levelMap.has(lvl)) levelMap.set(lvl, [])
      levelMap.get(lvl).push({ ...s, idx: i })
    })
    const levelLabel = lvl => lvl === 0 ? 'Cantrips' : `Level ${lvl}`

    function spellDetail(s, lvl) {
      return `
        <div id="cspell-detail-${c.uid}-${s.idx}"
          style="display:none;background:#1A1C1E;padding:10px;border-radius:0 0 3px 3px;
                 border:1px solid #0f1e30;border-top:none;">
          <div style="font-size:12px;color:#666;margin-bottom:5px;">
            ${lvl === 0 ? 'Cantrip' : 'Level ' + lvl}${s.time ? ' · ' + s.time : ''}${s.range ? ' · ' + s.range : ''}${s.duration ? ' · ' + s.duration : ''}
          </div>
          <div style="font-size:12px;color:#aaa;line-height:1.6;white-space:pre-wrap;">${s.text || ''}</div>
        </div>`
    }

    function spellRow(s, lvl) {
      const exhausted = s.usesMax != null && s.usesCurrent === 0
      const partial   = s.usesMax != null && s.usesCurrent > 0 && s.usesCurrent < s.usesMax
      const nameStyle = `font-size:13px;font-weight:bold;flex:1;min-width:0;
                         overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                         ${exhausted ? 'text-decoration:line-through;color:#444;' : ''}`
      const rowBg = `background:#0f1e30;border-radius:3px;`

      if (s.atWill) {
        return `
          <div style="margin-bottom:4px;">
            <div onclick="toggleCombatantSpell('${c.uid}',${s.idx})"
              style="display:flex;justify-content:space-between;align-items:center;
                     ${rowBg}padding:6px 10px;cursor:pointer;"
              onmouseover="this.style.background='#142840'"
              onmouseout="this.style.background='#0f1e30'">
              <span style="${nameStyle}">${s.name}</span>
              <span style="font-size:11px;color:#555;flex-shrink:0;margin-left:6px;">At will</span>
            </div>
            ${spellDetail(s, lvl)}
          </div>`
      }

      if (s.usesMax != null) {
        const countColor = exhausted ? '#4a9a9a' : partial ? '#e0c060' : '#e0d5c5'
        const counterHTML = s.perDay
          ? (exhausted || partial
              ? `<strong style="font-size:14px;color:${countColor};">${s.usesCurrent}</strong><span style="font-size:11px;color:#444;"> / ${s.usesMax}/day</span>`
              : `<span style="font-size:12px;color:#555;">${s.usesMax}/day</span>`)
          : `<strong style="font-size:14px;color:${countColor};">${s.usesCurrent}</strong><span style="font-size:11px;color:#444;"> / ${s.usesMax} uses</span>`
        return `
          <div style="margin-bottom:4px;">
            <div style="display:flex;align-items:center;gap:0;${rowBg}padding:4px 8px 4px 5px;"
              onmouseover="this.style.background='#142840'"
              onmouseout="this.style.background='#0f1e30'">
              <button onclick="adjustCombatantSpellUse('${c.uid}','${s.name.replace(/'/g, "\\'")}', -1)"
                ${s.usesCurrent === 0 ? 'disabled' : ''}
                style="background:#2a0000;border:none;color:${s.usesCurrent === 0 ? '#333' : '#e08080'};
                       width:20px;height:20px;cursor:${s.usesCurrent === 0 ? 'default' : 'pointer'};
                       border-radius:3px;font-size:13px;line-height:1;padding:0;flex-shrink:0;
                       display:flex;align-items:center;justify-content:center;">−</button>
              <div onclick="toggleCombatantSpell('${c.uid}',${s.idx})"
                style="display:flex;align-items:center;gap:5px;flex:1;min-width:0;
                       cursor:pointer;padding:2px 8px;">
                <span style="${nameStyle}">${s.name}</span>
                <span id="cspell-arrow-${c.uid}-${s.idx}"
                  style="font-size:11px;color:#555;flex-shrink:0;">▼</span>
              </div>
              <span style="flex-shrink:0;white-space:nowrap;margin-right:5px;">${counterHTML}</span>
              <button onclick="adjustCombatantSpellUse('${c.uid}','${s.name.replace(/'/g, "\\'")}', 1)"
                ${s.usesCurrent === s.usesMax ? 'disabled' : ''}
                style="background:#082012;border:none;color:${s.usesCurrent === s.usesMax ? '#333' : '#80c880'};
                       width:20px;height:20px;cursor:${s.usesCurrent === s.usesMax ? 'default' : 'pointer'};
                       border-radius:3px;font-size:13px;line-height:1;padding:0;flex-shrink:0;
                       display:flex;align-items:center;justify-content:center;">+</button>
            </div>
            ${spellDetail(s, lvl)}
          </div>`
      }

      // Slot-based: expandable only, no counter
      return `
        <div style="margin-bottom:4px;">
          <div onclick="toggleCombatantSpell('${c.uid}',${s.idx})"
            style="display:flex;justify-content:space-between;align-items:center;
                   ${rowBg}padding:6px 10px;cursor:pointer;"
            onmouseover="this.style.background='#142840'"
            onmouseout="this.style.background='#0f1e30'">
            <span style="${nameStyle}">${s.name}</span>
            <span id="cspell-arrow-${c.uid}-${s.idx}"
              style="font-size:11px;color:#555;flex-shrink:0;margin-left:6px;">▼</span>
          </div>
          ${spellDetail(s, lvl)}
        </div>`
    }

    return `
      <div style="margin-top:12px;">
        <div style="font-size:12px;color:#e0d5c5;letter-spacing:.08em;font-weight:700;
                    margin-bottom:6px;">SPELLS</div>
        ${Array.from(levelMap.entries()).map(([lvl, spells]) => `
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:#e0d5c5;letter-spacing:.05em;margin-bottom:4px;
                        text-transform:uppercase;">${levelLabel(lvl)}</div>
            ${spells.map(s => spellRow(s, lvl)).join('')}
          </div>`).join('')}
      </div>`
  })()

  return `
    <div id="card-${c.uid}"
      style="min-width:420px;max-width:420px;background:#262F35;flex-shrink:0;
             border:${isActive ? '6px' : '2px'} solid ${isActive ? '#4587A2' : '#1e2d4a'};border-radius:6px;
             padding:16px;align-self:flex-start;position:relative;
             max-height:calc(100vh - 220px);overflow-y:auto;overflow-x:visible;padding-bottom:80px;
             scrollbar-width:none;-ms-overflow-style:none;">
      <style>
        #card-${c.uid}::-webkit-scrollbar { display: none; }
        #hp-input-${c.uid}::placeholder { color: #C8C8C8; opacity: 1; }
        #hp-input-${c.uid}::-moz-placeholder { color: #C8C8C8; opacity: 1; }
        #card-${c.uid} input[type=number]::-webkit-inner-spin-button,
        #card-${c.uid} input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      </style>
      ${pct <= 50 ? `<img src="assets/Bloodied.png" alt="Bloodied"
        style="position:absolute;top:-2px;right:0;width:96px;height:96px;margin:0;padding:0;
               object-fit:contain;pointer-events:none;z-index:10;display:block;" />` : ''}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:10px;">
        ${c.portrait ? `
          <img src="${c.portrait}" style="width:50px;height:50px;flex-shrink:0;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        <div style="min-width:0;flex:1;">
          <div style="font-weight:bold;font-size:18px;margin-bottom:2px;color:#4587A2;
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:13px;color:#C8C8C8;">${(() => {
              if (c.isPC) {
                // Format: "Class (Subclass) Level - Race" or "Class Level - Race"
                let subtitle = ''
                if (c.class) {
                  subtitle = c.subclass ? `${c.class} (${c.subclass})` : c.class
                  subtitle += ` ${c.level || 1}`
                } else {
                  subtitle = `Level ${c.level || 1}`
                }
                if (c.race) {
                  subtitle += ` - ${c.race}`
                }
                return subtitle
              }
              // For NPCs/Monsters, build subtitle from CR, size, and type
              const parts = []
              if (c.cr) parts.push(`CR ${c.cr}`)
              if (c.size) parts.push(expandSize(c.size))
              if (c.type) parts.push(c.type)
              return parts.join(' ')
            })()}</span>
            ${!c.isPC ? `
              <button onclick="toggleAllyEnemy('${c.uid}')"
                style="background:${c.isEnemy === false ? '#1a4a2a' : '#4a0000'};
                       color:${c.isEnemy === false ? '#8fd9a8' : '#e08080'};
                       border:1px solid ${c.isEnemy === false ? '#2a7a4a' : '#8a0000'};
                       padding:2px 8px;cursor:pointer;border-radius:3px;font-size:11px;
                       font-family:var(--app-font);letter-spacing:.03em;font-weight:600;">
                  ${c.isEnemy === false ? 'Ally' : 'Enemy'}
                </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;">
        <div style="background:#1A1C1E;padding:7px 6px;border-radius:3px;text-align:center;">
          <div style="font-size:11px;color:#C8C8C8;letter-spacing:.05em;margin-bottom:2px;">INIT</div>
          <input type="number" value="${c.initiative}"
            onchange="setInit('${c.uid}',this.value)"
            style="background:transparent;border:none;color:#e0d5c5;font-family:var(--app-font);
                   font-size:18px;font-weight:bold;width:100%;text-align:center;outline:none;
                   padding:0;margin:0;-moz-appearance:textfield;
                   -webkit-appearance:none;appearance:none;box-sizing:border-box;" />
        </div>
        <div style="background:#1A1C1E;padding:7px 6px 27px 6px;text-align:center;
                    clip-path:polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%);
                    position:relative;">
          <div style="font-size:11px;color:#C8C8C8;letter-spacing:.05em;margin-bottom:2px;">AC</div>
          <div style="font-size:18px;font-weight:bold;">${(() => {
            const acNum = parseInt(c.ac)
            return !isNaN(acNum) ? acNum : '—'
          })()}</div>
          ${(() => {
            const armorText = c.armor || (typeof c.ac === 'string' ?
              (c.ac.match(/\(([^)]+)\)/) || [])[1] : '')
            return armorText ?
              `<div style="font-size:9px;color:#888;margin-top:2px;">${armorText}</div>` : ''
          })()}
        </div>
        <div style="background:#1A1C1E;padding:7px 6px;border-radius:3px;text-align:center;">
          <div style="font-size:11px;color:#C8C8C8;letter-spacing:.05em;margin-bottom:2px;">SPD</div>
          ${(() => {
            if (!c.speed || c.speed === '—') return '<div style="font-size:15px;font-weight:bold;">—</div>'

            // Parse speed string into movement types
            const speedStr = String(c.speed).toLowerCase()
            const movements = []

            // Match patterns like "30 ft.", "fly 60 ft.", "60 ft. fly", etc.
            // First, try to extract base walking speed (first number without a type label)
            const walkMatch = speedStr.match(/^(\d+)\s*(?:ft\.?)?(?:\s*,|$)/)
            if (walkMatch) {
              movements.push({ type: 'walk', value: walkMatch[1] })
            }

            // Extract other movement types (fly, climb, burrow, swim)
            const types = ['fly', 'climb', 'burrow', 'swim']
            types.forEach(type => {
              // Match "fly 60 ft." or "60 ft. fly"
              const regex1 = new RegExp(type + '\\s+(\\d+)\\s*(?:ft\\.?)?', 'i')
              const regex2 = new RegExp('(\\d+)\\s*(?:ft\\.?)?\\s+' + type, 'i')
              const match = speedStr.match(regex1) || speedStr.match(regex2)
              if (match) {
                movements.push({ type, value: match[1] })
              }
            })

            if (movements.length === 0) {
              // Fallback: just display as-is if parsing failed
              return '<div style="font-size:15px;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + c.speed + '</div>'
            }

            // If only one movement type, display normally on one line
            if (movements.length === 1) {
              return '<div style="font-size:15px;font-weight:bold;">' + movements[0].value + ' ft.</div>'
            }

            // Multiple movement types: stack vertically with smaller font
            // Font size: start at 15px, reduce by 1.5px per extra type, min 7.5px (50% of 15px)
            const fontSize = Math.max(7.5, 15 - ((movements.length - 1) * 1.5))

            return movements.map((m, i) => {
              const label = m.type === 'walk' ? '' : (m.type.charAt(0).toUpperCase() + m.type.slice(1) + ' ')
              return '<div style="font-size:' + fontSize + 'px;font-weight:bold;line-height:1.3;">' + label + m.value + ' ft.</div>'
            }).join('')
          })()}
        </div>
      </div>

      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-size:13px;color:#C8C8C8;">HP</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:15px;font-weight:bold;">${c.hpCurrent} / ${c.hpMax}</span>
            ${c.hpCurrent <= 0 ? '<span style="font-size:13px;font-weight:bold;color:#ff0000;">DEAD</span>' : ''}
          </div>
        </div>
        <div style="height:8px;background:#1a1a1a;border-radius:4px;">
          <div style="width:${pct}%;height:100%;background:${hpBarColor(pct)};
                      border-radius:4px;transition:width .3s,background .3s;"></div>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
        <input id="hp-input-${c.uid}" type="number" placeholder="Amount" min="0"
          style="flex:1;min-width:0;background:#1A1C1E;border:1px solid #1e2d4a;color:#e0d5c5;
                 padding:6px 8px;border-radius:3px;font-size:14px;font-family:var(--app-font);
                 -moz-appearance:textfield;"
          onkeydown="if(event.key==='Enter'){applyDamage('${c.uid}')}" />
        <button onclick="applyDamage('${c.uid}')"
          style="background:#2a0000;color:#e08080;border:1px solid #6a0000;padding:6px 10px;
                 cursor:pointer;border-radius:3px;font-size:13px;font-family:var(--app-font);">
          Dmg</button>
        <button onclick="applyHeal('${c.uid}')"
          style="background:#082012;color:#80c880;border:1px solid #1a6a2a;padding:6px 10px;
                 cursor:pointer;border-radius:3px;font-size:13px;font-family:var(--app-font);">
          Heal</button>
      </div>

      <div style="margin-bottom:10px;">
        <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                    margin-bottom:5px;">CONDITIONS</div>
        ${c.conditions.length ? `<div style="display:flex;flex-wrap:wrap;margin-bottom:5px;">${activeChips}</div>` : ''}
        <div style="position:relative;display:inline-block;">
          <button onclick="toggleCondDropdown('${c.uid}')"
            style="background:#0f1e30;border:1px solid #2a3a5a;color:#4a9a9a;font-weight:bold;
                   padding:4px 11px;border-radius:4px;cursor:pointer;
                   font-size:12px;font-family:var(--app-font);">
            + Condition</button>
          <div id="cond-drop-${c.uid}"
            style="display:none;position:absolute;top:calc(100% + 3px);left:0;z-index:200;
                   background:#0d1b2a;border:1px solid #2a3a5a;border-radius:4px;
                   max-height:180px;overflow-y:auto;min-width:160px;
                   box-shadow:0 4px 12px rgba(0,0,0,.7);">
            ${availConds.length ? condDropItems : '<div style="padding:8px 12px;font-size:12px;color:#444;">All conditions active</div>'}
          </div>
        </div>
      </div>

      <!-- Ability Scores -->
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                    margin-bottom:6px;">ABILITY SCORES</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">
          ${['str','dex','con','int','wis','cha'].map(ab => {
            const score = getAbilityScore(ab)
            const mod = abilityMod(score)
            return `
              <div style="background:#1A1C1E;padding:6px 3px;border-radius:3px;text-align:center;">
                <div style="font-size:9px;color:#4a9a9a;letter-spacing:.05em;margin-bottom:2px;">${ab.toUpperCase()}</div>
                <div style="font-size:15px;font-weight:bold;">${score}</div>
                <div style="font-size:11px;color:#C8C8C8;">${modStr(mod)}</div>
              </div>`
          }).join('')}
        </div>
      </div>

      <!-- Saving Throws (always visible) -->
      ${(() => {
        // Handle both string (monsters) and array (PCs/NPCs) formats
        let savesText = ''
        if (c.save) {
          savesText = c.save
        } else if (c.savingThrows) {
          if (Array.isArray(c.savingThrows)) {
            // Sort by standard D&D ability order
            const ABILITY_ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
            const sorted = [...c.savingThrows].sort((a, b) => {
              const aName = typeof a.ability === 'number'
                ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][a.ability]
                : String(a.ability).toUpperCase()
              const bName = typeof b.ability === 'number'
                ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][b.ability]
                : String(b.ability).toUpperCase()
              return ABILITY_ORDER.indexOf(aName) - ABILITY_ORDER.indexOf(bName)
            })
            savesText = sorted.map(st => {
              const abilityName = typeof st.ability === 'number' ? ['STR','DEX','CON','INT','WIS','CHA'][st.ability] : st.ability
              return `${abilityName} ${st.modifier >= 0 ? '+' : ''}${st.modifier}`
            }).join(', ')
          } else if (typeof c.savingThrows === 'string') {
            savesText = c.savingThrows
          }
        }

        return savesText ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                        margin-bottom:4px;">SAVING THROWS</div>
            <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${savesText}</div>
          </div>
        ` : ''
      })()}

      <!-- Resistances, Immunities -->
      ${c.resist ? `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">RESISTANCES</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${c.resist}</div>
        </div>
      ` : ''}
      ${c.immune ? `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">IMMUNITIES</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${c.immune}</div>
        </div>
      ` : ''}
      ${c.vulnerable ? `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">VULNERABILITIES</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${c.vulnerable}</div>
        </div>
      ` : ''}
      ${c.conditionImmune ? `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">CONDITION IMMUNITIES</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${c.conditionImmune}</div>
        </div>
      ` : ''}

      <!-- ADDITIONAL STATS Section (collapsible) -->
      ${(() => {
        // Check if any stats exist
        const hasSkills = c.skills && ((Array.isArray(c.skills) && c.skills.length > 0) || (typeof c.skills === 'string' && c.skills.trim()))
        const hasSenses = c.senses && c.senses.trim()
        const hasLanguages = c.languages && c.languages.trim()

        // Calculate passive senses to check if we have any content
        const getProfBonus = () => {
          if (c.proficiencyBonus) return c.proficiencyBonus
          if (c.isPC) return Math.floor((parseInt(c.level) || 1 - 1) / 4) + 2
          const cr = parseFloat(c.cr) || 0
          if (cr >= 29) return 9
          if (cr >= 25) return 8
          if (cr >= 21) return 7
          if (cr >= 17) return 6
          if (cr >= 13) return 5
          if (cr >= 9) return 4
          if (cr >= 5) return 3
          return 2
        }
        const profBonus = getProfBonus()

        const passives = []

        // Passive Perception (always calculate for all combatants)
        if (c.passive !== undefined && c.passive !== '' && c.passive !== null) {
          passives.push(`Perception ${c.passive}`)
        } else {
          const wis = getAbilityScore('wis')
          const wisMod = abilityMod(wis)
          const perceptionSkill = Array.isArray(c.skills)
            ? c.skills.find(sk => (typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : sk.name) === 'Perception')
            : null
          const passivePerception = 10 + wisMod + (perceptionSkill ? profBonus : 0)
          passives.push(`Perception ${passivePerception}`)
        }

        // Passive Insight (all combatants)
        if (c.passiveInsight !== undefined && c.passiveInsight !== null) {
          passives.push(`Insight ${c.passiveInsight}`)
        } else if (c.isPC || !c.isPC) { // Show for all combatants
          const wis = getAbilityScore('wis')
          const wisMod = abilityMod(wis)
          const insightSkill = Array.isArray(c.skills)
            ? c.skills.find(sk => (typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : sk.name) === 'Insight')
            : null
          const passiveInsight = 10 + wisMod + (insightSkill ? profBonus : 0)
          passives.push(`Insight ${passiveInsight}`)
        }

        // Passive Investigation (all combatants)
        if (c.passiveInvestigation !== undefined && c.passiveInvestigation !== null) {
          passives.push(`Investigation ${c.passiveInvestigation}`)
        } else if (c.isPC || !c.isPC) { // Show for all combatants
          const int = getAbilityScore('int')
          const intMod = abilityMod(int)
          const investigationSkill = Array.isArray(c.skills)
            ? c.skills.find(sk => (typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : sk.name) === 'Investigation')
            : null
          const passiveInvestigation = 10 + intMod + (investigationSkill ? profBonus : 0)
          passives.push(`Investigation ${passiveInvestigation}`)
        }

        const hasPassiveSenses = passives.length > 0

        // Don't show section if nothing to display
        if (!hasSkills && !hasSenses && !hasLanguages && !hasPassiveSenses) return ''

        // Format skills
        let skillsText = ''
        if (hasSkills) {
          if (Array.isArray(c.skills)) {
            skillsText = c.skills.sort((a, b) => {
              const nameA = typeof a.id === 'number' ? SKILL_NAMES[a.id] : (a.name || 'Unknown')
              const nameB = typeof b.id === 'number' ? SKILL_NAMES[b.id] : (b.name || 'Unknown')
              return nameA.localeCompare(nameB)
            }).map(sk => {
              const skillName = typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || 'Unknown')
              const mod = sk.modifier || 0
              return `${skillName} ${mod >= 0 ? '+' : ''}${mod}`
            }).join(', ')
          } else {
            skillsText = typeof c.skills === 'string' ? c.skills.split(',').map(s => s.trim()).sort().join(', ') : c.skills
          }
        }

        return `
          <div style="margin-bottom:10px;">
            <div onclick="toggleNotesSection('additional-stats-${c.uid}')"
              style="display:flex;align-items:center;gap:4px;cursor:pointer;
                     font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">
              ADDITIONAL STATS
              <span id="additional-stats-${c.uid}-arrow" style="font-size:11px;color:#555;">▼</span>
            </div>
            <div id="additional-stats-${c.uid}" style="display:none;padding-left:0px;font-size:12px;color:#b8b0a0;line-height:1.6;">
              ${skillsText ? `<div style="margin-bottom:6px;"><strong style="color:#c9a87c;">Skills:</strong> ${skillsText}</div>` : ''}
              ${hasPassiveSenses ? `<div style="margin-bottom:6px;"><strong style="color:#c9a87c;">Passive Senses:</strong> ${passives.join(', ')}</div>` : ''}
              ${hasSenses ? `<div style="margin-bottom:6px;"><strong style="color:#c9a87c;">Senses:</strong> ${c.senses}</div>` : ''}
              ${hasLanguages ? `<div style="margin-bottom:6px;"><strong style="color:#c9a87c;">Languages:</strong> ${c.languages}</div>` : ''}
            </div>
          </div>
        `
      })()}

      ${abilityBlock('TRAITS', c.traits, 'traits')}
      ${abilityBlock('ACTIONS', c.actions, 'actions')}
      ${abilityBlock('BONUS ACTIONS', c.bonusActions, 'bonus')}
      ${abilityBlock('REACTIONS', c.reactions, 'reactions')}
      ${abilityBlock('LEGENDARY ACTIONS', c.legendaryActions, 'legendary')}
      ${abilityBlock('LAIR ACTIONS', c.lairs, 'lairs')}
      ${slotsHTML}
      ${dailySpellsHTML}
      ${knownSpellsHTML}

      <!-- Notes (collapsible) -->
      ${c.notes && c.notes.length > 0 ? `
        <div style="margin-top:12px;">
          <div onclick="toggleNotesSection('notes-${c.uid}')"
            style="display:flex;align-items:center;gap:4px;cursor:pointer;
                   font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">
            NOTES
            <span id="notes-${c.uid}-arrow" style="font-size:11px;color:#555;">▼</span>
          </div>
          <div id="notes-${c.uid}"
            style="display:none;color:#b8b0a0;font-size:12px;line-height:1.5;">
            ${c.notes.map(note => `
              <div style="margin-bottom:8px;">
                ${note.title ? `<div style="font-weight:bold;color:#4a9a9a;margin-bottom:0;">${renderMarkdown(note.title)}</div>` : ''}
                <div style="white-space:pre-line;text-indent:0;padding:0;margin:0;">${renderMarkdown(note.body || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Description (collapsible) -->
      ${c.description || c.text ? `
        <div style="margin-top:12px;">
          <div onclick="toggleTraitText('desc-${c.uid}')"
            style="display:flex;align-items:center;gap:4px;cursor:pointer;
                   font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">
            DESCRIPTION
            <span id="desc-${c.uid}-arrow" style="font-size:11px;color:#555;">▼</span>
          </div>
          <div id="desc-${c.uid}"
            style="display:none;color:#b8b0a0;font-size:12px;line-height:1.5;white-space:pre-wrap;">
            ${c.description || c.text}
          </div>
        </div>
      ` : ''}
    </div>
  `
}

// ── Add Panel ─────────────────────────────────────────────────────
function toggleAddPanel() {
  if (enc.notesOpen) {
    enc.notesOpen = false
    const notesPanel = document.getElementById('enc-notes-panel')
    if (notesPanel) notesPanel.style.transform = 'translateX(100%)'
  }
  enc.addOpen = !enc.addOpen
  const panel   = document.getElementById('enc-add-panel')
  const btn     = document.getElementById('enc-add-btn')
  const overlay = document.getElementById('enc-overlay')
  if (!panel) return
  if (enc.addOpen) {
    panel.style.width = '290px'
    panel.style.padding = '16px'
    panel.style.overflowY = 'auto'
    panel.style.transform = 'translateX(0)'
    if (btn) btn.textContent = '×'
    if (overlay) overlay.style.display = 'block'
    renderAddPanel()
  } else {
    panel.style.transform = 'translateX(100%)'
    panel.style.width = '0'
    panel.style.padding = '0'
    panel.style.overflow = 'hidden'
    if (btn) btn.textContent = '+ Add'
    if (overlay) overlay.style.display = 'none'
  }
}

function renderAddPanel() {
  const panel = document.getElementById('enc-add-panel')
  if (!panel) return
  const pcs = compendiumData.players
  const npcs = compendiumData.npcs
  const filtered = enc.monsterQ
    ? compendiumData.monsters.filter(m => m.name.toLowerCase().includes(enc.monsterQ.toLowerCase())).slice(0, 40)
    : compendiumData.monsters.slice(0, 40)

  // Store filtered list for index-based lookups
  enc.filteredMonsters = filtered

  panel.innerHTML = `
    <div style="padding:14px;">
      <div style="font-size:13px;color:#4587A2;letter-spacing:.1em;font-weight:700;
                  margin-bottom:14px;">ADD COMBATANTS</div>

      ${pcs.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;color:#7B9BA8;letter-spacing:.06em;
                      margin-bottom:6px;font-weight:700;">PARTY</div>
          ${pcs.map(p => `
            <div onclick="addFromPC('${p.uid}')"
              style="padding:7px 10px;border:1px solid #1e2d4a;border-radius:4px;
                     margin-bottom:4px;cursor:pointer;font-size:12px;"
              onmouseover="this.style.borderColor='#4a9a9a'"
              onmouseout="this.style.borderColor='#1e2d4a'">
              <div style="font-weight:bold;">${p.label || p.name}</div>
              <div style="color:#e0d5c5;font-size:11px;">
                HP ${p.hpMax} · AC ${(p.acValue ?? p.ac) != null ? (p.acValue ?? p.ac) : '—'}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${npcs.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;color:#7B9BA8;letter-spacing:.06em;
                      margin-bottom:6px;font-weight:700;">NPCs</div>
          ${npcs.map(p => `
            <div onclick="addFromNPC('${p.uid}')"
              style="padding:7px 10px;border:1px solid #1e2d4a;border-radius:4px;
                     margin-bottom:4px;cursor:pointer;font-size:12px;"
              onmouseover="this.style.borderColor='#4a9a9a'"
              onmouseout="this.style.borderColor='#1e2d4a'">
              <div style="font-weight:bold;">${p.label || p.name}</div>
              <div style="color:#e0d5c5;font-size:11px;">
                HP ${p.hpMax} · AC ${(p.acValue ?? p.ac) != null ? (p.acValue ?? p.ac) : '—'}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="margin-bottom:16px;">
        <div style="font-size:10px;color:#7B9BA8;letter-spacing:.06em;
                    margin-bottom:6px;font-weight:700;">MONSTERS</div>
        <input type="text" placeholder="Search monsters…" value="${enc.monsterQ}"
          oninput="filterEncMonsters(this.value)"
          style="width:100%;padding:6px 10px;background:#5C5C5C;border:4px solid #2E2F2D;
                 color:#1E231A;font-family:var(--app-font);border-radius:3px;font-size:12px;
                 margin-bottom:6px;box-sizing:border-box;" />
        <div id="enc-monster-list" style="max-height:260px;overflow-y:auto;">
          ${filtered.length === 0
            ? '<p style="color:#444;font-size:12px;">No results</p>'
            : filtered.map((m, idx) => `
              <div id="monster-item-${idx}"
                data-monster-index="${idx}"
                style="padding:6px 10px;border:1px solid #1e2d4a;border-radius:3px;
                       margin-bottom:3px;">
                <div onclick="showMonsterChoiceByIndex(${idx})"
                  style="cursor:pointer;"
                  onmouseover="this.parentElement.style.borderColor='#4a9a9a'"
                  onmouseout="this.parentElement.style.borderColor='#1e2d4a'">
                  <div style="font-size:12px;font-weight:bold;">${m.name}</div>
                  <div style="font-size:11px;color:#e0d5c5;">CR ${m.cr || '—'} · HP ${m.hp} · AC ${m.ac}</div>
                </div>
                <div id="monster-choice-${idx}" style="display:none;margin-top:6px;padding-top:6px;border-top:1px solid #1e2d4a;">
                  <button onclick="addMonsterAsIsByIndex(${idx})"
                    style="width:100%;background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;
                           padding:5px;cursor:pointer;border-radius:3px;font-size:11px;
                           font-family:var(--app-font);margin-bottom:3px;">
                    Use As Is
                  </button>
                  <button onclick="modifyMonsterByIndex(${idx})"
                    style="width:100%;background:#0f3460;color:#e0d5c5;border:1px solid #1a5a9a;
                           padding:5px;cursor:pointer;border-radius:3px;font-size:11px;
                           font-family:var(--app-font);">
                    Modify
                  </button>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    </div>
  `
}

function filterEncMonsters(query) {
  enc.monsterQ = query
  const list = document.getElementById('enc-monster-list')
  if (!list) return
  const filtered = query
    ? compendiumData.monsters.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 40)
    : compendiumData.monsters.slice(0, 40)

  // Store filtered list for lookup
  enc.filteredMonsters = filtered

  list.innerHTML = filtered.length === 0
    ? '<p style="color:#444;font-size:12px;">No results</p>'
    : filtered.map((m, idx) => `
        <div id="monster-item-${idx}"
          data-monster-index="${idx}"
          style="padding:6px 10px;border:1px solid #1e2d4a;border-radius:3px;margin-bottom:3px;">
          <div onclick="showMonsterChoiceByIndex(${idx})"
            style="cursor:pointer;"
            onmouseover="this.parentElement.style.borderColor='#4a9a9a'"
            onmouseout="this.parentElement.style.borderColor='#1e2d4a'">
            <div style="font-size:12px;font-weight:bold;">${m.name}</div>
            <div style="font-size:11px;color:#555;">CR ${m.cr || '—'} · HP ${m.hp} · AC ${m.ac}</div>
          </div>
          <div id="monster-choice-${idx}" style="display:none;margin-top:6px;padding-top:6px;border-top:1px solid #1e2d4a;">
            <button onclick="addMonsterAsIsByIndex(${idx})"
              style="width:100%;background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;
                     padding:5px;cursor:pointer;border-radius:3px;font-size:11px;
                     font-family:var(--app-font);margin-bottom:3px;">
              Use As Is
            </button>
            <button onclick="modifyMonsterByIndex(${idx})"
              style="width:100%;background:#0f3460;color:#e0d5c5;border:1px solid #1a5a9a;
                     padding:5px;cursor:pointer;border-radius:3px;font-size:11px;
                     font-family:var(--app-font);">
              Modify
            </button>
          </div>
        </div>
      `).join('')
}

// ── Combat Controls ───────────────────────────────────────────────
function startCombat() {
  if (!enc.current || enc.current.combatants.length === 0) {
    showToast('Add combatants before starting combat')
    return
  }
  enc.inCombat = true
  enc.round = 1
  enc.turn = 0
  enc.current.combatants.sort((a, b) => b.initiative - a.initiative)

  const btn = document.getElementById('btn-start-next')
  const e = document.getElementById('btn-end-combat')
  if (btn) {
    btn.textContent = '⏭ Next'
    btn.onclick = nextTurn
  }
  if (e) { e.disabled = false; e.style.color = '#e08080'; e.style.background = '#2a0000'; e.style.border = '1px solid #6a0000'; e.style.cursor = 'pointer' }
  refreshInitSidebar()
  refreshCards()
}

function nextTurn() {
  if (!enc.inCombat || !enc.current) return
  const count = enc.current.combatants.length
  if (count === 0) return

  // Get sorted combatants by initiative
  const sorted = [...enc.current.combatants].sort((a, b) => b.initiative - a.initiative)

  // Helper to check if combatant should be skipped
  const shouldSkip = (c) => {
    // Skip if: HP is 0 or less, AND (not a PC, AND not an ally)
    return c.hpCurrent <= 0 && !c.isPC && c.isEnemy !== false
  }

  // Try to advance turn, skipping dead enemies
  let attempts = 0
  let nextIndex
  do {
    enc.turn = (enc.turn + 1) % count
    if (enc.turn === 0) {
      enc.round++
    }
    nextIndex = enc.turn
    attempts++

    // If we've checked all combatants and all are dead/skippable, stop
    if (attempts > count) {
      // All combatants are down - stay on current turn
      showToast('All combatants are down')
      break
    }
  } while (shouldSkip(sorted[nextIndex]))

  refreshInitSidebar()
  refreshCards()
}

function endCombat() {
  enc.inCombat = false
  enc.turn = 0
  enc.round = 1
  const btn = document.getElementById('btn-start-next')
  const e = document.getElementById('btn-end-combat')
  if (btn) {
    btn.textContent = '▶ Start'
    btn.onclick = startCombat
  }
  if (e) { e.disabled = true; e.style.color = '#444'; e.style.background = '#262F35'; e.style.border = '1px solid #2a3a5a'; e.style.cursor = 'not-allowed' }
  refreshInitSidebar()
  refreshCards()
}

// ── Combatant Manipulation ────────────────────────────────────────
function makeCombatantUid() {
  return 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
}

function addFromPC(uid) {
  const pc = compendiumData.players.find(p => p.uid === uid)
  if (!pc) return

  // Parse class from classInfo if needed (for XML imports)
  let pcClass = pc.class || pc._draft?.class || ''
  if (!pcClass && pc.classInfo) {
    // Parse "Race Class (Subclass)" format
    const parts = pc.classInfo.trim().split(/\s+/)
    if (parts.length > 1) {
      // Skip first word (race) and take the rest as class
      pcClass = parts.slice(1).join(' ')
    }
  }

  // Build spell slots from PC data
  let spellSlots = null
  if (pc.spellSlots && Array.isArray(pc.spellSlots)) {
    // PC Builder format: array of numbers [3, 0, 0, ...]
    spellSlots = pc.spellSlots
      .map((total, i) => ({ level: i + 1, total: parseInt(total) || 0, used: 0 }))
      .filter(slot => slot.total > 0)
  } else if (pc.slots) {
    // XML format: comma-separated string
    const nums = pc.slots.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
    if (nums.length > 0) spellSlots = nums.map((total, i) => ({ level: i + 1, total, used: 0 }))
  }
  // Build abilities array - try multiple sources
  let abilities
  if (Array.isArray(pc.abilities) && pc.abilities.length === 6) {
    abilities = pc.abilities
  } else if (pc.str !== undefined || pc._draft?.str !== undefined) {
    // Build from individual ability fields (builder format)
    const src = pc._draft || pc
    abilities = [
      String(src.str ?? 10),
      String(src.dex ?? 10),
      String(src.con ?? 10),
      String(src.int ?? 10),
      String(src.wis ?? 10),
      String(src.cha ?? 10)
    ]
  } else {
    abilities = ['10','10','10','10','10','10']
  }

  // Get HP - try multiple sources (PC Builder stores in hpMax)
  const hpMax = parseInt(pc.hpMax ?? pc.hpValue ?? pc._draft?.hpValue ?? pc._draft?.hpMax) || 1
  const hpCurrent = parseInt(pc.hpCurrent ?? pc.hpValue ?? pc._draft?.hpValue ?? pc._draft?.hpMax ?? hpMax) || hpMax

  // Get AC - PC Builder stores in acValue, XML imports use ac
  const ac = parseInt(pc.acValue ?? pc.ac ?? pc._draft?.acValue ?? pc._draft?.ac) || undefined

  const pcTraits = (pc.traits || []).map(t => {
    // Copy charges/chargesCurrent directly if present (PC Builder format)
    let charges = t.charges ?? null
    let chargesCurrent = t.chargesCurrent ?? null
    let recharge = t.recharge ?? null

    // Fall back to limitedUsage if charges not present
    if (charges === null && t.limitedUsage) {
      const lu = t.limitedUsage
      if (lu.type === 'per_day' || lu.type === 'charges') {
        charges = lu.count || null
        chargesCurrent = lu.count || null
      }
      if (lu.type === 'recharge_5_6') recharge = 5
      else if (lu.type === 'recharge_6') recharge = 6
      else if (lu.type?.startsWith('recharge_')) {
        const match = lu.type.match(/recharge_(\d+)/)
        if (match) recharge = parseInt(match[1])
      }
    }

    // Final fallback: parse from name
    if (charges === null && recharge === null) {
      const inferred = parseUsesFromName(t.name)
      charges = inferred.charges ?? null
      recharge = inferred.recharge ?? null
      chargesCurrent = chargesCurrent ?? charges
    }

    // Normalize field name: PC traits may have .desc (PC builder) or .text (XML import)
    // Combatant card renderer expects .text
    return { ...t, text: t.text || t.desc || '', charges, recharge, chargesCurrent }
  })

  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name: pc.label || pc.name,
    type: pc.race || pc.type || 'Humanoid',
    race: pc.race || pc.type || 'Humanoid',
    class: pcClass,
    subclass: pc.subclass || pc._draft?.subclass || '',
    size: pc.size || '',
    isPC: true,
    isEnemy: false,
    level: pc.level || 1,
    initiative: 0,
    ac: ac,
    speed: pc.speed,
    hpMax: hpMax,
    hpCurrent: hpCurrent,
    str: parseInt(abilities[0]) || 10,
    dex: parseInt(abilities[1]) || 10,
    con: parseInt(abilities[2]) || 10,
    int: parseInt(abilities[3]) || 10,
    wis: parseInt(abilities[4]) || 10,
    cha: parseInt(abilities[5]) || 10,
    conditions: [],
    abilities: abilities,
    traits: pcTraits,
    actions: (pc.actions || []).map(a => {
      // Copy charges/chargesCurrent directly if present (PC Builder format)
      let charges = a.charges ?? null
      let chargesCurrent = a.chargesCurrent ?? null
      let recharge = a.recharge ?? null

      // Fall back to limitedUsage if charges not present
      if (charges === null && a.limitedUsage) {
        const lu = a.limitedUsage
        if (lu.type === 'per_day' || lu.type === 'charges') {
          charges = lu.count || null
          chargesCurrent = lu.count || null
        }
        if (lu.type === 'recharge_5_6') recharge = 5
        else if (lu.type === 'recharge_6') recharge = 6
        else if (lu.type?.startsWith('recharge_')) {
          const match = lu.type.match(/recharge_(\d+)/)
          if (match) recharge = parseInt(match[1])
        }
      }

      // Final fallback: parse from name
      if (charges === null && recharge === null) {
        const inferred = parseUsesFromName(a.name)
        charges = inferred.charges ?? null
        recharge = inferred.recharge ?? null
        chargesCurrent = chargesCurrent ?? charges
      }

      return { name: a.name, text: a.text, charges, chargesCurrent, recharge }
    }),
    spellSlots,
    dailySpells: parseDailySpells(pcTraits),
    spells: pc.spells || [],
    selectedSpells: pc.selectedSpells || [],
    spellcastingType: pc.spellcastingType || null,
    spellAttackMod: pc.spellAttackMod ?? null,
    spellSaveDC: pc.spellSaveDC ?? null,
    portrait: pc.portrait || null,
    notes: pc.notes || [],
    skills: pc.skills || [],
    savingThrows: pc.savingThrows || [],
    senses: pc.senses || '',
    languages: pc.languages || '',
    passive: pc.passive || '',
    passiveInsight: pc.passiveInsight ?? null,
    passiveInvestigation: pc.passiveInvestigation ?? null,
  })
  refreshInitSidebar()
  refreshCards()
}

function addFromNPC(uid) {
  const npc = compendiumData.npcs.find(p => p.uid === uid)
  if (!npc) return
  let spellSlots = null
  if (npc.slots) {
    const nums = npc.slots.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
    if (nums.length > 0) spellSlots = nums.map((total, i) => ({ level: i + 1, total, used: 0 }))
  }
  const npcTraits = (npc.traits || []).map(t => {
    const inferred = (t.charges === null && t.recharge === null) ? parseUsesFromName(t.name) : {}
    const charges = t.charges !== null ? t.charges : (inferred.charges ?? null)
    const recharge = t.recharge !== null ? t.recharge : (inferred.recharge ?? null)
    return { ...t, charges, recharge, chargesCurrent: charges !== null ? charges : null }
  })
  const initRoll = Math.floor(Math.random() * 20) + 1
  const abilities = Array.isArray(npc.abilities) ? npc.abilities : [10,10,10,10,10,10]

  // Convert NPC spell name strings to full spell objects
  const selectedSpells = (npc.spells || []).map(s => {
    if (typeof s === 'string') {
      // Look up full spell object from compendium
      const fullSpell = compendiumData.spells.find(sp => sp.name === s)
      if (fullSpell) {
        const spell = {
          name: fullSpell.name,
          level: fullSpell.level,
          text: fullSpell.text || fullSpell.desc || '',
          time: fullSpell.time || '',
          range: fullSpell.range || '',
          duration: fullSpell.duration || ''
        }
        // For cantrips, mark as at-will; for leveled spells, use spell slots (no extra fields needed)
        if (fullSpell.level === '0') {
          spell.atWill = true
        }
        return spell
      } else {
        return { name: s, level: '0', atWill: true, text: '' }
      }
    }
    return s // Already an object, use as-is
  })

  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name: npc.label || npc.name,
    type: npc.type || 'Humanoid',
    size: npc.size || '',
    isPC: false,
    isEnemy: true,
    cr: npc.cr || '0',
    initiative: initRoll,
    ac: npc.ac,
    speed: npc.speed,
    hpMax: parseInt(npc.hpMax) || 1,
    hpCurrent: parseInt(npc.hpCurrent) || parseInt(npc.hpMax) || 1,
    str: parseInt(abilities[0]) || parseInt(npc.str) || 10,
    dex: parseInt(abilities[1]) || parseInt(npc.dex) || 10,
    con: parseInt(abilities[2]) || parseInt(npc.con) || 10,
    int: parseInt(abilities[3]) || parseInt(npc.int) || 10,
    wis: parseInt(abilities[4]) || parseInt(npc.wis) || 10,
    cha: parseInt(abilities[5]) || parseInt(npc.cha) || 10,
    conditions: [],
    traits: npcTraits,
    actions: (npc.actions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return {
        ...a,
        charges,
        recharge,
        chargesCurrent: charges !== null ? charges : null
      }
    }),
    spellSlots,
    dailySpells: parseDailySpells(npcTraits),
    spells: npc.spells || [],
    selectedSpells: selectedSpells,
    portrait: npc.portrait || npc._draft?.portrait || null,
    notes: npc.notes || [],
    skills: npc.skills || [],
    savingThrows: npc.savingThrows || [],
    senses: npc.senses || '',
    languages: npc.languages || '',
  })
  showToast(`${npc.label || npc.name} added — initiative: ${initRoll}`)
  refreshInitSidebar()
  refreshCards()
}

// Index-based functions to avoid quote escaping issues
function showMonsterChoiceByIndex(idx) {
  const filtered = enc.filteredMonsters || compendiumData.monsters.slice(0, 40)
  const m = filtered[idx]
  if (!m) return
  // Hide all other open choices
  document.querySelectorAll('[id^="monster-choice-"]').forEach(el => {
    el.style.display = 'none'
  })
  // Show this choice
  const choice = document.getElementById(`monster-choice-${idx}`)
  if (choice) {
    choice.style.display = choice.style.display === 'none' ? 'block' : 'none'
  }
}

function addMonsterAsIsByIndex(idx) {
  const filtered = enc.filteredMonsters || compendiumData.monsters.slice(0, 40)
  const m = filtered[idx]
  if (!m) return
  addMonsterAsIs(m.name)
}

function modifyMonsterByIndex(idx) {
  const filtered = enc.filteredMonsters || compendiumData.monsters.slice(0, 40)
  const m = filtered[idx]
  if (!m) return
  modifyMonster(m.name)
}

// Legacy function - keep for backwards compatibility
function showMonsterChoice(name) {
  // Hide all other open choices
  document.querySelectorAll('[id^="monster-choice-"]').forEach(el => {
    el.style.display = 'none'
  })
  // Show this choice
  const safeId = name.replace(/[^a-zA-Z0-9]/g, '-')
  const choice = document.getElementById(`monster-choice-${safeId}`)
  if (choice) {
    choice.style.display = choice.style.display === 'none' ? 'block' : 'none'
  }
}

function addMonsterAsIs(name) {
  const m = compendiumData.monsters.find(x => x.name === name)
  if (!m) return
  const hpNum = parseInt(m.hp) || 10
  let spellSlots = null
  if (m.slots) {
    const nums = m.slots.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
    if (nums.length > 0) spellSlots = nums.map((total, i) => ({ level: i + 1, total, used: 0 }))
  }
  const initRoll = Math.floor(Math.random() * 20) + 1
  const traits = (m.traits || []).map(t => {
    const inferred = (t.charges === null && t.recharge === null) ? parseUsesFromName(t.name) : {}
    const charges = t.charges !== null ? t.charges : (inferred.charges ?? null)
    const recharge = t.recharge !== null ? t.recharge : (inferred.recharge ?? null)
    return { ...t, charges, recharge, chargesCurrent: charges !== null ? charges : null }
  })
  // Build abilities array for consistency with PCs/NPCs
  const abilities = [
    String(parseInt(m.str) || 10),
    String(parseInt(m.dex) || 10),
    String(parseInt(m.con) || 10),
    String(parseInt(m.int) || 10),
    String(parseInt(m.wis) || 10),
    String(parseInt(m.cha) || 10)
  ]

  // Enrich selectedSpells with full spell data from compendium
  const rawSelectedSpells = m.selectedSpells || m._draft?.selectedSpells || parseMonsterSpells(m.spells, traits, m.actions) || []
  const selectedSpells = rawSelectedSpells.map(spell => {
    const fullSpell = compendiumData.spells.find(sp => sp.name === spell.name)
    const enriched = {
      ...(fullSpell || {}),
      ...spell,
      text: fullSpell?.text || fullSpell?.desc || spell.text || '',
      time: fullSpell?.time || spell.time || '',
      range: fullSpell?.range || spell.range || '',
      duration: fullSpell?.duration || spell.duration || ''
    }

    // Convert monster builder format to rendering format
    if (spell.usage === 'atwill') {
      enriched.atWill = true
      delete enriched.usage
      delete enriched.dailyCount
    } else if (spell.usage === 'daily') {
      enriched.usesMax = spell.dailyCount || 1
      enriched.usesCurrent = spell.dailyCount || 1
      enriched.perDay = true
      delete enriched.usage
      delete enriched.dailyCount
    } else if (spell.usage === 'slot') {
      // Slot-based spells don't need special tracking fields
      delete enriched.usage
      delete enriched.dailyCount
    }

    return enriched
  })

  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name: m.name,
    type: m.type || 'Humanoid',
    size: m.size || '',
    isPC: false,
    isEnemy: true,
    cr: m.cr || '0',
    initiative: initRoll,
    ac: m.ac,
    speed: m.speed,
    hpMax: hpNum,
    hpCurrent: hpNum,
    str: parseInt(m.str) || 10,
    dex: parseInt(m.dex) || 10,
    con: parseInt(m.con) || 10,
    int: parseInt(m.int) || 10,
    wis: parseInt(m.wis) || 10,
    cha: parseInt(m.cha) || 10,
    abilities: abilities,
    conditions: [],
    traits,
    actions: (m.actions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    }),
    bonusActions: (m.bonusActions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    }),
    reactions: (m.reactions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    }),
    legendaryActions: (m.legendaryActions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    }),
    lairs: (m.lairActions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    }),
    spellSlots,
    dailySpells: parseDailySpells(traits),
    spells: parseMonsterSpells(m.spells, traits, m.actions),
    selectedSpells: selectedSpells,
    portrait: m.portrait || null,
    skills: m.skill || m.skills || '',
    savingThrows: m.save || m.savingThrows || '',
    senses: m.senses || '',
    languages: m.languages || '',
  })
  showToast(`${m.name} added — initiative: ${initRoll}`)
  refreshInitSidebar()
  refreshCards()
}

function modifyMonster(name) {
  const m = compendiumData.monsters.find(x => x.name === name)
  if (!m) return

  // Store encounter context for return
  window.encounterContext = {
    returnToEncounter: true,
    currentEncounter: enc.current
  }

  // Set encounter-only mode BEFORE opening the builder
  window.mb = window.mb || {}
  window.mb.encounterOnlyMode = true

  // Open monster builder with this monster
  if (typeof openMonsterBuilder === 'function') {
    openMonsterBuilder(name)
  } else {
    console.error('openMonsterBuilder not available')
  }
}

function addCustomCombatant() {
  const nameEl = document.getElementById('custom-name')
  const hpEl   = document.getElementById('custom-hp')
  const acEl   = document.getElementById('custom-ac')
  const name = nameEl?.value.trim()
  if (!name) { showToast('Enter a name for the custom combatant'); return }
  const hp = parseInt(hpEl?.value) || 10
  const ac = acEl?.value.trim() || '10'
  const initRoll = Math.floor(Math.random() * 20) + 1
  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name, type: 'Custom', initiative: initRoll,
    ac, speed: '', hpMax: hp, hpCurrent: hp,
    conditions: [], traits: [], actions: [], spellSlots: null, dailySpells: null,
  })
  if (nameEl) nameEl.value = ''
  if (hpEl)   hpEl.value = ''
  if (acEl)   acEl.value = ''
  showToast(`${name} added — initiative: ${initRoll}`)
  refreshInitSidebar()
  refreshCards()
}

function toggleAllyEnemy(uid) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || c.isPC) return
  c.isEnemy = !c.isEnemy
  refreshCards()
}

function removeCombatant(uid) {
  if (!enc.current) return
  confirmDelete('Remove from encounter?', () => {
    enc.current.combatants = enc.current.combatants.filter(c => c.uid !== uid)
    if (enc.inCombat) {
      const count = enc.current.combatants.length
      if (count === 0) { endCombat(); return }
      if (enc.turn >= count) enc.turn = 0
    }
    refreshInitSidebar()
    refreshCards()
  })
}

function setInit(uid, value) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (c) c.initiative = parseInt(value) || 0
  refreshInitSidebar()
}

function applyDamage(uid) {
  const input  = document.getElementById('hp-input-' + uid)
  const amount = parseInt(input?.value)
  if (isNaN(amount) || amount <= 0) return
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c) return
  c.hpCurrent = Math.max(0, c.hpCurrent - amount)
  if (input) input.value = ''
  refreshInitSidebar()
  refreshCards()
}

function applyHeal(uid) {
  const input  = document.getElementById('hp-input-' + uid)
  const amount = parseInt(input?.value)
  if (isNaN(amount) || amount <= 0) return
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c) return
  c.hpCurrent = Math.min(c.hpMax, c.hpCurrent + amount)
  if (input) input.value = ''
  refreshInitSidebar()
  refreshCards()
}

function toggleCondition(uid, condition) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c) return
  const idx = c.conditions.indexOf(condition)
  if (idx === -1) c.conditions.push(condition)
  else c.conditions.splice(idx, 1)
  refreshCards()
}

function removeCondition(uid, condition) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c) return
  c.conditions = c.conditions.filter(x => x !== condition)
  refreshCards()
}

function addCondFromDrop(uid, condition) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || c.conditions.includes(condition)) return
  c.conditions.push(condition)
  refreshCards()
}

function toggleCondDropdown(uid) {
  // Close any other open dropdowns first
  document.querySelectorAll('[id^="cond-drop-"]').forEach(d => {
    if (d.id !== `cond-drop-${uid}`) d.style.display = 'none'
  })
  const drop = document.getElementById(`cond-drop-${uid}`)
  if (!drop) return
  const wasOpen = drop.style.display !== 'none'
  if (wasOpen) { drop.style.display = 'none'; return }
  drop.style.display = 'block'
  setTimeout(() => {
    const handler = e => {
      if (!drop.contains(e.target)) {
        drop.style.display = 'none'
        document.removeEventListener('click', handler)
      }
    }
    document.addEventListener('click', handler)
  }, 0)
}

function adjustCharge(uid, section, index, delta) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c) return
  const items = c[section]
  if (!items || !items[index]) return
  const item = items[index]
  if (item.charges !== null) {
    item.chargesCurrent = Math.max(0, Math.min(item.charges, (item.chargesCurrent || 0) + delta))
  }
  refreshCards()
}

function toggleSlot(uid, slotIndex, pipIndex) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || !c.spellSlots) return
  const slot = c.spellSlots[slotIndex]
  if (!slot) return
  const avail = slot.total - slot.used
  if (pipIndex < avail) slot.used = Math.min(slot.total, slot.used + 1)
  else slot.used = Math.max(0, slot.used - 1)
  refreshCards()
}

function adjustSlot(uid, slotIdx, delta) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || !c.spellSlots) return
  const slot = c.spellSlots[slotIdx]
  if (!slot) return
  slot.used = Math.max(0, Math.min(slot.total, slot.used + delta))
  refreshCards()
}

function adjustCombatantSpellUse(uid, spellName, delta) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || !c.selectedSpells) return
  const spell = c.selectedSpells.find(s => s.name === spellName)
  if (!spell || spell.usesMax == null) return
  spell.usesCurrent = Math.max(0, Math.min(spell.usesMax, spell.usesCurrent + delta))
  refreshCards()
}

function adjustDailySpell(uid, groupIdx, spellIdx, delta) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || !c.dailySpells) return
  const grp = c.dailySpells[groupIdx]
  if (!grp || !grp.tracked) return
  const spell = grp.spells[spellIdx]
  if (!spell) return
  spell.used = Math.max(0, Math.min(spell.total, spell.used + delta))
  refreshCards()
}

function parseDailySpells(traits) {
  const groups = []
  for (const t of (traits || [])) {
    if (!/spellcast|innate/i.test(t.name || '')) continue
    const lines = (t.text || '').split('\n')
    for (const raw of lines) {
      const line = raw.trim()
      // Skip bullet-point lines (traditional slot listings) and cantrip at-will lines
      if (/^[•\-]/.test(line)) continue
      if (/^cantrips?\s*\(/i.test(line)) continue

      const atWill = line.match(/^at will\s*:\s*(.+)/i)
      if (atWill) {
        const names = atWill[1].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
        if (names.length) groups.push({ group: 'at will', tracked: false, spells: names })
        continue
      }

      const dayEach = line.match(/^(\d+)\/day each\s*:\s*(.+)/i)
      if (dayEach) {
        const n = parseInt(dayEach[1])
        const names = dayEach[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
        if (names.length) groups.push({ group: `${n}/day`, tracked: true, spells: names.map(name => ({ name, total: n, used: 0 })) })
        continue
      }

      const day = line.match(/^(\d+)\/day\s*:\s*(.+)/i)
      if (day) {
        const n = parseInt(day[1])
        const names = day[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
        if (names.length) groups.push({ group: `${n}/day`, tracked: true, spells: names.map(name => ({ name, total: n, used: 0 })) })
      }
    }
  }
  return groups.length ? groups : null
}

function parseMonsterSpells(spellsText, traits, actions) {
  const spells = []
  const seen = new Set()

  function addSpell(name, fallbackLevel, tracking) {
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const found = compendiumData.spells.find(s => s.name.toLowerCase() === key)
    const base = found
      ? { ...found }
      : { name, level: fallbackLevel != null ? String(fallbackLevel) : '0', time: '', range: '', duration: '', text: '' }
    spells.push({ ...base, ...tracking })
  }

  function scanLines(text) {
    const lines = (text || '').split('\n')
    for (const raw of lines) {
      const line = raw.trim()
      // Cantrips (at will): fire bolt, light, mage hand
      const cantrip = line.match(/^cantrips?\s*\([^)]*\)\s*:\s*(.+)/i)
      if (cantrip) {
        cantrip[1].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
          .forEach(n => addSpell(n, 0, { atWill: true }))
        continue
      }
      // 1st level (4 slots): detect magic, shield
      const slotted = line.match(/^(\d+)(?:st|nd|rd|th)\s+level\s*\([^)]*\)\s*:\s*(.+)/i)
      if (slotted) {
        const lvl = parseInt(slotted[1])
        slotted[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
          .forEach(n => addSpell(n, lvl, {}))
        continue
      }
      // At will: dancing lights (innate)
      const atWill = line.match(/^at will\s*:\s*(.+)/i)
      if (atWill) {
        atWill[1].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
          .forEach(n => addSpell(n, 0, { atWill: true }))
        continue
      }
      // 3/day each: darkness, faerie fire (innate)
      const dayEach = line.match(/^(\d+)\/day each\s*:\s*(.+)/i)
      if (dayEach) {
        const n = parseInt(dayEach[1])
        dayEach[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
          .forEach(name => addSpell(name, null, { usesMax: n, usesCurrent: n, perDay: true }))
        continue
      }
      // 1/day: misty step (innate)
      const day = line.match(/^(\d+)\/day\s*:\s*(.+)/i)
      if (day) {
        const n = parseInt(day[1])
        day[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
          .forEach(name => addSpell(name, null, { usesMax: n, usesCurrent: n, perDay: true }))
      }
    }
  }

  // Scan the dedicated spells text field (most monsters store it here)
  if (spellsText) scanLines(spellsText)

  // Scan traits named "Spellcasting" / "Innate Spellcasting" (older format)
  for (const t of (traits || [])) {
    if (!/spellcast|innate/i.test(t.name || '')) continue
    scanLines(t.text)
  }

  // Scan actions named "Spellcasting" / "Innate Spellcasting" (2024 format)
  for (const a of (actions || [])) {
    if (!/spellcast|innate/i.test(a.name || '')) continue
    scanLines(a.text)
  }

  return spells.length ? spells : null
}

// ── Save Encounter ────────────────────────────────────────────────
function saveEncounterPrompt() {
  if (!enc.current) return
  const campaign = compendiumData.activeCampaign
  if (!campaign) { showToast('Load a campaign first'); return }
  // Sync name from topbar input before saving (prompt() is not available in Electron)
  const nameInput = document.getElementById('enc-name-input')
  if (nameInput && nameInput.value.trim()) enc.current.name = nameInput.value.trim()
  if (!enc.list[campaign]) enc.list[campaign] = []
  const saved = { id: enc.current.id, name: enc.current.name, combatants: JSON.parse(JSON.stringify(enc.current.combatants)) }

  // Save combat state if in combat
  if (enc.inCombat) {
    saved.combatState = {
      inCombat: true,
      turn: enc.turn,
      round: enc.round,
      combatants: enc.current.combatants.map(c => ({
        uid: c.uid,
        hpCurrent: c.hpCurrent,
        hpMax: c.hpMax,
        initiative: c.initiative,
        conditions: [...c.conditions],
        isEnemy: c.isEnemy,
        spellSlots: c.spellSlots ? JSON.parse(JSON.stringify(c.spellSlots)) : null,
        dailySpells: c.dailySpells ? JSON.parse(JSON.stringify(c.dailySpells)) : null,
        spells: c.spells ? JSON.parse(JSON.stringify(c.spells)) : null,
        traits: c.traits ? JSON.parse(JSON.stringify(c.traits)) : null,
        actions: c.actions ? JSON.parse(JSON.stringify(c.actions)) : null,
        reactions: c.reactions ? JSON.parse(JSON.stringify(c.reactions)) : null,
        legendaries: c.legendaries ? JSON.parse(JSON.stringify(c.legendaries)) : null,
        lairs: c.lairs ? JSON.parse(JSON.stringify(c.lairs)) : null
      }))
    }
  } else {
    saved.combatState = null
  }

  const idx = enc.list[campaign].findIndex(e => e.id === enc.current.id)
  if (idx !== -1) enc.list[campaign][idx] = saved
  else enc.list[campaign].push(saved)
  saveEncounters(enc.list)
  showToast(`"${enc.current.name}" saved`)
}

// ── Campaign switch ───────────────────────────────────────────────
function switchCampaign(name) {
  if (!compendiumData.campaigns || !compendiumData.campaigns[name]) return
  const camp = compendiumData.campaigns[name]
  compendiumData.activeCampaign = name
  if (Array.isArray(camp)) {
    compendiumData.players = camp.filter(p => !p.isNPC)
    compendiumData.npcs    = camp.filter(p => p.isNPC)
  } else {
    compendiumData.players = camp.players || []
    compendiumData.npcs = camp.npcs || []
  }

  // Update the campaign selector in nav bar if it exists
  const selector = document.getElementById('campaign-selector')
  if (selector) selector.value = name

  showSection('home')
}

function showNewCampaignForm() {
  const container = document.getElementById('new-campaign-container')
  if (!container) return

  container.innerHTML = `
    <div style="background:#1E231A;border:2px solid #445E22;border-radius:4px;
                padding:8px;display:flex;flex-direction:column;gap:6px;min-width:200px;">
      <input type="text" id="new-campaign-name" placeholder="Campaign Name"
        style="background:#262F35;border:1px solid #445E22;color:#e0d5c5;
               padding:6px 8px;border-radius:3px;font-size:12px;font-family:var(--app-font);
               width:100%;"
        onkeypress="if(event.key==='Enter') createNewCampaign()" />
      <div style="display:flex;gap:6px;">
        <button onclick="createNewCampaign()"
          style="flex:1;background:#1E231A;color:#909090;border:2px solid #445E22;
                 padding:4px 8px;cursor:pointer;border-radius:3px;font-size:11px;
                 font-family:var(--app-font);font-weight:700;"
          onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
          onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
          Create
        </button>
        <button onclick="cancelNewCampaign()"
          style="flex:1;background:none;border:1px solid #2a3a5a;color:#888;
                 padding:4px 8px;cursor:pointer;border-radius:3px;font-size:11px;
                 font-family:var(--app-font);"
          onmouseover="this.style.borderColor='#555';this.style.color='#aaa'"
          onmouseout="this.style.borderColor='#2a3a5a';this.style.color='#888'">
          Cancel
        </button>
      </div>
    </div>
  `

  // Focus the input
  setTimeout(() => {
    const input = document.getElementById('new-campaign-name')
    if (input) input.focus()
  }, 50)
}

function createNewCampaign() {
  const input = document.getElementById('new-campaign-name')
  if (!input) return

  const name = input.value.trim()
  if (!name) {
    showToast('Please enter a campaign name')
    return
  }

  // Check if campaign already exists
  if (compendiumData.campaigns && compendiumData.campaigns[name]) {
    showToast('A campaign with this name already exists')
    return
  }

  // Initialize campaigns object if needed
  if (!compendiumData.campaigns) {
    compendiumData.campaigns = {}
  }

  // Create new campaign with ALL required fields
  compendiumData.campaigns[name] = {
    players: [],
    npcs: [],
    adventures: [],
    encounters: [],
    notes: [],
    treasure: []
  }

  // Set as active campaign
  compendiumData.activeCampaign = name
  compendiumData.players = []
  compendiumData.npcs = []

  // Save to storage
  saveCampaigns(compendiumData.campaigns)

  // Show toast
  showToast(`Campaign "${name}" created`)

  // Close Settings modal
  const settingsModal = document.getElementById('settings-modal')
  if (settingsModal) settingsModal.remove()

  // Re-render to update UI and go to home
  render()
  showSection('home')
}

function cancelNewCampaign() {
  const container = document.getElementById('new-campaign-container')
  if (!container) return

  container.innerHTML = `
    <button onclick="showNewCampaignForm()"
      style="display:block;width:100%;background:#262F35;border:1px solid #2a3a5a;
             color:#e0d5c5;padding:10px 16px;margin-bottom:8px;cursor:pointer;
             font-size:13px;text-align:left;font-family:var(--app-font);
             border-radius:4px;transition:background .15s,border-color .15s;"
      onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
      onmouseout="this.style.background='#262F35';this.style.borderColor='#2a3a5a'">
      + New Campaign
    </button>
  `
}

function showRenameCampaignForm() {
  const container = document.getElementById('campaign-selector-container')
  if (!container || !compendiumData.activeCampaign) return

  const currentName = compendiumData.activeCampaign

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:4px;">
      <input type="text" id="rename-campaign-input" value="${currentName.replace(/"/g, '&quot;')}"
        style="background:#5C5C5C;border:4px solid #2E2F2D;color:#1E231A;
               padding:6px 12px;border-radius:4px;font-size:13px;font-family:var(--app-font);
               min-width:150px;"
        onkeypress="if(event.key==='Enter') confirmRenameCampaign()" />
      <button onclick="confirmRenameCampaign()" title="Confirm"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;
               padding:4px 8px;cursor:pointer;border-radius:3px;font-size:14px;
               line-height:1;font-family:var(--app-font);"
        onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
        onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
        ✓
      </button>
      <button onclick="cancelRenameCampaign()" title="Cancel"
        style="background:none;border:1px solid #2a3a5a;color:#888;
               padding:4px 8px;cursor:pointer;border-radius:3px;font-size:14px;
               line-height:1;font-family:var(--app-font);"
        onmouseover="this.style.borderColor='#555';this.style.color='#aaa'"
        onmouseout="this.style.borderColor='#2a3a5a';this.style.color='#888'">
        ✕
      </button>
    </div>
  `

  // Focus and select the input
  setTimeout(() => {
    const input = document.getElementById('rename-campaign-input')
    if (input) {
      input.focus()
      input.select()
    }
  }, 50)
}

function confirmRenameCampaign() {
  const input = document.getElementById('rename-campaign-input')
  if (!input || !compendiumData.activeCampaign) return

  const oldName = compendiumData.activeCampaign
  const newName = input.value.trim()

  // Validate
  if (!newName) {
    showToast('Please enter a campaign name')
    return
  }

  if (newName === oldName) {
    // No change, just cancel
    cancelRenameCampaign()
    return
  }

  // Check if new name already exists
  if (compendiumData.campaigns && compendiumData.campaigns[newName]) {
    showToast('A campaign with this name already exists')
    return
  }

  // Rename campaign
  if (compendiumData.campaigns && compendiumData.campaigns[oldName]) {
    // Copy campaign data to new name
    compendiumData.campaigns[newName] = compendiumData.campaigns[oldName]

    // Delete old name
    delete compendiumData.campaigns[oldName]

    // Update active campaign
    compendiumData.activeCampaign = newName

    // Update encounters list if it exists
    if (enc.list && enc.list[oldName]) {
      enc.list[newName] = enc.list[oldName]
      delete enc.list[oldName]
      saveEncounters(enc.list)
    }

    // Save to storage
    saveCampaigns(compendiumData.campaigns)

    // Show toast
    showToast(`Campaign renamed to "${newName}"`)

    // Close Settings modal
    const settingsModal = document.getElementById('settings-modal')
    if (settingsModal) settingsModal.remove()

    // Re-render to update UI and go to home
    render()
    showSection('home')
  }
}

function cancelRenameCampaign() {
  // Re-render to restore the dropdown and current screen content
  render()
  showSection('home', true)
}

// ── Monsters ──────────────────────────────────────────────────────
// Monster filter state
let monsterFilters = {
  query: '',
  cr: '',
  type: '',
  homebrew: '',
  thirdParty: '',
  environment: '',
  spellcaster: ''
}

function renderMonsters(container) {
  // Get unique types from actual data, normalized and deduplicated
  const uniqueTypes = [...new Set(compendiumData.monsters
    .map(m => m.type || '')
    .filter(t => {
      // Filter out garbage: empty strings, single chars, special codes like "$"
      if (!t || t.length <= 1) return false
      if (t === '$' || /^[A-Z]{1,3}$/.test(t)) return false
      return true
    })
    .map(t => {
      // Normalize to title case for deduplication (with proper article/preposition handling)
      const lowercase = ['of', 'the', 'a', 'an', 'in', 'from', 'with', 'and', 'or', 'but', 'for', 'to', 'at', 'by', 'on']
      return t.split(' ').map((word, index) => {
        if (!word) return word
        const lower = word.toLowerCase()
        // First word is always capitalized
        if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        // Keep articles/prepositions lowercase
        if (lowercase.includes(lower)) return lower
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }).join(' ')
    })
  )].sort()

  const filterStyle = `background:#1A1C1E;border:1px solid #2E2F2D;color:#e0d5c5;
    font-family:var(--app-font);padding:6px 10px;border-radius:4px;font-size:12px;cursor:pointer;`

  const hasActiveFilters = monsterFilters.query || monsterFilters.cr || monsterFilters.type ||
    monsterFilters.homebrew || monsterFilters.thirdParty || monsterFilters.environment || monsterFilters.spellcaster

  container.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center;">
      <input id="monster-search" type="text" placeholder="Search monsters…" value="${monsterFilters.query}"
        style="flex:1;max-width:500px;padding:8px 12px;background:#5C5C5C;
               border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
               border-radius:4px;font-size:14px;"
        oninput="monsterFilters.query=this.value;applyMonsterFilters()" />
      <button onclick="openMonsterBuilder(null)"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 16px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);
               white-space:nowrap;"
        onmouseover="this.style.borderColor='#4a9a9a';this.style.color='#e0d5c5'"
        onmouseout="this.style.borderColor='#445E22';this.style.color='#909090'">
        + Create Monster
      </button>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <select onchange="monsterFilters.cr=this.value;applyMonsterFilters()" style="${filterStyle}">
        <option value="">All CRs</option>
        ${['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30']
          .map(cr => `<option value="${cr}" ${monsterFilters.cr === cr ? 'selected' : ''}>${cr}</option>`).join('')}
      </select>

      <select onchange="monsterFilters.type=this.value;applyMonsterFilters()" style="${filterStyle}">
        <option value="">All Types</option>
        ${uniqueTypes.map(type => `<option value="${type}" ${monsterFilters.type === type ? 'selected' : ''}>${type}</option>`).join('')}
      </select>

      <select onchange="monsterFilters.environment=this.value;applyMonsterFilters()" style="${filterStyle}">
        <option value="">All Environments</option>
        ${['Arctic','Coastal','Desert','Forest','Grassland','Hill','Mountain','Swamp','Underdark','Underwater','Urban']
          .map(env => `<option value="${env}" ${monsterFilters.environment === env ? 'selected' : ''}>${env}</option>`).join('')}
      </select>

      ${threeStateToggle('homebrew', 'Homebrew')}
      ${threeStateToggle('thirdParty', 'Third Party')}
      ${threeStateToggle('spellcaster', 'Spellcaster')}

      <button id="clear-monster-filters" onclick="clearMonsterFilters()"
        style="background:#5C5C5C;color:#1E231A;border:4px solid #2E2F2D;padding:7px 14px;
               border-radius:4px;font-family:var(--app-font);font-size:13px;font-weight:bold;
               ${hasActiveFilters ? 'cursor:pointer;opacity:1;' : 'cursor:not-allowed;opacity:0.4;pointer-events:none;'}">
        Clear Filters
      </button>
    </div>

    <div id="monster-grid"
      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
    </div>
  `
  applyMonsterFilters()
}

function applyMonsterFilters() {
  let filtered = compendiumData.monsters

  // Text search
  if (monsterFilters.query) {
    const q = monsterFilters.query.toLowerCase()
    filtered = filtered.filter(m => m.name.toLowerCase().includes(q))
  }

  // CR filter
  if (monsterFilters.cr) {
    filtered = filtered.filter(m => m.cr === monsterFilters.cr)
  }

  // Type filter (partial match for subtypes)
  if (monsterFilters.type) {
    filtered = filtered.filter(m => {
      const type = (m.type || '').toLowerCase()
      return type.includes(monsterFilters.type.toLowerCase())
    })
  }

  // Homebrew and Third Party filters (OR logic when both active)
  const homebrewActive = monsterFilters.homebrew === 'homebrew'
  const homebrewExclude = monsterFilters.homebrew === 'non-homebrew'
  const thirdPartyActive = monsterFilters.thirdParty === 'third-party'
  const thirdPartyExclude = monsterFilters.thirdParty === 'non-third-party'

  if (homebrewActive && thirdPartyActive) {
    // Both active: show entries that are EITHER homebrew OR third party
    filtered = filtered.filter(m => (m._draft?.homebrew || m.homebrew) || (m._draft?.thirdParty || m.thirdParty))
  } else if (homebrewActive) {
    // Only homebrew active
    filtered = filtered.filter(m => m._draft?.homebrew || m.homebrew)
  } else if (thirdPartyActive) {
    // Only third party active
    filtered = filtered.filter(m => m._draft?.thirdParty || m.thirdParty)
  } else if (homebrewExclude && thirdPartyExclude) {
    // Both exclude: show entries that are NEITHER homebrew NOR third party
    filtered = filtered.filter(m => !(m._draft?.homebrew || m.homebrew) && !(m._draft?.thirdParty || m.thirdParty))
  } else if (homebrewExclude) {
    // Only homebrew exclude
    filtered = filtered.filter(m => !(m._draft?.homebrew || m.homebrew))
  } else if (thirdPartyExclude) {
    // Only third party exclude
    filtered = filtered.filter(m => !(m._draft?.thirdParty || m.thirdParty))
  }

  // Environment filter
  if (monsterFilters.environment) {
    filtered = filtered.filter(m => {
      const envs = m.environments || m.environment
      if (!envs) return false
      if (Array.isArray(envs)) {
        return envs.includes(monsterFilters.environment)
      }
      return (envs || '').includes(monsterFilters.environment)
    })
  }

  // Spellcaster filter
  if (monsterFilters.spellcaster === 'spellcaster') {
    filtered = filtered.filter(m => {
      // Has spells array
      if (m.spells && m.spells.length > 0) return true
      // Has spell slots
      if (m.slots && m.slots.split(',').some(s => parseInt(s) > 0)) return true
      // Has Spellcasting trait/action
      const hasSpellcastingTrait = (m.traits || []).some(t => /spellcast/i.test(t.name))
      const hasSpellcastingAction = (m.actions || []).some(a => /spellcast/i.test(a.name))
      return hasSpellcastingTrait || hasSpellcastingAction
    })
  } else if (monsterFilters.spellcaster === 'non-spellcaster') {
    filtered = filtered.filter(m => {
      if (m.spells && m.spells.length > 0) return false
      if (m.slots && m.slots.split(',').some(s => parseInt(s) > 0)) return false
      const hasSpellcastingTrait = (m.traits || []).some(t => /spellcast/i.test(t.name))
      const hasSpellcastingAction = (m.actions || []).some(a => /spellcast/i.test(a.name))
      return !hasSpellcastingTrait && !hasSpellcastingAction
    })
  }

  renderMonsterGrid(filtered)

  // Update Clear Filters button state dynamically
  const clearBtn = document.getElementById('clear-monster-filters')
  if (clearBtn) {
    const hasActive = monsterFilters.query || monsterFilters.cr ||
      monsterFilters.type || monsterFilters.homebrew ||
      monsterFilters.thirdParty || monsterFilters.environment ||
      monsterFilters.spellcaster
    clearBtn.style.opacity = hasActive ? '1' : '0.4'
    clearBtn.style.pointerEvents = hasActive ? 'auto' : 'none'
    clearBtn.style.cursor = hasActive ? 'pointer' : 'not-allowed'
  }
}

function clearMonsterFilters() {
  monsterFilters = {
    query: '',
    cr: '',
    type: '',
    homebrew: '',
    thirdParty: '',
    environment: '',
    spellcaster: ''
  }
  const searchInput = document.getElementById('monster-search')
  if (searchInput) searchInput.value = ''
  renderMonsters(document.getElementById('content'))
}
// Ensure function is accessible from inline onclick handlers
window.clearMonsterFilters = clearMonsterFilters

function filterMonsters(query) {
  // Legacy function - now redirects to new filter system
  monsterFilters.query = query
  applyMonsterFilters()
}

function renderMonsterGrid(monsters) {
  const grid = document.getElementById('monster-grid')
  if (!grid) return
  if (compendiumData.monsters.length === 0) {
    grid.innerHTML = '<p style="color:#e0d5c5;grid-column:1/-1;">No monsters loaded. Import your compendium data or create a new monster now!</p>'
    return
  }
  if (monsters.length === 0) {
    grid.innerHTML = '<p style="color:#555;grid-column:1/-1;">No monsters match that search.</p>'
    return
  }
  grid.innerHTML = monsters.map(m => {
    const displaySize = expandSize(m.size)
    const isHomebrew = m._draft?.homebrew || m.homebrew
    const isThirdParty = m._draft?.thirdParty || m.thirdParty
    return `
    <div onclick="showMonster(decodeURIComponent(this.dataset.name))" data-name="${encodeURIComponent(m.name)}"
      style="background:#262F35;border:1px solid #1e2d4a;padding:12px;border-radius:4px;cursor:pointer;"
      onmouseover="this.style.borderColor='#4a9a9a'" onmouseout="this.style.borderColor='#1e2d4a'">
      <div style="font-weight:bold;margin-bottom:4px;color:#7B9BA8;">
        ${m.name}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">
        ${isHomebrew ? `<span style="background:#4a9a9a;color:#e0d5c5;font-size:9px;
          padding:2px 5px;border-radius:2px;letter-spacing:.06em;font-weight:700;">HOMEBREW</span>` : ''}
        ${isThirdParty ? `<span style="background:#3a5a7a;color:#e0d5c5;font-size:9px;
          padding:2px 5px;border-radius:2px;letter-spacing:.06em;font-weight:700;">3RD PARTY</span>` : ''}
      </div>
      <div style="font-size:12px;color:#C8C8C8;">CR ${m.cr || '—'} · ${displaySize} ${m.type}</div>
    </div>
  `}).join('')
}

function showMonster(name, skipHistory = false) {
  const m = compendiumData.monsters.find(x => x.name === name)
  if (!m) return
  if (!skipHistory) pushNav('monster-detail', name)
  else currentScreen = { screen: 'monster-detail', uid: name }

  const content = document.getElementById('content')
  content.style.padding = '20px 20px 20px 260px'
  content.style.overflow = 'auto'
  content.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
      <button onclick="popNav()"
        style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        &#8592; Back
      </button>
      <button onclick="openMonsterBuilder(decodeURIComponent(this.dataset.name))" data-name="${encodeURIComponent(m.name)}"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 16px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        &#9998; Edit
      </button>
    </div>
    ${buildMonsterDetailCard(m)}
  `
  content.scrollTop = 0
}

function buildMonsterDetailCard(m) {
  function mod(s) { const n = Math.floor(((parseInt(s)||10)-10)/2); return n>=0?`+${n}`:String(n) }
  function sline(label, val) {
    if (!val && val !== 0) return ''
    return `<div style="font-size:13px;line-height:1.6;margin-bottom:3px;">
      <strong style="color:#c9a87c;">${label}</strong> ${val}</div>`
  }
  function formatCR(cr) {
    if (!cr) return ''
    const entry = window.MB_CR_TABLE?.find(e => e.cr === String(cr))
    return entry ? `${cr} (${entry.xp.toLocaleString()} XP)` : cr
  }
  function absec(title, items) {
    if (!items || !items.length) return ''
    return `<div style="margin-top:14px;">
      <div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">${title}</div>
      ${items.map(it => `<div style="margin-bottom:12px;font-size:13px;line-height:1.6;">
        ${it.name ? `<strong style="font-size:14.5px;color:#7B9BA8;">${it.name}.</strong> ` : ''}${renderMarkdown(it.text||'')}</div>`).join('')}
    </div>`
  }
  const abs = [['STR','str'],['DEX','dex'],['CON','con'],['INT','int'],['WIS','wis'],['CHA','cha']]
  // Check for homebrew/third-party flags from _draft or direct properties
  const isHomebrew = m._draft?.homebrew || m.homebrew
  const isThirdParty = m._draft?.thirdParty || m.thirdParty

  return `
    <div style="background:#262F35;border:none;border-radius:6px;
                padding:20px;max-width:840px;font-family:var(--app-font);color:#e0d5c5;">
      <div style="position:relative;margin-bottom:8px;padding-bottom:${m.portrait ? '12px' : '0'};">
        ${m.portrait ? `
          <img src="${m.portrait}" style="position:absolute;top:0;right:0;width:60px;height:60px;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;${m.portrait ? 'padding-right:70px;' : ''}">
          <div style="font-size:22px;font-weight:bold;color:#7B9BA8;">${m.name}</div>
          ${isHomebrew ? `<span style="background:#4a9a9a;color:#e0d5c5;font-size:10px;
            padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:700;">HOMEBREW</span>` : ''}
          ${isThirdParty ? `<span style="background:#3a5a7a;color:#e0d5c5;font-size:10px;
            padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:700;">3RD PARTY</span>` : ''}
        </div>
        <div style="font-size:13px;color:#888;font-style:italic;">
          ${(() => {
            const typeWithTag = m.tag && m.tag !== 'undefined' && m.tag !== ''
              ? `${m.type} (${m.tag})`
              : m.type
            return [expandSize(m.size), typeWithTag, m.alignment].filter(Boolean).join(' · ')
          })()}
        </div>
      </div>
      <div style="border-top:2px solid #1A1C1E;margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">ARMOR CLASS</div>
          <div style="font-size:20px;font-weight:bold;">${parseInt(m.ac) || m.ac || '—'}</div>
          ${(() => {
            const armorType = m.armor || (m.ac ? String(m.ac).match(/\(([^)]+)\)/)?.[1] : '')
            return armorType ? `<div style="font-size:10px;color:#888888;margin-top:2px;">${armorType}</div>` : ''
          })()}
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">HIT POINTS</div>
          <div style="font-size:20px;font-weight:bold;">${m.hp||'—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">SPEED</div>
          <div style="font-size:16px;font-weight:bold;">${m.speed||'—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">INITIATIVE</div>
          <div style="font-size:20px;font-weight:bold;">${(() => {
            const dex = parseInt(m.dex) || 10
            const initMod = Math.floor((dex - 10) / 2)
            return initMod >= 0 ? '+' + initMod : initMod
          })()}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
        ${abs.map(([l,k]) => `
          <div style="background:#1A1C1E;padding:8px 4px;border-radius:4px;text-align:center;">
            <div style="font-size:11px;color:#4a9a9a;letter-spacing:.06em;
                        font-weight:700;margin-bottom:4px;">${l}</div>
            <div style="font-size:18px;font-weight:bold;">${m[k]||10}</div>
            <div style="font-size:12px;color:#888;">${mod(m[k]||10)}</div>
          </div>`).join('')}
      </div>
      <div style="border-top:1px solid #1A1C1E;margin-bottom:10px;"></div>
      ${sline('Skills', m.skill ? m.skill.split(',').map(s => s.trim()).sort().join(', ') : '')}
      ${sline('Saving Throws', m.save)}
      ${sline('Damage Immunities', m.immune)}
      ${sline('Resistances', m.resist)}
      ${sline('Vulnerabilities', m.vulnerable)}
      ${sline('Condition Immunities', m.conditionImmune)}
      ${sline('Senses', m.senses)}
      ${sline('Passive Perception', m.passive)}
      ${sline('Languages', m.languages)}
      ${sline('Challenge', formatCR(m.cr))}
      ${(() => {
        const cr = parseFloat(m.cr) || 0
        const profBonus = m.proficiencyBonus || (
          cr <= 4 ? 2 : cr <= 8 ? 3 : cr <= 12 ? 4 : cr <= 16 ? 5 :
          cr <= 20 ? 6 : cr <= 24 ? 7 : cr <= 28 ? 8 : 9
        )
        return sline('Proficiency Bonus', `+${profBonus}`)
      })()}
      ${(m.tag && m.tag !== 'undefined' && m.tag !== '') ? sline('Tag', m.tag) : ''}
      ${m.source ? sline('Source', m.source) : ''}
      ${absec('TRAITS', m.traits)}
      ${absec('ACTIONS', m.actions)}
      ${absec('BONUS ACTIONS', m.bonusActions)}
      ${absec('REACTIONS', m.reactions)}
      ${absec('LEGENDARY ACTIONS', m.legendaryActions)}
      ${absec('LAIR ACTIONS', m.lairActions)}
      ${(() => {
        // Get spells from _draft if available, otherwise parse from spellcasting trait/action
        let spells = m._draft?.selectedSpells || []
        if (!spells.length && typeof window.mbFromCompendium === 'function') {
          // For XML monsters without _draft, parse spells the same way the Monster Builder does
          const draft = window.mbFromCompendium(m)
          spells = draft.selectedSpells || []
        }
        if (!spells.length) return ''

        function renderSpell(sp, prefix = '') {
          const fullSpell = compendiumData.spells.find(s => s.name === sp.name)
          if (!fullSpell) return `<div style="padding:6px 8px;font-size:13px;color:#888;">${prefix}${sp.name}</div>`
          const id = 'mspell-' + sp.name.replace(/[^a-zA-Z0-9]/g, '-') + '-' + Math.random().toString(36).slice(2, 7)
          return `
            <div style="margin-bottom:4px;">
              <div onclick="const d=document.getElementById('${id}');d.style.display=d.style.display==='none'?'block':'none'"
                style="background:#0f3460;padding:10px 14px;border-radius:4px;cursor:pointer;
                       display:flex;justify-content:space-between;align-items:center;"
                onmouseover="this.style.background='#1a4a8a'"
                onmouseout="this.style.background='#0f3460'">
                <span style="font-size:13px;color:#e0d5c5;">${prefix}${sp.name}</span>
                <span style="font-size:11px;color:#888;background:#1A1C1E;padding:2px 8px;border-radius:3px;min-width:24px;text-align:center;">
                  ${(fullSpell.level === '0' || fullSpell.level === 0 || !fullSpell.level) ? 'C' : fullSpell.level}
                </span>
              </div>
              <div id="${id}"
                style="display:none;background:#1A1C1E;padding:12px;border-radius:0 0 4px 4px;
                       border:1px solid #0f3460;border-top:none;">
                <div style="font-size:12px;color:#666;margin-bottom:6px;">
                  ${(fullSpell.level === '0' || fullSpell.level === 0 || !fullSpell.level) ? 'C' : 'Level ' + fullSpell.level}
                  ${fullSpell.time ? ` · ${fullSpell.time}` : ''}
                  ${fullSpell.range ? ` · ${fullSpell.range}` : ''}
                  ${fullSpell.duration ? ` · ${fullSpell.duration}` : ''}
                </div>
                <div style="font-size:13px;white-space:pre-wrap;color:#bbb;line-height:1.6;">${renderMarkdown(fullSpell.text || '')}</div>
              </div>
            </div>`
        }

        // Sort helper: by level then alphabetically
        const sortSpells = (arr) => arr.sort((a, b) => {
          const aLevel = parseInt(a.level) || 0
          const bLevel = parseInt(b.level) || 0
          if (aLevel !== bLevel) return aLevel - bLevel
          return a.name.localeCompare(b.name)
        })

        const atWill = sortSpells(spells.filter(s => s.usage === 'atwill'))
        const daily = sortSpells(spells.filter(s => s.usage === 'daily'))
        const slot = sortSpells(spells.filter(s => s.usage === 'slot'))

        // Get spell slots from _draft or parse from compendium
        let spellSlots = m._draft?.spellSlots
        if (!spellSlots && typeof window.mbFromCompendium === 'function') {
          const draft = window.mbFromCompendium(m)
          spellSlots = draft.spellSlots
        }

        const spellSaveDC = m._draft?.spellSaveDC || m.spellSaveDC
        const spellAttackMod = m._draft?.spellAttackMod || m.spellAttackMod
        const spellInfo = []
        if (spellSaveDC) spellInfo.push('Spell Save DC ' + spellSaveDC)
        if (spellAttackMod) spellInfo.push('+' + spellAttackMod + ' to hit')

        let html = '<div style="margin-top:14px;"><div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">SPELLS</div>'
        if (spellInfo.length > 0) {
          html += '<div style="font-size:11px;color:#888;margin-bottom:8px;">' + spellInfo.join(' · ') + '</div>'
        }

        // Display spell slot counts as fixed horizontal grid (MOVED TO TOP)
        if (spellSlots && spellSlots.length > 0 && spellSlots.some(n => n > 0)) {
          const slotLevels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
          html += '<div style="margin-top:8px;margin-bottom:12px;">'
          html += '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;">'
          for (let i = 0; i < 9; i++) {
            const count = spellSlots[i] || 0
            if (count > 0) {
              html += '<div style="background:#1A1C1E;border:1px solid #2a3a5a;border-radius:4px;padding:8px 4px;text-align:center;">'
              html += '<div style="font-size:10px;color:#888;margin-bottom:2px;">' + slotLevels[i] + '</div>'
              html += '<div style="font-size:18px;font-weight:bold;color:#c9a87c;">' + count + '</div>'
              html += '</div>'
            } else {
              html += '<div style="visibility:hidden;"></div>'
            }
          }
          html += '</div></div>'
        }

        if (atWill.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">At will:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += atWill.map(s => renderSpell(s)).join('')
          html += '</div></div>'
        }
        if (daily.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">Daily:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += daily.map(s => renderSpell(s, '(' + (s.dailyCount||1) + '/day) ')).join('')
          html += '</div></div>'
        }
        if (slot.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">Spell slots:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += slot.map(s => renderSpell(s)).join('')
          html += '</div></div>'
        }

        html += '</div>'
        return html
      })()}
      ${m.description ? `
        <div style="margin-top:14px;">
          <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:6px;">DESCRIPTION</div>
          <div style="font-size:13px;color:#b8b0a0;line-height:1.6;">${m.description}</div>
        </div>` : ''}
    </div>`
}

function showNPC(uid, skipHistory = false) {
  const npc = compendiumData.npcs.find(n => n.uid === uid)
  if (!npc) return
  if (!skipHistory) pushNav('npc-detail', uid)
  else currentScreen = { screen: 'npc-detail', uid }

  const content = document.getElementById('content')
  content.style.padding = '20px 20px 20px 260px'
  content.style.overflow = 'auto'
  content.innerHTML = buildNPCDetailCard(npc)
  content.scrollTop = 0
}

function buildNPCDetailCard(npc) {
  function mod(s) { const n = Math.floor(((parseInt(s)||10)-10)/2); return n>=0?`+${n}`:String(n) }
  function sline(label, val) {
    if (!val && val !== 0) return ''
    return `<div style="font-size:13px;line-height:1.6;margin-bottom:3px;">
      <strong style="color:#c9a87c;">${label}</strong> ${val}</div>`
  }
  function formatCR(cr) {
    if (!cr) return ''
    const entry = window.MB_CR_TABLE?.find(e => e.cr === String(cr))
    return entry ? `${cr} (${entry.xp.toLocaleString()} XP)` : cr
  }
  function absec(title, items) {
    if (!items || !items.length) return ''
    return `<div style="margin-top:14px;">
      <div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">${title}</div>
      ${items.map(it => `<div style="margin-bottom:12px;font-size:13px;line-height:1.6;">
        ${it.name ? `<strong style="font-size:14.5px;color:#7B9BA8;">${it.name}.</strong> ` : ''}${renderMarkdown(it.text||'')}</div>`).join('')}
    </div>`
  }
  const abs = [['STR','str'],['DEX','dex'],['CON','con'],['INT','int'],['WIS','wis'],['CHA','cha']]
  const displayName = npc.properName || npc.label

  // Helper to get ability score from either npc.abilities array or individual npc.str, etc.
  function getAbility(key) {
    const abMap = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 }
    if (npc.abilities && Array.isArray(npc.abilities)) {
      return npc.abilities[abMap[key]] || 10
    }
    return npc[key] || 10
  }

  return `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
      <button onclick="popNav()"
        style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        &#8592; Back
      </button>
      <button onclick="openNPCBuilder('${npc.uid}')"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 16px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        &#9998; Edit
      </button>
      <button onclick="deleteNPC('${npc.uid}')"
        style="background:#8b0000;border:2px solid #5a0000;color:#e0d5c5;padding:6px 16px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        Delete
      </button>
    </div>
    <div style="background:#262F35;border:none;border-radius:6px;
                padding:20px;max-width:840px;font-family:var(--app-font);color:#e0d5c5;">
      <div style="position:relative;padding-bottom:${npc.portrait || npc._draft?.portrait ? '12px' : '0'};">
        ${npc.portrait || npc._draft?.portrait ? `
          <img src="${npc.portrait || npc._draft?.portrait}" style="position:absolute;top:0;right:0;width:60px;height:60px;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        ${displayName ? `
          <div style="font-size:26px;font-weight:bold;margin-bottom:4px;color:#7B9BA8;${npc.portrait || npc._draft?.portrait ? 'padding-right:70px;' : ''}">
            ${displayName}
          </div>
        ` : ''}
        <div style="margin-bottom:8px;">
          <div style="font-size:${displayName ? '18' : '22'}px;font-weight:bold;margin-bottom:2px;
                      ${displayName ? 'color:#888;' : ''}${(npc.portrait || npc._draft?.portrait) && !displayName ? 'padding-right:70px;' : ''}">
            ${npc.name}
          </div>
          <div style="font-size:13px;color:#888;font-style:italic;">
            ${[expandSize(npc.size), npc.type].filter(Boolean).join(' ')}${npc.tag ? ` (${npc.tag})` : ''}
          </div>
        </div>
      </div>
      <div style="border-top:2px solid #1A1C1E;margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">ARMOR CLASS</div>
          <div style="font-size:20px;font-weight:bold;">${parseInt(npc.ac) || npc.ac || '—'}</div>
          ${(() => {
            const armorType = npc.armor || (npc.ac ? String(npc.ac).match(/\(([^)]+)\)/)?.[1] : '')
            return armorType ? `<div style="font-size:10px;color:#888888;margin-top:2px;">${armorType}</div>` : ''
          })()}
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">HIT POINTS</div>
          <div style="font-size:20px;font-weight:bold;">${npc.hp||'—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">SPEED</div>
          <div style="font-size:16px;font-weight:bold;">${npc.speed||'—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">INITIATIVE</div>
          <div style="font-size:20px;font-weight:bold;">${(() => {
            const dex = getAbility('dex')
            const initMod = Math.floor((dex - 10) / 2)
            return initMod >= 0 ? '+' + initMod : initMod
          })()}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
        ${abs.map(([l,k]) => {
          const score = getAbility(k)
          return `
          <div style="background:#1A1C1E;padding:8px 4px;border-radius:4px;text-align:center;">
            <div style="font-size:11px;color:#4a9a9a;letter-spacing:.06em;
                        font-weight:700;margin-bottom:4px;">${l}</div>
            <div style="font-size:18px;font-weight:bold;">${score}</div>
            <div style="font-size:12px;color:#888;">${mod(score)}</div>
          </div>`
        }).join('')}
      </div>
      <div style="border-top:1px solid #1A1C1E;margin-bottom:10px;"></div>
      ${sline('Skills', (() => {
        if (npc.skill) return npc.skill.split(',').map(s => s.trim()).sort().join(', ')
        if (npc.skills && Array.isArray(npc.skills) && npc.skills.length > 0) {
          return npc.skills.sort((a, b) => {
            const nameA = typeof a.id === 'number' ? SKILL_NAMES[a.id] : (a.name || 'Unknown')
            const nameB = typeof b.id === 'number' ? SKILL_NAMES[b.id] : (b.name || 'Unknown')
            return nameA.localeCompare(nameB)
          }).map(sk => {
            const skillName = typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || 'Unknown')
            return `${skillName} ${sk.modifier >= 0 ? '+' : ''}${sk.modifier}`
          }).join(', ')
        }
        if (typeof npc.skills === 'string') return npc.skills.split(',').map(s => s.trim()).sort().join(', ')
        return ''
      })())}
      ${sline('Saving Throws', npc.save || (npc.savingThrows && Array.isArray(npc.savingThrows) && npc.savingThrows.length > 0
        ? (() => {
            // Sort by standard D&D ability order
            const ABILITY_ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
            const sorted = [...npc.savingThrows].sort((a, b) => {
              const aName = typeof a.ability === 'number'
                ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][a.ability]
                : String(a.ability).toUpperCase()
              const bName = typeof b.ability === 'number'
                ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][b.ability]
                : String(b.ability).toUpperCase()
              return ABILITY_ORDER.indexOf(aName) - ABILITY_ORDER.indexOf(bName)
            })
            return sorted.map(st => {
              const abilityName = typeof st.ability === 'number' ? ABILITY_NAMES[st.ability] : st.ability
              return `${abilityName} ${st.modifier >= 0 ? '+' : ''}${st.modifier}`
            }).join(', ')
          })()
        : (typeof npc.savingThrows === 'string' ? npc.savingThrows : '')))}
      ${sline('Damage Immunities', npc.immune)}
      ${sline('Resistances', npc.resist)}
      ${sline('Vulnerabilities', npc.vulnerable)}
      ${sline('Condition Immunities', npc.conditionImmune)}
      ${sline('Senses', npc.senses)}
      ${sline('Passive Perception', npc.passive)}
      ${sline('Languages', npc.languages)}
      ${sline('Challenge', formatCR(npc.cr))}
      ${(() => {
        const cr = parseFloat(npc.cr) || 0
        const profBonus = npc.proficiencyBonus || (
          cr <= 4 ? 2 : cr <= 8 ? 3 : cr <= 12 ? 4 : cr <= 16 ? 5 :
          cr <= 20 ? 6 : cr <= 24 ? 7 : cr <= 28 ? 8 : 9
        )
        return sline('Proficiency Bonus', `+${profBonus}`)
      })()}
      ${npc.tag ? sline('Tag', npc.tag) : ''}
      ${npc.source ? sline('Source', npc.source) : ''}
      ${absec('TRAITS', npc.traits)}
      ${absec('ACTIONS', npc.actions)}
      ${absec('BONUS ACTIONS', npc.bonusActions)}
      ${absec('REACTIONS', npc.reactions)}
      ${absec('LEGENDARY ACTIONS', npc.legendaryActions)}
      ${absec('LAIR ACTIONS', npc.lairActions)}
      ${(() => {
        // Build spell display from selectedSpells or convert from spells array
        const spells = npc.selectedSpells || (npc.spells && npc.spells.length > 0 ? npc.spells : [])
        if (spells.length === 0) return ''

        // Helper to render an expandable spell card
        const renderSpell = (spell, prefix = '') => {
          const fullSpell = typeof spell === 'string'
            ? compendiumData.spells.find(s => s.name === spell) || { name: spell, level: '0' }
            : (compendiumData.spells.find(s => s.name === spell.name) || spell)
          const id = 'npc-spell-' + npc.uid + '-' + fullSpell.name.replace(/[^a-z0-9]/gi, '')
          const isCantrip = fullSpell.level === '0' || fullSpell.level === '' || fullSpell.level === 0 || !fullSpell.level
          const levelDisplay = isCantrip ? 'Cantrip' : 'Level ' + fullSpell.level
          const levelBadge = isCantrip ? 'C' : fullSpell.level
          return `<div style="margin-bottom:4px;">
              <div onclick="const el=document.getElementById('${id}');el.style.display=el.style.display==='none'?'block':'none'"
                style="background:#0f3460;padding:10px 14px;border-radius:4px;cursor:pointer;
                       display:flex;justify-content:space-between;align-items:center;"
                onmouseover="this.style.background='#1a4a8a'"
                onmouseout="this.style.background='#0f3460'">
                <span style="font-size:13px;color:#e0d5c5;">${prefix}${fullSpell.name}</span>
                <span style="font-size:11px;color:#888;background:#1A1C1E;padding:2px 8px;border-radius:3px;min-width:24px;text-align:center;">
                  ${levelBadge}
                </span>
              </div>
              <div id="${id}"
                style="display:none;background:#1A1C1E;padding:12px;border-radius:0 0 4px 4px;
                       border:1px solid #0f3460;border-top:none;">
                <div style="font-size:12px;color:#666;margin-bottom:6px;">
                  ${levelDisplay}${fullSpell.school ? ' — ' + fullSpell.school : ''}
                  ${fullSpell.time ? ' · ' + fullSpell.time : ''}
                  ${fullSpell.range ? ' · ' + fullSpell.range : ''}
                  ${fullSpell.duration ? ' · ' + fullSpell.duration : ''}
                </div>
                <div style="font-size:13px;white-space:pre-wrap;color:#bbb;line-height:1.6;">${renderMarkdown(fullSpell.text || '')}</div>
              </div>
            </div>`
        }

        // Sort helper: by level then alphabetically
        const sortSpells = (arr) => arr.sort((a, b) => {
          const aSpell = typeof a === 'string' ? compendiumData.spells.find(s => s.name === a) : (compendiumData.spells.find(s => s.name === a.name) || a)
          const bSpell = typeof b === 'string' ? compendiumData.spells.find(s => s.name === b) : (compendiumData.spells.find(s => s.name === b.name) || b)
          const aLevel = parseInt(aSpell?.level) || 0
          const bLevel = parseInt(bSpell?.level) || 0
          if (aLevel !== bLevel) return aLevel - bLevel
          const aName = typeof a === 'string' ? a : (a.name || '')
          const bName = typeof b === 'string' ? b : (b.name || '')
          return aName.localeCompare(bName)
        })

        const atWill = sortSpells(spells.filter(s => (s.usage || 'slot') === 'atwill'))
        const daily = sortSpells(spells.filter(s => (s.usage || 'slot') === 'daily'))
        const slot = sortSpells(spells.filter(s => (s.usage || 'slot') === 'slot'))

        // Parse spell slots
        const spellSlots = npc.spellSlots || (npc.slots
          ? npc.slots.split(',').filter(s => s.trim()).map(s => parseInt(s.trim()) || 0).slice(1, 10)
          : [])

        const spellSaveDC = npc._draft?.spellSaveDC || npc.spellSaveDC
        const spellAttackMod = npc._draft?.spellAttackMod || npc.spellAttackMod
        const spellInfo = []
        if (spellSaveDC) spellInfo.push('Spell Save DC ' + spellSaveDC)
        if (spellAttackMod) spellInfo.push('+' + spellAttackMod + ' to hit')

        let html = '<div style="margin-top:14px;"><div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">SPELLS</div>'
        if (spellInfo.length > 0) {
          html += '<div style="font-size:11px;color:#888;margin-bottom:8px;">' + spellInfo.join(' · ') + '</div>'
        }

        // Display spell slot counts as fixed horizontal grid (MOVED TO TOP)
        if (spellSlots && spellSlots.length > 0 && spellSlots.some(n => n > 0)) {
          const slotLevels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
          html += '<div style="margin-top:8px;margin-bottom:12px;">'
          html += '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;">'
          for (let i = 0; i < 9; i++) {
            const count = spellSlots[i] || 0
            if (count > 0) {
              html += '<div style="background:#1A1C1E;border:1px solid #2a3a5a;border-radius:4px;padding:8px 4px;text-align:center;">'
              html += '<div style="font-size:10px;color:#888;margin-bottom:2px;">' + slotLevels[i] + '</div>'
              html += '<div style="font-size:18px;font-weight:bold;color:#c9a87c;">' + count + '</div>'
              html += '</div>'
            } else {
              html += '<div style="visibility:hidden;"></div>'
            }
          }
          html += '</div></div>'
        }

        if (atWill.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">At will:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += atWill.map(s => renderSpell(s)).join('')
          html += '</div></div>'
        }
        if (daily.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">Daily:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += daily.map(s => renderSpell(s, '(' + (s.dailyCount||1) + '/day) ')).join('')
          html += '</div></div>'
        }
        if (slot.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">Spell slots:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += slot.map(s => renderSpell(s)).join('')
          html += '</div></div>'
        }

        html += '</div>'
        return html
      })()}
      ${npc.description ? `
        <div style="margin-top:14px;">
          <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:6px;">DESCRIPTION</div>
          <div style="font-size:13px;color:#b8b0a0;line-height:1.6;">${npc.description}</div>
        </div>` : ''}
      ${npc.text ? `
        <div style="margin-top:14px;">
          <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:6px;">NOTES</div>
          <div style="font-size:13px;color:#b8b0a0;line-height:1.6;white-space:pre-wrap;">${npc.text}</div>
        </div>` : ''}
      ${npc.notes && npc.notes.length > 0 ? `
        <div style="margin-top:14px;">
          <div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:6px;">NOTES</div>
          ${npc.notes.map(note => `
            <div style="margin-bottom:${note === npc.notes[npc.notes.length-1] ? '0' : '12'}px;">
              ${note.title ? `<div style="font-size:14.5px;color:#7B9BA8;
                font-weight:700;margin-bottom:-10px;">${renderMarkdown(note.title)}</div>` : ''}
              <div style="font-size:13px;color:#b8b0a0;line-height:1.6;white-space:pre-line;
                text-indent:0;padding:0;margin:-6px 0 0 0;">
                ${renderMarkdown(note.body || '')}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`
}

function showPC(uid, skipHistory = false) {
  const pc = compendiumData.players.find(p => p.uid === uid)
  if (!pc) return
  if (!skipHistory) pushNav('pc-detail', uid)
  else currentScreen = { screen: 'pc-detail', uid }

  const content = document.getElementById('content')
  content.style.padding = '20px 20px 20px 260px'
  content.style.overflow = 'auto'
  content.innerHTML = buildPCDetailCard(pc)
  content.scrollTop = 0
}

function buildPCDetailCard(pc) {
  function mod(s) { const n = Math.floor(((parseInt(s)||10)-10)/2); return n>=0?`+${n}`:String(n) }
  function sline(label, val) {
    if (!val && val !== 0) return ''
    return `<div style="font-size:13px;line-height:1.6;margin-bottom:3px;">
      <strong style="color:#c9a87c;">${label}</strong> ${val}</div>`
  }
  function absec(title, items) {
    if (!items || !items.length) return ''
    return `<div style="margin-top:14px;">
      <div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">${title}</div>
      ${items.map(it => `<div style="margin-bottom:12px;font-size:13px;line-height:1.6;">
        ${it.name ? `<strong>${it.name}.</strong> ` : ''}${renderMarkdown(it.desc||it.text||'')}</div>`).join('')}
    </div>`
  }
  const abs = [['STR','str'],['DEX','dex'],['CON','con'],['INT','int'],['WIS','wis'],['CHA','cha']]
  // Use label as display name, name as class info for XML-imported PCs
  const displayName = pc.label || pc.name || 'Unnamed Character'

  // Build class info subtitle: "Class (Subclass) Level - Race"
  let classInfo = ''
  const pcClass = pc.class || pc._draft?.class || ''
  const subclass = pc.subclass || pc._draft?.subclass || ''
  const level = pc.level || pc.cr || 1
  const race = pc.race || pc._draft?.race || pc.type || ''

  if (pcClass) {
    classInfo = subclass ? `${pcClass} (${subclass})` : pcClass
    classInfo += ` ${level}`
  } else {
    classInfo = `Level ${level}`
  }
  if (race) {
    classInfo += ` - ${race}`
  }

  // Calculate proficiency bonus from level if not stored
  let profBonus = pc.proficiencyBonus || pc._draft?.proficiencyBonus
  if (!profBonus) {
    const lvl = parseInt(level) || 1
    profBonus = lvl <= 4 ? 2 : lvl <= 8 ? 3 : lvl <= 12 ? 4 : lvl <= 16 ? 5 : 6
  }

  // Get size and type for stat block display
  const size = pc._draft?.size || pc.size || 'Medium'
  const type = pc._draft?.type || pc.type || 'Humanoid'

  return `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
      <button onclick="popNav()"
        style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        &#8592; Back
      </button>
      <button onclick="openPCBuilder('${pc.uid}')"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 16px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        &#9998; Edit
      </button>
      <button onclick="deletePC('${pc.uid}')"
        style="background:#8b0000;border:2px solid #5a0000;color:#e0d5c5;padding:6px 16px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        Delete
      </button>
    </div>
    <div style="background:#262F35;border:none;border-radius:6px;
                padding:20px;max-width:840px;font-family:var(--app-font);color:#e0d5c5;">
      <div style="margin-bottom:8px;position:relative;padding-bottom:${pc.portrait ? '12px' : '0'};">
        ${pc.portrait ? `
          <img src="${pc.portrait}" style="position:absolute;top:0;right:0;width:60px;height:60px;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:2px;${pc.portrait ? 'padding-right:70px;' : ''}">
          <div style="font-size:22px;font-weight:bold;color:#7B9BA8;">
            ${displayName}
          </div>
          ${classInfo ? `<div style="font-size:15px;color:#999;">
            ${classInfo}
          </div>` : ''}
        </div>
        <div style="font-size:13px;color:#888;font-style:italic;">
          ${expandSize(size)} ${type}
        </div>
        ${pc.player ? `<div style="font-size:13px;color:#666;margin-top:2px;">
          Played by ${pc.player}</div>` : ''}
      </div>
      <div style="border-top:2px solid #1A1C1E;margin-bottom:10px;"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">ARMOR CLASS</div>
          <div style="font-size:20px;font-weight:bold;">${parseInt(pc.ac || pc._draft?.acValue) || pc.ac || pc._draft?.acValue || '—'}</div>
          ${(() => {
            const acValue = pc.ac || pc._draft?.acValue
            const armorType = pc.armor || (acValue ? String(acValue).match(/\(([^)]+)\)/)?.[1] : '')
            return armorType ? `<div style="font-size:10px;color:#888888;margin-top:2px;">${armorType}</div>` : ''
          })()}
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">HIT POINTS</div>
          <div style="font-size:20px;font-weight:bold;">${pc.hpMax ? `${pc.hpCurrent || pc.hpMax}/${pc.hpMax}` : (pc._draft?.hpValue || '—')}</div>
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">SPEED</div>
          <div style="font-size:16px;font-weight:bold;">${pc.speed || pc._draft?.speed || '—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:8px;border-radius:4px;text-align:center;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:3px;">INITIATIVE</div>
          <div style="font-size:20px;font-weight:bold;">${(() => {
            if (pc.initiativeBonus !== undefined || pc._draft?.initiativeBonus !== undefined) {
              const init = pc.initiativeBonus ?? pc._draft.initiativeBonus
              return init >= 0 ? '+' + init : init
            }
            // Calculate from DEX (for XML PCs that don't have initiativeBonus)
            const dex = pc.dex || (pc.abilities && pc.abilities[1]) || (pc._draft?.dex) || 10
            const initMod = Math.floor((dex - 10) / 2)
            return initMod >= 0 ? '+' + initMod : initMod
          })()}</div>
        </div>
      </div>
      <div style="border-top:1px solid #1A1C1E;margin:10px 0;"></div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0;">
        ${abs.map(([name,key]) => {
          // Try to get ability score from pc[key] first, then from abilities array, then from _draft
          let score = pc[key] || 10
          if (!pc[key] && pc.abilities && Array.isArray(pc.abilities)) {
            const idx = ['str','dex','con','int','wis','cha'].indexOf(key)
            score = parseInt(pc.abilities[idx]) || 10
          } else if (!pc[key] && pc._draft && pc._draft[key]) {
            score = pc._draft[key]
          }
          return `
          <div style="background:#1A1C1E;padding:8px 4px;border-radius:4px;text-align:center;">
            <div style="font-size:11px;color:#4a9a9a;letter-spacing:.06em;
                        font-weight:700;margin-bottom:4px;">${name}</div>
            <div style="font-size:18px;font-weight:bold;">${score}</div>
            <div style="font-size:12px;color:#888;">${mod(score)}</div>
          </div>`
        }).join('')}
      </div>
      <div style="border-top:1px solid #1A1C1E;margin:10px 0;"></div>
      ${pc.skills && Array.isArray(pc.skills) && pc.skills.length > 0 ? sline('Skills',
        pc.skills.sort((a, b) => {
          const nameA = typeof a.id === 'number' ? SKILL_NAMES[a.id] : (a.name || 'Unknown')
          const nameB = typeof b.id === 'number' ? SKILL_NAMES[b.id] : (b.name || 'Unknown')
          return nameA.localeCompare(nameB)
        }).map(sk => {
          const skillName = typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || 'Unknown')
          const mod = sk.modifier || 0
          return `${skillName} ${mod >= 0 ? '+' : ''}${mod}`
        }).join(', ')
      ) : (typeof pc.skills === 'string' && pc.skills ? sline('Skills', pc.skills) : '')}
      ${pc.savingThrows && Array.isArray(pc.savingThrows) && pc.savingThrows.length > 0 ? sline('Saving Throws',
        (() => {
          // Sort by standard D&D ability order
          const ABILITY_ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
          const sorted = [...pc.savingThrows].sort((a, b) => {
            const aName = typeof a.ability === 'number'
              ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][a.ability]
              : String(a.ability || a.name || '').toUpperCase()
            const bName = typeof b.ability === 'number'
              ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][b.ability]
              : String(b.ability || b.name || '').toUpperCase()
            return ABILITY_ORDER.indexOf(aName) - ABILITY_ORDER.indexOf(bName)
          })
          return sorted.map(st => {
            const abilityName = typeof st.ability === 'number' ? ABILITY_NAMES[st.ability] : (st.ability || st.name || 'Unknown')
            const mod = st.modifier || 0
            return `${abilityName} ${mod >= 0 ? '+' : ''}${mod}`
          }).join(', ')
        })()
      ) : (typeof pc.savingThrows === 'string' && pc.savingThrows ? sline('Saving Throws', pc.savingThrows) : '')}
      ${sline('Senses', pc.senses)}
      ${(() => {
        // Build passive senses line
        const passives = []

        // Passive Perception
        if (pc.passive !== undefined && pc.passive !== '' && pc.passive !== null) {
          passives.push(`Perception ${pc.passive}`)
        } else {
          // Auto-calculate from WIS
          const wis = pc.wis || (pc.abilities && pc.abilities[4]) || (pc._draft?.wis) || 10
          const wisMod = Math.floor((wis - 10) / 2)
          const profBonus = pc.proficiencyBonus || Math.floor((parseInt(pc.level) || 1 - 1) / 4) + 2
          const perceptionSkill = pc.skills?.find(sk => (typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : sk.name) === 'Perception')
          const passivePerception = 10 + wisMod + (perceptionSkill ? profBonus : 0)
          passives.push(`Perception ${passivePerception}`)
        }

        // Passive Insight
        if (pc.passiveInsight !== undefined && pc.passiveInsight !== null) {
          passives.push(`Insight ${pc.passiveInsight}`)
        } else {
          // Auto-calculate from WIS
          const wis = pc.wis || (pc.abilities && pc.abilities[4]) || (pc._draft?.wis) || 10
          const wisMod = Math.floor((wis - 10) / 2)
          const profBonus = pc.proficiencyBonus || Math.floor((parseInt(pc.level) || 1 - 1) / 4) + 2
          const insightSkill = pc.skills?.find(sk => (typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : sk.name) === 'Insight')
          const passiveInsight = 10 + wisMod + (insightSkill ? profBonus : 0)
          passives.push(`Insight ${passiveInsight}`)
        }

        // Passive Investigation
        if (pc.passiveInvestigation !== undefined && pc.passiveInvestigation !== null) {
          passives.push(`Investigation ${pc.passiveInvestigation}`)
        } else {
          // Auto-calculate from INT
          const int = pc.int || (pc.abilities && pc.abilities[3]) || (pc._draft?.int) || 10
          const intMod = Math.floor((int - 10) / 2)
          const profBonus = pc.proficiencyBonus || Math.floor((parseInt(pc.level) || 1 - 1) / 4) + 2
          const investigationSkill = pc.skills?.find(sk => (typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : sk.name) === 'Investigation')
          const passiveInvestigation = 10 + intMod + (investigationSkill ? profBonus : 0)
          passives.push(`Investigation ${passiveInvestigation}`)
        }

        return sline('Passive Senses', passives.join(', '))
      })()}
      ${sline('Languages', pc.languages)}
      ${sline('Proficiency Bonus', `+${profBonus}`)}
      ${absec('TRAITS', pc.traits)}
      ${absec('ACTIONS', pc.actions)}
      ${absec('BONUS ACTIONS', pc.bonusActions)}
      ${absec('REACTIONS', pc.reactions)}
      ${absec('LEGENDARY ACTIONS', pc.legendaryActions)}
      ${(() => {
        // Get spells from selectedSpells or _draft, or convert from raw spells
        let spells = pc.selectedSpells || pc._draft?.selectedSpells || []

        // If no selectedSpells but we have raw spells from XML, convert them
        if (!spells.length && pc.spells && Array.isArray(pc.spells)) {
          spells = pc.spells.map(s => ({
            name: s.name,
            level: s.level || '0',
            usage: 'slot'
          }))
        }

        if (!spells.length) return ''

        function renderSpell(sp, prefix = '') {
          // Try to find full spell data from compendium first
          let fullSpell = compendiumData.spells.find(s => s.name === sp.name)

          // If not in compendium, check if PC has raw spells array (from XML)
          if (!fullSpell && pc.spells && Array.isArray(pc.spells)) {
            fullSpell = pc.spells.find(s => s.name === sp.name)
          }

          if (!fullSpell) return `<div style="padding:6px 8px;font-size:13px;color:#888;">${prefix}${sp.name}</div>`
          const id = 'pcspell-' + sp.name.replace(/[^a-zA-Z0-9]/g, '-') + '-' + Math.random().toString(36).slice(2, 7)
          return `
            <div style="margin-bottom:4px;">
              <div onclick="const d=document.getElementById('${id}');d.style.display=d.style.display==='none'?'block':'none'"
                style="background:#0f3460;padding:10px 14px;border-radius:4px;cursor:pointer;
                       display:flex;justify-content:space-between;align-items:center;"
                onmouseover="this.style.background='#1a4a8a'"
                onmouseout="this.style.background='#0f3460'">
                <span style="font-size:13px;color:#e0d5c5;">${prefix}${sp.name}</span>
                <span style="font-size:11px;color:#888;background:#1A1C1E;padding:2px 8px;border-radius:3px;min-width:24px;text-align:center;">
                  ${(fullSpell.level === '0' || fullSpell.level === 0 || !fullSpell.level) ? 'C' : fullSpell.level}
                </span>
              </div>
              <div id="${id}"
                style="display:none;background:#1A1C1E;padding:12px;border-radius:0 0 4px 4px;
                       border:1px solid #0f3460;border-top:none;">
                <div style="font-size:12px;color:#666;margin-bottom:6px;">
                  ${(fullSpell.level === '0' || fullSpell.level === 0 || !fullSpell.level) ? 'C' : 'Level ' + fullSpell.level}
                  ${fullSpell.time ? ` · ${fullSpell.time}` : ''}
                  ${fullSpell.range ? ` · ${fullSpell.range}` : ''}
                  ${fullSpell.duration ? ` · ${fullSpell.duration}` : ''}
                </div>
                <div style="font-size:13px;white-space:pre-wrap;color:#bbb;line-height:1.6;">${renderMarkdown(fullSpell.text || '')}</div>
              </div>
            </div>`
        }

        // Sort helper: by level then alphabetically
        const sortSpells = (arr) => arr.sort((a, b) => {
          const aLevel = parseInt(a.level) || 0
          const bLevel = parseInt(b.level) || 0
          if (aLevel !== bLevel) return aLevel - bLevel
          return a.name.localeCompare(b.name)
        })

        const atWill = sortSpells(spells.filter(s => s.usage === 'atwill'))
        const daily = sortSpells(spells.filter(s => s.usage === 'daily'))
        const slot = sortSpells(spells.filter(s => s.usage === 'slot'))

        // Get spell slots from PC (handle both array and string formats)
        let spellSlots = pc.spellSlots || pc._draft?.spellSlots
        if (!spellSlots && pc.slots && typeof pc.slots === 'string') {
          spellSlots = pc.slots.split(',').filter(s => s.trim()).map(s => parseInt(s.trim()) || 0).slice(1, 10)
        }

        const spellSaveDC = pc._draft?.spellSaveDC || pc.spellSaveDC
        const spellAttackMod = pc._draft?.spellAttackMod || pc.spellAttackMod
        const spellInfo = []
        if (spellSaveDC) spellInfo.push('Spell Save DC ' + spellSaveDC)
        if (spellAttackMod) spellInfo.push('+' + spellAttackMod + ' to hit')

        let html = '<div style="margin-top:14px;"><div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">SPELLS</div>'
        if (spellInfo.length > 0) {
          html += '<div style="font-size:11px;color:#888;margin-bottom:8px;">' + spellInfo.join(' · ') + '</div>'
        }

        // Display spell slot counts as fixed horizontal grid (MOVED TO TOP)
        if (spellSlots && spellSlots.length > 0 && spellSlots.some(n => n > 0)) {
          const slotLevels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
          html += '<div style="margin-top:8px;margin-bottom:12px;">'
          html += '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;">'
          for (let i = 0; i < 9; i++) {
            const count = spellSlots[i] || 0
            if (count > 0) {
              html += '<div style="background:#1A1C1E;border:1px solid #2a3a5a;border-radius:4px;padding:8px 4px;text-align:center;">'
              html += '<div style="font-size:10px;color:#888;margin-bottom:2px;">' + slotLevels[i] + '</div>'
              html += '<div style="font-size:18px;font-weight:bold;color:#c9a87c;">' + count + '</div>'
              html += '</div>'
            } else {
              html += '<div style="visibility:hidden;"></div>'
            }
          }
          html += '</div></div>'
        }

        if (atWill.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">At will:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += atWill.map(s => renderSpell(s)).join('')
          html += '</div></div>'
        }
        if (daily.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">Daily:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += daily.map(s => renderSpell(s, '(' + (s.dailyCount||1) + '/day) ')).join('')
          html += '</div></div>'
        }
        if (slot.length) {
          html += '<div style="margin-bottom:8px;"><strong style="font-size:13px;">Spell slots:</strong><div style="margin-left:8px;margin-top:4px;">'
          html += slot.map(s => renderSpell(s)).join('')
          html += '</div></div>'
        }

        html += '</div>'
        return html
      })()}
      ${pc.notes && pc.notes.length > 0 ? `
        <div style="margin-top:14px;">
          <div style="font-size:15px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:6px;">NOTES</div>
          ${pc.notes.map(note => `
            <div style="margin-bottom:${note === pc.notes[pc.notes.length-1] ? '0' : '12'}px;">
              ${note.title ? `<div style="font-size:14.5px;color:#7B9BA8;
                font-weight:700;margin-bottom:-10px;">${renderMarkdown(note.title)}</div>` : ''}
              <div style="font-size:13px;color:#b8b0a0;line-height:1.6;white-space:pre-line;
                text-indent:0;padding:0;margin:-6px 0 0 0;">
                ${renderMarkdown(note.body || '')}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`
}

function renderAbilitySection(title, items) {
  if (!items || items.length === 0) return ''
  return `
    <div style="margin-top:14px;">
      <h3 style="color:#4a9a9a;border-bottom:1px solid #4a9a9a;padding-bottom:4px;
                 margin-bottom:8px;font-size:15px;">${title}</h3>
      ${items.map(item => `
        <div style="margin-bottom:8px;line-height:1.6;">
          ${item.name ? `<strong>${item.name}.</strong> ` : ''}${renderMarkdown(item.text)}
          ${item.charges !== null ? `
            <span style="margin-left:6px;background:#0f3460;padding:2px 8px;
                         border-radius:10px;font-size:12px;">
              ${item.chargesCurrent}/${item.charges} charges
            </span>` : ''}
          ${item.recharge !== null && item.charges === null ? `
            <span style="margin-left:6px;background:#0f3460;padding:2px 8px;
                         border-radius:10px;font-size:12px;">
              Recharge ${item.recharge}
            </span>` : ''}
        </div>
      `).join('')}
    </div>
  `
}

// ── Spells ────────────────────────────────────────────────────────
// Spell filter state
let spellFilters = {
  query: '',
  level: '',
  school: '',
  ritual: '',
  concentration: '',
  homebrew: '',
  thirdParty: ''
}

function renderSpells(container) {
  // Get unique schools from actual data, normalized and deduplicated
  let uniqueSchools = [...new Set(compendiumData.spells
    .map(s => s.school || '')
    .filter(school => {
      // Filter out empty/null/undefined values
      if (!school || !school.trim()) return false
      return true
    })
    .map(school => {
      // Normalize to title case for deduplication (with proper article/preposition handling)
      const lowercase = ['of', 'the', 'a', 'an', 'in', 'from', 'with', 'and', 'or', 'but', 'for', 'to', 'at', 'by', 'on']
      return school.split(' ').map((word, index) => {
        if (!word) return word
        const lower = word.toLowerCase()
        // First word is always capitalized
        if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        // Keep articles/prepositions lowercase
        if (lowercase.includes(lower)) return lower
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }).join(' ')
    })
  )].sort()

  // Move "None" to the end if it exists
  const noneIndex = uniqueSchools.indexOf('None')
  if (noneIndex !== -1) {
    uniqueSchools.splice(noneIndex, 1)
    uniqueSchools.push('None')
  }

  const filterStyle = `background:#1A1C1E;border:1px solid #2E2F2D;color:#e0d5c5;
    font-family:var(--app-font);padding:6px 10px;border-radius:4px;font-size:12px;cursor:pointer;`

  const hasActiveFilters = spellFilters.query || spellFilters.level || spellFilters.school ||
    spellFilters.ritual || spellFilters.concentration || spellFilters.homebrew || spellFilters.thirdParty

  container.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:12px;align-items:center;">
      <input id="spell-search" type="text" placeholder="Search spells…" value="${spellFilters.query}"
        style="flex:1;max-width:500px;padding:8px 12px;background:#5C5C5C;
               border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
               border-radius:4px;font-size:14px;"
        oninput="spellFilters.query=this.value;applySpellFilters()" />
      <button onclick="openSpellBuilder()"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 16px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);
               white-space:nowrap;"
        onmouseover="this.style.borderColor='#4a9a9a';this.style.color='#e0d5c5'"
        onmouseout="this.style.borderColor='#445E22';this.style.color='#909090'">
        + Create Spell
      </button>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <select onchange="spellFilters.level=this.value;applySpellFilters()" style="${filterStyle}">
        <option value="">All Levels</option>
        <option value="0" ${spellFilters.level === '0' ? 'selected' : ''}>Cantrip</option>
        ${[1,2,3,4,5,6,7,8,9].map(lvl =>
          `<option value="${lvl}" ${spellFilters.level === String(lvl) ? 'selected' : ''}>Level ${lvl}</option>`
        ).join('')}
      </select>

      <select onchange="spellFilters.school=this.value;applySpellFilters()" style="${filterStyle}">
        <option value="">All Schools</option>
        ${uniqueSchools.map(school => `<option value="${school}" ${spellFilters.school === school ? 'selected' : ''}>${school}</option>`).join('')}
      </select>

      ${threeStateToggle('ritual', 'Ritual', 'spell')}
      ${threeStateToggle('concentration', 'Concentration', 'spell')}
      ${threeStateToggle('homebrew', 'Homebrew', 'spell')}
      ${threeStateToggle('thirdParty', 'Third Party', 'spell')}

      <button id="clear-spell-filters" onclick="clearSpellFilters()"
        style="background:#5C5C5C;color:#1E231A;border:4px solid #2E2F2D;padding:7px 14px;
               border-radius:4px;font-family:var(--app-font);font-size:13px;font-weight:bold;
               ${hasActiveFilters ? 'cursor:pointer;opacity:1;' : 'cursor:not-allowed;opacity:0.4;pointer-events:none;'}">
        Clear Filters
      </button>
    </div>

    <div id="spell-list"></div>
  `
  applySpellFilters()
}

function applySpellFilters() {
  let filtered = compendiumData.spells

  // Text search
  if (spellFilters.query) {
    const q = spellFilters.query.toLowerCase()
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.classes || '').toLowerCase().includes(q)
    )
  }

  // Level filter
  if (spellFilters.level !== '') {
    filtered = filtered.filter(s => {
      const isCantrip = s.level === '0' || s.level === '' || !s.level
      if (spellFilters.level === '0') {
        return isCantrip
      }
      return s.level === spellFilters.level
    })
  }

  // School filter (case-insensitive comparison)
  if (spellFilters.school) {
    filtered = filtered.filter(s => {
      const school = (s.school || '').toLowerCase()
      return school === spellFilters.school.toLowerCase()
    })
  }

  // Ritual filter
  if (spellFilters.ritual === 'ritual') {
    filtered = filtered.filter(s => s.ritual === true)
  } else if (spellFilters.ritual === 'non-ritual') {
    filtered = filtered.filter(s => s.ritual !== true)
  }

  // Concentration filter
  if (spellFilters.concentration === 'concentration') {
    filtered = filtered.filter(s => s.concentration === true)
  } else if (spellFilters.concentration === 'non-concentration') {
    filtered = filtered.filter(s => s.concentration !== true)
  }

  // Homebrew and Third Party filters (OR logic when both active)
  const homebrewActive = spellFilters.homebrew === 'homebrew'
  const homebrewExclude = spellFilters.homebrew === 'non-homebrew'
  const thirdPartyActive = spellFilters.thirdParty === 'third-party'
  const thirdPartyExclude = spellFilters.thirdParty === 'non-third-party'

  if (homebrewActive && thirdPartyActive) {
    // Both active: show entries that are EITHER homebrew OR third party
    filtered = filtered.filter(s => s.homebrew === true || s.thirdParty === true)
  } else if (homebrewActive) {
    // Only homebrew active
    filtered = filtered.filter(s => s.homebrew === true)
  } else if (thirdPartyActive) {
    // Only third party active
    filtered = filtered.filter(s => s.thirdParty === true)
  } else if (homebrewExclude && thirdPartyExclude) {
    // Both exclude: show entries that are NEITHER homebrew NOR third party
    filtered = filtered.filter(s => s.homebrew !== true && s.thirdParty !== true)
  } else if (homebrewExclude) {
    // Only homebrew exclude
    filtered = filtered.filter(s => s.homebrew !== true)
  } else if (thirdPartyExclude) {
    // Only third party exclude
    filtered = filtered.filter(s => s.thirdParty !== true)
  }

  renderSpellList(filtered)

  // Update Clear Filters button state dynamically
  const clearBtn = document.getElementById('clear-spell-filters')
  if (clearBtn) {
    const hasActive = spellFilters.query || spellFilters.level !== '' ||
      spellFilters.school || spellFilters.ritual || spellFilters.concentration || spellFilters.homebrew || spellFilters.thirdParty
    clearBtn.style.opacity = hasActive ? '1' : '0.4'
    clearBtn.style.pointerEvents = hasActive ? 'auto' : 'none'
    clearBtn.style.cursor = hasActive ? 'pointer' : 'not-allowed'
  }
}

function clearSpellFilters() {
  spellFilters = {
    query: '',
    level: '',
    school: '',
    ritual: '',
    concentration: '',
    homebrew: '',
    thirdParty: ''
  }
  const searchInput = document.getElementById('spell-search')
  if (searchInput) searchInput.value = ''
  renderSpells(document.getElementById('content'))
}
// Ensure function is accessible from inline onclick handlers
window.clearSpellFilters = clearSpellFilters

function filterSpells(query) {
  // Legacy function - now redirects to new filter system
  spellFilters.query = query
  applySpellFilters()
}

function renderSpellList(spells) {
  const list = document.getElementById('spell-list')
  if (!list) return
  if (compendiumData.spells.length === 0) {
    list.innerHTML = '<p style="color:#e0d5c5;">No spells loaded. Import your compendium data or create a new spell now!</p>'
    return
  }
  if (spells.length === 0) {
    list.innerHTML = '<p style="color:#555;">No spells match that search.</p>'
    return
  }
  list.innerHTML = spells.map(s => {
    const isCantrip = s.level === '0' || s.level === '' || !s.level
    const isHomebrew = s.homebrew === true
    const isThirdParty = s.thirdParty === true
    return `
    <div onclick="showSpell('${s.name.replace(/'/g, "\\'")}')"
      style="background:#262F35;border:1px solid #1e2d4a;padding:12px;border-radius:4px;
             margin-bottom:6px;cursor:pointer;"
      onmouseover="this.style.borderColor='#4a9a9a'" onmouseout="this.style.borderColor='#1e2d4a'">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
        <div style="font-weight:bold;color:#7B9BA8;">${s.name}</div>
        ${isHomebrew ? `<span style="background:#4a9a9a;color:#e0d5c5;font-size:10px;
          padding:2px 6px;border-radius:3px;letter-spacing:.06em;font-weight:700;">HOMEBREW</span>` : ''}
        ${isThirdParty ? `<span style="background:#3a5a7a;color:#e0d5c5;font-size:10px;
          padding:2px 6px;border-radius:3px;letter-spacing:.06em;font-weight:700;">3RD PARTY</span>` : ''}
      </div>
      <div style="font-size:12px;color:#C8C8C8;margin-top:2px;">
        ${isCantrip ? 'Cantrip' : 'Level ' + s.level} — ${s.school}
        ${s.classes ? ' · ' + s.classes : ''}
      </div>
      <div style="font-size:12px;color:#C8C8C8;margin-top:1px;">${s.time} · ${s.range} · ${s.duration}</div>
    </div>
  `}).join('')
}

function showSpell(name, skipHistory = false) {
  const s = compendiumData.spells.find(x => x.name === name)
  if (!s) return
  if (!skipHistory) pushNav('spell-detail', name)
  else currentScreen = { screen: 'spell-detail', uid: name }

  const content = document.getElementById('content')
  content.style.padding = '20px 20px 20px 260px'
  content.style.overflow = 'auto'

  const isCantrip = s.level === '0' || s.level === '' || !s.level
  const isHomebrew = s.homebrew === true
  const isThirdParty = s.thirdParty === true

  content.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;">
      <button onclick="popNav()"
        style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);
               font-size:13px;">
        ← Back to Spells
      </button>
      <button onclick="openSpellBuilder('${s.name.replace(/'/g, "\\'")}')"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        Edit
      </button>
    </div>
    <div style="background:#262F35;border:2px solid #4a9a9a;border-radius:6px;
                padding:24px;max-width:700px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        <h2 style="font-size:24px;margin:0;color:#7B9BA8;">${s.name}</h2>
        ${isHomebrew ? `<span style="background:#4a9a9a;color:#e0d5c5;font-size:10px;
          padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:700;">HOMEBREW</span>` : ''}
        ${isThirdParty ? `<span style="background:#3a5a7a;color:#e0d5c5;font-size:10px;
          padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:700;">3RD PARTY</span>` : ''}
      </div>
      <p style="font-style:italic;color:#888;margin-bottom:12px;">
        ${isCantrip ? 'Cantrip' : 'Level ' + s.level} — ${s.school}${s.ritual ? ' (Ritual)' : ''}
      </p>
      <hr style="border:none;border-top:1px solid #1A1C1E;margin-bottom:12px;">
      ${statRow('Casting Time', s.time)}
      ${statRow('Range', s.range)}
      ${statRow('Components', s.components)}
      ${statRow('Duration', s.duration)}
      <hr style="border:none;border-top:1px solid #4a9a9a;margin:12px 0;">
      <p style="line-height:1.7;white-space:pre-wrap;font-size:14px;">${s.text}</p>
      <hr style="border:none;border-top:1px solid #1A1C1E;margin:12px 0;">
      ${statRow('Classes/Subclasses', s.classes)}
      ${s.source ? `<div style="font-size:12px;color:#666;margin-top:8px;"><span style="color:#888;font-weight:600;">Source:</span> ${s.source}</div>` : ''}
    </div>
  `
}

// ── Characters (Players) ──────────────────────────────────────────
function renderPlayers(container) {
  if (compendiumData.players.length === 0 && compendiumData.npcs.length === 0) {
    container.innerHTML = `
      <p style="color:#e0d5c5;margin-bottom:16px;">No characters loaded. Create a new campaign or import one in settings to get started!</p>
      <button onclick="importCampaignXML()"
        style="background:#4a9a9a;color:#e0d5c5;border:none;padding:9px 18px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
        Import Campaign XML
      </button>
    `
    return
  }
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <input type="text" placeholder="Search characters…"
        style="flex:1;min-width:200px;max-width:400px;padding:8px 12px;background:#5C5C5C;
               border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
               border-radius:4px;font-size:14px;"
        oninput="filterPlayers(this.value)" />
    </div>
    <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${compendiumData.players.length > 0 ? '16px' : '0'};">
        <span style="font-size:16px;color:#1E231A;letter-spacing:.1em;font-weight:700;">
          PLAYER CHARACTERS
        </span>
        <button onclick="openPCBuilder(null)"
          style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 14px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;font-weight:700;">
          + Create PC
        </button>
      </div>
      ${compendiumData.players.length > 0 ? `
        <div id="player-grid"
          style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
        </div>
      ` : '<div id="player-grid" style="display:none;"></div>'}
    </div>
    <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${compendiumData.npcs.length > 0 ? '16px' : '0'};">
        <span style="font-size:16px;color:#1E231A;letter-spacing:.1em;font-weight:700;">
          NON-PLAYER CHARACTERS
        </span>
        <button onclick="openNPCBuilder(null)"
          style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:6px 14px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;font-weight:700;">
          + Create NPC
        </button>
      </div>
      ${compendiumData.npcs.length > 0 ? `
        <div id="npc-grid"
          style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">
        </div>
      ` : '<div id="npc-grid" style="display:none;"></div>'}
    </div>
  `
  renderPlayerGrid(compendiumData.players, 'player-grid')
  renderPlayerGrid(compendiumData.npcs, 'npc-grid')
}

function filterPlayers(query) {
  const q = query.toLowerCase()
  const match = p =>
    (p.label || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q)
  renderPlayerGrid(compendiumData.players.filter(match), 'player-grid')
  renderPlayerGrid(compendiumData.npcs.filter(match), 'npc-grid')
}

function renderPlayerGrid(players, gridId) {
  const grid = document.getElementById(gridId || 'player-grid')
  if (!grid) return
  if (players.length === 0) {
    grid.innerHTML = ''
    return
  }
  grid.innerHTML = players.map(p => `
    <div onclick="showPlayer('${p.uid.replace(/'/g, "\\'")}')"
      style="background:#262F35;border:1px solid #1e2d4a;padding:14px;border-radius:5px;cursor:pointer;position:relative;"
      onmouseover="this.style.borderColor='#4a9a9a'" onmouseout="this.style.borderColor='#1e2d4a'">
      ${p.portrait || p._draft?.portrait ? `
        <img src="${p.portrait || p._draft?.portrait}" style="position:absolute;top:8px;right:8px;width:40px;height:40px;
             border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
      ` : ''}
      <div style="font-weight:bold;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4587A2;
                  ${p.portrait || p._draft?.portrait ? 'padding-right:48px;' : ''}">
        ${p.label || p.name}
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:10px;
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${(() => {
          const levelStr = p.level ? `LV ${p.level}` : ''
          const classStr = p.race || p.class
            ? `${p.race || ''} ${p.class || ''}`.trim()
            : (p.classInfo || '')
          const isNPC = p.isNPC === true

          if (isNPC) {
            return p.cr ? `CR ${p.cr} · ${p.name}` : p.name
          } else if (classStr) {
            return levelStr ? `${levelStr} · ${classStr}` : classStr
          } else {
            return levelStr || p.name
          }
        })()}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;">
        <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
          <div style="font-size:9px;color:#666;letter-spacing:.06em;">HP</div>
          <div style="font-weight:bold;">${p.hpCurrent}/${p.hpMax}</div>
        </div>
        <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
          <div style="font-size:9px;color:#666;letter-spacing:.06em;">AC</div>
          <div style="font-weight:bold;">${(p.acValue ?? p.ac) != null ? (p.acValue ?? p.ac) : '—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
          <div style="font-size:9px;color:#666;letter-spacing:.06em;">INIT</div>
          <div style="font-weight:bold;">${(() => {
            if (p.initiativeBonus != null) return modStr(parseInt(p.initiativeBonus))
            const dex = parseInt(p.abilities?.[1]) || 10
            const initBonus = Math.floor((dex - 10) / 2)
            return modStr(initBonus)
          })()}</div>
        </div>
      </div>
    </div>
  `).join('')
}

function deletePC(uid) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const pc = compendiumData.players.find(p => p.uid === uid)
  if (!pc) return

  confirmDelete('Delete PC?', () => {
    // Remove from campaign's players array
    compendiumData.campaigns[campaign].players = compendiumData.campaigns[campaign].players.filter(p => p.uid !== uid)
    // Remove from active players list
    compendiumData.players = compendiumData.players.filter(p => p.uid !== uid)
    saveCampaigns(compendiumData.campaigns)
    showSection('home')
  })
}

function deleteNPC(uid) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const npc = compendiumData.npcs.find(n => n.uid === uid)
  if (!npc) return

  confirmDelete('Delete NPC?', () => {
    // Remove from campaign's npcs array
    compendiumData.campaigns[campaign].npcs = compendiumData.campaigns[campaign].npcs.filter(n => n.uid !== uid)
    // Remove from active npcs list
    compendiumData.npcs = compendiumData.npcs.filter(n => n.uid !== uid)

    // Remove NPC uid from all adventures that reference it
    const adventures = compendiumData.campaigns[campaign].adventures || []
    adventures.forEach(adv => {
      if (adv.npcUids && adv.npcUids.includes(uid)) {
        adv.npcUids = adv.npcUids.filter(id => id !== uid)
      }
    })

    saveCampaigns(compendiumData.campaigns)
    showSection('home')
  })
}

function showPlayer(uid, skipHistory = false) {
  const pc = compendiumData.players.find(x => x.uid === uid)
  if (pc) return showPC(uid, skipHistory)
  const npc = compendiumData.npcs.find(x => x.uid === uid)
  if (npc) return showNPC(uid, skipHistory)
}

function toggleSpell(uid, index) {
  const detail = document.getElementById(`spell-detail-${uid}-${index}`)
  const arrow  = document.getElementById(`spell-arrow-${uid}-${index}`)
  if (!detail) return
  const open = detail.style.display !== 'none'
  detail.style.display = open ? 'none' : 'block'
  if (arrow) {
    arrow.textContent = arrow.textContent.replace(open ? '▲' : '▼', open ? '▼' : '▲')
  }
}

function toggleCombatantSpell(uid, idx) {
  const detail = document.getElementById(`cspell-detail-${uid}-${idx}`)
  const arrow  = document.getElementById(`cspell-arrow-${uid}-${idx}`)
  if (!detail) return
  const open = detail.style.display !== 'none'
  detail.style.display = open ? 'none' : 'block'
  if (arrow) arrow.textContent = open ? '▼' : '▲'
}

function toggleTraitText(id) {
  const el = document.getElementById(id)
  if (!el) return
  const expanded = el.dataset.expanded === '1'
  if (expanded) {
    el.style.display = '-webkit-box'
    el.style.webkitLineClamp = '3'
    el.style.webkitBoxOrient = 'vertical'
    el.style.overflow = 'hidden'
    el.dataset.expanded = '0'
  } else {
    el.style.display = 'block'
    el.style.webkitLineClamp = 'unset'
    el.style.overflow = 'visible'
    el.dataset.expanded = '1'
  }
  const arrow = document.getElementById(id + '-arrow')
  if (arrow) arrow.textContent = expanded ? '▼' : '▲'
}

function toggleNotesSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  const isHidden = el.style.display === 'none'
  if (isHidden) {
    el.style.display = 'block'
  } else {
    el.style.display = 'none'
  }
  const arrow = document.getElementById(id + '-arrow')
  if (arrow) arrow.textContent = isHidden ? '▲' : '▼'
}

// ── Notes System ──────────────────────────────────────────────────
function makeNoteId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function getNotes(scope) {
  if (scope === 'campaign') {
    const camp = compendiumData.campaigns[compendiumData.activeCampaign]
    if (!camp || Array.isArray(camp)) return []
    return camp.notes || []
  }
  if (scope === 'enc') {
    return enc.current ? (enc.current.notes || []) : []
  }
  if (scope.startsWith('adventure-')) {
    const adventureId = scope.slice(10)
    const camp = compendiumData.campaigns[compendiumData.activeCampaign]
    if (!camp || Array.isArray(camp)) return []
    const adventures = camp.adventures || []
    const adventure = adventures.find(a => a.id === adventureId)
    return adventure ? (adventure.notes || []) : []
  }
  if (scope.startsWith('char-')) {
    const uid = scope.slice(5)
    const p = compendiumData.players.find(x => x.uid === uid)
      || compendiumData.npcs.find(x => x.uid === uid)
    return p ? (p.notes || []) : []
  }
  return []
}

function persistNotes(scope) {
  if (scope === 'campaign' || scope.startsWith('char-') || scope.startsWith('adventure-')) {
    saveCampaigns(compendiumData.campaigns)
  } else if (scope === 'enc') {
    if (!enc.current || !compendiumData.activeCampaign) return
    const camp = compendiumData.activeCampaign
    if (!enc.list[camp]) enc.list[camp] = []
    const idx = enc.list[camp].findIndex(e => e.id === enc.current.id)
    if (idx >= 0) enc.list[camp][idx] = enc.current
    saveEncounters(enc.list)
  }
}

function notesContainerId(scope) {
  if (scope === 'campaign') return 'campaign-notes-section'
  if (scope === 'enc') return 'enc-notes-content'
  if (scope.startsWith('adventure-')) return 'adventure-notes-section'
  return 'char-notes-' + scope.slice(5)
}

function renderNotes(scope) {
  const el = document.getElementById(notesContainerId(scope))
  if (!el) return
  const notes = getNotes(scope)
  const scopeJs = scope.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  let headerLabel = 'NOTES'
  if (scope === 'enc') headerLabel = 'ENCOUNTER NOTES'
  else if (scope === 'campaign') headerLabel = 'CAMPAIGN NOTES'

  const isCampaign = scope === 'campaign'
  const isAdventure = scope.startsWith('adventure-')
  const needsWrapper = isCampaign || isAdventure
  const wrapperStart = needsWrapper ? '<div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;">' : ''
  const wrapperEnd = needsWrapper ? '</div>' : ''

  el.innerHTML = `
    ${wrapperStart}
    <div style="margin-top:${scope === 'enc' ? '0' : (needsWrapper ? '0' : '24px')};">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  ${needsWrapper ? '' : 'border-bottom:1px solid #1e2d4a;'}padding-bottom:8px;margin-bottom:12px;">
        <span style="font-size:16px;color:#1E231A;letter-spacing:.1em;font-weight:700;">
          ${headerLabel}
        </span>
        <button onclick="addNote('${scopeJs}')"
          style="background:#1E231A;color:#8E8E8E;border:2px solid #445E22;padding:4px 12px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);font-weight:700;">
          + Add Note
        </button>
      </div>
      ${notes.length === 0
        ? `<div style="color:#1E231A;font-size:13px;font-style:italic;">No notes yet.</div>`
        : notes.map(n => noteItemHTML(n, scopeJs)).join('')}
    </div>
    ${wrapperEnd}
  `
}

function noteItemHTML(note, scopeJs) {
  const titleSafe = (note.title || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')
  const bodySafe  = (note.body  || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  const displayTitle = (note.title || 'Untitled').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  return `
    <div id="note-${note.id}"
      style="background:#3E3E3D;border:4px solid #2E2F2D;border-radius:4px;margin-bottom:8px;overflow:hidden;">
      <div onclick="toggleNote('${scopeJs}','${note.id}')"
        style="display:flex;align-items:center;justify-content:space-between;
               padding:10px 12px;cursor:pointer;background:#3E3E3D;"
        onmouseover="this.style.background='#4E4E4D'"
        onmouseout="this.style.background='#3E3E3D'">
        <span id="note-header-${note.id}" style="font-weight:bold;font-size:14px;color:#e0d5c5;">
          ${renderMarkdown(note.title || 'Untitled')}
        </span>
        <div style="display:flex;gap:8px;align-items:center;" onclick="event.stopPropagation()">
          <button onclick="deleteNote('${scopeJs}','${note.id}')"
            style="background:none;border:none;color:#0C0C0B;font-size:14px;cursor:pointer;padding:2px 4px;"
            title="Delete note">&#x2715;</button>
          <span id="note-arrow-${note.id}" style="color:#0C0C0B;font-size:12px;pointer-events:none;">▼</span>
        </div>
      </div>
      <div id="note-body-${note.id}" style="display:none;padding:12px;background:#1E231A;">
        <div id="note-view-${note.id}" style="display:block;">
          <div style="font-size:14px;color:#e0d5c5;font-weight:bold;margin-bottom:8px;">
            ${renderMarkdown(note.title || 'Untitled')}
          </div>
          <div style="font-size:13px;color:#b8b0a0;line-height:1.6;white-space:pre-line;">
            ${renderMarkdown(note.body || '')}
          </div>
          <div style="margin-top:12px;text-align:right;">
            <button onclick="editNote('${scopeJs}','${note.id}')"
              style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:5px 16px;
                     cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);">
              Edit
            </button>
          </div>
        </div>
        <div id="note-edit-${note.id}" style="display:none;">
          <input id="note-title-${note.id}" value="${titleSafe}"
            placeholder="Note title"
            style="width:100%;box-sizing:border-box;background:#3E3E3D;border:4px solid #2E2F2D;
                   color:#e0d5c5;padding:6px 8px;border-radius:3px;font-family:var(--app-font);
                   font-size:13px;margin-bottom:8px;outline:none;" />
          <textarea id="note-text-${note.id}" rows="5"
            placeholder="Note text..."
            style="width:100%;box-sizing:border-box;background:#3E3E3D;border:4px solid #2E2F2D;
                   color:#e0d5c5;padding:6px 8px;border-radius:3px;font-family:var(--app-font);
                   font-size:13px;resize:vertical;outline:none;">${bodySafe}</textarea>
          <div style="margin-top:8px;text-align:right;">
            <button onclick="saveNote('${scopeJs}','${note.id}')"
              style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:5px 16px;
                     cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  `
}

function addNote(scope) {
  const newNote = { id: makeNoteId(), title: 'New Note', body: '' }
  if (scope === 'campaign') {
    if (!compendiumData.activeCampaign) return
    let camp = compendiumData.campaigns[compendiumData.activeCampaign]
    if (Array.isArray(camp)) {
      camp = { players: camp.filter(p => !p.isNPC), npcs: camp.filter(p => p.isNPC), notes: [] }
      compendiumData.campaigns[compendiumData.activeCampaign] = camp
    }
    if (!camp.notes) camp.notes = []
    camp.notes.push(newNote)
  } else if (scope === 'enc') {
    if (!enc.current) return
    if (!enc.current.notes) enc.current.notes = []
    enc.current.notes.push(newNote)
  } else if (scope.startsWith('adventure-')) {
    const adventureId = scope.slice(10)
    const camp = compendiumData.campaigns[compendiumData.activeCampaign]
    if (!camp || Array.isArray(camp)) return
    const adventures = camp.adventures || []
    const adventure = adventures.find(a => a.id === adventureId)
    if (!adventure) return
    if (!adventure.notes) adventure.notes = []
    adventure.notes.push(newNote)
  } else if (scope.startsWith('char-')) {
    const uid = scope.slice(5)
    const p = compendiumData.players.find(x => x.uid === uid)
      || compendiumData.npcs.find(x => x.uid === uid)
    if (!p) return
    if (!p.notes) p.notes = []
    p.notes.push(newNote)
  }
  persistNotes(scope)
  renderNotes(scope)
  const body  = document.getElementById('note-body-'  + newNote.id)
  const arrow = document.getElementById('note-arrow-' + newNote.id)
  const viewDiv = document.getElementById('note-view-' + newNote.id)
  const editDiv = document.getElementById('note-edit-' + newNote.id)
  if (body)  body.style.display = 'block'
  if (arrow) arrow.textContent  = '▲'
  // Open new notes in edit mode
  if (viewDiv) viewDiv.style.display = 'none'
  if (editDiv) editDiv.style.display = 'block'
}

function editNote(scope, noteId) {
  const viewDiv = document.getElementById('note-view-' + noteId)
  const editDiv = document.getElementById('note-edit-' + noteId)
  if (viewDiv) viewDiv.style.display = 'none'
  if (editDiv) editDiv.style.display = 'block'
}

function saveNote(scope, noteId) {
  const notes = getNotes(scope)
  const note  = notes.find(n => n.id === noteId)
  if (!note) return
  const titleEl = document.getElementById('note-title-' + noteId)
  const textEl  = document.getElementById('note-text-'  + noteId)
  if (titleEl) note.title = titleEl.value
  if (textEl)  note.body  = textEl.value
  persistNotes(scope)
  // Re-render the note to show updated markdown in view mode
  renderNotes(scope)
}

function deleteNote(scope, noteId) {
  confirmDelete('Delete note?', () => {
    if (scope === 'campaign') {
      const camp = compendiumData.campaigns[compendiumData.activeCampaign]
      if (!camp || Array.isArray(camp)) return
      camp.notes = (camp.notes || []).filter(n => n.id !== noteId)
    } else if (scope === 'enc') {
      if (!enc.current) return
      enc.current.notes = (enc.current.notes || []).filter(n => n.id !== noteId)
    } else if (scope.startsWith('adventure-')) {
      const adventureId = scope.slice(10)
      const camp = compendiumData.campaigns[compendiumData.activeCampaign]
      if (!camp || Array.isArray(camp)) return
      const adventures = camp.adventures || []
      const adventure = adventures.find(a => a.id === adventureId)
      if (!adventure) return
      adventure.notes = (adventure.notes || []).filter(n => n.id !== noteId)
    } else if (scope.startsWith('char-')) {
      const uid = scope.slice(5)
      const p = compendiumData.players.find(x => x.uid === uid)
        || compendiumData.npcs.find(x => x.uid === uid)
      if (!p) return
      p.notes = (p.notes || []).filter(n => n.id !== noteId)
    }
    persistNotes(scope)
    renderNotes(scope)
  })
}

function toggleNote(scope, noteId) {
  const body  = document.getElementById('note-body-'  + noteId)
  const arrow = document.getElementById('note-arrow-' + noteId)
  if (!body) return
  const open = body.style.display !== 'none'
  body.style.display = open ? 'none' : 'block'
  if (arrow) arrow.textContent = open ? '▼' : '▲'
}

function toggleEncNotes() {
  if (enc.addOpen) {
    enc.addOpen = false
    const addPanel = document.getElementById('enc-add-panel')
    const addBtn   = document.getElementById('enc-add-btn')
    if (addPanel) {
      addPanel.style.transform = 'translateX(100%)'
      addPanel.style.width = '0'
      addPanel.style.padding = '0'
      addPanel.style.overflow = 'hidden'
    }
    if (addBtn)   { addBtn.innerHTML = '+'; addBtn.style.right = '12px' }
  }
  enc.notesOpen = !enc.notesOpen
  const panel   = document.getElementById('enc-notes-panel')
  const overlay = document.getElementById('enc-overlay')
  if (!panel) return
  if (enc.notesOpen) {
    panel.style.width = '320px'
    panel.style.padding = '16px'
    panel.style.overflowY = 'auto'
    panel.style.transform = 'translateX(0)'
    if (overlay) overlay.style.display = 'block'
    renderNotes('enc')
  } else {
    panel.style.transform = 'translateX(100%)'
    panel.style.width = '0'
    panel.style.padding = '0'
    panel.style.overflow = 'hidden'
    if (overlay) overlay.style.display = 'none'
  }
}

function closeEncPanels() {
  if (enc.addOpen) {
    enc.addOpen = false
    const addPanel = document.getElementById('enc-add-panel')
    const addBtn   = document.getElementById('enc-add-btn')
    if (addPanel) {
      addPanel.style.transform = 'translateX(100%)'
      addPanel.style.width = '0'
      addPanel.style.padding = '0'
      addPanel.style.overflow = 'hidden'
    }
    if (addBtn)   { addBtn.innerHTML = '+'; addBtn.style.right = '12px' }
  }
  if (enc.notesOpen) {
    enc.notesOpen = false
    const notesPanel = document.getElementById('enc-notes-panel')
    if (notesPanel) {
      notesPanel.style.transform = 'translateX(100%)'
      notesPanel.style.width = '0'
      notesPanel.style.padding = '0'
      notesPanel.style.overflow = 'hidden'
    }
  }
  const overlay = document.getElementById('enc-overlay')
  if (overlay) overlay.style.display = 'none'
}

// ── Adventures ────────────────────────────────────────────────────
function createAdventure() {
  const existing = document.getElementById('adventure-create-form')
  if (existing) {
    existing.remove()
    return
  }

  const addButton = document.querySelector('[onclick="createAdventure()"]')
  if (!addButton) return

  const form = document.createElement('div')
  form.id = 'adventure-create-form'
  form.style.cssText = `
    background:#0a1520;border:1px solid #2a3a5a;border-radius:4px;
    padding:12px;margin-bottom:12px;
  `
  form.innerHTML = `
    <input type="text" id="adventure-name-input" placeholder="Adventure name..."
      style="width:100%;box-sizing:border-box;background:#262F35;border:1px solid #2a3a5a;
             color:#e0d5c5;padding:8px 12px;border-radius:4px;font-family:var(--app-font);
             font-size:13px;margin-bottom:8px;"
      onkeydown="if(event.key==='Enter')document.getElementById('adventure-create-btn').click();if(event.key==='Escape')document.getElementById('adventure-create-form').remove()" />
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button onclick="document.getElementById('adventure-create-form').remove()"
        style="background:none;border:1px solid #2a3a5a;color:#888;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:12px;">
        Cancel
      </button>
      <button id="adventure-create-btn" onclick="submitCreateAdventure()"
        style="background:#4a9a9a;color:#e0d5c5;border:none;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:12px;">
        Create
      </button>
    </div>
  `

  addButton.parentElement.parentElement.insertBefore(form, addButton.parentElement.nextSibling)
  setTimeout(() => document.getElementById('adventure-name-input')?.focus(), 50)
}

function submitCreateAdventure() {
  const input = document.getElementById('adventure-name-input')
  const name = input?.value?.trim()
  if (!name) return

  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const id = 'adv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

  adventures.push({
    id,
    name: name,
    description: '',
    status: 'planned',
    notes: [],
    npcUids: [],
    encounterIds: []
  })

  compendiumData.campaigns[campaign].adventures = adventures
  saveCampaigns(compendiumData.campaigns)

  document.getElementById('adventure-create-form')?.remove()
  openAdventure(id)
}

function openAdventure(id, skipHistory = false) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === id)
  if (!adventure) return

  if (!skipHistory) pushNav('adventure-detail', id)
  else currentScreen = { screen: 'adventure-detail', uid: id }

  const content = document.getElementById('content')
  content.style.padding = '20px 20px 20px 260px'
  content.scrollTop = 0

  const allNPCs = compendiumData.npcs || []
  const allEncounters = (enc.list[campaign] || []).map(e => e.id)

  content.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
      <button onclick="popNav()"
        style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        ← Back
      </button>
      <div style="flex:1;">
        <h2 style="font-size:22px;color:#e0d5c5;margin:0;">${adventure.name}</h2>
      </div>
      <select onchange="updateAdventureStatus('${id}', this.value)"
        style="background:#262F35;border:1px solid #4a9a9a;color:#e0d5c5;padding:6px 12px;
               border-radius:4px;font-family:var(--app-font);font-size:13px;">
        <option value="planned" ${adventure.status === 'planned' ? 'selected' : ''}>Planned</option>
        <option value="active" ${adventure.status === 'active' ? 'selected' : ''}>Active</option>
        <option value="completed" ${adventure.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>
      <button onclick="deleteAdventure('${id}')"
        style="background:#8b0000;border:2px solid #5a0000;color:#e0d5c5;padding:6px 14px;
               cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
        Delete
      </button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;margin-bottom:18px;">
          <div style="font-size:14px;color:#1E231A;letter-spacing:.1em;font-weight:700;margin-bottom:8px;">
            DESCRIPTION
          </div>
          <textarea id="adv-description" rows="6"
            onchange="updateAdventureDescription('${id}', this.value)"
            style="width:100%;background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;
                   padding:10px;border-radius:4px;font-family:var(--app-font);font-size:13px;
                   resize:vertical;">${adventure.description || ''}</textarea>
        </div>

        <div id="adventure-notes-section"></div>

        <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;margin-top:18px;">
          <div style="font-size:14px;color:#1E231A;letter-spacing:.1em;font-weight:700;margin-bottom:8px;">
            ASSOCIATED NPCS
          </div>
          ${allNPCs.length === 0 ? '<div style="color:#1E231A;font-size:13px;">No NPCs in campaign</div>' : ''}
          ${allNPCs.map(npc => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              ${circleToggle('npc-' + npc.uid, (adventure.npcUids || []).includes(npc.uid),
                `toggleAdventureNPC('${id}', '${npc.uid}', !((compendiumData.campaigns['${campaign}'].adventures['${id}'].npcUids || []).includes('${npc.uid}')))`,
                `<span onclick="event.stopPropagation(); showNPC('${npc.uid}')" style="cursor:pointer;">${npc.properName || npc.label || npc.name}</span>`)}
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;">
          <div style="font-size:14px;color:#1E231A;letter-spacing:.1em;font-weight:700;margin-bottom:8px;">
            ENCOUNTERS
          </div>
          <div id="adventure-encounters">
            ${(adventure.encounterIds || []).map(encId => {
              const encounter = (enc.list[campaign] || []).find(e => e.id === encId)
              if (!encounter) return ''
              const { totalXP, difficulty } = calculateEncounterDifficulty(encounter)
              const difficultyColors = {
                Low: '#888',
                Moderate: '#d4a020',
                High: '#d9534f',
                Unknown: '#555'
              }
              const difficultyIcons = {
                Low: 'Light_Encounter.png',
                Moderate: 'Medium_Encounter.png',
                High: 'Difficult_Encounter.png'
              }
              const diffColor = difficultyColors[difficulty] || '#888'
              const diffIcon = difficultyIcons[difficulty]
              return `
                <div style="background:#5C5C5C;border:4px solid #2E2F2D;padding:10px;
                            border-radius:4px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
                  <span style="flex:1;color:#e0d5c5;font-size:13px;">${encounter.name}</span>
                  ${totalXP > 0 ? `
                    <div style="font-size:12px;color:#888;text-align:right;white-space:nowrap;">
                      ${totalXP.toLocaleString()} XP<br>
                      <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
                        ${diffIcon ? `<img src="assets/${diffIcon}" alt="${difficulty}"
                          style="width:16px;height:16px;object-fit:contain;" />` : ''}
                        <span style="color:${diffColor};font-weight:600;">${difficulty}</span>
                      </div>
                    </div>
                  ` : ''}
                  <button onclick="runEncounter('${encId}')"
                    style="background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;padding:7px 14px;
                           cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
                    ▶ Run
                  </button>
                  <button onclick="removeAdventureEncounter('${id}', '${encId}')"
                    style="background:none;border:none;color:#4a9a9a;cursor:pointer;font-size:16px;">
                    ×
                  </button>
                </div>
              `
            }).join('')}
          </div>
          <button onclick="showAddEncounterToAdventure('${id}')"
            style="background:#3E3E3D;color:#1E231A;border:none;padding:6px 14px;
                   cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;margin-top:8px;font-weight:700;">
            + Add Encounter
          </button>
        </div>
      </div>
    </div>
  `

  renderNotes('adventure-' + id)
}

function updateAdventureStatus(id, status) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === id)
  if (!adventure) return

  adventure.status = status
  saveCampaigns(compendiumData.campaigns)
}

function updateAdventureDescription(id, description) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === id)
  if (!adventure) return

  adventure.description = description
  saveCampaigns(compendiumData.campaigns)
}

function toggleAdventureNPC(adventureId, npcUid, checked) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === adventureId)
  if (!adventure) return

  if (!adventure.npcUids) adventure.npcUids = []

  if (checked) {
    if (!adventure.npcUids.includes(npcUid)) {
      adventure.npcUids.push(npcUid)
    }
  } else {
    adventure.npcUids = adventure.npcUids.filter(uid => uid !== npcUid)
  }

  saveCampaigns(compendiumData.campaigns)
}

function removeAdventureEncounter(adventureId, encounterId) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === adventureId)
  if (!adventure) return

  confirmDelete('Remove encounter from adventure?', () => {
    adventure.encounterIds = (adventure.encounterIds || []).filter(id => id !== encounterId)
    saveCampaigns(compendiumData.campaigns)
    openAdventure(adventureId, true)
  })
}

function showAddEncounterToAdventure(adventureId) {
  const campaign = compendiumData.activeCampaign
  if (!campaign) return

  const allEncounters = (enc.list[campaign] || [])
  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === adventureId)
  if (!adventure) return

  const available = allEncounters.filter(e => !(adventure.encounterIds || []).includes(e.id))

  if (available.length === 0) {
    showToast('All encounters already added')
    return
  }

  const overlay = document.createElement('div')
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;
    display:flex;align-items:center;justify-content:center;`
  overlay.innerHTML = `
    <div style="background:#262F35;border:2px solid #4a9a9a;border-radius:8px;
                padding:24px;max-width:400px;font-family:var(--app-font);">
      <div style="font-size:16px;font-weight:bold;color:#e0d5c5;margin-bottom:16px;">
        Add Encounter to Adventure
      </div>
      <select id="encounter-select"
        style="width:100%;background:#1A1C1E;border:1px solid #2a3a5a;color:#e0d5c5;
               padding:8px;border-radius:4px;font-family:var(--app-font);margin-bottom:16px;">
        ${available.map(e => `<option value="${e.id}">${e.name || e.id}</option>`).join('')}
      </select>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="this.closest('div[style*=fixed]').remove()"
          style="background:none;border:1px solid #2a3a5a;color:#888;padding:6px 16px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
          Cancel
        </button>
        <button onclick="const sel=document.getElementById('encounter-select');addEncounterToAdventure('${adventureId}',sel.value);this.closest('div[style*=fixed]').remove()"
          style="background:#4a9a9a;color:#e0d5c5;border:none;padding:6px 16px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
          Add
        </button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function addEncounterToAdventure(adventureId, encounterId) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === adventureId)
  if (!adventure) return

  if (!adventure.encounterIds) adventure.encounterIds = []
  if (!adventure.encounterIds.includes(encounterId)) {
    adventure.encounterIds.push(encounterId)
  }

  saveCampaigns(compendiumData.campaigns)
  openAdventure(adventureId, true)
}

function deleteAdventure(adventureId) {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return

  const adventures = compendiumData.campaigns[campaign].adventures || []
  const adventure = adventures.find(a => a.id === adventureId)
  if (!adventure) return

  confirmDelete('Delete adventure?', () => {
    compendiumData.campaigns[campaign].adventures = adventures.filter(a => a.id !== adventureId)
    saveCampaigns(compendiumData.campaigns)
    showSection('home')
  })
}

function renderAdventuresSection() {
  const campaign = compendiumData.activeCampaign
  if (!campaign || !compendiumData.campaigns[campaign]) return ''

  const adventures = compendiumData.campaigns[campaign].adventures || []

  const statusBadge = (status) => {
    const colors = {
      planned: '#666',
      active: '#4a9a9a',
      completed: '#2a5a2a'
    }
    return `<span style="background:${colors[status] || '#666'};color:#e0d5c5;
      font-size:10px;padding:3px 8px;border-radius:3px;letter-spacing:.06em;
      font-weight:700;">${status.toUpperCase()}</span>`
  }

  return `
    <div style="background:#5C5C5C;border:4px solid #2E2F2D;border-radius:8px;padding:20px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <span style="font-size:16px;color:#1E231A;letter-spacing:.1em;font-weight:700;">
          ADVENTURES
        </span>
        <button onclick="createAdventure()"
          style="background:#1E231A;color:#8E8E8E;border:2px solid #445E22;padding:6px 14px;
                 cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);font-weight:700;">
          + Add
        </button>
      </div>
      ${adventures.length === 0 ? `
        <div style="color:#1E231A;font-size:13px;">
          No adventures yet. Create one to organize your campaign's storylines.
        </div>
      ` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;">
          ${adventures.map(adv => `
            <div onclick="openAdventure('${adv.id}')"
              style="background:#262F35;border:1px solid #1e2d4a;padding:14px;border-radius:5px;
                     cursor:pointer;"
              onmouseover="this.style.borderColor='#4a9a9a'"
              onmouseout="this.style.borderColor='#1e2d4a'">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <div style="flex:1;font-weight:bold;font-size:14px;color:#e0d5c5;">
                  ${adv.name}
                </div>
                ${statusBadge(adv.status)}
              </div>
              <div style="font-size:12px;color:#888;">
                ${(adv.npcUids || []).length} NPCs · ${(adv.encounterIds || []).length} Encounters
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `
}

// ── Auto-load ─────────────────────────────────────────────────────
function autoLoad() {
  const savedCompendium = loadCompendium()
  if (savedCompendium) {
    try {
      compendiumData.monsters = (savedCompendium.monsters || []).sort((a, b) => a.name.localeCompare(b.name))
      compendiumData.spells   = (savedCompendium.spells   || []).sort((a, b) => a.name.localeCompare(b.name))

      // One-time spell migration: convert old format to new format
      let spellsMigrated = 0
      const schoolCodeMap = {
        'A': 'Abjuration',
        'C': 'Conjuration',
        'D': 'Divination',
        'EN': 'Enchantment',
        'EV': 'Evocation',
        'I': 'Illusion',
        'N': 'Necromancy',
        'T': 'Transmutation',
        '': 'None'
      }

      for (const spell of compendiumData.spells) {
        let needsMigration = false

        // a) Migrate school: convert letter codes to full names (run on ALL spells)
        if (spell.school && (spell.school.length <= 2 || schoolCodeMap[spell.school])) {
          // It's a letter code or known short code
          const fullName = schoolCodeMap[spell.school]
          if (fullName) {
            spell.school = fullName
            needsMigration = true
          }
        } else if (!spell.school || spell.school === '') {
          spell.school = 'None'
          needsMigration = true
        }

        // b) Migrate components: parse string into separate fields
        // Run on ALL spells where verbal is undefined OR where verbal is false but components string exists
        // (catches Format B XML that was imported before the parser update)
        if (spell.verbal === undefined || (spell.verbal === false && spell.components)) {
          const comp = spell.components || ''
          spell.verbal = comp.includes('V')
          spell.somatic = comp.includes('S')
          spell.material = comp.includes('M')

          // Extract materials text from parentheses
          spell.materials = ''
          if (spell.material) {
            const match = comp.match(/M \(([^)]+)\)/)
            if (match) {
              spell.materials = match[1]
            }
          }

          needsMigration = true
        }

        // c) Migrate ritual: check if undefined
        if (spell.ritual === undefined) {
          // Check if name ends with (Ritual Only)
          spell.ritual = spell.name.endsWith('(Ritual Only)') || spell.name.includes('(ritual)')
          needsMigration = true
        }

        // d) Migrate concentration: check if undefined
        if (spell.concentration === undefined) {
          const duration = spell.duration || ''
          spell.concentration = duration.toLowerCase().includes('concentration')
          needsMigration = true
        }

        if (needsMigration) spellsMigrated++
      }

      if (spellsMigrated > 0) {
        console.log(`[Spell Migration] Migrated ${spellsMigrated} spell(s) to new format`)
        // Save migrated data
        saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })
      }

      // One-time monster type migration: extract subtypes from type field into tag field
      console.log('[Monster Type Migration] Starting migration check...')
      console.log(`[Monster Type Migration] Total monsters loaded: ${compendiumData.monsters.length}`)
      let monstersMigrated = 0
      let undefinedTagsCleaned = 0
      for (const monster of compendiumData.monsters) {
        // FIX 1A: Clean up existing "undefined" string tags
        if (monster.tag === 'undefined') {
          monster.tag = ''
          undefinedTagsCleaned++
        }

        // Only migrate if tag is empty/undefined AND type contains "("
        const needsMigration = (!monster.tag || monster.tag === '') && monster.type && monster.type.includes('(')
        if (needsMigration) {
          const rawType = monster.type
          let baseType = rawType
          let subtypeTag = ''

          // Split on "(" - handle both "(subtype)" and "(subtype" (missing closing paren)
          const parts = rawType.split('(')
          baseType = parts[0].trim()
          // Everything after "(" - strip any trailing ")" if present
          subtypeTag = parts[1] ? parts[1].replace(/\)\s*$/, '').trim() : ''

          // Title-case helper (same as in parseMonsterNode)
          function titleCase(str) {
            if (!str || str.length <= 1 || str === '$' || /^[A-Z]{1,3}$/.test(str)) {
              return str
            }
            if (str.toLowerCase() === 'varies') {
              return str.toLowerCase()
            }
            const lowercase = ['of', 'the', 'a', 'an', 'in', 'from', 'with', 'and', 'or', 'but', 'for', 'to', 'at', 'by', 'on']
            return str.split(' ').map((word, index) => {
              if (!word) return word
              const lower = word.toLowerCase()
              if (index === 0) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              }
              if (lowercase.includes(lower)) {
                return lower
              }
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            }).join(' ')
          }

          // Update monster with normalized values
          monster.type = titleCase(baseType)
          // FIX 1B: Only set tag if subtypeTag is non-empty
          monster.tag = subtypeTag ? titleCase(subtypeTag) : ''
          monstersMigrated++
        }
      }

      if (undefinedTagsCleaned > 0) {
        console.log(`[Monster Type Migration] Cleaned up ${undefinedTagsCleaned} "undefined" string tags`)
      }

      console.log(`[Monster Type Migration] Migration complete: ${monstersMigrated} monsters migrated`)
      if (monstersMigrated > 0) {
        console.log(`[Monster Type Migration] Migrated ${monstersMigrated} monster(s) - extracted subtypes from type field into tag field`)
      }

      // Save if either cleanup or migration occurred
      if (undefinedTagsCleaned > 0 || monstersMigrated > 0) {
        saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })
      }
    } catch (err) {
      console.error('Auto-load compendium failed:', err)
      console.error('Stack trace:', err.stack)
    }
  }

  const savedCampaigns = loadCampaigns()
  if (savedCampaigns) {
    try {
      compendiumData.campaigns = savedCampaigns

      // One-time migration: convert old PC format to new format
      let migratedCount = 0
      for (const campName in compendiumData.campaigns) {
        const camp = compendiumData.campaigns[campName]
        const pcs = Array.isArray(camp) ? camp.filter(p => !p.isNPC) : (camp.players || [])

        for (const pc of pcs) {
          // Check if PC needs migration (has hpValue but not hpMax)
          if ((pc.hpValue || pc._draft?.hpValue) && !pc.hpMax) {
            console.log(`[Migration] Converting PC: ${pc.name}`)

            // Get source data (prefer _draft if it exists)
            const src = pc._draft || pc

            // Add normalized HP fields
            pc.hpMax = src.hpValue || 1
            pc.hpCurrent = src.hpValue || 1

            // Add abilities array if missing
            if (!pc.abilities) {
              pc.abilities = [
                String(src.str || 10),
                String(src.dex || 10),
                String(src.con || 10),
                String(src.int || 10),
                String(src.wis || 10),
                String(src.cha || 10)
              ]
            }

            // Normalize traits
            if (pc.traits) {
              pc.traits = pc.traits.map(t => {
                if (t.limitedUsage && !t.charges && !t.chargesCurrent) {
                  const lu = t.limitedUsage
                  let recharge = null
                  if (lu.type === 'recharge_5_6') recharge = 5
                  else if (lu.type === 'recharge_6') recharge = 6
                  else if (lu.type?.startsWith('recharge_')) {
                    const match = lu.type.match(/recharge_(\d+)/)
                    if (match) recharge = parseInt(match[1])
                  }

                  const charges = lu.type === 'per_day' || lu.type === 'charges' ? (lu.count || null) : null

                  return {...t, charges, chargesCurrent: charges, recharge}
                }
                return t
              })
            }

            // Normalize actions
            if (pc.actions) {
              pc.actions = pc.actions.map(a => {
                if (a.limitedUsage && !a.charges && !a.chargesCurrent) {
                  const lu = a.limitedUsage
                  let recharge = null
                  if (lu.type === 'recharge_5_6') recharge = 5
                  else if (lu.type === 'recharge_6') recharge = 6
                  else if (lu.type?.startsWith('recharge_')) {
                    const match = lu.type.match(/recharge_(\d+)/)
                    if (match) recharge = parseInt(match[1])
                  }

                  const charges = lu.type === 'per_day' || lu.type === 'charges' ? (lu.count || null) : null

                  return {...a, charges, chargesCurrent: charges, recharge}
                }
                return a
              })
            }

            migratedCount++
          }
        }
      }

      if (migratedCount > 0) {
        console.log(`[Migration] Converted ${migratedCount} PC(s) to new format`)
        saveCampaigns(compendiumData.campaigns)
      }

      const names = Object.keys(compendiumData.campaigns)
      if (names.length > 0) {
        compendiumData.activeCampaign = names[0]
        const camp = compendiumData.campaigns[names[0]] || []
        const byName = (a, b) => (a.label || a.name).localeCompare(b.label || b.name)
        if (Array.isArray(camp)) {
          const sorted = camp.sort(byName)
          compendiumData.players = sorted.filter(p => !p.isNPC)
          compendiumData.npcs    = sorted.filter(p => p.isNPC)
        } else {
          compendiumData.players = (camp.players || []).sort(byName)
          compendiumData.npcs = (camp.npcs || []).sort(byName)
        }
      }
    } catch (err) { console.error('Auto-load campaigns failed:', err) }
  }

  const savedEncounters = loadEncounters()
  if (savedEncounters) {
    try {
      enc.list = savedEncounters

      // Migrate saved encounter combatants to refresh broken/missing data from current PC state
      let encountersMigrated = 0
      let combatantsMigrated = 0


      for (const campName in enc.list) {
        const encounters = enc.list[campName] || []
        const camp = compendiumData.campaigns[campName]
        if (!camp) {
          continue
        }

        const campaignPCs = Array.isArray(camp) ? camp.filter(p => !p.isNPC) : (camp.players || [])

        for (const encounter of encounters) {
          if (!encounter.combatants) continue


          let encounterChanged = false

          for (const combatant of encounter.combatants) {
            if (!combatant.isPC) continue


            // Find matching PC by name (combatant doesn't store original PC uid)
            const matchingPC = campaignPCs.find(pc =>
              (pc.name === combatant.name || pc.label === combatant.name)
            )

            if (!matchingPC) {
              continue
            }


            // Check if any field needs refresh by comparing against PC's current data
            let needsRefresh = false
            let fieldsToRefresh = []

            // Check hpMax (preserve hpCurrent - that's combat state)
            const sourceHpMax = parseInt(matchingPC.hpMax ?? matchingPC.hpValue ?? matchingPC._draft?.hpMax ?? matchingPC._draft?.hpValue)
            if (sourceHpMax && combatant.hpMax !== sourceHpMax) {
              needsRefresh = true
              fieldsToRefresh.push(`hpMax: ${combatant.hpMax} -> ${sourceHpMax}`)
            }

            // Check AC (PC Builder uses acValue, XML uses ac)
            const sourceAC = parseInt(matchingPC.acValue ?? matchingPC.ac ?? matchingPC._draft?.acValue ?? matchingPC._draft?.ac)
            if (sourceAC && combatant.ac !== sourceAC) {
              needsRefresh = true
              fieldsToRefresh.push(`ac: ${combatant.ac} -> ${sourceAC}`)
            }

            // Check spell data (selectedSpells, spellSlots, etc.)
            const needsSpellRefresh =
              (!combatant.selectedSpells || combatant.selectedSpells.length === 0) &&
              (matchingPC.selectedSpells && matchingPC.selectedSpells.length > 0)
            if (needsSpellRefresh) {
              needsRefresh = true
              fieldsToRefresh.push(`selectedSpells: ${combatant.selectedSpells?.length || 0} -> ${matchingPC.selectedSpells?.length || 0}`)
            }

            // Check spell slots (only if null/undefined, preserve array even if all zeros)
            const needsSpellSlots =
              (combatant.spellSlots === null || combatant.spellSlots === undefined) &&
              (matchingPC.spellSlots && Array.isArray(matchingPC.spellSlots))
            if (needsSpellSlots) {
              needsRefresh = true
              fieldsToRefresh.push(`spellSlots: null -> array`)
            }

            // Check abilities array
            const abilitiesMatch = combatant.abilities && matchingPC.abilities &&
              JSON.stringify(combatant.abilities) === JSON.stringify(matchingPC.abilities)
            if (!abilitiesMatch && matchingPC.abilities) {
              needsRefresh = true
              fieldsToRefresh.push(`abilities: ${JSON.stringify(combatant.abilities)} -> ${JSON.stringify(matchingPC.abilities)}`)
            }

            // Check individual ability scores (for modifier calculations)
            if (matchingPC.abilities) {
              const expectedStr = parseInt(matchingPC.abilities[0]) || 10
              const expectedDex = parseInt(matchingPC.abilities[1]) || 10
              const expectedCon = parseInt(matchingPC.abilities[2]) || 10
              const expectedInt = parseInt(matchingPC.abilities[3]) || 10
              const expectedWis = parseInt(matchingPC.abilities[4]) || 10
              const expectedCha = parseInt(matchingPC.abilities[5]) || 10

              if (combatant.str !== expectedStr || combatant.dex !== expectedDex ||
                  combatant.con !== expectedCon || combatant.int !== expectedInt ||
                  combatant.wis !== expectedWis || combatant.cha !== expectedCha) {
                needsRefresh = true
                fieldsToRefresh.push(`ability scores (individual fields)`)
              }
            }

            // Backfill notes if missing or empty (independent of other refresh checks)
            if ((!combatant.notes || combatant.notes.length === 0) &&
                matchingPC.notes && matchingPC.notes.length > 0) {
              combatant.notes = [...matchingPC.notes]
              encounterChanged = true
              combatantsMigrated++
              console.log(`[Encounter Migration] Backfilled notes for ${combatant.name} in "${encounter.name}" (${matchingPC.notes.length} notes)`)
            }

            // Backfill skills, savingThrows, senses, languages, and passive fields
            if ((!combatant.skills || combatant.skills.length === 0) &&
                matchingPC.skills && matchingPC.skills.length > 0) {
              combatant.skills = [...matchingPC.skills]
              encounterChanged = true
            }
            if ((!combatant.savingThrows || combatant.savingThrows.length === 0) &&
                matchingPC.savingThrows && matchingPC.savingThrows.length > 0) {
              combatant.savingThrows = [...matchingPC.savingThrows]
              encounterChanged = true
            }
            if ((!combatant.senses || combatant.senses === '') && matchingPC.senses) {
              combatant.senses = matchingPC.senses
              encounterChanged = true
            }
            if ((!combatant.languages || combatant.languages === '') && matchingPC.languages) {
              combatant.languages = matchingPC.languages
              encounterChanged = true
            }
            if ((!combatant.passive || combatant.passive === '') && matchingPC.passive) {
              combatant.passive = matchingPC.passive
              encounterChanged = true
            }
            if (combatant.passiveInsight === undefined && matchingPC.passiveInsight !== undefined) {
              combatant.passiveInsight = matchingPC.passiveInsight
              encounterChanged = true
            }
            if (combatant.passiveInvestigation === undefined && matchingPC.passiveInvestigation !== undefined) {
              combatant.passiveInvestigation = matchingPC.passiveInvestigation
              encounterChanged = true
            }

            if (needsRefresh) {
              console.log(`[Encounter Migration] Refreshing ${combatant.name} in "${encounter.name}"`)

              // Refresh hpMax (preserve hpCurrent for in-combat damage state)
              const sourceHpMax = parseInt(matchingPC.hpMax ?? matchingPC.hpValue ?? matchingPC._draft?.hpMax ?? matchingPC._draft?.hpValue)
              if (sourceHpMax && combatant.hpMax !== sourceHpMax) {
                combatant.hpMax = sourceHpMax
              }

              // Refresh AC (PC Builder uses acValue, XML uses ac)
              const sourceAC = parseInt(matchingPC.acValue ?? matchingPC.ac ?? matchingPC._draft?.acValue ?? matchingPC._draft?.ac)
              if (sourceAC && combatant.ac !== sourceAC) {
                combatant.ac = sourceAC
              }

              // Refresh spell data if missing
              if ((!combatant.selectedSpells || combatant.selectedSpells.length === 0) &&
                  (matchingPC.selectedSpells && matchingPC.selectedSpells.length > 0)) {
                combatant.selectedSpells = [...matchingPC.selectedSpells]
              }

              // Refresh spell slots (only if null/undefined, preserve existing array even if all zeros)
              if ((combatant.spellSlots === null || combatant.spellSlots === undefined) &&
                  matchingPC.spellSlots && Array.isArray(matchingPC.spellSlots)) {
                // Build spell slots from PC's spellSlots array
                combatant.spellSlots = matchingPC.spellSlots
                  .map((total, i) => ({ level: i + 1, total: parseInt(total) || 0, used: 0 }))
                  .filter(slot => slot.total > 0)
              }

              // Refresh spellcasting metadata if missing
              if (!combatant.spellcastingType && matchingPC.spellcastingType) {
                combatant.spellcastingType = matchingPC.spellcastingType
              }
              if ((combatant.spellAttackMod === null || combatant.spellAttackMod === undefined) &&
                  (matchingPC.spellAttackMod !== null && matchingPC.spellAttackMod !== undefined)) {
                combatant.spellAttackMod = matchingPC.spellAttackMod
              }
              if ((combatant.spellSaveDC === null || combatant.spellSaveDC === undefined) &&
                  (matchingPC.spellSaveDC !== null && matchingPC.spellSaveDC !== undefined)) {
                combatant.spellSaveDC = matchingPC.spellSaveDC
              }

              // Refresh abilities array
              if (matchingPC.abilities) {
                const abilitiesMatch = combatant.abilities &&
                  JSON.stringify(combatant.abilities) === JSON.stringify(matchingPC.abilities)
                if (!abilitiesMatch) {
                  combatant.abilities = [...matchingPC.abilities]
                }
              }

              // Refresh individual ability scores (for modifier calculations)
              if (matchingPC.abilities) {
                combatant.str = parseInt(matchingPC.abilities[0]) || 10
                combatant.dex = parseInt(matchingPC.abilities[1]) || 10
                combatant.con = parseInt(matchingPC.abilities[2]) || 10
                combatant.int = parseInt(matchingPC.abilities[3]) || 10
                combatant.wis = parseInt(matchingPC.abilities[4]) || 10
                combatant.cha = parseInt(matchingPC.abilities[5]) || 10
              } else if (matchingPC.str !== undefined) {
                combatant.str = matchingPC.str || 10
                combatant.dex = matchingPC.dex || 10
                combatant.con = matchingPC.con || 10
                combatant.int = matchingPC.int || 10
                combatant.wis = matchingPC.wis || 10
                combatant.cha = matchingPC.cha || 10
              }

              // Refresh trait uses/charges
              if (combatant.traits && matchingPC.traits) {
                let traitsFixed = 0
                combatant.traits = combatant.traits.map((ct, idx) => {
                  const matchingTrait = matchingPC.traits.find(pt => pt.name === ct.name) || matchingPC.traits[idx]
                  if (matchingTrait) {
                    // Get charges from source PC (check both direct field and limitedUsage)
                    const sourceCharges = matchingTrait.charges ??
                      (matchingTrait.limitedUsage?.type === 'per_day' || matchingTrait.limitedUsage?.type === 'charges'
                        ? matchingTrait.limitedUsage.count
                        : null)
                    const sourceChargesCurrent = matchingTrait.chargesCurrent ?? sourceCharges

                    // Refresh if charges/chargesCurrent are missing or don't match
                    const chargesNeedRefresh =
                      (ct.charges === null || ct.charges === undefined) ||
                      (sourceCharges !== null && ct.charges !== sourceCharges)

                    if (chargesNeedRefresh && sourceCharges !== null) {
                      traitsFixed++
                      return {
                        ...ct,
                        charges: sourceCharges,
                        chargesCurrent: sourceChargesCurrent ?? sourceCharges,
                        recharge: matchingTrait.recharge
                      }
                    }
                  }
                  return ct
                })
              } else {
              }

              // Refresh action uses similarly
              if (combatant.actions && matchingPC.actions) {
                let actionsFixed = 0
                combatant.actions = combatant.actions.map((ca, idx) => {
                  const matchingAction = matchingPC.actions.find(pa => pa.name === ca.name) || matchingPC.actions[idx]
                  if (matchingAction) {
                    // Get charges from source PC (check both direct field and limitedUsage)
                    const sourceCharges = matchingAction.charges ??
                      (matchingAction.limitedUsage?.type === 'per_day' || matchingAction.limitedUsage?.type === 'charges'
                        ? matchingAction.limitedUsage.count
                        : null)
                    const sourceChargesCurrent = matchingAction.chargesCurrent ?? sourceCharges

                    // Refresh if charges/chargesCurrent are missing or don't match
                    const chargesNeedRefresh =
                      (ca.charges === null || ca.charges === undefined) ||
                      (sourceCharges !== null && ca.charges !== sourceCharges)

                    if (chargesNeedRefresh && sourceCharges !== null) {
                      actionsFixed++
                      return {
                        ...ca,
                        charges: sourceCharges,
                        chargesCurrent: sourceChargesCurrent ?? sourceCharges,
                        recharge: matchingAction.recharge
                      }
                    }
                  }
                  return ca
                })
              } else {
              }

              combatantsMigrated++
              encounterChanged = true
            }
          }

          // Migrate NPC combatants to backfill notes
          const campaignNPCs = Array.isArray(camp) ? camp.filter(p => p.isNPC) : (camp.npcs || [])
          for (const combatant of encounter.combatants) {
            if (combatant.isPC) continue // Skip PCs, already handled above

            // Find matching NPC by name
            const matchingNPC = campaignNPCs.find(npc =>
              (npc.name === combatant.name || npc.label === combatant.name)
            )

            if (!matchingNPC) continue

            // Backfill notes if missing or empty
            if ((!combatant.notes || combatant.notes.length === 0) &&
                matchingNPC.notes && matchingNPC.notes.length > 0) {
              combatant.notes = [...matchingNPC.notes]
              encounterChanged = true
              combatantsMigrated++
            }

            // Backfill skills, savingThrows, senses, and languages for NPCs
            if ((!combatant.skills || combatant.skills.length === 0) &&
                matchingNPC.skills && matchingNPC.skills.length > 0) {
              combatant.skills = [...matchingNPC.skills]
              encounterChanged = true
            }
            if ((!combatant.savingThrows || combatant.savingThrows.length === 0) &&
                matchingNPC.savingThrows && matchingNPC.savingThrows.length > 0) {
              combatant.savingThrows = [...matchingNPC.savingThrows]
              encounterChanged = true
            }
            if ((!combatant.senses || combatant.senses === '') && matchingNPC.senses) {
              combatant.senses = matchingNPC.senses
              encounterChanged = true
            }
            if ((!combatant.languages || combatant.languages === '') && matchingNPC.languages) {
              combatant.languages = matchingNPC.languages
              encounterChanged = true
            }

            // Backfill selectedSpells from spells for existing NPC combatants
            if ((!combatant.selectedSpells || combatant.selectedSpells.length === 0) &&
                combatant.spells && Array.isArray(combatant.spells) && combatant.spells.length > 0) {
              combatant.selectedSpells = [...combatant.spells]
              encounterChanged = true
            }
          }

          // Migrate Monster combatants to backfill skills, saves, senses, languages, and attack data
          for (const combatant of encounter.combatants) {
            if (combatant.isPC) continue // Skip PCs, already handled above

            // Find matching monster by name (for non-PC, non-custom combatants)
            const matchingMonster = compendiumData.monsters.find(m =>
              m.name === combatant.name
            )

            if (!matchingMonster) continue

            // Backfill skills, savingThrows, senses, and languages for Monsters
            // Monsters use string fields (skill, save) not arrays
            if (combatant.skills === undefined || combatant.skills === '') {
              combatant.skills = matchingMonster.skill || matchingMonster.skills || ''
              if (combatant.skills) encounterChanged = true
            }
            if (combatant.savingThrows === undefined || combatant.savingThrows === '') {
              combatant.savingThrows = matchingMonster.save || matchingMonster.savingThrows || ''
              if (combatant.savingThrows) encounterChanged = true
            }
            if (combatant.senses === undefined || combatant.senses === '') {
              combatant.senses = matchingMonster.senses || ''
              if (combatant.senses) encounterChanged = true
            }
            if (combatant.languages === undefined || combatant.languages === '') {
              combatant.languages = matchingMonster.languages || ''
              if (combatant.languages) encounterChanged = true
            }

            // Backfill attack data for actions
            if (combatant.actions && matchingMonster.actions) {
              for (const combatantAction of combatant.actions) {
                // Find matching source action by name
                const sourceAction = matchingMonster.actions.find(a => a.name === combatantAction.name)
                if (sourceAction && sourceAction.attack && !combatantAction.attack) {
                  // Copy attack object from source
                  combatantAction.attack = { ...sourceAction.attack }
                  encounterChanged = true
                }
              }
            }

            // Backfill selectedSpells from spells for existing monster combatants
            if ((!combatant.selectedSpells || combatant.selectedSpells.length === 0) &&
                combatant.spells && Array.isArray(combatant.spells) && combatant.spells.length > 0) {
              combatant.selectedSpells = [...combatant.spells]
              encounterChanged = true
            }
          }

          if (encounterChanged) {
            encountersMigrated++

            // Also update combatState if it exists (combat was in progress when saved)
            if (encounter.combatState && encounter.combatState.combatants) {
              let combatStateUpdated = 0

              encounter.combatState.combatants.forEach(sc => {
                const migratedCombatant = encounter.combatants.find(c => c.uid === sc.uid)
                if (migratedCombatant && migratedCombatant.isPC) {
                  const oldHpMax = sc.hpMax

                  // Update static fields from migrated combatant
                  sc.hpMax = migratedCombatant.hpMax
                  sc.ac = migratedCombatant.ac

                  // Smart hpCurrent handling: if hpCurrent equals the OLD broken hpMax,
                  // treat it as "never damaged" and reset to new hpMax
                  if (sc.hpCurrent === oldHpMax && oldHpMax !== migratedCombatant.hpMax) {
                    sc.hpCurrent = migratedCombatant.hpMax
                  } else if (sc.hpCurrent > migratedCombatant.hpMax) {
                    // Clamp if somehow exceeds new max
                    sc.hpCurrent = migratedCombatant.hpMax
                  }
                  // Otherwise preserve hpCurrent (real damage was taken)

                  // Update traits and actions (deep copy to avoid reference issues)
                  if (migratedCombatant.traits) {
                    sc.traits = JSON.parse(JSON.stringify(migratedCombatant.traits))
                  }
                  if (migratedCombatant.actions) {
                    sc.actions = JSON.parse(JSON.stringify(migratedCombatant.actions))
                  }

                  // Update spell data if missing (but preserve spellSlots if already set - combat state)
                  if ((!sc.selectedSpells || sc.selectedSpells.length === 0) && migratedCombatant.selectedSpells) {
                    sc.selectedSpells = JSON.parse(JSON.stringify(migratedCombatant.selectedSpells))
                  }
                  // Only backfill spellSlots if null (preserve existing even if all zeros = all spent)
                  if ((sc.spellSlots === null || sc.spellSlots === undefined) && migratedCombatant.spellSlots) {
                    sc.spellSlots = JSON.parse(JSON.stringify(migratedCombatant.spellSlots))
                  }
                  if (!sc.spellcastingType && migratedCombatant.spellcastingType) {
                    sc.spellcastingType = migratedCombatant.spellcastingType
                  }
                  if ((sc.spellAttackMod === null || sc.spellAttackMod === undefined) &&
                      (migratedCombatant.spellAttackMod !== null && migratedCombatant.spellAttackMod !== undefined)) {
                    sc.spellAttackMod = migratedCombatant.spellAttackMod
                  }
                  if ((sc.spellSaveDC === null || sc.spellSaveDC === undefined) &&
                      (migratedCombatant.spellSaveDC !== null && migratedCombatant.spellSaveDC !== undefined)) {
                    sc.spellSaveDC = migratedCombatant.spellSaveDC
                  }

                  // Backfill notes if missing or empty
                  if ((!sc.notes || sc.notes.length === 0) &&
                      migratedCombatant.notes && migratedCombatant.notes.length > 0) {
                    sc.notes = JSON.parse(JSON.stringify(migratedCombatant.notes))
                  }

                  combatStateUpdated++
                }
              })

              if (combatStateUpdated > 0) {
              }
            }
          }
        }
      }

      if (combatantsMigrated > 0) {
        console.log(`[Encounter Migration] Refreshed ${combatantsMigrated} combatant(s) in ${encountersMigrated} encounter(s)`)
        saveEncounters(enc.list)
      }

    } catch (err) { console.error('Auto-load encounters failed:', err) }
  }

  // Re-render nav bar if campaigns were loaded (to show campaign selector)
  if (savedCampaigns && Object.keys(compendiumData.campaigns || {}).length > 0) {
    render()
  }

  // Initial load - don't push to history
  showSection('home', true)
}

// ── Dice Roller ───────────────────────────────────────────────────
let diceState = {
  open: false,
  historyOpen: false,
  counts: { d2: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 },
  longPressTimer: null,
  history: []
}

function initDiceRoller() {
  renderDiceRoller()
}

function renderDiceRoller() {
  const container = document.getElementById('dice-roller-container')
  if (!container) return

  // Order from top to bottom: d20, d12, d10, d8, d6, d4, d2, d100
  const diceTypes = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4', 'd2', 'd100']

  // Map die types to PNG assets
  const dieImages = {
    d2: 'assets/D2.png',
    d4: 'assets/D4.png',
    d6: 'assets/D6.png',
    d8: 'assets/D8.png',
    d10: 'assets/D10.png',
    d12: 'assets/D12.png',
    d20: 'assets/D20.png',
    d100: 'assets/D100.png'
  }

  const totalSelected = Object.values(diceState.counts).reduce((sum, count) => sum + count, 0)
  const showLabels = localStorage.getItem('showDieLabels') === 'true'

  container.innerHTML = `
    <!-- History Panel -->
    ${diceState.historyOpen && diceState.history.length > 0 ? `
      <div style="position:absolute;bottom:90px;left:0;
                  background:#1E231A;border:2px solid #445E22;border-radius:8px;
                  padding:12px;max-height:300px;overflow-y:auto;min-width:280px;
                  box-shadow:0 4px 12px rgba(0,0,0,.5);
                  transition:all 0.3s ease;">
        <div style="font-size:12px;color:#4a9a9a;letter-spacing:.06em;font-weight:700;
                    margin-bottom:10px;font-family:var(--app-font);">ROLL HISTORY</div>
        ${diceState.history.slice().reverse().map((entry, idx) => `
          <div style="margin-bottom:${idx === diceState.history.length - 1 ? '0' : '10'}px;
                      padding-bottom:${idx === diceState.history.length - 1 ? '0' : '10'}px;
                      border-bottom:${idx === diceState.history.length - 1 ? 'none' : '1px solid #2a3a2a'};">
            <div style="font-size:10px;color:#666;margin-bottom:4px;font-family:var(--app-font);">
              ${entry.timestamp}
            </div>
            <div style="font-size:11px;color:#888;margin-bottom:2px;font-family:var(--app-font);">
              ${entry.dice}
            </div>
            <div style="font-size:11px;color:#aaa;margin-bottom:2px;font-family:var(--app-font);">
              ${entry.breakdown}
            </div>
            <div style="font-size:16px;color:#c9a87c;font-weight:bold;font-family:var(--app-font);">
              Total: ${entry.total}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${diceState.open ? diceTypes.map((die, idx) => {
      const count = diceState.counts[die]
      return `
        <div style="position:absolute;bottom:${80 + idx * 60}px;left:0;
                    transition:all 0.3s ease;opacity:${diceState.open ? '1' : '0'};">
          <button
            onclick="incrementDie('${die}')"
            oncontextmenu="resetDie('${die}'); return false;"
            onmousedown="startLongPress('${die}')"
            onmouseup="cancelLongPress()"
            onmouseleave="cancelLongPress()"
            ontouchstart="startLongPress('${die}')"
            ontouchend="cancelLongPress()"
            style="width:56px;height:56px;border-radius:50%;background:#1E231A;
                   border:2px solid #445E22;cursor:pointer;position:relative;
                   display:flex;align-items:center;justify-content:center;
                   transition:all 0.15s;padding:0;"
            onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
            onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
            <img src="${dieImages[die]}" alt="${die}"
                 style="width:44px;height:44px;object-fit:contain;pointer-events:none;" />
            ${showLabels ? `
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);
                          color:#7B9BA8;font-weight:bold;font-size:12px;
                          font-family:var(--app-font);pointer-events:none;
                          text-shadow: -1px -1px 0 #1E231A, 1px -1px 0 #1E231A, -1px 1px 0 #1E231A, 1px 1px 0 #1E231A;">
                ${die}
              </div>
            ` : ''}
            ${count > 0 ? `
              <div style="position:absolute;top:-4px;right:-4px;
                          background:#4587A2;color:#ffffff;border-radius:50%;
                          width:20px;height:20px;display:flex;align-items:center;
                          justify-content:center;font-size:11px;font-weight:bold;
                          font-family:var(--app-font);">
                ${count}
              </div>
            ` : ''}
          </button>
        </div>
      `
    }).join('') : ''}

    <!-- History button (always visible next to d20 base button) -->
    <div style="position:absolute;bottom:20px;left:70px;">
      <button
        onclick="toggleHistory()"
        style="width:40px;height:40px;border-radius:50%;background:#1E231A;
               border:2px solid #445E22;cursor:pointer;
               display:flex;align-items:center;justify-content:center;
               transition:all 0.15s;color:#909090;font-size:18px;"
        onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
        onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
        ▼
      </button>
    </div>

    <!-- Roll button (appears when tray is open and dice selected, to the right of History button) -->
    ${diceState.open && totalSelected > 0 ? `
      <div style="position:absolute;bottom:20px;left:120px;transition:all 0.3s ease;">
        <button
          onclick="rollDice()"
          style="padding:10px 20px;border-radius:20px;background:#1E231A;
                 border:2px solid #445E22;cursor:pointer;color:#e0d5c5;
                 font-family:var(--app-font);font-size:14px;font-weight:bold;
                 white-space:nowrap;transition:all 0.15s;"
          onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
          onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
          Roll
        </button>
      </div>
    ` : ''}

    <!-- Base button (d20 when closed, X when open) -->
    <button
      onclick="toggleDiceTray()"
      style="width:60px;height:60px;border-radius:50%;background:#1E231A;
             border:2px solid #445E22;cursor:pointer;position:relative;
             display:flex;align-items:center;justify-content:center;
             transition:all 0.15s;color:${diceState.open ? '#4587A2' : '#909090'};z-index:1;
             font-size:${diceState.open ? '24px' : '0'};font-weight:normal;padding:0;"
      onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
      onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
      ${diceState.open ? '&times;' : `<img src="${dieImages.d20}" alt="d20" style="width:48px;height:48px;object-fit:contain;pointer-events:none;" />`}
    </button>
  `
}

function toggleHistory() {
  diceState.historyOpen = !diceState.historyOpen
  renderDiceRoller()
}

function toggleDiceTray() {
  if (diceState.open) {
    // Close the tray and reset dice
    diceState.open = false
    diceState.historyOpen = false
    diceState.counts = { d2: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 }
  } else {
    // Open the tray
    diceState.open = true
  }
  renderDiceRoller()
}

function incrementDie(die) {
  diceState.counts[die]++
  renderDiceRoller()
}

function resetDie(die) {
  diceState.counts[die] = 0
  renderDiceRoller()
}

function startLongPress(die) {
  diceState.longPressTimer = setTimeout(() => {
    resetDie(die)
    // Haptic feedback on mobile
    if (navigator.vibrate) navigator.vibrate(50)
  }, 500)
}

function cancelLongPress() {
  if (diceState.longPressTimer) {
    clearTimeout(diceState.longPressTimer)
    diceState.longPressTimer = null
  }
}

function rollDice() {
  const results = {}
  const rollsByType = {}
  let total = 0

  // Roll each die type
  for (const [die, count] of Object.entries(diceState.counts)) {
    if (count === 0) continue

    const sides = parseInt(die.substring(1))
    const rolls = []

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1
      rolls.push(roll)
      total += roll
    }

    rollsByType[die] = rolls
  }

  // Format breakdown
  const breakdown = Object.entries(rollsByType)
    .map(([die, rolls]) => `${rolls.length}${die} — ${rolls.join(', ')}`)
    .join(' | ')

  // Format dice string
  const diceStr = Object.entries(rollsByType)
    .map(([die, rolls]) => `${rolls.length}${die}`)
    .join(' + ')

  // Get timestamp
  const now = new Date()
  const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Add to history
  diceState.history.push({
    timestamp,
    dice: diceStr,
    breakdown,
    total
  })

  // Show result below Ignacious
  showDiceResult(total, breakdown)

  // Reset dice and close tray
  diceState.counts = { d2: 0, d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0 }
  diceState.open = false
  renderDiceRoller()
}

function showDiceResult(total, breakdown) {
  // Remove existing result bubble if any
  let bubble = document.getElementById('dice-result-bubble')
  let tail = document.getElementById('dice-result-tail')

  if (!bubble) {
    bubble = document.createElement('div')
    bubble.id = 'dice-result-bubble'
    document.body.appendChild(bubble)
  }

  if (!tail) {
    tail = document.createElement('img')
    tail.id = 'dice-result-tail'
    tail.src = 'assets/Ignacious_Speech.png'
    document.body.appendChild(tail)
  }

  // Position below Ignacious (Ignacious is 220px tall at top:0, left:0)
  bubble.style.cssText = `
    position:fixed;
    top:230px;
    left:30px;
    background:#EEEEEE;
    border:2px solid #0E1412;
    color:#0E1412;
    padding:16px 20px;
    border-radius:12px;
    font-family:var(--app-font);
    opacity:0;
    transition:opacity .3s,transform .3s;
    pointer-events:none;
    z-index:10000;
    max-width:280px;
    box-shadow:0 4px 12px rgba(0,0,0,.5);
    transform:translateY(-10px);
  `

  // Tail pointing upward - image connector between Ignacious mouth and bubble
  tail.style.cssText = `
    position:fixed;
    top:100px;
    left:-45px;
    width:210px;
    height:auto;
    opacity:0;
    transition:opacity .3s;
    pointer-events:none;
    z-index:10000;
  `

  bubble.innerHTML = `
    <div style="font-size:32px;font-weight:bold;margin-bottom:8px;color:#0E1412;">
      ${total}
    </div>
    <div style="font-size:12px;color:#0E1412;line-height:1.4;">
      ${breakdown}
    </div>
  `

  // Show the bubble
  setTimeout(() => {
    bubble.style.opacity = '1'
    bubble.style.transform = 'translateY(0)'
    tail.style.opacity = '1'
  }, 10)

  // Hide after 5 seconds
  clearTimeout(bubble._hideTimer)
  bubble._hideTimer = setTimeout(() => {
    bubble.style.opacity = '0'
    bubble.style.transform = 'translateY(-10px)'
    tail.style.opacity = '0'
  }, 5000)
}

// Export to window for onclick handlers
window.toggleDiceTray = toggleDiceTray
window.toggleHistory = toggleHistory
window.incrementDie = incrementDie
// ── Combat Roll Functions ─────────────────────────────────────────
function rollAttack(combatantUid, actionName, attackData) {
  const combatant = enc.current?.combatants?.find(c => c.uid === combatantUid)
  if (!combatant) return

  // Safety check: if atk is "—" (no attack roll), return early
  if (attackData.atk === '—') return

  // Parse attack bonus - handle multiple formats
  let atkBonus = 0
  if (attackData.atk !== undefined) {
    // New structured format with atk field
    const atkStr = String(attackData.atk || '0')
    const match = atkStr.match(/[\+\-]?\d+/)
    if (match) atkBonus = parseInt(match[0])
  } else if (attackData.bonus !== undefined) {
    // Very old legacy format
    atkBonus = parseInt(attackData.bonus) || 0
  }

  // Roll 1d20
  const d20Roll = Math.floor(Math.random() * 20) + 1
  const total = d20Roll + atkBonus

  // Format breakdown
  const breakdown = `d20(${d20Roll}) ${atkBonus >= 0 ? '+' : ''}${atkBonus}`

  // Add to history
  const now = new Date()
  const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  diceState.history.push({
    timestamp,
    dice: `${combatant.name} Attack - ${actionName}:`,
    breakdown,
    total
  })

  // Show result
  showDiceResult(total, breakdown)
  renderDiceRoller()
}

function rollDamage(combatantUid, actionName, attackData, damageType = 'standard') {
  const combatant = enc.current?.combatants?.find(c => c.uid === combatantUid)
  if (!combatant) {
    console.error('[rollDamage] Combatant not found:', combatantUid)
    return
  }

  let diceCount, dieType, dmgBonus, dmgType

  // Check if alternate damage was requested
  const useAlternate = damageType === 'alternate' && attackData.altDiceCount

  // Use alternate damage if requested, otherwise standard
  if (useAlternate) {
    diceCount = parseInt(attackData.altDiceCount) || 0
    dieType = attackData.altDieType || 'd6'
    const bonusStr = String(attackData.altDmgBonus || '0').replace(/^\+/, '')
    dmgBonus = parseInt(bonusStr) || 0
    dmgType = attackData.altDmgType || ''
  } else if (attackData.diceCount !== undefined || attackData.dieType !== undefined) {
    // New structured format (standard damage)
    diceCount = parseInt(attackData.diceCount) || 0
    dieType = attackData.dieType || 'd6'
    // Parse bonus more robustly - handle "+5", "5", "-2", etc.
    const bonusStr = String(attackData.dmgBonus || '0').replace(/^\+/, '')  // Remove leading +
    dmgBonus = parseInt(bonusStr) || 0
    dmgType = attackData.dmgType || ''
  } else if (attackData.dmg) {
    // Old format - has dmg string but no structured fields
    // Parse dmg string at roll time using parseDamageString()
    const parsed = parseDamageString(attackData.dmg)
    diceCount = parseInt(parsed.diceCount) || 0
    dieType = parsed.dieType || 'd6'
    // Parse bonus more robustly
    const bonusStr = String(parsed.dmgBonus || '0').replace(/^\+/, '')  // Remove leading +
    dmgBonus = parseInt(bonusStr) || 0
    dmgType = parsed.dmgType || attackData.dmgType || ''
  } else {
    // No damage data - old custom monster that needs re-saving
    console.warn('[rollDamage] No damage data found in attackData:', attackData)
    showDiceResult('No Damage Data', `${combatant.name}'s ${actionName} has no damage configured. Edit the monster to add damage.`)
    return
  }

  // Validate we have at least dice or a bonus
  if (diceCount === 0 && dmgBonus === 0) {
    console.warn('[rollDamage] No dice count or bonus - cannot roll damage')
    showDiceResult('No Damage', 'Edit monster to configure damage dice')
    return
  }

  // Roll primary damage dice
  const dieSize = parseInt(dieType.substring(1)) || 6
  const rolls = []
  let diceTotal = 0

  for (let i = 0; i < diceCount; i++) {
    const roll = Math.floor(Math.random() * dieSize) + 1
    rolls.push(roll)
    diceTotal += roll
  }

  let total = diceTotal + dmgBonus

  // Format breakdown
  let breakdown = ''
  if (diceCount > 0) {
    breakdown = `${diceCount}${dieType}(${rolls.join(',')})`
    if (dmgBonus !== 0) {
      breakdown += ` ${dmgBonus >= 0 ? '+' : ''}${dmgBonus}`
    }
  } else {
    // Flat damage
    breakdown = String(dmgBonus)
  }

  // Add primary damage type to breakdown
  if (dmgType) {
    breakdown += ` ${dmgType}`
  }

  // Roll additional damage if present
  const additionalDiceCount = parseInt(attackData.additionalDiceCount) || 0
  if (additionalDiceCount > 0 && attackData.additionalDieType) {
    const additionalDieType = attackData.additionalDieType
    const additionalDieSize = parseInt(additionalDieType.substring(1)) || 6
    const additionalRolls = []
    let additionalTotal = 0

    for (let i = 0; i < additionalDiceCount; i++) {
      const roll = Math.floor(Math.random() * additionalDieSize) + 1
      additionalRolls.push(roll)
      additionalTotal += roll
    }

    total += additionalTotal
    breakdown += ` + ${additionalDiceCount}${additionalDieType}(${additionalRolls.join(',')})`

    // If additional damage has a specific type, show it
    if (attackData.additionalDmgType) {
      breakdown += ` ${attackData.additionalDmgType}`
    }
  }

  // Add to history
  const now = new Date()
  const timestamp = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Label for roll type
  const typeLabel = useAlternate ? ' (Alternate)' : (damageType === 'standard' ? ' (Standard)' : '')

  diceState.history.push({
    timestamp,
    dice: `${combatant.name} Damage - ${actionName}${typeLabel}:`,
    breakdown,
    total
  })

  // Show result
  showDiceResult(total, breakdown)
  renderDiceRoller()
}

function showDamagePopup(combatantUid, actionName, attackData, buttonEl) {
  // Close any existing popup
  const existing = document.getElementById('damage-type-popup')
  if (existing) existing.remove()

  // Create popup
  const popup = document.createElement('div')
  popup.id = 'damage-type-popup'
  popup.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: #262F35;
    border: 2px solid #4a9a9a;
    border-radius: 4px;
    padding: 4px;
    min-width: 180px;
    z-index: 1000;
    font-family: var(--app-font);
    font-size: 12px;
  `

  // Build standard damage label
  const stdDiceCount = attackData.diceCount || '0'
  const stdDieType = attackData.dieType || 'd6'
  const stdBonus = attackData.dmgBonus || ''
  const stdType = attackData.dmgType || ''
  const stdLabel = `${stdDiceCount}${stdDieType}${stdBonus ? ' ' + stdBonus : ''}${stdType ? ' ' + stdType : ''}`

  // Build alternate damage label
  const altDiceCount = attackData.altDiceCount || '0'
  const altDieType = attackData.altDieType || 'd6'
  const altBonus = attackData.altDmgBonus || ''
  const altType = attackData.altDmgType || ''
  const altLabel = `${altDiceCount}${altDieType}${altBonus ? ' ' + altBonus : ''}${altType ? ' ' + altType : ''}`

  popup.innerHTML = `
    <div onclick="rollDamage('${combatantUid}','${actionName.replace(/'/g, "\\'")}',${JSON.stringify(attackData).replace(/"/g, '&quot;')},'standard');document.getElementById('damage-type-popup').remove()"
         style="padding: 6px 10px; cursor: pointer; border-radius: 3px; margin-bottom: 2px; color: #e0d5c5;"
         onmouseover="this.style.background='#0f3460'"
         onmouseout="this.style.background='transparent'">
      Standard: ${stdLabel}
    </div>
    <div onclick="rollDamage('${combatantUid}','${actionName.replace(/'/g, "\\'")}',${JSON.stringify(attackData).replace(/"/g, '&quot;')},'alternate');document.getElementById('damage-type-popup').remove()"
         style="padding: 6px 10px; cursor: pointer; border-radius: 3px; color: #e0d5c5;"
         onmouseover="this.style.background='#0f3460'"
         onmouseout="this.style.background='transparent'">
      Alternate: ${altLabel}
    </div>
  `

  // Position popup relative to button
  buttonEl.parentElement.style.position = 'relative'
  buttonEl.parentElement.appendChild(popup)

  // Close popup when clicking outside
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== buttonEl) {
        popup.remove()
        document.removeEventListener('click', closeHandler)
      }
    }
    document.addEventListener('click', closeHandler)
  }, 10)
}

window.resetDie = resetDie
window.startLongPress = startLongPress
window.cancelLongPress = cancelLongPress
window.rollDice = rollDice
window.rollAttack = rollAttack
window.rollDamage = rollDamage
window.showDamagePopup = showDamagePopup
window.toggleNotesSection = toggleNotesSection
window.editNote = editNote

// ── Bullet point keyboard shortcut ────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Check for Cmd+. (Mac) or Ctrl+. (Windows)
  if ((e.metaKey || e.ctrlKey) && e.key === '.') {
    const target = e.target
    // Only apply to textarea and text input elements
    if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.type === 'text')) {
      e.preventDefault()

      const start = target.selectionStart
      const value = target.value

      // Find the start of the current line
      let lineStart = start
      while (lineStart > 0 && value[lineStart - 1] !== '\n') {
        lineStart--
      }

      // Check if line already starts with bullet
      const lineContent = value.substring(lineStart)
      if (!lineContent.startsWith('• ')) {
        // Insert bullet at line start
        const before = value.substring(0, lineStart)
        const after = value.substring(lineStart)
        target.value = before + '• ' + after

        // Move cursor after the bullet
        target.selectionStart = target.selectionEnd = start + 2

        // Trigger change event for frameworks/listeners
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  }
})

// ── Boot ──────────────────────────────────────────────────────────
const SPLASH_MIN_MS = 1500

function hideSplash() {
  const splash = document.getElementById('splash-screen')
  if (!splash) return
  splash.classList.add('splash-hidden')
  setTimeout(() => {
    splash.remove()
    if (!loadHasSeenWelcome()) showWelcomeModal()
  }, 550)
}

function waitForImageReady(img) {
  return new Promise((resolve) => {
    if (!img) return resolve()
    if (img.complete && img.naturalWidth > 0) return resolve()
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => resolve(), { once: true })
  })
}

window.addEventListener('DOMContentLoaded', () => {
  const splashStart = Date.now()
  const splashArt = document.getElementById('splash-art')
  const splashContent = document.getElementById('splash-content')

  loadFontPreference()
  render()

  // Wait for the splash image to actually finish loading/decoding before
  // fading anything in - otherwise the fade-in starts against a blank image
  // and the art "pops in" whenever decoding finishes, out of sync with the text.
  waitForImageReady(splashArt).then(() => {
    // Wait for a real paint before the synchronous autoLoad() blocks the thread,
    // so the fade-in isn't skipped. Opacity transitions run on the compositor,
    // so they keep animating through the blocking work once started.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (splashContent) splashContent.classList.add('splash-visible')

        autoLoad()
        initIgnaciousEyeTracking()

        const elapsed = Date.now() - splashStart
        const remaining = Math.max(0, SPLASH_MIN_MS - elapsed)
        setTimeout(hideSplash, remaining)
      })
    })
  })
})

