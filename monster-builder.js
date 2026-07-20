// ── Monster Builder ───────────────────────────────────────────────

const MB_SIZES = ['Tiny','Small','Medium','Large','Huge','Gargantuan']
const MB_TYPES = ['Aberration','Beast','Celestial','Construct','Dragon','Elemental',
  'Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead']
const MB_SKILLS_LIST = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception',
  'History','Insight','Intimidation','Investigation','Medicine','Nature','Perception',
  'Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival']
const MB_ABILITIES_LIST = ['STR','DEX','CON','INT','WIS','CHA']
const MB_ENVIRONMENTS = ['Arctic','Coastal','Desert','Forest','Grassland','Hill',
  'Mountain','Swamp','Underdark','Underwater','Urban']
const MB_DIE_SIZES = ['d4','d6','d8','d10','d12','d20']
const MB_ALIGNMENTS = ['Unaligned','Any','Lawful Good','Neutral Good','Chaotic Good',
  'Lawful Neutral','Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil']
const MB_AC_MODS = ['—','+Dex Mod','+Dex Mod (max 2)']
const MB_SPEED_TYPES = ['Walk','Burrow','Climb','Fly','Swim']
const MB_DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic',
  'Piercing','Poison','Psychic','Radiant','Slashing','Thunder',
  'Bludgeoning/Piercing/Slashing from nonmagical attacks']
const MB_CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled',
  'Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained',
  'Stunned','Unconscious']
const MB_TAG_OPTIONS = {
  vulnerable: MB_DAMAGE_TYPES, resist: MB_DAMAGE_TYPES,
  immune: MB_DAMAGE_TYPES, conditionImmune: MB_CONDITIONS,
}
const MB_CR_TABLE = [
  {cr:'0',xp:10},{cr:'1/8',xp:25},{cr:'1/4',xp:50},{cr:'1/2',xp:100},
  {cr:'1',xp:200},{cr:'2',xp:450},{cr:'3',xp:700},{cr:'4',xp:1100},
  {cr:'5',xp:1800},{cr:'6',xp:2300},{cr:'7',xp:2900},{cr:'8',xp:3900},
  {cr:'9',xp:5000},{cr:'10',xp:5900},{cr:'11',xp:7200},{cr:'12',xp:8400},
  {cr:'13',xp:10000},{cr:'14',xp:11500},{cr:'15',xp:13000},{cr:'16',xp:15000},
  {cr:'17',xp:18000},{cr:'18',xp:20000},{cr:'19',xp:22000},{cr:'20',xp:25000},
  {cr:'21',xp:33000},{cr:'22',xp:41000},{cr:'23',xp:50000},{cr:'24',xp:62000},
  {cr:'25',xp:75000},{cr:'26',xp:90000},{cr:'27',xp:105000},{cr:'28',xp:120000},
  {cr:'29',xp:135000},{cr:'30',xp:155000}
]

// Export to window so renderer.js can access it for stat block display
window.MB_CR_TABLE = MB_CR_TABLE

// Use window.mb so NPC builder can share the same state object
window.mb = window.mb || {
  draft: null,
  originalName: null,
  dirty: false,
  step: 'choice',  // 'choice' or 'form'
  stPickerOpen: false,
  stPickerAbility: null,
  stPickerMod: 0,
  skillPickerOpen: false,
  skillPickerName: null,
  skillPickerMod: 0,
  editingEntry: null,   // {section, idx} or null
  spellPickerOpen: false,
  spellPickerQuery: '',
  spellPendingName: null,
  spellPendingLevel: null,
  dragSect: null,
  dragIdx: null,
  monsterPickerOpen: false,
  monsterPickerQuery: '',
}
// Create local reference for convenience
const mb = window.mb

const mbDrumState = {}   // keyed by picker id

// ── Style constants ───────────────────────────────────────────────
const MBS = {
  btnPrimary: `background:#1E231A;color:#909090;border:2px solid #445E22;padding:7px 18px;
    cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);`,
  btnSmall: `background:#1E231A;color:#909090;border:2px solid #445E22;padding:5px 12px;
    cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);`,
  btnSecondary: `background:#3E3E3D;color:#e0d5c5;border:4px solid #2E2F2D;padding:7px 14px;
    cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);`,
  btnSecondarySmall: `background:#3E3E3D;color:#e0d5c5;border:4px solid #2E2F2D;padding:5px 10px;
    cursor:pointer;border-radius:4px;font-size:12px;font-family:var(--app-font);`,
  field: `background:#1A1C1E;border:1px solid #2E2F2D;color:#e0d5c5;
    padding:7px 10px;border-radius:4px;font-size:13px;font-family:var(--app-font);outline:none;`,
  select: `background:#1A1C1E;border:1px solid #2E2F2D;color:#e0d5c5;
    padding:7px 10px;border-radius:4px;font-size:13px;font-family:var(--app-font);cursor:pointer;outline:none;`,
  label: `display:block;font-size:10px;color:#7B9BA8;letter-spacing:.1em;font-weight:700;margin-bottom:5px;`,
  card: `background:#262F35;border:1px solid #2E2F2D;border-radius:6px;padding:20px;margin-bottom:14px;`,
  cardHeader: `font-size:12px;color:#4587A2;font-weight:bold;letter-spacing:.08em;
    border-bottom:1px solid #2E2F2D;padding-bottom:8px;margin-bottom:14px;`,
  itemRow: `display:flex;align-items:center;gap:8px;padding:7px 8px;margin-bottom:4px;
    background:#1A1C1E;border-radius:4px;border:1px solid #2E2F2D;`,
}

// ── Utilities ─────────────────────────────────────────────────────
function mbEsc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
function mbMod(score) { return Math.floor(((parseInt(score)||10) - 10) / 2) }
function mbModStr(score) { const m = mbMod(score); return m >= 0 ? `+${m}` : `${m}` }

function mbSpeedStr(entries) {
  if (!entries || !entries.length) return '—'
  return entries.map(e => {
    const ft = `${e.ft} ft.`
    return e.type === 'Walk' ? ft : `${e.type.toLowerCase()} ${ft}`
  }).join(', ')
}

function mbParseSpeed(str) {
  if (!str) return [{type:'Walk', ft:30}]
  const entries = []
  str.split(',').forEach(part => {
    part = part.trim()
    const m = part.match(/^(?:(burrow|climb|fly|swim)\s+)?(\d+)\s*ft\.?/i)
    if (m) {
      const type = m[1] ? (m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) : 'Walk'
      const raw = parseInt(m[2])
      const ft = Math.round(raw / 5) * 5 || 30
      entries.push({type, ft})
    }
  })
  return entries.length ? entries : [{type:'Walk', ft:30}]
}

function mbHpDisplay(d) {
  const dieAvg = {d4:2.5,d6:3.5,d8:4.5,d10:5.5,d12:6.5,d20:10.5}
  const avg = dieAvg[d.hitDiceSize] || 4.5
  const conMod = mbMod(d.con)
  const autoHp = Math.max(1, Math.floor(d.hitDiceCount * avg + d.hitDiceCount * conMod))
  const totalCon = d.hitDiceCount * conMod

  // Calculate min/max
  const minHp = Math.max(1, (d.hitDiceCount * 1) + totalCon)
  const maxHp = Math.max(1, (d.hitDiceCount * parseInt(d.hitDiceSize.replace('d', ''))) + totalCon)

  // Build calculated HP string
  let diceStr = `${d.hitDiceCount}${d.hitDiceSize}`
  if (totalCon > 0) diceStr += ` +${totalCon}`
  else if (totalCon < 0) diceStr += ` ${totalCon}`

  return {
    auto: autoHp,
    calculated: `Calculated HP (${diceStr})`,
    min: minHp,
    avg: autoHp,
    max: maxHp
  }
}
function mbSignedNum(n) { return n >= 0 ? `+${n}` : `${n}` }
function mbAvgHp(d) {
  const dieAvg = {d4:2.5,d6:3.5,d8:4.5,d10:5.5,d12:6.5,d20:10.5}
  const avg = dieAvg[d.hitDiceSize] || 4.5
  const conMod = mbMod(d.con)
  return Math.max(1, Math.floor(d.hitDiceCount * avg + d.hitDiceCount * conMod))
}
function mbPassivePerc(d) {
  const percSkill = (d.skills||[]).find(s => s.name === 'Perception')
  if (percSkill) return 10 + percSkill.modifier
  return 10 + mbMod(d.wis)
}
function mbXpForCr(cr) {
  const entry = MB_CR_TABLE.find(e => e.cr === cr)
  return entry ? entry.xp.toLocaleString() : '—'
}
function mbLimitedStr(lu) {
  if (!lu || lu.type === 'none') return ''
  if (lu.type === 'per_day') return ` (${lu.count}/Day)`
  if (lu.type === 'short_rest') return ' (Recharge after Short Rest)'
  if (lu.type.startsWith('recharge_')) {
    const n = lu.type.split('_')[1]
    return n === '6' ? ' (Recharge 6)' : ` (Recharge ${n}–6)`
  }
  return ''
}
function mbRechargeNum(lu) {
  if (!lu) return null
  if (lu.type.startsWith('recharge_')) return parseInt(lu.type.split('_')[1]) || null
  return null
}

// Calculate proficiency bonus from CR using standard 5e table
function mbProficiencyFromCR(cr) {
  // Handle fractional CRs
  const crNum = cr === '1/8' ? 0.125 : cr === '1/4' ? 0.25 : cr === '1/2' ? 0.5 : parseFloat(cr)
  if (isNaN(crNum)) return 2

  if (crNum <= 4) return 2
  if (crNum <= 8) return 3
  if (crNum <= 12) return 4
  if (crNum <= 16) return 5
  if (crNum <= 20) return 6
  if (crNum <= 24) return 7
  if (crNum <= 28) return 8
  return 9
}

// ── Draft model ───────────────────────────────────────────────────
function mbDefaultDraft() {
  return {
    portrait:null, name:'', size:'Medium', type:'Humanoid', alignment:'', alignmentTypically:false,
    tag:'',
    acValue:10, acModifier:'—', armor:'', hpValue:10, hitDiceCount:2, hitDiceSize:'d8',
    speed:'30 ft.', speedEntries:[{type:'Walk',ft:30}], initiativeBonus:0, proficiencyBonus:0,
    homebrew:false, thirdParty:false, source:'',
    str:10, dex:10, con:10, int:10, wis:10, cha:10,
    savingThrows:[], skills:[],
    vulnerable:[], resist:[], immune:[], conditionImmune:[],
    senses:'', passive:'', languages:'', cr:'1',
    traits:[], actions:[], reactions:[], legendaryActions:[], lairActions:[], bonusActions:[],
    spellSaveDC:null, spellAttackMod:null,
    spellSlots:[0,0,0,0,0,0,0,0,0], selectedSpells:[],
    environments:[], description:'',
  }
}

function mbNewEntry() {
  return {
    id: 'mbe_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    name:'', desc:'',
    limitedUsage: { type:'none', count:1 },
    attack: null,
  }
}

