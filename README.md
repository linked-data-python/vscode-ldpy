# Linked-Data Python for Visual Studio Code

Write RDF *in* Python. `.ldpy` files are Python with Turtle notation added to
the syntax — IRIs, prefixed names, RDF literals, graphs and SPARQL as
**expressions of the language**, not strings passed to a parser.

```ldpy
@prefix ex:  <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

@graph as kg
for row in csv.DictReader(open("sensors.csv")):
    @bindings row
    +{ e<http://example.org/{?id}> a ex:Sensor ;
                                   ex:room ?room ;
                                   ex:value ?v }

for @bindings in m{ ?s ex:value ?v }(kg):
    +{ ?s ex:fahrenheit e{ ?v * 1.8 + 32 } }
```

This extension is the editor half. The language itself lives in the
[`linked-data-python` Python package](https://pypi.org/project/linked-data-python/);
its documentation is at
**<https://linked-data-python.readthedocs.io/>**.

## What you get

| | |
|---|---|
| **Syntax highlighting** | A pure-Python `.ldpy` file is coloured *exactly* as a `.py` file — the grammar is generated from VS Code's own MagicPython, and the ldpy islands are added only where Python could not be. Verified character by character by `npm test`. |
| **Diagnostics, completion, hover, go-to-definition** | From the ldpy language server, which forwards Python questions to a real Python server (`pylsp`) through the language map. |
| **Semantic highlighting** | The islands are re-coloured by the actual transpiler, which knows the declared prefixes. |
| **Run** (`ldpy: Run current file`) | Runs the file through `python -m ldpy`. |
| **Debug** (F5) | Real breakpoints, in your `.ldpy` file. No generated file to step through. |
| **Format** (`Format Document`, format on save) | `black` for the Python, edges normalised for the islands. |
| **Show transpiled Python** | Opens the generated `.py` beside the source, for when you want to see what it became. |

Run, debug and "show transpiled" are in the ▷ button and the preview icon of
the editor title bar, in the editor's context menu, and in the command palette
under **ldpy**.

## Install

1. Install the extension.
2. Install the language, in the interpreter you use for the project:

   ```text
   pip install "linked-data-python[lsp,debug,format]"
   ```

   The extras are what powers the editor: `lsp` the language server, `debug`
   the debugger, `format` the formatter. The core package needs only `rdflib`.

3. Open a `.ldpy` file. The status bar shows the version that was found;
   click it if it says the package is missing and you need to point the
   extension at another interpreter.

The extension uses `ldpy.pythonPath` if you set it, otherwise the interpreter
selected by the Microsoft Python extension, otherwise `python3`. Getting this
wrong is the single most common cause of "nothing happens" — hence the status
bar.

## Debugging

Press **F5**. The extension starts a debugpy session on
`python -m ldpy.debug --run`; because `.ldpy` code is compiled with the source
file's own line numbers, breakpoints bind directly in the file you wrote.

Stepping obeys one invariant: **every stop selects a region of your `.ldpy`
file, and every gesture changes it.** The launcher never appears in the call
stack, and `step in` on an island behaves like `step over` unless you ask for
more with `"justMyCode": false`. A breakpoint dropped *inside* a multi-line
`g{ ... }` cannot bind — the island is one expression — so the extension
**moves the dot** to the island's first line instead of leaving you with a red
dot that never fires.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `ldpy.pythonPath` | *(empty)* | The interpreter that carries the `ldpy` package. Empty means: ask the Python extension, then fall back to `python3` (`python` on Windows). |
| `ldpy.backend` | `pylsp` | Python language server to delegate to, or `none` for the native layer alone. |
| `ldpy.buildDirectory` | `.ldpy-build` | Where generated `.py` files go. |
| `ldpy.lineLength` | `88` | Line length used by the formatter. |
| `ldpy.trace.server` | `off` | Log the traffic with the language server. Turn on for a bug report; leave off otherwise. |

Changing any of the first three restarts the server for you.

Format on save, per language:

```json
{ "[ldpy]": { "editor.formatOnSave": true } }
```

## Commands

All under the **ldpy** category in the command palette:

| Command | |
|---|---|
| Run File | Run through `python -m ldpy` in a terminal |
| Debug File | Same as F5 |
| Show Transpiled Python | Open the generated `.py` beside the source |
| Format All .ldpy Files in Workspace | What "Format Document" cannot do |
| Restart Language Server | After changing the Python package |
| Show Language Server Log | The first thing to attach to a bug report |
| Select Python Interpreter | Or click the status bar item |
| Open Documentation | |

## Keyboard shortcuts

**The extension binds no keys**, on purpose: the keyboard is yours, and every
default binding is a conflict for somebody. The two frequent gestures already
have keys of their own — **F5** debugs and **Ctrl+F5** runs (because the
extension contributes a debugger), **Shift+Alt+F** formats (because the server
provides a formatter).

Bind the rest yourself, scoped to the language so nothing is stolen elsewhere:

```json
{ "key": "ctrl+alt+t", "command": "ldpy.showTranspiled",
  "when": "editorLangId == ldpy" }
```

## Known limits

- The TextMate grammar cannot know which prefixes you declared, so it
  slightly over-colours prefixed names; the language server corrects this
  through semantic tokens. Outside VS Code (GitHub previews, editors with no
  server) the TextMate colouring is what you get.
- One valid Python construct changes meaning in `.ldpy`: `f<x>y` in operand
  position reads as a formatted IRI. It is documented as "do not write this".
- Debugging goes through the direct mode only; the shadow `.py` is for
  inspection, not for stepping.

## Licence

MIT — see `LICENSE.md`. Source:
<https://gitlab.emse.fr/maxime.lefrancois/vscode-ldpy>.
