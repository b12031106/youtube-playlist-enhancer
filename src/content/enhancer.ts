/**
 * Enhancer Module
 *
 * Main orchestration for playlist sheet enhancement
 * - T023: Integrate multiselect
 * - T031: Integrate search (Phase 4)
 * - T032: Ensure search works with multiselect
 * - T039: Graceful degradation on selector failure
 */

import { setupMultiSelect, SelectionManager } from './multiselect';
import { setupSearch, SearchManager } from './search';
import { logger } from '../utils/logger';

/** Current active selection manager */
let currentSelectionManager: SelectionManager | null = null;

/** Current active search manager */
let currentSearchManager: SearchManager | null = null;

/** AbortController for global interceptors - allows cleanup */
let globalInterceptorController: AbortController | null = null;

/**
 * Install global event interceptor to prevent YouTube from closing dropdown
 * when interacting with our enhanced UI elements
 * Uses AbortController for reliable cleanup
 */
function installGlobalClickInterceptor(): void {
  // If already installed, abort previous and reinstall fresh
  // This ensures clean state on each enhancement cycle
  if (globalInterceptorController) {
    globalInterceptorController.abort();
  }

  globalInterceptorController = new AbortController();
  const { signal } = globalInterceptorController;

  // Capture phase handler for mouse events - runs before YouTube's handlers
  const mouseInterceptor = (e: Event) => {
    const target = e.target as Element;
    if (!target) return;

    // Check if click is on search wrapper only (not footer buttons or checkboxes)
    // Footer buttons and checkboxes need their clicks to work normally
    const isSearchElement =
      target.closest('.ype-search-wrapper') || target.closest('.ype-search-input');

    if (isSearchElement) {
      // Stop the event from reaching YouTube's handlers
      e.stopPropagation();
      e.stopImmediatePropagation();
      logger.debug('Intercepted click on search element', {
        target: target.className,
      });
    }
  };

  // Capture phase handler for keyboard events
  const keyboardInterceptor = (e: KeyboardEvent) => {
    // Only intercept Escape when our enhanced sheet is open
    if (e.key === 'Escape') {
      const searchInput = document.querySelector('.ype-search-input') as HTMLInputElement;
      const isEnhancedSheetOpen = !!searchInput; // If search input exists, sheet is open

      if (isEnhancedSheetOpen) {
        const activeElement = document.activeElement;
        const isSearchFocused = activeElement === searchInput;

        // If search has content, clear it
        if (searchInput.value) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          logger.debug('Intercepted Escape - cleared search');
          return;
        }

        // If search is focused (but empty), just prevent closing
        if (isSearchFocused) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          searchInput.blur(); // Unfocus the input
          logger.debug('Intercepted Escape - unfocused search');
          return;
        }

        // Sheet is open but search not focused - don't intercept
        // Allow normal Escape behavior (close sheet)
      }
    }
  };

  // Install on capture phase at window level for maximum priority
  // Window level catches events before document level
  // Using signal for automatic cleanup via AbortController
  window.addEventListener('mousedown', mouseInterceptor, { capture: true, signal });
  window.addEventListener('pointerdown', mouseInterceptor, { capture: true, signal });
  window.addEventListener('click', mouseInterceptor, { capture: true, signal });
  window.addEventListener('keydown', keyboardInterceptor, { capture: true, signal });

  // Also install on document for redundancy
  document.addEventListener('mousedown', mouseInterceptor, { capture: true, signal });
  document.addEventListener('pointerdown', mouseInterceptor, { capture: true, signal });
  document.addEventListener('click', mouseInterceptor, { capture: true, signal });
  document.addEventListener('keydown', keyboardInterceptor, { capture: true, signal });

  logger.info('Global event interceptor installed with AbortController');
}

/**
 * Refresh state of an already-enhanced sheet
 * Called when the sheet reopens to sync our checkboxes with YouTube's actual state
 */
export function refreshSheet(): void {
  if (currentSelectionManager) {
    currentSelectionManager.refreshState();
    logger.info('Sheet state refreshed');
  }
}

/**
 * Enhance a playlist sheet with multiselect and search
 * T039: Implements graceful degradation - if enhancement fails,
 * the original YouTube functionality remains intact
 */
export function enhanceSheet(sheet: Element): void {
  try {
    // Install global click interceptor (only once)
    installGlobalClickInterceptor();

    // Clean up any previous managers
    cleanup();

    // Remove any existing checkboxes from previous enhancement
    // This ensures fresh state when re-enhancing after new playlist creation
    sheet.querySelectorAll('.ype-checkbox').forEach((checkbox) => checkbox.remove());

    // Set up multiselect (User Story 1)
    // T039: Wrapped in try-catch for graceful degradation
    try {
      currentSelectionManager = setupMultiSelect(sheet);
    } catch (multiselectError) {
      logger.error('Multiselect setup failed - falling back to YouTube default', {
        error: multiselectError instanceof Error ? multiselectError.message : String(multiselectError),
      });
      // Continue without multiselect - search can still work
    }

    // Set up search (User Story 2 - T031, T032)
    // T039: Only set up search if we have items to search
    if (currentSelectionManager && currentSelectionManager.items.size > 0) {
      try {
        currentSearchManager = setupSearch(sheet, currentSelectionManager.items);
      } catch (searchError) {
        logger.error('Search setup failed - multiselect still functional', {
          error: searchError instanceof Error ? searchError.message : String(searchError),
        });
        // Continue without search - multiselect still works
      }
    }

    const features = [];
    if (currentSelectionManager) features.push('multiselect');
    if (currentSearchManager) features.push('search');

    if (features.length > 0) {
      logger.info('Sheet enhanced successfully', { features });
    } else {
      logger.warn('No features could be enabled - using YouTube default behavior');
    }
  } catch (error) {
    logger.error('Failed to enhance sheet', {
      error: error instanceof Error ? error.message : String(error),
    });
    // T039: Graceful degradation - sheet still works with original YouTube behavior
    cleanup();
  }
}

/**
 * Clean up current enhancement
 * Removes all event listeners and UI elements
 */
export function cleanup(): void {
  // Clean up global interceptors first
  // This removes window/document level event listeners
  if (globalInterceptorController) {
    globalInterceptorController.abort();
    globalInterceptorController = null;
    logger.debug('Global interceptors cleaned up');
  }

  // Clean up managers
  if (currentSearchManager) {
    currentSearchManager.destroy();
    currentSearchManager = null;
  }
  if (currentSelectionManager) {
    currentSelectionManager.destroy();
    currentSelectionManager = null;
  }
}

/**
 * Get current selection manager (for testing/debugging)
 */
export function getCurrentSelectionManager(): SelectionManager | null {
  return currentSelectionManager;
}

/**
 * Get current search manager (for testing/debugging)
 */
export function getCurrentSearchManager(): SearchManager | null {
  return currentSearchManager;
}