function mbFromCompendium(m) {
  if (m._draft) {
    return JSON.parse(JSON.stringify(m._draft))
  }
  const d = mbDefaultDraft()
  d.name = m.name || ''

  const szMap = {T:'Tiny',S:'Small',M:'Medium',L:'Large',H:'Huge',G:'Gargantuan'}
  const sz = (m.size||'').trim()
  d.size = MB_SIZES.includes(sz) ? sz : (szMap[sz] || 'Medium')

  // Read type directly (no longer using drum picker, so accept any value)
  d.type = m.type || 'Humanoid'
  d.tag = m.tag || ''  // FIX 3: Read tag field from monster data
  const rawAlign = (m.alignment||'').trim()
  if (rawAlign.toLowerCase().startsWith('typically ')) {
    d.alignmentTypically = true
    d.alignment = rawAlign.slice(10).trim()
  } else {
    d.alignmentTypically = false
    d.alignment = rawAlign
  }

  const acM = (m.ac||'').match(/^(\d+)(?:\s*\((.+)\))?/)
  if (acM) {
    d.acValue = parseInt(acM[1])||10
    const rawAcType = (acM[2]||'').toLowerCase()
    if (rawAcType.includes('max 2')) d.acModifier = '+Dex Mod (max 2)'
    else if (rawAcType.includes('dex')) d.acModifier = '+Dex Mod'
    else d.acModifier = '—'
  }

  const hpM = (m.hp||'').match(/^(\d+)(?:\s*\((\d+)(d\d+))?/)
  if (hpM) {
    d.hpValue = parseInt(hpM[1])||0
    if (hpM[2]) d.hitDiceCount = parseInt(hpM[2])||1
    if (hpM[3]) d.hitDiceSize = hpM[3]
  }

  d.speedEntries = mbParseSpeed(m.speed||'')
  d.speed = mbSpeedStr(d.speedEntries)
  d.str = parseInt(m.str)||10; d.dex = parseInt(m.dex)||10; d.con = parseInt(m.con)||10
  d.int = parseInt(m.int)||10; d.wis = parseInt(m.wis)||10; d.cha = parseInt(m.cha)||10
  d.initiativeBonus = mbMod(d.dex)

  const ab = {
    str:'STR', strength:'STR',
    dex:'DEX', dexterity:'DEX',
    con:'CON', constitution:'CON',
    int:'INT', intelligence:'INT',
    wis:'WIS', wisdom:'WIS',
    cha:'CHA', charisma:'CHA'
  }
  ;(m.save||'').split(',').forEach(s => {
    const sm = s.trim().match(/^([A-Za-z]+)\s*([+-]\d+)/)
    if (sm) { const a = ab[sm[1].toLowerCase()]; if (a) d.savingThrows.push({ability:a, modifier:parseInt(sm[2])}) }
  })

  ;(m.skill||'').split(',').forEach(s => {
    const parts = s.trim().split(/\s+/)
    if (parts.length >= 2) {
      const mod = parseInt(parts[parts.length-1])
      const name = parts.slice(0, parts.length-1).join(' ')
      if (!isNaN(mod) && name) d.skills.push({name, modifier:mod})
    }
  })

  function parseTags(str, opts) {
    if (!str) return []
    return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
      const match = opts.find(o => o.toLowerCase() === s.toLowerCase())
      return match || s
    })
  }
  d.vulnerable     = parseTags(m.vulnerable,     MB_DAMAGE_TYPES)
  d.resist         = parseTags(m.resist,          MB_DAMAGE_TYPES)
  d.immune         = parseTags(m.immune,          MB_DAMAGE_TYPES)
  d.conditionImmune = parseTags(m.conditionImmune, MB_CONDITIONS)
  d.senses = m.senses||''; d.passive = m.passive||''; d.languages = m.languages||''
  const rawCr = (m.cr||'0').toString().trim()
  const crEntry = MB_CR_TABLE.find(e => e.cr === rawCr)
  d.cr = crEntry ? rawCr : '0'
  d.proficiencyBonus = mbProficiencyFromCR(d.cr)

  function parseEntries(arr, hasAttack) {
    return (arr||[]).map(t => {
      let lu = {type:'none', count:1}
      if (t.charges != null) lu = {type:'per_day', count:t.charges}
      else if (t.recharge != null) lu = {type:`recharge_${t.recharge}`, count:1}

      // Parse attack data - convert legacy XML format to structured format
      // Handle both Monster Builder format (text/atk) and NPC Builder format (desc/bonus)
      let atk = null
      if (hasAttack && t.attack) {
        // Normalize attack bonus - handle both formats
        // NPC format: {bonus: 7} (number) → Monster format: {atk: "+7"} (string)
        let normalizedAtkBonus = t.attack.atk || (t.attack.bonus !== undefined ?
          (t.attack.bonus >= 0 ? `+${t.attack.bonus}` : String(t.attack.bonus)) : '+0')

        // Check if it has old dmg-string format - if so, ALWAYS parse it to fix stale data
        // The dmg field is the source of truth for legacy data
        if (t.attack.dmg) {
          // Legacy format with dmg string - parse it (overwrites any stale structured fields)
          const dmgStr = t.attack.dmg || ''
          const parsed = window.parseDamageString(dmgStr)

          atk = {
            atk: normalizedAtkBonus,
            diceCount: parsed.diceCount,
            dieType: parsed.dieType,
            dmgBonus: parsed.dmgBonus,
            dmgType: parsed.dmgType,
            additionalDiceCount: parsed.additionalDiceCount || '',
            additionalDieType: parsed.additionalDieType || '',
            additionalDmgType: parsed.additionalDmgType || '',
            showAdditional: (parsed.additionalDiceCount || '') !== '',
            altDiceCount: t.attack.altDiceCount || '',
            altDieType: t.attack.altDieType || '',
            altDmgBonus: t.attack.altDmgBonus || '',
            altDmgType: t.attack.altDmgType || '',
            showAlternate: (t.attack.altDiceCount || '') !== ''
          }
        } else if (t.attack.atk !== undefined || t.attack.bonus !== undefined || t.attack.diceCount || t.attack.dieType) {
          // Structured format - check for stale data pattern (bonus in dmgType field)
          // Pattern: dmgType contains "+", "-", or starts with a number (old regex put bonus here)
          const staleDmgType = String(t.attack.dmgType || '').trim()
          const isStale = /^[\+\-\d]/.test(staleDmgType)

          if (isStale && t.attack.diceCount && t.attack.dieType) {
            // Reconstruct dmg string and re-parse to fix stale data
            const reconstructed = `${t.attack.diceCount}${t.attack.dieType}${staleDmgType}`
            const parsed = window.parseDamageString(reconstructed)

            atk = {
              atk: normalizedAtkBonus,
              diceCount: parsed.diceCount,
              dieType: parsed.dieType,
              dmgBonus: parsed.dmgBonus,
              dmgType: parsed.dmgType,
              additionalDiceCount: parsed.additionalDiceCount || t.attack.additionalDiceCount || '',
              additionalDieType: parsed.additionalDieType || t.attack.additionalDieType || '',
              additionalDmgType: parsed.additionalDmgType || t.attack.additionalDmgType || '',
              showAdditional: (parsed.additionalDiceCount || t.attack.additionalDiceCount || '') !== '',
              altDiceCount: t.attack.altDiceCount || '',
              altDieType: t.attack.altDieType || '',
              altDmgBonus: t.attack.altDmgBonus || '',
              altDmgType: t.attack.altDmgType || '',
              showAlternate: (t.attack.altDiceCount || '') !== ''
            }
          } else {
            // Clean structured format - use as-is
            atk = {
              atk: normalizedAtkBonus,
              diceCount: t.attack.diceCount || '',
              dieType: t.attack.dieType || 'd6',
              dmgBonus: t.attack.dmgBonus || '',
              dmgType: t.attack.dmgType || '',
              additionalDiceCount: t.attack.additionalDiceCount || '',
              additionalDieType: t.attack.additionalDieType || '',
              additionalDmgType: t.attack.additionalDmgType || '',
              showAdditional: t.attack.showAdditional || false,
              altDiceCount: t.attack.altDiceCount || '',
              altDieType: t.attack.altDieType || '',
              altDmgBonus: t.attack.altDmgBonus || '',
              altDmgType: t.attack.altDmgType || '',
              showAlternate: t.attack.showAlternate || false
            }
          }
        }

        // Parse from description text - always run if desc is available
        // Use t.desc (NPC format) or t.text (Monster format)
        // Description text is the most reliable source for attack bonus and damage type
        const descText = t.desc || t.text
        const textParsed = window.parseAttackFromText && descText
          ? window.parseAttackFromText(descText)
          : null

        if (atk && textParsed) {
          // Always use text-parsed atk if available (description is most reliable)
          if (textParsed.atk) {
            atk.atk = textParsed.atk
          }
          // Only fill in missing damage fields from text (don't override parsed dmg)
          if (!atk.diceCount && textParsed.diceCount) {
            atk.diceCount = textParsed.diceCount
          }
          if (!atk.dieType && textParsed.dieType) {
            atk.dieType = textParsed.dieType
          }
          if (!atk.dmgBonus && textParsed.dmgBonus) {
            atk.dmgBonus = textParsed.dmgBonus
          }
          // Always use text-parsed dmgType (often missing from dmg string)
          if (textParsed.dmgType) {
            atk.dmgType = textParsed.dmgType
          }
          // Copy alternate damage fields if present
          if (textParsed.altDiceCount) {
            atk.altDiceCount = textParsed.altDiceCount
            atk.altDieType = textParsed.altDieType
            atk.altDmgBonus = textParsed.altDmgBonus
            atk.altDmgType = textParsed.altDmgType
            atk.showAlternate = true

            // FIX: Prevent double-counting - if additional damage matches alternate damage, clear additional
            // This happens when parseDamageString() extracts "or 3d4" as additional dice
            if (atk.altDiceCount === atk.additionalDiceCount &&
                atk.altDieType === atk.additionalDieType) {
              atk.additionalDiceCount = ''
              atk.additionalDieType = ''
              atk.additionalDmgType = ''
              atk.showAdditional = false
            }
          }
        }
      } else if (hasAttack && !t.attack) {
        // No attack object at all - try to create one from description text
        const descText = t.desc || t.text
        if (descText && window.parseAttackFromText) {
          const parsed = window.parseAttackFromText(descText)
          if (parsed && (parsed.atk || parsed.diceCount)) {
            atk = {
              atk: parsed.atk || '+0',
              diceCount: parsed.diceCount || '',
              dieType: parsed.dieType || 'd6',
              dmgBonus: parsed.dmgBonus || '',
              dmgType: parsed.dmgType || '',
              additionalDiceCount: parsed.additionalDiceCount || '',
              additionalDieType: parsed.additionalDieType || '',
              additionalDmgType: parsed.additionalDmgType || '',
              showAdditional: (parsed.additionalDiceCount || '') !== '',
              altDiceCount: parsed.altDiceCount || '',
              altDieType: parsed.altDieType || '',
              altDmgBonus: parsed.altDmgBonus || '',
              altDmgType: parsed.altDmgType || '',
              showAlternate: parsed.altDiceCount ? true : false
            }

            // FIX: Prevent double-counting - if additional damage matches alternate damage, clear additional
            if (atk.altDiceCount === atk.additionalDiceCount &&
                atk.altDieType === atk.additionalDieType &&
                atk.altDiceCount !== '') {
              atk.additionalDiceCount = ''
              atk.additionalDieType = ''
              atk.additionalDmgType = ''
              atk.showAdditional = false
            }
          }
        }
      }

      // Normalize output - use 'desc' field consistently (handles both t.text and t.desc input)
      return {
        id: t.id || 'mbe_'+Math.random().toString(36).slice(2),
        name: t.name||'',
        desc: t.desc || t.text || '',
        limitedUsage: lu,
        attack: atk
      }
    })
  }

  d.traits = parseEntries(m.traits, false)
  d.actions = parseEntries(m.actions, true)
  d.reactions = parseEntries(m.reactions, true)
  d.legendaryActions = parseEntries(m.legendaryActions, true)
  d.lairActions = parseEntries(m.lairActions, true)
  d.bonusActions = parseEntries(m.bonusActions, true)

  if (m.slots) {
    m.slots.split(',').forEach((v,i) => { if (i<9) d.spellSlots[i] = parseInt(v)||0 })
  }


  // For old format monsters, check if spellcasting trait has slot info
  if (m.spells && !m.slots && m.traits) {
    const spellcastingTrait = m.traits.find(t => t.name && /spellcast/i.test(t.name))
    if (spellcastingTrait) {
    }
  }

  function findSpell(name) {
    return (compendiumData.spells||[]).find(s => s.name.toLowerCase()===name.toLowerCase())
  }

  const addedSpells = new Set() // Track to avoid duplicates

  if (m.spellsAtWill) {
    m.spellsAtWill.split(',').forEach(raw => {
      const sp = findSpell(raw.trim())
      if (sp && !addedSpells.has(sp.name.toLowerCase())) {
        d.selectedSpells.push({name:sp.name, level:sp.level, usage:'atwill'})
        addedSpells.add(sp.name.toLowerCase())
      }
    })
  }
  if (m.spellsDaily) {
    m.spellsDaily.split(',').forEach(raw => {
      const [n, cnt] = raw.trim().split(':')
      const sp = findSpell(n.trim())
      if (sp && !addedSpells.has(sp.name.toLowerCase())) {
        d.selectedSpells.push({name:sp.name, level:sp.level, usage:'daily', dailyCount:parseInt(cnt)||1})
        addedSpells.add(sp.name.toLowerCase())
      }
    })
  }
  if (m.spells) {
    m.spells.split(',').forEach(raw => {
      const sp = findSpell(raw.trim())
      if (sp && !addedSpells.has(sp.name.toLowerCase())) {
        // Check if this spell has a matching action with recharge/daily uses
        const spellAction = m.actions?.find(a => a.name === sp.name && a.recharge)
        if (spellAction && spellAction.recharge) {
          // This is a X/day spell (2024 format)
          d.selectedSpells.push({name:sp.name, level:sp.level, usage:'daily', dailyCount:spellAction.recharge})
        } else {
          // Traditional slot spell (old format)
          d.selectedSpells.push({name:sp.name, level:sp.level, usage:'slot'})
        }
        addedSpells.add(sp.name.toLowerCase())
      }
    })
  }


  // Parse spellcasting trait/action for spell slots and additional spells
  // For old format: m.spells has spell names but no slot counts - need to parse trait text
  // For new format: no m.spells, need to parse everything from trait text
  const needSlotInfo = m.spells && !m.slots // Old format with spells but no slot counts
  const needSpells = d.selectedSpells.length === 0 // No spells found yet

  if (needSlotInfo || needSpells) {
    function scanForSpells(entries, label) {
      if (entries && entries.length > 0) {
      }
      if (!entries) return false
      const spellcastingEntry = entries.find(e =>
        e.name && /spellcast|innate/i.test(e.name)
      )
      if (!spellcastingEntry) return false
      if (!spellcastingEntry.desc) return false
      const text = spellcastingEntry.desc
      const lines = text.split('\n')

      for (const raw of lines) {
        const line = raw.trim()

        // Extract slot counts: "3rd level (6 slots)" or "1st level (4 slots)"
        const slotCount = line.match(/^(\d+)(?:st|nd|rd|th)\s+level\s*\((\d+)\s+slots?\)/i)
        if (slotCount) {
          const level = parseInt(slotCount[1])
          const count = parseInt(slotCount[2])
          if (level >= 1 && level <= 9) {
            d.spellSlots[level - 1] = count
          }
        }

        // Cantrips (at will): fire bolt, light
        const cantrip = line.match(/^cantrips?\s*\([^)]*\)\s*:\s*(.+)/i)
        if (cantrip) {
          cantrip[1].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
            .forEach(name => {
              const sp = findSpell(name)
              if (sp && !addedSpells.has(sp.name.toLowerCase())) {
                d.selectedSpells.push({name: sp.name, level: sp.level, usage: 'atwill'})
                addedSpells.add(sp.name.toLowerCase())
              }
            })
          continue
        }

        // At will: dancing lights
        const atWill = line.match(/^at will\s*:\s*(.+)/i)
        if (atWill) {
          atWill[1].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
            .forEach(name => {
              const sp = findSpell(name)
              if (sp && !addedSpells.has(sp.name.toLowerCase())) {
                d.selectedSpells.push({name: sp.name, level: sp.level, usage: 'atwill'})
                addedSpells.add(sp.name.toLowerCase())
              }
            })
          continue
        }

        // 3/day each: darkness, faerie fire
        const dayEach = line.match(/^(\d+)\/day each\s*:\s*(.+)/i)
        if (dayEach) {
          const count = parseInt(dayEach[1])
          dayEach[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
            .forEach(name => {
              const sp = findSpell(name)
              if (sp) d.selectedSpells.push({name: sp.name, level: sp.level, usage: 'daily', dailyCount: count})
            })
          continue
        }

        // 1/day: misty step
        const day = line.match(/^(\d+)\/day\s*:\s*(.+)/i)
        if (day) {
          const count = parseInt(day[1])
          day[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
            .forEach(name => {
              const sp = findSpell(name)
              if (sp) d.selectedSpells.push({name: sp.name, level: sp.level, usage: 'daily', dailyCount: count})
            })
          continue
        }

        // 1st level (4 slots): detect magic, shield
        const slotted = line.match(/^(\d+)(?:st|nd|rd|th)\s+level\s*\([^)]*\)\s*:\s*(.+)/i)
        if (slotted) {
          slotted[2].split(',').map(s => s.replace(/\*+$/, '').trim()).filter(Boolean)
            .forEach(name => {
              const sp = findSpell(name)
              if (sp) d.selectedSpells.push({name: sp.name, level: sp.level, usage: 'slot'})
            })
        }
      }

      return true
    }

    // Check traits (older format)
    scanForSpells(d.traits, 'traits')
    // Check actions (2024 format)
    scanForSpells(d.actions, 'actions')
  }

  return d
}

function mbBuildCompendiumEntry(d) {
  const conBonus = mbMod(d.con) * d.hitDiceCount
  const conStr = conBonus === 0 ? '' : (conBonus > 0 ? ` + ${conBonus}` : ` - ${Math.abs(conBonus)}`)

  function entryToBlob(e) {
    return {
      name: e.name, text: e.desc,
      charges: e.limitedUsage.type === 'per_day' ? e.limitedUsage.count : null,
      chargesCurrent: e.limitedUsage.type === 'per_day' ? e.limitedUsage.count : null,
      recharge: mbRechargeNum(e.limitedUsage),
    }
  }
  function actionToBlob(e) {
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
      altDmgType: e.attack.altDmgType || ''
      // showAdditional and showAlternate removed - UI state, not data
    } : null

    // Preserve dmg field if it exists (for backward compatibility and re-parsing)
    if (attackObj && e.attack.dmg) {
      attackObj.dmg = e.attack.dmg
    }

    return {
      ...entryToBlob(e),
      attack: attackObj,
    }
  }

  return {
    _custom: true,
    _draft: JSON.parse(JSON.stringify(d)),
    portrait: d.portrait,
    name: d.name || 'Unnamed Monster',
    tag: d.tag||'',
    homebrew: d.homebrew||false,
    thirdParty: d.thirdParty||false,
    source: d.source||'',
    size: d.size, type: d.type,
    alignment: (d.alignmentTypically ? 'Typically ' : '') + (d.alignment||''),
    ac: d.acModifier && d.acModifier !== '—'
      ? `${d.acValue} (${d.acModifier})`
      : String(d.acValue),
    armor: d.armor||'',
    hp: `${d.hpValue} (${d.hitDiceCount}${d.hitDiceSize}${conStr})`,
    speed: mbSpeedStr(d.speedEntries || [{type:'Walk',ft:30}]),
    initiativeBonus: d.initiativeBonus,
    proficiencyBonus: d.proficiencyBonus||0,
    str: String(d.str), dex: String(d.dex), con: String(d.con),
    int: String(d.int), wis: String(d.wis), cha: String(d.cha),
    save: (d.savingThrows || []).map(s => `${s.ability[0]}${s.ability.slice(1).toLowerCase()} ${mbSignedNum(s.modifier)}`).join(', '),
    skill: (d.skills || []).map(s => `${s.name} ${mbSignedNum(s.modifier)}`).join(', '),
    savingThrows: d.savingThrows || [], // Preserve array format for builder
    skills: d.skills || [], // Preserve array format for builder
    vulnerable: (d.vulnerable||[]).join(', '),
    resist: (d.resist||[]).join(', '),
    immune: (d.immune||[]).join(', '),
    conditionImmune: (d.conditionImmune||[]).join(', '),
    senses: d.senses,
    passive: d.passive||'', languages: d.languages, cr: d.cr,
    traits: (d.traits || []).map(entryToBlob),
    actions: (d.actions || []).map(actionToBlob),
    reactions: (d.reactions || []).map(actionToBlob),
    legendaryActions: (d.legendaryActions || []).map(actionToBlob),
    lairActions: (d.lairActions || []).map(actionToBlob),
    bonusActions: (d.bonusActions || []).map(actionToBlob),
    spellsAtWill: (d.selectedSpells||[]).filter(s=>s&&s.usage==='atwill').map(s=>s.name).join(','),
    spellsDaily:  (d.selectedSpells||[]).filter(s=>s&&s.usage==='daily')
                    .map(s=>`${s.name}:${s.dailyCount||1}`).join(','),
    spells: (d.selectedSpells||[]).filter(s=>s&&s.usage==='slot').map(s=>s.name).join(','),
    slots: (d.spellSlots||[0,0,0,0,0,0,0,0,0]).join(','),
    spellSaveDC: d.spellSaveDC,
    spellAttackMod: d.spellAttackMod,
    environments: d.environments || [],
    description: d.description,
  }
}

// ── Entry points ──────────────────────────────────────────────────
function openMonsterBuilder(name) {
  // Preserve encounter-only mode if it was set before calling
  const preserveEncounterMode = mb.encounterOnlyMode

  if (typeof pushNav === 'function') {
    pushNav('monster-builder', name)
  } else if (typeof window.currentScreen !== 'undefined') {
    window.currentScreen = { screen: 'monster-builder', uid: name }
  }

  if (name) {
    // Editing existing monster - go straight to form
    const m = compendiumData.monsters.find(x => x.name === name)
    if (!m) return
    mb.draft = mbFromCompendium(m)
    mb.originalName = m.name
    mb.editingMonster = m  // Store reference to the exact monster being edited
    mb.step = 'form'
    // Auto-fill proficiency bonus from CR
    mb.draft.proficiencyBonus = mbProficiencyFromCR(mb.draft.cr || '1')
  } else {
    // Creating new - show choice screen
    mb.step = 'choice'
    mb.draft = null
    mb.originalName = null
  }

  mb.dirty = false; mb.stPickerOpen = false; mb.skillPickerOpen = false
  mb.editingEntry = null; mb.spellPickerOpen = false; mb.spellPickerQuery = ''
  mb.spellPendingName = null; mb.spellPendingLevel = null
  mb.dragSect = null; mb.dragIdx = null; mb.monsterPickerOpen = false
  mb.monsterPickerQuery = ''

  // Restore encounter-only mode if it was set
  if (preserveEncounterMode) {
    mb.encounterOnlyMode = true
  }

  // Nav buttons are now styled purely by their images, no dynamic styling needed
  const content = document.getElementById('content')
  content.style.padding = '0'
  content.style.overflow = 'auto'
  content.style.overflowY = 'auto'
  renderMonsterBuilder()
}

