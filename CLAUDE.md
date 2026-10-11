# Notes for Claude Code

## Secrets

API keys live only in Netlify environment variables. Never write a key into any file, never create a .env file without confirming it's in .gitignore, and never use the PUBLIC_ prefix for secrets. Read keys only via process.env inside netlify/functions/.
