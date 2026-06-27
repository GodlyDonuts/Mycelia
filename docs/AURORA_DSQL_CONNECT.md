# Aurora DSQL First Connection Runbook

This is the smallest AWS milestone: connect the existing Next.js app to one real
Aurora DSQL cluster. Do not build Lambda, SQS, Fargate, or S3 yet.

## 1. Create the Aurora DSQL cluster

1. Open the AWS Console.
2. Switch to the region you want for the demo, for example `us-east-1`.
3. Search for **Aurora DSQL**.
4. Choose **Create cluster**.
5. Use a clear name, for example `mycelia-dev`.
6. Choose the default/single-region starter settings.
7. Create the cluster.
8. Open the cluster details page and copy:
   - **Endpoint**, for example `abc123def456.dsql.us-east-1.on.aws`.
   - **Cluster identifier** or **Cluster ARN**.

Keep the endpoint for `DSQL_ENDPOINT`.

## 2. Create the IAM policy

1. Open **IAM** in the AWS Console.
2. Go to **Policies**.
3. Choose **Create policy**.
4. Choose **JSON**.
5. Paste this policy, replacing the placeholders:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MyceliaDsqlConnect",
      "Effect": "Allow",
      "Action": [
        "dsql:DbConnect",
        "dsql:DbConnectAdmin"
      ],
      "Resource": "arn:aws:dsql:AWS_REGION:AWS_ACCOUNT_ID:cluster/DSQL_CLUSTER_ID"
    }
  ]
}
```

Use the cluster ARN from the DSQL console if AWS shows a slightly different ARN
shape. The important part is to scope the policy to this one DSQL cluster, not
`*`, once the first connection is working.

6. Name it `MyceliaDsqlConnectDev`.
7. Create the policy.

For the initial bootstrap, `dsql:DbConnectAdmin` is used because the app and the
migration script default to `DSQL_USER=admin`. After you create a narrower DB
user/role, set `DSQL_USE_ADMIN_TOKEN=false` and remove `dsql:DbConnectAdmin`.

## 3. Give your local AWS identity access

Recommended local path:

1. Open **IAM Identity Center** or your normal AWS access-management flow.
2. Assign yourself a permission set that includes `MyceliaDsqlConnectDev`.
3. Configure local credentials with AWS CLI:

```bash
aws configure sso
aws sso login --profile mycelia-dev
```

4. Start the app commands with that profile available:

```bash
$env:AWS_PROFILE="mycelia-dev"
```

On macOS/Linux the equivalent is:

```bash
export AWS_PROFILE=mycelia-dev
```

The app does not read an AWS access key from `.env.local`; the AWS SDK default
credential chain resolves your SSO/profile credentials and signs short-lived DSQL
database tokens.

## 4. Download the Amazon RDS CA bundle

From the `frontend/` directory, create a local cert folder and download the CA
bundle:

```bash
mkdir certs
curl -o certs/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path certs
Invoke-WebRequest -Uri https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -OutFile certs/global-bundle.pem
```

Do not commit the downloaded CA bundle unless the team explicitly decides to pin
it in-repo. The env var points to the local file.

## 5. Configure the app

Create or update `frontend/.env.local`:

```env
MYCELIA_DB_BACKEND=dsql
DSQL_ENDPOINT=abc123def456.dsql.us-east-1.on.aws
AWS_REGION=us-east-1
DSQL_CA_BUNDLE=./certs/global-bundle.pem
DSQL_DATABASE=postgres
DSQL_USER=admin
DSQL_USE_ADMIN_TOKEN=true
```

Leave `MYCELIA_DB_BACKEND` unset when you want the default local PGlite database.

## 6. Install dependencies

From `frontend/`:

```bash
pnpm install
```

The DSQL path uses:

- `pg`
- `@aws-sdk/dsql-signer`
- `@types/pg`

## 7. Apply the schema once

From `frontend/`, with `AWS_PROFILE` set if needed:

```bash
pnpm db:dsql:migrate
```

This applies `frontend/lib/db/schema.sql` to Aurora DSQL. Unlike PGlite, DSQL is
not auto-migrated or auto-seeded on first request.

## 8. Run the app against DSQL

From `frontend/`:

```bash
pnpm dev
```

Open `http://localhost:3000`. The DB layer now uses Aurora DSQL only because
`MYCELIA_DB_BACKEND=dsql` is set.

## 9. Verify the connection

Run the static checks:

```bash
pnpm lint
pnpm build
pnpm test
```

With the dev server still running, run the live checks:

```bash
pnpm test:smoke
pnpm test:statemachine
pnpm test:fuzz
```

Finally check health:

```bash
curl http://localhost:3000/api/health
```

The important reconciliation fields are:

- `negativeBalances == 0`
- `overspentJobs == 0`

## 10. Vercel IAM later

For this first connection, local AWS profile auth is enough. Before deploying the
DSQL-backed app to Vercel, replace local-profile auth with Vercel OIDC to an AWS
IAM role that has the same DSQL policy. Keep the same app env vars in Vercel:

- `MYCELIA_DB_BACKEND=dsql`
- `DSQL_ENDPOINT`
- `AWS_REGION`
- `DSQL_CA_BUNDLE`
- `DSQL_DATABASE`
- `DSQL_USER`
- `DSQL_USE_ADMIN_TOKEN`

Do not put long-lived AWS access keys in Vercel env vars.