// ── Choice Screen ─────────────────────────────────────────────────
function renderMonsterBuilderChoice() {
  const content = document.getElementById('content')
  if (!content) return
  content.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:40px 20px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h2 style="font-size:24px;color:#e0d5c5;margin-bottom:8px;">Create Monster</h2>
        <p style="font-size:14px;color:#C8C8C8;">Choose how to create your monster</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div onclick="mbStartScratch()"
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

        <div onclick="mbShowMonsterPicker()"
          style="background:#5C5C5C;border:4px solid #2E2F2D;padding:28px 20px;border-radius:8px;
                 cursor:pointer;text-align:center;transition:border-color .2s;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;gap:12px;"
          onmouseover="this.style.background='#6E6E6E'"
          onmouseout="this.style.background='#5C5C5C'">
          <img src="assets/Copy_Existing_Creature.png" alt="Copy Existing"
            style="max-width:100%;max-height:200px;object-fit:contain;" />
          <div style="font-family:var(--app-font);font-size:14px;color:#e0d5c5;">
            Copy existing creature
          </div>
        </div>
      </div>

      <div style="text-align:center;">
        <button onclick="if(typeof popNav==='function')popNav();else showSection('monsters')" style="${MBS.btnSecondary}">
          Cancel
        </button>
      </div>
    </div>
  `
}

function mbStartScratch() {
  mb.step = 'form'
  mb.draft = mbDefaultDraft()
  mb.originalName = null
  mb.dirty = false

  // Auto-fill initiative bonus from DEX
  const dex = parseInt(mb.draft.dex) || 10
  mb.draft.initiativeBonus = Math.floor((dex - 10) / 2)

  // Auto-fill proficiency bonus from CR
  mb.draft.proficiencyBonus = mbProficiencyFromCR(mb.draft.cr || '1')

  renderMonsterBuilder()
}

function mbShowMonsterPicker() {
  mb.monsterPickerOpen = true
  mb.monsterPickerQuery = ''
  renderMonsterBuilder()
}

function renderMonsterPicker() {
  const content = document.getElementById('content')
  if (!content) return
  content.style.padding = '24px 24px 24px 240px'
  content.style.overflow = 'auto'

  // Only render static UI (header, input) once
  const existingContainer = document.getElementById('mb-monster-picker-container')
  if (!existingContainer) {
    content.innerHTML = `
      <div id="mb-monster-picker-container">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <button onclick="mbCancelMonsterPicker()" style="${MBS.btnSecondary}padding:6px 14px;">
            &#8592; Back
          </button>
          <h2 style="flex:1;font-size:20px;color:#e0d5c5;margin:0;">
            Select Monster to Copy
          </h2>
        </div>

        <input id="mb-monster-search" type="text" placeholder="Search monsters…"
          value="${mb.monsterPickerQuery}"
          oninput="mbFilterMonsterPicker(this.value)"
          style="width:100%;max-width:500px;padding:8px 12px;margin-bottom:16px;background:#5C5C5C;
                 border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
                 border-radius:4px;font-size:14px;display:block;" />

        <div id="mb-monster-results"></div>
      </div>
    `
  }

  // Always update the results (only re-renders the results list)
  mbUpdateMonsterResults()
}

function mbUpdateMonsterResults() {
  const resultsEl = document.getElementById('mb-monster-results')
  if (!resultsEl) return

  const filtered = mb.monsterPickerQuery
    ? compendiumData.monsters.filter(m => m.name.toLowerCase().includes(mb.monsterPickerQuery.toLowerCase()))
    : compendiumData.monsters

  resultsEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;overflow:hidden;">
      ${filtered.length === 0
        ? '<p style="color:#C8C8C8;grid-column:1/-1;">No monsters match that search.</p>'
        : filtered.map((m, idx) => {
          const displaySize = window.expandSize ? window.expandSize(m.size) : m.size
          return `
          <div onclick="mbSelectMonsterByIndex(${idx})"
            style="background:#262F35;border:1px solid #2E2F2D;padding:12px;border-radius:4px;cursor:pointer;"
            onmouseover="this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.borderColor='#2E2F2D'">
            <div style="font-weight:bold;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#7B9BA8;">
              ${m.name}
            </div>
            <div style="font-size:12px;color:#C8C8C8;">CR ${m.cr || '—'} · ${displaySize} ${m.type}</div>
          </div>
        `}).join('')}
    </div>
  `
}

function mbSelectMonsterByIndex(idx) {
  const filtered = mb.monsterPickerQuery
    ? compendiumData.monsters.filter(m => m.name.toLowerCase().includes(mb.monsterPickerQuery.toLowerCase()))
    : compendiumData.monsters

  const m = filtered[idx]
  if (!m) return

  mbSelectMonster(m.name)
}

function mbCancelMonsterPicker() {
  mb.monsterPickerOpen = false
  renderMonsterBuilder()
}

function mbFilterMonsterPicker(query) {
  mb.monsterPickerQuery = query
  mbUpdateMonsterResults()
}

function mbSelectMonster(name) {
  const m = compendiumData.monsters.find(x => x.name === name)
  if (!m) return

  mb.step = 'form'
  mb.draft = mbFromCompendium(m)
  mb.originalName = null  // null so it saves as new monster
  mb.monsterPickerOpen = false
  mb.dirty = false

  // Auto-fill initiative bonus
  if (!mb.draft.initiativeBonus || mb.draft.initiativeBonus === 0) {
    const dex = parseInt(mb.draft.dex) || 10
    mb.draft.initiativeBonus = Math.floor((dex - 10) / 2)
  }

  // Auto-fill proficiency bonus from CR
  mb.draft.proficiencyBonus = mbProficiencyFromCR(mb.draft.cr || '1')

  renderMonsterBuilder()
}

