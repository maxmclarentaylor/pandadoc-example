# CI/CD (GitHub Actions → Azure)

GitHub hosts the code; **GitHub Actions** deploys it. That is a good default when
the repo is already on GitHub. Azure DevOps Pipelines would also work; Actions
is simpler here (one less product to wire).

## What gets deployed where
| Code | Azure target |
|------|----------------|
| `apps/api` | Linux **App Service** (`segpractice-api-****`) |
| `apps/web` | **Static Web Apps** (`segpractice-web-****`) |
| `infra/` | Terraform apply (same subscription / state account) |

## One-time: Azure OIDC app for GitHub

```bash
# Values you already have
SUBSCRIPTION_ID="51987bf5-1000-4532-834d-eff941f16fa4"
TENANT_ID="c97ce120-adbc-4e5b-b458-5acbac0bc05f"
GITHUB_ORG="maxmclarentaylor"
GITHUB_REPO="segment-practice"

# Create app + SP
APP_NAME="segment-practice-github"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
az ad sp create --id "$APP_ID" >/dev/null
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

# Subscription contributor (narrow later if you want)
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# Also need data-plane on tfstate storage
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show -g segment-practice-tfstate-rg -n segpracttfstatee6d6b7 --query id -o tsv)"

# Federated credential for GitHub Actions on main + PRs
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-main\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-pr\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:pull_request\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID"
```

## GitHub secrets & variables

Put these on the GitHub Environment named **`dev`** (not only repo-level).
Workflows use `environment: dev` so they can read them.

Repo → **Settings → Environments → dev**

**Secrets**
- `AZURE_CLIENT_ID` — from command output above
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_STATIC_WEB_APPS_API_TOKEN` — `terraform output -raw web_api_token`

**Variables**
- `TF_STATE_RG` = `segment-practice-tfstate-rg`
- `TF_STATE_STORAGE` = `segpracttfstatee6d6b7`
- `AZURE_API_WEBAPP_NAME` = `segpractice-api-r5bq`
- `VITE_API_BASE` = `https://segpractice-api-r5bq.azurewebsites.net`

Also add an Entra federated credential for the environment subject GitHub actually issues
(include numeric owner/repo IDs), e.g.:

`repo:maxmclarentaylor@42745017/segment-practice@1354553004:environment:dev`

(not the older form `repo:maxmclarentaylor/segment-practice:environment:dev`).

## Live hosts (after Terraform apply)
- API: `https://segpractice-api-r5bq.azurewebsites.net`
- Web: `https://red-island-0d916eb03.5.azurestaticapps.net`

## GitHub Actions service principal (least privilege)
App: `segment-practice-github` (`AZURE_CLIENT_ID`).

Scoped roles (not subscription-wide Contributor):
- **Contributor** on `segment-practice-dev-rg`
- **User Access Administrator** on `segment-practice-dev-rg` (Terraform role assignments)
- **Storage Blob Data Contributor** on tfstate storage `segpracttfstatee6d6b7`

## Workflows
- `.github/workflows/terraform.yml` — plan on PR, apply on main
- `.github/workflows/deploy-api.yml` — zip-deploy API to App Service
- `.github/workflows/deploy-web.yml` — build React, upload to Static Web Apps

After secrets/vars are set, push to `main` or run **Actions → workflow_dispatch**.

## Note on App Service region
UK South App Service quota was `0` on this subscription, so the API plan/app were created in **West Europe** (Free F1). Static Web Apps is also West Europe. Postgres/Key Vault remain UK South.
