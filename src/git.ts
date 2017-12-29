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
 * Most of the code has been taken from 'vscode-gitlens':
 * https://github.com/eamodio/vscode-gitlens
 * 
 * LICENSE:
 * https://github.com/eamodio/vscode-gitlens/blob/master/LICENSE
 */

import * as ChildProcess from 'child_process';
import * as deploy_helpers from './helpers';
const MergeDeep = require('merge-deep');
import * as Path from 'path';


interface Executable {
    cmd: string;
    args: string[];
}

/**
 * Stores the data of a git executable.
 */
export interface GitExecutable {
    /**
     * The path to the executable.
     */
    readonly path: string;
    /**
     * The version.
     */
    readonly version: string;
}

const IS_WINDOWS = process.platform === 'win32';


/**
 * A git client.
 */
export class GitClient {
    /**
     * Initializes a new instance of that class.
     * 
     * @param {GitExecutable} executable The data of the executable.
     */
    constructor(public readonly executable: GitExecutable,
                public readonly cwd?) {
        this.cwd = deploy_helpers.toStringSafe(cwd);
        if (deploy_helpers.isEmptyString(this.cwd)) {
            this.cwd = undefined;
        }
    }

    /**
     * Executes the Git client and returns the stdout.
     * 
     * @param {any[]} args Arguments for the execution.
     * @param {ChildProcess.ExecFileOptions} [opts] Custom options.
     * 
     * @return {Promise<string>} The promise with the standard output.
     */
    public async exec(args: any[], opts?: ChildProcess.ExecFileOptions): Promise<string> {
        return (await this.execFile(
            args, opts,
        )).stdOut;
    }

    /**
     * Executes the Git client.
     * 
     * @param {any[]} args Arguments for the execution.
     * @param {ChildProcess.ExecFileOptions} [opts] Custom options.
     * 
     * @return {Promise<deploy_helpers.ExecResult>} The promise with the result.
     */
    public async execFile(args: any[], opts?: ChildProcess.ExecFileOptions): Promise<deploy_helpers.ExecResult> {
        const DEFAULT_OPTS: ChildProcess.ExecFileOptions = {
            cwd: this.cwd,
        };
        
        return await deploy_helpers.execFile(
            this.executable.path,
            args,
            MergeDeep(DEFAULT_OPTS, opts),
        );
    }

    /**
     * Detects the version of the underlying Git client.
     * 
     * @return {Promise<string>} The promise with the version.
     */
    public async version() {
        return parseVersion(
            deploy_helpers.toStringSafe(
                await this.exec([ '--version' ])
            )
        ).trim();
    }
}


async function findExecutable(exe: string, args: string[]): Promise<Executable> {
    // POSIX can just execute scripts directly, no need for silly goosery
    if (!IS_WINDOWS) {
        return { 
            cmd: await runDownPath(exe),
            args: args 
        }
    }

    if (!(await deploy_helpers.exists(exe))) {
        // NB: When you write something like `surf-client ... -- surf-build` on Windows,
        // a shell would normally convert that to surf-build.cmd, but since it's passed
        // in as an argument, it doesn't happen
        const POSSIBLE_EXTENSIONS = ['.exe', '.bat', '.cmd', '.ps1'];

        for (const EXT of POSSIBLE_EXTENSIONS) {
            const FULL_PATH = await runDownPath(`${exe}${EXT}`);

            if (await deploy_helpers.exists(FULL_PATH)) {
                return await findExecutable(FULL_PATH, args);
            }
        }
    }

    if (exe.match(/\.ps1$/i)) {  // PowerShell
        const CMD = Path.join(process.env.SYSTEMROOT!,
                              'System32', 'WindowsPowerShell', 'v1.0', 'PowerShell.exe');
        const PS_ARGS = [ '-ExecutionPolicy', 'Unrestricted', '-NoLogo', '-NonInteractive', '-File', exe ];

        return {
            cmd: CMD,
            args: PS_ARGS.concat(args),
        };
    }

    if (exe.match(/\.(bat|cmd)$/i)) {  // Windows batch?
        const CMD = Path.join(process.env.SYSTEMROOT!, 'System32', 'cmd.exe');
        const CMD_ARGS = ['/C', exe, ...args];

        return { 
            cmd: CMD,
            args: CMD_ARGS,
        };
    }

    if (exe.match(/\.(js)$/i)) {  // NodeJS?
        const CMD = process.execPath;
        const NODE_ARGS = [exe];

        return { 
            cmd: CMD,
            args: NODE_ARGS.concat(args)
        };
    }

    return { 
        cmd: exe,
        args: args
    };
}