// ── Main render ───────────────────────────────────────────────────
function renderMonsterBuilder() {
  const content = document.getElementById('content')
  if (!content) return

  if (mb.monsterPickerOpen) {
    renderMonsterPicker()
    return
  }

  if (mb.step === 'choice') {
    renderMonsterBuilderChoice()
    return
  }

  if (!mb.draft) {
    return
  }
  const d = mb.draft
  content.innerHTML = `
    <div style="min-height:100%;background:linear-gradient(#5C5C5C 40px, transparent 40px),
                linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                url('assets/Background.png') left -40px/1641px auto no-repeat fixed;">
      <div style="display:flex;align-items:center;gap:12px;
           padding:16px 20px 12px 20px;background:#5C5C5C;border-bottom:4px solid #2E2F2D;
           flex-shrink:0;padding-left:240px;box-sizing:border-box;">
        <button onclick="mbBack()" style="${MBS.btnSecondary}padding:6px 14px;">&#8592; Back</button>
        <div style="flex:1;text-align:center;">
          <span id="mb-title" style="font-size:15px;font-weight:bold;color:#e0d5c5;font-family:var(--app-font);">
            ${mbEsc(d.name) || 'New Monster'}
          </span>
        </div>
        <button onclick="mbSave()" style="${MBS.btnPrimary}">${mb.encounterOnlyMode ? 'Add to Encounter' : 'Save'}</button>
      </div>
      <div style="max-width:800px;margin:0 auto;padding:20px 24px 40px;">
        <div style="${MBS.card}">${mbRenderHeader()}</div>
        <div style="${MBS.card}"><div id="mb-combat-section">${mbRenderCombat()}</div></div>
        ${mbCardWrap('SPEED', `<div id="mb-speed-section">${mbRenderSpeedPicker()}</div>`)}
        ${mbCardWrap('ABILITY SCORES', mbRenderAbilityScores())}
        ${mbCardWrap('SAVING THROWS', `<div id="mb-sect-ST" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'savingThrows')">${mbRenderSavingThrows()}</div>`)}
        ${mbCardWrap('SKILLS', `<div id="mb-sect-Skills" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'skills')">${mbRenderSkills()}</div>`)}
        ${mbCardWrap('DAMAGE VULNERABILITIES / RESISTANCES / IMMUNITIES', mbRenderDamageTypes())}
        ${mbCardWrap('CONDITION IMMUNITIES', mbRenderCondImmune())}
        ${mbCardWrap('SENSES &amp; PASSIVE PERCEPTION', mbRenderSenses())}
        ${mbCardWrap('LANGUAGES', mbRenderLanguages())}
        ${mbCardWrap('TRAITS', `<div id="mb-sect-traits" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'traits')">${mbRenderAbilityGroup('traits', false)}</div>`)}
        ${mbCardWrap('ACTIONS', `<div id="mb-sect-actions" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'actions')">${mbRenderAbilityGroup('actions', true)}</div>`)}
        ${mbCardWrap('BONUS ACTIONS', `<div id="mb-sect-bonusActions" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'bonusActions')">${mbRenderAbilityGroup('bonusActions', true)}</div>`)}
        ${mbCardWrap('REACTIONS', `<div id="mb-sect-reactions" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'reactions')">${mbRenderAbilityGroup('reactions', true)}</div>`)}
        ${mbCardWrap('LEGENDARY ACTIONS', `<div id="mb-sect-legendaryActions" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'legendaryActions')">${mbRenderAbilityGroup('legendaryActions', true)}</div>`)}
        ${mbCardWrap('LAIR ACTIONS', `<div id="mb-sect-lairActions" data-section-container ondragover="event.preventDefault()" ondrop="mbDrop(event,'lairActions')">${mbRenderAbilityGroup('lairActions', true)}</div>`)}
        ${mbCardWrap('SPELLS', `<div id="mb-sect-Spells">${mbRenderSpells()}</div>`)}
        ${mbCardWrap('ENVIRONMENT', mbRenderEnvironments())}
        ${mbCardWrap('DESCRIPTION', mbRenderDescription())}

        <!-- Delete Button (only when editing existing monster) -->
        ${mb.originalName ? `
          <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #2E2F2D;">
            <button onclick="mbDelete()"
              style="background:#3E1A1A;color:#E85D75;border:2px solid #5E2A2A;padding:10px 24px;
                     border-radius:4px;cursor:pointer;font-family:var(--app-font);font-size:13px;
                     font-weight:600;"
              onmouseover="this.style.background='#5E2A2A';this.style.borderColor='#E85D75'"
              onmouseout="this.style.background='#3E1A1A';this.style.borderColor='#5E2A2A'">
              Delete Monster
            </button>
          </div>
        ` : ''}

      </div>
    </div>
  `
}

function mbCardWrap(title, body) {
  return `<div style="${MBS.card}"><div style="${MBS.cardHeader}">${title}</div>${body}</div>`
}

// ── Drum-roll picker ─────────────────────────────────────────────
//
// mbDrumPicker(id, items, selected, onChange, width?)
//   items  : string[] | {value, label}[]
//   onChange: function(value) called whenever selection changes
//   width  : CSS width string, e.g. '62px', '100%', or omit for auto
//
function mbDrumPicker(id, items, selectedValue, onChange, width, scale = 1.0) {
  const norm = items.map(it =>
    (typeof it === 'string' || typeof it === 'number')
      ? {value: it, label: String(it)}
      : it
  )
  let idx = norm.findIndex(it => String(it.value) === String(selectedValue))
  if (idx < 0) idx = 0
  // Preserve _lastWheel across re-renders so the throttle gate is never reset.
  // Speed pickers re-render on every onChange; without this, _lastWheel would be
  // wiped and momentum events would bypass the 250ms guard on the very next event.
  const _lastWheel = mbDrumState[id] ? (mbDrumState[id]._lastWheel || 0) : 0
  mbDrumState[id] = {items: norm, idx, onChange, elSlots: [-1,0,1], _lastWheel, scale}

  const IH = 36           // item height px
  const H  = IH * 3       // visible window (3 items: -1, 0, +1)
  const bt = IH * 1       // band top offset
  const ws = width ? `width:${width};` : ''

  return `<div id="mbdrum-${id}"
    style="position:relative;height:${H}px;overflow:hidden;border-radius:6px;
           background:#1A1C1E;border:1px solid #2E2F2D;${ws}
           cursor:ns-resize;user-select:none;box-sizing:border-box;"
    onwheel="event.preventDefault();event.stopPropagation();mbDrumWheel('${id}',event)">
    <div style="position:absolute;inset:0;pointer-events:none;z-index:4;">
      <div style="position:absolute;top:0;left:0;right:0;height:${bt}px;
                  background:linear-gradient(to bottom,#1A1C1E 18%,rgba(26,28,30,.72) 65%,transparent);"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:${bt}px;
                  background:linear-gradient(to top,#1A1C1E 18%,rgba(26,28,30,.72) 65%,transparent);"></div>
      <div style="position:absolute;top:${bt}px;left:5px;right:5px;height:${IH}px;
                  background:rgba(69,135,162,.14);
                  border-top:1px solid rgba(69,135,162,.6);
                  border-bottom:1px solid rgba(69,135,162,.6);
                  border-radius:2px;"></div>
    </div>
    <div id="mbdrum-items-${id}" style="position:relative;z-index:2;">
      ${mbDrumItems(id)}
    </div>
  </div>`
}

function mbDrumItems(id) {
  const state = mbDrumState[id]
  if (!state) return ''
  const {items, idx} = state
  const IH = 36, half = 1
  // Reset ring so elSlots[k] == d for element k after a full re-render
  state.elSlots = [-1, 0, 1]
  let out = ''
  for (let k = 0; k < 3; k++) {
    const d     = k - half                // k=0→d=-1, k=1→d=0, k=2→d=+1
    const item  = items[idx + d]
    const label = item ? mbEsc(String(item.label)) : ''
    const a     = Math.abs(d)
    const angle   = d * 30
    const scaleY  = a === 0 ? 1 : 0.84
    const opacity = a === 0 ? 1 : 0.60
    const color   = a === 0 ? '#e0d5c5' : '#5e7490'
    const fw      = a === 0 ? '600'     : '400'
    const sc      = state.scale || 1.0
    const fs      = a === 0 ? `${Math.round(13*sc)}px` : `${Math.round(12*sc)}px`
    out += `<div id="mbdrum-item-${id}-${k}" onclick="mbDrumClick('${id}',${d})"
      style="position:absolute;top:${(half+d)*IH}px;left:0;right:0;height:${IH}px;
             display:flex;align-items:center;justify-content:center;padding:0 7px;
             font-family:var(--app-font);font-size:${fs};font-weight:${fw};color:${color};
             opacity:${opacity};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
             transform:perspective(500px) rotateX(${angle}deg) scaleY(${scaleY});
             transform-origin:center center;cursor:${a===0?'default':'pointer'};"
    >${label}</div>`
  }
  return out
}

// Update one element's visual slot (d = -2…+2 for visible, ±3 for off-screen).
// withTransition=false is used for the instant teleport before an animation frame.
function mbDrumApplySlot(id, k, d, withTransition) {
  const el = document.getElementById('mbdrum-item-' + id + '-' + k)
  if (!el) return
  const IH = 36, half = 1
  const a = Math.abs(d)
  const angle   = d * 30
  const scaleY  = a === 0 ? 1 : a === 1 ? 0.84 : 0.50
  const opacity = a <= half ? (a === 0 ? 1 : 0.60) : 0
  const color   = a === 0 ? '#e0d5c5' : '#5e7490'
  const fw      = a === 0 ? '600' : '400'
  const sc      = (mbDrumState[id] && mbDrumState[id].scale) || 1.0
  const fs      = a === 0 ? `${Math.round(13*sc)}px` : `${Math.round(12*sc)}px`
  el.style.transition = withTransition
    ? 'transform 400ms cubic-bezier(0.165,0.84,0.44,1.0), opacity 400ms cubic-bezier(0.165,0.84,0.44,1.0), color 400ms cubic-bezier(0.165,0.84,0.44,1.0)'
    : 'none'
  el.style.top       = ((half + d) * IH) + 'px'
  el.style.transform = `perspective(500px) rotateX(${angle}deg) scaleY(${scaleY})`
  el.style.opacity   = String(opacity)
  el.style.color     = color
  el.style.fontWeight = fw
  el.style.fontSize  = fs
  el.style.cursor    = d !== 0 ? 'pointer' : 'default'
  // Keep onclick current so clicking always moves exactly 1 step toward center
  el.onclick = d !== 0 ? function() { mbDrumStep(id, Math.sign(d)) } : null
}

// Animate one scroll step. ni = new index after the step.
function mbDrumAnimate(id, step, ni) {
  const s = mbDrumState[id]
  if (!s || !s.elSlots) return
  const half = 1
  // The element that scrolls off the visible edge
  const exitD     = step > 0 ? -half       : +half        // d=-1 (top) when scrolling down
  // Where that element starts its animation from (just off the opposite edge)
  const incomingD = step > 0 ? +(half + 1) : -(half + 1)  // d=+2 or d=-2
  // Where it ends up after the animation
  const finalD    = step > 0 ? +half       : -half        // d=+1 or d=-1

  const exitK = s.elSlots.indexOf(exitD)
  if (exitK < 0) return

  // Content the recycled element will show in its new position
  const newItemIdx = ni + step * half
  const newItem = (newItemIdx >= 0 && newItemIdx < s.items.length) ? s.items[newItemIdx] : null

  // Phase 1 — instant teleport: no transition, move to off-screen entry point, load new text
  mbDrumApplySlot(id, exitK, incomingD, false)
  const exitEl = document.getElementById('mbdrum-item-' + id + '-' + exitK)
  if (exitEl) {
    exitEl.textContent = newItem ? newItem.label : ''
    void exitEl.offsetHeight  // force reflow so the browser records the off-screen position
  }

  // Phase 2 — animated move: all elements slide to their new slots
  for (let k = 0; k < 3; k++) {
    s.elSlots[k] = (k === exitK) ? finalD : s.elSlots[k] - step
    mbDrumApplySlot(id, k, s.elSlots[k], true)
  }
}

// Common scroll step: bounds-check, animate, update state, fire onChange.
function mbDrumStep(id, step) {
  const s = mbDrumState[id]
  if (!s) return
  const ni = Math.max(0, Math.min(s.items.length - 1, s.idx + step))
  if (ni === s.idx) return
  mbDrumAnimate(id, step, ni)
  s.idx = ni
  if (s.onChange) s.onChange(s.items[s.idx].value)
}

function mbDrumWheel(id, event) {
  event.preventDefault()
  const s = mbDrumState[id]
  if (!s) return
  // Ignore inertia/momentum tail events — they have very small deltaY values.
  if (Math.abs(event.deltaY) < 5) return
  // 250 ms gate: trackpads fire many events per physical tick; only the first
  // event in each window advances the drum by exactly one step.
  const now = Date.now()
  if (now - (s._lastWheel || 0) < 100) return
  s._lastWheel = now
  mbDrumStep(id, event.deltaY > 0 ? 1 : -1)
}

function mbDrumClick(id, offset) {
  if (!offset) return
  // Always move exactly one step toward the clicked item.
  mbDrumStep(id, Math.sign(offset))
}

// ── Section renders ───────────────────────────────────────────────
function mbRenderHeader() {
  const d = mb?.draft || {}
  const crItems = MB_CR_TABLE.map(e => ({value: e.cr, label: `${e.cr} (${e.xp.toLocaleString()} XP)`}))
  const crVal   = (d.cr && MB_CR_TABLE.find(e => e.cr === d.cr)) ? d.cr : '0'
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
        <div>
          <label style="${MBS.label}">NAME</label>
          <input value="${mbEsc(d.name)}" placeholder="Creature name…"
            onchange="mb.draft.name=this.value;mb.dirty=true;const t=document.getElementById('mb-title');if(t)t.textContent=this.value||'New Monster'"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:126px 117px 244px;gap:8px;align-items:start;">
          <div>
            <label style="${MBS.label}">CR</label>
            ${mbDrumPicker('cr', crItems, crVal,
              v => { mb.draft.cr = v; mb.draft.proficiencyBonus = mbProficiencyFromCR(v); mb.dirty = true; mbUpdateProficiencyDisplay(); }, '100%')}
          </div>
          <div>
            <label style="${MBS.label}">SIZE</label>
            ${mbDrumPicker('size', MB_SIZES, d.size,
              v => { mb.draft.size = v; mb.dirty = true; }, '100%')}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;">
              <span style="font-size:10px;color:#4587A2;letter-spacing:.1em;font-weight:700;">ALIGNMENT</span>
              <div style="transform:scale(0.6);transform-origin:left center;">
                ${circleToggle('mb-alignment-typically', d.alignmentTypically, 'mbToggleAlignmentTypically()', 'Typically')}
              </div>
            </div>
            ${mbDrumPicker('alignment', MB_ALIGNMENTS, d.alignment || 'Neutral',
              v => { mb.draft.alignment = v; mb.dirty = true; if(window.npcb) npcb.dirty=true; }, '100%')}
          </div>
        </div>
        <div>
          <label style="${MBS.label}">TYPE</label>
          <input value="${mbEsc(d.type||'')}" placeholder="Humanoid, Beast, Swarm of Tiny Beasts, etc."
            onchange="mb.draft.type=this.value;mb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
        <div>
          <label style="${MBS.label}">TAG</label>
          <input value="${mbEsc(d.tag||'')}" placeholder="Demon, Slaad, Vampire, etc."
            onchange="mb.draft.tag=this.value;mb.dirty=true"
            style="${MBS.field}width:100%;box-sizing:border-box;">
        </div>
      </div>
    </div>
  `
}

function mbRenderCombat() {
  const d = mb?.draft || {}
  const hpInfo = mbHpDisplay(d)
  const sl = `font-size:10px;color:#C8C8C8;letter-spacing:.06em;margin-bottom:4px;`
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
        <div>
          <label style="${MBS.label}">PROFICIENCY BONUS</label>
          <div id="mb-proficiency-display" style="display:flex;align-items:center;justify-content:center;
                      background:#1A1C1E;border:1px solid #2E2F2D;border-radius:4px;
                      padding:7px 10px;font-size:13px;color:#e0d5c5;font-weight:600;
                      font-family:var(--app-font);width:60px;text-align:center;
                      box-sizing:border-box;">
            ${(d.proficiencyBonus||0) >= 0 ? '+' : ''}${d.proficiencyBonus||0}
          </div>
          <div style="font-size:9px;color:#7B9BA8;margin-top:3px;font-style:italic;text-align:center;">
            Auto (from CR)
          </div>
        </div>
      </div>
    </div>
  `
}

function mbRenderSpeedPicker() {
  const entries = mb?.draft?.speedEntries || [{type:'Walk',ft:30}]
  const ftItems = Array.from({length:60},(_,i)=>({value:(i+1)*5, label:`${(i+1)*5} ft.`}))
  const sl = `font-size:9px;color:#C8C8C8;letter-spacing:.05em;margin-bottom:3px;`
  const entryHtml = entries.map((e,i) => `
    <div style="display:flex;gap:6px;align-items:flex-end;flex-shrink:0;">
      <div>
        <div style="${sl}">TYPE</div>
        ${mbDrumPicker(`spd-type-${i}`, MB_SPEED_TYPES, e.type,
          v => { mbSpeedSetType(i, v) },
          '88px')}
      </div>
      <div>
        <div style="${sl}">FEET</div>
        ${mbDrumPicker(`spd-ft-${i}`, ftItems, e.ft,
          v => { mbSpeedSetFt(i, parseInt(v)) },
          '95px')}
      </div>
      ${entries.length > 1
        ? `<button onclick="mbSpeedRemove(${i})"
             style="background:none;border:none;color:#4587A2;cursor:pointer;font-size:18px;
                    padding:2px 4px;line-height:1;margin-bottom:3px;"
             title="Remove">&#8722;</button>`
        : ''}
    </div>
  `).join('')
  return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
      ${entryHtml}
      <div style="margin-bottom:3px;">
        <button onclick="mbSpeedAdd()" style="${MBS.btnSecondarySmall}">+ Add</button>
      </div>
    </div>
  `
}

function mbSpeedSetType(idx, type) {
  if (!mb.draft.speedEntries[idx]) return
  mb.draft.speedEntries[idx].type = type
  mb.dirty = true
  mb.draft.speed = mbSpeedStr(mb.draft.speedEntries)
  const el = document.getElementById('mb-speed-section')
  if (el) el.innerHTML = mbRenderSpeedPicker()
}
function mbSpeedSetFt(idx, ft) {
  if (!mb.draft.speedEntries[idx]) return
  mb.draft.speedEntries[idx].ft = ft
  mb.dirty = true
  mb.draft.speed = mbSpeedStr(mb.draft.speedEntries)
  const el = document.getElementById('mb-speed-section')
  if (el) el.innerHTML = mbRenderSpeedPicker()
}
function mbSpeedAdd() {
  mb.draft.speedEntries.push({type:'Walk', ft:30})
  mb.dirty = true
  const el = document.getElementById('mb-speed-section')
  if (el) el.innerHTML = mbRenderSpeedPicker()
}
function mbSpeedRemove(idx) {
  window.confirmDelete('Delete speed entry?', () => {
    mb.draft.speedEntries.splice(idx, 1)
    mb.dirty = true
    mb.draft.speed = mbSpeedStr(mb.draft.speedEntries)
    const el = document.getElementById('mb-speed-section')
    if (el) el.innerHTML = mbRenderSpeedPicker()
  })
}

function mbRenderAbilityScores() {
  const d = mb?.draft || {}
  const keys = ['str','dex','con','int','wis','cha']
  const labels = ['STR','DEX','CON','INT','WIS','CHA']
  return `
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;">
      ${keys.map((k,i) => `
        <div style="text-align:center;">
          <label style="${MBS.label}text-align:center;">${labels[i]}</label>
          <input type="number" value="${d[k]||10}" min="1" max="30"
            onchange="mb.draft['${k}']=parseInt(this.value)||10;mb.dirty=true;
              const el=document.getElementById('mb-mod-${k}');
              if(el)el.textContent=mbModStr(mb.draft['${k}']);
              if('${k}'==='con'){mbUpdateHpAvg();}
              if('${k}'==='dex'){mbUpdateInitiative();}
              if('${k}'==='wis'||'${k}'==='int'){if(window.pcbUpdatePassiveSenses)pcbUpdatePassiveSenses();}
              "
            style="${MBS.field}width:100%;text-align:center;">
          <div id="mb-mod-${k}" style="font-size:12px;color:#C8C8C8;margin-top:4px;">${mbModStr(d[k])}</div>
        </div>
      `).join('')}
    </div>
  `
}

function mbRenderSavingThrows() {
  const d = mb?.draft || {}
  let savingThrows = Array.isArray(d.savingThrows) ? d.savingThrows : []

  // Sort by standard D&D ability order: STR, DEX, CON, INT, WIS, CHA
  const ABILITY_ORDER = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  savingThrows = [...savingThrows].sort((a, b) => {
    const aName = typeof a.ability === 'number'
      ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][a.ability]
      : String(a.ability).toUpperCase()
    const bName = typeof b.ability === 'number'
      ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'][b.ability]
      : String(b.ability).toUpperCase()
    return ABILITY_ORDER.indexOf(aName) - ABILITY_ORDER.indexOf(bName)
  })

  return `
    ${savingThrows.length === 0
      ? `<div style="color:#C8C8C8;font-size:12px;margin-bottom:8px;font-style:italic;">No saving throws added.</div>`
      : savingThrows.map((st, i) => `
          <div data-drag-item="savingThrows" data-drag-idx="${i}"
            style="${MBS.itemRow}position:relative;">
            <span onmousedown="mbStartDrag(event,'savingThrows',${i})"
              style="color:#333;font-size:18px;user-select:none;line-height:1;cursor:grab;padding:0 4px;margin-left:-4px;">&#8801;</span>
            <span style="color:#4587A2;font-weight:bold;width:36px;font-size:13px;">${st.ability}</span>
            <span style="color:#e0d5c5;font-size:13px;">${mbSignedNum(st.modifier)}</span>
            <button onclick="mbRemoveSavingThrow(${i})"
              style="background:none;border:none;color:#4587A2;cursor:pointer;font-size:18px;
                     margin-left:auto;padding:0 4px;line-height:1;" title="Remove">&#8722;</button>
          </div>
        `).join('')
    }
    <div style="position:relative;display:inline-block;margin-top:6px;">
      <button onclick="mbToggleStPicker()"
        style="${MBS.btnSecondarySmall}">+ Add</button>
      ${mb.stPickerOpen ? mbRenderStPickerHtml() : ''}
    </div>
  `
}

