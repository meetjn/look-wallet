/// @notice Type definitions for the Look Wallet application

/**
 * @notice Represents the state of an async action
 */
export type ActionState = 'idle' | 'loading' | 'success' | 'error';

/**
 * @notice Fiat exchange rates for cryptocurrencies
 */
export type FiatRates = {
  usdc: number;
  sol: number;
};

/**
 * @notice User's wallet balance snapshot
 */
export type BalanceSnapshot = {
  usdc: number;
  sol: number;
  usd: number;
};

/**
 * @notice MetaKeep SDK global interface
 */
declare global {
  interface Window {
    MetaKeep?: any;
    BarcodeDetector?: any;
  }
}

/**
 * @notice MetaKeep wallet response structure
 */
export interface MetaKeepWalletResponse {
  status: string;
  wallet?: {
    ethAddress?: string;
    solAddress?: string;
    eosAddress?: string;
  };
}

/**
 * @notice MetaKeep sign transaction response
 */
export interface MetaKeepSignResponse {
  status: string;
  signature?: string;
}


