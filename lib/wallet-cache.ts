/**
 * @notice Wallet caching utility for MetaKeep SDK
 * @dev Provides persistent storage for wallet address across page reloads
 *      to avoid re-authentication prompts
 */

const WALLET_CACHE_KEY = "metakeep_wallet_address";
const WALLET_CACHE_TIMESTAMP_KEY = "metakeep_wallet_timestamp";
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * @notice Cached wallet data structure
 */
export interface CachedWallet {
  address: string;
  timestamp: number;
}

/**
 * @notice Retrieves cached wallet address from localStorage
 * @return Cached wallet address or null if not found/expired
 */
export function getCachedWallet(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const cachedAddress = localStorage.getItem(WALLET_CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(WALLET_CACHE_TIMESTAMP_KEY);

    if (!cachedAddress || !cachedTimestamp) {
      return null;
    }

    const timestamp = parseInt(cachedTimestamp, 10);
    const now = Date.now();

    // Check if cache has expired
    if (now - timestamp > CACHE_DURATION_MS) {
      clearCachedWallet();
      return null;
    }

    return cachedAddress;
  } catch (error) {
    console.warn("Failed to read cached wallet:", error);
    return null;
  }
}

/**
 * @notice Stores wallet address in localStorage with timestamp
 * @param address Solana wallet address to cache
 */
export function setCachedWallet(address: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(WALLET_CACHE_KEY, address);
    localStorage.setItem(WALLET_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn("Failed to cache wallet:", error);
  }
}

/**
 * @notice Clears cached wallet data from localStorage
 */
export function clearCachedWallet(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(WALLET_CACHE_KEY);
    localStorage.removeItem(WALLET_CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn("Failed to clear cached wallet:", error);
  }
}

/**
 * @notice Checks if a wallet address is currently cached
 * @return true if wallet is cached and valid, false otherwise
 */
export function hasCachedWallet(): boolean {
  return getCachedWallet() !== null;
}

/**
 * @notice Validates and returns cached wallet, clearing if invalid
 * @return Cached wallet address or null if invalid/expired
 * @dev This is a convenience function that combines get and validation
 */
export function getValidatedCachedWallet(): string | null {
  const cached = getCachedWallet();
  if (!cached) return null;

  // Basic validation: check if it looks like a valid Solana address
  // Solana addresses are base58 encoded and typically 32-44 characters
  if (cached.length < 32 || cached.length > 44) {
    clearCachedWallet();
    return null;
  }

  return cached;
}
