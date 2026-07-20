// ── PC Builder ──────────────────────────────────────────────────
// Reuses Monster Builder and NPC Builder components for player characters

const pcb = {
  originalUid: null,
  draft: null,
  dirty: false,
}

// D&D 5e spell slot tables
const PC_SPELL_SLOTS_FULL = [
  [2,0,0,0,0,0,0,0,0], // Level 1
  [3,0,0,0,0,0,0,0,0], // Level 2
  [4,2,0,0,0,0,0,0,0], // Level 3
  [4,3,0,0,0,0,0,0,0], // Level 4
  [4,3,2,0,0,0,0,0,0], // Level 5
  [4,3,3,0,0,0,0,0,0], // Level 6
  [4,3,3,1,0,0,0,0,0], // Level 7
  [4,3,3,2,0,0,0,0,0], // Level 8
  [4,3,3,3,1,0,0,0,0], // Level 9
  [4,3,3,3,2,0,0,0,0], // Level 10
  [4,3,3,3,2,1,0,0,0], // Level 11
  [4,3,3,3,2,1,0,0,0], // Level 12
  [4,3,3,3,2,1,1,0,0], // Level 13
  [4,3,3,3,2,1,1,0,0], // Level 14
  [4,3,3,3,2,1,1,1,0], // Level 15
  [4,3,3,3,2,1,1,1,0], // Level 16
  [4,3,3,3,2,1,1,1,1], // Level 17
  [4,3,3,3,3,1,1,1,1], // Level 18
  [4,3,3,3,3,2,1,1,1], // Level 19
  [4,3,3,3,3,2,2,1,1], // Level 20
]

const PC_SPELL_SLOTS_HALF = [
  [0,0,0,0,0,0,0,0,0], // Level 1
  [2,0,0,0,0,0,0,0,0], // Level 2
  [3,0,0,0,0,0,0,0,0], // Level 3
  [3,0,0,0,0,0,0,0,0], // Level 4
  [4,2,0,0,0,0,0,0,0], // Level 5
  [4,2,0,0,0,0,0,0,0], // Level 6
  [4,3,0,0,0,0,0,0,0], // Level 7
  [4,3,0,0,0,0,0,0,0], // Level 8
  [4,3,2,0,0,0,0,0,0], // Level 9
  [4,3,2,0,0,0,0,0,0], // Level 10
  [4,3,3,0,0,0,0,0,0], // Level 11
  [4,3,3,0,0,0,0,0,0], // Level 12
  [4,3,3,1,0,0,0,0,0], // Level 13
  [4,3,3,1,0,0,0,0,0], // Level 14
  [4,3,3,2,0,0,0,0,0], // Level 15
  [4,3,3,2,0,0,0,0,0], // Level 16
  [4,3,3,3,1,0,0,0,0], // Level 17
  [4,3,3,3,1,0,0,0,0], // Level 18
  [4,3,3,3,2,0,0,0,0], // Level 19
  [4,3,3,3,2,0,0,0,0], // Level 20
]

const PC_SPELL_SLOTS_QUARTER = [
  [0,0,0,0,0,0,0,0,0], // Level 1
  [0,0,0,0,0,0,0,0,0], // Level 2
  [2,0,0,0,0,0,0,0,0], // Level 3
  [3,0,0,0,0,0,0,0,0], // Level 4
  [3,0,0,0,0,0,0,0,0], // Level 5
  [3,0,0,0,0,0,0,0,0], // Level 6
  [4,2,0,0,0,0,0,0,0], // Level 7
  [4,2,0,0,0,0,0,0,0], // Level 8
  [4,2,0,0,0,0,0,0,0], // Level 9
  [4,3,0,0,0,0,0,0,0], // Level 10
  [4,3,0,0,0,0,0,0,0], // Level 11
  [4,3,0,0,0,0,0,0,0], // Level 12
  [4,3,2,0,0,0,0,0,0], // Level 13
  [4,3,2,0,0,0,0,0,0], // Level 14
  [4,3,2,0,0,0,0,0,0], // Level 15
  [4,3,3,0,0,0,0,0,0], // Level 16
  [4,3,3,0,0,0,0,0,0], // Level 17
  [4,3,3,0,0,0,0,0,0], // Level 18
  [4,3,3,1,0,0,0,0,0], // Level 19
  [4,3,3,1,0,0,0,0,0], // Level 20
]

const PC_SPELL_SLOTS_WARLOCK = [
  [1,0,0,0,0,0,0,0,0], // Level 1 - 1 slot, all are 1st level
  [2,0,0,0,0,0,0,0,0], // Level 2 - 2 slots, all are 1st level
  [0,2,0,0,0,0,0,0,0], // Level 3 - 2 slots, all are 2nd level
  [0,2,0,0,0,0,0,0,0], // Level 4
  [0,0,2,0,0,0,0,0,0], // Level 5 - 2 slots, all are 3rd level
  [0,0,2,0,0,0,0,0,0], // Level 6
  [0,0,0,2,0,0,0,0,0], // Level 7 - 2 slots, all are 4th level
  [0,0,0,2,0,0,0,0,0], // Level 8
  [0,0,0,0,2,0,0,0,0], // Level 9 - 2 slots, all are 5th level
  [0,0,0,0,2,0,0,0,0], // Level 10
  [0,0,0,0,3,0,0,0,0], // Level 11 - 3 slots, all are 5th level
  [0,0,0,0,3,0,0,0,0], // Level 12
  [0,0,0,0,3,0,0,0,0], // Level 13
  [0,0,0,0,3,0,0,0,0], // Level 14
  [0,0,0,0,3,0,0,0,0], // Level 15
  [0,0,0,0,3,0,0,0,0], // Level 16
  [0,0,0,0,4,0,0,0,0], // Level 17 - 4 slots, all are 5th level
  [0,0,0,0,4,0,0,0,0], // Level 18
  [0,0,0,0,4,0,0,0,0], // Level 19
  [0,0,0,0,4,0,0,0,0], // Level 20
]

