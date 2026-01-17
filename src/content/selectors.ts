/**
 * DOM Selectors with Fallback Strategy
 *
 * Following Constitution Principle III (DOM Resilience):
 * - Use YouTube Web Components tags as primary selectors
 * - Provide fallback selectors for graceful degradation
 * - T036: Handle page-specific DOM differences
 */

import type { Selectors, SelectorConfig } from '../types';

/**
 * All DOM selectors used by the extension
 */
export const SELECTORS: Selectors = {
  sheet: {
    primary: 'yt-sheet-view-model',
    fallback: ['ytd-add-to-playlist-renderer', '[role="dialog"]'],
  },
  listContainer: {
    primary: 'yt-list-view-model',
    fallback: ['#playlists', '.ytd-add-to-playlist-renderer'],
  },
  listItem: {
    primary: 'yt-list-item-view-model',
    fallback: ['ytd-playlist-add-to-option-renderer'],
  },
  title: {
    primary: 'h2',
    fallback: ['[slot="title"]', '#title', '.title'],
  },
  createButton: {
    primary:
      'yt-button-view-model button[aria-label*="建立"], yt-button-view-model button[aria-label*="Create"]',
    fallback: ['#create-playlist-button', 'button[aria-label*="new playlist"]'],
  },
};

/**
 * Title patterns for identifying playlist save sheet (multi-language)
 * T036: Extended language support for cross-page compatibility
 *
 * IMPORTANT: Only use specific complete phrases to avoid false positives
 * on video context menus (three-dot menus) which contain generic terms
 * like "Add to playlist", "Save", etc.
 */
export const PLAYLIST_TITLE_PATTERNS = [
  '儲存至', // Traditional Chinese - "Save to"
  '保存到', // Simplified Chinese - "Save to"
  'save to playlist', // English - complete phrase only
  'save video to', // English - alternate phrasing
  'zu playlist hinzufügen', // German - full phrase
  'añadir a playlist', // Spanish - full phrase
  'ajouter à la playlist', // French - full phrase
  'aggiungi alla playlist', // Italian - full phrase
  '再生リストに保存', // Japanese - full phrase
  '재생목록에 저장', // Korean - full phrase
  'сохранить в плейлист', // Russian - full phrase
];

/**
 * Find element using selector with fallback strategy
 * @param parent Parent element to search within
 * @param config Selector configuration with primary and fallbacks
 * @returns Found element or null
 */
export function findElement(parent: Element | Document, config: SelectorConfig): Element | null {
  // Try primary selector first
  const primary = parent.querySelector(config.primary);
  if (primary) return primary;

  // Try fallback selectors
  for (const fallback of config.fallback) {
    const element = parent.querySelector(fallback);
    if (element) return element;
  }

  return null;
}

/**
 * Find all elements using selector with fallback strategy
 * @param parent Parent element to search within
 * @param config Selector configuration with primary and fallbacks
 * @returns NodeList of found elements
 */
export function findAllElements(
  parent: Element | Document,
  config: SelectorConfig
): NodeListOf<Element> {
  // Try primary selector first
  const primary = parent.querySelectorAll(config.primary);
  if (primary.length > 0) return primary;

  // Try fallback selectors
  for (const fallback of config.fallback) {
    const elements = parent.querySelectorAll(fallback);
    if (elements.length > 0) return elements;
  }

  return parent.querySelectorAll('__never_match__'); // Return empty NodeList
}