function mbRenderStPickerHtml() {
  const added = mb.draft.savingThrows.map(s => s.ability)
  return `
    <div style="position:absolute;left:0;top:32px;z-index:200;background:#1A1C1E;
                border:1px solid #4587A2;border-radius:6px;padding:12px;
                display:flex;gap:14px;box-shadow:0 6px 24px rgba(0,0,0,.6);">
      <div>
        <div style="font-size:10px;color:#C8C8C8;letter-spacing:.08em;margin-bottom:6px;">ABILITY</div>
        <div id="mb-st-picker-list" style="max-height:168px;overflow-y:auto;">
          ${MB_ABILITIES_LIST.map(a => `
            <div onclick="mb.stPickerAbility='${a}';mbRefreshSection('savingThrows')"
              style="padding:5px 12px;cursor:pointer;border-radius:3px;font-size:13px;
                     color:${added.includes(a)?'#c9a87c':'#e0d5c5'};
                     background:${mb.stPickerAbility===a?'#1e3050':'transparent'};"
              onmouseover="this.style.background='#142840'" onmouseout="this.style.background='${mb.stPickerAbility===a?'#1e3050':'transparent'}'">
              ${a}
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:10px;color:#C8C8C8;letter-spacing:.08em;margin-bottom:6px;">MODIFIER</div>
        <div id="mb-st-mod-list" style="max-height:168px;overflow-y:auto;">
          ${Array.from({length:105},(_,i)=>i-5).map(n => `
            <div onclick="mb.stPickerMod=${n};mbRefreshSection('savingThrows')"
              style="padding:5px 12px;cursor:pointer;border-radius:3px;font-size:13px;
                     color:#e0d5c5;background:${mb.stPickerMod===n?'#1e3050':'transparent'};"
              onmouseover="this.style.background='#142840'" onmouseout="this.style.background='${mb.stPickerMod===n?'#1e3050':'transparent'}'">
              ${n>=0?'+'+n:n}
            </div>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:6px;">
        ${mb.stPickerAbility
          ? `<button onclick="mbAddSavingThrow('${mb.stPickerAbility}',${mb.stPickerMod})"
               style="${MBS.btnSmall}">Add</button>`
          : `<button disabled style="${MBS.btnSmall}opacity:.4;cursor:default;">Add</button>`}
        <button onclick="mbToggleStPicker()" style="${MBS.btnSecondarySmall}">Close</button>
      </div>
    </div>
  `
}

function mbRenderSkills() {
  const d = mb?.draft || {}
  const skills = Array.isArray(d.skills) ? d.skills.slice().sort((a, b) => a.name.localeCompare(b.name)) : []
  const originalSkills = Array.isArray(d.skills) ? d.skills : []
  return `
    ${skills.length === 0
      ? `<div style="color:#C8C8C8;font-size:12px;margin-bottom:8px;font-style:italic;">No skills added.</div>`
      : skills.map((sk) => {
          const i = originalSkills.findIndex(s => s.name === sk.name && s.modifier === sk.modifier)
          return `
          <div data-drag-item="skills" data-drag-idx="${i}"
            style="${MBS.itemRow}position:relative;">
            <span onmousedown="mbStartDrag(event,'skills',${i})"
              style="color:#333;font-size:18px;user-select:none;line-height:1;cursor:grab;padding:0 4px;margin-left:-4px;">&#8801;</span>
            <span style="color:#4587A2;font-weight:bold;flex:1;font-size:13px;">${mbEsc(sk.name)}</span>
            <span style="color:#e0d5c5;font-size:13px;">${mbSignedNum(sk.modifier)}</span>
            <button onclick="mbRemoveSkill(${i})"
              style="background:none;border:none;color:#4587A2;cursor:pointer;font-size:18px;
                     padding:0 4px;line-height:1;" title="Remove">&#8722;</button>
          </div>
        `
        }).join('')
    }
    <div style="position:relative;display:inline-block;margin-top:6px;">
      <button onclick="mbToggleSkillPicker()"
        style="${MBS.btnSecondarySmall}">+ Add</button>
      ${mb.skillPickerOpen ? mbRenderSkillPickerHtml() : ''}
    </div>
  `
}

function mbRenderSkillPickerHtml() {
  const added = mb.draft.skills.map(s => s.name)
  return `
    <div style="position:absolute;left:0;top:32px;z-index:200;background:#1A1C1E;
                border:1px solid #4587A2;border-radius:6px;padding:12px;
                display:flex;gap:14px;box-shadow:0 6px 24px rgba(0,0,0,.6);">
      <div>
        <div style="font-size:10px;color:#C8C8C8;letter-spacing:.08em;margin-bottom:6px;">SKILL</div>
        <div id="mb-skill-picker-list" style="max-height:200px;overflow-y:auto;width:150px;">
          ${MB_SKILLS_LIST.map(sk => `
            <div onclick="mb.skillPickerName='${mbEsc(sk)}';mbRefreshSection('skills')"
              style="padding:5px 10px;cursor:pointer;border-radius:3px;font-size:12px;
                     color:${added.includes(sk)?'#c9a87c':'#e0d5c5'};
                     background:${mb.skillPickerName===sk?'#1e3050':'transparent'};"
              onmouseover="this.style.background='#142840'" onmouseout="this.style.background='${mb.skillPickerName===sk?'#1e3050':'transparent'}'">
              ${sk}
            </div>
          `).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:10px;color:#C8C8C8;letter-spacing:.08em;margin-bottom:6px;">MODIFIER</div>
        <div id="mb-skill-mod-list" style="max-height:200px;overflow-y:auto;">
          ${Array.from({length:105},(_,i)=>i-5).map(n => `
            <div onclick="mb.skillPickerMod=${n};mbRefreshSection('skills')"
              style="padding:5px 12px;cursor:pointer;border-radius:3px;font-size:13px;
                     color:#e0d5c5;background:${mb.skillPickerMod===n?'#1e3050':'transparent'};"
              onmouseover="this.style.background='#142840'" onmouseout="this.style.background='${mb.skillPickerMod===n?'#1e3050':'transparent'}'">
              ${n>=0?'+'+n:n}
            </div>
          `).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:6px;">
        ${mb.skillPickerName
          ? `<button onclick="mbAddSkill('${mbEsc(mb.skillPickerName)}',${mb.skillPickerMod})"
               style="${MBS.btnSmall}">Add</button>`
          : `<button disabled style="${MBS.btnSmall}opacity:.4;cursor:default;">Add</button>`}
        <button onclick="mbToggleSkillPicker()" style="${MBS.btnSecondarySmall}">Close</button>
      </div>
    </div>
  `
}

// ── Tag picker ────────────────────────────────────────────────────
function mbRenderTagPickerInner(field, options) {
  const d = mb?.draft || {}
  const selected = Array.isArray(d[field]) ? d[field] : []
  const available = options.filter(o => !selected.includes(o))
  const optList = available.length === 0
    ? `<div style="padding:6px 8px;font-size:11px;color:#C8C8C8;font-style:italic;">All added</div>`
    : available.map(o => `
        <div data-tagoption="${mbEsc(o)}"
          onclick="mbAddTag('${field}','${mbEsc(o)}')"
          style="padding:5px 10px;cursor:pointer;font-size:12px;color:#7B9BA8;border-radius:3px;"
          onmouseover="this.style.background='#4587A2';this.style.color='#e0d5c5'"
          onmouseout="this.style.background='transparent';this.style.color='#7B9BA8'">
          ${mbEsc(o)}
        </div>`).join('')
  const chips = selected.length === 0 ? '' : selected.map((tag, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;
                 background:#1A1C1E;border:1px solid #4587A2;border-radius:3px;
                 padding:2px 7px;font-size:11px;color:#e0d5c5;">
      ${mbEsc(tag)}
      <button onclick="mbRemoveTag('${field}',${i})"
        style="background:none;border:none;color:#4587A2;cursor:pointer;
               font-size:14px;line-height:1;padding:0;"
        title="Remove">&#215;</button>
    </span>`).join('')
  return `
    <input placeholder="Filter…" oninput="mbFilterTagOptions('${field}',this.value)"
      style="${MBS.field}width:100%;box-sizing:border-box;padding:5px 8px;
             font-size:12px;margin-bottom:4px;background:#5C5C5C;border:4px solid #2E2F2D;color:#1E231A;">
    <div id="mb-tagopts-${field}"
      style="max-height:108px;overflow-y:auto;background:#1A1C1E;
             border:1px solid #2E2F2D;border-radius:4px;margin-bottom:6px;">
      ${optList}
    </div>
    <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">
      <input id="mb-custom-${field}" placeholder="Custom entry…"
        onkeydown="if(event.key==='Enter'){mbAddCustomTag('${field}');event.preventDefault()}"
        style="${MBS.field}flex:1;padding:4px 8px;font-size:11px;">
      <button onclick="mbAddCustomTag('${field}')"
        style="background:#4587A2;color:#e0d5c5;border:none;padding:4px 10px;
               cursor:pointer;border-radius:3px;font-size:11px;font-family:var(--app-font);
               line-height:1.2;">
        +
      </button>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;min-height:18px;">
      ${chips || '<span style="font-size:11px;color:#C8C8C8;font-style:italic;">None selected</span>'}
    </div>`
}

function mbRenderTagPicker(field, options) {
  return `<div id="mb-tagpicker-${field}">${mbRenderTagPickerInner(field, options)}</div>`
}

function mbAddTag(field, value) {
  if (!mb.draft[field]) mb.draft[field] = []
  if (!mb.draft[field].includes(value)) { mb.draft[field].push(value); mb.dirty = true }
  const el = document.getElementById('mb-tagpicker-' + field)
  if (el) el.innerHTML = mbRenderTagPickerInner(field, MB_TAG_OPTIONS[field])
}

function mbAddCustomTag(field) {
  const input = document.getElementById('mb-custom-' + field)
  if (!input) return
  const value = input.value.trim()
  if (!value) return
  if (!mb.draft[field]) mb.draft[field] = []
  if (!mb.draft[field].includes(value)) {
    mb.draft[field].push(value)
    mb.dirty = true
    input.value = ''
    const el = document.getElementById('mb-tagpicker-' + field)
    if (el) el.innerHTML = mbRenderTagPickerInner(field, MB_TAG_OPTIONS[field])
  } else {
    showToast('Already added')
  }
}

function mbRemoveTag(field, idx) {
  if (!mb.draft[field]) return
  window.confirmDelete('Delete?', () => {
    mb.draft[field].splice(idx, 1); mb.dirty = true
    const el = document.getElementById('mb-tagpicker-' + field)
    if (el) el.innerHTML = mbRenderTagPickerInner(field, MB_TAG_OPTIONS[field])
  })
}

function mbFilterTagOptions(field, query) {
  const q = query.toLowerCase()
  const el = document.getElementById('mb-tagopts-' + field)
  if (!el) return
  el.querySelectorAll('[data-tagoption]').forEach(item => {
    item.style.display = item.dataset.tagoption.toLowerCase().includes(q) ? '' : 'none'
  })
}

function mbRenderDamageTypes() {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      <div>
        <label style="${MBS.label}">VULNERABILITIES</label>
        ${mbRenderTagPicker('vulnerable', MB_DAMAGE_TYPES)}
      </div>
      <div>
        <label style="${MBS.label}">RESISTANCES</label>
        ${mbRenderTagPicker('resist', MB_DAMAGE_TYPES)}
      </div>
      <div>
        <label style="${MBS.label}">IMMUNITIES</label>
        ${mbRenderTagPicker('immune', MB_DAMAGE_TYPES)}
      </div>
    </div>
  `
}

function mbRenderCondImmune() {
  return `
    <div>
      <label style="${MBS.label}">CONDITION IMMUNITIES</label>
      ${mbRenderTagPicker('conditionImmune', MB_CONDITIONS)}
    </div>
  `
}

function mbRenderSenses() {
  const d = mb?.draft || {}
  return `
    <div style="display:flex;gap:12px;align-items:flex-end;">
      <div style="flex:1;">
        <label style="${MBS.label}">SENSES</label>
        <input value="${mbEsc(d.senses)}" placeholder="Darkvision 30 ft., Tremorsense 60 ft., etc."
          onchange="mb.draft.senses=this.value;mb.dirty=true"
          style="${MBS.field}width:100%;">
      </div>
      <div>
        <label style="${MBS.label}">PASSIVE PERCEPTION</label>
        <input value="${mbEsc(d.passive)}" placeholder="10 + Perception bonus"
          onchange="mb.draft.passive=this.value;mb.dirty=true"
          style="${MBS.field}width:100%;">
      </div>
    </div>
  `
}

function mbRenderLanguages() {
  const d = mb?.draft || {}
  return `
    <div>
      <input value="${mbEsc(d.languages)}" placeholder="Common, Abyssal, Deep Speech, etc."
        onchange="mb.draft.languages=this.value;mb.dirty=true"
        style="${MBS.field}width:100%;">
    </div>
  `
}

function mbRenderCR() {
  const d = mb?.draft || {}
  const cr = MB_CR_TABLE.find(e => e.cr === d.cr) ? d.cr : '1'
  const crItems = MB_CR_TABLE.map(e => ({value: e.cr, label: `${e.cr}  (${e.xp.toLocaleString()} XP)`}))
  return `
    <div>
      <label style="${MBS.label}">CHALLENGE RATING</label>
      ${mbDrumPicker('cr', crItems, cr,
        v => { mb.draft.cr = v; mb.dirty = true; },
        '280px')}
    </div>
  `
}

function mbRenderAbilityGroup(section, withAttack) {
  const d = mb?.draft || {}
  const items = d[section] || []
  const editIdx = mb.editingEntry && mb.editingEntry.section === section ? mb.editingEntry.idx : null
  return `
    ${items.length === 0 && editIdx === null
      ? `<div style="color:#C8C8C8;font-size:12px;margin-bottom:8px;font-style:italic;">None added.</div>`
      : items.map((entry, i) => {
          if (i === editIdx) return mbRenderEntryEditor(entry, section, i, withAttack)
          return `
            <div data-drag-item="${section}" data-drag-idx="${i}"
              style="${MBS.itemRow}position:relative;">
              <span onmousedown="mbStartDrag(event,'${section}',${i})"
                style="color:#333;font-size:18px;user-select:none;line-height:1;cursor:grab;padding:0 4px;margin-left:-4px;">&#8801;</span>
              <div style="flex:1;min-width:0;" onclick="mbEditEntry('${section}',${i})" style="cursor:pointer;">
                <div style="font-size:13px;font-weight:bold;color:#e0d5c5;
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${mbEsc(entry.name)||'<span style="color:#C8C8C8;font-style:italic;">Unnamed</span>'}
                  <span style="color:#C8C8C8;font-size:11px;font-weight:normal;">
                    ${mbLimitedStr(entry.limitedUsage)}
                  </span>
                  ${entry.attack ? `<span style="color:#8b4040;font-size:11px;font-weight:normal;"> [${entry.attack.atk === '—' ? 'Damage' : 'Attack'}]</span>` : ''}
                </div>
                ${entry.desc ? `<div style="font-size:11px;color:#C8C8C8;white-space:nowrap;overflow:hidden;
                                            text-overflow:ellipsis;max-width:400px;">${mbEsc(entry.desc)}</div>` : ''}
              </div>
              <button onclick="mbEditEntry('${section}',${i})"
                style="background:none;border:1px solid #2E2F2D;color:#C8C8C8;cursor:pointer;
                       font-size:11px;padding:3px 8px;border-radius:3px;white-space:nowrap;
                       font-family:var(--app-font);">Edit</button>
              <button onclick="mbDeleteEntry('${section}',${i})"
                style="background:none;border:none;color:#4587A2;cursor:pointer;font-size:18px;
                       padding:0 4px;line-height:1;" title="Remove">&#8722;</button>
            </div>
          `
        }).join('')
    }
    ${editIdx === null || editIdx !== items.length
      ? `<button onclick="mbAddEntry('${section}',${withAttack})"
           style="${MBS.btnSecondarySmall}margin-top:6px;">+ Add</button>`
      : ''
    }
  `
}

function mbRenderEntryEditor(entry, section, idx, withAttack) {
  const lu = entry.limitedUsage || {type:'none', count:1}
  return `
    <div style="background:#1A1C1E;border:1px solid #4587A2;border-radius:6px;
                padding:14px;margin-bottom:8px;">
      <div style="display:grid;gap:10px;">
        <div>
          <label style="${MBS.label}">NAME</label>
          <input id="mb-entry-name-${section}-${idx}" value="${mbEsc(entry.name)}"
            placeholder="Trait/Action name…"
            onchange="mbDraftEntry('${section}',${idx},'name',this.value)"
            style="${MBS.field}width:100%;">
        </div>
        <div>
          <label style="${MBS.label}">DESCRIPTION</label>
          <textarea id="mb-entry-desc-${section}-${idx}" rows="4"
            onchange="mbDraftEntry('${section}',${idx},'desc',this.value)"
            placeholder="Description…"
            style="${MBS.field}width:100%;resize:vertical;">${mbEsc(entry.desc)}</textarea>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
          <div>
            <label style="${MBS.label}">LIMITED USAGE</label>
            <select onchange="mbDraftEntryLU('${section}',${idx},this.value)" style="${MBS.select}">
              <option value="none"${lu.type==='none'?' selected':''}>None</option>
              <option value="per_day"${lu.type==='per_day'?' selected':''}>#/Day</option>
              <option value="recharge_2"${lu.type==='recharge_2'?' selected':''}>Recharge 2–6</option>
              <option value="recharge_3"${lu.type==='recharge_3'?' selected':''}>Recharge 3–6</option>
              <option value="recharge_4"${lu.type==='recharge_4'?' selected':''}>Recharge 4–6</option>
              <option value="recharge_5"${lu.type==='recharge_5'?' selected':''}>Recharge 5–6</option>
              <option value="recharge_6"${lu.type==='recharge_6'?' selected':''}>Recharge 6</option>
              <option value="short_rest"${lu.type==='short_rest'?' selected':''}>Recharge after Short Rest</option>
            </select>
          </div>
          ${lu.type === 'per_day' ? `
            <div>
              <label style="${MBS.label}">COUNT</label>
              <input type="number" value="${lu.count||1}" min="1" max="99"
                onchange="mbDraftEntryLUCount('${section}',${idx},parseInt(this.value)||1)"
                style="${MBS.field}width:60px;text-align:center;">
            </div>
          ` : ''}
        </div>
        ${withAttack ? `
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:16px;height:16px;border-radius:50%;border:2px solid ${entry.attack?'#4587A2':'#666'};
                          background:${entry.attack?'#4587A2':'transparent'};flex-shrink:0;transition:all 0.2s;cursor:pointer;"
                onclick="mbToggleAttack('${section}',${idx},!${!!entry.attack})"></div>
              <label style="font-size:13px;color:#e0d5c5;cursor:pointer;"
                onclick="mbToggleAttack('${section}',${idx},!${!!entry.attack})">
                Add Attack Roll/Damage
              </label>
            </div>
            ${entry.attack ? (() => {
              // Handle both Monster Builder format (atk) and NPC Builder format (bonus)
              // NPC format: {bonus: 7} (number) → Monster format: {atk: "+7"} (string)
              let atk = entry.attack.atk || (entry.attack.bonus !== undefined ?
                (entry.attack.bonus >= 0 ? `+${entry.attack.bonus}` : String(entry.attack.bonus)) : '')

              let diceCount = entry.attack.diceCount || ''
              let dieType = entry.attack.dieType || 'd6'
              let dmgBonus = entry.attack.dmgBonus || ''
              let dmgType = entry.attack.dmgType || ''
              let additionalDiceCount = entry.attack.additionalDiceCount || ''
              let additionalDieType = entry.attack.additionalDieType || (additionalDiceCount ? 'd8' : 'd6')
              let additionalDmgType = entry.attack.additionalDmgType || ''
              let showAdditional = entry.attack.showAdditional !== undefined ? entry.attack.showAdditional : (additionalDiceCount !== '')

              let altDiceCount = entry.attack.altDiceCount || ''
              let altDieType = entry.attack.altDieType || (altDiceCount ? 'd8' : 'd6')
              let altDmgBonus = entry.attack.altDmgBonus || ''
              let altDmgType = entry.attack.altDmgType || ''
              let showAlternate = entry.attack.showAlternate !== undefined ? entry.attack.showAlternate : (altDiceCount !== '')

              // If this is legacy XML format (has 'dmg' field instead of structured), parse it
              if (entry.attack.dmg && !entry.attack.diceCount) {
                const parsed = window.parseDamageString(entry.attack.dmg)
                diceCount = parsed.diceCount
                dieType = parsed.dieType
                dmgBonus = parsed.dmgBonus
                dmgType = parsed.dmgType
                additionalDiceCount = parsed.additionalDiceCount
                additionalDieType = parsed.additionalDieType
                additionalDmgType = parsed.additionalDmgType
                showAdditional = additionalDiceCount !== ''
              }

              // Generate attack bonus options: -5 up to +99, with "—" between -1 and +0
              const atkOptions = []
              for (let i = -5; i <= -1; i++) atkOptions.push(`${i}`)
              atkOptions.push('—')
              for (let i = 0; i <= 99; i++) atkOptions.push(i === 0 ? '+0' : `+${i}`)

              const isNoRoll = atk === '—'
              const atkLabel = isNoRoll ? 'ATTACK BONUS (No attack roll)' : 'ATTACK BONUS'

              return `
              <div style="margin-top:10px;">
                <div style="margin-bottom:10px;">
                  <label style="${MBS.label}">${atkLabel}</label>
                  <div id="mb-atk-picker-${section}-${idx}" style="max-height:56px;overflow-y:auto;width:42px;
                                border:1px solid #4587A2;border-radius:3px;background:#1A1C1E;
                                scrollbar-width:none;-ms-overflow-style:none;">
                    <style>#mb-atk-picker-${section}-${idx}::-webkit-scrollbar { display: none; }</style>
                    ${atkOptions.map(val => `
                      <div onclick="mbDraftEntryAtk('${section}',${idx},'atk','${val}');mbRefreshSection('${section}')"
                        data-selected="${atk === val}"
                        style="padding:5px 12px;cursor:pointer;border-radius:3px;font-size:13px;
                               color:#e0d5c5;background:${atk === val ? '#1e3050' : 'transparent'};
                               display:flex;align-items:center;justify-content:center;"
                        onmouseover="this.style.background='#142840'"
                        onmouseout="this.style.background='${atk === val ? '#1e3050' : 'transparent'}'">
                        ${val}
                      </div>
                    `).join('')}
                  </div>
                </div>
                <div>
                  <label style="${MBS.label}">DAMAGE</label>
                  <div style="display:grid;grid-template-columns:90px 80px 110px 1fr;gap:6px;align-items:end;">
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Dice Amount</div>
                      <input type="text" value="${mbEsc(diceCount)}"
                        placeholder="2"
                        onchange="mbDraftEntryAtk('${section}',${idx},'diceCount',this.value.trim())"
                        style="${MBS.field}width:100%;text-align:center;">
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Die</div>
                      <select value="${dieType}"
                        onchange="mbDraftEntryAtk('${section}',${idx},'dieType',this.value)"
                        style="${MBS.field}width:100%;padding:8px 4px;">
                        ${['d2','d4','d6','d8','d10','d12','d20'].map(d =>
                          `<option value="${d}" ${dieType===d?'selected':''}>${d}</option>`
                        ).join('')}
                      </select>
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Bonus</div>
                      <div style="position:relative;display:inline-block;width:100%;">
                        ${(() => {
                          const val = String(dmgBonus).replace(/^[\+\-]/, '')
                          const dmgNum = parseInt(val) || 0
                          const showPrefix = dmgNum >= 0
                          return `
                            <span id="dmg-sign-${section}-${idx}" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
                                         color:#e0d5c5;font-size:13px;pointer-events:none;display:${showPrefix?'inline':'none'};">+</span>
                            <input type="number" value="${dmgNum}"
                              placeholder="3"
                              oninput="const sign=document.getElementById('dmg-sign-${section}-${idx}');sign.style.display=this.value<0?'none':'inline';"
                              onchange="mbDraftEntryAtk('${section}',${idx},'dmgBonus',this.value.trim())"
                              style="${MBS.field}width:100%;text-align:center;padding-left:${showPrefix?'20px':'10px'};">
                          `
                        })()}
                      </div>
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Type</div>
                      <input type="text" value="${mbEsc(dmgType)}"
                        placeholder="slashing"
                        onchange="mbDraftEntryAtk('${section}',${idx},'dmgType',this.value.trim())"
                        style="${MBS.field}width:100%;">
                    </div>
                  </div>
                </div>
                <div style="margin-top:10px;">
                  ${circleToggle(
                    'show-additional-' + section + '-' + idx,
                    showAdditional,
                    `mbDraftEntryAtk('${section}',${idx},'showAdditional',!mb.draft.${section}[${idx}].attack.showAdditional)`,
                    'Add Additional Damage'
                  )}
                </div>
                ${showAdditional ? `
                <div style="margin-top:10px;">
                  <label style="${MBS.label}">ADDITIONAL DAMAGE</label>
                  <div style="display:grid;grid-template-columns:90px 80px 1fr;gap:6px;align-items:end;">
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Dice Amount</div>
                      <input type="text" value="${mbEsc(additionalDiceCount)}"
                        placeholder="2"
                        onchange="mbDraftEntryAtk('${section}',${idx},'additionalDiceCount',this.value.trim())"
                        style="${MBS.field}width:100%;text-align:center;">
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Die</div>
                      <select value="${additionalDieType}"
                        onchange="mbDraftEntryAtk('${section}',${idx},'additionalDieType',this.value)"
                        style="${MBS.field}width:100%;padding:8px 4px;">
                        ${['d2','d4','d6','d8','d10','d12','d20'].map(d =>
                          `<option value="${d}" ${additionalDieType===d?'selected':''}>${d}</option>`
                        ).join('')}
                      </select>
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Type</div>
                      <input type="text" value="${mbEsc(additionalDmgType)}"
                        placeholder="acid"
                        onchange="mbDraftEntryAtk('${section}',${idx},'additionalDmgType',this.value.trim())"
                        style="${MBS.field}width:100%;">
                    </div>
                  </div>
                </div>
                ` : ''}
                <div style="margin-top:10px;">
                  ${circleToggle(
                    'show-alternate-' + section + '-' + idx,
                    showAlternate,
                    `mbDraftEntryAtk('${section}',${idx},'showAlternate',!mb.draft.${section}[${idx}].attack.showAlternate)`,
                    'Add Alternate Damage'
                  )}
                </div>
                ${showAlternate ? `
                <div style="margin-top:10px;">
                  <label style="${MBS.label}">ALTERNATE DAMAGE</label>
                  <div style="display:grid;grid-template-columns:90px 80px 110px 1fr;gap:6px;align-items:end;">
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Dice Amount</div>
                      <input type="text" value="${mbEsc(altDiceCount)}"
                        placeholder="2"
                        onchange="mbDraftEntryAtk('${section}',${idx},'altDiceCount',this.value.trim())"
                        style="${MBS.field}width:100%;text-align:center;">
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Die</div>
                      <select value="${altDieType}"
                        onchange="mbDraftEntryAtk('${section}',${idx},'altDieType',this.value)"
                        style="${MBS.field}width:100%;padding:8px 4px;">
                        ${['d2','d4','d6','d8','d10','d12','d20'].map(d =>
                          `<option value="${d}" ${altDieType===d?'selected':''}>${d}</option>`
                        ).join('')}
                      </select>
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Bonus</div>
                      <div style="position:relative;display:inline-block;width:100%;">
                        ${(() => {
                          const val = String(altDmgBonus).replace(/^[\+\-]/, '')
                          const altNum = parseInt(val) || 0
                          const showPrefix = altNum >= 0
                          return `
                            <span id="alt-dmg-sign-${section}-${idx}" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);
                                         color:#e0d5c5;font-size:13px;pointer-events:none;display:${showPrefix?'inline':'none'};">+</span>
                            <input type="number" value="${altNum}"
                              placeholder="3"
                              oninput="const sign=document.getElementById('alt-dmg-sign-${section}-${idx}');sign.style.display=this.value<0?'none':'inline';"
                              onchange="mbDraftEntryAtk('${section}',${idx},'altDmgBonus',this.value.trim())"
                              style="${MBS.field}width:100%;text-align:center;padding-left:${showPrefix?'20px':'10px'};">
                          `
                        })()}
                      </div>
                    </div>
                    <div>
                      <div style="font-size:9px;color:#888;margin-bottom:2px;">Type</div>
                      <input type="text" value="${mbEsc(altDmgType)}"
                        placeholder="fire"
                        onchange="mbDraftEntryAtk('${section}',${idx},'altDmgType',this.value.trim())"
                        style="${MBS.field}width:100%;">
                    </div>
                  </div>
                </div>
                ` : ''}
              </div>
              `
            })() : ''}
          </div>
        ` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #2E2F2D;padding-top:10px;margin-top:4px;">
          <button onclick="mbCloseEntry()" style="${MBS.btnSecondarySmall}">Done</button>
        </div>
      </div>
    </div>
  `
}

function mbRenderSpells() {
  const d = mb?.draft || {}
  const selectedSpells = Array.isArray(d.selectedSpells) ? d.selectedSpells : []
  const spellSlots = Array.isArray(d.spellSlots) ? d.spellSlots : [0,0,0,0,0,0,0,0,0]
  const atwill = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage==='atwill')
  const daily  = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage==='daily')
  const slots  = selectedSpells.map((s,i)=>({...s,_i:i})).filter(s=>s && s.usage!=='atwill'&&s.usage!=='daily')
  const rmBtn  = i => `<button onclick="mbRemoveSpell(${i})"
    style="background:none;border:none;color:#4587A2;cursor:pointer;font-size:16px;
           padding:0 3px;line-height:1;margin-left:auto;" title="Remove">&#215;</button>`
  const spellRow = (sp, extra='') => `
    <div style="${MBS.itemRow}">
      <span style="flex:1;font-size:13px;color:#e0d5c5;">${mbEsc(sp.name)}</span>
      ${extra}
      ${rmBtn(sp._i)}
    </div>`

  return `
    <div>
      <div style="font-size:11px;color:#4587A2;font-weight:700;letter-spacing:.08em;
                  margin-bottom:6px;margin-top:2px;">AT WILL</div>
      ${atwill.length === 0
        ? `<div style="font-size:12px;color:#C8C8C8;font-style:italic;margin-bottom:8px;">None</div>`
        : atwill.map(sp => spellRow(sp)).join('') }

      <div style="font-size:11px;color:#4587A2;font-weight:700;letter-spacing:.08em;
                  margin-bottom:6px;margin-top:10px;">DAILY</div>
      ${daily.length === 0
        ? `<div style="font-size:12px;color:#C8C8C8;font-style:italic;margin-bottom:8px;">None</div>`
        : daily.map(sp => spellRow(sp,
            `<span style="font-size:11px;color:#C8C8C8;white-space:nowrap;">${sp.dailyCount||1}/day</span>`
          )).join('') }

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;margin-bottom:8px;">
        <div style="font-size:11px;color:#4587A2;font-weight:700;letter-spacing:.08em;">SPELL SLOTS</div>
        <div style="display:flex;gap:8px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <label style="font-size:10px;color:#C8C8C8;letter-spacing:.06em;">DC</label>
            <input type="number" value="${d.spellSaveDC || ''}"
              onchange="const v=parseInt(this.value);mb.draft.spellSaveDC=isNaN(v)?null:v;mb.dirty=true"
              placeholder="—"
              style="${MBS.field}width:50px;text-align:center;padding:4px;" />
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <label style="font-size:10px;color:#C8C8C8;letter-spacing:.06em;">ATK</label>
            <span style="color:#e0d5c5;font-size:14px;">+</span>
            <input type="number" value="${d.spellAttackMod || ''}"
              onchange="const v=parseInt(this.value);mb.draft.spellAttackMod=isNaN(v)?null:v;mb.dirty=true"
              placeholder="—"
              style="${MBS.field}width:50px;text-align:center;padding:4px;" />
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        ${['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'].map((lvl,i) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
            <div style="font-size:10px;color:#4587A2;font-weight:bold;letter-spacing:.04em;">${lvl}</div>
            <input type="number" value="${spellSlots[i]||0}" min="0" max="6"
              onchange="mb.draft.spellSlots[${i}]=Math.min(6,Math.max(0,parseInt(this.value)||0));mb.dirty=true"
              style="${MBS.field}width:38px;text-align:center;padding:5px 4px;">
          </div>`).join('')}
      </div>
      ${slots.length === 0
        ? `<div style="font-size:12px;color:#C8C8C8;font-style:italic;margin-bottom:8px;">No spells assigned to slots.</div>`
        : slots.map(sp => spellRow(sp)).join('') }

      <button onclick="mbSpellPickerOpen()" style="${MBS.btnSecondarySmall}margin-top:8px;">+ Add Spell</button>
      ${mb.spellPickerOpen ? mbRenderSpellPickerHtml() : ''}
    </div>
  `
}

function mbRenderSpellPickerHtml() {
  const q = (mb.spellPickerQuery||'').toLowerCase()
  const spells = (compendiumData.spells||[])
    .filter(s => !q || s.name.toLowerCase().includes(q))
    .slice(0, 60)
  const selectedSpells = Array.isArray(mb?.draft?.selectedSpells) ? mb.draft.selectedSpells : []
  const added = selectedSpells.map(s => s && s.name).filter(Boolean)
  return `
    <div style="margin-top:10px;background:#1A1C1E;border:1px solid #4587A2;
                border-radius:6px;padding:12px;">
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">
        <input id="mb-spell-search" value="${mbEsc(mb.spellPickerQuery)}"
          placeholder="Search spells…" autofocus
          oninput="mbFilterSpells(this.value)"
          style="${MBS.field}flex:1;background:#5C5C5C;border:4px solid #2E2F2D;color:#1E231A;">
        <button onclick="mb.spellPickerOpen=false;mbRefreshSection('spells')"
          style="${MBS.btnSecondarySmall}">Close</button>
      </div>
      <div id="mb-spell-results" style="max-height:240px;overflow-y:auto;">
        ${mbSpellResultsHtml()}
      </div>
    </div>
  `
}

function mbSpellResultsHtml() {
  const q     = (mb.spellPickerQuery||'').toLowerCase()
  const spells = (compendiumData.spells||[])
    .filter(s => !q || s.name.toLowerCase().includes(q)).slice(0, 60)
  const selectedSpells = Array.isArray(mb?.draft?.selectedSpells) ? mb.draft.selectedSpells : []
  const added  = selectedSpells.map(s => s && s.name).filter(Boolean)
  const pName  = mb.spellPendingName
  if (spells.length === 0)
    return `<div style="color:#C8C8C8;font-size:12px;text-align:center;padding:20px;">No spells found.</div>`
  return spells.map(s => {
    const isAdded   = added.includes(s.name)
    const isPending = s.name === pName
    if (isPending) {
      return `
      <div style="padding:8px 10px;border-radius:4px;background:#1A1C1E;
                  border:1px solid #4587A2;margin:2px 0;">
        <div style="font-size:12px;color:#4587A2;font-weight:bold;margin-bottom:8px;">${mbEsc(s.name)}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button onclick="mbAddSpellWithUsage(this.dataset.name,'${s.level}','atwill',0)" data-name="${mbEsc(pName)}"
            style="${MBS.btnSmall}">At Will</button>
          <div style="display:flex;align-items:center;gap:4px;">
            <input id="mb-spell-daily-n" type="number" value="1" min="1" max="9"
              style="${MBS.field}width:40px;text-align:center;padding:4px;">
            <button onclick="mbAddSpellWithUsage(this.dataset.name,'${s.level}','daily',
                parseInt(document.getElementById('mb-spell-daily-n').value)||1)" data-name="${mbEsc(pName)}"
              style="${MBS.btnSmall}">/Day</button>
          </div>
          <button onclick="mbAddSpellWithUsage(this.dataset.name,'${s.level}','slot',0)" data-name="${mbEsc(pName)}"
            style="${MBS.btnSmall}">Spell Slot</button>
          <button onclick="mbCancelSpellPick()"
            style="${MBS.btnSecondarySmall}">Cancel</button>
        </div>
      </div>`
    }
    return `
      <div onclick="${isAdded ? '' : `mbSelectSpell(this.dataset.name,'${s.level}')`}" data-name="${mbEsc(s.name)}"
        style="padding:7px 10px;border-radius:4px;cursor:${isAdded?'default':'pointer'};
               display:flex;align-items:center;gap:10px;opacity:${isAdded?'.4':'1'};"
        ${isAdded ? '' : `onmouseover="this.style.background='#142840'" onmouseout="this.style.background='transparent'"`}>
        <span style="font-size:11px;color:#C8C8C8;width:52px;flex-shrink:0;">
          ${s.level==='0'?'Cantrip':`Lvl ${s.level}`}</span>
        <span style="font-size:13px;color:${isAdded?'#c9a87c':'#e0d5c5'};">${mbEsc(s.name)}</span>
        ${isAdded ? `<span style="font-size:11px;color:#4587A2;margin-left:auto;">&#10003; Added</span>` : ''}
      </div>`
  }).join('')
}

function mbFilterSpells(query) {
  mb.spellPickerQuery = query
  const el = document.getElementById('mb-spell-results')
  if (el) el.innerHTML = mbSpellResultsHtml()
}

function mbRenderEnvironments() {
  const d = mb.draft
  return `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      ${MB_ENVIRONMENTS.map(env => {
        const isOn = (d.environments||[]).includes(env)
        return `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                      font-size:13px;color:#e0d5c5;padding:5px;"
          onclick="mbToggleEnvironment('${env}',!${isOn})">
          <div style="width:16px;height:16px;border-radius:50%;border:2px solid ${isOn?'#4587A2':'#666'};
                      background:${isOn?'#4587A2':'transparent'};flex-shrink:0;transition:all 0.2s;"></div>
          ${env}
        </label>
      `}).join('')}
    </div>
  `
}

function mbRenderDescription() {
  const d = mb?.draft || {}
  return `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;gap:16px;align-items:center;transform:scale(0.8);transform-origin:left center;">
        ${circleToggle('mb-homebrew', d.homebrew, 'mbToggleHomebrew()', 'HOMEBREW', true)}
        ${circleToggle('mb-thirdparty', d.thirdParty, 'mbToggleThirdParty()', 'THIRD PARTY', true)}
      </div>
      <div>
        <label style="${MBS.label}">SOURCE</label>
        <input value="${mbEsc(d.source||'')}" placeholder="Monster Manual pg. 228, Battlezoo Bestiary pg. 27, Flee, Mortals! pg. 220, etc."
          onchange="mb.draft.source=this.value;mb.dirty=true"
          style="${MBS.field}width:100%;box-sizing:border-box;">
      </div>
      <div>
        <label style="${MBS.label}">DESCRIPTION</label>
        <textarea rows="6" onchange="mb.draft.description=this.value;mb.dirty=true"
          placeholder="Freeform description, lore, notes…"
          style="${MBS.field}width:100%;resize:vertical;">${mbEsc(d.description)}</textarea>
      </div>
    </div>
  `
}

// ── State update helpers ──────────────────────────────────────────
function mbUpdateHpAvg() {
  const hpInfo = mbHpDisplay(mb.draft)
  mb.draft.hpValue = hpInfo.auto
  mb.dirty = true
  // ONLY update the HP value input and formula display — never touch drums or re-render sections
  const valEl = document.getElementById('mb-hp-val')
  if (valEl) valEl.value = hpInfo.auto
  const calcEl = document.getElementById('mb-hp-calculated')
  if (calcEl) calcEl.textContent = hpInfo.calculated
  const minEl = document.getElementById('mb-hp-min')
  if (minEl) minEl.textContent = `Minimum: ${hpInfo.min}`
  const avgEl = document.getElementById('mb-hp-avg')
  if (avgEl) avgEl.textContent = `Average: ${hpInfo.avg}`
  const maxEl = document.getElementById('mb-hp-max')
  if (maxEl) maxEl.textContent = `Maximum: ${hpInfo.max}`
  // Do NOT call any render functions, do NOT update mbDrumState, do NOT trigger section refreshes
}

function mbUpdateInitiative() {
  const dex = parseInt(mb.draft.dex) || 10
  const mod = Math.floor((dex - 10) / 2)
  mb.draft.initiativeBonus = mod
  mb.dirty = true
  // Update the initiative input field
  const inputs = document.querySelectorAll('input[type="number"]')
  inputs.forEach(input => {
    if (input.value == mb.draft.initiativeBonus - 1 || input.value == mb.draft.initiativeBonus + 1) {
      // Find the input by checking if it's in the initiative section
      const parent = input.closest('div')
      if (parent && parent.innerHTML.includes('INITIATIVE BONUS')) {
        input.value = mod
      }
    }
  })
  // More reliable: find by onchange attribute
  const initInput = Array.from(document.querySelectorAll('input[type="number"]')).find(
    inp => inp.getAttribute('onchange')?.includes('initiativeBonus')
  )
  if (initInput) initInput.value = mod
}

function mbUpdateProficiencyDisplay() {
  const profDisplay = document.getElementById('mb-proficiency-display')
  if (profDisplay && mb.draft) {
    const prof = mb.draft.proficiencyBonus || 0
    profDisplay.textContent = (prof >= 0 ? '+' : '') + prof
  }
}


function mbRefreshSection(dataKey) {
  const content = document.getElementById('content')
  const savedScroll = content ? content.scrollTop : 0  // SAVE before DOM update

  const idMap = {
    savingThrows:'ST', skills:'Skills', spells:'Spells',
    traits:'traits', actions:'actions', reactions:'reactions',
    legendaryActions:'legendaryActions', bonusActions:'bonusActions',
    notes:'notes',
  }
  const sectId = idMap[dataKey] || dataKey
  const el = document.getElementById('mb-sect-' + sectId)
  if (!el) return

  // Save picker dropdown scroll positions before rebuilding HTML
  let stPickerScroll = 0, stModScroll = 0, skillPickerScroll = 0, skillModScroll = 0
  const atkScrolls = new Map()

  if (dataKey === 'savingThrows') {
    const stPicker = document.getElementById('mb-st-picker-list')
    const stMod = document.getElementById('mb-st-mod-list')
    if (stPicker) stPickerScroll = stPicker.scrollTop
    if (stMod) stModScroll = stMod.scrollTop
  } else if (dataKey === 'skills') {
    const skillPicker = document.getElementById('mb-skill-picker-list')
    const skillMod = document.getElementById('mb-skill-mod-list')
    if (skillPicker) skillPickerScroll = skillPicker.scrollTop
    if (skillMod) skillModScroll = skillMod.scrollTop
  } else if (['traits', 'actions', 'reactions', 'legendaryActions', 'bonusActions'].includes(dataKey)) {
    // Save all attack bonus picker scroll positions in this section
    const atkLists = document.querySelectorAll(`[id^="mb-atk-list-${dataKey}-"]`)
    atkLists.forEach(list => {
      const match = list.id.match(/mb-atk-list-(.+)-(\d+)/)
      if (match) atkScrolls.set(`${match[1]}-${match[2]}`, list.scrollTop)
    })
  }

  if (dataKey === 'savingThrows') el.innerHTML = mbRenderSavingThrows()
  else if (dataKey === 'skills') el.innerHTML = mbRenderSkills()
  else if (dataKey === 'spells') {
    if (window.pcb && window.pcbRenderSpells) el.innerHTML = window.pcbRenderSpells()
    else el.innerHTML = mbRenderSpells()
  }
  else if (dataKey === 'notes') {
    if (window.npcb && window.npcbRenderNotes) el.innerHTML = window.npcbRenderNotes()
    else if (window.pcb && window.pcbRenderNotes) el.innerHTML = window.pcbRenderNotes()
  }
  else {
    // Enable attack UI for all action types except traits
    const withAttack = ['actions', 'bonusActions', 'reactions', 'legendaryActions', 'lairActions'].includes(dataKey)
    el.innerHTML = mbRenderAbilityGroup(dataKey, withAttack)
  }

  // Restore picker dropdown scroll positions after rebuilding HTML
  if (dataKey === 'savingThrows') {
    const stPicker = document.getElementById('mb-st-picker-list')
    const stMod = document.getElementById('mb-st-mod-list')
    if (stPicker) stPicker.scrollTop = stPickerScroll
    if (stMod) stMod.scrollTop = stModScroll
  } else if (dataKey === 'skills') {
    const skillPicker = document.getElementById('mb-skill-picker-list')
    const skillMod = document.getElementById('mb-skill-mod-list')
    if (skillPicker) skillPicker.scrollTop = skillPickerScroll
    if (skillMod) skillMod.scrollTop = skillModScroll
  } else if (['traits', 'actions', 'reactions', 'legendaryActions', 'bonusActions', 'lairActions'].includes(dataKey)) {
    // Restore all attack bonus picker scroll positions in this section
    atkScrolls.forEach((scrollTop, key) => {
      const list = document.getElementById(`mb-atk-list-${key}`)
      if (list) list.scrollTop = scrollTop
    })

    // Center the selected item in all attack bonus pickers for this section
    setTimeout(() => {
      document.querySelectorAll(`[id^="mb-atk-picker-${dataKey}-"]`).forEach(picker => {
        const selected = picker.querySelector('[data-selected="true"]')
        if (selected) {
          // Calculate position relative to picker, not document
          const itemTop = selected.offsetTop - picker.offsetTop
          picker.scrollTop = itemTop - (picker.clientHeight / 2) + (selected.clientHeight / 2)
        }
      })
    }, 0)
  }

  if (content) content.scrollTop = savedScroll  // RESTORE after DOM update
}

// ── Picker handlers ───────────────────────────────────────────────
function mbToggleStPicker() {
  mb.stPickerOpen = !mb.stPickerOpen
  if (!mb.stPickerOpen) { mb.stPickerAbility = null; mb.stPickerMod = 0 }
  mbRefreshSection('savingThrows')
}

function mbAddSavingThrow(ability, mod) {
  const existing = mb.draft.savingThrows.findIndex(s => s.ability === ability)
  if (existing >= 0) mb.draft.savingThrows[existing].modifier = mod
  else mb.draft.savingThrows.push({ability, modifier: mod})
  mb.dirty = true
  mb.stPickerOpen = false; mb.stPickerAbility = null; mb.stPickerMod = 0
  mbRefreshSection('savingThrows')
}

function mbRemoveSavingThrow(idx) {
  window.confirmDelete('Delete?', () => {
    mb.draft.savingThrows.splice(idx, 1)
    mb.dirty = true
    mbRefreshSection('savingThrows')
  })
}

function mbToggleSkillPicker() {
  mb.skillPickerOpen = !mb.skillPickerOpen
  if (!mb.skillPickerOpen) { mb.skillPickerName = null; mb.skillPickerMod = 0 }
  mbRefreshSection('skills')
}

function mbAddSkill(name, mod) {
  const existing = mb.draft.skills.findIndex(s => s.name === name)
  if (existing >= 0) mb.draft.skills[existing].modifier = mod
  else mb.draft.skills.push({name, modifier: mod})
  mb.dirty = true
  mb.skillPickerOpen = false; mb.skillPickerName = null; mb.skillPickerMod = 0
  mbRefreshSection('skills')
  // Update passive senses if Perception, Insight, or Investigation changed
  if (name === 'Perception' || name === 'Insight' || name === 'Investigation') {
    if (window.pcbUpdatePassiveSenses) pcbUpdatePassiveSenses()
  }
}

function mbRemoveSkill(idx) {
  window.confirmDelete('Delete?', () => {
    const skillName = mb.draft.skills[idx]?.name
    mb.draft.skills.splice(idx, 1)
    mb.dirty = true
    mbRefreshSection('skills')
    // Update passive senses if Perception, Insight, or Investigation removed
    if (skillName === 'Perception' || skillName === 'Insight' || skillName === 'Investigation') {
      if (window.pcbUpdatePassiveSenses) pcbUpdatePassiveSenses()
    }
  })
}

// ── Ability group handlers ────────────────────────────────────────
function mbEditEntry(section, idx) {
  mb.editingEntry = {section, idx}
  mbRefreshSection(section)
  setTimeout(() => {
    const el = document.getElementById(`mb-entry-name-${section}-${idx}`)
    if (el) el.focus()
  }, 50)
}

function mbCloseEntry() {
  if (!mb.editingEntry) return
  const {section} = mb.editingEntry
  mb.editingEntry = null
  mbRefreshSection(section)
}

function mbDraftEntry(section, idx, field, value) {
  if (!mb.draft[section] || !mb.draft[section][idx]) return
  mb.draft[section][idx][field] = value
  mb.dirty = true
}

function mbDraftEntryLU(section, idx, type) {
  if (!mb.draft[section]?.[idx]) return
  mb.draft[section][idx].limitedUsage.type = type
  mb.dirty = true
  mbRefreshSection(section)
}

function mbDraftEntryLUCount(section, idx, count) {
  if (!mb.draft[section]?.[idx]) return
  mb.draft[section][idx].limitedUsage.count = count
  mb.dirty = true
}

// parseDamageString is now defined in renderer.js and exposed as window.parseDamageString
// No local declaration needed - use window.parseDamageString directly

function mbToggleAttack(section, idx, on) {
  if (!mb.draft[section]?.[idx]) return
  mb.draft[section][idx].attack = on ? {
    atk: '—',
    diceCount: '',
    dieType: 'd6',
    dmgBonus: '',
    dmgType: '',
    additionalDiceCount: '',
    additionalDieType: 'd6',
    additionalDmgType: '',
    showAdditional: false,
    altDiceCount: '',
    altDieType: 'd6',
    altDmgBonus: '',
    altDmgType: '',
    showAlternate: false
  } : null
  mb.dirty = true
  mbRefreshSection(section)
}

function mbDraftEntryAtk(section, idx, field, value) {
  if (!mb.draft[section]?.[idx]?.attack) return
  mb.draft[section][idx].attack[field] = value
  mb.dirty = true
  // If toggling showAdditional or showAlternate, refresh to show/hide the fields
  if (field === 'showAdditional' || field === 'showAlternate') {
    mbRefreshSection(section)
  }
}

function mbDeleteEntry(section, idx) {
  window.confirmDelete('Delete?', () => {
    mb.draft[section].splice(idx, 1)
    mb.dirty = true
    if (mb.editingEntry?.section === section) mb.editingEntry = null
    mbRefreshSection(section)
  })
}

function mbAddEntry(section, withAttack) {
  const entry = mbNewEntry()
  mb.draft[section].push(entry)
  mb.dirty = true
  mb.editingEntry = {section, idx: mb.draft[section].length - 1}
  mbRefreshSection(section)
  setTimeout(() => {
    const el = document.getElementById(`mb-entry-name-${section}-${mb.draft[section].length-1}`)
    if (el) el.focus()
  }, 50)
}

// ── Mouse-based drag & drop ───────────────────────────────────────
function mbStartDrag(event, section, idx) {
  event.preventDefault()
  event.stopPropagation()

  // Set drag state
  mb.dragSect = section
  mb.dragIdx = idx
  mb.isDragging = true

  // Change cursor
  const handle = event.currentTarget
  handle.style.cursor = 'grabbing'

  // Attach document-level mouse listeners
  document.addEventListener('mousemove', mbMouseDrag)
  document.addEventListener('mouseup', mbMouseDrop)

  // Prevent text selection during drag
  document.body.style.userSelect = 'none'
}

function mbMouseDrag(event) {
  if (!mb.isDragging || mb.dragIdx == null || !mb.dragSect) return

  // Find which item we're hovering over
  const items = document.querySelectorAll(`[data-drag-item="${mb.dragSect}"]`)
  let dropIdx = items.length // Default to end

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect()
    const midY = rect.top + rect.height / 2

    if (event.clientY < midY) {
      dropIdx = i
      break
    }
  }

  // Only update if position changed
  if (mb.dropTarget !== dropIdx) {
    mb.dropTarget = dropIdx
    mbUpdateDropIndicator(mb.dragSect, dropIdx)
  }
}

function mbMouseDrop(event) {
  if (!mb.isDragging) return

  // Remove listeners
  document.removeEventListener('mousemove', mbMouseDrag)
  document.removeEventListener('mouseup', mbMouseDrop)

  // Restore user selection
  document.body.style.userSelect = ''

  // Perform the drop if we have a valid target
  if (mb.dropTarget != null && mb.dragIdx != null && mb.dragSect) {
    const section = mb.dragSect
    const arr = mb.draft[section]

    if (arr && mb.dragIdx !== mb.dropTarget) {
      const dragIdx = mb.dragIdx
      const dropIdx = mb.dropTarget

      // Remove item from original position
      const [item] = arr.splice(dragIdx, 1)

      // Calculate final insert position
      const finalIdx = dragIdx < dropIdx ? dropIdx - 1 : dropIdx

      // Insert at new position
      arr.splice(finalIdx, 0, item)

      mb.dirty = true
      if (mb.editingEntry?.section === section) mb.editingEntry = null

      mbRefreshSection(section)
    }
  }

  // Clean up drag state
  mb.isDragging = false
  mb.dragIdx = null
  mb.dragSect = null
  mb.dropTarget = null

  // Remove indicator
  const indicator = document.querySelector('.mb-drop-indicator')
  if (indicator) indicator.remove()
}

function mbUpdateDropIndicator(section, dropIdx) {
  // Remove existing indicator
  const existing = document.querySelector('.mb-drop-indicator')
  if (existing) existing.remove()

  // Don't show indicator on the dragged item itself
  if (mb.dragIdx === dropIdx) return

  // Find the section container
  const container = document.getElementById(`mb-sect-${section}`) ||
                    document.getElementById(`mb-sect-${section === 'savingThrows' ? 'ST' : section === 'skills' ? 'Skills' : section}`)
  if (!container) return

  // Get all drag items in this section
  const items = Array.from(container.querySelectorAll(`[data-drag-item="${section}"]`))

  // Create indicator
  const indicator = document.createElement('div')
  indicator.className = 'mb-drop-indicator'
  indicator.style.cssText = 'height:2px;background:#4587A2;border-radius:1px;margin:2px 0;pointer-events:none;'

  // Insert indicator at the correct position
  if (dropIdx < items.length) {
    // Insert before the target item
    items[dropIdx].parentNode.insertBefore(indicator, items[dropIdx])
  } else if (items.length > 0) {
    // Insert after the last item
    const lastItem = items[items.length - 1]
    lastItem.parentNode.insertBefore(indicator, lastItem.nextSibling)
  } else {
    // No items, append to container
    container.appendChild(indicator)
  }
}

// ── Spells ────────────────────────────────────────────────────────
function mbSpellPickerOpen() {
  mb.spellPickerOpen = true
  mb.spellPickerQuery = ''
  mb.spellPendingName = null; mb.spellPendingLevel = null
  mbRefreshSection('spells')
  setTimeout(() => { const el = document.getElementById('mb-spell-search'); if (el) el.focus() }, 50)
}

function mbSelectSpell(name, level) {
  mb.spellPendingName  = name
  mb.spellPendingLevel = level
  const el = document.getElementById('mb-spell-results')
  if (el) el.innerHTML = mbSpellResultsHtml()
}

function mbCancelSpellPick() {
  mb.spellPendingName = null; mb.spellPendingLevel = null
  const el = document.getElementById('mb-spell-results')
  if (el) el.innerHTML = mbSpellResultsHtml()
}

function mbAddSpellWithUsage(name, level, usage, dailyCount) {
  if (!Array.isArray(mb.draft.selectedSpells)) mb.draft.selectedSpells = []
  if (!mb.draft.selectedSpells.find(s => s && s.name === name)) {
    mb.draft.selectedSpells.push({name, level: level||'0', usage, dailyCount: dailyCount||1})
    mb.dirty = true
  }
  mb.spellPendingName = null; mb.spellPendingLevel = null
  mbRefreshSection('spells')
}

// Keep mbAddSpell as a thin wrapper so any external callers still work
function mbAddSpell(name, level) { mbAddSpellWithUsage(name, level, 'slot', 0) }

function mbRemoveSpell(idx) {
  if (!Array.isArray(mb.draft.selectedSpells)) mb.draft.selectedSpells = []
  window.confirmDelete('Delete spell?', () => {
    mb.draft.selectedSpells.splice(idx, 1)
    mb.dirty = true
    mbRefreshSection('spells')
  })
}

// ── Environments ──────────────────────────────────────────────────
function mbToggleEnvironment(env, on) {
  if (!mb.draft.environments) mb.draft.environments = []
  if (on) { if (!mb.draft.environments.includes(env)) mb.draft.environments.push(env) }
  else mb.draft.environments = mb.draft.environments.filter(e => e !== env)
  mb.dirty = true
}

// ── Portrait ──────────────────────────────────────────────────────
function mbPortraitPick() {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      mb.draft.portrait = ev.target.result
      mb.dirty = true
      // Patch the portrait area without full re-render
      const container = document.querySelector('[onclick="mbPortraitPick()"]')
      if (container) container.innerHTML = `<img src="${mb.draft.portrait}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

