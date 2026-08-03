// ── Spell Builder ─────────────────────────────────────────────────

const SB_LEVELS = ['Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const SB_SCHOOLS = ['None', 'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
  'Evocation', 'Illusion', 'Necromancy', 'Transmutation']

// Drum picker state (mirrors Monster Builder pattern)
const sbDrumState = {}

window.sb = window.sb || {
  draft: null,
  originalName: null,
  dirty: false,
  step: 'choice',  // 'choice' or 'form'
  spellPickerOpen: false,
  spellPickerQuery: '',
  drumOpen: false,
  drumField: null,
  drumValue: null
}

function openSpellBuilder(name) {
  if (typeof pushNav === 'function') {
    pushNav('spell-builder', name)
  } else if (typeof window.currentScreen !== 'undefined') {
    window.currentScreen = { screen: 'spell-builder', uid: name }
  }

  if (name) {
    // Editing existing spell - go straight to form
    const s = compendiumData.spells.find(x => x.name === name)
    if (!s) return
    sb.draft = sbFromCompendium(s)
    sb.originalName = s.name
    sb.step = 'form'
  } else {
    // Creating new - show choice screen
    sb.step = 'choice'
    sb.draft = null
    sb.originalName = null
  }

  sb.dirty = false
  sb.spellPickerOpen = false
  sb.spellPickerQuery = ''
  sb.drumOpen = false
  sb.drumField = null
  sb.drumValue = null

  const content = document.getElementById('content')
  content.style.padding = '0'
  content.style.overflow = 'auto'
  content.style.overflowY = 'auto'
  renderSpellBuilder()
}

// ── Choice Screen ─────────────────────────────────────────────────
function renderSpellBuilderChoice() {
  const content = document.getElementById('content')
  if (!content) return
  content.innerHTML = `
    <div style="max-width:700px;margin:0 auto;padding:40px 20px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h2 style="font-size:24px;color:#e0d5c5;margin-bottom:8px;">Create Spell</h2>
        <p style="font-size:14px;color:#C8C8C8;">Choose how to create your spell</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div onclick="sbStartScratch()"
          style="background:#5C5C5C;border:4px solid #2E2F2D;padding:28px 20px;border-radius:8px;
                 cursor:pointer;text-align:center;transition:border-color .2s;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;gap:12px;"
          onmouseover="this.style.background='#6E6E6E'"
          onmouseout="this.style.background='#5C5C5C'">
          <img src="assets/New_Spell.png" alt="Start from Scratch"
            style="max-width:100%;max-height:200px;object-fit:contain;" />
          <div style="font-family:var(--app-font);font-size:14px;color:#e0d5c5;">
            Create from scratch
          </div>
        </div>

        <div onclick="sbShowSpellPicker()"
          style="background:#5C5C5C;border:4px solid #2E2F2D;padding:28px 20px;border-radius:8px;
                 cursor:pointer;text-align:center;transition:border-color .2s;display:flex;
                 flex-direction:column;align-items:center;justify-content:center;gap:12px;"
          onmouseover="this.style.background='#6E6E6E'"
          onmouseout="this.style.background='#5C5C5C'">
          <img src="assets/Copy_Existing_Spell.png" alt="Copy Existing"
            style="max-width:100%;max-height:200px;object-fit:contain;" />
          <div style="font-family:var(--app-font);font-size:14px;color:#e0d5c5;">
            Copy existing spell
          </div>
        </div>
      </div>

      <div style="text-align:center;">
        <button onclick="popNav()"
          style="background:#3E3E3D;color:#e0d5c5;border:4px solid #2E2F2D;padding:7px 14px;
                 border-radius:4px;cursor:pointer;font-family:var(--app-font);font-size:13px;">
          Cancel
        </button>
      </div>
    </div>
  `
}

function sbStartScratch() {
  sb.draft = sbBlankDraft()
  sb.originalName = null
  sb.step = 'form'
  sb.dirty = false
  renderSpellBuilder()
}

function sbBlankDraft() {
  return {
    name: '',
    level: '0',
    school: '',
    ritual: false,
    time: '',
    range: '',
    v: false,
    s: false,
    m: false,
    materials: '',
    duration: '',
    text: '',
    classes: '',
    source: '',
    roll: '',
    homebrew: false,
    thirdParty: false
  }
}

// ── Spell Picker (Copy Existing) ──────────────────────────────────
function sbShowSpellPicker() {
  sb.spellPickerOpen = true
  sb.spellPickerQuery = ''
  renderSpellBuilder()
}

