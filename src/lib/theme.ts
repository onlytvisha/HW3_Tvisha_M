/**
 * The two themes, and the one piece of state that selects between them.
 *
 * `valentine` is the default palette. `paper` is the plainer cream-and-ink
 * alternative, for reading rather than being impressed at. Both are defined
 * in globals.css, both are light, and the only thing carried in JS is which
 * one is on.
 */

export type Theme = "valentine" | "paper";

export const THEME_STORAGE_KEY = "neon-archive-theme";

/**
 * Fired on `window` after the theme changes in this tab.
 *
 * The browser's own `storage` event only reaches *other* tabs, so without
 * this the switch would not re-render the control that triggered it.
 */
export const THEME_CHANGE_EVENT = "neon-archive:themechange";

/** The default, and what the server renders. */
export const DEFAULT_THEME: Theme = "valentine";

/**
 * Applies a theme to the document element.
 *
 * `data-theme` alone selects the palette. There used to be a `dark` class
 * alongside it, gating shadcn's `dark:` variants - stock-component
 * refinements written for a dark ground - back when the default theme was
 * dark. Both themes are light now, so nothing here ever wants those variants
 * and the class is never added.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  if (theme === "paper") {
    root.dataset.theme = "paper";
  } else {
    delete root.dataset.theme;
  }
}

/**
 * The same logic as a string, to run inline in <head> before first paint.
 *
 * Without this the server's `valentine` markup paints first and a stored
 * `paper` preference arrives only at hydration, which is a flash from one
 * palette to the other on every navigation. Wrapped in try/catch because
 * localStorage throws outright in a browser set to block site data, and a
 * theme preference is not worth taking the page down over.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="paper"){document.documentElement.dataset.theme="paper"}}catch(e){}`;