// ── Save / Back ───────────────────────────────────────────────────
// Delete monster
function mbDelete() {
  if (!mb.originalName) return

  if (confirm(`Delete monster "${mb.originalName}"?\n\nThis action cannot be undone.`)) {
    // Use the stored reference to the exact monster being edited
    // This ensures we only delete the specific entry, not all entries with the same name
    const monsterToDelete = mb.editingMonster || compendiumData.monsters.find(m => m.name === mb.originalName && m._custom)

    if (monsterToDelete) {
      // Delete by filtering out the exact object reference
      compendiumData.monsters = compendiumData.monsters.filter(m => m !== monsterToDelete)

      // Save to storage
      saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })

      showToast(`Monster "${mb.originalName}" deleted`)
    } else {
      showToast(`Error: Could not find monster to delete`)
      return
    }

    // Clear navigation history to avoid landing on deleted monster's stat block
    navHistory = []
    currentScreen = { screen: 'monsters', uid: null }

    // Navigate directly to monster list
    showSection('monsters', true)
  }
}

function mbSave() {
  const d = mb.draft

  if (!d.name || !d.name.trim()) {
    showToast('Please enter a monster name.')
    return
  }

  // Check if in encounter-only mode
  if (mb.encounterOnlyMode && window.encounterContext && window.encounterContext.returnToEncounter) {
    const entry = mbBuildCompendiumEntry(d)

    // Add directly to encounter as custom combatant
    const hpNum = parseInt(entry.hp) || 10
    let spellSlots = null
    if (entry.slots) {
      const nums = entry.slots.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0)
      if (nums.length > 0) spellSlots = nums.map((total, i) => ({ level: i + 1, total, used: 0 }))
    }
    const initRoll = Math.floor(Math.random() * 20) + 1
    const traits = (entry.traits || []).map(t => {
      const inferred = (t.charges === null && t.recharge === null) ? parseUsesFromName(t.name) : {}
      const charges = t.charges !== null ? t.charges : (inferred.charges ?? null)
      const recharge = t.recharge !== null ? t.recharge : (inferred.recharge ?? null)
      return { ...t, charges, recharge, chargesCurrent: charges !== null ? charges : null }
    })

    enc.current.combatants.push({
      uid: makeCombatantUid(),
      name: entry.name,
      type: 'Monster',
      isPC: false,
      isEnemy: true,
      isEncounterOnly: true,
      cr: entry.cr || '0',
      initiative: initRoll,
      ac: entry.ac,
      speed: entry.speed,
      hpMax: hpNum,
      hpCurrent: hpNum,
      conditions: [],
      traits,
      actions: (entry.actions || []).map(a => {
        const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
        const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
        const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
        return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
      }),
      bonusActions: (entry.bonusActions || []).map(a => {
        const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
        const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
        const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
        return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
      }),
      reactions: (entry.reactions || []).map(a => {
        const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
        const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
        const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
        return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
      }),
      legendaries: (entry.legendaries || []).map(a => {
        const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
        const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
        const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
        return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
      }),
      lairs: (entry.lairs || []).map(a => {
        const inferred = (a.charges === null && a.recharge === null) ? parseUsesFromName(a.name) : {}
        const charges = a.charges !== null ? a.charges : (inferred.charges ?? null)
        const recharge = a.recharge !== null ? a.recharge : (inferred.recharge ?? null)
        return { ...a, charges, recharge, chargesCurrent: charges !== null ? charges : null }
      }),
      spellSlots,
      dailySpells: parseDailySpells(traits),
      spells: parseMonsterSpells(entry.spells, traits, entry.actions),
      portrait: entry.portrait || null,
      // Store full monster data for future edits
      fullMonsterData: entry
    })

    showToast(`${entry.name} added to encounter — initiative: ${initRoll}`)

    // Clean up and return to encounter
    mb.encounterOnlyMode = false
    window.encounterContext = null
    mb.dirty = false

    // Return to encounter builder
    if (typeof enterEncounterBuilder === 'function') {
      enterEncounterBuilder()
    } else if (typeof popNav === 'function') {
      popNav()
    } else {
      showSection('encounter', true)
    }

    // Refresh encounter view
    setTimeout(() => {
      if (typeof refreshInitSidebar === 'function') refreshInitSidebar()
      if (typeof refreshCards === 'function') refreshCards()
    }, 50)

    return
  }

  // Normal save to compendium
  const entry = mbBuildCompendiumEntry(d)

  const idx = compendiumData.monsters.findIndex(m => m.name === mb.originalName)
  if (idx >= 0) {
    compendiumData.monsters[idx] = entry
  } else {
    compendiumData.monsters.push(entry)
    compendiumData.monsters.sort((a,b) => a.name.localeCompare(b.name))
  }

  saveCompendium({monsters: compendiumData.monsters, spells: compendiumData.spells})
  mb.dirty = false
  showToast(`Monster "${entry.name}" saved.`)
  if (typeof popNav === 'function') popNav()
  else showSection('monsters')
}