function sbCloseSpellPicker() {
  sb.spellPickerOpen = false
  renderSpellBuilder()
}

function sbSelectSpell(name) {
  const spell = compendiumData.spells.find(s => s.name === name)
  if (!spell) return

  sb.draft = sbFromCompendium(spell)
  sb.originalName = null  // It's a copy, not editing the original
  sb.spellPickerOpen = false
  sb.step = 'form'
  sb.dirty = false
  renderSpellBuilder()
}

function sbFromCompendium(spell) {
  // Use separate component fields if available (new format), otherwise parse components string (old format)
  let hasV, hasS, hasM, materials

  if (spell.verbal !== undefined) {
    // New format with separate fields
    hasV = spell.verbal
    hasS = spell.somatic
    hasM = spell.material
    materials = spell.materials || ''
  } else {
    // Old format with components string
    const comp = spell.components || ''
    hasV = comp.includes('V')
    hasS = comp.includes('S')
    hasM = comp.includes('M')
    materials = ''
    if (hasM) {
      const match = comp.match(/M \(([^)]+)\)/)
      materials = match ? match[1] : ''
    }
  }

  return {
    name: spell.name,
    level: spell.level || '0',
    school: spell.school || '',
    ritual: spell.ritual === true,
    time: spell.time || '',
    range: spell.range || '',
    v: hasV === true,
    s: hasS === true,
    m: hasM === true,
    materials: materials,
    duration: spell.duration || '',
    text: spell.text || '',
    classes: spell.classes || '',
    source: Array.isArray(spell.source) ? spell.source.join(', ') : (spell.source || ''),
    homebrew: spell.homebrew === true,
    thirdParty: spell.thirdParty === true
  }
}

function sbToCompendium(draft) {
  // Build components string from checkboxes
  const parts = []
  if (draft.v) parts.push('V')
  if (draft.s) parts.push('S')
  if (draft.m) {
    if (draft.materials.trim()) {
      parts.push(`M (${draft.materials.trim()})`)
    } else {
      parts.push('M')
    }
  }
  const components = parts.join(', ')

  return {
    name: draft.name.trim(),
    level: draft.level,
    school: draft.school,
    ritual: draft.ritual,
    time: draft.time.trim(),
    range: draft.range.trim(),
    components: components,
    verbal: draft.v,
    somatic: draft.s,
    material: draft.m,
    materials: draft.materials.trim(),
    duration: draft.duration.trim(),
    text: draft.text.trim(),
    classes: draft.classes.trim(),
    source: splitSourceString(draft.source || ''),
    homebrew: draft.homebrew === true,
    thirdParty: draft.thirdParty === true,
    _custom: true
  }
}

// ── Main Render ───────────────────────────────────────────────────
function renderSpellBuilder() {
  if (sb.spellPickerOpen) {
    renderSpellPickerScreen()
  } else if (sb.step === 'choice') {
    renderSpellBuilderChoice()
  } else {
    renderSpellBuilderForm()
  }
}

// ── Spell Picker Screen (FIX 6: Match Monster Builder style) ─────
function renderSpellPickerScreen() {
  const content = document.getElementById('content')
  if (!content) return
  content.style.padding = '24px 24px 24px 240px'
  content.style.overflow = 'auto'

  // Only render static UI (header, input) once - prevents focus loss on keystroke
  const existingContainer = document.getElementById('sb-spell-picker-container')
  if (!existingContainer) {
    content.innerHTML = `
      <div id="sb-spell-picker-container">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <button onclick="sbCloseSpellPicker()"
            style="background:#3E3E3D;color:#e0d5c5;border:4px solid #2E2F2D;padding:6px 14px;
                   cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
            &#8592; Back
          </button>
          <h2 style="flex:1;font-size:20px;color:#e0d5c5;margin:0;">
            Select Spell to Copy
          </h2>
        </div>

        <input id="spell-picker-search" type="text" placeholder="Search spells…"
          value="${sb.spellPickerQuery}"
          oninput="sb.spellPickerQuery = this.value; sbUpdatePickerResults()"
          style="width:100%;max-width:500px;padding:8px 12px;margin-bottom:16px;background:#5C5C5C;
                 border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
                 border-radius:4px;font-size:14px;display:block;" />

        <div id="spell-picker-results"></div>
      </div>
    `

    // Focus search input after render
    setTimeout(() => {
      const searchInput = document.getElementById('spell-picker-search')
      if (searchInput) searchInput.focus()
    }, 0)
  }

  // Always update results
  sbUpdatePickerResults()
}

