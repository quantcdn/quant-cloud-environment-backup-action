const mockCore = {
    getInput: jest.fn(),
    setOutput: jest.fn(),
    setFailed: jest.fn(),
    setSecret: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn()
};
const mockEnv = { getEnvironment: jest.fn() };
const mockBackup = { downloadBackup: jest.fn() };

jest.mock('@actions/core', () => mockCore);
jest.mock('@quantcdn/quant-client', () => ({
    Configuration: jest.fn(),
    EnvironmentsApi: jest.fn(() => mockEnv),
    BackupManagementApi: jest.fn(() => mockBackup),
    CreateBackupTypeEnum: {},
    DeleteBackupTypeEnum: {},
    DownloadBackupTypeEnum: { Database: 'database', Filesystem: 'filesystem' },
    ListBackupsTypeEnum: { Database: 'database', Filesystem: 'filesystem' },
    ListBackupsOrderEnum: { Desc: 'desc' },
    ListBackupsStatusEnum: {}
}));

const flush = () => new Promise(resolve => setTimeout(resolve, 10));
const URL_SECRET = 'https://s3.example.com/backup.sql.gz?X-Amz-Signature=abc123';

describe('download operation', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        mockEnv.getEnvironment.mockResolvedValue({ data: {} });
        mockBackup.downloadBackup.mockResolvedValue({ data: { downloadUrl: URL_SECRET, expiresAt: 'later' } });
        const inputs: Record<string, string> = {
            api_key: 'k', organization: 'org', app_name: 'app', environment_name: 'env',
            operation: 'download', backup_id: 'b1'
        };
        mockCore.getInput.mockImplementation((name: string) => inputs[name] ?? '');
        jest.isolateModules(() => {
            require('./index');
        });
        await flush();
    });

    it('registers the signed URL as a secret', () => {
        expect(mockCore.setSecret).toHaveBeenCalledWith(URL_SECRET);
    });

    it('masks the URL before any log or output call', () => {
        const secretOrder = mockCore.setSecret.mock.invocationCallOrder[0];
        const later = [mockCore.info, mockCore.warning, mockCore.setOutput, mockCore.debug]
            .flatMap(fn => fn.mock.invocationCallOrder);
        // Every log or output call that runs after the URL is known must run after masking.
        const urlCalls = [mockCore.info, mockCore.warning, mockCore.setOutput, mockCore.debug]
            .flatMap(fn => fn.mock.calls.map((c, i) => ({ c, order: fn.mock.invocationCallOrder[i] })))
            .filter(x => String(x.c[0]).includes('X-Amz') || String(x.c[1]).includes('X-Amz'));
        expect(later.length).toBeGreaterThan(0);
        for (const call of urlCalls) {
            expect(call.order).toBeGreaterThan(secretOrder);
        }
    });

    it('does not log the URL, but still outputs it', () => {
        for (const fn of [mockCore.info, mockCore.warning, mockCore.error, mockCore.debug]) {
            expect(fn.mock.calls.flat().join('\n')).not.toContain('X-Amz-Signature');
        }
        expect(mockCore.setOutput).toHaveBeenCalledWith('download_url', URL_SECRET);
    });
});
