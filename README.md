# Welcome to your Lovable project

## Environment setup

Create a `.env` file with:

```bash
VITE_SUPABASE_URL="https://regfsxygxenssjgwpcql.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-supabase-anon-or-publishable-key>"
VITE_R2_PUBLIC_BASE_URL="https://pub-07f5f109ad37482eaa9f955ebdebb0ae.r2.dev"
VITE_R2_UPLOAD_ENDPOINT="https://your-backend-or-worker/upload"
```

## Notes

- Supabase is used for database access from the frontend.
- Cloudflare R2 is used for image hosting.
- `VITE_R2_UPLOAD_ENDPOINT` must be a secure backend/worker endpoint that uploads to R2.
- Never expose Supabase service-role keys or R2 secret keys in frontend `VITE_` variables.
