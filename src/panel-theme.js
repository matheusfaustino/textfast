/**
 * panel-theme.js — single source of truth for colors and reusable inline-style
 * helpers shared between settings-panel.js (userscript modal) and config.css
 * (extension config page).
 *
 * Light palette — mirrors the CSS variables in public/css/config.css.
 */

export const C = {
  bg:      '#f6f6fb',  // page background (very slight lavender tint)
  surface: '#ffffff',  // card / input background
  overlay: '#dde1f0',  // borders
  text:    '#18181f',  // primary text
  muted:   '#636380',  // secondary text
  dim:     '#a0a0c0',  // placeholders
  accent:  '#7c3aed',  // vivid purple
  red:     '#d63060',  // shortcut labels / delete
  green:   '#1a8a45',  // add / success
  blue:    '#2d6be4',  // import
  teal:    '#0a8e8e',  // export
  yellow:  '#c07c08',  // warning
};

// ---------------------------------------------------------------------------
// Inline-style helpers (used by settings-panel.js for the injected modal)
// ---------------------------------------------------------------------------

export function inputStyle(extra) {
  return `background:${C.surface};border:1px solid ${C.overlay};border-radius:6px;`
    + `color:${C.text};padding:6px 10px;outline:none;font-size:13px;`
    + `box-sizing:border-box;font-family:inherit;${extra || ''}`;
}

export function btnStyle(bg, fg) {
  fg = fg || '#ffffff';
  return `background:${bg};border:none;border-radius:6px;color:${fg};`
    + `font-weight:600;padding:7px 14px;cursor:pointer;font-size:13px;`
    + `white-space:nowrap;font-family:inherit`;
}

export function tableHeaderStyle() {
  return `text-align:left;padding:6px 8px;border-bottom:1px solid ${C.overlay};`
    + `color:${C.muted};font-weight:600`;
}
