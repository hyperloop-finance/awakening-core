# Awakening development and deployment

- Follow this sequence for every application change: local development → relevant tests and build → commit → push to GitHub → deploy the exact pushed commit → verify the public application.
- Verify and record the remote Git commit SHA used for each cloud release.
- Never patch application source in an existing cloud build directory or deploy uncommitted files, including UI-only demonstration changes.
- Use a clean, isolated checkout if the workspace contains unrelated modifications. Preserve those modifications and exclude them from the commit and deployment.
- If cloud code differs from GitHub, identify and reconcile the intended changes locally, then commit and push before replacing the cloud release.
- A direct cloud hotfix requires an explicit user exception and must be reconciled back to GitHub before reporting completion, or clearly reported as still unsynchronised.
- Keep deployment scripts and non-secret configuration reproducible; supply credentials outside Git.
- A branch-merge request does not authorise uploading unrelated uncommitted work or deploying the site.
- A deployment request includes the necessary commit and GitHub push for that change; proceed within the authorised scope without redundant confirmation.
- Follow any additional directory-specific AGENTS.md instructions, including the contract review guidance in contracts/AGENTS.md.
