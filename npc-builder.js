// ── NPC Builder ──────────────────────────────────────────────────
// Extends Monster Builder for campaign NPCs

const npcb = {
  originalUid: null,
  step: 'choice', // 'choice' | 'form'
  startMode: null, // 'scratch' | 'monster'
  selectedMonster: null,
  draft: null,
  dirty: false,
}

function openNPCBuilder(uid = null) {
  if (typeof pushNav === 'function') {
    pushNav('npc-builder', uid)
  } else if (typeof window.currentScreen !== 'undefined') {
    window.currentScreen = { screen: 'npc-builder', uid }
  }

  if (uid) {
    const existing = compendiumData.npcs.find(n => n.uid === uid)
    if (!existing) return
    npcb.draft = npcbDraftFromNPC(existing)
    npcb.originalUid = uid
    npcb.step = 'form'

    // Auto-fill initiative bonus from DEX if not set
    if (!npcb.draft.initiativeBonus || npcb.draft.initiativeBonus === 0) {
      const dex = parseInt(npcb.draft.dex) || 10
      npcb.draft.initiativeBonus = Math.floor((dex - 10) / 2)
    }

    // Set mb.draft for monster builder render functions (if mb is available)
    // Normalize NPC action format to Monster Builder format before setting
    if (typeof window.mb !== 'undefined') {
      window.mb.draft = npcb.draft

      // Normalize actions using parseAttackFromText to convert NPC format to Monster format
      // NPC format: {bonus:7, dmg:"1d6+2"} → Monster format: {atk:"+7", diceCount:"1", dieType:"d6", ...}
      function normalizeActions(actions) {
        if (!actions || !Array.isArray(actions)) return actions
        return actions.map(action => {
          const hasExistingAttack = !!action.attack

          // Read attack bonus from NPC format (bonus:number) or Monster format (atk:string).
          // When there's no pre-existing attack object at all, default to the em-dash
          // sentinel ("damage only, no attack roll") used elsewhere in the app - a real
          // to-hit bonus found via text-parsing below will override this if one exists.
          let atkBonus = hasExistingAttack
            ? (action.attack.atk || (action.attack.bonus !== undefined ?
                (action.attack.bonus >= 0 ? `+${action.attack.bonus}` : String(action.attack.bonus)) : '+0'))
            : '—'

          let attack = {
            atk: atkBonus,
            diceCount: (hasExistingAttack && action.attack.diceCount) || '',
            // Left empty (not defaulted to 'd6') so the text-parsing fallback below still
            // gets a chance to fill in the real die type - a truthy placeholder here would
            // make the "!attack.dieType" check further down always skip it.
            dieType: (hasExistingAttack && action.attack.dieType) || '',
            dmgBonus: (hasExistingAttack && action.attack.dmgBonus) || '',
            dmgType: (hasExistingAttack && action.attack.dmgType) || '',
            additionalDiceCount: (hasExistingAttack && action.attack.additionalDiceCount) || '',
            additionalDieType: (hasExistingAttack && action.attack.additionalDieType) || '',
            additionalDmgType: (hasExistingAttack && action.attack.additionalDmgType) || '',
            showAdditional: (hasExistingAttack && action.attack.showAdditional) || false,
            altDiceCount: (hasExistingAttack && action.attack.altDiceCount) || '',
            altDieType: (hasExistingAttack && action.attack.altDieType) || '',
            altDmgBonus: (hasExistingAttack && action.attack.altDmgBonus) || '',
            altDmgType: (hasExistingAttack && action.attack.altDmgType) || '',
            showAlternate: (hasExistingAttack && action.attack.showAlternate) || false
          }

          // If dmg string exists, parse it to populate structured fields
          if (hasExistingAttack && action.attack.dmg && window.parseDamageString) {
            const parsed = window.parseDamageString(action.attack.dmg)
            attack.diceCount = parsed.diceCount
            attack.dieType = parsed.dieType
            attack.dmgBonus = parsed.dmgBonus
            attack.dmgType = parsed.dmgType
            attack.additionalDiceCount = parsed.additionalDiceCount || ''
            attack.additionalDieType = parsed.additionalDieType || ''
            attack.additionalDmgType = parsed.additionalDmgType || ''
            attack.showAdditional = (parsed.additionalDiceCount || '') !== ''
          }

          // Parse from description text - always run if desc is available, whether refining
          // an existing attack or reconstructing one that was never structured in the source
          // (e.g. a save-based breath weapon whose XML never had an <attack> element at all)
          const textParsed = window.parseAttackFromText && action.desc
            ? window.parseAttackFromText(action.desc)
            : null

          if (textParsed) {
            // Always use text-parsed atk (description is most reliable source)
            if (textParsed.atk) {
              attack.atk = textParsed.atk
            }
            // Only fill in missing damage fields from text (don't override parsed dmg)
            if (!attack.diceCount && textParsed.diceCount) {
              attack.diceCount = textParsed.diceCount
            }
            if (!attack.dieType && textParsed.dieType) {
              attack.dieType = textParsed.dieType
            }
            if (!attack.dmgBonus && textParsed.dmgBonus) {
              attack.dmgBonus = textParsed.dmgBonus
            }
            if (!attack.dmgType && textParsed.dmgType) {
              attack.dmgType = textParsed.dmgType
            }
            // Copy alternate damage fields if present
            if (textParsed.altDiceCount) {
              attack.altDiceCount = textParsed.altDiceCount
              attack.altDieType = textParsed.altDieType
              attack.altDmgBonus = textParsed.altDmgBonus
              attack.altDmgType = textParsed.altDmgType
              attack.showAlternate = true

              // FIX: Prevent double-counting - if additional damage matches alternate damage, clear additional
              // This happens when parseDamageString() extracts "or 3d4" as additional dice
              if (attack.altDiceCount === attack.additionalDiceCount &&
                  attack.altDieType === attack.additionalDieType) {
                attack.additionalDiceCount = ''
                attack.additionalDieType = ''
                attack.additionalDmgType = ''
                attack.showAdditional = false
              }
            }
          }

          // Only attach an attack object if one already existed, or text-parsing actually
          // found something - don't fabricate an empty attack (with Roll Attack/Damage
          // buttons) for actions that never had any attack data, like Multiattack or a
          // purely descriptive trait
          if (!hasExistingAttack && !textParsed) return action

          // Fall back to d6 only now, after text-parsing had its chance to supply the real die type
          if (!attack.dieType) attack.dieType = 'd6'

          // Return with ALL original fields preserved, only attack field overridden
          return {
            ...action,                    // Preserve ALL original fields (id, name, desc, limitedUsage, etc.)
            attack: attack                // Override only the attack with normalized version
          }
        })
      }

      // Normalize all action types
      window.mb.draft.traits = normalizeActions(npcb.draft.traits)
      window.mb.draft.actions = normalizeActions(npcb.draft.actions)
      window.mb.draft.bonusActions = normalizeActions(npcb.draft.bonusActions)
      window.mb.draft.reactions = normalizeActions(npcb.draft.reactions)
      window.mb.draft.legendaryActions = normalizeActions(npcb.draft.legendaryActions)
      window.mb.draft.lairActions = normalizeActions(npcb.draft.lairActions)

      window.mb.originalName = npcb.draft.name
    }
  } else {
    npcb.draft = null
    npcb.originalUid = null
    npcb.step = 'choice'
  }
  npcb.dirty = false; npcb.startMode = null; npcb.selectedMonster = null
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.style.color = btn.id === 'nav-home' ? '#e0d5c5' : '#888'
    btn.style.borderBottomColor = btn.id === 'nav-home' ? '#4587A2' : 'transparent'
  })
  const content = document.getElementById('content')
  content.style.padding = '0'
  content.style.overflow = 'auto'
  content.style.overflowY = 'auto'
  renderNPCBuilder()
}

