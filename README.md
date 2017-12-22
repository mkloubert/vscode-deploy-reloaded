# vscode-deploy-reloaded

[![Latest Release](https://vsmarketplacebadge.apphb.com/version-short/mkloubert.vscode-deploy-reloaded.svg)](https://marketplace.visualstudio.com/items?itemName=mkloubert.vscode-deploy-reloaded)
[![Installs](https://vsmarketplacebadge.apphb.com/installs/mkloubert.vscode-deploy-reloaded.svg)](https://marketplace.visualstudio.com/items?itemName=mkloubert.vscode-deploy-reloaded)
[![Rating](https://vsmarketplacebadge.apphb.com/rating-short/mkloubert.vscode-deploy-reloaded.svg)](https://marketplace.visualstudio.com/items?itemName=mkloubert.vscode-deploy-reloaded#review-details)

Recoded version of [Visual Studio Code](https://code.visualstudio.com) extension [vs-deploy](https://github.com/mkloubert/vs-deploy), which provides commands to deploy files to one or more destinations.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=marcel.kloubert%40gmx.net&item_name=vscode-deploy-reloaded&item_number=vscode-deploy-reloaded&currency_code=EUR)

## Table of contents

1. [Install](#install-)
2. [How to use](#how-to-use-)
   * [Settings](#settings-)
     * [Packages](#packages-)
     * [Targets](#targets-)
   * [How to execute](#how-to-execute-)

## Install [[&uarr;](#table-of-contents)]

Launch VS Code Quick Open (`Ctrl + P`), paste the following command, and press enter:

```bash
ext install vscode-deploy-reloaded
```

Or search for things like `vscode-deploy-reloaded` in your editor.

## How to use [[&uarr;](#table-of-contents)]

Detailed information can be found at the [wiki](https://github.com/mkloubert/vscode-deploy-reloaded/wiki).

Otherwise...

### Settings [[&uarr;](#how-to-use-)]

Open (or create) your `settings.json` in your `.vscode` subfolder of your workspace.

Add a `deploy.reloaded` section:

```json
{
    "deploy.reloaded": {
    }
}
```

#### Packages [[&uarr;](#settings-)]

A package is a description of files of your workspace that should be deployed.

Add the subsection `packages` and add one or more entry:

```json
{
    "deploy.reloaded": {
        "packages": [
            {
                "name": "Version 2.3.4",
                "description": "Package version 2.3.4",
                "files": [
                    "**/*.php",
                    "/*.json"
                ],
                "exclude": [
                    "tests/**"
                ],
                "deployOnSave": true
            }
        ]
    }
}
```

Have a look at the [wiki](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#packages-), to get more information about packages.

#### Targets [[&uarr;](#settings-)]

A target describes where a file or package should be transfered to.

Add the subsection `targets` and add one or more entry:

```json
{
    "deploy.reloaded": {
        "targets": [
            {
                "type": "sftp",
                "name": "My SFTP folder",
                "description": "A SFTP folder",
                "dir": "/my_package_files",
                "host": "localhost", "port": 22,
                "user": "tester", "password": "password",

                "checkBeforeDeploy": true,

                "mappings": [
                    {
                        "source": "dir/of/files/that/should/be/mapped",
                        "target": "dir/on/target"
                    }
                ]
            },
            {
                "type": "ftp",
                "name": "My FTP folder",
                "description": "A FTP folder",
                "dir": "/my_package_files",
                "host": "localhost", "port": 21,
                "user": "anonymous", "password": "",

                "deployed": [
                    {
                        "type": "sql",
                        "engine": "mysql",

                        "queries": [
                            "TRUNCATE TABLE `debug`",
                            "TRUNCATE TABLE `logs`"
                        ]
                    },
                    {
                        "target": "https://github.com/mkloubert"
                    }
                ]
            },
            {
                "type": "local",
                "name": "My local folder",
                "description": "A local folder",
                "dir": "E:/test/my_package_files"
            },
            {
                "type": "local",
                "name": "My network folder",
                "description": "A SMB shared network folder",
                "dir": "\\\\MyServer\\my_package_files"
            },
            {
                "type": "zip",
                "name": "My ZIP file",
                "description": "Create a ZIP file in a target directory",
                "target": "E:/test"
            },
            {
                "type": "mail",
                "name": "My mail server",
                "description": "An email deployer",
                "host": "smtp.example.com", "port": 465,
                "secure": true, "requireTLS": true,
                "user": "mkloubert@example.com", "password": "P@assword123!",
                "from": "mkloubert@example.com",
                "to": "tm@example.com, ys@example.com"
            },
            {
                "type": "script",
                "name": "My script",
                "description": "A deploy script",
                "script": "E:/test/deploy.js",
                "options": {
                    "TM": 5979,
                    "MK": "23979"
                }
            },
            {
                "type": "batch",
                "name": "My Batch",
                "description": "A batch operation",
                "targets": ["My mail server", "My ZIP file"]
            },
            {
                "type": "azureblob",
                "name": "My Azure blob storage",
                "description": "An container in an Azure blob storage",
                "container": "my-container",
                "account": "my-storage-account",
                "accessKey": "<ACCESS-KEY-FROM-AZURE-PORTAL>"
            },
            {
                "type": "s3bucket",
                "name": "My Amazon Bucket",
                "description": "An Amazon AWS S3 bucket",
                "bucket": "my-bucket"
            },
            {
                "type": "dropbox",
                "name": "My DropBox folder",
                "description": "Deploy to my DropBox folder",

                "token": "<ACCESS-TOKEN>"
            }
        ]
    }
}
```

Have a look at the [wiki](https://github.com/mkloubert/vscode-deploy-reloaded/wiki#targets-), to get more information about targets.

### How to execute [[&uarr;](#how-to-use-)]

Press `F1` and enter one of the following commands:

| Name | Description |
| ---- | --------- |
| `Deploy Reloaded: Compare ...` | Opens a set of commands, to compare local and remote files. |
| `Deploy Reloaded: Delete ...` | Commands for deleting files.  |
| `Deploy Reloaded: Deploy ...` | List of commands for deploying files. |
| `Deploy Reloaded: List directory ...` | Lists a (remote) directory. |
| `Deploy Reloaded: Pull ...` | Pull or download files from remote. |
| `Deploy Reloaded: Switches ...` | Handle [switch targets](https://github.com/mkloubert/vscode-deploy-reloaded/wiki/target_switch). |
| `Deploy Reloaded: Tools ...` | A set of helpful tools. |
