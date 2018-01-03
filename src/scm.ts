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

import * as deploy_contracts from './contracts';
import * as deploy_helpers from './helpers';
import * as Enumerable from 'node-enumerable';
import * as i18 from './i18';
import * as Moment from 'moment';
import * as vscode from 'vscode';


/**
 * A branch.
 */
export interface Branch {
    /**
     * The client, the branch belongs to.
     */
    readonly client: SourceControlClient;
    /**
     * Returns the number of total commits.
     */
    readonly commitCount: () => number | PromiseLike<number>;
    /**
     * Returns all commits of that branch in descending order.
     * 
     * @param {number} [page] The page.
     * 
     * @return {Branch[]|PromiseLike<Branch[]>} The result with the list of branches.
     */
    readonly commits: (page?: number) => Commit[] | PromiseLike<Commit[]>;
    /**
     * The ID / name of the branch.
     */
    readonly id: string;
    /**
     * Data of the last commit.
     */
    readonly lastCommit?: {
        /**
         * ID / hash.
         */
        readonly id: string;
        /**
         * Short version of commit message.
         */
        readonly subject?: string;        
    };
}

/**
 * A commit of a branch.
 */
export interface Commit {
    /**
     * The underlying branch.
     */
    readonly branch: Branch;
    /**
     * Returns all file changes.
     */
    readonly changes: () => FileChange[] | PromiseLike<FileChange[]>;
    /**
     * Commit date.
     */
    readonly date: Moment.Moment;
    /**
     * ID / hash.
     */
    readonly id: string;
    /**
     * The zero-based index inside the whole change history.
     */
    readonly index: number;
    /**
     * Short version of commit message.
     */
    readonly subject?: string;
}

/**
 * A file change of a commit.
 */
export interface FileChange {
    /**
     * The underlying commit.
     */
    readonly commit: Commit;
    /**
     * The file.
     */
    readonly file: string;
    /**
     * The type of change.
     */
    readonly type?: FileChangeType;
}

/**
 * List of file change types.
 */
export enum FileChangeType {
    /**
     * Added
     */
    Added = 1,
    /**
     * Changed / modified
     */
    Modified = 2,
    /**
     * Removed / deleted
     */
    Deleted = 3,
}

/**
 * A client for a source control system.
 */
export interface SourceControlClient {
    /**
     * Returns all known branches.
     * 
     * @return {Branch[]|PromiseLike<Branch[]>} The result with the list of branches.
     */
    readonly branches: () => Branch[] | PromiseLike<Branch[]>;
}


/**
 * Shows a quick for selecting a commit of a SCM client.
 * 
 * @param {SourceControlClient} client The client.
 * 
 * @return {Promise<Commit|false>} The promise with the selected commit (if selected)
 *                                 or (false) if failed.
 */
export async function showSCMCommitQuickPick(client: SourceControlClient): Promise<Commit | false> {
    if (!client) {
        return <any>client;
    }

    try {
        const BRANCHES = deploy_helpers.asArray(
            await Promise.resolve(
                client.branches()
            )
        );

        const BRANCH_QUICK_PICKS: deploy_contracts.ActionQuickPick[] = BRANCHES.map(b => {
            let description: string;
            let detail: string;
            if (b.lastCommit) {
                description = b.lastCommit.id;
                detail = b.lastCommit.subject;
            }
            
            return {
                action: () => {
                    return b;
                },

                label: '$(git-branch)  ' + deploy_helpers.toStringSafe(b.id).trim(),
                description: deploy_helpers.toStringSafe(description).trim(),
                detail: deploy_helpers.toStringSafe(detail).trim(),
            };
        });

        if (BRANCH_QUICK_PICKS.length < 1) {
            deploy_helpers.showWarningMessage(
                i18.t('scm.branches.noneFound')
            );

            return false;
        }

        let selectedBranchItem: deploy_contracts.ActionQuickPick;
        if (1 === BRANCH_QUICK_PICKS.length) {
            selectedBranchItem = BRANCH_QUICK_PICKS[0];
        }
        else {
            selectedBranchItem = await vscode.window.showQuickPick(
                BRANCH_QUICK_PICKS,
                {
                    placeHolder: i18.t('scm.branches.selectBranch')
                },
            );
        }

        if (!selectedBranchItem) {
            return;
        }

        const SELECTED_BRANCH: Branch = selectedBranchItem.action();

        let selectCommit: (page?: number) => Promise<Commit | false>;
        selectCommit = async (page?: number): Promise<Commit | false> => {
            const COMMITS = await SELECTED_BRANCH.commits(page);

            const IS_FIRST_PAGE = isNaN(page);
            const IS_LAST_PAGE = !deploy_helpers.isSymbol(
                Enumerable.from(COMMITS)
                          .any(c => 0 == c.index),
            );

            const COMMIT_QUICK_PICKS: deploy_contracts.ActionQuickPick[] = COMMITS.map(c => {
                return {
                    action: () => {
                        return c;
                    },
    
                    label: '$(git-commit)  ' + deploy_helpers.toStringSafe(c.subject).trim(),
                    description: deploy_helpers.toStringSafe(
                        c.date.format( i18.t('time.dateTimeWithSeconds') )
                    ),
                    detail: deploy_helpers.toStringSafe(c.id).trim(),
                };
            });

            if (!IS_FIRST_PAGE) {
                const PREV_PAGE = page - 1;

                COMMIT_QUICK_PICKS.push({
                    action: async () => {
                        return await selectCommit(PREV_PAGE);
                    },

                    label: i18.t('pagination.previousPage',
                                 PREV_PAGE),
                    description: '',
                });
            }

            if (!IS_LAST_PAGE) {
                const NEXT_PAGE = isNaN(page) ? 2 : (page + 1);

                COMMIT_QUICK_PICKS.push({
                    action: async () => {
                        return await selectCommit(NEXT_PAGE);
                    },

                    label: i18.t('pagination.nextPage',
                                 NEXT_PAGE),
                    description: '',
                });
            }

            if (COMMIT_QUICK_PICKS.length < 1) {
                deploy_helpers.showWarningMessage(
                    i18.t('scm.commits.noneFound')
                );
    
                return false;
            }

            let selectedCommitItem: deploy_contracts.ActionQuickPick;
            if (1 === COMMIT_QUICK_PICKS.length) {
                selectedCommitItem = COMMIT_QUICK_PICKS[0];
            }
            else {
                selectedCommitItem = await vscode.window.showQuickPick(
                    COMMIT_QUICK_PICKS,
                    {
                        placeHolder: i18.t('scm.commits.selectCommit')
                    }
                );
            }

            if (!selectedCommitItem) {
                return;
            }

            return await Promise.resolve(
                selectedCommitItem.action()
            );
        };

        return await selectCommit();
    }
    catch (e) {
        deploy_helpers.showErrorMessage(
            i18.t('scm.commits.errors.selectingCommitFailed',
                  e)
        );
    }
}
