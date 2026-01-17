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
import { refreshSheet, cleanup as cleanupManagers } from './enhancer';

/** Set of already-enhanced sheets to prevent double-enhancement */
const enhancedSheets = new WeakSet<Element>();

/**
 * Quick pre-check result type
 * - 'playlist': Definitely a playlist sheet, can enhance immediately
 * - 'not-playlist': Definitely NOT a playlist sheet, can cleanup immediately
 * - 'uncertain': Need more time to determine, use fallback delay
 */
type QuickCheckResult = 'playlist' | 'not-playlist' | 'uncertain';

/**
 * Perform a quick pre-check to determine sheet type
 * This allows us to act faster in clear-cut cases
 *
 * @param sheet The sheet element to check
 * @returns QuickCheckResult indicating what action to take
 */
function quickPreCheck(sheet: Element): QuickCheckResult {
  // Check for definitive THREE-DOT MENU indicators first (fastest rejection)
  // Three-dot menus contain ytd-menu-service-item-renderer elements
  const hasContextMenuItems = !!sheet.querySelector('ytd-menu-service-item-renderer');
  if (hasContextMenuItems) {
    logger.debug('quickPreCheck: Detected three-dot menu (has context menu items)');
    return 'not-playlist';
  }

  // Check for title element
  const titleElement = findElement(sheet, SELECTORS.title);
  if (!titleElement) {
    // No title yet - DOM might still be loading
    logger.debug('quickPreCheck: No title element, uncertain');
    return 'uncertain';
  }

  const titleText = (titleElement.textContent || '').toLowerCase().trim();

  // Check if title matches playlist patterns
  const titleMatches = PLAYLIST_TITLE_PATTERNS.some((pattern) =>
    titleText.includes(pattern.toLowerCase())
  );

  if (!titleMatches) {
    // Title doesn't match - definitely not a playlist sheet
    logger.debug('quickPreCheck: Title does not match patterns', { titleText });
    return 'not-playlist';
  }

  // Title matches, now check for playlist structure
  const hasListContainer = !!sheet.querySelector('yt-list-view-model');
  const hasListItems = !!sheet.querySelector('yt-list-item-view-model');

  if (!hasListContainer && !hasListItems) {
    // Title matches but no list structure - might still be loading
    logger.debug('quickPreCheck: Title matches but no list structure yet, uncertain');
    return 'uncertain';
  }

  // All indicators point to playlist sheet
  logger.debug('quickPreCheck: Detected playlist sheet', { titleText, hasListContainer, hasListItems });
  return 'playlist';
}

/**
 * Check if sheet has residual enhancement UI that needs cleanup
 */
function hasResidualUI(sheet: Element): boolean {
  return (
    sheet.classList.contains('ype-enhanced') ||
    !!sheet.querySelector('.ype-search-wrapper') ||
    !!sheet.querySelector('.ype-checkbox')
  );
}

/**
 * Clean up any residual UI elements from previous enhancement
 * This is necessary because YouTube may reuse the same dropdown/sheet element
 * for different menus (e.g., playlist save sheet -> three-dot menu)
 */
function cleanupResidualUI(sheet: Element): void {
  // Remove search wrapper
  sheet.querySelectorAll('.ype-search-wrapper').forEach((el) => el.remove());

  // Remove checkboxes
  sheet.querySelectorAll('.ype-checkbox').forEach((el) => el.remove());

  // Remove footer (save/cancel buttons)
  document.querySelectorAll('.ype-footer').forEach((el) => el.remove());

  // Remove .ype-enhanced class
  sheet.classList.remove('ype-enhanced');

  // Remove hidden class from items
  sheet.querySelectorAll('.ype-hidden').forEach((el) => el.classList.remove('ype-hidden'));
}

