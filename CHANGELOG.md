# Change Log (vscode-deploy-reloaded)

[![Share via Facebook](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Facebook.png)](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&quote=vscode-deploy-reloaded) [![Share via Twitter](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Twitter.png)](https://twitter.com/intent/tweet?source=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&text=vscode-deploy-reloaded:%20https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&via=mjkloubert) [![Share via Google+](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Google+.png)](https://plus.google.com/share?url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded) [![Share via Pinterest](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Pinterest.png)](https://pinterest.com/pin/create/button/?url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&media=https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo1.gif&description=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20%27vs-deploy%27%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.) [![Share via Reddit](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Reddit.png)](https://www.reddit.com/submit?url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&title=vscode-deploy-reloaded) [![Share via LinkedIn](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/LinkedIn.png)](https://www.linkedin.com/shareArticle?mini=true&url=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&title=vscode-deploy-reloaded&summary=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20%27vs-deploy%27%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.&source=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded) [![Share via Wordpress](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Wordpress.png)](https://wordpress.com/press-this.php?u=https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded&quote=vscode-deploy-reloaded&s=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20%27vs-deploy%27%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.&i=https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo1.gif) [![Share via Email](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/share/Email.png)](mailto:?subject=vscode-deploy-reloaded&body=Recoded%20version%20of%20Visual%20Studio%20Code%20extension%20'vs-deploy'%2C%20which%20provides%20commands%20to%20deploy%20files%20to%20one%20or%20more%20destinations.:%20https%3A%2F%2Fmarketplace.visualstudio.com%2Fitems%3FitemName%3Dmkloubert.vscode-deploy-reloaded)

## 0.89.0 (August 17th, 2019; fixed HTML viewer)

* File preview working ... s. [pull request #141](https://github.com/mkloubert/vscode-deploy-reloaded/pull/141)
* extension requires at least [Visual Studio Code 1.38](https://code.visualstudio.com/updates/v1_38) now
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.533.0`
  * [compare-versions](https://www.npmjs.com/package/compare-versions) `^3.5.1`
  * [lodash](https://www.npmjs.com/package/lodash) `^4.17.15`
  * [sanitize-filename](https://www.npmjs.com/package/sanitize-filename) `^1.6.3`
  * [uuid](https://www.npmjs.com/package/uuid) `^3.3.3`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^5.1.1`
* fixes

## 0.88.0 (July 14th, 2019; fixes)

* fix `isNo.dir` error on local deploy to symlink target ... s. [pull request #139](https://github.com/mkloubert/vscode-deploy-reloaded/pull/139)
* extension requires at least [Visual Studio Code 1.36](https://code.visualstudio.com/updates/v1_36) now
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.493.0`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `^2.10.3`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `^2.4.1`
  * [compare-versions](https://www.npmjs.com/package/compare-versions) `^3.5.0`
  * [express](https://www.npmjs.com/package/express) `^4.17.1`
  * [glob](https://www.npmjs.com/package/glob) `^7.1.4`
  * [lodash](https://www.npmjs.com/package/lodash) `^4.17.14`
  * [marked](https://www.npmjs.com/package/marked) `^0.7.0`
  * [mime-types](https://www.npmjs.com/package/mime-types) `^2.1.24`
  * [moment](https://www.npmjs.com/package/moment) `^2.24.0`
  * [moment-timezone](https://www.npmjs.com/package/moment-timezone) `^0.5.26`
  * [mssql](https://www.npmjs.com/package/mssql) `^4.3.7`
  * [mysql](https://www.npmjs.com/package/mysql) `^2.17.1`
  * [node-emoji](https://www.npmjs.com/package/node-emoji) `^1.10.0`
  * [node-enumerable](https://www.npmjs.com/package/node-enumerable) `^4.0.2`
  * [public-ip](https://www.npmjs.com/package/public-ip) `^2.5.0`
  * [pug](https://www.npmjs.com/package/pug) `^2.0.4`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.6.0`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^5.1.0`

## 0.87.2 (February 18th, 2019; ssh update)

* extension requires at least [Visual Studio Code 1.31](https://code.visualstudio.com/updates/v1_31) now
* updated the following [npm](https://www.npmjs.com/) modules:
  * [ssh2-sftp-client](https://www.npmjs.com/package/ssh2-sftp-client) `2.3.0`

## 0.86.0 (December 2nd, 2018; custom S3 bucket options)

* [denis-gorin](https://github.com/denis-gorin) added custom options to aws.s3 config (ex. endpoint) ... s. [pull request #106](https://github.com/mkloubert/vscode-deploy-reloaded/pull/106)
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.373.0`

## 0.85.0 (December 2nd, 2018; custom deploy files)

* [Federico Salani](https://github.com/488kuroi) activated already existing feature for custom deploy files ... s. [pull request #105](https://github.com/mkloubert/vscode-deploy-reloaded/pull/105)
* extension requires at least [Visual Studio Code 1.29](https://code.visualstudio.com/updates/v1_29) now
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.368.0`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `^2.10.2`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `^2.3.2`
  * [compare-versions](https://www.npmjs.com/package/compare-versions) `^3.4.0`
  * [express](https://www.npmjs.com/package/express) `^4.16.4`
  * [glob](https://www.npmjs.com/package/glob) `^7.1.3`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `^3.5.21`
  * [lodash](https://www.npmjs.com/package/lodash) `^4.17.11`
  * [merge-deep](https://www.npmjs.com/package/merge-deep) `^3.0.2`
  * [mime-types](https://www.npmjs.com/package/mime-types) `^2.1.21`
  * [moment-timezone](https://www.npmjs.com/package/moment-timezone) `^0.5.23`
  * [mssql](https://www.npmjs.com/package/mssql) `^4.3.0`
  * [mysql](https://www.npmjs.com/package/mysql) `^2.16.0`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `^4.7.0`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.4.9`
  * [ws](https://www.npmjs.com/package/uglify-js) `^5.2.2`

## 0.84.0 (June 9th, 2018; notifications)

* notifications are shown at startup now
* bugfixes
* removed `preview` flag from [package.json](https://github.com/mkloubert/vscode-deploy-reloaded/blob/master/package.json)
* extension requires at least [Visual Studio Code 1.25](https://code.visualstudio.com/updates/v1_25) now
* [uuid](https://www.npmjs.com/package/uuid) module is deprecated ... [here](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deprecated#uuid) you can learn, how to migrate
* updated the following [npm](https://www.npmjs.com/) modules:
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^2.12.0`

## 0.83.0 (July 7th, 2018; chrome debugger and sync timestamps)

* added [chrome target operation](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#chrome-), which can executes a method for a DevTools compatible browser debugger, as implemented in [Google Chrome](https://www.google.de/chrome/index.html):

![Demo Chrome DevTools](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo30.gif)

* added `syncTime` setting for [local targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_local) ... s. [issue #84](https://github.com/mkloubert/vscode-deploy-reloaded/issues/84)
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.270.1`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `^3.5.18`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.4.3`

## 0.82.0 (July 3rd, 2018; ask for (S)FTP user and password)

* added `askForPassword` and `askForUser` settings for [ftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) and [sftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) targets ... set them explicitly to `(true)`, if you want to get asked for that value(s) ... s. [issue #71](https://github.com/mkloubert/vscode-deploy-reloaded/issues/71)

## 0.81.2 (July 3rd, 2018; private key passphrase prompts)

* added `alwaysAskForPrivateKeyPassphrase` and `askForPrivateKeyPassphrase` settings for [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) targets ... s. [issue #71](https://github.com/mkloubert/vscode-deploy-reloaded/issues/71)
* fixed bug, which freezes the extension, when pulling 0 byte files from [SFTP server](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) ... s. [issue #82](https://github.com/mkloubert/vscode-deploy-reloaded/issues/82)

## 0.80.1 (July 2nd, 2018; bugfix pull files from SFTP)

* fixed bug, which throws exception, when pulling files from [SFTP server](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) ... s. [issue #81](https://github.com/mkloubert/vscode-deploy-reloaded/issues/81)

## 0.80.0 (June 30th, 2018; deployment speed ups)

* it is possible now, to increase deployment speed, by adding `useFastGlob` as [global](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), [package](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-) and/or [target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) settings ... s. [issue #72](https://github.com/mkloubert/vscode-deploy-reloaded/issues/72)
* updated the following [npm](https://www.npmjs.com/) modules:
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^2.10.3`

## 0.79.1 (June 30th, 2018; improvements)

* added `useGlobalQueue` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--)
* code cleanups and improvements
* bugfixes
* updated the following [npm](https://www.npmjs.com/) modules:
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^2.9.0`

## 0.78.0 (June 30th, 2018; speed improvements)

* improved speed of auto deploy
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.266.1`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `^2.10.0`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `^3.5.17`
  * [moment-timezone](https://www.npmjs.com/package/moment-timezone) `^0.5.21`
  * [ssh2-sftp-client](https://www.npmjs.com/package/ssh2-sftp-client) `^2.3.0`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.4.2`
  * [uuid](https://www.npmjs.com/package/uuid) `^3.3.2`

## 0.77.0 (June 30th, 2018; bugfixes)

* fixed bug, which stops auto deploying, if a lot of files are going to be auto deployed ... s. [issue #79](https://github.com/mkloubert/vscode-deploy-reloaded/issues/79)

## 0.76.1 (June 21th, 2018; Visual Studio Code 1.24 and bugfixes)

* extension requires at least [Visual Studio Code 1.24](https://code.visualstudio.com/updates/v1_24) now
* updated the following [npm](https://www.npmjs.com/) modules:
  * [@icetee/ftp](https://www.npmjs.com/package/@icetee/ftp) `^1.0.3`
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.261.1`
  * [compare-versions](https://www.npmjs.com/package/compare-versions) `^3.3.0`
  * [moment-timezone](https://www.npmjs.com/package/moment-timezone) `^0.5.20`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `^4.6.7`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.4.1`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^2.7.0`
* fixed minor display bug ... s. [issue #78](https://github.com/mkloubert/vscode-deploy-reloaded/issues/78)

## 0.75.1 (June 16th, 2018; bugfixes)

* fixed bug, which occurres when executing [commands](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#commands-) on a [SFTP server](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) by using [placeholders](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#values) ... s. [issue #76](https://github.com/mkloubert/vscode-deploy-reloaded/issues/76)

## 0.75.0 (June 7th, 2018; FTPS support)

* added support for secure FTPS protocol (s. [issue #67](https://github.com/mkloubert/vscode-deploy-reloaded/issues/67)) ... thanks to [Jan Hajek
](https://github.com/hajekj)!
* `ftp` engine of [FTP target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) now uses fork [@icetee/ftp](https://github.com/mscdex/node-ftp) of [node-ftp](https://github.com/mscdex/node-ftp) module ... if you have problems, you can change the engine to `ftp-legacy` to switch to the old module
* extension requires at least [Visual Studio Code 1.23](https://code.visualstudio.com/updates/v1_23) now
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.252.1`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `^2.8.3`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `^2.3.1`
  * [compare-versions](https://www.npmjs.com/package/compare-versions) `^3.2.1`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `^3.5.16`
  * [moment](https://www.npmjs.com/package/moment) `^2.22.2`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `^4.6.5`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.4.0`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `^2.6.2`

## 0.74.1 (May 14th, 2018; npm updates)

* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `^2.238.1`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `^2.8.2`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `^2.3.0`
  * [compare-versions](https://www.npmjs.com/package/compare-versions) `^3.2.0`
  * [hexy](https://www.npmjs.com/package/hexy) `^0.2.11`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `^3.5.15`
  * [lodash](https://www.npmjs.com/package/lodash) `^4.17.10`
  * [moment](https://www.npmjs.com/package/moment) `^2.22.1`
  * [moment-timezone](https://www.npmjs.com/package/moment-timezone) `^0.5.17`
  * [ssh2-sftp-client](https://www.npmjs.com/package/ssh2-sftp-client) `^2.2.1`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `^3.3.25`
* bugfixes with new filesystem API

## 0.73.1 (May 1st, 2018; fixes)

* minor fixes

## 0.73.0 (April 13th, 2018; fixes and improvements)

* bugfixes
* code cleanups and improvements
* added `isHidden` settings for [packages](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-) and [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-)

## 0.72.1 (April 13th, 2018; file explorer operations)

* can list or remove directories on [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-), from file explorer now
* bugfixes

![Demo List and remove diretories from file explorer](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo29.gif)

## 0.71.0 (April 13th, 2018; create directories recursively)

* fixed and improved creation of directories recursively in [sftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) and [ftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) targets
* fixed cancellation of operations, when using things like [azureblob](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_azureblob), [dropbox](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_dropbox), [ftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp), [s3bucket](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_s3bucket), [sftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) and/or [slack](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_slack) targets
* improved displaying file paths in output when running a deploy operation
* added `supportsDeepDirectoryCreation` settings for [sftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) and [ftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) targets, which indicate, if a server supports creating directories recursively or not ... if so, you should set this to `(true)`, which can help increasing speed, when uploading files
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `2.224.1`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `3.3.21`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `1.10.0`

## 0.70.0 (April 11th, 2018; auto deployment)

* added `pauseFilesFor` setting for [packages](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-), which can define a time, in milliseconds, to wait, before an auto operation can be done for a file again
* added `deployOnChangeButton` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which can setup a [button](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deploy_on_change#buttons), that is able to activate or deactivate [deploy on change](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deploy_on_change) feature
* added `deployOnSaveButton` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which can setup a [button](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deploy_on_save#buttons), that is able to activate or deactivate [deploy on save](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deploy_on_save) feature
* added `removeOnChangeButton` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which can setup a [button](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/remove_on_change#buttons), that is able to activate or deactivate [remove on change](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/remove_on_change) feature
* improved concurrent auto deployments
* fixed auto creation of directories on [ftp server](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp)
* more bugfixes

## 0.69.1 (April 10th, 2018; log files)

* added `Deploy Reloaded: Log files ...` command, which can open an extension's log file now
* can define [global buttons](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/buttons) now, s. [issue #52](https://github.com/mkloubert/vscode-deploy-reloaded/issues/52)
* code cleanups and improvements
* bugfixes

## 0.68.1 (April 9th, 2018; improved output)

![Demo Emoji icon output](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo28.gif)

* extension is build for [Visual Studio Code 1.22](https://code.visualstudio.com/updates/v1_22) now
* using new progress api for deploy operations now
* using emoji icons for deploy operations in output window now
* buttons are shown in the status bar after a deploy operation, added `showStatusWhenFinished` to control this ... s. [issue #53](https://github.com/mkloubert/vscode-deploy-reloaded/issues/53)
* added `$lines` function for quick code executions
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `2.222.1`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `2.2.4`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `3.5.14`
  * [moment](https://www.npmjs.com/package/moment) `2.22.0`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `4.6.4`
  * [ssh2-sftp-client](https://www.npmjs.com/package/ssh2-sftp-client) `2.1.1`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `3.3.20`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `1.7.0`
* code cleanups and improvements
* bugfixes

## 0.67.1 (March 28th, 2018; bugfixes)

* bugfixes
* updated the following [npm](https://www.npmjs.com/) modules:
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `0.26.0`

## 0.67.0 (March 26th, 2018; APIs)

* can define [custom API endpoints](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis#custom-endpoints) now
* added `useBuildIn` setting for [APIs](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis), which can define, if [build-in endpoints](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis#endpoints) should be used or not
* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `2.213.1`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `2.2.3`
  * [filesize](https://www.npmjs.com/package/filesize) `3.6.1`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `3.5.12`
  * [i18next](https://www.npmjs.com/package/i18next) `10.6.0`
  * [marked](https://www.npmjs.com/package/marked) `0.3.19`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `4.6.3`
  * [pug](https://www.npmjs.com/package/pug) `2.0.3`
  * [ssh2-sftp-client](https://www.npmjs.com/package/ssh2-sftp-client) `2.1.0`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `3.3.16`
  * [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) `0.23.0`
* "outsourced" `loadModule()` function and `SESSION_STATE` constant to [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module
* bugfixes
* code cleanup and improvements

## 0.66.1 (March 23rd, 2018; SFTP and FTP commands)

* added `commands` setting for [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) targets, which can define [commands](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#commands-) and should be executed on the server
* added `commands` setting for [FTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) targets, which can define [commands](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp#commands-) and should be executed on the server
* bugfixes
* code cleanup and improvements

## 0.65.0 (March 21st, 2018; upload events for SFTP and FTP targets)

* added `beforeUpload` and `uploaded` settings for [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) targets, which store paths to [scripts](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#event-scripts), that are invoked before a file is going to be uploaded or has (tried to be) uploaded ... s. [issue #51](https://github.com/mkloubert/vscode-deploy-reloaded/issues/51)
* added `beforeUpload` and `uploaded` settings for [FTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) targets, which store paths to [scripts](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp#event-scripts), that are invoked before a file is going to be uploaded or has (tried to be) uploaded ... s. [issue #51](https://github.com/mkloubert/vscode-deploy-reloaded/issues/51)
* code cleanups and improvements

## 0.64.0 (March 20th, 2018; bugfixes)

* fixed bug with automatic password prompts ... s [issue #48](https://github.com/mkloubert/vscode-deploy-reloaded/issues/48#issuecomment-374321041)
* "outsourced" `createDirectoryIfNeeded()`, `exists()` functions to [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module
* code cleanups and improvements

## 0.63.1 (March 18th, 2018; APIs and popups)

* added [api endpoints](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis)
  * [POST /markdown](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis#post-apimarkdown)
* added `alwaysShowWorkspaceNameInPopups` and `showWorkspaceNameInPopups` [settings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--) ... s. [issue #47](https://github.com/mkloubert/vscode-deploy-reloaded/issues/47#issuecomment-373940021)
* passwords in input boxes of [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) and [FTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) targets are masked now ... s. [issue #48](https://github.com/mkloubert/vscode-deploy-reloaded/issues/48#issuecomment-374041368)
* "outsourced" `asBuffer()`, `doesMatch()`, `makeNonDisposable()`, `readAll()` functions, `EVENT` constant to [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module
* removed obsolete [npm packages](https://www.npmjs.com/):
  * [isbinaryfile](https://www.npmjs.com/package/isbinaryfile)
* bugfixes
* code cleanups and improvements

## 0.62.3 (March 17th, 2018; password prompts and bugfixes)

* fixed bugs in [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) and [FTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) target, when deploying to root directory ... s. [issue #45](https://github.com/mkloubert/vscode-deploy-reloaded/issues/45) and [issue #46](https://github.com/mkloubert/vscode-deploy-reloaded/issues/46)
* automatic input boxes for username and/or password, if one of them is not defined in [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) and [FTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp) targets ... s. [issue #48](https://github.com/mkloubert/vscode-deploy-reloaded/issues/48)
* showing relative paths for single files, when using `showPopupWhenFinished` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), now ... s. [issue #47](https://github.com/mkloubert/vscode-deploy-reloaded/issues/47#issuecomment-373940021)
* bugfixes

## 0.61.0 (March 17th, 2018; showPopupWhenFinished and APIs)

* improved messages for `showPopupWhenFinished` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--) ... s. [issue #47](https://github.com/mkloubert/vscode-deploy-reloaded/issues/47)
* added [api endpoints](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis)
  * [GET /languages](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis#get-apilanguages)
  * [POST /editors](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis#post-apieditors)
  * [PUT /output](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis#put-apioutput)
* bugfixes
* code cleanups and improvements
* "outsourced" `cloneObjectFlat()`, `isBinaryContent()`, `isEmptyString()` functions to [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module

## 0.60.0 (March 16th, 2018; API)

* can define [API hosts](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/apis) now
* "outsourced" `asLocalTime()`, `asUTC()`, `forEachAsync()`, `format()`, `formatArray()`, `glob()`, `invokeAfter()`, `randomBytes()`, `sleep()`, `toArray()`, `tryClearTimeout()`, `tryDispose()`, `waitWhile()` functions and `DisposableBase` classes to [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module
* bugfixes
* code cleanups and improvements

## 0.59.0 (March 15th, 2018; show popup when finished)

* added `showPopupOnSuccess` and `showPopupWhenFinished` [settings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--) ... s. [issue #42](https://github.com/mkloubert/vscode-deploy-reloaded/issues/42)
* "outsourced" logging, workflow classes and `normalizeString()`, `withProgress()` functions to [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module

## 0.58.0 (March 15th, 2018; vscode-helpers)

* started to "outsource" functions and classes to new [vscode-helpers](https://www.npmjs.com/package/vscode-helpers) npm module

## 0.57.1 (March 13th, 2018; TCP proxies)

* added support for [TCP proxies](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/proxies)
* added [theme color support](https://code.visualstudio.com/docs/getstarted/theme-color-reference) for buttons
* code cleanups and improvements
* fixes

## 0.56.0 (March 8th, 2018; deploy uncommited git changes)

* merged [pull request #37](https://github.com/mkloubert/vscode-deploy-reloaded/pull/37) ... thanks to [Pelly](https://github.com/solid-pixel)!
* bugfixes
* can deploy uncomitted git changes now:

![Demo Deploy uncommited git changes](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo27.gif)

## 0.55.1 (March 8th, 2018; npm updates)

* updated the following [npm](https://www.npmjs.com/) modules:
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `2.205.0`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `2.8.1`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `2.2.2`
  * [html-entities](https://www.npmjs.com/package/html-entities) `1.2.1`
  * [i18next](https://www.npmjs.com/package/i18next) `10.5.0`
  * [marked](https://www.npmjs.com/package/marked) `0.3.17`
  * [mime-types](https://www.npmjs.com/package/mime-types) `2.1.18`
  * [moment](https://www.npmjs.com/package/moment) `2.21.0`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `4.6.2`
  * [pug](https://www.npmjs.com/package/pug) `2.0.0`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) `3.3.13`
* removed the following (obsolete) modules:
  * [ip](https://www.npmjs.com/package/ip)

## 0.54.0 (March 7th, 2018; improvements)

* extension is build for [Visual Studio Code 1.21](https://code.visualstudio.com/updates/v1_21) now
* showing progress when running `Detect git changes` feature in `Deploy Reloaded: Tools`
* output channel of extension is not opened on startup by default anymore (s. [issue #36](https://github.com/mkloubert/vscode-deploy-reloaded/issues/36)) ... to activate the option, you have to set `openOutputOnStartup` to `(true)`
* code cleanups and improvements

## 0.53.3 (March 3rd, 2018; bugfixes)

* fixed encoding problem, when pulling, especially binary, files, via [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) ... s. [issue #34](https://github.com/mkloubert/vscode-deploy-reloaded/issues/34)
* fixed setting [modes](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#modes-for-specific-files) of root files after upload to a [SFTP](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp) server ... s. issues [#32](https://github.com/mkloubert/vscode-deploy-reloaded/issues/32) and [#33](https://github.com/mkloubert/vscode-deploy-reloaded/issues/33)

## 0.53.1 (February 21st, 2018; bugfixes)

* fixed bug, s. [issue #30](https://github.com/mkloubert/vscode-deploy-reloaded/issues/30)

## 0.53.0 (February 20th, save before deploy)

* added `saveBeforeDeploy` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which indicates to save documents in non saved editors, before they are going to be deployed ... this value is `(true)` by default ... s. [issue #143](https://github.com/mkloubert/vs-deploy/issues/143) of [vs-deploy](https://github.com/mkloubert/vs-deploy)
* code cleanups and improvements

## 0.52.2 (February 18th, 2018; FTP and folder mappings)

* automatic create folder that does not exist on a [FTP target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_ftp), s. [issue #27](https://github.com/mkloubert/vscode-deploy-reloaded/issues/27#issuecomment-366529357)
* fixed [folder mappings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/folder_mappings), when handling files with leading dot, s. [issue #28](https://github.com/mkloubert/vscode-deploy-reloaded/issues/28)
* other fixes and improvements

## 0.51.1 (February 18th, 2018; bugfixes)

* fixed bug of cancelling a deploy operation, s. [issue #26](https://github.com/mkloubert/vscode-deploy-reloaded/issues/26)
* setting working directory (cwd) of [app target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_app) explicitly now

## 0.51.0 (February 15th, 2018; package buttons)

* can define custom [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) for a [package button](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#buttons-) now, s. [issue #25](https://github.com/mkloubert/vscode-deploy-reloaded/issues/25)
* code cleanups and improvements
* bugfixes

## 0.50.0 (February 14th, 2018; auto deployment)

* improved auto deployment, like [deployOnChange](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deploy_on_change) or [deployOnSave](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/deploy_on_save), especially for [multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) usage
* [imports](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/imports), which are loaded from local files, will reload the configuration automatically now, if they have been changed
* bugfixes
* other code cleanups and improvements

## 0.49.3 (February 13th, 2018; workspace selector)

* button for selecting the active workspace at the bottom is hidden by default now, if less than 2 workspaces are open, s. [issue #24](https://github.com/mkloubert/vscode-deploy-reloaded/issues/24) ... you can change this by setting `alwaysShowWorkspaceSelector` to `(true)` in a workspace and/or global configuration
* bugfixes
* improvements

## 0.48.0 (February 13th, 2018; Yarn)

* added tools for [Yarn](https://yarnpkg.com/) package manager

![Demo Yarn tools](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo26.gif)

* added `initYarn` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which executes `yarn install` on startup if a `package.json` file exists and NO `node_modules` folder has been found

## 0.47.0 (February 12th, 2018; check before deploy and pull)

* added `checkBeforeDeploy` and `checkBeforePull` settings for [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-)

![Demo Check before deploy and pull](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo25.gif)

* bugfixes

## 0.46.0 (February 12th, 2018; handle multi selections in explorer)

* can deploy, pull and/or delete multi selected files and folders from explorer now, s. [issue #142](https://github.com/mkloubert/vs-deploy/issues/142) in [vs-deploy](https://github.com/mkloubert/vs-deploy) ... thanks to [zamkevich](https://github.com/zamkevich)!

![Demo Handle multi selections from explorer](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo24.gif)

## 0.45.0 (February 12th, 2018; Visual Studio Code 1.20)

* updated to [Visual Studio Code 1.20](https://code.visualstudio.com/updates/v1_20)
* updated [npm packages](https://www.npmjs.com):
  * [@slack/client](https://www.npmjs.com/package/@slack/client) `3.16.0`
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) `2.192.0`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) `2.8.0`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) `2.2.1`
  * [filesize](https://www.npmjs.com/package/filesize) `3.6.0`
  * [html-minifier](https://www.npmjs.com/package/html-minifier) `3.5.9`
  * [i18next](https://www.npmjs.com/package/i18next) `10.3.0`
  * [jsftp](https://www.npmjs.com/package/jsftp) `2.1.3`
  * [lodash](https://www.npmjs.com/package/lodash) `4.17.5`
  * [marked](https://www.npmjs.com/package/marked) `0.3.12`
  * [merge-deep](https://www.npmjs.com/package/merge-deep) `3.0.1`
  * [nodemailer](https://www.npmjs.com/package/nodemailer) `4.4.2`
  * [uglify-js](https://www.npmjs.com/package/nodemailer) `3.3.10`
  * [uuid](https://www.npmjs.com/package/nodemailer) `3.2.1`

## 0.44.0 (February 11th, 2018; code cleanups and bugfixes)

* code cleanup
* bugfixes

## 0.43.0 (February 9th, 2018; quick code execution)

* added `$exec`, `$ltrim`, `$m`, `$new_script`, `$rtrim`, `$run` and `$tz` functions and modules for "quick code execution"
* bugfixes

## 0.42.0 (February 9th, 2018; settings)

* added `ignoreSettingsFolder` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--)

## 0.41.0 (February 9th, 2018; cleanup target operation and emojis)

* added [cleanup](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#cleanup-) target operation
* added `$asc`, `$emoji`, `$emoji_list` and `$emoji_name` functions for "quick code execution"
* added `ignoreGitFolder` and `ignoreSvnFolder` [settings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), s. [issue #23](https://github.com/mkloubert/vscode-deploy-reloaded/issues/23)

## 0.40.0 (February 8th, 2018; quick executions and package buttons)

* added `_`, `$cleanup`, `$commands`, `$fs`, `$g`, `$html`, `$linq` and `$p` modules and functions for "quick code execution"
* [package buttons](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#buttons-) settings can defined by a string, which represents the button text now
* improved logging, when listening directory fails, s. [issue #22](https://github.com/mkloubert/vscode-deploy-reloaded/issues/22)

## 0.39.1 (February 8th, 2018; Slack target operation)

* can define a [target operation](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#slack-), that sends notifications to one or more [Slack](https://slack.com/) channels, before/after deploying or deleting files to/in a [target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) now

![Demo Slack target operation](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo23.gif)

## 0.38.0 (February 8th, 2018; log files)

* logs will be written to `.vscode-deploy-reloaded/.logs` sub folder of the user's home directory now ... files, which are older than 31 days, will be deleted automatically

## 0.36.0 (February 7th, 2018; detect git changes)

* can detect git changes and open them in a new, [markdown](https://en.wikipedia.org/wiki/Markdown) based, text editor now
* can also deploy, pull or delete from a file list of an open text document from a specific selection now

![Demo Detect git changes](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo22.gif)

* bug fixes

## 0.35.0 (February 6th, 2018; patterns for files of git commit)

* can define [minimatch patterns](https://github.com/isaacs/minimatch), when deploying a git commit now, s. [issue #17](https://github.com/mkloubert/vscode-deploy-reloaded/issues/17), now

![Demo file patterns for deploying git commits](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo21.gif)

## 0.34.1 (February 5th, 2018; prompt for package buttons)

* can show an optional prompt before start the operation of a [package button](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#buttons-) now, s. [issue #141](https://github.com/mkloubert/vs-deploy/issues/141) in [vs-deploy](https://github.com/mkloubert/vs-deploy)

![Demo Prompt for package buttons](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo20.gif)

* can define other operation types for [package buttons](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#buttons-), like `delete` or `pull`, now
* bugfixes

## 0.33.0 (February 2nd, 2018; bug fixes)

* fixed "deploy git commit" feature
* started to use [lodash](https://lodash.com) in things like [ScriptArguments interface](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_contracts_.scriptarguments.html)

## 0.32.1 (January 31th, 2018; bug fixes)

* fixed [issue #16](https://github.com/mkloubert/vscode-deploy-reloaded/issues/16)
* code cleanups

## 0.32.0 (January 30th, 2018; deploy file list)

* can deploy, pull or delete files from a list of relative file (or folder) paths, provided by an active text editor, now (like a result of a `git diff --name-only SHA1 SHA2 > ./files.txt` call from command line):
![Demo Deploy file list](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo19.gif)
* code cleanups and improvements

## 0.31.0 (January 25th, 2018; [Bower](https://bower.io))

* added tools for handling [Bower](https://bower.io/) packages:

![Demo Bower helpers](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo18.gif)

* added `initBower` [setting](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--), which runs `bower install` inside the workspace folder on startup, if a `bower.json` file exists and NO `bower_components` sub folder has been found
* bugfixes

## 0.30.3 (January 24th, 2018; context menu)

* can deploy, pull or delete files and folders from context menu now, s. [issue #15](https://github.com/mkloubert/vscode-deploy-reloaded/issues/15)

![Demo Deploy from context menu](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo17.gif)

* bug fixes:
  * [Can I pull remote files into an empty folder?](https://github.com/mkloubert/vscode-deploy-reloaded/issues/13#issuecomment-357482420)
  * [too many SFTP connections](https://github.com/mkloubert/vscode-deploy-reloaded/issues/14)

## 0.29.0 (January 11th, 2018; pull remote files)

* can pull files from a [target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) now, even if they do not exist in workspace ... s. [issue #13](https://github.com/mkloubert/vscode-deploy-reloaded/issues/13)
* bugfixes
* improvements, like better error handling

![Demo Pull files when listen remote directory](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo16.gif)

## 0.28.5 (January 10th, 2018; import git files to packages)

* bugfixes
* can [import files from git](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/import_git_files_to_packages) into a [package](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-) now

![Demo Import git files into package](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo15.gif)

## 0.27.0 (January 8th, 2018; zip target)

* added `fileName` for [zip targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_zip), which can define a custom output filename, s. [issue #12](https://github.com/mkloubert/vscode-deploy-reloaded/issues/12)

## 0.26.0 (January 8th, 2018; quick code execution)

* added `$lower`, `$trim` and `$upper` functions for "quick code execution" in `Deploy Reloaded: Tools ...`
* bugfixes

## 0.25.1 (January 7th, 2018; speed up folder mappings)

* speed up [folder mappings](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-) for [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/folder_mappings)
* bugfixes

## 0.24.1 (January 6th, 2018; enhancements and improvements)

* bugfixes
* added [sub contexts](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/data_transformers#sub-contexts) to [context](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_transformers_.datatransformercontext.html#context) property of [DataTransformerContext](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_transformers_.datatransformercontext.html) interface when [deploying](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/data_transformers#deploy) or [pulling](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/data_transformers#pull) a file
* added `homeDir`, `output`, `settingFolder`, `workspaceRoot` properties to [ScriptArguments](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_contracts_.scriptarguments.html) interface
* added pre-defined `extensionDir` [placeholder](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/values), which provides the path to the extension's subfolder `.vscode-deploy-reloaded` inside the user's [home directory](https://nodejs.org/api/os.html#os_os_homedir)

## 0.23.0 (January 6th, 2018; concurrent target tasks)

* better handling of concurrent tasks for a [target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-)

## 0.22.0 (January 6th, 2018; [compiler](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_compiler) target)

* fixed generating output files in [compiler target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_compiler)
* updated [npm packages](https://www.npmjs.com):
  * [node-eumerable](https://www.npmjs.com/package/node-eumerable) to `^3.9.0`

## 0.21.0 (January 5th, 2018; copy remote directory to clipboard)

* can copy directory path to clipboard, when [list of remote directory](https://github.com/mkloubert/vscode-deploy-reloaded#list-remote-files-), now, s. [issue #10](https://github.com/mkloubert/vscode-deploy-reloaded/issues/10)

![Demo Copy remote directory path to clipboard](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo14.gif)

* last remote directory is cached now
* updated [npm packages](https://www.npmjs.com):
  * [@slack/client](https://www.npmjs.com/package/@slack/client) to `^3.15.0`
  * [aws-sdk](https://www.npmjs.com/package/aws-sdk) to `^2.176.0`
  * [azure-storage](https://www.npmjs.com/package/azure-storage) to `^2.7.0`
  * [coffeescript](https://www.npmjs.com/package/coffeescript) to `"^2.1.1`
  * [dropbox](https://www.npmjs.com/package/dropbox) to `"^2.5.13`
  * [fs-extra](https://www.npmjs.com/package/fs-extra) to `^4.0.3`
  * [i18next](https://www.npmjs.com/package/i18next) to `^10.2.2`
  * [marked](https://www.npmjs.com/package/marked) to `"^0.3.9`
  * [moment](https://www.npmjs.com/package/moment) to `"^2.20.1`
  * [uglify-js](https://www.npmjs.com/package/uglify-js) to `^3.3.4`

## 0.20.0 (January 4th, 2018; 'prepare' target operations)

* [exec target operation](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#exec-) now displays output in output channel by default, s. [issue #6](https://github.com/mkloubert/vscode-deploy-reloaded/issues/6)
* [prepare target operations](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#prepare-) now reloading file list by default, s. [issue #6](https://github.com/mkloubert/vscode-deploy-reloaded/issues/6)

## 0.19.0 (January 4th, 2018; 'prepare' target operations)

* added [prepare](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_operations#prepare-) setting for [targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-), which are executed before `beforeDeploy` and even is no file is going to be handled, s. [issue #6](https://github.com/mkloubert/vscode-deploy-reloaded/issues/6)

## 0.18.0 (January 4th, 2018; app target)

* implemented [app target](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_app), s. [issue #8](https://github.com/mkloubert/vscode-deploy-reloaded/issues/8)

## 0.17.0 (January 4th, 2018; fast file checks for auto deploy)

* speed up file check in "auto deploy" features, by adding `fastCheckOnChange`, `fastCheckOnSave`, `fastCheckOnSync` and `fastFileCheck` flags in [global](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#settings--) and [package](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-) settings ... s. [issue #9](https://github.com/mkloubert/vscode-deploy-reloaded/issues/9)

## 0.16.2 (January 3rd, 2018; deploy all opened files)

* added commands for deploying (`extension.deploy.reloaded.deployAllOpenFiles`) or pulling (`extension.deploy.reloaded.pullAllOpenFiles`) files of all opened text editors

![Demo Deploy or pull all opened files](https://raw.githubusercontent.com/mkloubert/vscode-deploy-reloaded/master/img/demo13.gif)

* improved displaying "deploy messages" in output, s. [issue #5](https://github.com/mkloubert/vscode-deploy-reloaded/issues/5)
* improved displaying dates in git commit lists
* more bugfixes and improvements

## 0.15.0 (January 3rd, 2018; check for requirements)

* added `checkForRequirements`, which can [execute one or more conditions](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/check_for_requirements) by (JavaScript) code to check for (project) requirements
* can define [umask values](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#modes-for-specific-files) for files uploaded via [sftp](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_sftp#modes-for-specific-files) now, s. [issue #3](https://github.com/mkloubert/vscode-deploy-reloaded/issues/3)

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
