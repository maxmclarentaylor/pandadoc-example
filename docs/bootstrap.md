# Terraform bootstrap (Step 2)

## Why this exists
Terraform needs a remote place to store state before it can safely manage
`segment-practice-dev-rg` and the rest of the app. That storage is created
once with Azure CLI (chicken-and-egg), then all product infra is Terraform.

## Part A — Create state backend (run in your terminal)

```bash
# Confirm you're on the right subscription
az account show -o table

LOCATION="uksouth"
RG="segment-practice-tfstate-rg"
STORAGE="segpracttfstate$(openssl rand -hex 3)"
CONTAINER="tfstate"

az group create --name "$RG" --location "$LOCATION" -o table

az storage account create \
  --name "$STORAGE" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --encryption-services blob \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  -o table

az storage container create \
  --name "$CONTAINER" \
  --account-name "$STORAGE" \
  --auth-mode login \
  -o table

echo "storage_account_name=$STORAGE"
```

Copy the printed `storage_account_name`.

## Part B — Point Terraform at that backend

```bash
cd /Users/maxtaylor/Documents/segment-practice/infra
cp backend.hcl.example backend.hcl
# Edit backend.hcl: set storage_account_name to the value from Part A

terraform init -backend-config=backend.hcl
```

`backend.hcl` is gitignored via not committing secrets/env-specific names if you prefer — for this personal project you may commit `backend.hcl` with only the storage account name (no keys when using Azure AD auth). Prefer committing only `backend.hcl.example` and keeping `backend.hcl` local.

## Part C — Identity (local vs pipelines)

| Who runs Terraform | Auth |
|--------------------|------|
| You (laptop) | Already done: `az login` |
| Azure Pipelines (later) | Service connection in Azure DevOps → GitHub pipeline uses it |

Local identity is enough to finish bootstrap and the next Terraform apply.
Pipeline identity comes when we wire Azure DevOps → GitHub.

## Done when
- [ ] Portal shows `segment-practice-tfstate-rg` with a storage account + `tfstate` container
- [ ] `terraform init -backend-config=backend.hcl` succeeds in `infra/`
- [ ] You are still **not** creating app resources by hand in the portal
