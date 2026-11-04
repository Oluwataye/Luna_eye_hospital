# Luna Eye Hospital - Developer Deployment Notes

## CRITICAL: Refreshing Changes
This application is served from a **Production Build** located in the `dist/` folder. Modifying source files in `src/` will **NOT** automatically update the live application.

### Mandatory Deployment Sequence
Every time you make a change to the frontend code:
1.  **Rebuild**: Run `npm run build` in the root directory.
2.  **Kill Stale Server**: Identify the process running on port 80 and terminate it.
3.  **Restart Server**: Run `node server/index.js` (or use `start-server.bat`).

### Verification
Check the bottom of the **Billing Page** for the **Build Timestamp**. 
- If the timestamp does not match your last build time, the browser is still serving a cached version.
- **Action**: Perform a Hard Refresh (**Ctrl + Shift + R**).

## Improved Development Workflow
To avoid manual builds during active development:
1.  Run `npm run dev:all` in the root (starts both Vite frontend and Express server concurrently).
2.  Any changes saved to `src/` reflect in the browser instantly via HMR.
3.  When deploying to the hospital workstations, execute:
    ```bash
    npm run release:standalone
    ```
    This automatically builds the production assets, compiles backend TypeScript, packages `packaged-release/VisionCare-EMR.exe`, and synchronizes runtime binaries.

## Full System Architecture & Module Reference
For in-depth architectural specifications, database schemas, 12-section clinical chart details, CDS drug contraindication rules, bilingual drop leaflets, and hardware protocols, refer to:
👉 [SYSTEM_DOCUMENTATION.md](file:///c:/Users/HP/Documents/Luna%20Eyes%20Hospital/SYSTEM_DOCUMENTATION.md)

---
*Last Updated: 18/10/2026*