async function findGitDarwin(): Promise<GitExecutable> {
    let path = await runCommand('which', ['git']);
    path = path.replace(/^\s+|\s+$/g, '');

    if (path !== '/usr/bin/git') {
        return findSpecificGit(path);
    }

    try {
        await runCommand('xcode-select', ['-p']);
        
        return findSpecificGit(path);
    }
    catch (ex) {
        if (2 === ex.code) {
            throw new Error('Unable to find git');
        }
        
        return findSpecificGit(path);
    }
}

async function findGitPath(path: string): Promise<GitExecutable | false> {
    path = deploy_helpers.toStringSafe(path);
    if (deploy_helpers.isEmptyString(path)) {
        path = 'git';  // default
    }

    try {
        return await findSpecificGit(path);
    }
    catch (e) {
    }

    // fallback: platform specific
    try {
        switch (process.platform) {
            case 'darwin':
                return await findGitDarwin();
                
            case 'win32':
                return await findGitWin32();
        }
    }
    catch (e) {
    }

    return false;
}

async function findSpecificGit(path: string): Promise<GitExecutable> {
    const VERSION = await runCommand(path, [ '--version' ]);

    // If needed, let's update our path to avoid the search on every command
    if (deploy_helpers.isEmptyString(path) || path === 'git') {
        path = (await findExecutable(path, [ '--version' ])).cmd;
    }

    return {
        path,
        version: parseVersion(VERSION.trim()),
    };
}

function findGitWin32(): Promise<GitExecutable> {
    return findSystemGitWin32(process.env['ProgramW6432']!)
        .then(null, () => findSystemGitWin32(process.env['ProgramFiles(x86)']!))
        .then(null, () => findSystemGitWin32(process.env['ProgramFiles']!))
        .then(null, () => findSpecificGit('git'));
}

async function findSystemGitWin32(basePath: string): Promise<GitExecutable> {
    if (deploy_helpers.isEmptyString(basePath)) {
        throw new Error('Unable to find git');
    }

    return await findSpecificGit(Path.join(basePath,
                                           'Git', 'cmd', 'git.exe'));
}

function parseVersion(raw: string): string {
    return raw.replace(/^git version /, '');
}

async function runCommand(command: string, args: any[]) {
    return (await deploy_helpers.execFile(command, args)).stdOut;
}

async function runDownPath(exe: string): Promise<string> {
    // NB: Windows won't search PATH looking for executables in spawn like
    // Posix does
    // Files with any directory path don't get this applied
    if (exe.match(/[\\\/]/)) {
        return exe;
    }

    const TARGET = Path.join('.', exe);
    try {
        if (await deploy_helpers.stat(TARGET)) {
            return TARGET;
        }
    }
    catch (e) { }

    const HAYSTACK = process.env.PATH!.split(IS_WINDOWS ? ';' : ':');
    for (const P of HAYSTACK) {
        const NEEDLE = Path.join(P, exe);

        try {
            if (await deploy_helpers.stat(NEEDLE)) {
                return NEEDLE;
            }
        }
        catch (e) { }
    }

    return exe;
}

/**
 * Tries to find the path of the Git executable.
 * 
 * @param {string} [path] The optional specific path where to search first.
 * 
 * @return {GitExecutable|false} The promise with the executable or (false) if not found.
 */
export async function tryFindGitPath(path?: string): Promise<GitExecutable | false> {
    let git = await findGitPath(path);
    if (false !== git) {
        git = {
            path: Path.resolve(git.path),
            version: git.version,
        };
    }

    return git;
}
