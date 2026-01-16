/**
 * Search Module
 *
 * Implements User Story 2: Search/filter playlist functionality
 * - T025: SearchManager class with query state and filter logic
 * - T026: Search box injection with autofocus
 * - T027: Filter function with case-insensitive matching
 * - T028: Clear button functionality
 * - T029: No-results message display
 */

import type { PlaylistItem } from '../types';
import { SELECTORS, findElement } from './selectors';
import { debounce } from '../utils/debounce';
import { logger } from '../utils/logger';

/**
 * Manages search state and filtering for playlist items
 */
export class SearchManager {
  private _query = '';
  private _items: Map<Element, PlaylistItem> = new Map();
  private _listContainer: Element | null = null;
  private _searchWrapper: HTMLElement | null = null;
  private _searchInput: HTMLInputElement | null = null;
  private _clearButton: HTMLElement | null = null;
  private _noResultsMessage: HTMLElement | null = null;
  private _debouncedFilter: ReturnType<typeof debounce<() => void>> | null = null;

  /**
   * Current search query
   */
  get query(): string {
    return this._query;
  }

  /**
   * Count of visible (non-filtered) items
   */
  get visibleCount(): number {
    let count = 0;
    for (const [element] of this._items) {
      if (!element.classList.contains('ype-hidden')) {
        count++;
      }
    }
    return count;
  }

  /**
   * Initialize the search manager with a sheet element
   * @param sheet The playlist sheet element
   * @param items Playlist items from SelectionManager
   */
  initialize(sheet: Element, items: Map<Element, PlaylistItem>): void {
    this._items = items;
    this._listContainer = findElement(sheet, SELECTORS.listContainer);

    if (!this._listContainer) {
      logger.warn('SearchManager: List container not found');
      return;
    }

    // Create debounced filter function
    this._debouncedFilter = debounce(() => this.filterPlaylists(), 150);

    // Inject search UI
    this.injectSearchBox(sheet);

    logger.info('SearchManager initialized', { itemCount: items.size });
  }

  /**
   * Inject search box into the sheet (T026)
   */
  private injectSearchBox(sheet: Element): void {
    // Don't add if already exists
    if (sheet.querySelector('.ype-search-wrapper')) return;

    // Create wrapper
    this._searchWrapper = document.createElement('div');
    this._searchWrapper.className = 'ype-search-wrapper';

    // Create input
    this._searchInput = document.createElement('input');
    this._searchInput.type = 'text';
    this._searchInput.className = 'ype-search-input';
    this._searchInput.placeholder = '搜尋播放清單... (按 Esc 清空)';
    this._searchInput.setAttribute('aria-label', '搜尋播放清單');

    // Create clear button as span (not button) to avoid default button behaviors
    // that might interfere with YouTube's dropdown close detection
    this._clearButton = document.createElement('span');
    this._clearButton.className = 'ype-search-clear';
    this._clearButton.innerHTML = '✕';
    this._clearButton.setAttribute('aria-label', '清除搜尋');
    this._clearButton.setAttribute('role', 'button');
    this._clearButton.setAttribute('tabindex', '0');

    // Assemble
    this._searchWrapper.appendChild(this._searchInput);
    this._searchWrapper.appendChild(this._clearButton);

    // Find the best insertion point (after title, before list)
    const listContainer = findElement(sheet, SELECTORS.listContainer);
    if (listContainer && listContainer.parentElement) {
      listContainer.parentElement.insertBefore(this._searchWrapper, listContainer);
    } else {
      // Fallback: prepend to sheet
      sheet.insertBefore(this._searchWrapper, sheet.firstChild);
    }

    // Bind events
    this.bindSearchEvents();

    // Autofocus after a brief delay (let the sheet finish rendering)
    requestAnimationFrame(() => {
      this._searchInput?.focus();
    });
  }

