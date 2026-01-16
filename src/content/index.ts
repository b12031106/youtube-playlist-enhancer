/**
 * YouTube Playlist Enhancer - Content Script Entry Point
 *
 * This is the main entry point for the content script.
 * It initializes the MutationObserver to detect playlist sheets.
 * - T035: Handle dynamic DOM updates on page navigation
 */

import './styles.css';
import {
  observePlaylistSheet,
  checkExistingSheet,
  markAsEnhanced,
  observeNavigation,
  detectPageType,
} from './observer';
import { enhanceSheet, cleanup } from './enhancer';
import { logger } from '../utils/logger';
import { EXTENSION_VERSION } from '../types';

/**
 * Enhance a detected playlist sheet
 */
function enhancePlaylistSheet(sheet: Element): void {
  try {
    // Mark as enhanced to prevent double-processing
    markAsEnhanced(sheet);

    logger.info('Enhancing playlist sheet', { version: EXTENSION_VERSION });

    // Add marker class to sheet for CSS targeting
    sheet.classList.add('ype-enhanced');

    // Apply all enhancements (multiselect, search)
    enhanceSheet(sheet);
  } catch (error) {
    logger.error('Failed to enhance playlist sheet', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Graceful degradation: original functionality still works
  }
}

/**
 * Handle SPA navigation (T035)
 * Clean up previous enhancement and check for existing sheets
 */
function handleNavigation(): void {
  logger.debug('Handling navigation', { pageType: detectPageType() });

  // Clean up any existing enhancement (sheet might have been removed)
  cleanup();

  // Check if there's already a sheet open on the new page
  checkExistingSheet(enhancePlaylistSheet);
}

/**
 * Ensure critical CSS styles are available
 * This is a fallback in case manifest.json CSS injection fails
 */
function ensureCriticalStyles(): void {
  // Check if our styles are already loaded
  const testEl = document.createElement('div');
  testEl.className = 'ype-hidden';
  testEl.style.position = 'absolute';
  testEl.style.visibility = 'hidden';
  document.body.appendChild(testEl);

  const computedDisplay = window.getComputedStyle(testEl).display;
  document.body.removeChild(testEl);

  // If ype-hidden doesn't have display:none, inject critical styles
  if (computedDisplay !== 'none') {
    logger.warn('CSS not properly loaded, injecting critical styles');
    const style = document.createElement('style');
    style.id = 'ype-critical-styles';
    style.textContent = `
      .ype-hidden { display: none !important; }
      .ype-checkbox { width: 20px; height: 20px; min-width: 20px; border: 2px solid rgba(255, 255, 255, 0.6); border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; }
      .ype-checkbox--checked { background: #3ea6ff; border-color: #3ea6ff; }
      .ype-checkbox-icon { width: 14px; height: 14px; fill: white; opacity: 0; }
      .ype-checkbox--checked .ype-checkbox-icon { opacity: 1; }
      .ype-footer { padding: 12px 16px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; background: var(--yt-spec-general-background-a, #0f0f0f); }
      .ype-btn { padding: 8px 16px; border-radius: 18px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
      .ype-btn--cancel { background: transparent; color: #f1f1f1; }
      .ype-btn--save { background: #3ea6ff; color: #0f0f0f; }
      .ype-search-wrapper { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); position: relative; }
      .ype-search-input { width: 100%; padding: 8px 32px 8px 12px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; background: #272727; color: #f1f1f1; font-size: 14px; box-sizing: border-box; }
      .ype-search-clear { position: absolute; right: 24px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #aaa; cursor: pointer; display: none; }
      .ype-search-clear--visible { display: block; }
      .ype-no-results { padding: 24px 16px; text-align: center; color: #aaa; font-size: 14px; }
      .ype-selected-count { color: #aaa; font-size: 13px; }
      .ype-actions { display: flex; gap: 8px; }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Initialize the extension
 */
function init(): void {
  logger.info('YouTube Playlist Enhancer initializing', {
    version: EXTENSION_VERSION,
    pageType: detectPageType(),
  });

  // Ensure critical styles are available
  ensureCriticalStyles();

  // Start observing for playlist sheets
  observePlaylistSheet(enhancePlaylistSheet);

  // Check for existing sheet (in case it's already open)
  checkExistingSheet(enhancePlaylistSheet);

  // Listen for SPA navigation (T033, T035)
  observeNavigation(handleNavigation);

  logger.info('YouTube Playlist Enhancer ready');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
