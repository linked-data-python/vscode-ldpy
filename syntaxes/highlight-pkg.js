'use strict';
/**
 * Resolves the `linked-data-python-highlight` package: the SINGLE source of
 * the island rules (record ldpy/021). The `ldpy.tmLanguage.json` grammar is
 * generated from it, then VENDORED here — the extension builds and installs
 * without it; only `npm run generate` and `npm test` need it.
 *
 * Resolution order: the installed npm dependency, then the sibling repository
 * `../highlight-ldpy` (the research workspace layout).
 */
const path = require('path');

const SIBLING = path.join(__dirname, '..', '..', 'highlight-ldpy');

/** A path missing from the package `exports` map raises
 *  ERR_PACKAGE_PATH_NOT_EXPORTED, not MODULE_NOT_FOUND. Both mean "not here",
 *  and both must fall through to the sibling rather than abort. */
const MISSING = new Set(['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED']);

function resolve(sub) {
    try {
        return require(`linked-data-python-highlight/${sub}`);
    } catch (e) {
        if (!MISSING.has(e.code)) throw e;
    }
    try {
        return require(path.join(SIBLING, 'src', `${sub}.js`));
    } catch (e) {
        if (!MISSING.has(e.code)) throw e;
        throw new Error(
            'linked-data-python-highlight not found: `npm i` here, or clone the '
            + `repository as a sibling (${SIBLING}). The vendored grammar `
            + 'syntaxes/ldpy.tmLanguage.json is enough to RUN the extension.');
    }
}

/** Path of the MagicPython vendored by the package (the parity baseline). */
function magicPythonPath() {
    try {
        return require.resolve('linked-data-python-highlight/vendor/MagicPython.tmLanguage.json');
    } catch (e) {
        if (!MISSING.has(e.code)) throw e;
        return path.join(SIBLING, 'vendor', 'MagicPython.tmLanguage.json');
    }
}

module.exports = { resolve, magicPythonPath };
