// ── Renderer patches for Monster Builder ─────────────────────────
// Overrides renderMonsters, renderMonsterGrid, filterMonsters, importXML

function renderMonsters(container) {
  if (compendiumData.monsters.length === 0) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h2 style="font-size:22px;color:#e0d5c5;">Monsters</h2>
        <button onclick="openMonsterBuilder(null)"
          style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 18px;
                 cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
          + Create Monster
        </button>
      </div>
      <p style="color:#555;margin-bottom:16px;">No compendium monsters loaded. Import your compendium XML or create one from scratch.</p>
      <button onclick="importXML()"
        style="background:none;color:#e0d5c5;border:1px solid #8b0000;padding:9px 18px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);">
        Import Compendium XML
      </button>
    `
    return
  }
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <input id="monster-search" type="text" placeholder="Search monsters…"
        style="flex:1;min-width:180px;max-width:460px;padding:8px 12px;background:#5C5C5C;
               border:4px solid #2E2F2D;color:#1E231A;font-family:var(--app-font);
               border-radius:4px;font-size:14px;"
        oninput="filterMonsters(this.value)" />
      <button onclick="openMonsterBuilder(null)"
        style="background:#1E231A;color:#909090;border:2px solid #445E22;padding:8px 18px;
               cursor:pointer;border-radius:4px;font-size:13px;font-family:var(--app-font);
               white-space:nowrap;">
        + Create Monster
      </button>
    </div>
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
  grid.innerHTML = monsters.map(m => {
    const isHomebrew = m._draft?.homebrew || m.homebrew
    const isThirdParty = m._draft?.thirdParty || m.thirdParty
    return `
    <div onclick="showMonster(decodeURIComponent(this.dataset.name))" data-name="${encodeURIComponent(m.name)}"
      style="background:#262F35;border:1px solid ${m._custom ? '#3a1a1a' : '#1e2d4a'};
             padding:12px;border-radius:4px;cursor:pointer;position:relative;"
      onmouseover="this.style.borderColor='#4a9a9a'" onmouseout="this.style.borderColor='${m._custom ? '#3a1a1a' : '#1e2d4a'}'">
      ${isHomebrew ? `
        <div style="position:absolute;top:6px;right:6px;background:#8b0000;color:#e0d5c5;
                    font-size:10px;padding:3px 6px;border-radius:3px;font-weight:700;
                    line-height:1;letter-spacing:.03em;">H</div>
      ` : ''}
      ${isThirdParty ? `
        <div style="position:absolute;top:6px;right:6px;background:#c9a87c;color:#0a1520;
                    font-size:10px;padding:3px 6px;border-radius:3px;font-weight:700;
                    line-height:1;letter-spacing:.03em;">3</div>
      ` : ''}
      ${m.portrait ? `
        <div style="width:100%;height:80px;margin-bottom:8px;border-radius:3px;overflow:hidden;">
          <img src="${m.portrait}" style="width:100%;height:100%;object-fit:cover;">
        </div>
      ` : ''}
      <div style="font-weight:bold;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4587A2;">
        ${m.name}
      </div>
      <div style="font-size:12px;color:#666;">${m.size} ${m.type}</div>
      <div style="font-size:12px;color:#666;">CR ${m.cr || '—'}</div>
    </div>
  `}).join('')
}

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
        // Preserve custom monsters before overwriting
        const customMonsters = compendiumData.monsters.filter(m => m._custom)
        parseCompendium(xml)
        // Re-merge custom monsters (custom overrides XML entry of same name)
        customMonsters.forEach(cm => {
          const idx = compendiumData.monsters.findIndex(m => m.name === cm.name)
          if (idx >= 0) compendiumData.monsters[idx] = cm
          else compendiumData.monsters.push(cm)
        })
        compendiumData.monsters.sort((a, b) => a.name.localeCompare(b.name))
        saveCompendium({ monsters: compendiumData.monsters, spells: compendiumData.spells })
        const customCount = customMonsters.length
        const note = customCount > 0 ? ` (${customCount} custom preserved)` : ''
        showToast(`Compendium loaded: ${compendiumData.monsters.length} monsters, ${compendiumData.spells.length} spells${note}`)
        showSection('home')
      } catch (err) {
        showToast('Error: ' + err.message)
      }
    }
    reader.readAsText(file)
  }
  input.click()
}