/**
 * Check if a sheet element is the playlist save sheet
 * Uses multiple validation layers to avoid false positives on video context menus
 *
 * Validation layers:
 * 1. Title text matching (only from title element, not sheet.textContent)
 * 2. DOM structure validation (must have playlist list structure)
 * 3. Exclusion of video context menus (three-dot menus)
 * 4. Playlist-specific features verification
 */
export function isPlaylistSheet(sheet: Element): boolean {
  // Layer 1: Title text matching - only use title element, no fallback to sheet.textContent
  const titleElement = findElement(sheet, SELECTORS.title);
  if (!titleElement) {
    logger.debug('isPlaylistSheet: No title element found');
    return false;
  }

  const titleText = (titleElement.textContent || '').toLowerCase().trim();
  const titleMatches = PLAYLIST_TITLE_PATTERNS.some((pattern) =>
    titleText.includes(pattern.toLowerCase())
  );

  if (!titleMatches) {
    logger.debug('isPlaylistSheet: Title does not match patterns', { titleText });
    return false;
  }

  // Layer 2: DOM structure validation - must have playlist list structure
  const hasListContainer = !!sheet.querySelector('yt-list-view-model');
  const hasListItems = !!sheet.querySelector('yt-list-item-view-model');

  if (!hasListContainer && !hasListItems) {
    logger.debug('isPlaylistSheet: Missing playlist list structure');
    return false;
  }

  // Layer 3: Exclusion - reject if this looks like a video context menu (three-dot menu)
  // Video context menus typically contain ytd-menu-service-item-renderer elements
  const hasContextMenuItems = !!sheet.querySelector('ytd-menu-service-item-renderer');
  if (hasContextMenuItems) {
    logger.debug('isPlaylistSheet: Detected video context menu structure, rejecting');
    return false;
  }

  // Layer 4: Playlist-specific features verification
  // Real playlist sheets typically have either:
  // - yt-panel-footer-view-model (Create playlist button)
  // - Bookmark/save icons in list items
  const hasFooter = !!sheet.querySelector('yt-panel-footer-view-model');
  const hasPlaylistIcons = !!sheet.querySelector('[icon="yt-icons:playlist_add"]');

  // At least one playlist-specific feature should be present
  // But we're lenient here since DOM structure may vary
  if (!hasFooter && !hasPlaylistIcons && !hasListItems) {
    logger.debug('isPlaylistSheet: No playlist-specific features found');
    return false;
  }

  logger.debug('isPlaylistSheet: All validation layers passed', {
    titleText,
    hasListContainer,
    hasListItems,
    hasFooter,
    hasPlaylistIcons,
  });

  return true;
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
 * Cleanup strategy:
 * - For non-playlist sheets: clean up any residual enhancement UI, then return
 * - For playlist sheets: full cleanup then enhance
 *
 * IMPORTANT: We need to clean up residual UI even for non-playlist sheets
 * because YouTube reuses the same dropdown element for different menus.
 * The cleanup is done with a delay to avoid interfering with YouTube's event handling.
 */
function processSheet(sheet: Element, callback: SheetCallback): void {
  const isPlaylist = isPlaylistSheet(sheet);

  if (!isPlaylist) {
    // Check if this sheet has residual enhancement UI from a previous playlist sheet
    const hasResidualUI =
      sheet.classList.contains('ype-enhanced') ||
      !!sheet.querySelector('.ype-search-wrapper') ||
      !!sheet.querySelector('.ype-checkbox');

    if (hasResidualUI) {
      // IMPORTANT: First clean up the managers (SelectionManager, SearchManager)
      // This removes event listeners that would otherwise block YouTube's native handlers
      cleanupManagers();

      // Then clean up the visual UI elements
      cleanupResidualUI(sheet);
      logger.info('Cleaned up residual UI and managers from non-playlist sheet');
    }
    return;
  }

  // It's a playlist sheet - full cleanup then enhance
  cleanupResidualUI(sheet);

  logger.info('Playlist sheet detected, enhancing...', { hasTitle: !!findElement(sheet, SELECTORS.title) });
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

  // Track last processed content for each dropdown to detect content changes
  // WeakMap allows garbage collection when dropdown is removed
  const dropdownContentState = new WeakMap<Element, string>();

  const dropdownObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const dropdown = mutation.target as Element;
        const display = window.getComputedStyle(dropdown).display;

        // Check if dropdown became visible (YouTube uses various methods)
        // IMPORTANT: Only consider definitive open/close signals, not style animations
        // Method 1: 'opened' attribute added (most reliable)
        // Method 2: 'aria-hidden' changed (secondary signal)
        // We do NOT use style changes as they fire many times during animations
        const isOpening =
          (mutation.attributeName === 'opened' && dropdown.hasAttribute('opened')) ||
          (mutation.attributeName === 'aria-hidden' &&
            (dropdown.getAttribute('aria-hidden') === 'false' ||
              dropdown.getAttribute('aria-hidden') === null));

        // Check if dropdown is closing
        // Only use definitive close signals
        const isClosing =
          (mutation.attributeName === 'opened' && !dropdown.hasAttribute('opened')) ||
          (mutation.attributeName === 'aria-hidden' &&
            dropdown.getAttribute('aria-hidden') === 'true');

        logger.info('Dropdown attribute changed', {
          attributeName: mutation.attributeName,
          isOpening,
          isClosing,
          display,
        });

        // When dropdown closes, reset content state for next open
        // IMPORTANT: We no longer do cleanup here because it can interfere with
        // YouTube's content transition (e.g., three-dot menu -> playlist sheet)
        // Cleanup is now done in isOpening handler after a delay
        if (isClosing) {
          // Only reset content tracking - don't do DOM cleanup
          dropdownContentState.delete(dropdown);
          logger.debug('Dropdown closing, content state reset');
        }

        if (isOpening) {
          // Reset content tracking when dropdown opens fresh
          dropdownContentState.delete(dropdown);

          // OPTIMIZATION: Use quick pre-check to determine appropriate delay
          // This allows us to act much faster in clear-cut cases
          const sheet = dropdown.querySelector(SELECTORS.sheet.primary);
          if (!sheet) {
            // No sheet yet, use fallback delay
            setTimeout(() => {
              const delayedSheet = dropdown.querySelector(SELECTORS.sheet.primary);
              if (delayedSheet) {
                processSheet(delayedSheet, callback);
              }
            }, 300);
            return;
          }

          const checkResult = quickPreCheck(sheet);
          logger.debug('Quick pre-check result on opening', { checkResult });

          switch (checkResult) {
            case 'playlist':
              // Definitely a playlist sheet - enhance with minimal delay
              // Small delay (50ms) just to let DOM stabilize
              setTimeout(() => processSheet(sheet, callback), 50);
              break;

            case 'not-playlist':
              // Definitely NOT a playlist sheet - cleanup immediately if needed
              if (hasResidualUI(sheet)) {
                // Immediate cleanup of residual UI
                cleanupManagers();
                cleanupResidualUI(sheet);
                logger.info('Immediate cleanup: not a playlist sheet');
              }
              break;

            case 'uncertain':
              // Not sure yet - use moderate delay and re-check
              setTimeout(() => {
                const recheck = quickPreCheck(sheet);
                logger.debug('Re-check after delay', { recheck });

                if (recheck === 'playlist') {
                  processSheet(sheet, callback);
                } else if (recheck === 'not-playlist' && hasResidualUI(sheet)) {
                  cleanupManagers();
                  cleanupResidualUI(sheet);
                  logger.info('Delayed cleanup: confirmed not a playlist sheet');
                } else if (recheck === 'uncertain') {
                  // Still uncertain after delay, do full check
                  processSheet(sheet, callback);
                }
              }, 300);
              break;
          }
        }
      }
    }
  });

  // Debounce timer for content change detection
  const contentChangeTimers = new WeakMap<Element, number>();

  const observeDropdown = (dropdown: Element): void => {
    if (observedDropdowns.has(dropdown)) return;
    observedDropdowns.add(dropdown);
    // Only observe definitive open/close attributes, not style/class animations
    dropdownObserver.observe(dropdown, {
      attributes: true,
      attributeFilter: ['opened', 'aria-hidden'],
    });

    // CRITICAL: Also observe content changes INSIDE the dropdown
    // This handles the case where YouTube replaces content while dropdown is open
    // (e.g., three-dot menu -> playlist sheet transition)
    // YouTube may modify existing sheet content rather than adding a new sheet
    //
    // IMPORTANT: Use debounce to avoid interfering with YouTube's event processing
    const contentObserver = new MutationObserver(() => {
      // Clear previous debounce timer
      const existingTimer = contentChangeTimers.get(dropdown);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Debounce: wait for DOM mutations to settle before processing
      const timer = window.setTimeout(() => {
        // Check if dropdown is currently visible
        const style = window.getComputedStyle(dropdown);
        if (style.display === 'none') return;

        // Find the sheet in the dropdown
        const sheet = dropdown.querySelector(SELECTORS.sheet.primary);
        if (!sheet) return;

        // Use a simple content fingerprint to detect meaningful changes
        // Check title text to see if content type changed
        const titleElement = sheet.querySelector('h2, [slot="title"], #title, .title');
        const currentContent = titleElement?.textContent || '';
        const lastProcessedContent = dropdownContentState.get(dropdown) || '';

        // Only process if content actually changed (avoid processing same content multiple times)
        if (currentContent && currentContent !== lastProcessedContent) {
          dropdownContentState.set(dropdown, currentContent);
          logger.info('Dropdown content changed, re-checking for playlist sheet...', {
            title: currentContent.substring(0, 30),
          });
          // Additional delay to ensure YouTube has completed all updates
          setTimeout(() => processSheet(sheet, callback), 150);
        }
      }, 500); // Debounce: 500ms wait for mutations to settle and YouTube's event processing

      contentChangeTimers.set(dropdown, timer);
    });

    // DISABLED: contentObserver causes issues with YouTube's click handling
    // When user clicks "Save to playlist" in three-dot menu, our observation
    // of content changes interferes with YouTube's event processing.
    // The isOpening handler with delay should be sufficient to detect playlist sheets.
    //
    // contentObserver.observe(dropdown, {
    //   childList: true,
    //   subtree: true,
    //   characterData: true,
    // });

    // Check if dropdown is already visible with a sheet
    // Uses quick pre-check for faster response
    const checkDropdownVisibility = (): void => {
      const style = window.getComputedStyle(dropdown);
      const isVisible = style.display !== 'none';
      if (!isVisible) return;

      const sheet = dropdown.querySelector(SELECTORS.sheet.primary);
      if (!sheet) return;

      const checkResult = quickPreCheck(sheet);
      logger.debug('checkDropdownVisibility', { checkResult, isVisible });

      switch (checkResult) {
        case 'playlist':
          // Definitely a playlist sheet - process immediately
          logger.info('Found visible playlist sheet, enhancing...');
          processSheet(sheet, callback);
          break;

        case 'not-playlist':
          // Definitely NOT a playlist sheet - cleanup if needed
          if (hasResidualUI(sheet)) {
            cleanupManagers();
            cleanupResidualUI(sheet);
            logger.info('Cleaned up residual UI from non-playlist sheet');
          }
          break;

        case 'uncertain':
          // Will be handled by the next check or isOpening handler
          break;
      }
    };

    // OPTIMIZATION: Use shorter initial delay, with one fallback
    // Most cases are resolved in the first check (100ms)
    setTimeout(checkDropdownVisibility, 100);
    setTimeout(checkDropdownVisibility, 400); // Fallback for slower loads
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