function npcbDefaultDraft() {
  return {
    // NPC-specific fields
    properName: '', // "Mossy"
    notes: [],      // [{title:'', body:''}]
    archived: false,

    // Reuse monster builder fields
    portrait: null,
    name: '',       // stat block name "Vegepygmy"
    size: 'Medium',
    type: 'Humanoid',
    alignment: '',
    alignmentTypically: false,
    tag: '',
    acValue: 10,
    acModifier: '—',
    armor: '',
    hpValue: 10,
    hpCurrent: null,
    hitDiceCount: 2,
    hitDiceSize: 'd8',
    speed: '30 ft.',
    speedEntries: [{type:'Walk',ft:30}],
    initiativeBonus: 0,
    proficiencyBonus: 0,
    source: '',
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    savingThrows: [],
    skills: [],
    vulnerable: [],
    resist: [],
    immune: [],
    conditionImmune: [],
    senses: '',
    passive: '',
    languages: '',
    cr: '1',
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    lairActions: [],
    selectedSpells: [],
    spellSlots: [0,0,0,0,0,0,0,0,0],
    spellSaveDC: null,
    spellAttackMod: null,
    spellPendingName: null,
    spellPendingLevel: null,
    environments: [],
    description: '',
    campaignName: '',
    slotsCurrent: null,
  }
}

