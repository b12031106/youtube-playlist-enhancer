/**
 * YouTube Playlist Enhancer - Type Definitions
 */

// Version is injected by webpack DefinePlugin from package.json
declare const __EXTENSION_VERSION__: string;
export const EXTENSION_VERSION = typeof __EXTENSION_VERSION__ !== 'undefined' ? __EXTENSION_VERSION__ : '1.0.0';

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
