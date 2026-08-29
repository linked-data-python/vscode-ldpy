'use strict';
/**
 * Résout le paquet `linked-data-python-highlight` : la source UNIQUE des
 * règles d'îlot (ldpy/021). La grammaire `ldpy.tmLanguage.json`
 * est engendrée par lui puis VENDORÉE ici — l'extension se construit et
 * s'installe sans lui ; seuls `npm run generate` et `npm test` en ont besoin.
 *
 * Ordre de résolution : dépendance npm installée, puis dépôt frère
 * `../highlight-ldpy` (l'espace de travail de recherche).
 */
const path = require('path');

const SIBLING = path.join(__dirname, '..', '..', 'highlight-ldpy');

function resolve(sub) {
    try {
        return require(`linked-data-python-highlight/${sub}`);
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
    try {
        return require(path.join(SIBLING, 'src', `${sub}.js`));
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
        throw new Error(
            'linked-data-python-highlight introuvable : `npm i linked-data-python-highlight` ' +
            `ou cloner le dépôt en frère (${SIBLING}). ` +
            'La grammaire vendorée syntaxes/ldpy.tmLanguage.json, elle, suffit à faire tourner l\'extension.');
    }
}

/** Chemin du MagicPython vendoré par le paquet (base de la parité). */
function magicPythonPath() {
    try {
        return require.resolve('linked-data-python-highlight/vendor/MagicPython.tmLanguage.json');
    } catch (e) {
        if (e.code !== 'MODULE_NOT_FOUND') throw e;
        return path.join(SIBLING, 'vendor', 'MagicPython.tmLanguage.json');
    }
}

module.exports = { resolve, magicPythonPath };
