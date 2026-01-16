/**
 * Multi-Select Module
 *
 * Implements User Story 1: Multi-select playlist saving
 * - T016: SelectionManager class
 * - T017: Checkbox injection
 * - T018: Click interception
 * - T019: Action footer
 * - T020: Batch save
 */

import type { PlaylistItem } from '../types';
import { SELECTORS, findElement, findAllElements } from './selectors';
import { logger } from '../utils/logger';
import { delay } from '../utils/debounce';
import { showToast } from './toast';

/**
 * Manages selection state for the current menu session
 */
export class SelectionManager {
  private _items: Map<Element, PlaylistItem> = new Map();
  private _listContainer: Element | null = null;
  private _footer: HTMLElement | null = null;
  private _isSaving = false;
  private _listObserver: MutationObserver | null = null;

  /**
   * Get all items
   */
  get items(): Map<Element, PlaylistItem> {
    return this._items;
  }

  /**
   * Count of currently selected items
   */
  get selectedCount(): number {
    return Array.from(this._items.values()).filter((item) => item.isSelected).length;
  }

  /**
   * Whether any changes from original state
   */
  get hasChanges(): boolean {
    return Array.from(this._items.values()).some(
      (item) => item.isSelected !== item.wasOriginallySelected
    );
  }

  /**
   * Get items that have changed from original state
   */
  getChangedItems(): PlaylistItem[] {
    return Array.from(this._items.values()).filter(
      (item) => item.isSelected !== item.wasOriginallySelected
    );
  }

  /**
   * Get items to add (newly selected)
   */
  getItemsToAdd(): PlaylistItem[] {
    return Array.from(this._items.values()).filter(
      (item) => item.isSelected && !item.wasOriginallySelected
    );
  }

  /**
   * Get items to remove (unselected)
   */
  getItemsToRemove(): PlaylistItem[] {
    return Array.from(this._items.values()).filter(
      (item) => !item.isSelected && item.wasOriginallySelected
    );
  }

  /**
   * Toggle selection state for an item
   */
  toggle(element: Element): void {
    const item = this._items.get(element);
    if (item) {
      item.isSelected = !item.isSelected;
      this.updateCheckboxUI(element, item.isSelected);
      this.updateFooterCount();
    }
  }

  /**
   * Reset all items to original state
   */
  reset(): void {
    for (const [element, item] of this._items) {
      item.isSelected = item.wasOriginallySelected;
      this.updateCheckboxUI(element, item.isSelected);
    }
    this.updateFooterCount();
  }

  /**
   * Refresh state from YouTube's actual state
   * This re-reads YouTube's UI to sync our checkboxes with reality
   * Called when menu reopens to ensure state is accurate
   */
  refreshState(): void {
    for (const [element, item] of this._items) {
      const isNowSelected = this.checkIfOriginallySelected(element);
      item.wasOriginallySelected = isNowSelected;
      item.isSelected = isNowSelected;
      this.updateCheckboxUI(element, isNowSelected);
    }
    this.updateFooterCount();
    logger.debug('SelectionManager state refreshed from YouTube', {
      itemCount: this._items.size,
    });
  }

  /**
   * Initialize the selection manager with a sheet element
   */
  initialize(sheet: Element): void {
    this._listContainer = findElement(sheet, SELECTORS.listContainer);

    if (!this._listContainer) {
      logger.warn('List container not found');
      return;
    }

    // Find all playlist items
    const items = findAllElements(this._listContainer, SELECTORS.listItem);

    // Initialize items
    items.forEach((element) => {
      const name = this.extractPlaylistName(element);
      const isSelected = this.checkIfOriginallySelected(element);

      this._items.set(element, {
        element,
        name,
        isSelected,
        wasOriginallySelected: isSelected,
      });

      // Add checkbox to item
      this.addCheckboxToItem(element, isSelected);
    });

    // Set up click interception
    this.interceptClicks();

    // Add action footer
    this.injectActionFooter(sheet);

    // Note: "Create playlist" button sticky positioning is now handled by CSS
    // targeting yt-panel-footer-view-model directly (see styles.css)

    // Watch for new items being added (handles lazy loading and new playlist creation)
    this.observeNewItems();

    logger.info('SelectionManager initialized', { itemCount: items.length });
  }

