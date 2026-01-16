/**
 * MutationObserver Module
 *
 * Following Constitution Principle I (Content Script Isolation):
 * - Use MutationObserver for DOM monitoring (not polling)
 * - Detect playlist sheet appearance
 * - T033: Handle YouTube SPA navigation
 * - T034: URL pattern detection for different page types
 */

import type { SheetCallback } from '../types';
import { SELECTORS, PLAYLIST_TITLE_PATTERNS, findElement } from './selectors';
import { logger } from '../utils/logger';
import { refreshSheet } from './enhancer';

/** Set of already-enhanced sheets to prevent double-enhancement */
const enhancedSheets = new WeakSet<Element>();

/**
 * Check if a sheet element is the playlist save sheet
 * Uses title text content for identification (supports multiple languages)
 */
export function isPlaylistSheet(sheet: Element): boolean {
  const titleElement = findElement(sheet, SELECTORS.title);
  const titleText = (titleElement?.textContent || sheet.textContent || '').toLowerCase().trim();

  return PLAYLIST_TITLE_PATTERNS.some((pattern) => titleText.includes(pattern.toLowerCase()));
}

/**
 * Check if sheet has already been enhanced
 * T033: Also verify UI elements exist (handles SPA navigation cleanup)
 * Also check if all list items have checkboxes (handles new playlist creation)
 */
export function isAlreadyEnhanced(sheet: Element): boolean {
  // WeakSet check
  if (!enhancedSheets.has(sheet)) {
    return false;
  }

  // Also verify our UI elements exist (handles case where managers were cleaned up)
  // If our UI elements are missing, the sheet needs re-enhancement
  const hasSearchBox = !!sheet.querySelector('.ype-search-wrapper');
  const hasFooter = !!document.querySelector('.ype-footer');

  if (!hasSearchBox && !hasFooter) {
    // Managers were cleaned up but sheet still in WeakSet, need to re-enhance
    logger.debug('Sheet in WeakSet but UI missing, allowing re-enhancement');
    return false;
  }

  // Check if all list items have checkboxes (handles new playlist creation)
  // If a new playlist was added, it won't have a checkbox and needs enhancement
  const listContainer = findElement(sheet, SELECTORS.listContainer);
  if (listContainer) {
    const allItems = listContainer.querySelectorAll(
      `${SELECTORS.listItem.primary}, ${SELECTORS.listItem.fallback.join(', ')}`
    );
    const itemsWithCheckbox = listContainer.querySelectorAll('.ype-checkbox');

    if (allItems.length > itemsWithCheckbox.length) {
      // Some items are missing checkboxes (new playlists were added)
      logger.debug('New items detected without checkboxes, allowing re-enhancement', {
        totalItems: allItems.length,
        itemsWithCheckbox: itemsWithCheckbox.length,
      });
      return false;
    }
  }

  return true;
}

/**
 * Mark sheet as enhanced
 */
export function markAsEnhanced(sheet: Element): void {
  enhancedSheets.add(sheet);
}

/**
 * Process a potential playlist sheet
 */
function processSheet(sheet: Element, callback: SheetCallback): void {
  if (!isPlaylistSheet(sheet)) {
    return;
  }

  if (isAlreadyEnhanced(sheet)) {
    // Sheet is already enhanced, but we need to refresh state from YouTube
    // This handles the case where the menu reopens and YouTube's state may have changed
    logger.debug('Sheet already enhanced, refreshing state');
    refreshSheet();
    return;
  }

  logger.info('Playlist sheet detected', { hasTitle: !!findElement(sheet, SELECTORS.title) });
  callback(sheet);
}

/**
 * Start observing for playlist sheet appearance
 * @param callback Function to call when playlist sheet is detected
 * @returns MutationObserver instance (call disconnect() to stop)
 */