function npcbDraftFromNPC(npc) {
  // Convert existing NPC back to draft format
  const d = npcbDefaultDraft()
  d.properName = npc.properName || npc.label || ''
  d.notes = npc.notes || []
  d.archived = npc.archived || false

  // Helper to convert XML format saves/skills to builder format
  const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  const SKILL_NAMES = ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
                       'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
                       'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
                       'Sleight of Hand', 'Stealth', 'Survival']

  function convertSavingThrows(arr) {
    if (!Array.isArray(arr)) return []
    return arr.map(st => ({
      ability: typeof st.ability === 'number' ? ABILITY_NAMES[st.ability] : st.ability,
      modifier: st.modifier
    }))
  }

  function convertSkills(arr) {
    if (!Array.isArray(arr)) return []
    return arr.map(sk => ({
      name: typeof sk.id === 'number' ? SKILL_NAMES[sk.id] : (sk.name || ''),
      modifier: sk.modifier
    }))
  }

  // Damage type / condition lists are saved as comma-joined strings (see npcbBuildEntry)
  // but XML import and older data may provide arrays. Handle both instead of discarding strings.
  function toDamageList(v) {
    if (Array.isArray(v)) return v
    if (typeof v === 'string' && v.trim()) return v.split(',').map(s => s.trim()).filter(Boolean)
    return []
  }

  // If NPC has _draft (was created from builder), restore it
  if (npc._draft) {
    return {...d, ...npc._draft, properName: npc.properName || npc.label || '', notes: npc.notes || [], archived: npc.archived || false}
  }

  // If size/type are missing, this NPC was imported from XML and based on a monster stat block
  // Look up the monster by name and use it as the base
  let baseMonster = null
  if (!npc.size || !npc.type) {
    if (npc.name && compendiumData.monsters) {
      baseMonster = compendiumData.monsters.find(m => m.name === npc.name)
      if (baseMonster) {
        // Start from the monster's data
        const monsterDraft = npcbDraftFromMonster(baseMonster)
        Object.assign(d, monsterDraft)

        // Preserve NPC identity fields (don't use monster's name/properName)
        d.properName = npc.properName || npc.label || ''
        d.name = npc.name || ''

        // Override with NPC-specific saving throws and skills from XML (convert format)
        d.savingThrows = convertSavingThrows(npc.savingThrows)
        d.skills = convertSkills(npc.skills)

        // Parse speed into speedEntries if monster has speed string
        if (d.speed && typeof d.speed === 'string') {
          d.speedEntries = window.mbParseSpeed(d.speed)
        }
      }
    }
  }

  // Otherwise map from compact NPC format (same as monster format)
  // Use _draft as fallback when top-level fields are undefined
  if (!baseMonster) {
    d.name = npc.name || npc._draft?.name || ''
    d.portrait = npc.portrait || npc._draft?.portrait || null

    // Convert abbreviated size to full name (M → Medium, S → Small, etc.)
    // Also handle numeric sizes from XML (Game Master 5e format: 0-5)
    const sizeMap = {
      T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan',
      '0': 'Tiny', '1': 'Small', '2': 'Medium', '3': 'Large', '4': 'Huge', '5': 'Gargantuan'
    }
    const npcSize = npc.size || npc._draft?.size
    d.size = sizeMap[npcSize] || npcSize || 'Medium'

    // Capitalize type to match drum picker values (plant → Plant)
    // Strip anything after parenthesis (e.g., "Monstrosity (t-rex)" → "Monstrosity")
    const rawType = (npc.type || npc._draft?.type || 'Humanoid').split('(')[0].trim()
    d.type = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()

    const npcAlignment = npc.alignment || npc._draft?.alignment || ''
    d.alignment = npcAlignment.replace(/^Typically\s+/i, '')
    d.alignmentTypically = /^Typically\s+/i.test(npcAlignment)
    d.tag = npc.tag || npc._draft?.tag || ''
    d.source = npc.source || npc._draft?.source || ''

    // Parse AC (numeric value plus optional parenthetical, e.g. "16 (+Dex Mod)")
    const acMatch = String(npc.ac || npc._draft?.ac || '10').match(/^(\d+)(?:\s*\((.+)\))?/)
    d.acValue = acMatch ? parseInt(acMatch[1]) : (npc._draft?.acValue || 10)
    const rawAcMod = (acMatch && acMatch[2] || '').toLowerCase()
    if (rawAcMod.includes('max 2')) d.acModifier = '+Dex Mod (max 2)'
    else if (rawAcMod.includes('dex')) d.acModifier = '+Dex Mod'
    else d.acModifier = npc._draft?.acModifier || '—'
    d.armor = npc.armor || npc._draft?.armor || ''

    // Parse HP. Compact/legacy format combines hp+hitDice into one string ("10 (2d8+2)");
    // XML campaign format provides hpMax/hpCurrent/hd separately.
    const hpMatch = String(npc.hp || npc._draft?.hp || '10').match(/^(\d+)\s*\((\d+)(d\d+)/)
    if (hpMatch) {
      d.hpValue = parseInt(hpMatch[1]) || 10
      d.hitDiceCount = parseInt(hpMatch[2]) || 2
      d.hitDiceSize = hpMatch[3] || 'd8'
    } else {
      // If no match, try to use hpMax or draft values
      d.hpValue = parseInt(npc.hpMax) || npc._draft?.hpValue || parseInt(npc.hp) || 10
      const hdMatch = String(npc.hd || '').match(/^(\d+)(d\d+)/)
      if (hdMatch) {
        d.hitDiceCount = parseInt(hdMatch[1]) || 2
        d.hitDiceSize = hdMatch[2] || 'd8'
      } else {
        d.hitDiceCount = npc._draft?.hitDiceCount || 2
        d.hitDiceSize = npc._draft?.hitDiceSize || 'd8'
      }
    }
    d.hpCurrent = npc.hpCurrent != null ? parseInt(npc.hpCurrent)
      : (npc._draft?.hpCurrent != null ? npc._draft.hpCurrent : d.hpValue)

    d.speed = npc.speed || npc._draft?.speed || '30 ft.'
    d.speedEntries = window.mbParseSpeed ? window.mbParseSpeed(d.speed) : [{type:'Walk',ft:30}]
    d.initiativeBonus = npc.init || npc.initiativeBonus || npc._draft?.initiativeBonus || 0
    d.proficiencyBonus = npc.proficiencyBonus || npc._draft?.proficiencyBonus || 0

    // Parse abilities - can be stored as individual fields or as an array
    if (npc.abilities && Array.isArray(npc.abilities)) {
      const abMap = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 }
      for (const [key, idx] of Object.entries(abMap)) {
        if (npc.abilities[idx] != null) d[key] = npc.abilities[idx]
      }
    } else {
      d.str = npc.str || 10
      d.dex = npc.dex || 10
      d.con = npc.con || 10
      d.int = npc.int || 10
      d.wis = npc.wis || 10
      d.cha = npc.cha || 10
    }

    d.savingThrows = convertSavingThrows(npc.savingThrows)
    d.skills = convertSkills(npc.skills)
    d.vulnerable = toDamageList(npc.vulnerable)
    d.resist = toDamageList(npc.resist)
    d.immune = toDamageList(npc.immune)
    d.conditionImmune = toDamageList(npc.conditionImmune)
    d.senses = npc.senses || npc._draft?.senses || ''
    d.passive = npc.passive || npc._draft?.passive || ''
    d.languages = npc.languages || npc._draft?.languages || ''
    d.cr = String(npc.cr || npc._draft?.cr || '1')

    // Convert compendium entry format (text) to draft format (desc)
    function parseEntries(arr, hasAttack) {
      return (arr || []).map(entry => {
        let lu = { type: 'none', count: 1 }
        let name = entry.name || ''
        if (entry.charges != null) {
          lu = { type: 'per_day', count: entry.charges }
        } else if (entry.recharge != null) {
          lu = { type: `recharge_${entry.recharge}`, count: 1 }
        } else {
          // Structured recharge field is empty - XML-imported monsters often bake this into
          // the action name instead, e.g. "Cold Breath (Recharge 6)" or "Acid Breath (Recharge 5-6)".
          // Extract the lower bound of the range as the recharge threshold, and strip the
          // suffix so it doesn't display redundantly once limitedUsage shows it separately.
          const rechargeMatch = name.match(/\s*\(\s*recharge\s+(\d+)(?:\s*[-–—]\s*\d+)?\s*\)/i)
          if (rechargeMatch) {
            lu = { type: `recharge_${rechargeMatch[1]}`, count: 1 }
            name = name.replace(rechargeMatch[0], '').replace(/\s{2,}/g, ' ').trim()
          }
        }
        const atk = (hasAttack && entry.attack) ? { bonus: parseInt(entry.attack.atk) || 0, dmg: entry.attack.dmg || '' } : null
        return {
          id: 'mbe_' + Math.random().toString(36).slice(2),
          name: name,
          desc: entry.text || entry.desc || '', // Support both compendium (text) and draft (desc) formats
          limitedUsage: lu,
          attack: atk
        }
      })
    }

    d.traits = parseEntries(npc.traits, false)
    d.actions = parseEntries(npc.actions, true)
    d.bonusActions = parseEntries(npc.bonusActions, false)
    d.reactions = parseEntries(npc.reactions, false)
    d.legendaryActions = parseEntries(npc.legendaryActions, true)
    d.lairActions = parseEntries(npc.lairActions, false)
    d.selectedSpells = Array.isArray(npc.selectedSpells) ? npc.selectedSpells : (Array.isArray(npc._draft?.selectedSpells) ? npc._draft.selectedSpells : [])
    d.spellSlots = Array.isArray(npc.slots) ? npc.slots : (Array.isArray(npc.spellSlots) ? npc.spellSlots : (Array.isArray(npc._draft?.spellSlots) ? npc._draft.spellSlots : [0,0,0,0,0,0,0,0,0]))
    // npc.text is the free-text field from XML campaign import; only used as a fallback
    // so it doesn't clobber a description already entered through the builder.
    d.description = npc.description || npc._draft?.description || npc.text || ''
  }

  // Apply NPC-specific overrides (abilities, saving throws, skills, spells from XML)
  if (baseMonster) {
    // Override stat block name with the actual saved name
    d.name = npc.name || d.name

    // Override abilities if NPC has custom ones
    if (npc.abilities && Array.isArray(npc.abilities)) {
      const abMap = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 }
      for (const [key, idx] of Object.entries(abMap)) {
        if (npc.abilities[idx] != null) d[key] = npc.abilities[idx]
      }
    }

    // Override saving throws and skills if NPC has custom ones
    if (npc.savingThrows && npc.savingThrows.length > 0) {
      d.savingThrows = convertSavingThrows(npc.savingThrows)
    }
    if (npc.skills && npc.skills.length > 0) {
      d.skills = convertSkills(npc.skills)
    }

    // Override spells if NPC has custom spell list
    if (npc.spells && npc.spells.length > 0) {
      d.selectedSpells = npc.spells.map(spell => ({
        name: spell.name || spell,
        level: spell.level || 0,
        usage: spell.usage || 'slot'
      }))
    }

    // The monster template is only a fallback for structural fields XML doesn't reliably
    // provide (size/type/traits/etc). Combat stats the NPC's own record DOES provide
    // (AC, HP, hit dice, speed, resistances) must win over the generic template values
    // npcbDraftFromMonster just populated above — otherwise a reflavored/leveled-up
    // NPC silently reverts to the vanilla monster's stats on first edit.
    if (npc.ac) {
      const acMatch = String(npc.ac).match(/^(\d+)(?:\s*\((.+)\))?/)
      if (acMatch) {
        d.acValue = parseInt(acMatch[1]) || d.acValue
        const rawAcMod = (acMatch[2] || '').toLowerCase()
        if (rawAcMod.includes('max 2')) d.acModifier = '+Dex Mod (max 2)'
        else if (rawAcMod.includes('dex')) d.acModifier = '+Dex Mod'
      }
    }
    if (npc.armor) d.armor = npc.armor

    if (npc.hpMax != null || npc.hd) {
      d.hpValue = parseInt(npc.hpMax) || d.hpValue
      const hdMatch = String(npc.hd || '').match(/^(\d+)(d\d+)/)
      if (hdMatch) {
        d.hitDiceCount = parseInt(hdMatch[1]) || d.hitDiceCount
        d.hitDiceSize = hdMatch[2] || d.hitDiceSize
      }
    }

    if (npc.speed && typeof npc.speed === 'string') {
      d.speed = npc.speed
      d.speedEntries = window.mbParseSpeed ? window.mbParseSpeed(npc.speed) : d.speedEntries
    }

    if (npc.resist != null) d.resist = toDamageList(npc.resist)
    if (npc.vulnerable != null) d.vulnerable = toDamageList(npc.vulnerable)
    if (npc.immune != null) d.immune = toDamageList(npc.immune)
    if (npc.conditionImmune != null) d.conditionImmune = toDamageList(npc.conditionImmune)

    if (npc.senses) d.senses = npc.senses
    if (npc.passive) d.passive = npc.passive
    if (npc.languages) d.languages = npc.languages
    if (npc.cr) d.cr = String(npc.cr)

    // Preserve current HP for monster-templated NPCs too (not just the compact-format branch above)
    d.hpCurrent = npc.hpCurrent != null ? parseInt(npc.hpCurrent)
      : (npc._draft?.hpCurrent != null ? npc._draft.hpCurrent : d.hpValue)
  }

  // Fields that apply regardless of which branch populated the draft above
  if (npc.spellSaveDC != null) d.spellSaveDC = npc.spellSaveDC
  else if (npc._draft?.spellSaveDC != null) d.spellSaveDC = npc._draft.spellSaveDC
  if (npc.spellAttackMod != null) d.spellAttackMod = npc.spellAttackMod
  else if (npc._draft?.spellAttackMod != null) d.spellAttackMod = npc._draft.spellAttackMod
  if (npc.campaignName) d.campaignName = npc.campaignName
  if (npc.slotsCurrent != null) d.slotsCurrent = npc.slotsCurrent
  // Fallback for the baseMonster branch, which doesn't read npc.text itself
  if (!d.description && npc.text) d.description = npc.text

  // Ensure ALL array fields are arrays after any assignment
  // Don't overwrite savingThrows/skills if they're already set correctly from baseMonster path
  if (!Array.isArray(d.savingThrows)) d.savingThrows = []
  if (!Array.isArray(d.skills)) d.skills = []
  d.vulnerable = Array.isArray(d.vulnerable) ? d.vulnerable : []
  d.resist = Array.isArray(d.resist) ? d.resist : []
  d.immune = Array.isArray(d.immune) ? d.immune : []
  d.conditionImmune = Array.isArray(d.conditionImmune) ? d.conditionImmune : []
  d.traits = Array.isArray(d.traits) ? d.traits : []
  d.actions = Array.isArray(d.actions) ? d.actions : []
  d.bonusActions = Array.isArray(d.bonusActions) ? d.bonusActions : []
  d.reactions = Array.isArray(d.reactions) ? d.reactions : []
  d.legendaryActions = Array.isArray(d.legendaryActions) ? d.legendaryActions : []
  d.lairActions = Array.isArray(d.lairActions) ? d.lairActions : []
  d.selectedSpells = Array.isArray(d.selectedSpells) ? d.selectedSpells : []
  d.speedEntries = Array.isArray(d.speedEntries) ? d.speedEntries : [{type:'Walk',ft:30}]
  d.spellSlots = Array.isArray(d.spellSlots) ? d.spellSlots : [0,0,0,0,0,0,0,0,0]
  d.environments = Array.isArray(d.environments) ? d.environments : []
  d.notes = Array.isArray(d.notes) ? d.notes : (npc.notes ? npc.notes : [])

  // Parse spells from XML if NPC has them (and they weren't already set from monster/draft)
  if (!baseMonster && npc.spells && npc.spells.length > 0 && d.selectedSpells.length === 0) {
    d.selectedSpells = npc.spells.map(spell => ({
      name: spell.name || spell,
      level: parseInt(spell.level) || 0,
      usage: 'slot'
    }))
  }

  // Parse spell slots from XML slots string (e.g., "0,4,3,2,0,0,0,0,0,0")
  // Index 0 is cantrips, index 1-9 are spell levels 1-9
  if (npc.slots && typeof npc.slots === 'string') {
    const slotsArr = npc.slots.split(',').filter(s => s.trim()).map(s => parseInt(s.trim()) || 0)
    // Skip index 0 (cantrips) and take indices 1-9 for spell levels 1-9
    const levelSlots = slotsArr.slice(1, 10)
    const paddingLength = Math.max(0, 9 - levelSlots.length)
    d.spellSlots = [...levelSlots, ...Array(paddingLength).fill(0)].slice(0, 9)
  }

  return d
}

