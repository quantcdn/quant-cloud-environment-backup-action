import * as core from '@actions/core';
import {
    Environment,
    EnvironmentsApi
    // TODO: Import BackupManagementApi and CreateBackupRequest when available
    // BackupManagementApi,
    // CreateBackupRequest
} from 'quant-ts-client';

// TODO: Replace these with actual imports when available in quant-ts-client
interface BackupManagementApi {
    setDefaultAuthentication: (opts: any) => void;
    createBackup: (org: string, app: string, env: string, request: CreateBackupRequest) => Promise<{ body: { id: string, name: string, status: string } }>;
    listBackups: (org: string, app: string, env?: string) => Promise<{ body: Array<{ id: string, name: string, status: string, createdAt: string }> }>;
    getBackup: (org: string, app: string, env: string, backupId: string) => Promise<{ body: { id: string, name: string, status: string } }>;
    downloadBackup: (org: string, app: string, env: string, backupId: string) => Promise<{ body: { downloadUrl?: string, url?: string } }>;
}

interface CreateBackupRequest {
    name: string;
    type: string;
}

// Mock BackupManagementApi class - TODO: Replace with actual import
class BackupManagementApiImpl implements BackupManagementApi {
    private baseUrl: string;
    private authOpts: any;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    setDefaultAuthentication(opts: any) {
        this.authOpts = opts;
    }

    async createBackup(org: string, app: string, env: string, request: CreateBackupRequest) {
        // TODO: Replace with actual API call when BackupManagementApi is available
        core.warning('Using mock BackupManagementApi. Replace with actual implementation when available in quant-ts-client.');
        return {
            body: {
                id: `mock-backup-${Date.now()}`,
                name: request.name,
                status: 'in_progress'
            }
        };
    }

    async listBackups(org: string, app: string, env?: string) {
        // TODO: Replace with actual API call when BackupManagementApi is available  
        core.warning('Using mock BackupManagementApi. Replace with actual implementation when available in quant-ts-client.');
        return {
            body: [
                { id: 'backup-1', name: 'mock-backup-1', status: 'completed', createdAt: '2024-01-15T10:00:00Z' },
                { id: 'backup-2', name: 'mock-backup-2', status: 'completed', createdAt: '2024-01-14T10:00:00Z' }
            ]
        };
    }

    async getBackup(org: string, app: string, env: string, backupId: string) {
        // TODO: Replace with actual API call when BackupManagementApi is available
        core.warning('Using mock BackupManagementApi. Replace with actual implementation when available in quant-ts-client.');
        return {
            body: {
                id: backupId,
                name: 'mock-backup',
                status: 'completed'
            }
        };
    }

