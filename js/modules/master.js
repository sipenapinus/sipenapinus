/**
 * SIPENA Lite — Master Coordinator & Seed Data (v6)
 * Mendelegasikan render ke module per entitas.
 * Menyediakan seed data awal jika database kosong.
 */
'use strict';

// ─────────────────────────────────────────────────────────────
//  Seed Data
// ─────────────────────────────────────────────────────────────
async function seedMasterData() {
  // Seeding master data is now handled entirely by seedDatabaseIfEmpty in app.js using seed-data.js.
  console.log('[Seeding] seedMasterData (legacy) skipped.');
}

// ─────────────────────────────────────────────────────────────
//  Tab Switcher & Render Dispatcher
// ─────────────────────────────────────────────────────────────
const MASTER_TABS = ['bkph', 'rph', 'tpg', 'petak', 'penyadap', 'penugasan', 'user'];

async function switchMasterTab(tab) {
  // Hide all panels
  MASTER_TABS.forEach(t => {
    const panel = document.getElementById(`tab-${t}`);
    if (panel) panel.style.display = 'none';
  });

  // Show active panel
  const active = document.getElementById(`tab-${tab}`);
  if (active) active.style.display = 'block';

  // Update button styles
  document.querySelectorAll('.master-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.className = `btn master-tab btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`;
  });

  // Render content
  const renderMap = {
    'bkph':       () => window.MasterBKPH.render(),
    'rph':        () => window.MasterRPH.render(),
    'tpg':        () => window.MasterTPG.render(),
    'petak':      () => window.MasterPetak.render(),
    'penyadap':   () => window.MasterPenyadap.render(),
    'penugasan':  () => window.MasterPenugasan.render(),
    'user':       () => window.MasterUser.render()
  };

  if (renderMap[tab]) await renderMap[tab]();
}

window.switchMasterTab = switchMasterTab;
window.seedMasterData  = seedMasterData;
