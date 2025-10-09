import * as core from '@actions/core';
import {
    Environment,
    EnvironmentsApi,
    BackupManagementApi,
    CreateBackupRequest
} from '@quantcdn/quant-client';

const apiOpts = (apiKey: string) => {
    return {
        applyToRequest: (requestOptions: any) => {
            if (requestOptions && requestOptions.headers) {
                requestOptions.headers["Authorization"] = `Bearer ${apiKey}`;
            }
        }
    }
}

function removeNullValues(obj: any): any {
    if (obj === null || obj === undefined) {
        return undefined;
    }
    if (Array.isArray(obj)) {
        return obj.map(removeNullValues).filter(x => x !== undefined);
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleaned = removeNullValues(value);
            if (cleaned !== undefined) {
                result[key] = cleaned;
            }
        }
        return Object.keys(result).length ? result : undefined;
    }
    return obj;
}

interface ApiError {
    statusCode?: number;
    body?: {
        message?: string;
    }
}

/**
 * This action creates a backup of an environment in Quant Cloud.
 * 
 * @returns The ID of the created backup.
 */
async function run(): Promise<void> {    
    try {
        const apiKey = core.getInput('api_key', { required: true });
        const appName = core.getInput('app_name', { required: true });
        const organisation = core.getInput('organization', { required: true });
        const environmentName = core.getInput('environment_name', { required: true });

        const baseUrl = core.getInput('base_url') || 'https://dashboard.quantcdn.io/api/v3';

        const operation = core.getInput('operation', { required: false }) || 'create';
        const backupName = core.getInput('backup_name', { required: false });
        const backupId = core.getInput('backup_id', { required: false });
        const olderThanDays = core.getInput('older_than_days', { required: false });
        const sortOrder = core.getInput('sort_order', { required: false }) || 'desc';
        const filterStatus = core.getInput('filter_status', { required: false });
        const type = core.getInput('type', { required: false }) || 'database';

        const environmentsClient = new EnvironmentsApi(baseUrl);
        environmentsClient.setDefaultAuthentication(apiOpts(apiKey));

        const backupClient = new BackupManagementApi(baseUrl);
        backupClient.setDefaultAuthentication(apiOpts(apiKey));

        core.info('Quant Cloud Environment Backup Action');

        if (type !== 'database' && type !== 'filesystem') {
            throw new Error(`Invalid type: ${type}`);
        }

        if (!['create', 'list', 'download', 'delete'].includes(operation)) {
            throw new Error(`Invalid operation: ${operation}. Must be one of: create, list, download, delete`);
        }

        if (operation === 'download' && !backupId) {
            throw new Error('backup_id is required for download operation');
        }

        if (operation === 'delete' && !backupId && !olderThanDays) {
            throw new Error('Either backup_id or older_than_days is required for delete operation');
        }

        // For list operations, we might not need to validate the environment exists
        // But for create and download, we should validate
        if (operation !== 'list') {
        let environment: Environment;
        try {
                environment = (await environmentsClient.getEnvironment(organisation, appName, environmentName)).body;
            core.info(`Environment ${environmentName} exists`);
        } catch (error) {
            throw new Error(`Environment ${environmentName} does not exist`);
        }
        }

        let result: any = {};

        switch (operation) {
            case 'create':
                core.info(`Creating ${type} backup for environment ${environmentName}`);

                const request: CreateBackupRequest = {
                    description: backupName || `backup-${environmentName}-${Date.now()}`,
                }

                const backup = await backupClient.createBackup(organisation, appName, environmentName, type as 'database' | 'filesystem', request);
                result.backup = backup.body;
                
                core.info(`Created ${type} backup for environment ${environmentName}`);
                core.info(`Backup ID: ${backup.body.backupId}`);
                break;

            case 'list':
                core.info(`Listing backups for environment ${environmentName || 'all environments'}`);
                if (sortOrder) core.info(`Sort order: ${sortOrder}`);
                if (filterStatus) core.info(`Filtering by status: ${filterStatus}`);

                const listResponse = await backupClient.listBackups(
                    organisation, 
                    appName, 
                    environmentName, 
                    type as 'database' | 'filesystem',
                    sortOrder as 'asc' | 'desc' | undefined,
                    undefined, // limit
                    undefined, // createdBefore
                    undefined, // createdAfter
                    filterStatus as 'completed' | 'failed' | 'running' | undefined
                );
                result.backups = listResponse.body.backups || [];
                
                core.info(`Found ${result.backups.length} backups`);
                result.backups.forEach((backup: any, index: number) => {
                    core.info(`  ${index + 1}. ID: ${backup.backupId}, Description: ${backup.description || 'N/A'}, Status: ${backup.status}, Created: ${backup.createdAt}`);
                });
                break;

            case 'download':
                let actualBackupId = backupId;
                result = {}; // Initialize result object
                
                // Handle "latest" special case
                if (backupId === 'latest') {
                    core.info(`Resolving 'latest' backup for environment ${environmentName}`);
                    
                    const backupListResponse = await backupClient.listBackups(
                        organisation, 
                        appName, 
                        environmentName, 
                        type as 'database' | 'filesystem',
                        'desc' // Get newest first
                    );
                    const backups = backupListResponse.body.backups || [];
                    
                    if (backups.length === 0) {
                        throw new Error(`No backups found for environment ${environmentName}`);
                    }
                    
                    // First backup is the latest (sorted desc by default)
                    const latestBackup = backups[0];
                    actualBackupId = latestBackup.backupId!;
                    
                    core.info(`Latest backup resolved: ${latestBackup.description || 'N/A'} (ID: ${actualBackupId}, Created: ${latestBackup.createdAt})`);
                    result = {
                        resolvedBackupId: actualBackupId,
                        resolvedBackupName: latestBackup.description,
                        resolvedBackupCreatedAt: latestBackup.createdAt
                    };
                }

                core.info(`Downloading backup ${actualBackupId} from environment ${environmentName}`);

                // Get download URL
                const downloadResponse = await backupClient.downloadBackup(
                    organisation, 
                    appName, 
                    environmentName, 
                    type as 'database' | 'filesystem',
                    actualBackupId
                );
                const downloadUrl = downloadResponse.body.downloadUrl;
                result = { ...result, downloadUrl };
                core.info(`Download URL obtained: ${downloadUrl}`);
                if (downloadResponse.body.expiresAt) {
                    core.info(`URL expires at: ${downloadResponse.body.expiresAt}`);
                }
                break;

            case 'delete':
                const deletedBackups: string[] = [];
                
                if (backupId) {
                    // Delete specific backup by ID
                    core.info(`Deleting backup ${backupId} from environment ${environmentName}`);
                    
                    const deleteResponse = await backupClient.deleteBackup(
                        organisation, 
                        appName, 
                        environmentName, 
                        type as 'database' | 'filesystem',
                        backupId
                    );
                    deletedBackups.push(backupId);
                    
                    core.info(`Backup ${backupId} deleted successfully`);
                } else if (olderThanDays) {
                    // Delete backups older than specified days
                    const daysNum = parseInt(olderThanDays);
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - daysNum);
                    
                    core.info(`Deleting backups older than ${daysNum} days (before ${cutoffDate.toISOString()})`);
                    
                    // List all backups to find old ones
                    const allBackupsResponse = await backupClient.listBackups(
                        organisation, 
                        appName, 
                        environmentName, 
                        type as 'database' | 'filesystem'
                    );
                    const allBackups = allBackupsResponse.body.backups || [];
                    
                    // Filter backups older than cutoff date
                    const oldBackups = allBackups.filter((backup: any) => {
                        const backupDate = new Date(backup.createdAt);
                        return backupDate < cutoffDate;
                    });
                    
                    core.info(`Found ${oldBackups.length} backups older than ${daysNum} days`);
                    
                    // Delete each old backup
                    for (const backup of oldBackups) {
                        try {
                            core.info(`Deleting backup: ${backup.description || 'N/A'} (${backup.backupId}) created at ${backup.createdAt}`);
                            await backupClient.deleteBackup(
                                organisation, 
                                appName, 
                                environmentName, 
                                type as 'database' | 'filesystem',
                                backup.backupId!
                            );
                            deletedBackups.push(backup.backupId!);
                            core.info(`✓ Deleted backup ${backup.backupId}`);
                        } catch (error) {
                            core.warning(`Failed to delete backup ${backup.backupId}: ${error}`);
                        }
                    }
                }
                
                result.deletedBackups = deletedBackups;
                result.deletedCount = deletedBackups.length;
                
                core.info(`Deleted ${deletedBackups.length} backup(s)`);
                break;

            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }

        // Wait for backup completion if requested
        if (operation === 'create' && core.getInput('wait') === 'true') {
            core.info(`Waiting for backup to complete...`);
            let loop = true;
            let retries = 0;
            const waitInterval = parseInt(core.getInput('wait_interval') || '10');
            const maxRetries = parseInt(core.getInput('max_retries') || '30');
            const backupIdToCheck = result.backup.backupId;
            
            while (loop) {
                try {
                    // Check backup status by listing backups and finding ours
                    const backupsResponse = await backupClient.listBackups(
                        organisation, 
                        appName, 
                        environmentName, 
                        type as 'database' | 'filesystem'
                    );
                    const backups = backupsResponse.body.backups || [];
                    const currentBackup = backups.find((b: any) => b.backupId === backupIdToCheck);
                    
                    if (!currentBackup) {
                        core.warning(`Backup ${backupIdToCheck} not found in list. It may still be initializing...`);
                    } else {
                        core.info(`Backup status: ${currentBackup.status}`);
                        
                        switch (currentBackup.status) {
                            case 'completed':
                                core.info(`✓ Backup completed successfully`);
                                result.backup = currentBackup; // Update with latest status
                                loop = false;
                                break;
                            case 'failed':
                                throw new Error(`Backup failed`);
                            case 'running':
                            case 'in_progress':
                            default:
                                core.info(`Backup still in progress...`);
                                break;
                        }
                    }
                } catch (error) {
                    core.warning(`Failed to check backup status: ${error}. Retrying...`);
                }
                
                retries++;
                if (retries > maxRetries) {
                    throw new Error(`Backup timed out after ${retries} retries (waited ${retries * waitInterval} seconds)`);
                }
                
                if (loop) {
                    core.info(`Waiting ${waitInterval} seconds before next check...`);
                    await new Promise(resolve => setTimeout(resolve, waitInterval * 1000));
                }
            }
        }

        // Set outputs based on operation type
        core.setOutput('success', true);
        
        switch (operation) {
            case 'create':
                core.setOutput('backup_id', result.backup.backupId);
                break;
            case 'list':
                core.setOutput('backup_list', JSON.stringify(result.backups));
                break;
            case 'download':
                core.setOutput('download_url', result.downloadUrl);
                if (result.resolvedBackupId) {
                    core.setOutput('resolved_backup_id', result.resolvedBackupId);
                    core.setOutput('resolved_backup_name', result.resolvedBackupName);
                    core.setOutput('resolved_backup_created_at', result.resolvedBackupCreatedAt);
                }
                break;
            case 'delete':
                core.setOutput('deleted_count', result.deletedCount);
                core.setOutput('deleted_backups', JSON.stringify(result.deletedBackups));
                break;
        }

    } catch (error) {
        const apiError = error as Error & ApiError;
        core.setFailed(apiError.body?.message != null ? apiError.body?.message : error instanceof Error ? error.message : 'Unknown error');
    }

    return;
}

run(); 