function openPCBuilder(uid = null) {
  if (typeof pushNav === 'function') {
    pushNav('pc-builder', uid)
  } else if (typeof window.currentScreen !== 'undefined') {
    window.currentScreen = { screen: 'pc-builder', uid }
  }

  if (uid) {
    const existing = compendiumData.players.find(p => p.uid === uid)
    if (!existing) return
    pcb.draft = pcbDraftFromPC(existing)
    pcb.originalUid = uid
  } else {
    pcb.draft = pcbDefaultDraft()
    pcb.originalUid = null
  }

  // Auto-fill initiative bonus from DEX if not set
  if (!pcb.draft.initiativeBonus || pcb.draft.initiativeBonus === 0) {
    const dex = parseInt(pcb.draft.dex) || 10
    pcb.draft.initiativeBonus = Math.floor((dex - 10) / 2)
  }

  pcb.dirty = false

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.style.color = btn.id === 'nav-home' ? '#e0d5c5' : '#888'
    btn.style.borderBottomColor = btn.id === 'nav-home' ? '#8b0000' : 'transparent'
  })

  const content = document.getElementById('content')
  content.style.padding = '0'
  content.style.overflow = 'auto'
  content.style.overflowY = 'auto'

  renderPCBuilder()
}

function pcbDefaultDraft() {
  return {
    // PC-specific fields
    name: '',           // Character name
    player: '',         // Player name
    class: '',          // e.g. "Fighter", "Rogue 5 / Wizard 3"
    subclass: '',       // e.g. "Battle Master", "Arcane Trickster"
    race: '',           // e.g. "Human", "Half-Elf"
    level: 1,
    background: '',
    proficiencyBonus: 2, // Auto-calculated

    // Notes (from NPC Builder)
    notes: [],

    // Reuse monster builder fields
    portrait: null,
    size: 'Medium',
    type: 'Humanoid',
    type2: 'None',
    alignment: 'Neutral',
    alignmentTypically: false,
    tag: '',

    // Combat
    acValue: 10,
    acModifier: '—',
    armor: '',
    hpValue: 10,
    hitDiceCount: 1,
    hitDiceSize: 'd8',
    speed: '30 ft.',
    speedEntries: [{type:'Walk',ft:30}],
    initiativeBonus: 0,

    // Abilities
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,

    // Skills and resistances
    savingThrows: [],
    skills: [],
    vulnerable: [],
    resist: [],
    immune: [],
    conditionImmune: [],
    senses: '',
    passive: '',
    passiveInsight: null,
    passiveInvestigation: null,
    languages: '',

    // Features
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],

    // Spells
    selectedSpells: [],
    spellSlots: [0,0,0,0,0,0,0,0,0],
    spellcastingType: 'None', // None, Full Caster, Half Caster, Quarter Caster, Warlock, Custom

    description: '',
  }
}

function pcbDraftFromPC(pc) {
  const d = pcbDefaultDraft()
  if (pc._draft) {
    return {...d, ...pc._draft}
  }

  // Map from XML format
  // In XML: label = character name, level stored in cr field, classInfo contains full class string
  const displayName = pc.label || pc.name || ''

  // Level comes from cr field for PCs
  let level = 1
  if (pc.level) {
    level = parseInt(pc.level) || 1
  }

  // Class info is the full name field (e.g. "Shifter Paladin (Conquest)")
  // Parse out class name and subclass if present
  let className = ''
  let subclass = ''
  let race = ''

  if (pc.classInfo) {
    // Parse from classInfo field (e.g. "Shifter Paladin (Conquest)")
    // Pattern: Race Class (Subclass)
    const parts = pc.classInfo.trim()

    // Extract subclass from parentheses if present
    const subclassMatch = parts.match(/\(([^)]+)\)/)
    if (subclassMatch) {
      subclass = subclassMatch[1].trim()
    }

    // Remove subclass part to get race and class
    const withoutSubclass = parts.replace(/\s*\([^)]+\)/, '').trim()
    const words = withoutSubclass.split(/\s+/)

    // First word is typically race, remaining words are class name
    if (words.length >= 2) {
      race = words[0]
      className = words.slice(1).join(' ')
    } else if (words.length === 1) {
      // Just class name, no race
      className = words[0]
    }
  }

  // Map abilities from array
  const abilities = Array.isArray(pc.abilities) ? pc.abilities : ['10','10','10','10','10','10']

  // Map saving throws with ability names
  const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  const savingThrows = Array.isArray(pc.savingThrows)
    ? pc.savingThrows.map(st => ({
        ability: ABILITY_NAMES[st.ability] || 'STR',
        modifier: st.modifier || 0
      }))
    : []

  // Map skills with skill names
  const SKILL_NAMES = [
    'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
    'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
    'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
    'Sleight of Hand', 'Stealth', 'Survival'
  ]
  const skills = Array.isArray(pc.skills)
    ? pc.skills.map(sk => ({
        name: SKILL_NAMES[sk.id] || 'Acrobatics',
        modifier: sk.modifier || 0
      }))
    : []

  // Map spells from XML format to selectedSpells format
  const selectedSpells = Array.isArray(pc.spells)
    ? pc.spells.map(s => ({
        name: s.name,
        level: s.level || '0',
        usage: 'slot' // Default to slot-based
      }))
    : []

  // Parse spell slots from slots field (e.g. "4,3,3,3,2,1,0,0,0")
  const spellSlots = pc.slots
    ? pc.slots.split(',').map(n => parseInt(n.trim()) || 0)
    : [0,0,0,0,0,0,0,0,0]

  return {
    ...d,
    name: displayName,
    player: pc.player || '',
    class: className,
    subclass: subclass,
    race: race,
    level: level,
    proficiencyBonus: level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : level <= 16 ? 5 : 6,

    // Abilities
    str: parseInt(abilities[0]) || 10,
    dex: parseInt(abilities[1]) || 10,
    con: parseInt(abilities[2]) || 10,
    int: parseInt(abilities[3]) || 10,
    wis: parseInt(abilities[4]) || 10,
    cha: parseInt(abilities[5]) || 10,

    // Combat
    acValue: parseInt(pc.ac) || 10,
    armor: pc.armor || '',
    hpValue: parseInt(pc.hpMax) || 10,
    speed: pc.speed || '30 ft.',
    initiativeBonus: parseInt(pc.init) || 0,

    // Skills and saves
    savingThrows: savingThrows,
    skills: skills,

    // Other
    senses: pc.senses || '',
    passive: pc.passive || '',
    passiveInsight: pc.passiveInsight || null,
    passiveInvestigation: pc.passiveInvestigation || null,
    languages: pc.languages || '',

    // Features
    traits: Array.isArray(pc.traits) ? pc.traits.map(t => ({name: t.name, desc: t.text})) : [],
    actions: Array.isArray(pc.actions) ? pc.actions.map(a => ({name: a.name, desc: a.text})) : [],

    // Spells
    selectedSpells: selectedSpells,
    spellSlots: spellSlots,
  }
}

