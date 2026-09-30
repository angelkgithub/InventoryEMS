/** Turns database/technical errors into messages a person can act on. */
const KNOWN: Record<string, string> = {
  STOCK_BELOW_ZERO: "Stock cannot be below zero.",
  NO_CHANGE: "That is already the current stock. Nothing was changed.",
  INVALID_INPUT: "Please check the numbers you entered and try again.",
  PRODUCT_NOT_FOUND: "That product could not be found. Please refresh the page.",
  NOT_AUTHORIZED: "Your session has expired. Please sign in again.",
};

export const GENERIC_ERROR = "Unable to update inventory. Please try again.";

export function friendlyError(message: string | undefined | null): string {
  if (!message) return GENERIC_ERROR;
  for (const [code, text] of Object.entries(KNOWN)) if (message.includes(code)) return text;
  return GENERIC_ERROR;
}