function npcbDraftFromMonster(monster) {
  // Pre-fill draft from a compendium monster
  const d = npcbDefaultDraft()

  if (monster._draft) {
    // Monster was created in monster builder — copy its draft
    Object.assign(d, monster._draft)
  } else {
    // Parse from compact monster format
    d.name = monster.name || ''
    d.portrait = monster.portrait || null

    // Convert abbreviated size to full name (M → Medium, S → Small, etc.)
    const sizeMap = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' }
    d.size = sizeMap[monster.size] || monster.size || 'Medium'

    // Capitalize type to match drum picker values (plant → Plant)
    // Strip anything after parenthesis (e.g., "Monstrosity (t-rex)" → "Monstrosity")
    const rawType = (monster.type || 'Humanoid').split('(')[0].trim()
    d.type = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase()

    d.alignment = (monster.alignment || '').replace(/^Typically\s+/i, '')
    d.alignmentTypically = /^Typically\s+/i.test(monster.alignment || '')
    d.tag = monster.tag || ''
    d.source = Array.isArray(monster.source) ? monster.source.join(', ') : (monster.source || '')

    // Parse AC
    const acMatch = String(monster.ac || '10').match(/^(\d+)/)
    d.acValue = acMatch ? parseInt(acMatch[1]) : 10
    d.armor = monster.armor || ''

    // Parse HP
    const hpMatch = String(monster.hp || '10').match(/^(\d+)\s*\((\d+)(d\d+)/)
    if (hpMatch) {
      d.hpValue = parseInt(hpMatch[1]) || 10
      d.hitDiceCount = parseInt(hpMatch[2]) || 2
      d.hitDiceSize = hpMatch[3] || 'd8'
    }

    d.speed = monster.speed || '30 ft.'
    d.speedEntries = window.mbParseSpeed ? window.mbParseSpeed(d.speed) : [{type:'Walk',ft:30}]
    d.initiativeBonus = monster.initiativeBonus || 0
    d.proficiencyBonus = monster.proficiencyBonus || 0

    d.str = monster.str || 10
    d.dex = monster.dex || 10
    d.con = monster.con || 10
    d.int = monster.int || 10
    d.wis = monster.wis || 10
    d.cha = monster.cha || 10

    d.savingThrows = Array.isArray(monster.savingThrows) ? monster.savingThrows : []
    d.skills = Array.isArray(monster.skills) ? monster.skills : []
    d.vulnerable = Array.isArray(monster.vulnerable) ? monster.vulnerable : []
    d.resist = Array.isArray(monster.resist) ? monster.resist : []
    d.immune = Array.isArray(monster.immune) ? monster.immune : []
    d.conditionImmune = Array.isArray(monster.conditionImmune) ? monster.conditionImmune : []
    d.senses = monster.senses || ''
    d.passive = monster.passive || ''
    d.languages = monster.languages || ''
    // CR: map fractional CRs (1/4, 1/2, etc.) to CR 1, otherwise use monster's CR or default to 1
    const monsterCR = String(monster.cr || '1')
    d.cr = (monsterCR.includes('/') || parseInt(monsterCR) < 1) ? '1' : monsterCR

    // Convert compendium entry format (text) to draft format (desc)
    function parseEntries(arr, hasAttack) {
      return (arr || []).map(entry => {
        let lu = { type: 'none', count: 1 }
        let name = entry.name || ''
        if (entry.charges != null) {
          lu = { type: 'per_day', count: entry.charges }
        } else if (entry.recharge != null) {
          lu = { type: `recharge_${entry.recharge}`, count: 1 }
        } else {
          // Structured recharge field is empty - XML-imported monsters often bake this into
          // the action name instead, e.g. "Cold Breath (Recharge 6)" or "Acid Breath (Recharge 5-6)".
          // Extract the lower bound of the range as the recharge threshold, and strip the
          // suffix so it doesn't display redundantly once limitedUsage shows it separately.
          const rechargeMatch = name.match(/\s*\(\s*recharge\s+(\d+)(?:\s*[-–—]\s*\d+)?\s*\)/i)
          if (rechargeMatch) {
            lu = { type: `recharge_${rechargeMatch[1]}`, count: 1 }
            name = name.replace(rechargeMatch[0], '').replace(/\s{2,}/g, ' ').trim()
          }
        }
        const atk = (hasAttack && entry.attack) ? { bonus: parseInt(entry.attack.atk) || 0, dmg: entry.attack.dmg || '' } : null
        return {
          id: 'mbe_' + Math.random().toString(36).slice(2),
          name: name,
          desc: entry.text || entry.desc || '', // Support both compendium (text) and draft (desc) formats
          limitedUsage: lu,
          attack: atk
        }
      })
    }

    d.traits = parseEntries(monster.traits, false)
    d.actions = parseEntries(monster.actions, true)
    d.bonusActions = parseEntries(monster.bonusActions, false)
    d.reactions = parseEntries(monster.reactions, false)
    d.legendaryActions = parseEntries(monster.legendaryActions, true)
    d.lairActions = parseEntries(monster.lairActions, false)
    d.selectedSpells = Array.isArray(monster.selectedSpells) ? monster.selectedSpells : []
    d.description = monster.description || ''
  }

  // Ensure ALL array fields are arrays after any assignment (handles null, undefined, strings, etc.)
  d.savingThrows = Array.isArray(d.savingThrows) ? d.savingThrows : []
  d.skills = Array.isArray(d.skills) ? d.skills : []
  d.vulnerable = Array.isArray(d.vulnerable) ? d.vulnerable : []
  d.resist = Array.isArray(d.resist) ? d.resist : []
  d.immune = Array.isArray(d.immune) ? d.immune : []
  d.conditionImmune = Array.isArray(d.conditionImmune) ? d.conditionImmune : []
  d.traits = Array.isArray(d.traits) ? d.traits : []
  d.actions = Array.isArray(d.actions) ? d.actions : []
  d.bonusActions = Array.isArray(d.bonusActions) ? d.bonusActions : []
  d.reactions = Array.isArray(d.reactions) ? d.reactions : []
  d.legendaryActions = Array.isArray(d.legendaryActions) ? d.legendaryActions : []
  d.lairActions = Array.isArray(d.lairActions) ? d.lairActions : []
  d.selectedSpells = Array.isArray(d.selectedSpells) ? d.selectedSpells : []
  d.speedEntries = Array.isArray(d.speedEntries) ? d.speedEntries : [{type:'Walk',ft:30}]
  d.spellSlots = Array.isArray(d.spellSlots) ? d.spellSlots : [0,0,0,0,0,0,0,0,0]
  d.environments = Array.isArray(d.environments) ? d.environments : []
  d.notes = Array.isArray(d.notes) ? d.notes : []


  return d
}

function renderNPCBuilder() {
  const content = document.getElementById('content')

  if (npcb.step === 'choice') {
    // Choice screen needs padding
    content.style.padding = '20px'
    const choiceHTML = npcbRenderChoice()
    content.innerHTML = choiceHTML
  } else {
    // Form needs no padding (sticky header)
    content.style.padding = '0'
    const formHTML = npcbRenderForm()
    content.innerHTML = formHTML
  }
}

function npcbRenderChoice() {
  const MBS = window.MBS || {} // reuse monster builder styles
  if (!window.MBS) {
    console.error('[npcbRenderChoice] MBS not loaded yet! Monster Builder may have errors.')
  }
  return `
    <div style="max-width:600px;margin:40px auto 60px;padding:0;">
      <div style="text-align:center;margin-bottom:32px;">
        <h2 style="font-size:24px;color:#e0d5c5;margin-bottom:8px;">Create New NPC</h2>
        <p style="color:#C8C8C8;font-size:14px;">Choose how to start</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div onclick="npcbStartScratch()"
          style="background:#5C5C5C;border:4px solid #2E2F2D;padding:28px 20px;border-radius:8px;
                 cursor:pointer;text-align:center;transition:border-color .2s;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;gap:12px;"
          onmouseover="this.style.background='#6E6E6E'"
          onmouseout="this.style.background='#5C5C5C'">
          <img src="assets/New_Creature.png" alt="Start from Scratch"
            style="max-width:100%;max-height:200px;object-fit:contain;" />
          <div style="font-family:var(--app-font);font-size:14px;color:#e0d5c5;">
            Create from scratch
          </div>
        </div>

        <div onclick="npcbShowMonsterPicker()"
          style="background:#5C5C5C;border:4px solid #2E2F2D;padding:28px 20px;border-radius:8px;
                 cursor:pointer;text-align:center;transition:border-color .2s;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;gap:12px;"
          onmouseover="this.style.background='#6E6E6E'"
          onmouseout="this.style.background='#5C5C5C'">
          <img src="assets/Copy_Existing_Creature.png" alt="Start from Monster"
            style="max-width:100%;max-height:200px;object-fit:contain;" />
          <div style="font-family:var(--app-font);font-size:14px;color:#e0d5c5;">
            Copy existing creature
          </div>
        </div>
      </div>

      <div style="text-align:center;">
        <button onclick="if(typeof popNav==='function')popNav();else showSection('home')" style="${MBS.btnSecondary}">
          Cancel
        </button>
      </div>
    </div>
  `
}

function npcbStartScratch() {
  npcb.step = 'form'
  npcb.startMode = 'scratch'
  npcb.draft = npcbDefaultDraft()
  npcb.dirty = false

  // Update mb object properties in place (don't replace the object)
  mb.draft = npcb.draft
  mb.dirty = npcb.dirty
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

  renderNPCBuilder()
}

function npcbShowMonsterPicker() {
  const MBS = window.MBS
  const content = document.getElementById('content')
  content.style.padding = '20px'
  content.style.overflow = ''
  content.style.overflowY = 'auto'
  content.innerHTML = `
    <div style="max-width:900px;margin:0 auto;padding-bottom:40px;">
      <div style="margin-bottom:20px;">
        <button onclick="npcb.step='choice';renderNPCBuilder()" style="${MBS.btnSecondary}padding:6px 14px;">
          ← Back
        </button>
      </div>

      <h2 style="font-size:20px;color:#e0d5c5;margin-bottom:16px;">Select Monster Template</h2>

      <input id="npcb-monster-search" type="text" placeholder="Search monsters…"
        style="width:100%;max-width:500px;padding:8px 12px;margin-bottom:16px;background:#5C5C5C;
               border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
               border-radius:4px;font-size:14px;display:block;"
        oninput="npcbFilterMonsters(this.value)" />

      <div id="npcb-monster-grid"
        style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
      </div>
    </div>
  `
  npcbFilterMonsters('')
}

function npcbFilterMonsters(query) {
  const grid = document.getElementById('npcb-monster-grid')
  if (!grid) return

  const filtered = query
    ? compendiumData.monsters.filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
    : compendiumData.monsters

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:#C8C8C8;grid-column:1/-1;">No monsters match that search.</p>'
    return
  }

  grid.innerHTML = filtered.map(m => `
    <div onclick="npcbStartFromMonster('${m.name.replace(/'/g, "\\'")}')"
      style="background:#262F35;border:1px solid #2E2F2D;padding:12px;border-radius:4px;cursor:pointer;"
      onmouseover="this.style.borderColor='#8b0000'" onmouseout="this.style.borderColor='#2E2F2D'">
      ${m.portrait ? `
        <div style="width:100%;height:80px;margin-bottom:8px;border-radius:3px;overflow:hidden;">
          <img src="${m.portrait}" style="width:100%;height:100%;object-fit:cover;">
        </div>
      ` : ''}
      <div style="font-weight:bold;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        ${m.name}
      </div>
      <div style="font-size:12px;color:#C8C8C8;">${window.expandSize ? window.expandSize(m.size) : m.size} ${m.type}</div>
      <div style="font-size:12px;color:#C8C8C8;">CR ${m.cr || '—'}</div>
    </div>
  `).join('')
}