function mbBack() {
  // Handle encounter-only mode
  if (mb.encounterOnlyMode) {
    if (!mb.dirty) {
      mb.encounterOnlyMode = false
      window.encounterContext = null
      if (typeof enterEncounterBuilder === 'function') {
        enterEncounterBuilder()
      } else if (typeof popNav === 'function') {
        popNav()
      } else {
        showSection('encounter', true)
      }
      return
    }
    const overlay = document.createElement('div')
    overlay.id = 'mb-discard-overlay'
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;
      display:flex;align-items:center;justify-content:center;`
    overlay.innerHTML = `
      <div style="background:#262F35;border:2px solid #4a9a9a;border-radius:8px;
                  padding:28px 32px;max-width:340px;text-align:center;font-family:var(--app-font);">
        <div style="font-size:16px;font-weight:bold;color:#e0d5c5;margin-bottom:10px;">Discard Changes?</div>
        <div style="color:#C8C8C8;font-size:13px;margin-bottom:22px;line-height:1.6;">
          You have unsaved changes that will be lost.
        </div>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button onclick="document.getElementById('mb-discard-overlay').remove();mb.encounterOnlyMode=false;window.encounterContext=null;mb.draft=null;mb.dirty=false;if(typeof enterEncounterBuilder==='function')enterEncounterBuilder();else if(typeof popNav==='function')popNav();else showSection('encounter',true)"
            style="${MBS.btnPrimary}">Discard</button>
          <button onclick="document.getElementById('mb-discard-overlay').remove()"
            style="${MBS.btnSecondary}">Keep Editing</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)
    return
  }

  // Normal mode
  if (!mb.dirty) {
    if (typeof popNav === 'function') popNav()
    else showSection('monsters')
    return
  }
  const overlay = document.createElement('div')
  overlay.id = 'mb-discard-overlay'
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:1000;
    display:flex;align-items:center;justify-content:center;`
  overlay.innerHTML = `
    <div style="background:#262F35;border:2px solid #4a9a9a;border-radius:8px;
                padding:28px 32px;max-width:340px;text-align:center;font-family:var(--app-font);">
      <div style="font-size:16px;font-weight:bold;color:#e0d5c5;margin-bottom:10px;">Discard Changes?</div>
      <div style="color:#C8C8C8;font-size:13px;margin-bottom:22px;line-height:1.6;">
        You have unsaved changes that will be lost.
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="document.getElementById('mb-discard-overlay').remove();mb.draft=null;mb.dirty=false;if(typeof popNav==='function')popNav();else showSection('monsters')"
          style="${MBS.btnPrimary}">Discard</button>
        <button onclick="document.getElementById('mb-discard-overlay').remove()"
          style="${MBS.btnSecondary}">Keep Editing</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

