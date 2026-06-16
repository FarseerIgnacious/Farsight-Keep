const { saveCompendium, loadCompendium, saveCampaigns, loadCampaigns, saveEncounters, loadEncounters } = require('./storage.js')

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
}

const SKILL_NAMES = {
  0: 'Athletics', 1: 'Acrobatics', 2: 'Sleight of Hand', 3: 'Stealth',
  4: 'Arcana', 5: 'History', 6: 'Investigation', 7: 'Nature', 8: 'Religion',
  9: 'Animal Handling', 10: 'Insight', 11: 'Medicine', 12: 'Perception',
  13: 'Survival', 14: 'Deception', 15: 'Intimidation', 16: 'Performance', 17: 'Persuasion'
}

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
  console.log('[pushNav] pushing CURRENT state:', currentScreen, 'before navigating to:', screen, uid)
  navHistory.push({ ...currentScreen })
  console.log('[pushNav] history length after:', navHistory.length)

  // Update current screen to the new screen
  currentScreen = { screen, uid }
  console.log('[pushNav] currentScreen now:', currentScreen)
}

function popNav() {
  console.log('popNav called, history length:', navHistory.length, 'last state:', navHistory[navHistory.length-1])
  console.log('[popNav] called, history length:', navHistory.length)
  if (navHistory.length === 0) {
    console.log('[popNav] history empty, showing home')
    showSection('home', true)
    return
  }

  const prevState = navHistory.pop()
  console.log('[popNav] restoring state:', prevState)

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
window.addMonsterAsIs = addMonsterAsIs
window.modifyMonster = modifyMonster
window.openSettings = openSettings
window.setAppFont = setAppFont
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

function getBlocks(node, tag) {
  return Array.from(node.querySelectorAll(tag)).map(el => {
    const nameEl = el.querySelector('name')
    const texts = Array.from(el.querySelectorAll('text')).map(t => t.textContent.trim()).join('\n')
    return {
      name: nameEl ? nameEl.textContent.trim() : (el.getAttribute('name') || ''),
      text: texts || el.textContent.trim(),
      charges: el.querySelector('charges') ? parseInt(el.querySelector('charges').textContent) : null,
      chargesCurrent: el.querySelector('chargesCurrent') ? parseInt(el.querySelector('chargesCurrent').textContent) : null,
      recharge: el.querySelector('recharge') ? parseInt(el.querySelector('recharge').textContent) : null,
    }
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
  return {
    name: getText(m, 'name'),
    size: getText(m, 'size'),
    type: getText(m, 'type'),
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
    save: getText(m, 'save'),
    skill: getText(m, 'skill'),
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
  return {
    name: getText(s, 'name'),
    level: getText(s, 'level'),
    school: getText(s, 'school'),
    time: getText(s, 'time'),
    range: getText(s, 'range'),
    components: getText(s, 'components'),
    duration: getText(s, 'duration'),
    classes: getText(s, 'classes'),
    text: Array.from(s.querySelectorAll('text')).map(t => t.textContent.trim()).join('\n'),
    roll: getText(s, 'roll'),
  }
}

function parseCompendium(xml) {
  compendiumData.monsters = Array.from(xml.querySelectorAll('monster'))
    .map(m => parseMonsterNode(m))
    .sort((a, b) => a.name.localeCompare(b.name))

  compendiumData.spells = Array.from(xml.querySelectorAll('spell'))
    .map(s => parseSpellNode(s))
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

    // Debug: log all available child tags for first PC
    if (!isNPC && node.tagName === 'pc') {
      const allTags = Array.from(node.children).map(child => child.tagName).join(', ')
      console.log(`[parseCampaign] PC XML tags available: ${allTags}`)
    }

    console.log(`[parseCampaign] <${node.tagName}> label="${label}" name="${name}" cr="${cr}" level="${level}" classInfo="${classInfo}" enemy="${enemy}" isNPC=${isNPC}`)

    // Parse size - can be numeric (0-5) or letter abbreviation
    // GM5E format: 0=Tiny, 1=Small, 2=Medium, 3=Large, 4=Huge, 5=Gargantuan
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
  console.log(`[parseCampaign] ${compendiumData.players.length} players, ${compendiumData.npcs.length} NPCs`)
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
              if (replaceExisting) {
                compendiumData.monsters[existingIndex] = newMonster
                replacedMonsters++
              }
              // else keep existing, do nothing
            } else {
              compendiumData.monsters.push(newMonster)
              addedMonsters++
            }
          })

          // Merge spells
          tempData.spells.forEach(newSpell => {
            const existingIndex = compendiumData.spells.findIndex(s => s.name === newSpell.name)
            if (existingIndex >= 0) {
              if (replaceExisting) {
                compendiumData.spells[existingIndex] = newSpell
                replacedSpells++
              }
              // else keep existing, do nothing
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
function openSettings() {
  const existing = document.getElementById('settings-modal')
  if (existing) {
    existing.remove()
    return
  }

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

  modal.innerHTML = `
    <div style="background:#0a1520;border:2px solid #4a9a9a;border-radius:8px;
                padding:24px;max-width:500px;width:90%;font-family:var(--app-font);
                position:relative;">
      <button onclick="document.getElementById('settings-modal').remove()"
        style="position:absolute;top:12px;right:12px;background:none;border:none;
               color:#555;cursor:pointer;font-size:24px;line-height:1;padding:4px 8px;"
        onmouseover="this.style.color='#e0d5c5'"
        onmouseout="this.style.color='#555'">×</button>

      <h2 style="font-size:20px;color:#e0d5c5;margin:0 0 20px 0;">Settings</h2>

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:#1E231A;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          IMPORT
        </div>
        <button onclick="addToCompendium();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Add to Compendium (XML)
        </button>
        <button onclick="importXML();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Re-import Compendium (XML)
        </button>
        <button onclick="importCampaignXML();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Import New Campaign (XML)
        </button>
        <button onclick="reimportCampaignXML();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Re-import Existing Campaign (XML)
        </button>
        <button onclick="restoreFromBackup();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Restore from Backup (JSON)
        </button>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:14px;color:#1E231A;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          EXPORT
        </div>
        <button onclick="exportCompendium();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Export Compendium
        </button>
        <button onclick="exportActiveCampaign();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Export Active Campaign
        </button>
        <button onclick="exportFullBackup();document.getElementById('settings-modal').remove()"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Full Backup (JSON)
        </button>
      </div>

      <div>
        <div style="font-size:14px;color:#1E231A;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">
          FONT
        </div>
        <button onclick="setAppFont('Metamorphous')"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Metamorphous (Default)
        </button>
        <button onclick="setAppFont('MedievalSharp')"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          MedievalSharp
        </button>
        <button onclick="setAppFont('Cinzel')"
          style="${btnStyle}"
          onmouseover="this.style.background='#0f3460';this.style.borderColor='#4a9a9a'"
          onmouseout="this.style.background='#1e3535';this.style.borderColor='#2a3a5a'">
          Cinzel
        </button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove()
  })
}

function setAppFont(fontName) {
  const fontMap = {
    'Metamorphous': "'Metamorphous', Georgia, serif",
    'MedievalSharp': "'MedievalSharp', Georgia, serif",
    'Cinzel': "'Cinzel', Georgia, serif"
  }

  const fontFamily = fontMap[fontName] || fontMap['Cinzel']
  document.documentElement.style.setProperty('--app-font', fontFamily)
  localStorage.setItem('dmCompanionFont', fontName)

  const modal = document.getElementById('settings-modal')
  if (modal) modal.remove()
}

function loadFontPreference() {
  const savedFont = localStorage.getItem('dmCompanionFont')
  if (savedFont) {
    setAppFont(savedFont)
  }
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
    // XML export - convert to GM5E format
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
    // XML export - convert to GM5E format
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
  downloadFile(`dm-companion-backup-${timestamp}.json`, json, 'application/json')
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
        <img id="ignacious-base" src="assets/Ignacious.PNG"
          style="position:absolute;width:100%;height:100%;object-fit:contain;" />
      </div>

      <div style="position:relative;flex-shrink:0;height:auto;">
        <img src="assets/Header.png" alt="Header"
          style="position:absolute;top:0;left:0;width:1641px;height:auto;z-index:0;
                 pointer-events:none;display:block;" />
        <div style="display:flex;align-items:center;position:relative;z-index:1;
                    padding:10px 20px 10px 240px;min-height:100%;gap:0;justify-content:space-between;">
          <div style="display:flex;gap:0;">
            <div style="display:flex;gap:0;">
              ${sections.map(s => `
                <div onclick="showSection('${s}')" class="nav-btn" id="nav-${s}"
                  style="cursor:pointer;pointer-events:auto;clip-path:inset(30px 25px);
                         display:block;margin:0 -20px 0 0;">
                  <img src="assets/${tabImages[s]}" alt="${s}"
                    style="display:block;height:137px;width:auto;object-fit:contain;
                           pointer-events:none;" />
                </div>
              `).join('')}
            </div>
          </div>

          ${hasCampaigns ? `
            <div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;">
              <div id="campaign-selector-container" style="display:flex;align-items:center;gap:6px;">
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
                <button onclick="showRenameCampaignForm()" title="Rename Campaign"
                  style="background:none;border:none;color:#909090;cursor:pointer;
                         font-size:16px;padding:4px;line-height:1;"
                  onmouseover="this.style.color='#4a9a9a'"
                  onmouseout="this.style.color='#909090'">
                  ✎
                </button>
              </div>
              <div id="new-campaign-container">
                <button onclick="showNewCampaignForm()"
                  style="background:#1E231A;color:#909090;border:2px solid #445E22;
                         padding:4px 10px;cursor:pointer;border-radius:4px;font-size:11px;
                         font-family:var(--app-font);white-space:nowrap;font-weight:700;"
                  onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
                  onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
                  + New Campaign
                </button>
              </div>
            </div>
          ` : ''}
          <div onclick="openSettings()" id="settings-button" title="Settings"
            style="cursor:pointer;pointer-events:auto;clip-path:inset(30px 25px);
                   display:block;margin:0;">
            <img src="assets/Settings_Tab.png" alt="Settings"
              style="display:block;height:137px;width:auto;object-fit:contain;
                     pointer-events:none;" />
          </div>
          </button>
        </div>
      </div>

      <div id="content" style="flex:1;overflow-y:auto;overflow-x:visible;padding:24px 24px 24px 260px;"></div>

      <div id="ignacious-speech"
        style="position:fixed;top:80px;left:240px;
               background:#2a2a2a;border:2px solid #4a9a9a;color:#e0d5c5;
               padding:12px 18px;border-radius:12px;font-size:14px;font-family:var(--app-font);
               opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;z-index:10000;
               max-width:350px;box-shadow:0 4px 12px rgba(0,0,0,.5);transform:translateY(-10px);">
      </div>
      <div id="ignacious-speech-tail"
        style="position:fixed;top:95px;left:228px;width:0;height:0;
               border-top:10px solid transparent;border-bottom:10px solid transparent;
               border-right:14px solid #4a9a9a;opacity:0;
               transition:opacity .3s;pointer-events:none;z-index:9999;">
      </div>

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

      <h1 style="font-size:26px;font-weight:bold;color:#e0d5c5;margin-bottom:4px;">
        Welcome, Dungeon Master
      </h1>
      <p style="color:#555;font-size:13px;margin-bottom:28px;">
        Your 5e campaign companion.
      </p>

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
                <div style="font-weight:bold;font-size:14px;margin-bottom:2px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4587A2;
                            ${p.portrait ? 'padding-right:48px;' : ''}">
                  ${p.label || p.name}
                </div>
                <div style="font-size:11px;color:#666;margin-bottom:10px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${p.name}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;">
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">HP</div>
                    <div style="font-weight:bold;">${p.hpCurrent}/${p.hpMax}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">AC</div>
                    <div style="font-weight:bold;">${p.ac || '—'}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">INIT</div>
                    <div style="font-weight:bold;">${p.init ? modStr(parseInt(p.init)) : '—'}</div>
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
                <div style="font-size:11px;color:#666;margin-bottom:10px;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${p.name}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;">
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">HP</div>
                    <div style="font-weight:bold;">${p.hpCurrent}/${p.hpMax}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">AC</div>
                    <div style="font-weight:bold;">${p.ac || '—'}</div>
                  </div>
                  <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
                    <div style="font-size:9px;color:#666;letter-spacing:.06em;">INIT</div>
                    <div style="font-weight:bold;">${p.init ? modStr(parseInt(p.init)) : '—'}</div>
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
        <p style="color:#555;">Load a campaign first to manage encounters.</p>
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

    // Restore combatant states
    enc.current.combatants.forEach(c => {
      const savedState = e.combatState.combatants.find(s => s.uid === c.uid)
      if (savedState) {
        c.hpCurrent = savedState.hpCurrent
        c.hpMax = savedState.hpMax
        c.initiative = savedState.initiative
        c.conditions = savedState.conditions || []
        c.isEnemy = savedState.isEnemy
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
  if (!confirm('Delete this encounter?')) return
  enc.list[campaign] = enc.list[campaign].filter(e => e.id !== id)
  saveEncounters(enc.list)
  showSection('encounters')
}

function enterEncounterBuilder() {
  pushNav('encounter', null)

  // Nav buttons are now styled purely by their images, no dynamic styling needed
  const content = document.getElementById('content')
  content.style.padding = '0'
  content.style.overflow = 'auto'
  content.style.overflowY = 'auto'
  renderEncounterBuilder(content)
}

// ── Encounter Builder ─────────────────────────────────────────────
function renderEncounterBuilder(container) {
  container.innerHTML = `
    <div style="min-height:100%;background:linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                url('assets/Background.png') left -40px/1641px auto no-repeat fixed;">
      <div id="enc-topbar"
        style="display:flex;align-items:center;gap:12px;
               padding:46px 20px 12px 20px;background:#5C5C5C;border-bottom:4px solid #2E2F2D;
               flex-shrink:0;padding-left:240px;box-sizing:border-box;margin-top:-30px;">
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
          ▶ Start Combat
        </button>
        <button id="btn-end-combat" onclick="endCombat()" disabled
          style="background:#262F35;color:#444;border:1px solid #2a3a5a;padding:6px 13px;
                 cursor:not-allowed;border-radius:4px;font-size:12px;font-family:var(--app-font);
                 white-space:nowrap;">
          ■ End Combat
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

      <div style="display:flex;overflow:hidden;position:relative;flex:1;">

        <div id="enc-left"
          style="width:210px;flex-shrink:0;overflow-y:auto;
                 background:#0a1520;border-right:1px solid #1e2d4a;">
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
      btn.textContent = '⏭ Next Turn'
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
    <div style="padding:12px 10px;background:#0d1b2a;border-bottom:2px solid #1e2d4a;
                text-align:center;font-size:13px;color:#aaa;">
      ${roundDisplay}
    </div>
  `

  if (combatants.length === 0) {
    sidebar.innerHTML = roundHeader + `<p style="color:#333;font-size:12px;padding:14px;text-align:center;">
      Add combatants →</p>`
    return
  }
  sidebar.innerHTML = roundHeader + combatants.map((c, i) => {
    const pct = c.hpMax > 0 ? Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100)) : 100
    const barColor = pct > 50 ? '#2a7a2a' : pct > 25 ? '#7a6a00' : '#8a0000'
    const isActive = enc.inCombat && i === enc.turn
    return `
      <div onclick="scrollToCard('${c.uid}')"
        style="padding:9px 10px;cursor:pointer;border-bottom:1px solid #111c2a;
               background:${isActive ? '#1e3d5c' : 'transparent'};
               border-left:3px solid ${isActive ? '#4587A2' : 'transparent'};"
        onmouseover="if(!${isActive})this.style.background='#0e1c2e'"
        onmouseout="if(!${isActive})this.style.background='transparent'">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <div style="font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;
                      text-overflow:ellipsis;max-width:138px;
                      color:${isActive ? '#8fd9a8' : '#e0d5c5'};">${c.name}</div>
          <div style="font-size:11px;color:#555;flex-shrink:0;margin-left:4px;">${c.initiative}</div>
        </div>
        <div style="font-size:11px;color:#555;margin-bottom:3px;">${c.hpCurrent}/${c.hpMax} HP</div>
        <div style="height:4px;background:#1e2d4a;border-radius:2px;">
          <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px;"></div>
        </div>
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
    label.innerHTML = `${icon ? `<img src="assets/${icon}" alt="${difficulty}" style="width:64px;height:64px;object-fit:contain;vertical-align:middle;margin-right:10px;" />` : ''}Total Enemy XP: <strong>${totalXP.toLocaleString()}</strong> ·
      <span style="color:${color};">${difficulty}</span>`
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
  center.innerHTML = combatants.map((c, i) => buildCard(c, enc.inCombat && i === enc.turn)).join('')
  requestAnimationFrame(() => { center.scrollLeft = scrollLeft })
  if (enc.inCombat) {
    const activeUid = combatants[enc.turn]?.uid
    if (activeUid) {
      setTimeout(() => {
        scrollToCard(activeUid)
      }, 60)
    }
  }
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
    if (c.abilities && Array.isArray(c.abilities)) {
      return parseInt(c.abilities[abMap[ability]]) || 10
    }
    return parseInt(c[ability]) || 10
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
          return `
          <div style="margin-bottom:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
              <div onclick="toggleTraitText('${tid}')"
                style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;
                       ${long ? 'cursor:pointer;' : ''}">
                <strong style="font-size:13px;overflow:hidden;text-overflow:ellipsis;
                               white-space:nowrap;">${item.name || ''}</strong>
                ${long ? `<span id="${tid}-arrow"
                  style="font-size:11px;color:#555;flex-shrink:0;">▼</span>` : ''}
              </div>
              ${item.charges !== null ? `
                <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
                  <button onclick="adjustCharge('${c.uid}','${section}',${idx},-1)"
                    style="background:#0f3460;border:none;color:#e0d5c5;width:22px;height:22px;
                           cursor:pointer;border-radius:3px;font-size:14px;line-height:1;
                           padding:0;display:flex;align-items:center;justify-content:center;">-</button>
                  <span style="font-size:12px;color:#aaa;min-width:36px;text-align:center;">
                    ${item.chargesCurrent}/${item.charges}</span>
                  <button onclick="adjustCharge('${c.uid}','${section}',${idx},1)"
                    style="background:#0f3460;border:none;color:#e0d5c5;width:22px;height:22px;
                           cursor:pointer;border-radius:3px;font-size:14px;line-height:1;
                           padding:0;display:flex;align-items:center;justify-content:center;">+</button>
                </div>
              ` : item.recharge !== null ? `
                <span style="font-size:12px;color:#555;background:#0f3460;
                             padding:2px 7px;border-radius:8px;flex-shrink:0;white-space:nowrap;">
                  Rchg ${item.recharge}+</span>
              ` : ''}
            </div>
            <div id="${tid}"
              style="color:#b8b0a0;font-size:13px;line-height:1.5;margin-top:1px;white-space:pre-wrap;
                     ${long ? 'overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;' : ''}">${text.trim()}</div>
          </div>`
        }).join('')}
      </div>`
  }

  const slotsHTML = c.spellSlots && c.spellSlots.length > 0 ? `
    <div style="margin-top:12px;">
      <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">SPELL SLOTS</div>
      ${c.spellSlots.map((slot, si) => {
        const avail = slot.total - slot.used
        return `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <span style="font-size:12px;color:#555;width:24px;">L${slot.level}</span>
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
      <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                  margin-bottom:6px;">SPELLS</div>
      ${c.dailySpells.map((grp, gi) => `
        <div style="margin-bottom:7px;">
          <div style="font-size:11px;color:#444;letter-spacing:.05em;margin-bottom:4px;
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
    if (!c.spells || c.spells.length === 0) return ''
    const sorted = [...c.spells].sort((a, b) => (parseInt(a.level) || 0) - (parseInt(b.level) || 0))
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
              <button onclick="adjustCombatantSpellUse('${c.uid}',${s.idx},-1)"
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
              <button onclick="adjustCombatantSpellUse('${c.uid}',${s.idx},1)"
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
        <div style="font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                    margin-bottom:6px;">SPELLS</div>
        ${Array.from(levelMap.entries()).map(([lvl, spells]) => `
          <div style="margin-bottom:8px;">
            <div style="font-size:11px;color:#444;letter-spacing:.05em;margin-bottom:4px;
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
             max-height:calc(100vh - 220px);overflow-y:auto;overflow-x:visible;padding-bottom:40px;
             scrollbar-width:none;-ms-overflow-style:none;">
      <style>
        #card-${c.uid}::-webkit-scrollbar { display: none; }
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
            <span style="font-size:13px;color:#555;">${c.type}</span>
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
        <button onclick="removeCombatant('${c.uid}')"
          style="background:none;border:none;color:#4587A2;cursor:pointer;
                 font-size:16px;padding:0;flex-shrink:0;" title="Remove">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;">
        <div style="background:#1A1C1E;padding:7px 6px;border-radius:3px;text-align:center;">
          <div style="font-size:11px;color:#444;letter-spacing:.05em;margin-bottom:2px;">INIT</div>
          <input type="number" value="${c.initiative}"
            onchange="setInit('${c.uid}',this.value)"
            style="background:transparent;border:none;color:#e0d5c5;font-family:var(--app-font);
                   font-size:18px;font-weight:bold;width:100%;text-align:center;outline:none;
                   -moz-appearance:textfield;" />
        </div>
        <div style="background:#1A1C1E;padding:7px 6px;border-radius:3px;text-align:center;">
          <div style="font-size:11px;color:#444;letter-spacing:.05em;margin-bottom:2px;">AC</div>
          <div style="font-size:18px;font-weight:bold;">${parseInt(c.ac) || c.ac || '—'}</div>
          ${(() => {
            const armorType = c.armor || (c.ac ? String(c.ac).replace(/^\d+\s*/, '').replace(/[()]/g, '').trim() : '')
            return armorType ? `<div style="font-size:10px !important;color:#888888 !important;font-weight:normal !important;display:block;margin-top:2px;">${armorType}</div>` : ''
          })()}
        </div>
        <div style="background:#1A1C1E;padding:7px 6px;border-radius:3px;text-align:center;">
          <div style="font-size:11px;color:#444;letter-spacing:.05em;margin-bottom:2px;">SPD</div>
          <div style="font-size:15px;font-weight:bold;overflow:hidden;
                      text-overflow:ellipsis;white-space:nowrap;">${c.speed || '—'}</div>
        </div>
      </div>

      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:13px;color:#555;">HP</span>
          <span style="font-size:15px;font-weight:bold;">${c.hpCurrent} / ${c.hpMax}</span>
        </div>
        <div style="height:8px;background:#1e2d4a;border-radius:4px;">
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
                <div style="font-size:11px;color:#888;">${modStr(mod)}</div>
              </div>`
          }).join('')}
        </div>
      </div>

      <!-- Saving Throws -->
      ${c.save || (c.savingThrows && c.savingThrows.length > 0) ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">SAVING THROWS</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">
            ${c.save || c.savingThrows.map(st => {
              const abilityName = typeof st.ability === 'number' ? ['STR','DEX','CON','INT','WIS','CHA'][st.ability] : st.ability
              return `${abilityName} ${st.modifier >= 0 ? '+' : ''}${st.modifier}`
            }).join(', ')}
          </div>
        </div>
      ` : ''}

      <!-- Skills -->
      ${c.skill || (c.skills && c.skills.length > 0) ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">SKILLS</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">
            ${c.skill || c.skills.map(sk => {
              const skillName = typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || 'Unknown')
              return `${skillName} ${sk.modifier >= 0 ? '+' : ''}${sk.modifier}`
            }).join(', ')}
          </div>
        </div>
      ` : ''}

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

      <!-- Senses -->
      ${c.senses ? `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">SENSES</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${c.senses}</div>
        </div>
      ` : ''}

      <!-- Languages -->
      ${c.languages ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;
                      margin-bottom:4px;">LANGUAGES</div>
          <div style="font-size:12px;color:#b8b0a0;line-height:1.5;">${c.languages}</div>
        </div>
      ` : ''}

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

      ${abilityBlock('TRAITS', c.traits, 'traits')}
      ${abilityBlock('ACTIONS', c.actions, 'actions')}
      ${abilityBlock('BONUS ACTIONS', c.bonusActions, 'bonus')}
      ${abilityBlock('REACTIONS', c.reactions, 'reactions')}
      ${abilityBlock('LEGENDARY ACTIONS', c.legendaryActions, 'legendary')}
      ${slotsHTML}
      ${dailySpellsHTML}
      ${knownSpellsHTML}

      <!-- Notes (collapsible) -->
      ${c.notes && c.notes.length > 0 ? `
        <div style="margin-top:12px;">
          <div onclick="toggleTraitText('notes-${c.uid}')"
            style="display:flex;align-items:center;gap:4px;cursor:pointer;
                   font-size:12px;color:#4a9a9a;letter-spacing:.08em;font-weight:700;margin-bottom:6px;">
            NOTES
            <span id="notes-${c.uid}-arrow" style="font-size:11px;color:#555;">▼</span>
          </div>
          <div id="notes-${c.uid}"
            style="display:none;color:#b8b0a0;font-size:12px;line-height:1.5;">
            ${c.notes.map(note => `
              <div style="margin-bottom:8px;">
                ${note.title ? `<div style="font-weight:bold;color:#4a9a9a;margin-bottom:2px;">${note.title}</div>` : ''}
                <div style="white-space:pre-wrap;">${note.body || ''}</div>
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
    if (btn) btn.textContent = 'X'
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

  panel.innerHTML = `
    <div style="padding:14px;">
      <div style="font-size:13px;color:#1E231A;letter-spacing:.1em;font-weight:700;
                  margin-bottom:14px;">ADD COMBATANTS</div>

      ${pcs.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;color:#555;letter-spacing:.06em;
                      margin-bottom:6px;font-weight:700;">PARTY</div>
          ${pcs.map(p => `
            <div onclick="addFromPC('${p.uid}')"
              style="padding:7px 10px;border:1px solid #1e2d4a;border-radius:4px;
                     margin-bottom:4px;cursor:pointer;font-size:12px;"
              onmouseover="this.style.borderColor='#4a9a9a'"
              onmouseout="this.style.borderColor='#1e2d4a'">
              <span style="font-weight:bold;">${p.label || p.name}</span>
              <span style="color:#555;margin-left:6px;font-size:11px;">
                HP ${p.hpMax} · AC ${p.ac || '—'}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${npcs.length > 0 ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;color:#555;letter-spacing:.06em;
                      margin-bottom:6px;font-weight:700;">NPCs</div>
          ${npcs.map(p => `
            <div onclick="addFromNPC('${p.uid}')"
              style="padding:7px 10px;border:1px solid #1e2d4a;border-radius:4px;
                     margin-bottom:4px;cursor:pointer;font-size:12px;"
              onmouseover="this.style.borderColor='#4a9a9a'"
              onmouseout="this.style.borderColor='#1e2d4a'">
              <span style="font-weight:bold;">${p.label || p.name}</span>
              <span style="color:#555;margin-left:6px;font-size:11px;">
                HP ${p.hpMax} · AC ${p.ac || '—'}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="margin-bottom:16px;">
        <div style="font-size:10px;color:#555;letter-spacing:.06em;
                    margin-bottom:6px;font-weight:700;">MONSTERS</div>
        <input type="text" placeholder="Search monsters…" value="${enc.monsterQ}"
          oninput="filterEncMonsters(this.value)"
          style="width:100%;padding:6px 10px;background:#5C5C5C;border:4px solid #2E2F2D;
                 color:#1E231A;font-family:var(--app-font);border-radius:3px;font-size:12px;
                 margin-bottom:6px;box-sizing:border-box;" />
        <div id="enc-monster-list" style="max-height:260px;overflow-y:auto;">
          ${filtered.length === 0
            ? '<p style="color:#444;font-size:12px;">No results</p>'
            : filtered.map(m => `
              <div id="monster-item-${m.name.replace(/[^a-zA-Z0-9]/g, '-')}"
                style="padding:6px 10px;border:1px solid #1e2d4a;border-radius:3px;
                       margin-bottom:3px;">
                <div onclick="showMonsterChoice('${m.name.replace(/'/g, "\\'")}')"
                  style="cursor:pointer;"
                  onmouseover="this.parentElement.style.borderColor='#4a9a9a'"
                  onmouseout="this.parentElement.style.borderColor='#1e2d4a'">
                  <div style="font-size:12px;font-weight:bold;">${m.name}</div>
                  <div style="font-size:11px;color:#555;">CR ${m.cr || '—'} · HP ${m.hp} · AC ${m.ac}</div>
                </div>
                <div id="monster-choice-${m.name.replace(/[^a-zA-Z0-9]/g, '-')}" style="display:none;margin-top:6px;padding-top:6px;border-top:1px solid #1e2d4a;">
                  <button onclick="addMonsterAsIs('${m.name.replace(/'/g, "\\'")}')"
                    style="width:100%;background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;
                           padding:5px;cursor:pointer;border-radius:3px;font-size:11px;
                           font-family:var(--app-font);margin-bottom:3px;">
                    Use As Is
                  </button>
                  <button onclick="modifyMonster('${m.name.replace(/'/g, "\\'")}')"
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

      <div>
        <div style="font-size:10px;color:#555;letter-spacing:.06em;
                    margin-bottom:6px;font-weight:700;">CUSTOM</div>
        <input id="custom-name" type="text" placeholder="Name"
          style="width:100%;padding:6px 10px;background:#0a1520;border:1px solid #2a3a5a;
                 color:#e0d5c5;font-family:var(--app-font);border-radius:3px;font-size:12px;
                 margin-bottom:4px;box-sizing:border-box;" />
        <div style="display:flex;gap:4px;margin-bottom:6px;">
          <input id="custom-hp" type="number" placeholder="HP" min="1"
            style="flex:1;padding:6px 8px;background:#0a1520;border:1px solid #2a3a5a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:3px;font-size:12px;" />
          <input id="custom-ac" type="number" placeholder="AC"
            style="flex:1;padding:6px 8px;background:#0a1520;border:1px solid #2a3a5a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:3px;font-size:12px;" />
        </div>
        <button onclick="addCustomCombatant()"
          style="width:100%;background:#3E3E3D;color:#1E231A;border:none;padding:7px;
                 cursor:pointer;border-radius:3px;font-size:12px;font-family:var(--app-font);font-weight:700;">
          + Add Custom
        </button>
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
  list.innerHTML = filtered.length === 0
    ? '<p style="color:#444;font-size:12px;">No results</p>'
    : filtered.map(m => `
        <div id="monster-item-${m.name.replace(/[^a-zA-Z0-9]/g, '-')}"
          style="padding:6px 10px;border:1px solid #1e2d4a;border-radius:3px;margin-bottom:3px;">
          <div onclick="showMonsterChoice('${m.name.replace(/'/g, "\\'")}')"
            style="cursor:pointer;"
            onmouseover="this.parentElement.style.borderColor='#4a9a9a'"
            onmouseout="this.parentElement.style.borderColor='#1e2d4a'">
            <div style="font-size:12px;font-weight:bold;">${m.name}</div>
            <div style="font-size:11px;color:#555;">CR ${m.cr || '—'} · HP ${m.hp} · AC ${m.ac}</div>
          </div>
          <div id="monster-choice-${m.name.replace(/[^a-zA-Z0-9]/g, '-')}" style="display:none;margin-top:6px;padding-top:6px;border-top:1px solid #1e2d4a;">
            <button onclick="addMonsterAsIs('${m.name.replace(/'/g, "\\'")}')"
              style="width:100%;background:#1a4a2a;color:#8fd9a8;border:1px solid #2a7a4a;
                     padding:5px;cursor:pointer;border-radius:3px;font-size:11px;
                     font-family:var(--app-font);margin-bottom:3px;">
              Use As Is
            </button>
            <button onclick="modifyMonster('${m.name.replace(/'/g, "\\'")}')"
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
    btn.textContent = '⏭ Next Turn'
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
  enc.turn = (enc.turn + 1) % count
  if (enc.turn === 0) {
    enc.round++
  }
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
    btn.textContent = '▶ Start Combat'
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
  let spellSlots = null
  if (pc.slots) {
    const nums = pc.slots.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
    if (nums.length > 0) spellSlots = nums.map((total, i) => ({ level: i + 1, total, used: 0 }))
  }
  const pcTraits = (pc.traits || []).map(t => {
    const inferred = (t.charges === null && t.recharge === null) ? parseUsesFromName(t.name) : {}
    const charges = t.charges !== null ? t.charges : (inferred.charges ?? null)
    const recharge = t.recharge !== null ? t.recharge : (inferred.recharge ?? null)
    return { ...t, charges, recharge, chargesCurrent: charges !== null ? charges : null }
  })
  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name: pc.label || pc.name,
    type: 'PC',
    isPC: true,
    isEnemy: false,
    level: pc.level || 1,
    initiative: 0,
    ac: pc.ac,
    speed: pc.speed,
    hpMax: parseInt(pc.hpMax) || 1,
    hpCurrent: parseInt(pc.hpCurrent) || parseInt(pc.hpMax) || 1,
    conditions: [],
    traits: pcTraits,
    actions: (pc.actions || []).map(a => {
      const inferred = parseUsesFromName(a.name)
      return { name: a.name, text: a.text, charges: inferred.charges, chargesCurrent: inferred.charges, recharge: inferred.recharge }
    }),
    spellSlots,
    dailySpells: parseDailySpells(pcTraits),
    spells: pc.spells || [],
    portrait: pc.portrait || null,
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
  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name: npc.label || npc.name,
    type: 'NPC',
    isPC: false,
    isEnemy: true,
    cr: npc.cr || '0',
    initiative: initRoll,
    ac: npc.ac,
    speed: npc.speed,
    hpMax: parseInt(npc.hpMax) || 1,
    hpCurrent: parseInt(npc.hpCurrent) || parseInt(npc.hpMax) || 1,
    conditions: [],
    traits: npcTraits,
    actions: (npc.actions || []).map(a => {
      const inferred = parseUsesFromName(a.name)
      return { name: a.name, text: a.text, charges: inferred.charges, chargesCurrent: inferred.charges, recharge: inferred.recharge }
    }),
    spellSlots,
    dailySpells: parseDailySpells(npcTraits),
    spells: npc.spells || [],
    portrait: npc.portrait || npc._draft?.portrait || null,
  })
  showToast(`${npc.label || npc.name} added — initiative: ${initRoll}`)
  refreshInitSidebar()
  refreshCards()
}

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
  enc.current.combatants.push({
    uid: makeCombatantUid(),
    name: m.name,
    type: 'Monster',
    isPC: false,
    isEnemy: true,
    cr: m.cr || '0',
    initiative: initRoll,
    ac: m.ac,
    speed: m.speed,
    hpMax: hpNum,
    hpCurrent: hpNum,
    conditions: [],
    traits,
    actions: (m.actions || []).map(a => {
      const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
      const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
      const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
      return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    }),
    spellSlots,
    dailySpells: parseDailySpells(traits),
    spells: parseMonsterSpells(m.spells, traits, m.actions),
    portrait: m.portrait || null,
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
  enc.current.combatants = enc.current.combatants.filter(c => c.uid !== uid)
  if (enc.inCombat) {
    const count = enc.current.combatants.length
    if (count === 0) { endCombat(); return }
    if (enc.turn >= count) enc.turn = 0
  }
  refreshInitSidebar()
  refreshCards()
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

function adjustCombatantSpellUse(uid, idx, delta) {
  const c = enc.current?.combatants.find(x => x.uid === uid)
  if (!c || !c.spells || !c.spells[idx]) return
  const spell = c.spells[idx]
  if (spell.usesMax == null) return
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

  // Create new campaign
  compendiumData.campaigns[name] = {
    players: [],
    npcs: [],
    adventures: []
  }

  // Set as active campaign
  compendiumData.activeCampaign = name
  compendiumData.players = []
  compendiumData.npcs = []

  // Save to storage
  saveCampaigns(compendiumData.campaigns)

  // Show toast
  showToast(`Campaign "${name}" created`)

  // Re-render to update UI
  render()
  showSection('home')
}

function cancelNewCampaign() {
  const container = document.getElementById('new-campaign-container')
  if (!container) return

  container.innerHTML = `
    <button onclick="showNewCampaignForm()"
      style="background:#1E231A;color:#909090;border:2px solid #445E22;
             padding:4px 10px;cursor:pointer;border-radius:4px;font-size:11px;
             font-family:var(--app-font);white-space:nowrap;font-weight:700;"
      onmouseover="this.style.borderColor='#4a9a9a';this.style.background='#2a3a2a'"
      onmouseout="this.style.borderColor='#445E22';this.style.background='#1E231A'">
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

    // Re-render to update UI
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
function renderMonsters(container) {
  if (compendiumData.monsters.length === 0) {
    container.innerHTML = `
      <p style="color:#555;margin-bottom:16px;">No monsters loaded. Import your compendium XML to get started.</p>
      <button onclick="importXML()"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:9px 18px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
        Import Compendium XML
      </button>
    `
    return
  }
  container.innerHTML = `
    <input id="monster-search" type="text" placeholder="Search monsters…"
      style="width:100%;max-width:500px;padding:8px 12px;margin-bottom:16px;background:#5C5C5C;
             border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
             border-radius:4px;font-size:14px;display:block;"
      oninput="filterMonsters(this.value)" />
    <div id="monster-grid"
      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
    </div>
  `
  renderMonsterGrid(compendiumData.monsters)
}

function filterMonsters(query) {
  renderMonsterGrid(compendiumData.monsters.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase())
  ))
}

function renderMonsterGrid(monsters) {
  const grid = document.getElementById('monster-grid')
  if (!grid) return
  if (monsters.length === 0) {
    grid.innerHTML = '<p style="color:#555;grid-column:1/-1;">No monsters match that search.</p>'
    return
  }
  grid.innerHTML = monsters.map(m => `
    <div onclick="showMonster(decodeURIComponent(this.dataset.name))" data-name="${encodeURIComponent(m.name)}"
      style="background:#262F35;border:1px solid #1e2d4a;padding:12px;border-radius:4px;cursor:pointer;"
      onmouseover="this.style.borderColor='#4a9a9a'" onmouseout="this.style.borderColor='#1e2d4a'">
      <div style="font-weight:bold;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4587A2;">
        ${m.name}
      </div>
      <div style="font-size:12px;color:#666;">${m.size} ${m.type}</div>
      <div style="font-size:12px;color:#666;">CR ${m.cr || '—'}</div>
    </div>
  `).join('')
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
        ${it.name ? `<strong style="font-size:14.5px;color:#7B9BA8;">${it.name}.</strong> ` : ''}${it.text||''}</div>`).join('')}
    </div>`
  }
  const abs = [['STR','str'],['DEX','dex'],['CON','con'],['INT','int'],['WIS','wis'],['CHA','cha']]
  // Check for homebrew/third-party flags from _draft or direct properties
  const isHomebrew = m._draft?.homebrew || m.homebrew
  const isThirdParty = m._draft?.thirdParty || m.thirdParty
  console.log('[buildMonsterDetailCard]', m.name, 'homebrew:', isHomebrew, 'thirdParty:', isThirdParty, '_draft:', m._draft)

  return `
    <div style="background:#262F35;border:none;border-radius:6px;
                padding:20px;max-width:840px;font-family:var(--app-font);color:#e0d5c5;">
      <div style="position:relative;margin-bottom:8px;padding-bottom:${m.portrait ? '12px' : '0'};">
        ${m.portrait ? `
          <img src="${m.portrait}" style="position:absolute;top:0;right:0;width:60px;height:60px;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;${m.portrait ? 'padding-right:70px;' : ''}">
          <div style="font-size:22px;font-weight:bold;">${m.name}</div>
          ${isHomebrew ? `<span style="background:#4a9a9a;color:#e0d5c5;font-size:10px;
            padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:700;">HOMEBREW</span>` : ''}
          ${isThirdParty ? `<span style="background:#3a5a7a;color:#e0d5c5;font-size:10px;
            padding:3px 8px;border-radius:3px;letter-spacing:.06em;font-weight:700;">3RD PARTY</span>` : ''}
        </div>
        <div style="font-size:13px;color:#888;font-style:italic;">
          ${[m.size,m.type,m.alignment].filter(Boolean).join(' · ')}
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
      ${sline('Skills', m.skill)}
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
      ${m.tag ? sline('Tag', m.tag) : ''}
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
                <div style="font-size:13px;white-space:pre-wrap;color:#bbb;line-height:1.6;">${fullSpell.text || ''}</div>
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
        ${it.name ? `<strong style="font-size:14.5px;color:#7B9BA8;">${it.name}.</strong> ` : ''}${it.text||''}</div>`).join('')}
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
    </div>
    <div style="background:#262F35;border:none;border-radius:6px;
                padding:20px;max-width:840px;font-family:var(--app-font);color:#e0d5c5;">
      <div style="position:relative;padding-bottom:${npc.portrait || npc._draft?.portrait ? '12px' : '0'};">
        ${npc.portrait || npc._draft?.portrait ? `
          <img src="${npc.portrait || npc._draft?.portrait}" style="position:absolute;top:0;right:0;width:60px;height:60px;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        ${displayName ? `
          <div style="font-size:26px;font-weight:bold;margin-bottom:4px;color:#e0d5c5;${npc.portrait || npc._draft?.portrait ? 'padding-right:70px;' : ''}">
            ${displayName}
          </div>
        ` : ''}
        <div style="margin-bottom:8px;">
          <div style="font-size:${displayName ? '18' : '22'}px;font-weight:bold;margin-bottom:2px;
                      ${displayName ? 'color:#888;' : ''}${(npc.portrait || npc._draft?.portrait) && !displayName ? 'padding-right:70px;' : ''}">
            ${npc.name}
          </div>
          <div style="font-size:13px;color:#888;font-style:italic;">
            ${[npc.size, npc.type].filter(Boolean).join(' ')}${npc.tag ? ` (${npc.tag})` : ''}
          </div>
        </div>
      </div>
      ${npc.notes && npc.notes.length > 0 ? `
        <div style="background:#0d1b2a;border:1px solid #1e2d4a;border-radius:4px;padding:12px;margin-bottom:12px;">
          ${npc.notes.map(note => `
            <div style="margin-bottom:${note === npc.notes[npc.notes.length-1] ? '0' : '10'}px;">
              ${note.title ? `<div style="font-size:12px;color:#4a9a9a;letter-spacing:.06em;
                font-weight:700;margin-bottom:4px;">${note.title}</div>` : ''}
              <div style="font-size:13px;color:#b8b0a0;line-height:1.6;white-space:pre-wrap;">
                ${note.body || ''}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
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
      ${sline('Skills', npc.skill || (npc.skills && npc.skills.length > 0
        ? npc.skills.map(sk => {
            const skillName = typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || 'Unknown')
            return `${skillName} ${sk.modifier >= 0 ? '+' : ''}${sk.modifier}`
          }).join(', ')
        : ''))}
      ${sline('Saving Throws', npc.save || (npc.savingThrows && npc.savingThrows.length > 0
        ? npc.savingThrows.map(st => {
            const abilityName = typeof st.ability === 'number' ? ABILITY_NAMES[st.ability] : st.ability
            return `${abilityName} ${st.modifier >= 0 ? '+' : ''}${st.modifier}`
          }).join(', ')
        : ''))}
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
          return `<div style="margin-bottom:4px;">
              <div onclick="const el=document.getElementById('${id}');el.style.display=el.style.display==='none'?'block':'none'"
                style="background:#0f3460;padding:10px 14px;border-radius:4px;cursor:pointer;
                       display:flex;justify-content:space-between;align-items:center;"
                onmouseover="this.style.background='#1a4a8a'"
                onmouseout="this.style.background='#0f3460'">
                <span style="font-size:13px;color:#e0d5c5;">${prefix}${fullSpell.name}</span>
                <span style="font-size:11px;color:#888;background:#1A1C1E;padding:2px 8px;border-radius:3px;min-width:24px;text-align:center;">
                  ${(fullSpell.level === '0' || fullSpell.level === 0 || !fullSpell.level) ? 'C' : fullSpell.level}
                </span>
              </div>
              <div id="${id}"
                style="display:none;background:#1A1C1E;padding:12px;border-radius:0 0 4px 4px;
                       border:1px solid #0f3460;border-top:none;">
                <div style="font-size:12px;color:#666;margin-bottom:6px;">
                  ${(fullSpell.level === '0' || fullSpell.level === 0 || !fullSpell.level) ? 'C' : 'Level ' + fullSpell.level}
                  ${fullSpell.time ? ' · ' + fullSpell.time : ''}
                  ${fullSpell.range ? ' · ' + fullSpell.range : ''}
                  ${fullSpell.duration ? ' · ' + fullSpell.duration : ''}
                </div>
                <div style="font-size:13px;white-space:pre-wrap;color:#bbb;line-height:1.6;">${fullSpell.text || ''}</div>
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
    </div>`
}

function showPC(uid, skipHistory = false) {
  console.log('showPC called with uid:', uid)
  const pc = compendiumData.players.find(p => p.uid === uid)
  console.log('Found PC:', pc ? pc.name || pc.label : 'NOT FOUND')
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
        ${it.name ? `<strong>${it.name}.</strong> ` : ''}${it.desc||it.text||''}</div>`).join('')}
    </div>`
  }
  const abs = [['STR','str'],['DEX','dex'],['CON','con'],['INT','int'],['WIS','wis'],['CHA','cha']]
  // Use label as display name, name as class info for XML-imported PCs
  const displayName = pc.label || pc.name || 'Unnamed Character'
  const classInfo = pc._draft ? (pc._draft.class || '') : (pc.name || '')

  // Calculate proficiency bonus from level if not stored
  let profBonus = pc.proficiencyBonus || pc._draft?.proficiencyBonus
  if (!profBonus) {
    const level = parseInt(pc.level || pc.cr) || 1
    profBonus = level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : level <= 16 ? 5 : 6
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
    </div>
    <div style="background:#262F35;border:none;border-radius:6px;
                padding:20px;max-width:840px;font-family:var(--app-font);color:#e0d5c5;">
      <div style="margin-bottom:8px;position:relative;padding-bottom:${pc.portrait ? '12px' : '0'};">
        ${pc.portrait ? `
          <img src="${pc.portrait}" style="position:absolute;top:0;right:0;width:60px;height:60px;
               border-radius:50%;object-fit:cover;border:2px solid #4587A2;">
        ` : ''}
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:2px;${pc.portrait ? 'padding-right:70px;' : ''}">
          <div style="font-size:22px;font-weight:bold;">
            ${displayName}
          </div>
          ${classInfo ? `<div style="font-size:15px;color:#999;">
            ${classInfo}
          </div>` : ''}
        </div>
        <div style="font-size:13px;color:#888;font-style:italic;">
          ${size} ${type}
        </div>
        ${pc.player ? `<div style="font-size:13px;color:#666;margin-top:2px;">
          Played by ${pc.player}</div>` : ''}
      </div>
      ${pc.notes && pc.notes.length > 0 ? `
        <div style="background:#0d1b2a;border:1px solid #1e2d4a;border-radius:4px;padding:12px;margin-bottom:12px;">
          ${pc.notes.map(note => `
            <div style="margin-bottom:${note === pc.notes[pc.notes.length-1] ? '0' : '10'}px;">
              ${note.title ? `<div style="font-size:12px;color:#4a9a9a;letter-spacing:.06em;
                font-weight:700;margin-bottom:4px;">${note.title}</div>` : ''}
              <div style="font-size:13px;color:#b8b0a0;line-height:1.6;white-space:pre-wrap;">
                ${note.body || ''}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
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
            if (pc.init !== undefined) {
              const init = parseInt(pc.init)
              return init >= 0 ? '+' + init : init
            }
            if (pc._draft?.initiativeBonus !== undefined) {
              const init = pc._draft.initiativeBonus
              return init >= 0 ? '+' + init : init
            }
            // Calculate from DEX if not provided
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
      ${pc.skills && pc.skills.length > 0 ? sline('Skills',
        pc.skills.map(sk => {
          const skillName = typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || 'Unknown')
          const mod = sk.modifier || 0
          return `${skillName} ${mod >= 0 ? '+' : ''}${mod}`
        }).join(', ')
      ) : ''}
      ${pc.savingThrows && pc.savingThrows.length > 0 ? sline('Saving Throws',
        pc.savingThrows.map(st => {
          const abilityName = typeof st.ability === 'number' ? ABILITY_NAMES[st.ability] : (st.ability || st.name || 'Unknown')
          const mod = st.modifier || 0
          return `${abilityName} ${mod >= 0 ? '+' : ''}${mod}`
        }).join(', ')
      ) : ''}
      ${sline('Senses', pc.senses)}
      ${sline('Languages', pc.languages)}
      ${sline('Proficiency Bonus', `+${profBonus}`)}
      ${absec('TRAITS', pc.traits)}
      ${absec('ACTIONS', pc.actions)}
      ${absec('BONUS ACTIONS', pc.bonusActions)}
      ${absec('REACTIONS', pc.reactions)}
      ${absec('LEGENDARY ACTIONS', pc.legendaryActions)}
      ${(() => {
        console.log('PC spells check:', pc.name, 'selectedSpells:', pc.selectedSpells?.length, 'spells:', pc.spells?.length, '_draft:', !!pc._draft)
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
                <div style="font-size:13px;white-space:pre-wrap;color:#bbb;line-height:1.6;">${fullSpell.text || ''}</div>
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
          ${item.name ? `<strong>${item.name}.</strong> ` : ''}${item.text}
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
function renderSpells(container) {
  if (compendiumData.spells.length === 0) {
    container.innerHTML = `
      <p style="color:#555;margin-bottom:16px;">No spells loaded. Import your compendium XML to get started.</p>
      <button onclick="importXML()"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:9px 18px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
        Import Compendium XML
      </button>
    `
    return
  }
  container.innerHTML = `
    <input type="text" placeholder="Search spells…"
      style="width:100%;max-width:500px;padding:8px 12px;margin-bottom:16px;background:#5C5C5C;
             border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
             border-radius:4px;font-size:14px;display:block;"
      oninput="filterSpells(this.value)" />
    <div id="spell-list"></div>
  `
  renderSpellList(compendiumData.spells)
}

function filterSpells(query) {
  renderSpellList(compendiumData.spells.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.classes.toLowerCase().includes(query.toLowerCase())
  ))
}

function renderSpellList(spells) {
  const list = document.getElementById('spell-list')
  if (!list) return
  if (spells.length === 0) {
    list.innerHTML = '<p style="color:#555;">No spells match that search.</p>'
    return
  }
  list.innerHTML = spells.map(s => `
    <div onclick="showSpell('${s.name.replace(/'/g, "\\'")}')"
      style="background:#262F35;border:1px solid #1e2d4a;padding:12px;border-radius:4px;
             margin-bottom:6px;cursor:pointer;"
      onmouseover="this.style.borderColor='#4a9a9a'" onmouseout="this.style.borderColor='#1e2d4a'">
      <div style="font-weight:bold;color:#4587A2;">${s.name}</div>
      <div style="font-size:12px;color:#666;margin-top:2px;">
        ${s.level === '0' ? 'Cantrip' : 'Level ' + s.level} ${s.school}
        ${s.classes ? ' · ' + s.classes : ''}
      </div>
      <div style="font-size:12px;color:#555;margin-top:1px;">${s.time} · ${s.range} · ${s.duration}</div>
    </div>
  `).join('')
}

function showSpell(name, skipHistory = false) {
  const s = compendiumData.spells.find(x => x.name === name)
  if (!s) return
  if (!skipHistory) pushNav('spell-detail', name)
  else currentScreen = { screen: 'spell-detail', uid: name }

  const content = document.getElementById('content')

  content.innerHTML = `
    <button onclick="popNav()"
      style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
             cursor:pointer;border-radius:4px;margin-bottom:20px;font-family:var(--app-font);
             font-size:13px;">
      ← Back to Spells
    </button>
    <div style="background:#262F35;border:2px solid #4a9a9a;border-radius:6px;
                padding:24px;max-width:700px;">
      <h2 style="font-size:24px;margin-bottom:4px;">${s.name}</h2>
      <p style="font-style:italic;color:#888;margin-bottom:12px;">
        ${s.level === '0' ? 'Cantrip' : 'Level ' + s.level} — ${s.school}
      </p>
      <hr style="border:none;border-top:1px solid #1A1C1E;margin-bottom:12px;">
      ${statRow('Casting Time', s.time)}
      ${statRow('Range', s.range)}
      ${statRow('Components', s.components)}
      ${statRow('Duration', s.duration)}
      ${statRow('Classes', s.classes)}
      <hr style="border:none;border-top:1px solid #4a9a9a;margin:12px 0;">
      <p style="line-height:1.7;white-space:pre-wrap;font-size:14px;">${s.text}</p>
    </div>
  `
}

// ── Characters (Players) ──────────────────────────────────────────
function renderPlayers(container) {
  if (compendiumData.players.length === 0 && compendiumData.npcs.length === 0) {
    container.innerHTML = `
      <p style="color:#555;margin-bottom:16px;">No characters loaded. Import a campaign XML to get started.</p>
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
      <div style="font-size:12px;color:#666;margin-bottom:10px;
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:12px;">
        <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
          <div style="font-size:9px;color:#555;letter-spacing:.06em;">HP</div>
          <div style="font-weight:bold;">${p.hpCurrent}/${p.hpMax}</div>
        </div>
        <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
          <div style="font-size:9px;color:#555;letter-spacing:.06em;">AC</div>
          <div style="font-weight:bold;">${p.ac || '—'}</div>
        </div>
        <div style="background:#1A1C1E;padding:5px 4px;border-radius:3px;text-align:center;">
          <div style="font-size:9px;color:#555;letter-spacing:.06em;">INIT</div>
          <div style="font-weight:bold;">${p.init ? modStr(parseInt(p.init)) : '—'}</div>
        </div>
      </div>
    </div>
  `).join('')
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
        ? `<div style="color:#444;font-size:13px;font-style:italic;">No notes yet.</div>`
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
          ${displayTitle}
        </span>
        <div style="display:flex;gap:8px;align-items:center;" onclick="event.stopPropagation()">
          <button onclick="deleteNote('${scopeJs}','${note.id}')"
            style="background:none;border:none;color:#555;font-size:14px;cursor:pointer;padding:2px 4px;"
            title="Delete note">&#x2715;</button>
          <span id="note-arrow-${note.id}" style="color:#555;font-size:12px;pointer-events:none;">▼</span>
        </div>
      </div>
      <div id="note-body-${note.id}" style="display:none;padding:12px;background:#1E231A;">
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
  if (body)  body.style.display = 'block'
  if (arrow) arrow.textContent  = '▲'
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
  const header = document.getElementById('note-header-' + noteId)
  if (header) header.textContent = note.title || 'Untitled'
}

function deleteNote(scope, noteId) {
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
          ${allNPCs.length === 0 ? '<div style="color:#555;font-size:13px;">No NPCs in campaign</div>' : ''}
          ${allNPCs.map(npc => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <input type="checkbox" id="npc-${npc.uid}"
                ${(adventure.npcUids || []).includes(npc.uid) ? 'checked' : ''}
                onchange="toggleAdventureNPC('${id}', '${npc.uid}', this.checked)"
                style="cursor:pointer;">
              <label onclick="showNPC('${npc.uid}')"
                style="flex:1;color:#e0d5c5;font-size:13px;cursor:pointer;">
                ${npc.properName || npc.label || npc.name}
              </label>
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

  adventure.encounterIds = (adventure.encounterIds || []).filter(id => id !== encounterId)
  saveCampaigns(compendiumData.campaigns)
  openAdventure(adventureId, true)
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
        <div style="color:#555;font-size:13px;">
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
    } catch (err) { console.error('Auto-load compendium failed:', err) }
  }

  const savedCampaigns = loadCampaigns()
  if (savedCampaigns) {
    try {
      compendiumData.campaigns = savedCampaigns
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
    try { enc.list = savedEncounters } catch (err) { console.error('Auto-load encounters failed:', err) }
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
      ${diceState.open ? 'X' : `<img src="${dieImages.d20}" alt="d20" style="width:48px;height:48px;object-fit:contain;pointer-events:none;" />`}
    </button>
  `
}

function toggleHistory() {
  diceState.historyOpen = !diceState.historyOpen
  renderDiceRoller()
}

function toggleDiceTray() {
  if (diceState.open) {
    // Close the tray
    diceState.open = false
    diceState.historyOpen = false
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
    tail = document.createElement('div')
    tail.id = 'dice-result-tail'
    document.body.appendChild(tail)
  }

  // Position below Ignacious (Ignacious is 220px tall at top:0, left:0)
  bubble.style.cssText = `
    position:fixed;
    top:230px;
    left:30px;
    background:#2a2a2a;
    border:2px solid #4a9a9a;
    color:#e0d5c5;
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

  // Tail pointing upward
  tail.style.cssText = `
    position:fixed;
    top:220px;
    left:110px;
    width:0;
    height:0;
    border-left:10px solid transparent;
    border-right:10px solid transparent;
    border-bottom:14px solid #4a9a9a;
    opacity:0;
    transition:opacity .3s;
    pointer-events:none;
    z-index:9999;
  `

  bubble.innerHTML = `
    <div style="font-size:32px;font-weight:bold;margin-bottom:8px;color:#c9a87c;">
      ${total}
    </div>
    <div style="font-size:12px;color:#888;line-height:1.4;">
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
window.resetDie = resetDie
window.startLongPress = startLongPress
window.cancelLongPress = cancelLongPress
window.rollDice = rollDice

// ── Boot ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadFontPreference()
  render()
  autoLoad()
  initIgnaciousEyeTracking()
})
