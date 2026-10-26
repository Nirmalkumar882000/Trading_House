<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Business modules use config in modules.ts and workflow-config.ts with one generic CRUD page; aggregate demand and stock views are selected within the existing module route to keep navigation config-driven.
- workflow.ts is the browser-safe source of quantity normalization, references, grading, stock movements, and validation; stock is derived from transactions to prevent duplicate deductions.
- Keep a separate in-memory transaction audit with before/after snapshots so edits and deletions remain traceable until demo reset.
- Operational records and vendor notes remain an in-memory client demo; Cloud is used only for server-side AI Gateway sourcing calls, not operational persistence.
- AI sourcing uses the Responses SDK with request-local run IDs, schema-validated recommendations, no automatic retries, and no automatic purchase creation.