function pcbUpdateProficiency() {
  const level = parseInt(mb.draft.level) || 1
  const prof = level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : level <= 16 ? 5 : 6
  mb.draft.proficiencyBonus = prof
  document.getElementById('pcb-prof-display').textContent = `+${prof}`
  mb.dirty = true
  pcb.dirty = true
  // Update passive senses when proficiency changes
  if (window.pcbUpdatePassiveSenses) pcbUpdatePassiveSenses()
}

function pcbUpdateSpellSlots() {
  const type = mb.draft.spellcastingType || 'None'
  const level = parseInt(mb.draft.level) || 1

  if (type === 'None' || type === 'Custom') {
    if (type === 'None') {
      mb.draft.spellSlots = [0,0,0,0,0,0,0,0,0]
    }
    // For Custom, don't auto-update slots
  } else if (type === 'Full Caster') {
    mb.draft.spellSlots = [...PC_SPELL_SLOTS_FULL[Math.min(level, 20) - 1]]
  } else if (type === 'Half Caster') {
    mb.draft.spellSlots = [...PC_SPELL_SLOTS_HALF[Math.min(level, 20) - 1]]
  } else if (type === 'Quarter Caster') {
    mb.draft.spellSlots = [...PC_SPELL_SLOTS_QUARTER[Math.min(level, 20) - 1]]
  } else if (type === 'Warlock') {
    mb.draft.spellSlots = [...PC_SPELL_SLOTS_WARLOCK[Math.min(level, 20) - 1]]
  }

  mb.dirty = true
  pcb.dirty = true

  // Update only the slot grid, not the entire spells section
  const gridEl = document.getElementById('pcb-slot-grid')
  if (gridEl) {
    gridEl.innerHTML = pcbRenderSlotGrid()
  }
}

function pcbUpdateInitiative() {
  const dex = parseInt(mb.draft.dex) || 10
  const mod = Math.floor((dex - 10) / 2)
  mb.draft.initiativeBonus = mod
  const input = document.querySelector('input[onchange*="initiativeBonus"]')
  if (input) input.value = mod
}

function pcbUpdatePassiveSenses() {
  const d = pcb.draft
  if (!d) return

  // Read current ability scores
  const wis = parseInt(d.wis) || 10
  const int = parseInt(d.int) || 10
  const wisMod = Math.floor((wis - 10) / 2)
  const intMod = Math.floor((int - 10) / 2)

  // Read skills array
  const skills = d.skills || []
  const perceptionSkill = skills.find(sk => sk.name === 'Perception')
  const insightSkill = skills.find(sk => sk.name === 'Insight')
  const investigationSkill = skills.find(sk => sk.name === 'Investigation')

  // Calculate auto values
  // Note: skill.modifier already includes ability mod + proficiency bonus
  const autoPassivePerception = perceptionSkill
    ? 10 + perceptionSkill.modifier
    : 10 + wisMod

  const autoPassiveInsight = insightSkill
    ? 10 + insightSkill.modifier
    : 10 + wisMod

  const autoPassiveInvestigation = investigationSkill
    ? 10 + investigationSkill.modifier
    : 10 + intMod

  // Update inputs only if user hasn't manually set a different value
  // (if current value matches the old auto-calculated value, update it)
  const passiveInput = document.querySelector('input[onchange*="passive="]')
  if (passiveInput && (passiveInput.value === '' || passiveInput.value === passiveInput.placeholder)) {
    passiveInput.value = autoPassivePerception
    passiveInput.placeholder = autoPassivePerception
    if (d.passive === '' || d.passive == null) d.passive = ''
  } else if (passiveInput) {
    passiveInput.placeholder = autoPassivePerception
  }

  const insightInput = document.querySelector('input[onchange*="passiveInsight="]')
  if (insightInput && (insightInput.value === '' || insightInput.value === insightInput.placeholder)) {
    insightInput.value = autoPassiveInsight
    insightInput.placeholder = autoPassiveInsight
    if (d.passiveInsight == null) d.passiveInsight = null
  } else if (insightInput) {
    insightInput.placeholder = autoPassiveInsight
  }

  const investigationInput = document.querySelector('input[onchange*="passiveInvestigation="]')
  if (investigationInput && (insightInput.value === '' || investigationInput.value === investigationInput.placeholder)) {
    investigationInput.value = autoPassiveInvestigation
    investigationInput.placeholder = autoPassiveInvestigation
    if (d.passiveInvestigation == null) d.passiveInvestigation = null
  } else if (investigationInput) {
    investigationInput.placeholder = autoPassiveInvestigation
  }
}

function pcbRenderSenses() {
  const MBS = window.MBS
  const mbEsc = window.mbEsc
  const d = pcb.draft

  // Calculate default passive values
  const wis = parseInt(d.wis) || 10
  const int = parseInt(d.int) || 10
  const wisMod = Math.floor((wis - 10) / 2)
  const intMod = Math.floor((int - 10) / 2)
  const profBonus = d.proficiencyBonus || 2

  // Check skill proficiency (skills array has objects with {name, modifier})
  const skills = d.skills || []
  const perceptionSkill = skills.find(sk => sk.name === 'Perception')
  const insightSkill = skills.find(sk => sk.name === 'Insight')
  const investigationSkill = skills.find(sk => sk.name === 'Investigation')

  // Auto-calculate passive values
  const defaultPassivePerception = 10 + wisMod + (perceptionSkill ? profBonus : 0)
  const defaultPassiveInsight = 10 + wisMod + (insightSkill ? profBonus : 0)
  const defaultPassiveInvestigation = 10 + intMod + (investigationSkill ? profBonus : 0)

  return `
    <div>
      <div style="margin-bottom:12px;">
        <label style="${MBS.label}">SENSES</label>
        <input value="${mbEsc(d.senses)}" placeholder="Darkvision 30 ft., Tremorsense 60 ft., etc."
          onchange="pcb.draft.senses=this.value;mb.draft.senses=this.value;pcb.dirty=true;mb.dirty=true"
          style="${MBS.field}width:100%;">
      </div>
      <div style="display:flex;gap:12px;">
        <div style="flex:1;">
          <label style="${MBS.label}">PASSIVE PERCEPTION</label>
          <input type="number" value="${d.passive !== '' && d.passive != null ? d.passive : defaultPassivePerception}"
            placeholder="${defaultPassivePerception}"
            onchange="pcb.draft.passive=this.value;mb.draft.passive=this.value;pcb.dirty=true;mb.dirty=true"
            style="${MBS.field}width:70px;">
        </div>
        <div style="flex:1;">
          <label style="${MBS.label}">PASSIVE INSIGHT</label>
          <input type="number" value="${d.passiveInsight != null ? d.passiveInsight : defaultPassiveInsight}"
            placeholder="${defaultPassiveInsight}"
            onchange="pcb.draft.passiveInsight=parseInt(this.value)||null;mb.draft.passiveInsight=parseInt(this.value)||null;pcb.dirty=true;mb.dirty=true"
            style="${MBS.field}width:70px;">
        </div>
        <div style="flex:1;">
          <label style="${MBS.label}">PASSIVE INVESTIGATION</label>
          <input type="number" value="${d.passiveInvestigation != null ? d.passiveInvestigation : defaultPassiveInvestigation}"
            placeholder="${defaultPassiveInvestigation}"
            onchange="pcb.draft.passiveInvestigation=parseInt(this.value)||null;mb.draft.passiveInvestigation=parseInt(this.value)||null;pcb.dirty=true;mb.dirty=true"
            style="${MBS.field}width:70px;">
        </div>
      </div>
    </div>
  `
}

