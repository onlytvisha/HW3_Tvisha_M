/**
 * The two themes, and the one piece of state that selects between them.
 *
 * `neon` is the default synthwave palette. `paper` is the calm cream-and-ink
 * alternative, for reading rather than being impressed at. Both are defined
 * in globals.css; the only thing carried in JS is which one is on.
 */

export type Theme = "neon" | "paper";

export const THEME_STORAGE_KEY = "neon-archive-theme";

/**
 * Fired on `window` after the theme changes in this tab.
 *
 * The browser's own `storage` event only reaches *other* tabs, so without
 * this the switch would not re-render the control that triggered it.
 */
export const THEME_CHANGE_EVENT = "neon-archive:themechange";

/** The default, and what the server renders. */
export const DEFAULT_THEME: Theme = "neon";

/**
 * Applies a theme to the document element.
 *
 * Two attributes move together: `data-theme` selects the palette, and the
 * `dark` class gates shadcn's `dark:` variants, which are stock-component
 * refinements (input tints, blend modes, ring opacities) written for a dark
 * ground and wrong on a light one.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  if (theme === "paper") {
    root.dataset.theme = "paper";
    root.classList.remove("dark");
  } else {
    delete root.dataset.theme;
    root.classList.add("dark");
  }
}

/**
 * The same logic as a string, to run inline in <head> before first paint.
 *
 * Without this the server's `neon` markup paints first and a stored `paper`
 * preference arrives only at hydration, which is a full-screen flash from
 * near-black to cream on every navigation. Wrapped in try/catch because
 * localStorage throws outright in a browser set to block site data, and a
 * theme preference is not worth taking the page down over.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="paper"){var e=document.documentElement;e.dataset.theme="paper";e.classList.remove("dark")}}catch(e){}`;