  /**
   * Observe list container for new items being added
   * This handles cases where YouTube lazy loads items or adds new playlists
   */
  private observeNewItems(): void {
    if (!this._listContainer) return;

    this._listObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;

          // Check if the added node is a list item
          const isListItem =
            node.matches(SELECTORS.listItem.primary) ||
            SELECTORS.listItem.fallback.some((sel) => node.matches(sel));

          if (isListItem && !this._items.has(node)) {
            // New item added - initialize it
            const name = this.extractPlaylistName(node);
            const isSelected = this.checkIfOriginallySelected(node);

            this._items.set(node, {
              element: node,
              name,
              isSelected,
              wasOriginallySelected: isSelected,
            });

            this.addCheckboxToItem(node, isSelected);
            logger.debug('New playlist item detected and enhanced', { name });
          }
        }
      }
    });

    this._listObserver.observe(this._listContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Extract playlist name from element
   */
  private extractPlaylistName(element: Element): string {
    // Try various text content patterns
    const textContent = element.textContent?.trim() || '';
    // Get first non-empty line (usually the playlist name)
    const lines = textContent.split('\n').filter((line) => line.trim());
    return lines[0] || 'Unknown Playlist';
  }

  /**
   * Check if video is already in this playlist
   * YouTube uses a filled vs outline bookmark icon to indicate state:
   * - Filled bookmark (shorter path ~130 chars): video IS in playlist
   * - Outline bookmark (longer path ~192 chars, contains "ZM5"): video NOT in playlist
   */
  private checkIfOriginallySelected(element: Element): boolean {
    // Method 1: Check for YouTube's legacy checkbox (older UI)
    const checkbox = element.querySelector('[role="checkbox"]');
    if (checkbox) {
      return checkbox.getAttribute('aria-checked') === 'true';
    }

    // Method 2: Check the trailing bookmark icon (new YouTube UI)
    // The trailing element contains a bookmark SVG that indicates selection state
    const trailing = element.querySelector('.yt-list-item-view-model__trailing');
    if (trailing) {
      const svgPath = trailing.querySelector('svg path');
      if (svgPath) {
        const d = svgPath.getAttribute('d') || '';
        // Outline bookmark has an inner cutout path starting with "ZM5"
        // Filled bookmark is a simple closed path without inner cutout
        // If the path does NOT contain "ZM5", it's filled (video in playlist)
        if (d.startsWith('M19 2H5') && !d.includes('ZM5')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Add checkbox UI to an item (T017)
   */
  private addCheckboxToItem(element: Element, isChecked: boolean): void {
    // Don't add if already has our checkbox
    if (element.querySelector('.ype-checkbox')) return;

    const checkbox = document.createElement('div');
    checkbox.className = `ype-checkbox${isChecked ? ' ype-checkbox--checked' : ''}`;
    checkbox.innerHTML = `
      <svg class="ype-checkbox-icon" viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    `;

    // Insert at the beginning of the item
    element.insertBefore(checkbox, element.firstChild);
  }

  /**
   * Update checkbox UI state
   */
  private updateCheckboxUI(element: Element, isChecked: boolean): void {
    const checkbox = element.querySelector('.ype-checkbox');
    if (checkbox) {
      checkbox.classList.toggle('ype-checkbox--checked', isChecked);
    }
  }

  /**
   * Intercept clicks on playlist items (T018)
   * YouTube may use click, mousedown, or pointerdown - we need to intercept all
   */
  private interceptClicks(): void {
    if (!this._listContainer) return;

    // Handler for intercepting user interactions
    const interceptHandler = (e: Event) => {
      // Find the clicked item
      const target = e.target as Element;
      const item = target.closest(SELECTORS.listItem.primary);

      if (item && this._items.has(item)) {
        // CRITICAL: Allow programmatic clicks during save operation to pass through
        // The ype-saving class is added by saveToPlaylists/removeFromPlaylists
        if (item.classList.contains('ype-saving')) {
          logger.debug('Allowing save click through', { item: this._items.get(item)?.name });
          return; // Don't intercept - let YouTube handle it
        }

        // Prevent default YouTube behavior for user clicks
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Only toggle on click (not on mousedown/pointerdown) to avoid double-toggle
        if (e.type === 'click') {
          this.toggle(item);
        }
      }
    };

    // Intercept all mouse events that YouTube might use
    // Using capture: true to intercept before YouTube's handlers
    this._listContainer.addEventListener('click', interceptHandler, { capture: true });
    this._listContainer.addEventListener('mousedown', interceptHandler, { capture: true });
    this._listContainer.addEventListener('pointerdown', interceptHandler, { capture: true });
  }

  /**
   * Inject action footer with Save/Cancel buttons (T019)
   * Footer is inserted into the dropdown's contentWrapper to avoid
   * being clipped by sheet's max-height
   */
  private injectActionFooter(sheet: Element): void {
    // Don't add if already exists
    const existingFooter = document.querySelector('.ype-footer');
    if (existingFooter) return;

    this._footer = document.createElement('div');
    this._footer.className = 'ype-footer';
    this._footer.innerHTML = `
      <span class="ype-selected-count">已選擇 ${this.selectedCount} 個清單</span>
      <div class="ype-actions">
        <button class="ype-btn ype-btn--cancel">取消</button>
        <button class="ype-btn ype-btn--save">儲存</button>
      </div>
    `;

    // Add event listeners
    const cancelBtn = this._footer.querySelector('.ype-btn--cancel');
    const saveBtn = this._footer.querySelector('.ype-btn--save');

    cancelBtn?.addEventListener('click', () => this.handleCancel(sheet));
    saveBtn?.addEventListener('click', () => this.handleSave());

    // Find the dropdown's contentWrapper - it's the parent of the sheet
    // Structure: tp-yt-iron-dropdown > #contentWrapper > yt-sheet-view-model
    const contentWrapper = sheet.closest('#contentWrapper') || sheet.closest('tp-yt-iron-dropdown');

    if (contentWrapper) {
      // Insert footer after the sheet in the contentWrapper
      contentWrapper.appendChild(this._footer);
      logger.debug('Footer inserted into contentWrapper');
    } else {
      // Fallback: append to sheet (may be clipped)
      sheet.appendChild(this._footer);
      logger.warn('Could not find contentWrapper, footer may be clipped');
    }
  }

  /**
   * Update footer count display
   */
  private updateFooterCount(): void {
    const countEl = this._footer?.querySelector('.ype-selected-count');
    if (countEl) {
      countEl.textContent = `已選擇 ${this.selectedCount} 個清單`;
    }
  }

  /**
   * Handle cancel button click
   */
  private handleCancel(sheet: Element): void {
    this.reset();
    this.clearSearchInput();
    this.closeSheet(sheet);
  }

  /**
   * Clear the search input and reset filter
   */
  private clearSearchInput(): void {
    const searchInput = document.querySelector('.ype-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /**
   * Handle save button click
   */
  private async handleSave(): Promise<void> {
    if (this._isSaving) return;

    const itemsToAdd = this.getItemsToAdd();
    const itemsToRemove = this.getItemsToRemove();

    if (itemsToAdd.length === 0 && itemsToRemove.length === 0) {
      showToast('沒有變更', 'info');
      return;
    }

    this._isSaving = true;
    this.setLoadingState(true);

    try {
      // Process additions
      await this.saveToPlaylists(itemsToAdd);

      // Process removals (if needed)
      await this.removeFromPlaylists(itemsToRemove);

      const total = itemsToAdd.length + itemsToRemove.length;
      showToast(`已更新 ${total} 個播放清單`, 'success');

      // Update original state to match current selections
      for (const [, item] of this._items) {
        item.wasOriginallySelected = item.isSelected;
      }

      // Clear search input
      this.clearSearchInput();

      // Close sheet after successful save
      const sheet = document.querySelector('.ype-enhanced');
      if (sheet) {
        this.closeSheet(sheet);
      }
    } catch (error) {
      logger.error('Save failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      showToast('儲存失敗，請重試', 'error');
    } finally {
      this._isSaving = false;
      this.setLoadingState(false);
    }
  }

  /**
   * Set loading state on save button
   */
  private setLoadingState(loading: boolean): void {
    const saveBtn = this._footer?.querySelector('.ype-btn--save');
    if (saveBtn) {
      saveBtn.classList.toggle('ype-btn--loading', loading);
      (saveBtn as HTMLButtonElement).disabled = loading;
    }
  }

  /**
   * Batch save to playlists by simulating clicks (T020)
   * YouTube's new UI requires clicking on the label element to trigger save
   */
  private async saveToPlaylists(items: PlaylistItem[]): Promise<void> {
    for (const item of items) {
      // Find the correct clickable element
      // Priority: [role="checkbox"] (legacy) > .yt-list-item-view-model__label (new UI) > item.element (fallback)
      const clickTarget =
        item.element.querySelector('[role="checkbox"]') ||
        item.element.querySelector('.yt-list-item-view-model__label') ||
        item.element;

      // Store our handler state - this tells our interceptor to let the click through
      item.element.classList.add('ype-saving');

      // Use a real click() call instead of dispatchEvent for better compatibility
      (clickTarget as HTMLElement).click();

      item.element.classList.remove('ype-saving');

      // Wait between clicks to avoid rate limiting
      await delay(200);
    }
  }

  /**
   * Batch remove from playlists
   * YouTube toggles the state, so clicking again removes it
   */
  private async removeFromPlaylists(items: PlaylistItem[]): Promise<void> {
    for (const item of items) {
      // Find the correct clickable element (same as saveToPlaylists)
      const clickTarget =
        item.element.querySelector('[role="checkbox"]') ||
        item.element.querySelector('.yt-list-item-view-model__label') ||
        item.element;

      item.element.classList.add('ype-saving');
      (clickTarget as HTMLElement).click();
      item.element.classList.remove('ype-saving');

      await delay(200);
    }
  }

  /**
   * Close the sheet/modal
   */
  private closeSheet(sheet: Element): void {
    // Try clicking outside to close
    const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
    if (backdrop) {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return;
    }

    // Try pressing Escape
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      })
    );

    // Fallback: try to find and click close button
    const closeBtn = sheet.querySelector('[aria-label="Close"], [aria-label="關閉"]');
    if (closeBtn) {
      (closeBtn as HTMLElement).click();
    }
  }

  /**
   * Clean up when sheet is closed
   */
  destroy(): void {
    // Disconnect list observer
    this._listObserver?.disconnect();
    this._listObserver = null;

    // Remove footer from DOM
    this._footer?.remove();

    this._items.clear();
    this._listContainer = null;
    this._footer = null;
    this._isSaving = false;
  }
}

/**
 * Set up multiselect for a sheet
 */
export function setupMultiSelect(sheet: Element): SelectionManager {
  const manager = new SelectionManager();
  manager.initialize(sheet);
  return manager;
}