export function observePlaylistSheet(callback: SheetCallback): MutationObserver {
  // Observer for new nodes being added
  const childObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        // Check if the added node itself is a sheet
        if (node.matches(SELECTORS.sheet.primary)) {
          processSheet(node, callback);
          continue;
        }

        // Check for sheet within added node
        const sheet = node.querySelector(SELECTORS.sheet.primary);
        if (sheet) {
          processSheet(sheet, callback);
        }

        // Also check fallback selectors
        for (const fallback of SELECTORS.sheet.fallback) {
          if (node.matches(fallback)) {
            processSheet(node, callback);
            break;
          }
          const fallbackSheet = node.querySelector(fallback);
          if (fallbackSheet) {
            processSheet(fallbackSheet, callback);
            break;
          }
        }
      }
    }
  });

  childObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // YouTube uses tp-yt-iron-dropdown to show/hide menus
  // We need to observe attribute changes to detect when the menu opens
  const observedDropdowns = new WeakSet<Element>();

  const dropdownObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const dropdown = mutation.target as Element;

        // Check if dropdown became visible (YouTube uses various methods)
        // Method 1: 'opened' attribute added
        // Method 2: 'aria-hidden' removed (becomes null) or set to 'false'
        // Method 3: style display changed to visible
        const isOpening =
          (mutation.attributeName === 'opened' && dropdown.hasAttribute('opened')) ||
          (mutation.attributeName === 'aria-hidden' &&
            (dropdown.getAttribute('aria-hidden') === 'false' ||
              dropdown.getAttribute('aria-hidden') === null)) ||
          (mutation.attributeName === 'style' &&
            window.getComputedStyle(dropdown).display !== 'none');

        logger.info('Dropdown attribute changed', {
          attributeName: mutation.attributeName,
          isOpening,
          display: window.getComputedStyle(dropdown).display,
        });

        if (isOpening) {
          // Small delay to let content render
          setTimeout(() => {
            const sheet = dropdown.querySelector(SELECTORS.sheet.primary);
            logger.info('Checking for sheet after opening', { hasSheet: !!sheet });
            if (sheet) {
              logger.info('Dropdown opened with sheet, processing...');
              processSheet(sheet, callback);
            }
          }, 50);
        }
      }
    }
  });

  const observeDropdown = (dropdown: Element): void => {
    if (observedDropdowns.has(dropdown)) return;
    observedDropdowns.add(dropdown);
    dropdownObserver.observe(dropdown, {
      attributes: true,
      attributeFilter: ['opened', 'aria-hidden', 'style'],
    });

    // Immediately check if dropdown is already visible with a sheet
    // This handles the case where dropdown is added already in visible state
    const checkDropdownVisibility = (): void => {
      const style = window.getComputedStyle(dropdown);
      const isVisible = style.display !== 'none';
      const sheet = dropdown.querySelector(SELECTORS.sheet.primary);
      logger.info('Checking dropdown visibility', {
        isVisible,
        hasSheet: !!sheet,
        display: style.display,
      });
      if (isVisible && sheet) {
        logger.info('Found visible dropdown with sheet, processing...');
        processSheet(sheet, callback);
      }
    };

    // Check immediately and after a short delay (for content to render)
    checkDropdownVisibility();
    setTimeout(checkDropdownVisibility, 100);
    setTimeout(checkDropdownVisibility, 500);
  };

  // Observe all existing dropdowns in the entire document
  const observeAllDropdowns = (): void => {
    const dropdowns = document.querySelectorAll('tp-yt-iron-dropdown');
    dropdowns.forEach(observeDropdown);
    logger.info('Initial dropdown observation', { count: dropdowns.length });
  };

  // Initial observation
  observeAllDropdowns();

  // Re-check periodically for dropdowns that might be added later
  // YouTube dynamically creates dropdowns, so we need to catch them
  const recheckInterval = setInterval(() => {
    const dropdowns = document.querySelectorAll('tp-yt-iron-dropdown');
    let newCount = 0;
    dropdowns.forEach((d) => {
      if (!observedDropdowns.has(d)) {
        observeDropdown(d);
        newCount++;
      }
    });
    if (newCount > 0) {
      logger.info('Found new dropdowns on recheck', { newCount });
    }
  }, 1000);

  // Stop rechecking after 30 seconds
  setTimeout(() => clearInterval(recheckInterval), 30000);

  // Also observe document body for new dropdowns being added anywhere
  const bodyObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        // Check if the added node is a dropdown
        if (node.tagName === 'TP-YT-IRON-DROPDOWN') {
          logger.info('New dropdown added to DOM');
          observeDropdown(node);
        }

        // Check for dropdowns within added node
        const dropdowns = node.querySelectorAll('tp-yt-iron-dropdown');
        if (dropdowns.length > 0) {
          logger.info('Found dropdowns in added node', { count: dropdowns.length });
          dropdowns.forEach(observeDropdown);
        }
      }
    }
  });

  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  logger.info('MutationObserver started');
  return childObserver;
}

/**
 * One-time check for existing playlist sheet on page
 * (Useful after SPA navigation)
 */
export function checkExistingSheet(callback: SheetCallback): void {
  const sheet = findElement(document, SELECTORS.sheet);
  if (sheet) {
    processSheet(sheet, callback);
  }
}

/**
 * YouTube page types (T034)
 */
export type YouTubePageType = 'watch' | 'results' | 'home' | 'playlist' | 'channel' | 'other';

/**
 * Detect current YouTube page type (T034)
 */
export function detectPageType(): YouTubePageType {
  const pathname = window.location.pathname;

  if (pathname.startsWith('/watch')) {
    return 'watch';
  }
  if (pathname.startsWith('/results')) {
    return 'results';
  }
  if (pathname.startsWith('/playlist')) {
    return 'playlist';
  }
  if (pathname.startsWith('/@') || pathname.startsWith('/channel') || pathname.startsWith('/c/')) {
    return 'channel';
  }
  if (pathname === '/' || pathname === '/feed/subscriptions' || pathname.startsWith('/feed/')) {
    return 'home';
  }
  return 'other';
}

/**
 * Listen for YouTube SPA navigation events (T033)
 * YouTube uses yt-navigate-finish for soft navigation
 * @param callback Function to call on navigation
 */
export function observeNavigation(callback: () => void): void {
  // YouTube fires this custom event on SPA navigation
  window.addEventListener('yt-navigate-finish', () => {
    logger.debug('SPA navigation detected', { pageType: detectPageType() });
    callback();
  });

  // Also listen for popstate (browser back/forward)
  window.addEventListener('popstate', () => {
    logger.debug('Popstate navigation detected', { pageType: detectPageType() });
    callback();
  });
}

/**
 * Clear enhanced sheets tracking (used on navigation) (T033)
 * Note: WeakSet doesn't need explicit clearing since references
 * are released when elements are removed from DOM
 */
export function clearEnhancedTracking(): void {
  // WeakSet auto-cleans when elements are GC'd
  // This function is kept for explicit intent in code
  logger.debug('Enhanced tracking cleared (WeakSet auto-manages)');
}