function npcbStartFromMonster(monsterName) {
  const monster = compendiumData.monsters.find(m => m.name === monsterName)
  if (!monster) {
    showToast('Monster not found')
    return
  }

  npcb.step = 'form'
  npcb.startMode = 'monster'
  npcb.selectedMonster = monster
  npcb.draft = npcbDraftFromMonster(monster)
  npcb.dirty = false

  // Update mb object properties in place (don't replace the object)
  mb.draft = npcb.draft
  mb.dirty = npcb.dirty
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

  renderNPCBuilder()
}

function npcbRenderForm() {
  // mb.draft was already set in openNPCBuilder - don't replace it, just sync dirty flag
  mb.dirty = npcb.dirty

  const MBS = window.MBS
  const d = npcb.draft

  const formHTML = `
    <div style="min-height:100%;background:linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                url('assets/Background.png') left -40px/1641px auto no-repeat fixed;">
      <div style="background:#5C5C5C;border-bottom:4px solid #2E2F2D;
                  display:flex;align-items:center;justify-content:space-between;padding:16px 24px 12px 24px;gap:12px;
                  flex-shrink:0;padding-left:240px;box-sizing:border-box;">
        <button onclick="npcbBack()" style="${MBS.btnSecondary}padding:6px 14px;">← Back</button>
        <div style="flex:1;text-align:center;">
          <span id="npcb-title" style="font-size:15px;font-weight:bold;color:#e0d5c5;font-family:var(--app-font);">
            ${d.properName || d.name || 'New NPC'}
          </span>
        </div>
        <button onclick="npcbSave()" style="${MBS.btnPrimary}">Save</button>
      </div>
      <div style="max-width:800px;margin:0 auto;padding:20px 24px 40px;">
      ${npcbRenderProperName()}
      <div style="${MBS.card}">${npcbRenderStatBlockHeader()}</div>
      <div style="${MBS.card}"><div id="mb-combat-section">${window.mbRenderCombat()}</div></div>
      ${window.mbCardWrap('SPEED', `<div id="mb-speed-section">${window.mbRenderSpeedPicker()}</div>`)}
      ${window.mbCardWrap('ABILITY SCORES', window.mbRenderAbilityScores())}
      ${window.mbCardWrap('SAVING THROWS', `<div id="mb-sect-ST">${window.mbRenderSavingThrows()}</div>`)}
      ${window.mbCardWrap('SKILLS', `<div id="mb-sect-Skills">${window.mbRenderSkills()}</div>`)}
      ${window.mbCardWrap('DAMAGE VULNERABILITIES / RESISTANCES / IMMUNITIES', window.mbRenderDamageTypes())}
      ${window.mbCardWrap('CONDITION IMMUNITIES', window.mbRenderConditionImmunities())}
      ${window.mbCardWrap('SENSES', window.mbRenderSenses())}
      ${window.mbCardWrap('LANGUAGES', window.mbRenderLanguages())}
      ${window.mbCardWrap('TRAITS', `<div id="mb-sect-traits">${window.mbRenderAbilityGroup('traits', false)}</div>`)}
      ${window.mbCardWrap('ACTIONS', `<div id="mb-sect-actions">${window.mbRenderAbilityGroup('actions', true)}</div>`)}
      ${window.mbCardWrap('BONUS ACTIONS', `<div id="mb-sect-bonusActions">${window.mbRenderAbilityGroup('bonusActions', true)}</div>`)}
      ${window.mbCardWrap('REACTIONS', `<div id="mb-sect-reactions">${window.mbRenderAbilityGroup('reactions', true)}</div>`)}
      ${window.mbCardWrap('LEGENDARY ACTIONS', `<div id="mb-sect-legendaryActions">${window.mbRenderAbilityGroup('legendaryActions', true)}</div>`)}
      ${window.mbCardWrap('LAIR ACTIONS', `<div id="mb-sect-lairActions">${window.mbRenderAbilityGroup('lairActions', true)}</div>`)}
      ${window.mbCardWrap('SPELLS', `<div id="mb-sect-Spells">${window.mbRenderSpells()}</div>`)}
      ${npcbRenderNotes()}
      ${window.mbCardWrap('ENVIRONMENT', window.mbRenderEnvironments())}
      ${window.mbCardWrap('DESCRIPTION', window.mbRenderDescription())}
      </div>
    </div>
  `

  const testHeader = npcbRenderStatBlockHeader()
  const testCombat = window.mbRenderCombat()

  return formHTML
}

