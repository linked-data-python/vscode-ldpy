#!/usr/bin/env node
/**
 * Écrit syntaxes/ldpy.tmLanguage.json.
 *
 * Les règles ne sont plus ici : elles vivent dans `linked-data-python-highlight`
 * (src/islands.js pour la lexique des îlots, src/textmate.js pour la grammaire),
 * d'où les backends highlight.js et Prism les tirent aussi
 * — ldpy/021, « jamais de deuxième spécification ».
 *
 * usage : node syntaxes/generate.js [sortie]   (défaut : syntaxes/ldpy.tmLanguage.json)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { resolve } = require('./highlight-pkg');

const OUT = process.argv[2] || path.join(__dirname, 'ldpy.tmLanguage.json');
fs.writeFileSync(OUT, resolve('textmate').grammarText());
console.log(`écrit : ${OUT}`);