function renderPCBuilder() {
  const content = document.getElementById('content')

  // Set window.mb for Monster Builder render functions
  // IMPORTANT: Mutate existing mb object instead of replacing it
  // so drum picker callbacks (which capture mb in closures) stay valid
  const mb = window.mb
  mb.draft = pcb.draft
  mb.dirty = pcb.dirty
  mb.originalName = null
  mb.stPickerOpen = false
  mb.stPickerAbility = null
  mb.stPickerMod = 0
  mb.skillPickerOpen = false
  mb.skillPickerName = null
  mb.skillPickerMod = 0
  mb.editingEntry = null
  mb.spellPickerOpen = false
  mb.spellPickerQuery = ''
  mb.spellPendingName = null
  mb.spellPendingLevel = null
  mb.dragSect = null
  mb.dragIdx = null

  content.innerHTML = pcbRenderForm()
}

function pcbRenderForm() {
  const MBS = window.MBS
  const d = pcb.draft

  const levelItems = Array.from({length: 20}, (_, i) => i + 1)

  return `
    <div style="min-height:100%;background:linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                url('assets/Background.png') left -40px/1641px auto no-repeat fixed;">
      <div style="background:#5C5C5C;border-bottom:4px solid #2E2F2D;
                  display:flex;align-items:center;justify-content:space-between;padding:16px 24px 12px 24px;gap:12px;
                  flex-shrink:0;padding-left:240px;box-sizing:border-box;">
        <button onclick="pcbBack()" style="${MBS.btnSecondary}padding:6px 14px;">← Back</button>
        <div style="flex:1;text-align:center;">
          <span id="pcb-title" style="font-size:15px;font-weight:bold;color:#e0d5c5;font-family:var(--app-font);">
            ${d.name || 'New Player Character'}
          </span>
        </div>
        <button onclick="pcbSave()" style="${MBS.btnPrimary}">Save</button>
      </div>
      <div style="max-width:800px;margin:0 auto;padding:20px 24px 40px;">
      ${pcbRenderPCInfo()}
      <div style="${MBS.card}">${pcbRenderHeader()}</div>
      <div style="${MBS.card}"><div id="mb-combat-section">${pcbRenderCombat()}</div></div>
      ${window.mbCardWrap('SPEED', `<div id="mb-speed-section">${window.mbRenderSpeedPicker()}</div>`)}
      ${window.mbCardWrap('ABILITY SCORES', window.mbRenderAbilityScores())}
      ${window.mbCardWrap('SAVING THROWS', `<div id="mb-sect-ST">${window.mbRenderSavingThrows()}</div>`)}
      ${window.mbCardWrap('SKILLS', `<div id="mb-sect-Skills">${window.mbRenderSkills()}</div>`)}
      ${window.mbCardWrap('DAMAGE VULNERABILITIES / RESISTANCES / IMMUNITIES', window.mbRenderDamageTypes())}
      ${window.mbCardWrap('CONDITION IMMUNITIES', window.mbRenderConditionImmunities())}
      ${window.mbCardWrap('SENSES & PASSIVE SENSES', pcbRenderSenses())}
      ${window.mbCardWrap('LANGUAGES', window.mbRenderLanguages())}
      ${window.mbCardWrap('TRAITS', `<div id="mb-sect-traits">${window.mbRenderAbilityGroup('traits', false)}</div>`)}
      ${window.mbCardWrap('ACTIONS', `<div id="mb-sect-actions">${window.mbRenderAbilityGroup('actions', true)}</div>`)}
      ${window.mbCardWrap('BONUS ACTIONS', `<div id="mb-sect-bonusActions">${window.mbRenderAbilityGroup('bonusActions', true)}</div>`)}
      ${window.mbCardWrap('REACTIONS', `<div id="mb-sect-reactions">${window.mbRenderAbilityGroup('reactions', true)}</div>`)}
      ${window.mbCardWrap('SPELLS', `<div id="mb-sect-Spells">${pcbRenderSpells()}</div>`)}
      ${pcbRenderNotes()}
      ${window.mbCardWrap('DESCRIPTION', pcbRenderDescription())}
      </div>
    </div>
  `
}