function npcbRenderProperName() {
  const MBS = window.MBS
  const d = npcb.draft
  return `
    <div style="${MBS.card}">
      <label style="${MBS.label}">NAME</label>
      <input value="${window.mbEsc(d.properName)}" placeholder="e.g. Mossy, Thrain Ironfoot, etc."
        onchange="npcb.draft.properName=this.value;npcb.dirty=true;const t=document.getElementById('npcb-title');if(t)t.textContent=this.value||npcb.draft.name||'New NPC'"
        style="${MBS.field}width:100%;box-sizing:border-box;font-size:16px;">
    </div>
  `
}

function npcbRenderStatBlockHeader() {
  // Clone mbRenderHeader but change "NAME" label to "STAT BLOCK NAME"
  const headerHTML = window.mbRenderHeader()
  const labelStyle = 'display:block;font-size:10px;color:#7B9BA8;letter-spacing:.1em;font-weight:700;margin-bottom:5px;'
  return headerHTML.replace(
    `<label style="${labelStyle}">NAME</label>`,
    `<label style="${labelStyle}">STAT BLOCK NAME</label>`
  ).replace(
    'placeholder="Creature name…"',
    'placeholder="e.g. Vegepygmy, Guard, Commoner, etc."'
  )
}

function npcbRenderNotes() {
  const MBS = window.MBS
  const d = npcb.draft
  return `
    <div style="${MBS.card}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="${MBS.cardHeader}">NOTES</div>
        <span style="font-size:10px;color:#C8C8C8;font-style:italic;">
          Occupation, faction, personality, etc.
        </span>
      </div>
      <div id="npcb-notes-list">
        ${d.notes.map((note, i) => npcbRenderNote(note, i)).join('')}
      </div>
      <button onclick="npcbAddNote()" style="${MBS.btnSecondary}margin-top:8px;">
        + Add Note
      </button>
    </div>
  `
}

