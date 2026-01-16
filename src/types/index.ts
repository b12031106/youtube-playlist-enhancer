/**
 * YouTube Playlist Enhancer - Type Definitions
 */

export const EXTENSION_VERSION = '1.0.0';

/**
 * Represents a single playlist item in the save menu
 */
export interface PlaylistItem {
  /** Reference to the DOM element */
  element: Element;
  /** Playlist ID extracted from DOM attributes (if available) */
  id?: string;
  /** Playlist name displayed to user */
  name: string;
  /** Whether currently selected/checked */
  isSelected: boolean;
  /** Whether video was already in this playlist when menu opened */
  wasOriginallySelected: boolean;
}

/**
 * Manages selection state for the current menu session
 */
export interface SelectionState {
  /** Map of DOM elements to their playlist item data */
  items: Map<Element, PlaylistItem>;
  /** Count of currently selected items (computed) */
  readonly selectedCount: number;
  /** Whether any changes from original state (computed) */
  readonly hasChanges: boolean;
}

/**
 * Manages search/filter state
 */
export interface SearchState {
  /** Current search query */
  query: string;
  /** Count of items matching filter (computed) */
  readonly filteredCount: number;
  /** Whether search returned no results (computed) */
  readonly hasNoResults: boolean;
}

/**
 * Extension configuration stored in chrome.storage.sync
 */
export interface EnhancerConfig {
  /** Master enable/disable switch */
  enabled: boolean;
  /** Auto-focus search box when menu opens */
  autoFocusSearch: boolean;
  /** Debounce delay for search input (ms) */
  debounceMs: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: EnhancerConfig = {
  enabled: true,
  autoFocusSearch: true,
  debounceMs: 150,
};

/**
 * DOM selector with fallback strategy
 */
export interface SelectorConfig {
  /** Primary selector to try first */
  primary: string;
  /** Fallback selectors if primary fails */
  fallback: string[];
}

/**
 * All DOM selectors used by the extension
 */
export interface Selectors {
  /** Save to playlist sheet/modal container */
  sheet: SelectorConfig;
  /** List container holding playlist items */
  listContainer: SelectorConfig;
  /** Individual playlist item */
  listItem: SelectorConfig;
  /** Sheet title for identification */
  title: SelectorConfig;
  /** Create new playlist button */
  createButton: SelectorConfig;
}

/**
 * Toast notification types
 */
export type ToastType = 'success' | 'error' | 'info';

/**
 * Callback for when playlist sheet is detected
 */
export type SheetCallback = (sheet: Element) => void;

/**
 * Search filter callback
 */
export type FilterCallback = (query: string) => void;
