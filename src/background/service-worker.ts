/**
 * YouTube Playlist Enhancer - Service Worker (Background Script)
 *
 * Currently a placeholder for Manifest V3 compliance.
 * Will be expanded if background processing is needed.
 */

import { EXTENSION_VERSION } from '../types';

// Log when service worker starts
console.log(`[YPE] Service Worker started (v${EXTENSION_VERSION})`);

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[YPE] Extension installed');
  } else if (details.reason === 'update') {
    console.log(`[YPE] Extension updated to v${EXTENSION_VERSION}`);
  }
});