function npcbRenderNote(note, idx) {
  const MBS = window.MBS
  return `
    <div style="background:#0d1b2a;border:1px solid #2E2F2D;border-radius:4px;padding:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <input value="${window.mbEsc(note.title)}" placeholder="Note title"
          onchange="npcb.draft.notes[${idx}].title=this.value;npcb.dirty=true"
          style="${MBS.field}flex:1;min-width:0;">
        <button onclick="npcbRemoveNote(${idx})"
          style="background:none;border:none;color:#C8C8C8;cursor:pointer;font-size:16px;padding:0 4px;"
          title="Remove note">×</button>
      </div>
      <textarea rows="3" placeholder="Note content..."
        onchange="npcb.draft.notes[${idx}].body=this.value;npcb.dirty=true"
        style="${MBS.field}width:100%;resize:vertical;">${window.mbEsc(note.body)}</textarea>
    </div>
  `
}

function npcbAddNote() {
  npcb.draft.notes.push({title: '', body: ''})
  npcb.dirty = true
  const list = document.getElementById('npcb-notes-list')
  if (list) {
    list.innerHTML = npcb.draft.notes.map((note, i) => npcbRenderNote(note, i)).join('')
  }
}

function npcbRemoveNote(idx) {
  window.confirmDelete('Delete note?', () => {
    npcb.draft.notes.splice(idx, 1)
    npcb.dirty = true
    const list = document.getElementById('npcb-notes-list')
    if (list) {
      list.innerHTML = npcb.draft.notes.map((note, i) => npcbRenderNote(note, i)).join('')
    }
  })
}