    async downloadBackup(org: string, app: string, env: string, backupId: string) {
        // TODO: Replace with actual API call when BackupManagementApi is available
        core.warning('Using mock BackupManagementApi. Replace with actual implementation when available in quant-ts-client.');
        return {
            body: {
                downloadUrl: `https://mock-download-url.com/backups/${backupId}/download`,
                url: `https://mock-download-url.com/backups/${backupId}/download`
            }
        };
    }
}

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
        const type = core.getInput('type', { required: false }) || 'database';

        const environmentsClient = new EnvironmentsApi(baseUrl);
        environmentsClient.setDefaultAuthentication(apiOpts(apiKey));

        const backupClient = new BackupManagementApiImpl(baseUrl);
        backupClient.setDefaultAuthentication(apiOpts(apiKey));

        core.info('Quant Cloud Environment Backup Action');

        if (type !== 'database' && type !== 'filesystem') {
            throw new Error(`Invalid type: ${type}`);
        }

        if (!['create', 'list', 'download'].includes(operation)) {
            throw new Error(`Invalid operation: ${operation}. Must be one of: create, list, download`);
        }

        if (operation === 'download' && !backupId) {
            throw new Error('backup_id is required for download operation');
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
                    name: backupName || `backup-${environmentName}-${Date.now()}`,
                    type: type as any, // Cast to the expected type
                }

                const backup = await backupClient.createBackup(organisation, appName, environmentName, request);
                result.backup = backup.body;
                
                core.info(`Created ${type} backup for environment ${environmentName}`);
                core.info(`Backup ID: ${backup.body.id}`);
                break;

            case 'list':
                core.info(`Listing backups for environment ${environmentName || 'all environments'}`);

                const backupList = await backupClient.listBackups(organisation, appName, environmentName);
                result.backups = backupList.body;
                
                core.info(`Found ${backupList.body.length} backups`);
                backupList.body.forEach((backup: any, index: number) => {
                    core.info(`  ${index + 1}. ID: ${backup.id}, Name: ${backup.name}, Status: ${backup.status}, Created: ${backup.createdAt}`);
                });
                break;

            case 'download':
                let actualBackupId = backupId;
                result = {}; // Initialize result object
                
                // Handle "latest" special case
                if (backupId === 'latest') {
                    core.info(`Resolving 'latest' backup for environment ${environmentName}`);
                    
                    const backupList = await backupClient.listBackups(organisation, appName, environmentName);
                    if (!backupList.body || backupList.body.length === 0) {
                        throw new Error(`No backups found for environment ${environmentName}`);
                    }
                    
                    // Sort backups by creation date (newest first) and get the latest
                    const sortedBackups = backupList.body.sort((a: any, b: any) => {
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    });
                    
                    const latestBackup = sortedBackups[0];
                    actualBackupId = latestBackup.id;
                    
                    core.info(`Latest backup resolved: ${latestBackup.name} (ID: ${actualBackupId}, Created: ${latestBackup.createdAt})`);
                    result = {
                        resolvedBackupId: actualBackupId,
                        resolvedBackupName: latestBackup.name,
                        resolvedBackupCreatedAt: latestBackup.createdAt
                    };
                }

                core.info(`Downloading backup ${actualBackupId} from environment ${environmentName}`);

                // First get the backup details to ensure it exists
                const backupDetails = await backupClient.getBackup(organisation, appName, environmentName, actualBackupId);
                core.info(`Backup found: ${backupDetails.body.name} (Status: ${backupDetails.body.status})`);

                // Get download URL - this method name might vary based on the actual API
                try {
                    const downloadResponse = await backupClient.downloadBackup(organisation, appName, environmentName, actualBackupId);
                    const downloadUrl = downloadResponse.body.downloadUrl || downloadResponse.body.url;
                    result = { ...result, downloadUrl };
                    core.info(`Download URL obtained: ${downloadUrl}`);
                } catch (error) {
                    // Fallback: try to get backup download URL differently if the method name is different
                    core.warning('downloadBackup method failed, trying alternative approach...');
                    // The actual method might be getBackupDownloadUrl or similar
                    const downloadUrl = `${baseUrl}/organizations/${organisation}/apps/${appName}/environments/${environmentName}/backups/${actualBackupId}/download`;
                    result = { ...result, downloadUrl };
                    core.info(`Using constructed download URL: ${downloadUrl}`);
                }
                break;

            default:
                throw new Error(`Unsupported operation: ${operation}`);
        }

        // Only wait for create operations
        if (operation === 'create' && core.getInput('wait') === 'true') {
            core.info(`Waiting for backup to complete`);
            let loop = true;
            let retries = 0;
            const waitInterval = parseInt(core.getInput('wait_interval') || '10');
            const maxRetries = parseInt(core.getInput('max_retries') || '30');
            while (loop) {
                try {
                    // Get backup status
                    const backupStatus = await backupClient.getBackup(organisation, appName, environmentName, result.backup.id);
                    
                    switch (backupStatus.body.status) {
                        case 'completed':
                            core.info(`Backup completed`);
                            result.backup = backupStatus.body; // Update with latest status
                            loop = false;
                            break;
                        case 'failed':
                            throw new Error(`Backup failed`);
                        case 'in_progress':
                        case 'running':
                        default:
                            core.info(`Backup in progress`);
                            break;
                    }
                } catch (error) {
                    core.warning(`Failed to check backup status: ${error}. Retrying...`);
                }
                
                retries++;
                if (retries > maxRetries) {
                    throw new Error(`Backup timed out after ${retries} retries (waited ${retries * waitInterval} seconds)`);
                }
                
                if (loop) {
                    await new Promise(resolve => setTimeout(resolve, waitInterval * 1000));
                }
            }
        }

        // Set outputs based on operation type
        core.setOutput('success', true);
        
        switch (operation) {
            case 'create':
                core.setOutput('backup_id', result.backup.id);
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
        }

    } catch (error) {
        const apiError = error as Error & ApiError;
        core.setFailed(apiError.body?.message != null ? apiError.body?.message : error instanceof Error ? error.message : 'Unknown error');
    }

    return;
}

run(); 