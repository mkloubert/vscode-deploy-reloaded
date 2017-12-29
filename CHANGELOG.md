# Change Log (vscode-deploy-reloaded)

## 0.8.0 (December 29th, 2017; target operations)

* bugfixes
* code improvements
* added [exec](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#exec-) target operation
* improved use of `if` properties and [placeholders](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/values)

## 0.7.0 (December 29th, 2017; npm)

* bugfixes
* code improvements
* added `initNodeModules` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which runs `npm install` inside the workspace folder on startup, if a `package.json` file exists and NO `node_modules` sub folder has been found
* added [tools](https://github.com/mkloubert/vscode-deploy-reloaded#npm-helpers-) for Node Package Manager ([npm](https://www.npmjs.com/package/npm))
* added global and context based event properties (`events` and `globalEvents`) to [ScriptArguments](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_contracts_.scriptarguments.html)

## 0.6.0 (December 28th, 2017; bugfixes)

* fixed [folder mappings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/folder_mappings)
* fixed `hideIf` and `showIf` properties for [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-)
* code cleanups
* added [demo](https://github.com/mkloubert/vscode-deploy-reloaded#send-files-to-other-editors-), which shows how to send files to another editor

## 0.5.0 (December 28th, 2017; improvements)

* bugfixes
* code improvements
* [placeholders](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/values) can be applied to properties of [packages](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-) and [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) now, s. [apply values](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apply_values)

## 0.4.0 (December 28th, 2017; enhancements)

* bugfixes
* code improvements
* display network information
* more information for the output channel
* tool actions, packages and targets are sorted and displayed by usage in the GUI now

## 0.3.0 (December 27th, 2017; tools)

* bugfixes
* extended tools

## 0.2.0 (December 27th, 2017; improvements and bugfixes)

* bugfixes
* improved displaying [packages](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-) and [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) in the GUI

## 0.1.2 (December 27th, 2017; initial release)

For more information about the extension, that a look at the [project page](https://github.com/mkloubert/vscode-deploy-reloaded) or the [wiki](https://github.com/mkloubert/vscode-deploy-reloaded/wiki).
