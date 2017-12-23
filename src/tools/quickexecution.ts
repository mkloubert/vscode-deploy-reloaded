/**
 * This file is part of the vscode-deploy-reloaded distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 * 
 * vscode-deploy-reloaded is free software: you can redistribute it and/or modify  
 * it under the terms of the GNU Lesser General Public License as   
 * published by the Free Software Foundation, version 3.
 *
 * vscode-deploy-reloaded is distributed in the hope that it will be useful, but 
 * WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */


/**
 * Quick execution of JavaScript code.
 * 
 * @param {any} extension The extension context.
 * @param {any|any[]} allWorkspaces List of all workspaces.
 * @param {any|any[]} activeWorkspaces List of all active workspaces.
 */
export async function _1b87f2ee_b636_45b6_807c_0e2d25384b02_1409614337(
    extension: any,
    allWorkspaces: any | any[],
    activeWorkspaces: any | any[],
) {
    // vscode
    const $vs = require('vscode');

    // i18
    const $i18 = require('../i18');

    // helpers
    const $h = require('../helpers');
    // logger
    const $l = require('../log').CONSOLE;

    // all workspaces
    const $w: any[] = $h.asArray(allWorkspaces).map(ws => {
        return $h.makeNonDisposable(ws);
    });
    // active workspaces
    const $aw: any[] = $h.asArray(activeWorkspaces).map(aws => {
        return $h.makeNonDisposable(aws);
    });
    
    // require
    const $r = (id: any) => {
        return $h.requireFromExtension(id);
    };
    
    const $unwrap = async (val: any, maxDepth?: number, currentDepth?: number) => {
        if (isNaN(maxDepth)) {
            maxDepth = 64;
        }
        if (isNaN(currentDepth)) {
            currentDepth = 0;
        }

        if (currentDepth < maxDepth) {
            if (val) {
                if ('function' === typeof val) {
                    val = $unwrap(
                        Promise.resolve(
                            val()
                        ),
                        maxDepth, currentDepth + 1
                    );
                }
            }
        }

        return val;
    };

    // toStringSafe()
    const $s = async (val: any) => {
        return $h.toStringSafe(
            await $unwrap(val)
        );
    };

    // eval()
    const $e = async (code: any) => {
        return await $unwrap(
            eval(await $s(code))
        );
    };

    // show help
    const $help = async () => {
        await require('../html').openMarkdownDocument(
            _27adf674_b653_4ee0_a33d_4f60be7859d2(),
            {
                css: 'a { color: red; }',
                documentTitle: '[vscode-deploy-reloaded] ' + $i18.t('tools.quickExecution.help.title')
            }
        );
    };

    // code to execute
    const _def303d6_7db1_4511_8365_e93ed7979b92_1379012881 = await $vs.window.showInputBox(
        {
            placeHolder: $i18.t('tools.quickExecution.inputCode'),
            value: await $s(extension.workspaceState.get('vscdrLastQuickExecutionCode')),
        }
    );
    if ($h.isEmptyString(_def303d6_7db1_4511_8365_e93ed7979b92_1379012881)) {
        return;
    }

    // save last executed code
    extension.workspaceState.update('vscdrLastQuickExecutionCode',
                                    _def303d6_7db1_4511_8365_e93ed7979b92_1379012881);

    allWorkspaces = undefined;
    activeWorkspaces = undefined;
    extension = undefined;

    const RESULT = await Promise.resolve(
        $e(_def303d6_7db1_4511_8365_e93ed7979b92_1379012881)
    );

    if ('undefined' !== typeof RESULT) {
        $vs.window.showInformationMessage(
            $h.toStringSafe( RESULT )
        ).then(() => {}, (err) => {
            $l.trace(err, 'quickexecution._1b87f2ee_b636_45b6_807c_0e2d25384b02_1409614337(1)');
        });
    }
}

// generate help document
function _27adf674_b653_4ee0_a33d_4f60be7859d2() {
    let help = '';

    help += "# Quick execution help\n";


    help += "## Constants\n";
    // $aw
    help += "### $aw\n";
    help += "An array of active workspace.\n";
    help += "```\n";
    help += "$aw.length\n";
    help += "```\n";
    help += "\n";
    // $l
    help += "### $l\n";
    help += "A [logger](https://mkloubert.github.io/vscode-deploy-reloaded/interfaces/_log_.logger.html).\n";
    help += "```\n";
    help += "$l.warn('Test')\n";
    help += "```\n";
    help += "\n";
    // $w
    help += "### $w\n";
    help += "An array of all available workspace.\n";
    help += "```\n";
    help += "$w.length\n";
    help += "```\n";
    help += "\n";


    help += "## Functions\n";
    // $e
    help += "### $e\n";
    help += "Executes code.\n";
    help += "```\n";
    help += "$e(\"require('vscode').window.showWarningMessage('Test')\")\n";
    help += "```\n";
    help += "\n";
    // $help
    help += "### $help\n";
    help += "Shows this help.\n";
    help += "```\n";
    help += "$help\")\n";
    help += "```\n";
    help += "\n";
    // $r
    help += "### $r\n";
    help += "Includes a module.\n";
    help += "```\n";
    help += "$r('vscode').window.showWarningMessage('Test')\n";
    help += "```\n";
    help += "\n";
    // $s
    help += "### $s\n";
    help += "Converts a value / object to a string that is not `(null)` and not `(undefined)`.\n";
    help += "```\n";
    help += "$s(123)\n";
    help += "```\n";
    help += "\n";


    help += "## Modules\n";
    // $h
    help += "### $h\n";
    help += "Extension [helpers](https://mkloubert.github.io/vscode-deploy-reloaded/modules/_helpers_.html).\n";
    help += "```\n";
    help += "$h.normalizeString('Abcd Efgh  ')\n";
    help += "```\n";
    help += "\n";
    // $vs
    help += "### $vs\n";
    help += "Visual Studio Code [namespace](https://code.visualstudio.com/docs/extensionAPI/vscode-api).\n";
    help += "```\n";
    help += "$vs.window.showWarningMessage('Test')\n";
    help += "```\n";
    help += "\n";

    return help;
}
