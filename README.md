# Quant Cloud Environment Backup

Create, list, and download backups of environments in Quant Cloud. This action provides comprehensive backup management for disaster recovery and data protection, including CI/CD pipeline integration.

**📚 [Local Testing Guide](./TESTING.md)** - Learn how to test this action locally before deploying

## Usage

### Create a Backup
```yaml
- uses: quantcdn/quant-cloud-environment-backup-action@v1
  with:
    api_key: ${{ secrets.QUANT_API_KEY }}
    organization: your-org-id
    app_name: my-app
    environment_name: my-environment
    operation: create  # Default operation
    backup_name: backup-2024-01-15  # Optional backup name
    type: database
    wait: true  # Wait for backup to complete
    wait_interval: 10  # Check every 10 seconds
    max_retries: 30  # Timeout after 30 retries (5 minutes)
```

### List Available Backups
```yaml
- uses: quantcdn/quant-cloud-environment-backup-action@v1
  with:
    api_key: ${{ secrets.QUANT_API_KEY }}
    organization: your-org-id
    app_name: my-app
    environment_name: my-environment
    operation: list
    sort_order: desc  # Optional: asc or desc (always sorts by creation date)
    filter_status: completed  # Optional: filter by status (completed, failed, running)
```

### Download a Specific Backup
```yaml
- uses: quantcdn/quant-cloud-environment-backup-action@v1
  with:
    api_key: ${{ secrets.QUANT_API_KEY }}
    organization: your-org-id
    app_name: my-app
    environment_name: my-environment
    operation: download
    backup_id: backup-12345  # Specific backup ID
```

### Download the Latest Backup
```yaml
- uses: quantcdn/quant-cloud-environment-backup-action@v1
  with:
    api_key: ${{ secrets.QUANT_API_KEY }}
    organization: your-org-id
    app_name: my-app
    environment_name: my-environment
    operation: download
    backup_id: latest  # Automatically selects the most recent backup
```

### Delete a Specific Backup
```yaml
- uses: quantcdn/quant-cloud-environment-backup-action@v1
  with:
    api_key: ${{ secrets.QUANT_API_KEY }}
    organization: your-org-id
    app_name: my-app
    environment_name: my-environment
    operation: delete
    backup_id: backup-12345  # Specific backup to delete
```

### Delete Old Backups (Cleanup)
```yaml
- uses: quantcdn/quant-cloud-environment-backup-action@v1
  with:
    api_key: ${{ secrets.QUANT_API_KEY }}
    organization: your-org-id
    app_name: my-app
    environment_name: my-environment
    operation: delete
    older_than_days: 30  # Delete backups older than 30 days
```

## Inputs

* `api_key`: Quant API key (required)
* `organization`: Quant organisation ID (required)
* `app_name`: Name of your application (required)
* `environment_name`: Name of the environment to backup (required)
* `operation`: Operation to perform - 'create', 'list', 'download', or 'delete' (optional, default: 'create')
* `backup_name`: Name for the backup (optional, for create operation)
* `backup_id`: ID of the backup to download/delete. Use `"latest"` for most recent (download), or specify backup ID (download/delete). (optional)
* `older_than_days`: For delete operation: Delete backups older than this many days (optional)
* `sort_order`: For list operation: Sort order by creation date (`asc` or `desc`) (optional, default: 'desc')
* `filter_status`: For list operation: Filter by backup status (`completed`, `failed`, `running`) (optional)
* `type`: Type of data to backup - 'database' or 'filesystem' (optional, default: 'database')
* `wait`: Whether to wait for the backup to complete (optional, default: 'false', only applies to create operation)
* `wait_interval`: Interval in seconds between status checks (optional, default: '10')
* `max_retries`: Maximum number of retries before timing out (optional, default: '30')
* `base_url`: Quant Cloud API URL (optional, default: 'https://dashboard.quantcdn.io/api/v3')

## Outputs