function pcbRenderPCInfo() {
  const MBS = window.MBS
  const d = pcb.draft
  const levelItems = Array.from({length: 20}, (_, i) => i + 1)

  return `
    <div style="${MBS.card}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div>
          <label style="${MBS.label}">NAME</label>
          <input value="${window.mbEsc(d.name)}" placeholder="Character name"
            onchange="mb.draft.name=this.value;pcb.draft.name=this.value;mb.dirty=true;pcb.dirty=true;document.querySelector('#pcb-title').textContent=this.value||'New Player Character'"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
        <div>
          <label style="${MBS.label}">PLAYER</label>
          <input value="${window.mbEsc(d.player)}" placeholder="Player name"
            onchange="mb.draft.player=this.value;pcb.draft.player=this.value;mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 100px 1fr;gap:12px;">
        <div>
          <label style="${MBS.label}">CLASS</label>
          <input value="${window.mbEsc(d.class)}" placeholder="e.g. Fighter, Wizard"
            onchange="mb.draft.class=this.value;pcb.draft.class=this.value;mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;margin-bottom:8px;">
          <label style="${MBS.label}">SUBCLASS</label>
          <input value="${window.mbEsc(d.subclass)}" placeholder="e.g. Battle Master, Evocation"
            onchange="mb.draft.subclass=this.value;pcb.draft.subclass=this.value;mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
        <div>
          <label style="${MBS.label}">RACE/SPECIES</label>
          <input value="${window.mbEsc(d.race)}" placeholder="e.g. Human, Half-Elf"
            onchange="mb.draft.race=this.value;pcb.draft.race=this.value;mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:#0a1520;border-radius:4px;">
            <label style="${MBS.label}margin:0;">PROFICIENCY BONUS</label>
            <span id="pcb-prof-display" style="font-size:16px;font-weight:bold;color:#e0d5c5;">+${d.proficiencyBonus}</span>
          </div>
        </div>
        <div>
          <label style="${MBS.label}">LEVEL</label>
          ${window.mbDrumPicker('pc-level', levelItems, d.level,
            v => { mb.draft.level = v; pcb.draft.level = v; mb.dirty = true; pcb.dirty = true; window.pcbUpdateProficiency(); window.pcbUpdateSpellSlots(); }, '100%')}
        </div>
        <div>
          <label style="${MBS.label}">BACKGROUND</label>
          <input value="${window.mbEsc(d.background)}" placeholder="e.g. Soldier, Sage"
            onchange="mb.draft.background=this.value;pcb.draft.background=this.value;mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
      </div>
    </div>
  `
}

function pcbRenderHeader() {
  const MBS = window.MBS
  const MB_SIZES = window.MB_SIZES
  const MB_TYPES = window.MB_TYPES
  const MB_ALIGNMENTS = window.MB_ALIGNMENTS
  const mbDrumPicker = window.mbDrumPicker
  const mbEsc = window.mbEsc
  const d = mb?.draft || {}

  // Type 2 options: None + all creature types
  const type2Options = ['None', ...MB_TYPES]

  return `
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div onclick="mbPortraitPick()" title="Click to select portrait"
        style="width:80px;height:80px;flex-shrink:0;cursor:pointer;
               border:2px solid #4587A2;border-radius:50%;overflow:hidden;
               display:flex;align-items:center;justify-content:center;background:#1A1C1E;
               transition:border-color .15s;">
        ${d.portrait
          ? `<img src="${d.portrait}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : `<div style="text-align:center;color:#7B9BA8;font-size:11px;padding:6px;line-height:1.5;">
               Portrait<br><span style="font-size:18px;opacity:.5;">+</span>
             </div>`}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
        <div style="display:grid;grid-template-columns:117px 104px 104px 140px;gap:8px;align-items:start;">
          <div>
            <label style="${MBS.label}">SIZE</label>
            ${mbDrumPicker('size', MB_SIZES, d.size,
              v => { mb.draft.size = v; mb.dirty = true; pcb.dirty = true; }, '100%')}
          </div>
          <div>
            <label style="${MBS.label}">TYPE</label>
            ${mbDrumPicker('type', MB_TYPES, d.type,
              v => { mb.draft.type = v; mb.dirty = true; pcb.dirty = true; }, '100%')}
          </div>
          <div>
            <label style="${MBS.label}">2ND TYPE</label>
            ${mbDrumPicker('type2', type2Options, d.type2 || 'None',
              v => { mb.draft.type2 = v; pcb.draft.type2 = v; mb.dirty = true; pcb.dirty = true; }, '100%')}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">
              <span style="font-size:10px;color:#7B9BA8;letter-spacing:.1em;font-weight:700;">ALIGNMENT</span>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;"
                onclick="mb.draft.alignmentTypically=!mb.draft.alignmentTypically;pcb.draft.alignmentTypically=mb.draft.alignmentTypically;mb.dirty=true;pcb.dirty=true;renderPCBuilder()">
                <div style="width:12px;height:12px;border-radius:50%;border:2px solid ${d.alignmentTypically?'#8b0000':'#666'};
                            background:${d.alignmentTypically?'#8b0000':'transparent'};flex-shrink:0;transition:all 0.2s;"></div>
                <span style="font-size:10px;color:#C8C8C8;font-style:italic;">Typically</span>
              </label>
            </div>
            ${mbDrumPicker('alignment', MB_ALIGNMENTS, d.alignment,
              v => { mb.draft.alignment = v; pcb.draft.alignment = v; mb.dirty = true; pcb.dirty = true; }, '100%', 0.9)}
          </div>
        </div>
        <div>
          <label style="${MBS.label}">TAG</label>
          <input value="${mbEsc(d.tag||'')}" placeholder="e.g. Goblinoid, Shapechanger…"
            onchange="mb.draft.tag=this.value;pcb.draft.tag=this.value;mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
      </div>
    </div>
  `
}

