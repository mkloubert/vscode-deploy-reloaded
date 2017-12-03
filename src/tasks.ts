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

import * as deploy_helpers from './helpers';
import * as deploy_log from './log';
import * as deploy_workspaces from './workspaces';
import * as vscode from 'vscode';


let buildTaskAlreadyRun = false;
let buildTaskTimer: NodeJS.Timer;
let gitPullAlreadyRun = false;
let gitPullTimer: NodeJS.Timer;

/**
 * Runs build task on startup.
 */
export async function runBuildTaskOnStartup() {
    if (buildTaskAlreadyRun) {
        return;
    }
    buildTaskAlreadyRun = true;

    const ME: deploy_workspaces.Workspace = this;
    const CFG = ME.config;

    // close old timer (if defined)
    try {
        let btt = buildTaskTimer;
        if (btt) {
            clearTimeout(btt);
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'tasks.runBuildTaskOnStartup(1)');
    }
    finally {
        buildTaskTimer = null;
    }

    let doRun = false;
    let timeToWait: number;
    if (!deploy_helpers.isNullOrUndefined(CFG.runBuildTaskOnStartup)) {
        if (deploy_helpers.isBool(CFG.runBuildTaskOnStartup)) {
            doRun = CFG.runBuildTaskOnStartup;
        }
        else {
            doRun = true;

            timeToWait = parseInt(deploy_helpers.toStringSafe(CFG.runBuildTaskOnStartup));
        }
    }

    const RUN_BUILD = () => {
        vscode.commands.executeCommand('workbench.action.tasks.build').then(() => {
        }, (err) => {
            deploy_log.CONSOLE
                      .trace(err, 'tasks.runBuildTaskOnStartup(2)');
        });
    };

    if (!doRun) {
        return;
    }

    if (isNaN(timeToWait)) {
        RUN_BUILD();
    }
    else {
        buildTaskTimer = setTimeout(() => {
            RUN_BUILD();
        }, timeToWait);
    }
}

/**
 * Runs the git pull, if defined in config.
 */
export async function runGitPullOnStartup(cfg?: deploy_workspaces.WorkspaceSettings) {
    if (gitPullAlreadyRun) {
        return;
    }
    gitPullAlreadyRun = true;

    const ME: deploy_workspaces.Workspace = this;
    const CFG = cfg || ME.config;

    // close old timer (if defined)
    try {
        let gpt = gitPullTimer;
        if (gpt) {
            clearTimeout(gpt);
        }
    }
    catch (e) {
        deploy_log.CONSOLE
                  .trace(e, 'tasks.runGitPullOnStartup(1)');
    }
    finally {
        gitPullTimer = null;
    }

    let doRun = false;
    let timeToWait: number;
    if (!deploy_helpers.isNullOrUndefined(CFG.runGitPullOnStartup)) {
        if (deploy_helpers.isBool(CFG.runGitPullOnStartup)) {
            doRun = CFG.runGitPullOnStartup;
        }
        else {
            doRun = true;

            timeToWait = parseInt(deploy_helpers.toStringSafe(CFG.runGitPullOnStartup));
        }
    }

    const RUN_PULL = () => {
        vscode.commands.executeCommand('git.pull').then(() => {
        }, (err) => {
            deploy_log.CONSOLE
                      .trace(err, 'tasks.runGitPullOnStartup(2)');
        });
    };

    if (!doRun) {
        return;
    }

    if (isNaN(timeToWait)) {
        RUN_PULL();
    }
    else {
        gitPullTimer = setTimeout(() => {
            RUN_PULL();
        }, timeToWait);
    }
}