* `success`: Whether the operation was successful (boolean)
* `backup_id`: ID of the created backup (create operation)
* `backup_list`: JSON array of available backups (list operation)
* `download_url`: Download URL for the backup (download operation)
* `resolved_backup_id`: Actual backup ID when using "latest" (download operation)
* `resolved_backup_name`: Name of the resolved backup when using "latest" (download operation)
* `resolved_backup_created_at`: Creation timestamp of the resolved backup when using "latest" (download operation)
* `deleted_count`: Number of backups deleted (delete operation)
* `deleted_backups`: JSON array of deleted backup IDs (delete operation)

## Wait Functionality

When `wait` is set to `true`, the action will monitor the backup operation status and wait for completion:

- Checks backup status every `wait_interval` seconds
- Times out after `max_retries` attempts 
- Provides detailed logging of backup progress
- Handles API errors gracefully with retry logic
- Default timeout: 30 retries × 10 seconds = 5 minutes

The action will succeed when the backup completes successfully, or fail if the backup fails or times out.

## CI/CD Pipeline Integration

This action is designed to integrate seamlessly with your CI/CD workflows:

### Automated Backup Creation
- **Scheduled backups**: Use with cron triggers to create regular backups
- **Pre-deployment backups**: Create backups before deployments for rollback purposes
- **Branch-based backups**: Create backups when specific branches are updated

### Backup Management
- **List existing backups**: Query available backups with sorting and filtering
- **Advanced filtering**: Filter by status (completed/failed/running), sort by creation date (asc/desc)
- **Download for restoration**: Download backups for environment restoration or data analysis
- **Latest backup downloads**: Use `backup_id: latest` to automatically download the most recent backup
- **Automated cleanup**: Delete old backups based on age (e.g., older than 30 days)
- **Targeted deletion**: Delete specific backups by ID for storage optimization

### Example Workflow
```yaml
name: Environment Backup Management

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Create Backup
        uses: quantcdn/quant-cloud-environment-backup-action@v1
        with:
          api_key: ${{ secrets.QUANT_API_KEY }}
          organization: ${{ vars.QUANT_ORG }}
          app_name: ${{ vars.QUANT_APP }}
          environment_name: production
          operation: create
          backup_name: scheduled-backup-${{ github.run_number }}
          wait: true

      - name: List Backups
        id: list
        uses: quantcdn/quant-cloud-environment-backup-action@v1
        with:
          api_key: ${{ secrets.QUANT_API_KEY }}
          organization: ${{ vars.QUANT_ORG }}
          app_name: ${{ vars.QUANT_APP }}
          environment_name: production
          operation: list

      - name: Output Backup List
        run: echo "Available backups: ${{ steps.list.outputs.backup_list }}"

      - name: Download Latest Backup
        id: download
        uses: quantcdn/quant-cloud-environment-backup-action@v1
        with:
          api_key: ${{ secrets.QUANT_API_KEY }}
          organization: ${{ vars.QUANT_ORG }}
          app_name: ${{ vars.QUANT_APP }}
          environment_name: production
          operation: download
          backup_id: latest

      - name: Output Download Results
        run: |
          echo "Download URL: ${{ steps.download.outputs.download_url }}"
          echo "Downloaded backup: ${{ steps.download.outputs.resolved_backup_name }}"
          echo "Backup created: ${{ steps.download.outputs.resolved_backup_created_at }}"

      - name: Cleanup Old Backups
        id: cleanup
        uses: quantcdn/quant-cloud-environment-backup-action@v1
        with:
          api_key: ${{ secrets.QUANT_API_KEY }}
          organization: ${{ vars.QUANT_ORG }}
          app_name: ${{ vars.QUANT_APP }}
          environment_name: production
          operation: delete
          older_than_days: 30

      - name: Output Cleanup Results
        run: |
          echo "Deleted ${{ steps.cleanup.outputs.deleted_count }} old backups"
          echo "Deleted backup IDs: ${{ steps.cleanup.outputs.deleted_backups }}"
```