// This script is guaranteed to run before the page's own scripts.
// It injects our interceptor into the page's main world.

const script = document.createElement('script');
script.src = chrome.runtime.getURL('interceptor.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);