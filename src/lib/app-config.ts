/** Central app configuration so a remixed project is easy to rebrand. */

export const APP_NAME = "Event Rentals";

export const APP_DESCRIPTION =
  "Your Event Rentals workspace: BOM builder, gate pass, returns and stock consolidation.";

/**
 * The API base URL can be overridden via the Vite environment variable
 * VITE_API_BASE_URL. If not set, it falls back to the original demo backend.
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "https://projecthub.runasp.net";