// ── Circle Toggle Helpers ─────────────────────────────────────────
function mbToggleHomebrew() {
  mb.draft.homebrew = !mb.draft.homebrew

  // If homebrew is now ON, turn third party OFF
  if (mb.draft.homebrew) {
    mb.draft.thirdParty = false
    const otherCircle = document.getElementById('circle-mb-thirdparty')
    if (otherCircle) {
      otherCircle.style.background = 'transparent'
      otherCircle.style.borderColor = '#666'
    }
  }

  // Update homebrew circle visual state
  const circle = document.getElementById('circle-mb-homebrew')
  if (circle) {
    circle.style.background = mb.draft.homebrew ? '#4587A2' : 'transparent'
    circle.style.borderColor = mb.draft.homebrew ? '#4587A2' : '#666'
  }

  mb.dirty = true
}

function mbToggleThirdParty() {
  mb.draft.thirdParty = !mb.draft.thirdParty

  // If third party is now ON, turn homebrew OFF
  if (mb.draft.thirdParty) {
    mb.draft.homebrew = false
    const otherCircle = document.getElementById('circle-mb-homebrew')
    if (otherCircle) {
      otherCircle.style.background = 'transparent'
      otherCircle.style.borderColor = '#666'
    }
  }

  // Update third party circle visual state
  const circle = document.getElementById('circle-mb-thirdparty')
  if (circle) {
    circle.style.background = mb.draft.thirdParty ? '#4587A2' : 'transparent'
    circle.style.borderColor = mb.draft.thirdParty ? '#4587A2' : '#666'
  }

  mb.dirty = true
}

function mbToggleAlignmentTypically() {
  mb.draft.alignmentTypically = !mb.draft.alignmentTypically

  // Update circle visual state
  const circle = document.getElementById('circle-mb-alignment-typically')
  if (circle) {
    circle.style.background = mb.draft.alignmentTypically ? '#4587A2' : 'transparent'
    circle.style.borderColor = mb.draft.alignmentTypically ? '#4587A2' : '#666'
  }

  mb.dirty = true
}

// ── Global exposure for inline onclick handlers ───────────────────
window.openMonsterBuilder = openMonsterBuilder
window.mbDelete = mbDelete
window.mbBack = mbBack
window.mbSave = mbSave
window.mbStartScratch = mbStartScratch
window.mbShowMonsterPicker = mbShowMonsterPicker
window.mbCancelMonsterPicker = mbCancelMonsterPicker
window.mbFilterMonsterPicker = mbFilterMonsterPicker
window.mbUpdateMonsterResults = mbUpdateMonsterResults
window.mbSelectMonster = mbSelectMonster
window.mbPortraitPick = mbPortraitPick
window.mbToggleHomebrew = mbToggleHomebrew
window.mbToggleThirdParty = mbToggleThirdParty
window.mbToggleAlignmentTypically = mbToggleAlignmentTypically
window.mbToggleStPicker = mbToggleStPicker
window.mbAddSavingThrow = mbAddSavingThrow
window.mbRemoveSavingThrow = mbRemoveSavingThrow
window.mbToggleSkillPicker = mbToggleSkillPicker
window.mbAddSkill = mbAddSkill
window.mbRemoveSkill = mbRemoveSkill
window.mbStartDrag = mbStartDrag
window.mbMouseDrag = mbMouseDrag
window.mbMouseDrop = mbMouseDrop
window.mbUpdateDropIndicator = mbUpdateDropIndicator
window.MBS = MBS
window.MB_SIZES = MB_SIZES
window.MB_TYPES = MB_TYPES
window.MB_SKILLS_LIST = MB_SKILLS_LIST
window.MB_ABILITIES_LIST = MB_ABILITIES_LIST
window.MB_ENVIRONMENTS = MB_ENVIRONMENTS
window.MB_DIE_SIZES = MB_DIE_SIZES
window.MB_ALIGNMENTS = MB_ALIGNMENTS
window.MB_AC_MODS = MB_AC_MODS
window.MB_SPEED_TYPES = MB_SPEED_TYPES
window.MB_DAMAGE_TYPES = MB_DAMAGE_TYPES
window.MB_CONDITIONS = MB_CONDITIONS
window.MB_TAG_OPTIONS = MB_TAG_OPTIONS
window.MB_CR_TABLE = MB_CR_TABLE
window.mbEsc = mbEsc
// parseDamageString exposed by renderer.js - no need to re-assign here
window.mbBuildCompendiumEntry = mbBuildCompendiumEntry
window.mbCardWrap = mbCardWrap
window.mbRenderHeader = mbRenderHeader
window.mbRenderCombat = mbRenderCombat
window.mbRenderSpeedPicker = mbRenderSpeedPicker
window.mbRenderAbilityScores = mbRenderAbilityScores
window.mbRenderSavingThrows = mbRenderSavingThrows
window.mbRenderSkills = mbRenderSkills
window.mbRenderDamageTypes = mbRenderDamageTypes
window.mbRenderConditionImmunities = mbRenderCondImmune
window.mbRenderSenses = mbRenderSenses
window.mbRenderLanguages = mbRenderLanguages
window.mbRenderCR = mbRenderCR
window.mbRenderAbilityGroup = mbRenderAbilityGroup
window.mbRenderSpells = mbRenderSpells
window.mbRenderSpellPickerHtml = mbRenderSpellPickerHtml
window.mbRenderDescription = mbRenderDescription
window.mbEditEntry = mbEditEntry
window.mbCloseEntry = mbCloseEntry
window.mbDeleteEntry = mbDeleteEntry
window.mbAddEntry = mbAddEntry
window.mbDraftEntry = mbDraftEntry
window.mbDraftEntryLU = mbDraftEntryLU
window.mbDraftEntryLUCount = mbDraftEntryLUCount
window.mbToggleAttack = mbToggleAttack
window.mbDraftEntryAtk = mbDraftEntryAtk
window.mbSpellPickerOpen = mbSpellPickerOpen
window.mbAddSpell = mbAddSpell
window.mbSelectSpell = mbSelectSpell
window.mbCancelSpellPick = mbCancelSpellPick
window.mbAddSpellWithUsage = mbAddSpellWithUsage
window.mbRemoveSpell = mbRemoveSpell
window.mbFilterSpells = mbFilterSpells
window.mbToggleEnvironment = mbToggleEnvironment
window.mbRefreshSection = mbRefreshSection
window.mbUpdateHpAvg = mbUpdateHpAvg
window.mbUpdateInitiative = mbUpdateInitiative
window.mbUpdateProficiencyDisplay = mbUpdateProficiencyDisplay
window.mbProficiencyFromCR = mbProficiencyFromCR
window.mbAvgHp = mbAvgHp
window.mbModStr = mbModStr
window.mbSpeedSetType = mbSpeedSetType
window.mbSpeedSetFt = mbSpeedSetFt
window.mbSpeedAdd = mbSpeedAdd
window.mbSpeedRemove = mbSpeedRemove
window.mbDrumPicker = mbDrumPicker
window.mbDrumWheel = mbDrumWheel
window.mbDrumClick = mbDrumClick
window.mbAddTag = mbAddTag
window.mbAddCustomTag = mbAddCustomTag
window.mbRemoveTag = mbRemoveTag
window.mbFilterTagOptions = mbFilterTagOptions