function pcbRenderCombat() {
  const MBS = window.MBS
  const MB_AC_MODS = window.MB_AC_MODS
  const MB_DIE_SIZES = window.MB_DIE_SIZES
  const mbDrumPicker = window.mbDrumPicker
  const mbEsc = window.mbEsc
  const mbUpdateHpAvg = window.mbUpdateHpAvg
  const d = mb?.draft || {}
  const sl = `font-size:9px;color:#C8C8C8;letter-spacing:.05em;margin-bottom:3px;`

  // HP formula display
  const conMod = Math.floor(((parseInt(d.con)||10) - 10) / 2)
  const avgPerDie = parseInt(d.hitDiceSize?.replace('d','') || 8) / 2 + 0.5
  const avgHp = Math.floor(d.hitDiceCount * avgPerDie + d.hitDiceCount * conMod)
  const totalCon = d.hitDiceCount * conMod

  // Calculate min/max
  const minHp = Math.max(1, (d.hitDiceCount * 1) + totalCon)
  const maxHp = Math.max(1, (d.hitDiceCount * parseInt(d.hitDiceSize.replace('d', ''))) + totalCon)

  // Build calculated HP string
  let diceStr = `${d.hitDiceCount}${d.hitDiceSize}`
  if (totalCon > 0) diceStr += ` +${totalCon}`
  else if (totalCon < 0) diceStr += ` ${totalCon}`

  const hpInfo = {
    auto: avgHp,
    calculated: `Calculated HP (${diceStr})`,
    min: minHp,
    avg: avgHp,
    max: maxHp
  }

  const acValItems  = Array.from({length:99},(_,i)=>i+1)
  const hdCntItems  = Array.from({length:99},(_,i)=>i+1)
  return `
    <div style="display:grid;grid-template-columns:auto 1fr auto;gap:10px;">
      <div>
        <label style="${MBS.label}">ARMOR CLASS</label>
        <div style="display:flex;gap:6px;align-items:flex-start;">
          <div>
            <div style="${sl}">VALUE</div>
            ${mbDrumPicker('ac-val', acValItems, d.acValue,
              v => { mb.draft.acValue = parseInt(v); mb.dirty = true; },
              '62px')}
          </div>
          <div>
            <div style="${sl}">MODIFIER</div>
            ${mbDrumPicker('ac-mod', MB_AC_MODS, d.acModifier,
              v => { mb.draft.acModifier = v; mb.dirty = true; },
              '90px', 0.75)}
          </div>
        </div>
        <label style="${MBS.label}margin-top:8px;">ARMOR</label>
        <input value="${mbEsc(d.armor||'')}" placeholder="Natural, Plate, etc."
          onchange="mb.draft.armor=this.value;mb.dirty=true"
          style="${MBS.field}width:100%;box-sizing:border-box;">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;min-height:148px;">
        <div style="display:flex;gap:6px;align-items:flex-start;">
          <div>
            <div style="${sl}">DICE COUNT</div>
            ${mbDrumPicker('hd-count', hdCntItems, d.hitDiceCount,
              v => { mb.draft.hitDiceCount = parseInt(v); mb.dirty = true; mbUpdateHpAvg(); },
              '62px')}
          </div>
          <div>
            <div style="${sl}">DIE SIZE</div>
            ${mbDrumPicker('hd-size', MB_DIE_SIZES, d.hitDiceSize,
              v => { mb.draft.hitDiceSize = v; mb.dirty = true; mbUpdateHpAvg(); },
              '62px')}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;padding-top:0px;width:160px;">
            <div>
              <label style="${MBS.label}">MAX HP</label>
              <input type="number" id="mb-hp-val" value="${d.hpValue||0}" min="0"
                onchange="mb.draft.hpValue=parseInt(this.value)||0;mb.dirty=true"
                style="${MBS.field}width:80px;text-align:center;">
            </div>
            <div style="font-size:11px;color:#7B9BA8;line-height:1.4;">
              <div id="mb-hp-calculated" style="margin-bottom:4px;">${hpInfo.calculated}</div>
              <div id="mb-hp-min">Minimum: ${hpInfo.min}</div>
              <div id="mb-hp-avg">Average: ${hpInfo.avg}</div>
              <div id="mb-hp-max">Maximum: ${hpInfo.max}</div>
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <label style="${MBS.label}">INITIATIVE BONUS</label>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:13px;color:#C8C8C8;">${d.initiativeBonus >= 0 ? '+' : ''}</span>
            <input type="number" value="${d.initiativeBonus||0}"
              onchange="mb.draft.initiativeBonus=parseInt(this.value)||0;mb.dirty=true"
              style="${MBS.field}width:60px;text-align:center;">
          </div>
        </div>
      </div>
    </div>
  `
}