function sbUpdatePickerResults() {
  const resultsDiv = document.getElementById('spell-picker-results')
  if (!resultsDiv) return

  const allSpells = compendiumData.spells || []
  const query = sb.spellPickerQuery.toLowerCase()
  const filtered = query
    ? allSpells.filter(s =>
        s.name.toLowerCase().includes(query) ||
        (s.classes || '').toLowerCase().includes(query))
    : allSpells

  resultsDiv.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;overflow:hidden;">
      ${filtered.length === 0
        ? '<p style="color:#C8C8C8;grid-column:1/-1;">No spells match that search.</p>'
        : filtered.map(s => {
          const isCantrip = s.level === '0' || s.level === '' || !s.level
          const levelText = isCantrip ? 'Cantrip' : `Level ${s.level}`
          const schoolName = s.school || 'Unknown'
          return `
          <div onclick="sbSelectSpell('${s.name.replace(/'/g, "\\'")}')"
            style="background:#262F35;border:1px solid #2E2F2D;padding:12px;border-radius:4px;cursor:pointer;"
            onmouseover="this.style.borderColor='#4a9a9a'"
            onmouseout="this.style.borderColor='#2E2F2D'">
            <div style="font-weight:bold;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#7B9BA8;">
              ${s.name}
            </div>
            <div style="font-size:12px;color:#C8C8C8;">${levelText} — ${schoolName}</div>
            ${s.classes ? `<div style="font-size:11px;color:#888;margin-top:2px;">${s.classes}</div>` : ''}
          </div>
        `}).join('')}
    </div>
  `
}

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

// ── Form Screen ───────────────────────────────────────────────────
function renderSpellBuilderForm() {
  if (!sb.draft) return

  const content = document.getElementById('content')
  if (!content) return

  const d = sb.draft
  const levelDisplay = d.level === '0' ? 'Cantrip' : d.level
  const schoolDisplay = d.school || 'None'

  // Helper function to escape HTML in attributes
  const esc = (str) => String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  content.innerHTML = `
    <div style="min-height:100%;background:linear-gradient(#5C5C5C 40px, transparent 40px),
                linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
                url('assets/Background.png') left -40px/1641px auto no-repeat fixed;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:16px 20px 12px 20px;
           background:#5C5C5C;border-bottom:4px solid #2E2F2D;flex-shrink:0;
           padding-left:240px;box-sizing:border-box;">
        <button onclick="sbHandleBack()"
          style="background:#3E3E3D;border:4px solid #2E2F2D;color:#e0d5c5;padding:6px 14px;
                 cursor:pointer;border-radius:4px;font-family:var(--app-font);font-size:13px;">
          ← Back
        </button>
        <h2 style="font-size:18px;color:#e0d5c5;margin:0;flex:1;text-align:center;">
          ${sb.originalName ? 'Edit' : 'Create'} Spell
        </h2>
        <button onclick="sbSave()"
          style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 16px;
                 border-radius:4px;cursor:pointer;font-family:var(--app-font);font-size:13px;"
          onmouseover="this.style.borderColor='#4a9a9a';this.style.color='#e0d5c5'"
          onmouseout="this.style.borderColor='#445E22';this.style.color='#909090'">
          Save
        </button>
      </div>
      <!-- Form -->
      <div style="padding:20px;max-width:800px;margin:0 auto;">

      <!-- Block 1: Main spell data -->
      <div style="background:#262F35;border:1px solid #2E2F2D;border-radius:6px;padding:20px;margin-bottom:14px;">

        <!-- Name -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">NAME</label>
          <input type="text" value="${esc(d.name)}" oninput="sb.draft.name = this.value; sb.dirty = true"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
        </div>

        <!-- Level and School side-by-side (FIX 1: Drum pickers) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
          <div>
            <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                          letter-spacing:0.05em;">LEVEL</label>
            <div id="sb-drum-level-container"></div>
          </div>
          <div>
            <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                          letter-spacing:0.05em;">SCHOOL</label>
            <input type="text" value="${esc(d.school)}" oninput="sb.draft.school = this.value; sb.dirty = true"
              placeholder="e.g. Evocation"
              style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                     color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
          </div>
        </div>

        <!-- Ritual (FIX 6: Circle toggle) -->
        <div style="margin-bottom:20px;">
          ${circleToggle('sb-ritual', d.ritual, 'sb.draft.ritual = !sb.draft.ritual; sb.dirty = true; renderSpellBuilder()', 'RITUAL', true)}
        </div>

        <!-- Casting Time -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">TIME</label>
          <input type="text" value="${esc(d.time)}" oninput="sb.draft.time = this.value; sb.dirty = true"
            placeholder="e.g. 1 action"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
        </div>

        <!-- Range -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">RANGE</label>
          <input type="text" value="${esc(d.range)}" oninput="sb.draft.range = this.value; sb.dirty = true"
            placeholder="e.g. 60 feet"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
        </div>

        <!-- Components (FIX 3: All toggles work independently; FIX 4: Show greyed materials field) -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">COMPONENTS</label>
          <div style="display:flex;gap:20px;margin-bottom:8px;">
            ${circleToggle('sb-v', d.v, 'sb.draft.v = !sb.draft.v; sb.dirty = true', 'Verbal (V)')}
            ${circleToggle('sb-s', d.s, 'sb.draft.s = !sb.draft.s; sb.dirty = true', 'Somatic (S)')}
            ${circleToggle('sb-m', d.m, 'sbToggleMaterialsInput()', 'Material (M)')}
          </div>
          <input id="sb-materials-input" type="text" value="${esc(d.materials)}"
            oninput="if(sb.draft.m) { sb.draft.materials = this.value; sb.dirty = true; }"
            placeholder="e.g. a pinch of sulfur"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;
                   opacity:${d.m ? '1' : '0.4'};pointer-events:${d.m ? 'auto' : 'none'};
                   cursor:${d.m ? 'text' : 'not-allowed'};" />
        </div>

        <!-- Duration -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">DURATION</label>
          <input type="text" value="${esc(d.duration)}" oninput="sb.draft.duration = this.value; sb.dirty = true"
            placeholder="e.g. Instantaneous"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
        </div>

        <!-- Description -->
        <div style="margin-bottom:0;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">DESCRIPTION</label>
          <textarea oninput="sb.draft.text = this.value; sb.dirty = true"
            rows="8"
            placeholder="Spell description..."
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;
                   resize:vertical;">${esc(d.text)}</textarea>
        </div>

      </div>

      <!-- Block 2: Classes and Source (FIX 5: Rename Classes) -->
      <div style="background:#262F35;border:1px solid #2E2F2D;border-radius:6px;padding:20px;margin-bottom:40px;">

        <!-- Classes/Subclasses -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">CLASSES/SUBCLASSES</label>
          <input type="text" value="${esc(d.classes)}" oninput="sb.draft.classes = this.value; sb.dirty = true"
            placeholder="e.g. Wizard, Sorcerer"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
        </div>

        <!-- Source -->
        <div style="margin-bottom:20px;">
          <label style="display:block;color:#4587A2;font-size:13px;font-weight:bold;margin-bottom:6px;
                        letter-spacing:0.05em;">SOURCE</label>
          <input type="text" value="${esc(d.source)}" oninput="sb.draft.source = this.value; sb.dirty = true"
            placeholder="e.g. Player's Handbook p. 123"
            style="width:100%;padding:10px 14px;background:#1A1C1E;border:2px solid #1e2d4a;
                   color:#e0d5c5;font-family:var(--app-font);border-radius:4px;font-size:14px;" />
        </div>

        <!-- Homebrew / Third Party Toggles -->
        <div style="display:flex;gap:24px;flex-wrap:wrap;">
          ${circleToggle('sb-homebrew', d.homebrew, 'sb.draft.homebrew = !sb.draft.homebrew; if (sb.draft.homebrew) { sb.draft.thirdParty = false; const otherCircle = document.getElementById(\'circle-sb-thirdparty\'); if (otherCircle) { otherCircle.style.background = \'transparent\'; otherCircle.style.borderColor = \'rgb(102, 102, 102)\'; } } sb.dirty = true', 'Homebrew')}
          ${circleToggle('sb-thirdparty', d.thirdParty, 'sb.draft.thirdParty = !sb.draft.thirdParty; if (sb.draft.thirdParty) { sb.draft.homebrew = false; const otherCircle = document.getElementById(\'circle-sb-homebrew\'); if (otherCircle) { otherCircle.style.background = \'transparent\'; otherCircle.style.borderColor = \'rgb(102, 102, 102)\'; } } sb.dirty = true', 'Third Party')}
        </div>

      </div>

      <!-- Delete Button (only when editing existing spell) -->
      ${sb.originalName ? `
        <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #2E2F2D;">
          <button onclick="sbDelete()"
            style="background:#3E1A1A;color:#E85D75;border:2px solid #5E2A2A;padding:10px 24px;
                   border-radius:4px;cursor:pointer;font-family:var(--app-font);font-size:13px;
                   font-weight:600;"
            onmouseover="this.style.background='#5E2A2A';this.style.borderColor='#E85D75'"
            onmouseout="this.style.background='#3E1A1A';this.style.borderColor='#5E2A2A'">
            Delete Spell
          </button>
        </div>
      ` : ''}

    </div>
    </div>
  `

  // Mount drum pickers after innerHTML is set (FIX 1: iOS-style drum pickers)
  const levelItems = SB_LEVELS.map(l =>
    l === 'Cantrip'
      ? {value: '0', label: 'Cantrip'}
      : {value: l, label: l}
  )

  const levelContainer = document.getElementById('sb-drum-level-container')
  if (levelContainer) {
    levelContainer.innerHTML = sbDrumPicker('level', levelItems, d.level, v => {
      sb.draft.level = v
      sb.dirty = true
    }, '100%')
  }
}

// ── iOS-style Drum Picker (copied from monster-builder.js) ────────
function sbDrumPicker(id, items, selectedValue, onChange, width, scale = 1.0) {
  const norm = items.map(it =>
    (typeof it === 'string' || typeof it === 'number')
      ? {value: it, label: String(it)}
      : it
  )
  let idx = norm.findIndex(it => String(it.value) === String(selectedValue))
  if (idx < 0) idx = 0
  const _lastWheel = sbDrumState[id] ? (sbDrumState[id]._lastWheel || 0) : 0
  sbDrumState[id] = {items: norm, idx, onChange, elSlots: [-1,0,1], _lastWheel, scale}

  const IH = 36
  const H  = IH * 3
  const bt = IH * 1
  const ws = width ? `width:${width};` : ''

  return `<div id="sbdrum-${id}"
    style="position:relative;height:${H}px;overflow:hidden;border-radius:6px;
           background:#1A1C1E;border:1px solid #2E2F2D;${ws}
           cursor:ns-resize;user-select:none;box-sizing:border-box;"
    onwheel="event.preventDefault();event.stopPropagation();sbDrumWheel('${id}',event)">
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
    <div id="sbdrum-items-${id}" style="position:relative;z-index:2;">
      ${sbDrumItems(id)}
    </div>
  </div>`
}

function sbDrumItems(id) {
  const state = sbDrumState[id]
  if (!state) return ''
  const {items, idx} = state
  const IH = 36, half = 1
  state.elSlots = [-1, 0, 1]
  let out = ''
  for (let k = 0; k < 3; k++) {
    const d     = k - half
    const item  = items[idx + d]
    const label = item ? String(item.label).replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
    const a     = Math.abs(d)
    const angle   = d * 30
    const scaleY  = a === 0 ? 1 : 0.84
    const opacity = a === 0 ? 1 : 0.60
    const color   = a === 0 ? '#e0d5c5' : '#5e7490'
    const fw      = a === 0 ? '600'     : '400'
    const sc      = state.scale || 1.0
    const fs      = a === 0 ? `${Math.round(13*sc)}px` : `${Math.round(12*sc)}px`
    out += `<div id="sbdrum-item-${id}-${k}" onclick="sbDrumClick('${id}',${d})"
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

function sbDrumApplySlot(id, k, d, withTransition) {
  const el = document.getElementById('sbdrum-item-' + id + '-' + k)
  if (!el) return
  const IH = 36, half = 1
  const a = Math.abs(d)
  const angle   = d * 30
  const scaleY  = a === 0 ? 1 : a === 1 ? 0.84 : 0.50
  const opacity = a <= half ? (a === 0 ? 1 : 0.60) : 0
  const color   = a === 0 ? '#e0d5c5' : '#5e7490'
  const fw      = a === 0 ? '600' : '400'
  const sc      = (sbDrumState[id] && sbDrumState[id].scale) || 1.0
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
  el.onclick = d !== 0 ? function() { sbDrumStep(id, Math.sign(d)) } : null
}

function sbDrumAnimate(id, step, ni) {
  const s = sbDrumState[id]
  if (!s || !s.elSlots) return
  const half = 1
  const exitD     = step > 0 ? -half       : +half
  const incomingD = step > 0 ? +(half + 1) : -(half + 1)
  const finalD    = step > 0 ? +half       : -half

  const exitK = s.elSlots.indexOf(exitD)
  if (exitK < 0) return

  const newItemIdx = ni + step * half
  const newItem = (newItemIdx >= 0 && newItemIdx < s.items.length) ? s.items[newItemIdx] : null

  sbDrumApplySlot(id, exitK, incomingD, false)
  const exitEl = document.getElementById('sbdrum-item-' + id + '-' + exitK)
  if (exitEl) {
    exitEl.textContent = newItem ? newItem.label : ''
    void exitEl.offsetHeight
  }

  for (let k = 0; k < 3; k++) {
    s.elSlots[k] = (k === exitK) ? finalD : s.elSlots[k] - step
    sbDrumApplySlot(id, k, s.elSlots[k], true)
  }
}

function sbDrumStep(id, step) {
  const s = sbDrumState[id]
  if (!s) return
  const ni = Math.max(0, Math.min(s.items.length - 1, s.idx + step))
  if (ni === s.idx) return
  sbDrumAnimate(id, step, ni)
  s.idx = ni
  if (s.onChange) s.onChange(s.items[s.idx].value)
}

function sbDrumWheel(id, event) {
  event.preventDefault()
  const s = sbDrumState[id]
  if (!s) return
  const now = Date.now()
  if (now - s._lastWheel < 250) return
  s._lastWheel = now
  const step = event.deltaY > 0 ? 1 : -1
  sbDrumStep(id, step)
}

function sbDrumClick(id, d) {
  sbDrumStep(id, Math.sign(d))
}

// ── Save ──────────────────────────────────────────────────────────
function sbSave() {
  if (!sb.draft) return

  const name = sb.draft.name.trim()
  if (!name) {
    showToast('Spell name is required')
    return
  }

  // Check for duplicate name (unless editing the same spell)
  const existing = compendiumData.spells.find(s => s.name === name)
  if (existing && name !== sb.originalName) {
    showToast('A spell with this name already exists')
    return
  }

  const spell = sbToCompendium(sb.draft)

  if (sb.originalName && sb.originalName !== name) {
    // Name changed - remove old, add new
    compendiumData.spells = compendiumData.spells.filter(s => s.name !== sb.originalName)
    compendiumData.spells.push(spell)
  } else if (sb.originalName) {
    // Editing - update in place
    const idx = compendiumData.spells.findIndex(s => s.name === sb.originalName)
    if (idx !== -1) {
      compendiumData.spells[idx] = spell
    }
  } else {
    // New spell
    compendiumData.spells.push(spell)
  }

  // Save to storage
  saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })

  showToast(`Spell "${name}" saved`)
  sb.dirty = false

  // Return to spells list
  popNav()
}