function npcbBuildEntry(d) {
  // Build NPC entry for campaign storage
  // Format fields to match compendium format (not draft format)
  const conBonus = window.mbMod(d.con) * d.hitDiceCount
  const conStr = conBonus === 0 ? '' : (conBonus > 0 ? ` + ${conBonus}` : ` - ${Math.abs(conBonus)}`)

  function entryToBlob(e) {
    return {
      name: e.name, text: e.desc,
      charges: e.limitedUsage.type === 'per_day' ? e.limitedUsage.count : null,
      chargesCurrent: e.limitedUsage.type === 'per_day' ? e.limitedUsage.count : null,
      recharge: window.mbRechargeNum ? window.mbRechargeNum(e.limitedUsage) : null,
    }
  }
  function actionToBlob(e) {
    // e.attack is normalized to the Monster Builder structured attack shape by
    // normalizeActions() in openNPCBuilder (atk/diceCount/dieType/dmgBonus/dmgType/...),
    // not the legacy {bonus, dmg} NPC shape. Serialize the same way Monster Builder's
    // own actionToBlob does (monster-builder.js mbBuildCompendiumEntry) so attack data
    // survives the round trip and the encounter tracker's rollDamage() (which prefers
    // this structured format) keeps working.
    const attackObj = e.attack ? {
      atk: e.attack.atk || '+0',
      diceCount: e.attack.diceCount || '',
      dieType: e.attack.dieType || 'd6',
      dmgBonus: e.attack.dmgBonus || '',
      dmgType: e.attack.dmgType || '',
      additionalDiceCount: e.attack.additionalDiceCount || '',
      additionalDieType: e.attack.additionalDieType || '',
      additionalDmgType: e.attack.additionalDmgType || '',
      altDiceCount: e.attack.altDiceCount || '',
      altDieType: e.attack.altDieType || '',
      altDmgBonus: e.attack.altDmgBonus || '',
      altDmgType: e.attack.altDmgType || '',
    } : null
    if (attackObj && e.attack.dmg) attackObj.dmg = e.attack.dmg
    return {
      ...entryToBlob(e),
      attack: attackObj,
    }
  }

  return {
    uid: npcb.originalUid || `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    _draft: JSON.parse(JSON.stringify(d)),
    properName: d.properName || '',
    notes: d.notes || [],
    isNPC: true,
    label: d.properName || d.name,
    name: d.name || 'Unnamed NPC',
    size: d.size,
    type: d.type,
    tag: d.tag || '',
    alignment: (d.alignmentTypically ? 'Typically ' : '') + (d.alignment||''),
    ac: d.acModifier && d.acModifier !== '—'
      ? `${d.acValue} (${d.acModifier})`
      : String(d.acValue),
    armor: d.armor||'',
    hp: `${d.hpValue} (${d.hitDiceCount}${d.hitDiceSize}${conStr})`,
    hpMax: d.hpValue,
    hpCurrent: d.hpCurrent != null ? d.hpCurrent : d.hpValue,
    hd: `${d.hitDiceCount}${d.hitDiceSize}${conStr}`,
    speed: window.mbSpeedStr ? window.mbSpeedStr(d.speedEntries || [{type:'Walk',ft:30}]) : (d.speed || '30 ft.'),
    initiativeBonus: d.initiativeBonus,
    proficiencyBonus: d.proficiencyBonus||0,
    str: String(d.str), dex: String(d.dex), con: String(d.con),
    int: String(d.int), wis: String(d.wis), cha: String(d.cha),
    abilities: [d.str, d.dex, d.con, d.int, d.wis, d.cha],
    save: d.savingThrows.map(s => `${s.ability[0]}${s.ability.slice(1).toLowerCase()} ${window.mbSignedNum(s.modifier)}`).join(', '),
    skill: d.skills.map(s => `${s.name} ${window.mbSignedNum(s.modifier)}`).join(', '),
    savingThrows: d.savingThrows,
    skills: d.skills,
    vulnerable: (d.vulnerable||[]).join(', '),
    resist: (d.resist||[]).join(', '),
    immune: (d.immune||[]).join(', '),
    conditionImmune: (d.conditionImmune||[]).join(', '),
    senses: d.senses,
    passive: d.passive||'',
    languages: d.languages,
    cr: d.cr,
    traits: (d.traits||[]).map(entryToBlob),
    actions: (d.actions||[]).map(actionToBlob),
    reactions: (d.reactions||[]).map(entryToBlob),
    legendaryActions: (d.legendaryActions||[]).map(actionToBlob),
    lairActions: (d.lairActions||[]).map(actionToBlob),
    bonusActions: (d.bonusActions||[]).map(entryToBlob),
    spellSlots: d.spellSlots||[0,0,0,0,0,0,0,0,0],
    slots: (d.spellSlots||[0,0,0,0,0,0,0,0,0]).join(','),
    selectedSpells: d.selectedSpells||[],
    spells: (d.selectedSpells||[]).filter(s=>s&&s.usage==='slot').map(s=>s.name),
    spellSaveDC: d.spellSaveDC,
    spellAttackMod: d.spellAttackMod,
    campaignName: d.campaignName || undefined,
    slotsCurrent: d.slotsCurrent != null ? d.slotsCurrent : undefined,
    environments: d.environments || [],
    archived: d.archived || false,
  }
}

function npcbSave() {
  const d = npcb.draft
  if (!d.name || !d.name.trim()) {
    showToast('Please enter a stat block name.')
    return
  }

  const entry = npcbBuildEntry(d)
  const idx = compendiumData.npcs.findIndex(n => n.uid === npcb.originalUid)

  if (idx >= 0) {
    compendiumData.npcs[idx] = entry
  } else {
    compendiumData.npcs.push(entry)
    compendiumData.npcs.sort((a, b) => (a.properName || a.name).localeCompare(b.properName || b.name))
  }

  // Save to campaign
  if (compendiumData.activeCampaign && compendiumData.campaigns) {
    compendiumData.campaigns[compendiumData.activeCampaign] = {
      players: compendiumData.players,
      npcs: compendiumData.npcs
    }
    const saveCampaigns = window.require ? window.require('./storage.js').saveCampaigns : null
    if (saveCampaigns) saveCampaigns(compendiumData.campaigns)
  }

  npcb.dirty = false
  const displayName = entry.properName || entry.name
  showToast(`NPC "${displayName}" saved.`)
  if (typeof popNav === 'function') popNav()
  else showSection('home')
}

function npcbBack() {
  // Check both npcb.dirty and window.mb.dirty since monster builder fields set mb.dirty
  const isDirty = npcb.dirty || (window.mb && window.mb.dirty)

  if (!isDirty) {
    if (typeof popNav === 'function') popNav()
    else showSection('home')
    return
  }

  const overlay = document.createElement('div')
  overlay.id = 'npcb-discard-overlay'
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;
    display:flex;align-items:center;justify-content:center;`
  overlay.innerHTML = `
    <div style="background:#262F35;border:2px solid #8b0000;border-radius:8px;
                padding:28px 32px;max-width:340px;text-align:center;font-family:var(--app-font);">
      <div style="font-size:16px;font-weight:bold;color:#e0d5c5;margin-bottom:10px;">Discard Changes?</div>
      <div style="font-size:13px;color:#C8C8C8;margin-bottom:20px;line-height:1.6;">
        You have unsaved changes. Are you sure you want to go back?
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="document.getElementById('npcb-discard-overlay').remove()"
          style="background:none;border:1px solid #2E2F2D;color:#C8C8C8;padding:8px 20px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
          Cancel
        </button>
        <button onclick="document.getElementById('npcb-discard-overlay').remove();npcb.draft=null;npcb.dirty=false;if(window.mb)window.mb.dirty=false;if(typeof popNav==='function')popNav();else showSection('home')"
          style="background:#8b0000;color:#e0d5c5;border:none;padding:8px 20px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
          Discard
        </button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

// Export functions to window
window.openNPCBuilder = openNPCBuilder
window.npcbStartScratch = npcbStartScratch
window.npcbShowMonsterPicker = npcbShowMonsterPicker
window.npcbFilterMonsters = npcbFilterMonsters
window.npcbStartFromMonster = npcbStartFromMonster
window.npcbRenderNotes = npcbRenderNotes
window.npcbAddNote = npcbAddNote
window.npcbRemoveNote = npcbRemoveNote
window.npcbSave = npcbSave
window.npcbBack = npcbBack
