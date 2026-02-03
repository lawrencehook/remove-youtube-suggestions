/**
 * Test setup for browser extension code
 *
 * This module provides:
 * 1. Browser API mocks (browser.storage, etc.)
 * 2. Helpers to load source files and extract their globals
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Mock storage data
let storageData = {};

// Mock browser APIs
const browserMock = {
  storage: {
    local: {
      get: async (keys, callback) => {
        let effectiveKeys = keys;
        let effectiveCallback = callback;

        if (typeof effectiveKeys === 'function') {
          effectiveCallback = effectiveKeys;
          effectiveKeys = null;
        }

        let result;
        if (typeof effectiveKeys === 'string') {
          result = { [effectiveKeys]: storageData[effectiveKeys] };
        } else if (Array.isArray(effectiveKeys)) {
          result = {};
          effectiveKeys.forEach(key => {
            if (key in storageData) result[key] = storageData[key];
          });
        } else if (effectiveKeys && typeof effectiveKeys === 'object') {
          result = {};
          Object.keys(effectiveKeys).forEach(key => {
            result[key] = (key in storageData) ? storageData[key] : effectiveKeys[key];
          });
        } else {
          result = { ...storageData };
        }

        if (typeof effectiveCallback === 'function') {
          effectiveCallback(result);
          return;
        }

        return result;
      },
      set: async (items) => {
        Object.assign(storageData, items);
      },
      remove: async (keys) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => delete storageData[key]);
      },
    },
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  runtime: {
    getURL: (p) => `chrome-extension://mock-id/${p}`,
  },
};

function resetStorage() {
  storageData = {};
}

function setStorageData(data) {
  storageData = { ...data };
}

function getStorageData() {
  return { ...storageData };
}

/**
 * Create base context with browser globals and common APIs
 */
function createBaseContext(extraGlobals = {}) {
  return {
    browser: browserMock,
    chrome: browserMock,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Error,
    Promise,
    RegExp,
    Set,
    Map,
    fetch: async () => { throw new Error('fetch not mocked'); },
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    ...extraGlobals,
  };
}

/**
 * Transform source code to capture all top-level const/let/function declarations.
 *
 * This uses a simple regex-based approach to find declarations and export them.
 * It's not a full parser but works well for the extension's coding style.
 */
function wrapCodeForExport(code) {
  // Find all top-level declarations:
  // - const NAME = ...
  // - let NAME = ...
  // - function NAME(...) { ... }
  // - var NAME = ...

  const declarations = new Set();

  // Match: const/let/var NAME (at start of line or after semicolon/brace)
  const varRegex = /(?:^|[;\n{])\s*(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  let match;
  while ((match = varRegex.exec(code)) !== null) {
    declarations.add(match[1]);
  }

  // Match: function NAME(
  const funcRegex = /(?:^|[;\n{])\s*function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
  while ((match = funcRegex.exec(code)) !== null) {
    declarations.add(match[1]);
  }

  // Build export code
  const exportStatements = Array.from(declarations)
    .map(name => `if (typeof ${name} !== 'undefined') __exports__["${name}"] = ${name};`)
    .join('\n      ');

  return `
    (function() {
      ${code}

      ${exportStatements}
    })();
  `;
}

/**
 * Load a source file and return its exports/globals
 */
function loadSourceFile(relativePath, extraGlobals = {}) {
  const srcPath = path.join(__dirname, '..', 'src', relativePath);
  const code = fs.readFileSync(srcPath, 'utf-8');

  const context = createBaseContext(extraGlobals);
  context.__exports__ = {};

  vm.createContext(context);
  vm.runInContext(wrapCodeForExport(code), context, { filename: srcPath });

  Object.assign(context, context.__exports__);
  return context;
}

/**
 * Load multiple source files in order (for dependencies)
 */
function loadSourceFiles(relativePaths, extraGlobals = {}) {
  const context = createBaseContext(extraGlobals);
  context.__exports__ = {};

  vm.createContext(context);

  for (const relativePath of relativePaths) {
    const srcPath = path.join(__dirname, '..', 'src', relativePath);
    const code = fs.readFileSync(srcPath, 'utf-8');
    vm.runInContext(wrapCodeForExport(code), context, { filename: srcPath });
  }

  Object.assign(context, context.__exports__);
  return context;
}

/**
 * Deep equality check that works across VM realms
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Assert deep equality across VM realms
 */
function assertDeepEqual(actual, expected, message) {
  if (!deepEqual(actual, expected)) {
    const err = new Error(message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    err.actual = actual;
    err.expected = expected;
    throw err;
  }
}

module.exports = {
  browserMock,
  resetStorage,
  setStorageData,
  getStorageData,
  loadSourceFile,
  loadSourceFiles,
  deepEqual,
  assertDeepEqual,
};
