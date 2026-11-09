// ─── MOBILE SIDEBAR ───────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('sb-open');
  document.getElementById('sb-overlay-mobile').classList.toggle('sb-open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('sb-open');
  document.getElementById('sb-overlay-mobile').classList.remove('sb-open');
}

// Mobile sidebar auto-close is handled inside switchModule directly.