function pcbRenderSpells() {
  const MBS = window.MBS
  const mbDrumPicker = window.mbDrumPicker
  const mbEsc = window.mbEsc
  const d = mb?.draft || {}
  const selectedSpells = Array.isArray(d.selectedSpells) ? d.selectedSpells : []
  const spellSlots = Array.isArray(d.spellSlots) ? d.spellSlots : [0,0,0,0,0,0,0,0,0]
  const atwill = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage==='atwill')
  const daily  = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage==='daily')
  const slots  = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage!=='atwill'&&s.usage!=='daily')
  const rmBtn  = i => `<button onclick="mbRemoveSpell(${i})"
    style="background:none;border:none;color:#8b0000;cursor:pointer;font-size:16px;
           padding:0 3px;line-height:1;margin-left:auto;" title="Remove">&#215;</button>`
  const spellRow = (sp, extra='') => `
    <div style="${MBS.itemRow}">
      <span style="flex:1;font-size:13px;color:#e0d5c5;">${mbEsc(sp.name)}</span>
      ${extra}
      ${rmBtn(sp._i)}
    </div>`

  const spellcastingTypes = ['None', 'Full Caster', 'Half Caster', 'Quarter Caster', 'Warlock', 'Custom']
  const showSlots = d.spellcastingType !== 'None'

  return `
    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
        <div>
          <label style="${MBS.label}">SPELLCASTING TYPE</label>
          <select id="pcb-spellcasting-type"
            onchange="mb.draft.spellcastingType=this.value;mb.dirty=true;pcb.dirty=true;window.pcbUpdateSpellSlots()"
            style="${MBS.field}width:100%;padding:8px 12px;
                   background:#262F35;border:1px solid #7B9BA8;color:#e0d5c5;
                   font-family:var(--app-font);font-size:14px;border-radius:4px;
                   cursor:pointer;">
            ${spellcastingTypes.map(type =>
              `<option value="${type}" ${(d.spellcastingType || 'None') === type ? 'selected' : ''}>${type}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label style="${MBS.label}">SPELL SAVE DC</label>
          <input type="number" value="${d.spellSaveDC || ''}"
            onchange="const v=parseInt(this.value);mb.draft.spellSaveDC=isNaN(v)?null:v;mb.dirty=true;pcb.dirty=true"
            placeholder="—"
            style="${MBS.field}width:100%;" />
        </div>
        <div>
          <label style="${MBS.label}">SPELL ATTACK MOD</label>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="color:#e0d5c5;font-size:16px;">+</span>
            <input type="number" value="${d.spellAttackMod || ''}"
              onchange="const v=parseInt(this.value);mb.draft.spellAttackMod=isNaN(v)?null:v;mb.dirty=true;pcb.dirty=true"
              placeholder="—"
              style="${MBS.field}flex:1;" />
          </div>
        </div>
      </div>

      <div style="font-size:11px;color:#7B9BA8;font-weight:700;letter-spacing:.08em;
                  margin-bottom:6px;margin-top:2px;">AT WILL</div>
      ${atwill.length === 0
        ? `<div style="font-size:12px;color:#C8C8C8;font-style:italic;margin-bottom:8px;">None</div>`
        : atwill.map(sp => spellRow(sp)).join('') }

      <div style="font-size:11px;color:#7B9BA8;font-weight:700;letter-spacing:.08em;
                  margin-bottom:6px;margin-top:10px;">DAILY</div>
      ${daily.length === 0
        ? `<div style="font-size:12px;color:#C8C8C8;font-style:italic;margin-bottom:8px;">None</div>`
        : daily.map(sp => spellRow(sp,
            `<span style="font-size:11px;color:#C8C8C8;white-space:nowrap;">${sp.dailyCount||1}/day</span>`
          )).join('') }

      <div id="pcb-slot-grid">
        ${pcbRenderSlotGrid()}
      </div>

      <button onclick="mbSpellPickerOpen()" style="${MBS.btnSecondarySmall}margin-top:8px;">+ Add Spell</button>
      ${mb.spellPickerOpen ? window.mbRenderSpellPickerHtml() : ''}
    </div>
  `
}

function pcbRenderSlotGrid() {
  const MBS = window.MBS
  const mbEsc = window.mbEsc
  const d = mb?.draft || {}
  const selectedSpells = Array.isArray(d.selectedSpells) ? d.selectedSpells : []
  const spellSlots = Array.isArray(d.spellSlots) ? d.spellSlots : [0,0,0,0,0,0,0,0,0]
  const slots = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage!=='atwill'&&s.usage!=='daily')
  const rmBtn  = i => `<button onclick="mbRemoveSpell(${i})"
    style="background:none;border:none;color:#8b0000;cursor:pointer;font-size:16px;
           padding:0 3px;line-height:1;margin-left:auto;" title="Remove">&#215;</button>`
  const spellRow = (sp, extra='') => `
    <div style="${MBS.itemRow}">
      <span style="flex:1;font-size:13px;color:#e0d5c5;">${mbEsc(sp.name)}</span>
      ${extra}
      ${rmBtn(sp._i)}
    </div>`

  // Show spell slots section if spellcasting type is not None OR if there are slot-based spells
  const showSlots = d.spellcastingType !== 'None' || slots.length > 0

  if (!showSlots) return ''

  return `
    <div style="font-size:11px;color:#8b0000;font-weight:700;letter-spacing:.08em;
                margin-bottom:8px;margin-top:10px;">SPELL SLOTS</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;">
      ${['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'].map((lvl,i) => `
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="font-size:10px;color:#c9a87c;font-weight:bold;letter-spacing:.04em;">${lvl}</div>
          <input type="number" value="${spellSlots[i]||0}" min="0" max="6"
            onchange="mb.draft.spellSlots[${i}]=Math.min(6,Math.max(0,parseInt(this.value)||0));mb.dirty=true;pcb.dirty=true"
            style="${MBS.field}width:38px;text-align:center;padding:5px 4px;">
        </div>`).join('')}
    </div>
    ${slots.length === 0
      ? `<div style="font-size:12px;color:#C8C8C8;font-style:italic;margin-bottom:8px;">No spells assigned to slots.</div>`
      : slots.map(sp => spellRow(sp)).join('') }
  `
}

function pcbRenderNotes() {
  const MBS = window.MBS
  const d = pcb.draft
  return `
    <div style="${MBS.card}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="${MBS.cardHeader}">NOTES</div>
        <span style="font-size:10px;color:#C8C8C8;font-style:italic;">
          Personality, bonds, flaws, ideals, equipment, etc.
        </span>
      </div>
      <div id="pcb-notes-list">
        ${(d.notes || []).map((note, i) => `
          <div style="margin-bottom:10px;padding:10px;background:#0a1520;border-radius:4px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <input value="${window.mbEsc(note.title)}" placeholder="Note title"
                onchange="pcb.draft.notes[${i}].title=this.value;mb.dirty=true;pcb.dirty=true"
                style="${MBS.field}flex:1;">
              <button onclick="pcbRemoveNote(${i})"
                style="background:none;border:none;color:#8b0000;cursor:pointer;font-size:18px;padding:0 4px;">×</button>
            </div>
            <textarea placeholder="Note text"
              onchange="pcb.draft.notes[${i}].body=this.value;mb.dirty=true;pcb.dirty=true"
              style="${MBS.field}width:100%;min-height:60px;resize:vertical;font-family:var(--app-font);">${window.mbEsc(note.body)}</textarea>
          </div>
        `).join('')}
      </div>
      <button onclick="pcbAddNote()" style="${MBS.btnSecondarySmall}margin-top:8px;">+ Add Note</button>
    </div>
  `
}

function pcbAddNote() {
  if (!pcb.draft.notes) pcb.draft.notes = []
  pcb.draft.notes.push({title: '', body: ''})
  pcb.dirty = true
  mb.dirty = true
  const list = document.getElementById('pcb-notes-list')
  if (list) {
    list.innerHTML = (pcb.draft.notes || []).map((note, i) => `
      <div style="margin-bottom:10px;padding:10px;background:#0a1520;border-radius:4px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <input value="${window.mbEsc(note.title)}" placeholder="Note title"
            onchange="pcb.draft.notes[${i}].title=this.value;mb.dirty=true;pcb.dirty=true"
            style="${window.MBS.field}flex:1;">
          <button onclick="pcbRemoveNote(${i})"
            style="background:none;border:none;color:#8b0000;cursor:pointer;font-size:18px;padding:0 4px;">×</button>
        </div>
        <textarea placeholder="Note text"
          onchange="pcb.draft.notes[${i}].body=this.value;mb.dirty=true;pcb.dirty=true"
          style="${window.MBS.field}width:100%;min-height:60px;resize:vertical;font-family:var(--app-font);">${window.mbEsc(note.body)}</textarea>
      </div>
    `).join('')
  }
}