  /**
   * Bind search input events
   */
  private bindSearchEvents(): void {
    if (!this._searchInput || !this._clearButton || !this._searchWrapper) return;

    // Prevent ALL events from propagating to YouTube's dropdown
    // YouTube uses various event handlers to detect clicks outside content
    const stopAllPropagation = (e: Event) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // Stop propagation on wrapper for all mouse/pointer events
    const mouseEvents = [
      'mousedown',
      'mouseup',
      'click',
      'pointerdown',
      'pointerup',
      'touchstart',
      'touchend',
    ];
    mouseEvents.forEach((eventType) => {
      this._searchWrapper!.addEventListener(eventType, stopAllPropagation, true);
    });

    // Also stop on the input itself
    mouseEvents.forEach((eventType) => {
      this._searchInput!.addEventListener(eventType, stopAllPropagation, true);
    });

    // Prevent focus events from bubbling (YouTube may use these)
    this._searchInput.addEventListener('focus', stopAllPropagation, true);
    this._searchInput.addEventListener('focusin', stopAllPropagation, true);

    // Input event for filtering
    this._searchInput.addEventListener('input', (e) => {
      e.stopPropagation();
      const target = e.target as HTMLInputElement;
      this._query = target.value;
      this.updateClearButtonVisibility();
      this._debouncedFilter?.();
    });

    // Keyboard events - MUST use capture phase to intercept before YouTube
    this._searchInput.addEventListener(
      'keydown',
      (e) => {
        // Always stop propagation to prevent menu interactions
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Handle Escape to clear search (not close menu)
        if (e.key === 'Escape') {
          e.preventDefault();
          // Only clear if there's text, otherwise do nothing
          if (this._query) {
            this.clearSearch();
          }
        }
      },
      true
    ); // capture: true

    // Also stop keyup propagation
    this._searchInput.addEventListener('keyup', stopAllPropagation, true);

    // Clear button is hidden due to YouTube dropdown close issues
    // Users should use Escape key to clear the search instead
    // The button element is kept for potential future use but not visible
  }

  /**
   * Update clear button visibility based on query
   */
  private updateClearButtonVisibility(): void {
    if (this._clearButton) {
      this._clearButton.classList.toggle('ype-search-clear--visible', this._query.length > 0);
    }
  }

  /**
   * Filter playlists based on current query (T027)
   * Case-insensitive matching
   * Uses inline styles because YouTube's CSS may override our class-based styles
   */
  filterPlaylists(): void {
    const normalizedQuery = this._query.toLowerCase().trim();
    let visibleCount = 0;

    for (const [element, item] of this._items) {
      const name = item.name.toLowerCase();
      const isMatch = normalizedQuery === '' || name.includes(normalizedQuery);
      const htmlElement = element as HTMLElement;

      if (isMatch) {
        element.classList.remove('ype-hidden');
        htmlElement.style.removeProperty('display');
        visibleCount++;
      } else {
        element.classList.add('ype-hidden');
        // Use inline style with !important to override YouTube's styles
        htmlElement.style.setProperty('display', 'none', 'important');
      }
    }

    // Show/hide no results message (T029)
    this.updateNoResultsMessage(visibleCount === 0 && normalizedQuery !== '');

    logger.debug('Filter applied', {
      query: this._query,
      visibleCount,
      totalCount: this._items.size,
    });
  }

  /**
   * Update no-results message visibility (T029)
   */
  private updateNoResultsMessage(show: boolean): void {
    if (show) {
      if (!this._noResultsMessage && this._listContainer) {
        this._noResultsMessage = document.createElement('div');
        this._noResultsMessage.className = 'ype-no-results';
        this._noResultsMessage.textContent = `找不到「${this._query}」相關的播放清單`;
        this._listContainer.appendChild(this._noResultsMessage);
      } else if (this._noResultsMessage) {
        this._noResultsMessage.textContent = `找不到「${this._query}」相關的播放清單`;
      }
    } else {
      if (this._noResultsMessage) {
        this._noResultsMessage.remove();
        this._noResultsMessage = null;
      }
    }
  }

  /**
   * Clear search query and show all items
   */
  clearSearch(): void {
    this._query = '';
    if (this._searchInput) {
      this._searchInput.value = '';
    }
    this.updateClearButtonVisibility();
    this.filterPlaylists();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this._debouncedFilter?.cancel();
    this._searchWrapper?.remove();
    this._noResultsMessage?.remove();
    this._items.clear();
    this._listContainer = null;
    this._searchWrapper = null;
    this._searchInput = null;
    this._clearButton = null;
    this._noResultsMessage = null;
  }
}

/**
 * Set up search for a sheet
 * @param sheet The playlist sheet element
 * @param items Playlist items from SelectionManager
 * @returns SearchManager instance
 */
export function setupSearch(sheet: Element, items: Map<Element, PlaylistItem>): SearchManager {
  const manager = new SearchManager();
  manager.initialize(sheet, items);
  return manager;
}
