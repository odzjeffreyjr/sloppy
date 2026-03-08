/**
 * Feed Iframe Debug Script
 * 
 * Copy and paste this into the browser console when on http://localhost:5173/feed
 * to diagnose iframe loading issues.
 */

(function debugFeedIframes() {
  console.log('🔍 Starting Feed Iframe Debug...\n');
  
  // Step 1: Count iframes
  const iframes = Array.from(document.querySelectorAll('iframe'));
  console.log(`📊 Found ${iframes.length} iframe(s)\n`);
  
  // Step 2: Inspect each iframe
  iframes.forEach((iframe, i) => {
    console.log(`━━━ Iframe ${i + 1} ━━━`);
    console.log('  src:', iframe.src || '(empty)');
    console.log('  sandbox:', iframe.getAttribute('sandbox') || '(none)');
    console.log('  className:', iframe.className);
    console.log('  visibility:', iframe.style.visibility);
    console.log('  pointer-events:', window.getComputedStyle(iframe).pointerEvents);
    console.log('  dimensions:', {
      width: iframe.offsetWidth,
      height: iframe.offsetHeight
    });
    console.log('  contentWindow:', iframe.contentWindow ? '✅ accessible' : '❌ null');
    console.log('');
  });
  
  // Step 3: Check for network errors
  const resourceEntries = performance.getEntriesByType('resource');
  const storageResources = resourceEntries.filter(r => r.name.includes('storage.googleapis'));
  
  console.log(`📡 Found ${storageResources.length} GCS resource(s):\n`);
  storageResources.forEach(r => {
    const status = r.transferSize === 0 ? '❌ FAILED' : '✅ OK';
    console.log(`  ${status} ${r.name}`);
    console.log(`    duration: ${r.duration.toFixed(2)}ms`);
    console.log(`    size: ${r.transferSize} bytes`);
    console.log('');
  });
  
  // Step 4: Listen for game messages
  console.log('👂 Listening for game messages...\n');
  
  let readyReceived = false;
  const messageHandler = (e) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    
    if (e.data === 'sloppy:game:ready' || e.data?.type === 'sloppy:game:ready') {
      readyReceived = true;
      console.log(`✅ [${timestamp}] Game ready signal received from:`, e.origin);
    } else if (e.data?.type?.startsWith?.('sloppy:')) {
      console.log(`📨 [${timestamp}] Sloppy message:`, e.data);
    } else if (e.data && typeof e.data === 'object' && e.data.type) {
      console.log(`📬 [${timestamp}] Other message:`, e.data.type, e.data);
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Step 5: Check after 5 seconds
  setTimeout(() => {
    console.log('\n⏰ 5-second check:');
    console.log(`  Ready signal received: ${readyReceived ? '✅ YES' : '❌ NO'}`);
    
    // Check if iframes changed
    const currentIframes = document.querySelectorAll('iframe').length;
    console.log(`  Current iframe count: ${currentIframes}`);
    
    // Try to access game state from React
    const feedContainer = document.querySelector('[class*="Feed"]') || document.querySelector('div[class*="fixed inset-0"]');
    if (feedContainer) {
      console.log(`  Feed container found: ✅`);
    } else {
      console.log(`  Feed container: ❌ Not found`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('  1. Click center of screen to trigger "tap to play"');
    console.log('  2. Run: debugFeedClickTest()');
    console.log('  3. Or manually inspect: document.querySelectorAll("iframe")[0].src');
  }, 5000);
  
  // Export helper functions
  window.debugFeedClickTest = function() {
    console.log('\n🖱️ Simulating center click...');
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: centerX,
      clientY: centerY
    });
    
    const element = document.elementFromPoint(centerX, centerY);
    console.log('  Element at center:', element?.tagName, element?.className);
    element?.dispatchEvent(clickEvent);
    
    setTimeout(() => {
      console.log('  ⏰ 2 seconds after click:');
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe, i) => {
        console.log(`    Iframe ${i + 1} pointer-events:`, window.getComputedStyle(iframe).pointerEvents);
      });
    }, 2000);
  };
  
  window.debugFeedSendCommand = function(command = 'start') {
    const iframes = document.querySelectorAll('iframe');
    console.log(`\n📤 Sending "${command}" command to ${iframes.length} iframe(s)...`);
    
    iframes.forEach((iframe, i) => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'sloppy:command',
          command: command
        }, '*');
        console.log(`  ✅ Sent to iframe ${i + 1}`);
      } else {
        console.log(`  ❌ Iframe ${i + 1} contentWindow is null`);
      }
    });
  };
  
  window.debugFeedCheckState = function() {
    console.log('\n📊 Current State Check:');
    
    // Check React DevTools if available
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('  React DevTools: ✅ Available');
    }
    
    // Check for Zustand store
    const storeKeys = Object.keys(window).filter(k => k.includes('store') || k.includes('Store'));
    console.log('  Potential stores:', storeKeys.length > 0 ? storeKeys : 'None found');
    
    // Check for error messages
    const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
    if (errorElements.length > 0) {
      console.log('  ⚠️ Error elements found:', errorElements.length);
      errorElements.forEach(el => {
        console.log('    -', el.textContent.substring(0, 100));
      });
    }
    
    // Check loading states
    const spinners = document.querySelectorAll('[class*="spinner"], [class*="Spinner"], [class*="loading"]');
    console.log('  Loading indicators:', spinners.length);
    
    // Check for "Failed to load game" message
    const failedMsg = Array.from(document.querySelectorAll('span')).find(s => 
      s.textContent.includes('Failed to load game') || s.textContent.includes('Game not available')
    );
    if (failedMsg) {
      console.log('  ❌ Error message found:', failedMsg.textContent);
    }
  };
  
  console.log('✅ Debug script loaded!');
  console.log('\nAvailable functions:');
  console.log('  debugFeedClickTest()   - Simulate center click');
  console.log('  debugFeedSendCommand() - Send command to iframe');
  console.log('  debugFeedCheckState()  - Check current state');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
})();