function sbHandleBack() {
  if (sb.dirty) {
    if (confirm('You have unsaved changes. Discard them?')) {
      popNav()
    }
  } else {
    popNav()
  }
}

// Toggle materials input field visibility/interactivity
function sbToggleMaterialsInput() {
  sb.draft.m = !sb.draft.m
  sb.dirty = true
  const matInput = document.getElementById('sb-materials-input')
  if (matInput) {
    matInput.style.opacity = sb.draft.m ? '1' : '0.4'
    matInput.style.pointerEvents = sb.draft.m ? 'auto' : 'none'
    matInput.style.cursor = sb.draft.m ? 'text' : 'not-allowed'
  }
}

// Delete spell
function sbDelete() {
  if (!sb.originalName) return

  if (confirm(`Delete spell "${sb.originalName}"?\n\nThis action cannot be undone.`)) {
    // Remove from compendiumData by matching name
    // (spells don't have reliable uids, so we match by name + _custom flag to avoid deleting XML originals)
    const spellToDelete = compendiumData.spells.find(s => s.name === sb.originalName)
    if (spellToDelete) {
      compendiumData.spells = compendiumData.spells.filter(s => s !== spellToDelete)
    }

    // Save to storage
    saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })

    showToast(`Spell "${sb.originalName}" deleted`)

    // Navigate back to spell list
    popNav()
  }
}

// Expose to window
window.openSpellBuilder = openSpellBuilder
window.sbStartScratch = sbStartScratch
window.sbShowSpellPicker = sbShowSpellPicker
window.sbCloseSpellPicker = sbCloseSpellPicker
window.sbSelectSpell = sbSelectSpell
window.sbUpdatePickerResults = sbUpdatePickerResults
window.sbDrumWheel = sbDrumWheel
window.sbDrumClick = sbDrumClick
window.sbToggleMaterialsInput = sbToggleMaterialsInput
window.sbDelete = sbDelete
window.sbSave = sbSave
window.sbHandleBack = sbHandleBack