function pcbRemoveNote(index) {
  window.confirmDelete('Delete note?', () => {
    pcb.draft.notes.splice(index, 1)
    pcb.dirty = true
    mb.dirty = true
    const list = document.getElementById('pcb-notes-list')
    if (list) {
      list.innerHTML = (pcb.draft.notes || []).map((note, i) => `
        <div style="margin-bottom:10px;padding:10px;background:#0a1520;border-radius:4px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <input value="${window.mbEsc(note.title)}" placeholder="Note title"
              onchange="pcb.draft.notes[${i}].title=this.value;mb.dirty=true;pcb.dirty=true"
              style="${window.MBS.field}flex:1;">
            <button onclick="pcbRemoveNote(${i})"
              style="background:none;border:none;color:#8b0000;cursor:pointer;font-size:18px;padding:0 4px;">×</button>
          </div>
          <textarea placeholder="Note text"
            onchange="pcb.draft.notes[${i}].body=this.value;mb.dirty=true;pcb.dirty=true"
            style="${window.MBS.field}width:100%;min-height:60px;resize:vertical;font-family:var(--app-font);">${window.mbEsc(note.body)}</textarea>
        </div>
      `).join('')
    }
  })
}

function pcbSave() {
  const d = pcb.draft
  if (!d.name || !d.name.trim()) {
    showToast('Please enter a character name.')
    return
  }

  // Normalize traits to use charges/chargesCurrent/recharge instead of limitedUsage
  const normalizedTraits = (d.traits || []).map(t => {
    if (t.limitedUsage) {
      const lu = t.limitedUsage
      // Map limitedUsage type to recharge format
      let recharge = null
      if (lu.type === 'recharge_5_6') recharge = 5
      else if (lu.type === 'recharge_6') recharge = 6
      else if (lu.type.startsWith('recharge_')) {
        const match = lu.type.match(/recharge_(\d+)/)
        if (match) recharge = parseInt(match[1])
      }

      const charges = lu.type === 'per_day' || lu.type === 'charges' ? (lu.count || null) : null

      return {
        ...t,
        charges: charges,
        chargesCurrent: charges, // Full at save time
        recharge: recharge,
        limitedUsage: lu // Keep for builder editing
      }
    }
    return {...t, charges: t.charges ?? null, chargesCurrent: t.chargesCurrent ?? null, recharge: t.recharge ?? null}
  })

  // Normalize actions similarly
  const normalizedActions = (d.actions || []).map(a => {
    if (a.limitedUsage) {
      const lu = a.limitedUsage
      let recharge = null
      if (lu.type === 'recharge_5_6') recharge = 5
      else if (lu.type === 'recharge_6') recharge = 6
      else if (lu.type.startsWith('recharge_')) {
        const match = lu.type.match(/recharge_(\d+)/)
        if (match) recharge = parseInt(match[1])
      }

      const charges = lu.type === 'per_day' || lu.type === 'charges' ? (lu.count || null) : null

      return {
        ...a,
        charges: charges,
        chargesCurrent: charges,
        recharge: recharge,
        limitedUsage: lu
      }
    }
    return {...a, charges: a.charges ?? null, chargesCurrent: a.chargesCurrent ?? null, recharge: a.recharge ?? null}
  })

  const pc = {
    uid: pcb.originalUid || 'pc_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    _draft: JSON.parse(JSON.stringify(d)),
    ...d, // Spread all fields for backward compatibility
    // Add normalized fields for encounter system compatibility
    hpMax: d.hpValue || 1,
    hpCurrent: d.hpValue || 1, // Default to full HP
    abilities: [
      String(d.str || 10),
      String(d.dex || 10),
      String(d.con || 10),
      String(d.int || 10),
      String(d.wis || 10),
      String(d.cha || 10)
    ],
    traits: normalizedTraits,
    actions: normalizedActions,
  }

  if (!compendiumData.players) compendiumData.players = []

  const idx = compendiumData.players.findIndex(p => p.uid === pc.uid)
  if (idx >= 0) {
    compendiumData.players[idx] = pc
  } else {
    compendiumData.players.push(pc)
  }

  saveCampaigns(compendiumData.campaigns)
  pcb.dirty = false
  mb.dirty = false
  showToast(`Character "${pc.name}" saved.`)
  if (typeof popNav === 'function') popNav()
  else showSection('home')
}

function pcbRenderDescription() {
  const MBS = window.MBS
  const mbEsc = window.mbEsc
  const d = mb?.draft || {}
  return `
    <div>
      <label style="${MBS.label}">DESCRIPTION</label>
      <textarea rows="6" onchange="mb.draft.description=this.value;mb.dirty=true;pcb.dirty=true"
        placeholder="Freeform description, lore, notes…"
        style="${MBS.field}width:100%;resize:vertical;">${mbEsc(d.description)}</textarea>
    </div>
  `
}

function pcbBack() {
  const isDirty = pcb.dirty || (window.mb && window.mb.dirty)
  if (!isDirty) {
    if (typeof popNav === 'function') popNav()
    else showSection('home')
    return
  }

  const overlay = document.createElement('div')
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;
    display:flex;align-items:center;justify-content:center;`
  overlay.innerHTML = `
    <div style="background:#262F35;border:2px solid #8b0000;border-radius:8px;
                padding:28px 32px;max-width:340px;text-align:center;font-family:var(--app-font);">
      <div style="font-size:16px;font-weight:bold;color:#e0d5c5;margin-bottom:10px;">Discard Changes?</div>
      <div style="color:#C8C8C8;font-size:13px;margin-bottom:22px;line-height:1.6;">
        You have unsaved changes that will be lost.
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="this.closest('div[style*=fixed]').remove();if(typeof popNav==='function')popNav();else showSection('home')"
          style="${window.MBS.btnPrimary}">Discard</button>
        <button onclick="this.closest('div[style*=fixed]').remove()"
          style="${window.MBS.btnSecondary}">Keep Editing</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

// Export to window
window.openPCBuilder = openPCBuilder
window.pcbRenderHeader = pcbRenderHeader
window.pcbRenderSpells = pcbRenderSpells
window.pcbRenderSlotGrid = pcbRenderSlotGrid
window.pcbRenderDescription = pcbRenderDescription
window.pcbRenderNotes = pcbRenderNotes
window.pcbAddNote = pcbAddNote
window.pcbRemoveNote = pcbRemoveNote
window.pcbSave = pcbSave
window.pcbBack = pcbBack
window.pcbUpdateProficiency = pcbUpdateProficiency
window.pcbUpdateSpellSlots = pcbUpdateSpellSlots
window.pcbUpdateInitiative = pcbUpdateInitiative
window.pcbUpdatePassiveSenses = pcbUpdatePassiveSenses
