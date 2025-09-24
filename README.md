# Quant Cloud Environment Backup

Create, list, and download backups of environments in Quant Cloud. This action provides comprehensive backup management for disaster recovery and data protection, including CI/CD pipeline integration.

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

## Inputs

* `api_key`: Quant API key (required)
* `organization`: Quant organisation ID (required)
* `app_name`: Name of your application (required)
* `environment_name`: Name of the environment to backup (required)
* `operation`: Operation to perform - 'create', 'list', or 'download' (optional, default: 'create')
* `backup_name`: Name for the backup (optional, for create operation)
* `backup_id`: ID of the backup to download (required for download operation). Use `"latest"` to automatically download the most recent backup.
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
- **List existing backups**: Query available backups to make restore decisions
- **Download for restoration**: Download backups for environment restoration or data analysis
- **Latest backup downloads**: Use `backup_id: latest` to automatically download the most recent backup
- **Cleanup workflows**: List and manage old backups for storage optimization

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
```