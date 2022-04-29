# Welcome to the semantic-pyton VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for the extension.
* `package.json` - this is the manifest file in which the language support is declared. It defines the location of the grammar file.
* `syntaxes/ldpy.tmLanguage.json` - this is the Text mate grammar file that is used for tokenization.
* `language-configuration.json` - this is the language configuration, defining the tokens that are used for comments and brackets.

## Get up and running straight away

* Open the folder with visual studio code: `code .`. 
* Press `F5` to open a new window with the extension loaded.
* Create a new file with a file name suffix `.ldpy`.
* Verify that syntax highlighting works and that the language configuration settings are working.

## Make changes

* You can relaunch the extension from the debug toolbar after making changes to the files listed above.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Add more language features

* To add features such as intellisense, hovers and validators, check out the VS Code extenders documentation at https://code.visualstudio.com/docs

## Install the extension

* To start using this extension with Visual Studio Code, copy it into the `<user home>/.vscode/extensions` folder and restart Code.
* (TODO) share the extension with the world, read on https://code.visualstudio.com/docs about publishing an extension.
