# Change Log (vscode-deploy-reloaded)

[![Share via Facebook](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Facebook.png)](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&quote=vscode-deploy-reloaded) [![Share via Twitter](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Twitter.png)](https://twitter.com/intent/tweet?source=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&text=vscode-deploy-reloaded:%20https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&via=mjkloubert) [![Share via Google+](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Google+.png)](https://plus.google.com/share?url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded) [![Share via Pinterest](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Pinterest.png)](https://pinterest.com/pin/create/button/?url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&media=https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo1.gif&description=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20%27vs-deploy%27%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.) [![Share via Reddit](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Reddit.png)](https://www.reddit.com/submit?url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&title=vscode-deploy-reloaded) [![Share via LinkedIn](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/LinkedIn.png)](https://www.linkedin.com/shareArticle?mini=true&url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&title=vscode-deploy-reloaded&summary=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20%27vs-deploy%27%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.&source=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded) [![Share via Wordpress](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Wordpress.png)](https://wordpress.com/press-this.php?u=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&quote=vscode-deploy-reloaded&s=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20%27vs-deploy%27%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.&i=https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo1.gif) [![Share via Email](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Email.png)](mailto:?subject=vscode-deploy-reloaded&body=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20'vs-deploy'%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.:%20https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded)


## 0.15.0 (January 3rd, 2018; check for requirements)

* added `checkForRequirements`, which can [execute one or more conditions](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/check_for_requirements) by (JavaScript) code to check for (project) requirements
* can define [umask values](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#modes-for-specific-files) for files uploaded via [sftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#modes-for-specific-files) now

## 0.14.2 (January 3rd, 2018; deploy git commits)

* can deploy changes of a git commit now

![Demo Deploy git commit](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo12.gif)

* fixed `privateKey` setting for [sftp targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp), thanks to [Robert Ehlers](https://github.com/rehlers)!
* fixed using [folder mappings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/folder_mappings) in [batch targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_batch), s. [issue #2](https://github.com/mkloubert/vscode-deploy-reloaded/issues/2)

## 0.13.0 (January 2nd, 2018; setting up requirements)

* added `requiredExtensions` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/check_for_required_extensions), which checks if required VS Code extensions are installed or not
* bugfixes
* code improvements

## 0.12.0 (January 1st, 2018; quick executions)

* added `$err`, `$info`, `$ip`, `$now`, `$utc` and `$warn` functions for quick code executions

![Demo Quick execution function 20180101](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo11.gif)

* bugfixes
* code improvements

## 0.11.1 (January 1st, 2018; SFTP and values)

* can get [placeholders](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/values) from files and environment variables now
* fixed `tryKeyboard` support in [SFTP targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp)

## 0.10.0 (December 30th, 2017; shell commands, S3 and external sources)

* added `executeOnStartup` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which runs [shell commands on startup](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/execute_on_startup)
* fixed use of [if](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/if) property in setting objects
* better handling of [credentials config](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_s3bucket#credentials) of [S3 target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_s3bucket)
* added `dropbox`, `ftp`, `sftp` and `slack` protocol support for [external sources](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/external_sources)

## 0.9.0 (December 30th, 2017; [Composer](https://getcomposer.org/))

* added tools for handling [Composer](https://getcomposer.org/) packages:

![Demo Composer helpers](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo10.gif)

* bugfixes
* code improvements
* added `initComposer` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which runs `composer install` inside the workspace folder on startup, if a `composer.json` file exists and NO `vendor` sub folder has been found
* added `extension`, `folder` and `sessionState` properties to [ScriptArguments](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_contracts_.scriptarguments.html)

## 0.8.0 (December 29th, 2017; target operations)

* bugfixes
* code improvements
* added [exec](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#exec-) target operation
* improved use of `if` properties and [placeholders](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/values)
* fixed loading settings from parent folder

## 0.7.0 (December 29th, 2017; [npm](https://www.npmjs.com/package/npm))

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
