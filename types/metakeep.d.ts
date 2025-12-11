/**
 * @notice Type definitions for MetaKeep SDK
 */

declare global {
  interface Window {
    MetaKeep?: {
      new (config: { appId: string }): MetaKeepSDK;
    };
    BarcodeDetector?: {
      new (config: { formats: string[] }): BarcodeDetector;
    };
  }
}

interface MetaKeepSDK {
  getWallet(): Promise<{
    status: string;
    wallet?: {
      ethAddress?: string;
      solAddress?: string;
      eosAddress?: string;
    };
  }>;

  signTransaction(
    transaction: any,
    reason: string
  ): Promise<{
    status: string;
    signature?: string;
  }>;
}

interface BarcodeDetector {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

export {};

