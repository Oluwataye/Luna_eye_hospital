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
1.  Run `npm run dev` in the root.
2.  This starts a Vite development server with **Hot Module Replacement (HMR)**.
3.  Any changes saved to `src/` will reflect in the browser instantly.
4.  Only run `npm run build` when you are ready to deploy the stable version for clinical use.

---
*Last Updated: 07/05/2026*
