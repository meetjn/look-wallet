"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Image from "next/image";
import { Buffer } from "buffer";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  USDC_DECIMALS,
  USDC_MINT_ADDRESS,
  LOOK_MINT_ADDRESS,
} from "@/lib/solana-utils";
import {
  getCachedWallet,
  setCachedWallet,
  clearCachedWallet,
} from "@/lib/wallet-cache";
import type { ActionState, FiatRates, BalanceSnapshot } from "@/types";
import QRCode from "qrcode";
import jsQR from "jsqr";

/// @notice Default configuration values from environment
const DEFAULT_APP_ID =
  process.env.NEXT_PUBLIC_METAKEEP_APP_ID ??
  "8bb569c5-adb9-454e-a529-07a8b1954ef0";
const DEV_WALLET =
  process.env.NEXT_PUBLIC_DEV_WALLET ??
  "76fk8Dgb8ENk55vZrTPDwgUKbDDxqvhRwogK8WgYiJAU";
const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SOL_MINT = "So11111111111111111111111111111111111111112";
// LOOK swap output mint (can be a separate meme coin), while
// USDC_MINT_ADDRESS continues to represent the underlying USDC asset
// used for balances and sends.
const LOOK_MINT = LOOK_MINT_ADDRESS.toBase58();

/**
 * @notice Formats numbers with specified decimal places
 */
const formatNumber = (value: number, decimals = 2) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * @notice Main wallet screen component
 * @dev Integrates MetaKeep, Solana, and Jupiter for complete wallet functionality
 */
export default function WalletScreen() {
  /// @notice MetaKeep SDK instance
  const [sdk, setSdk] = useState<unknown>(null);
  /// @notice Connected Solana wallet address
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  /// @notice Current wallet balances
  const [balances, setBalances] = useState<BalanceSnapshot>({
    usdc: 0,
    sol: 0,
    usd: 0,
  });
  /// @notice Fiat exchange rates
  const [fiatRates, setFiatRates] = useState<FiatRates>({
    usdc: 1,
    sol: 170,
  });
  /// @notice Action states for different operations
  const [buyState, setBuyState] = useState<ActionState>("idle");
  const [sendState, setSendState] = useState<ActionState>("idle");
  const [swapState, setSwapState] = useState<ActionState>("idle");
  /// @notice Send form data
  const [sendForm, setSendForm] = useState({ address: "", amount: "1.00" });
  /// @notice Status message for user feedback
  const [statusMessage, setStatusMessage] = useState<string>("");
  /// @notice Last transaction ID for Solscan link
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  /// @notice QR scanning state
  const [isScanning, setIsScanning] = useState(false);
  /// @notice Wallet connection state
  const [isConnecting, setIsConnecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanLoopRef = useRef<number | undefined>(undefined);
  /// @notice QR code data URL for receive
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  /// @notice Active modal view
  const [activeModal, setActiveModal] = useState<"send" | "receive" | null>(
    null
  );

  /// @notice Solana connection instance
  const connection = useMemo(() => new Connection(RPC_URL, "confirmed"), []);

  /// @notice Calculate total fiat value
  const totalFiat = useMemo(
    // For now, total USD value is defined as the USD value of USDC only,
    // so the big "Total Balance" number always matches the LOOK/USDC row.
    // If we later want to include SOL again, we can add
    // `+ balances.sol * fiatRates.sol` back here.
    () => balances.usdc * fiatRates.usdc,
    [balances, fiatRates]
  );

  /**
   * @notice Fetches current SOL exchange rate from CoinGecko
   */
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await response.json();
        const sol = data.solana?.usd ?? fiatRates.sol;
        setFiatRates({ usdc: 1, sol });
      } catch (error) {
        console.warn("Price fetch failed, using fallback", error);
      }
    };
    fetchRates();
  }, [fiatRates.sol]);

  /**
   * @notice Initializes MetaKeep SDK when available
   * @dev Following the exact MetaKeep SDK pattern to avoid mobile OTP popup issues
   * @dev SDK instance is cached to avoid re-initialization on every render
   */
  const initializeSdk = useCallback(() => {
    if (typeof window === "undefined" || sdk) return;
    if (!window.MetaKeep) {
      // MetaKeep script not yet available; will retry on next effect tick
      return;
    }
    // Initialize SDK exactly as per MetaKeep docs
    const instance = new window.MetaKeep({
      appId: DEFAULT_APP_ID,
    });
    setSdk(instance);
  }, [sdk]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.MetaKeep && !sdk) {
      initializeSdk();
    }
  }, [initializeSdk, sdk]);

  /**
   * @notice Ensures a MetaKeep wallet is connected
   * @dev Still used by send / swap flows, but Buy LOOK / Buy SOL just redirect now
   * @dev Uses cached wallet address to avoid re-authentication when possible
   */
  const ensureWallet = useCallback(async (): Promise<boolean> => {
    if (!sdk) {
      setStatusMessage(
        "MetaKeep is still initializing. Please try again in a moment."
      );
      return false;
    }
    if (walletAddress) {
      return true;
    }

    // Check for cached wallet first
    const cachedAddress = getCachedWallet();
    if (cachedAddress) {
      setWalletAddress(cachedAddress);
      await refreshBalances(cachedAddress);
      return true;
    }

    // No cached wallet, need to authenticate
    try {
      setIsConnecting(true);
      const result = await (sdk as any).getWallet();
      if (result.status === "SUCCESS" && result.wallet?.solAddress) {
        const address = result.wallet.solAddress;
        setWalletAddress(address);
        setCachedWallet(address); // Cache the wallet address
        await refreshBalances(address);
        setIsConnecting(false);
        return true;
      }
      setIsConnecting(false);
      setStatusMessage("Wallet connection failed. Please try again.");
      return false;
    } catch (error) {
      console.warn("MetaKeep getWallet failed", error);
      setIsConnecting(false);
      setStatusMessage("Wallet connection failed. Please retry.");
      return false;
    }
  }, [sdk, walletAddress]);

  /**
   * @notice Auto-connect MetaKeep wallet on landing page load
   * @dev Uses cached wallet address to avoid re-authentication on page reload
   * @dev Only calls getWallet() if no cached wallet is available
   */
  useEffect(() => {
    if (walletAddress) return;

    // Check for cached wallet first - no SDK needed for this
    const cachedAddress = getCachedWallet();
    if (cachedAddress) {
      setWalletAddress(cachedAddress);
      refreshBalances(cachedAddress).catch(console.error);
      return;
    }

    // No cached wallet, wait for SDK and authenticate
    if (!sdk) return;

    const connect = async () => {
      try {
        setIsConnecting(true);
        const result = await (sdk as any).getWallet();
        if (result.status === "SUCCESS" && result.wallet?.solAddress) {
          const address = result.wallet.solAddress;
          setWalletAddress(address);
          setCachedWallet(address); // Cache the wallet address
          await refreshBalances(address);
        }
      } catch (error) {
        console.warn("MetaKeep getWallet failed on landing", error);
        // If authentication fails, clear any stale cache
        clearCachedWallet();
      } finally {
        setIsConnecting(false);
      }
    };
    void connect();
  }, [sdk, walletAddress]);

  /**
   * @notice Generates QR code when wallet address changes
   */
  useEffect(() => {
    if (!walletAddress) return;
    QRCode.toDataURL(walletAddress, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then(setQrCodeUrl)
      .catch(console.error);
  }, [walletAddress]);

  /**
   * @notice Auto-dismiss status message after 10 seconds
   */
  useEffect(() => {
    if (!statusMessage) return;

    const timer = setTimeout(() => {
      setStatusMessage("");
      setLastTxId(null);
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [statusMessage]);

  /**
   * @notice Refreshes wallet balances for SOL and LOOK token
   * @dev Fetches LOOK meme coin balance from Solana devnet
   * @dev Specifically fetches:
   *   - SOL balance: Native SOL from Solana devnet (via getBalance)
   *   - LOOK balance: LOOK meme coin tokens from Associated Token Account (ATA)
   *     Mint address: 9223LqDuoJXyhCtvi54DUQPGS8Xf29kUEQRr7Sfhmoon (LOOK mint)
   *     RPC: https://api.devnet.solana.com
   *     Decimals: 6 (standard token decimals)
   */
  const refreshBalances = async (address: string) => {
    try {
      const owner = new PublicKey(address);

      /// @notice Fetch SOL balance from Solana devnet
      const lamports = await connection.getBalance(owner);
      const sol = lamports / LAMPORTS_PER_SOL;

      /// @notice Fetch LOOK meme coin balance from Associated Token Account
      /// @dev Uses LOOK mint: 9223LqDuoJXyhCtvi54DUQPGS8Xf29kUEQRr7Sfhmoon
      const usdcAta = await getAssociatedTokenAddress(USDC_MINT_ADDRESS, owner);
      const usdcInfo = await connection
        .getTokenAccountBalance(usdcAta)
        .catch(() => null);
      const usdc = usdcInfo?.value?.amount
        ? Number(usdcInfo.value.amount) / 10 ** USDC_DECIMALS
        : 0;

      setBalances({
        sol,
        usdc,
        // Keep USD aligned with the LOOK/USDC value (1 USDC ~= 1 USD).
        usd: usdc * fiatRates.usdc,
      });
    } catch (error) {
      console.error("Balance refresh failed", error);
    }
  };

  /**
   * @notice Ensures an Associated Token Account exists
   * @dev Creates ATA instruction if account doesn't exist
   */
  const ensureAta = async (
    owner: PublicKey,
    payer: PublicKey,
    mint: PublicKey
  ) => {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const info = await connection.getAccountInfo(ata);
    if (info) return { ata, ix: null };
    return {
      ata,
      ix: createAssociatedTokenAccountInstruction(payer, ata, owner, mint),
    };
  };

  /**
   * @notice Handles Buy $LOOK button - redirects to Circle faucet
   * @dev Previously delegated USDC, now redirects to public faucet
   */
  const handleBuyLook = async () => {
    // NOTE: LOOK token acquisition via delegation is temporarily disabled.
    // Redirecting to Circle's public faucet for testnet tokens.
    // For mainnet, this would connect to a DEX or token purchase flow.
    window.open("https://faucet.circle.com/", "_blank", "noopener,noreferrer");
  };

  /**
   * @notice Handles sending LOOK tokens to another wallet
   * @dev Uses MetaKeep to sign user's transaction, checks SOL balance for gas
   */
  const handleSendUSDC = async () => {
    if (!(await ensureWallet()) || !walletAddress || !sdk) return;

    /// @notice Check if user has enough SOL for gas fees (minimum 0.001 SOL recommended)
    const minSolForGas = 0.001;
    if (balances.sol < minSolForGas) {
      setSendState("error");
      setStatusMessage(
        "Insufficient SOL for gas fees. Get devnet SOL from the faucet."
      );
      setLastTxId("get-sol"); // Special marker for gas fee error
      return;
    }

    setSendState("loading");
    setLastTxId(null);
    setStatusMessage("Preparing MetaKeep signature…");
    try {
      const user = new PublicKey(walletAddress);
      const destination = new PublicKey(sendForm.address.trim());

      /// @notice Ensure ATAs exist for sender and recipient
      const { ata: fromAta, ix: fromIx } = await ensureAta(
        user,
        user,
        USDC_MINT_ADDRESS
      );
      const { ata: destAta, ix: destIx } = await ensureAta(
        destination,
        user,
        USDC_MINT_ADDRESS
      );

      const lamports = BigInt(
        Math.max(
          0,
          Math.floor(Number(parseFloat(sendForm.amount)) * 10 ** USDC_DECIMALS)
        )
      );

      /// @notice Build transfer transaction
      const tx = new Transaction();
      if (fromIx) tx.add(fromIx);
      if (destIx) tx.add(destIx);
      tx.add(
        createTransferCheckedInstruction(
          fromAta,
          USDC_MINT_ADDRESS,
          destAta,
          user,
          lamports,
          USDC_DECIMALS
        )
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.feePayer = user;
      tx.recentBlockhash = blockhash;

      /// @notice Sign with MetaKeep user wallet
      setStatusMessage("Signing transaction with MetaKeep…");
      const signed = await (sdk as any).signTransaction(
        tx,
        `Send ${sendForm.amount} LOOK`
      );
      if (signed.status !== "SUCCESS" || !signed.signature) {
        throw new Error("User signature failed");
      }

      /// @notice Parse signature (MetaKeep may return hex with or without 0x prefix)
      let signatureBytes: Buffer;
      const sigStr = String(signed.signature);
      if (sigStr.startsWith("0x")) {
        signatureBytes = Buffer.from(sigStr.slice(2), "hex");
      } else {
        signatureBytes = Buffer.from(sigStr, "hex");
      }

      tx.addSignature(user, signatureBytes);

      /// @notice Broadcast transaction to Solana devnet
      setStatusMessage("Broadcasting transaction to Solana devnet…");
      const serializedTx = tx.serialize();
      const txid = await connection.sendRawTransaction(serializedTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      setStatusMessage(`Transaction sent! Confirming… (${txid.slice(0, 8)}…)`);

      /// @notice Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        txid,
        "confirmed"
      );
      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
        );
      }

      setSendState("success");
      setLastTxId(txid);
      setStatusMessage(
        `Success! Transaction confirmed. Click to view on Solscan.`
      );
      setActiveModal(null);
      await refreshBalances(walletAddress);
    } catch (error) {
      console.error(error);
      setSendState("error");

      // Check if it's a gas-related error
      const errorMsg = String(error);
      if (errorMsg.includes("insufficient") || errorMsg.includes("lamports")) {
        setStatusMessage(
          "Insufficient SOL for gas fees. Get devnet SOL from the faucet."
        );
        setLastTxId("get-sol");
      } else {
        setStatusMessage("Send failed. Please retry.");
      }
    }
  };

  /**
   * @notice Executes a Jupiter swap
   * @param inputMint Input token mint address
   * @param outputMint Output token mint address
   * @param amount Amount in base units
   * @param reason Transaction reason for MetaKeep
   */
  const executeJupiterSwap = async (
    inputMint: string,
    outputMint: string,
    amount: bigint,
    reason: string
  ) => {
    if (!(await ensureWallet()) || !walletAddress || !sdk) return;
    setSwapState("loading");
    setStatusMessage("Requesting Jupiter route…");
    try {
      /// @notice Request protected order from Jupiter Ultra
      const orderRes = await fetch(
        `/api/jupiter/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount.toString()}&taker=${walletAddress}`
      );
      const orderJson = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(
          typeof orderJson.error === "string"
            ? orderJson.error
            : "Jupiter order request failed"
        );
      }

      const unsignedTxBase64: string | undefined =
        typeof orderJson.swapTransaction === "string"
          ? orderJson.swapTransaction
          : typeof orderJson.transaction === "string"
          ? orderJson.transaction
          : undefined;
      const requestId: string | undefined =
        typeof orderJson.requestId === "string"
          ? orderJson.requestId
          : undefined;

      if (!unsignedTxBase64 || !requestId) {
        throw new Error("Jupiter order did not return a transaction payload.");
      }

      /// @notice Deserialize and sign transaction via MetaKeep
      const tx = VersionedTransaction.deserialize(
        Buffer.from(unsignedTxBase64, "base64")
      );
      const signed = await (sdk as any).signTransaction(tx, reason);
      if (signed.status !== "SUCCESS" || !signed.signature) {
        throw new Error("User signature failed");
      }
      tx.addSignature(
        new PublicKey(walletAddress),
        Buffer.from(String(signed.signature).replace("0x", ""), "hex")
      );

      /// @notice Prepare base64-encoded signed transaction for Ultra execute
      const signedBase64 = Buffer.from(tx.serialize()).toString("base64");

      const executeRes = await fetch("/api/jupiter/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: signedBase64,
          requestId,
        }),
      });
      const executeJson = await executeRes.json();
      if (!executeRes.ok) {
        throw new Error(
          typeof executeJson.error === "string"
            ? executeJson.error
            : "Jupiter execute request failed"
        );
      }

      setSwapState("success");
      setStatusMessage("Swap completed");
      await refreshBalances(walletAddress);
    } catch (error) {
      console.error(error);
      setSwapState("error");
      setStatusMessage("Swap failed. Try again.");
    }
  };

  /// @notice Swap SOL to LOOK
  const handleSwapSol = async () => {
    const amount = BigInt(Math.floor(LAMPORTS_PER_SOL / 10));
    await executeJupiterSwap(SOL_MINT, LOOK_MINT, amount, "Swap SOL to LOOK");
  };

  /// @notice Buy SOL (redirects to faucet for devnet)
  const handleBuySol = async () => {
    // NOTE: For devnet, we redirect to Solana faucet for free SOL.
    // For mainnet, this would execute a LOOK → SOL swap via Jupiter.
    window.open("https://faucet.solana.com/", "_blank", "noopener,noreferrer");
  };

  /**
   * @notice Starts QR code scanning for wallet address
   * @dev Uses BarcodeDetector on supported browsers, falls back to jsQR for iOS
   */
  const startScan = async () => {
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Try to use BarcodeDetector if available (Chrome, Edge on Android)
      if ("BarcodeDetector" in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
        const scanFrame = async () => {
          if (!videoRef.current) return;
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue;
            setSendForm((prev) => ({ ...prev, address: raw }));
            stopScan();
            return;
          }
          scanLoopRef.current = requestAnimationFrame(scanFrame);
        };
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      } else {
        // Fallback to jsQR for iOS Safari/Chrome and other browsers
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        const scanFrame = () => {
          if (!videoRef.current || !context) return;

          if (
            videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
          ) {
            canvas.height = videoRef.current.videoHeight;
            canvas.width = videoRef.current.videoWidth;
            context.drawImage(
              videoRef.current,
              0,
              0,
              canvas.width,
              canvas.height
            );
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height,
              {
                inversionAttempts: "dontInvert",
              }
            );

            if (code) {
              setSendForm((prev) => ({ ...prev, address: code.data }));
              stopScan();
              return;
            }
          }
          scanLoopRef.current = requestAnimationFrame(scanFrame);
        };
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      console.error("QR scan failed", error);
      setIsScanning(false);
      setStatusMessage(
        "Camera access denied or unavailable. Please paste the address manually."
      );
    }
  };

  /**
   * @notice Stops QR code scanning
   */
  const stopScan = () => {
    setIsScanning(false);
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
    }
  };

  /**
   * @notice Copies wallet address to clipboard
   */
  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setStatusMessage("Address copied!");
      setTimeout(() => setStatusMessage(""), 2000);
    }
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/metakeep@2.2.8/lib/index.js"
        integrity="sha256-dVJ6hf8zqdtHxHJCDJnLAepAyCCbu6lCXzZS3lqMIto="
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={initializeSdk}
      />
      <main className="wallet-container">
        <div className="wallet-card">
          {/* Header */}
          <header className="wallet-header">
            <div className="brand-section">
              <div className="logo">
                <Image
                  src="/lookcoin.png"
                  alt="Look Wallet logo"
                  width={32}
                  height={32}
                  className="logo-image"
                  priority
                />
              </div>
              <span className="brand-name">Look Wallet</span>
            </div>
            <button
              type="button"
              className="menu-icon"
              onClick={() => setActiveModal("receive")}
              aria-label="Show wallet QR"
            >
              <span className="menu-qr">
                <span />
                <span />
                <span />
              </span>
            </button>
          </header>

          {/* Balance Section */}
          <section className="balance-section">
            <p className="balance-label">Total Balance</p>
            <h1 className="balance-amount">
              <span className="balance-currency">$</span>
              {formatNumber(totalFiat, 0)}
            </h1>
            <div className="look-balance">
              <span className="look-amount">
                {formatNumber(balances.usdc, 3)} LOOK
              </span>
              <span className="look-usd">
                (${formatNumber(balances.usdc * fiatRates.usdc, 2)})
              </span>
            </div>
          </section>

          {/* Buy Button */}
          <button
            onClick={handleBuyLook}
            disabled={buyState === "loading" || isConnecting}
            className="buy-button"
          >
            {isConnecting
              ? "CONNECTING..."
              : buyState === "loading"
              ? "BUYING..."
              : "BUY $LOOK"}
          </button>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => setActiveModal("send")}
              className="action-btn"
            >
              <span>Send</span>
            </button>
            <button
              onClick={() => setActiveModal("receive")}
              className="action-btn"
            >
              <span>Receive</span>
            </button>
          </div>

          {/* Assets Section */}
          <section className="assets-section">
            <h2 className="section-title">Your Assets</h2>

            {/* LOOK Token */}
            <div className="asset-card asset-card-inline">
              <div className="asset-info">
                <div className="asset-icon look-icon">
                  <Image
                    src="/lookcoin.png"
                    alt="LOOK token logo"
                    width={32}
                    height={32}
                    className="asset-logo-image"
                  />
                </div>
                <div>
                  <p className="asset-name">$LOOK</p>
                  <p className="asset-type asset-type-look">Attention Token</p>
                </div>
              </div>
              <div className="asset-balance">
                <p className="balance-crypto">
                  {formatNumber(balances.usdc, 3)}
                </p>
                <p className="balance-fiat">
                  ${formatNumber(balances.usdc * fiatRates.usdc, 2)}
                </p>
              </div>
            </div>

            {/* Solana Token */}
            <div className="asset-card">
              <div className="asset-content">
                <div className="asset-header">
                  <div className="asset-info">
                    <div className="asset-icon sol-icon">S</div>
                    <div>
                      <p className="asset-name">Solana</p>
                      <p className="asset-type">Network Token</p>
                    </div>
                  </div>
                  <div className="asset-balance">
                    <p className="balance-crypto">
                      {formatNumber(balances.sol, 1)}
                    </p>
                    <p className="balance-fiat">
                      ${formatNumber(balances.sol * fiatRates.sol, 2)}
                    </p>
                  </div>
                </div>
                <div className="sol-actions">
                  <button
                    onClick={handleBuySol}
                    disabled={swapState === "loading"}
                    className="sol-action-btn"
                  >
                    Buy $Sol
                  </button>
                  <button
                    onClick={handleSwapSol}
                    disabled={swapState === "loading"}
                    className="sol-action-btn"
                  >
                    Swap $Sol
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`status-message ${
                lastTxId ? "status-message-link" : ""
              }`}
              onClick={() => {
                if (lastTxId === "get-sol") {
                  // Redirect to Solana devnet faucet for gas fees
                  window.open(
                    "https://faucet.solana.com/",
                    "_blank",
                    "noopener,noreferrer"
                  );
                } else if (lastTxId) {
                  // Open Solscan for transaction details
                  window.open(
                    `https://solscan.io/tx/${lastTxId}?cluster=devnet`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                }
              }}
            >
              {statusMessage}
            </div>
          )}
        </div>

        {/* Send Modal */}
        {activeModal === "send" && (
          <div className="modal-overlay" onClick={() => setActiveModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Send LOOK</h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="close-btn"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                {isScanning && (
                  <div className="qr-scanner">
                    <video ref={videoRef} className="scanner-video" />
                    <button onClick={stopScan} className="stop-scan-btn">
                      Stop Scanning
                    </button>
                  </div>
                )}
                {!isScanning && (
                  <>
                    <button onClick={startScan} className="scan-qr-btn">
                      Scan QR Code
                    </button>
                    <input
                      value={sendForm.address}
                      onChange={(e) =>
                        setSendForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="Recipient wallet address"
                      className="modal-input"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={sendForm.amount}
                      onChange={(e) =>
                        setSendForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      placeholder="Amount in LOOK"
                      className="modal-input"
                    />
                    <button
                      onClick={handleSendUSDC}
                      disabled={sendState === "loading"}
                      className="modal-submit-btn"
                    >
                      {sendState === "loading" ? "Sending..." : "Send LOOK"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Receive Modal */}
        {activeModal === "receive" && (
          <div className="modal-overlay" onClick={() => setActiveModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Receive LOOK</h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className="close-btn"
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                {qrCodeUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCodeUrl}
                    alt="Wallet QR Code"
                    className="qr-code"
                  />
                )}
                <p className="wallet-address">{walletAddress}</p>
                <button onClick={copyAddress} className="copy-btn">
                  Copy Address
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .wallet-container {
            min-height: 100vh;
            background: #0e0e0f;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .wallet-card {
            width: 100%;
            max-width: 430px;
            background: linear-gradient(to bottom, #1c1c1f, #111113);
            border-radius: 28px;
            padding: 24px;
            box-shadow: 0 16px 50px rgba(0, 0, 0, 0.55);
            border: 1px solid #1f1f22;
          }

          .wallet-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }

          .brand-section {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .logo {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }

          .logo-image {
            width: 32px;
            height: 32px;
            object-fit: cover;
          }

          .brand-name {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
          }

          .menu-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            border: 1px solid #2f2f32;
            background: #1f1f22;
            cursor: pointer;
            padding: 0;
          }

          .menu-qr {
            display: grid;
            grid-template-columns: repeat(3, 4px);
            grid-gap: 2px;
          }

          .menu-qr span {
            width: 4px;
            height: 4px;
            background: #f6ad27;
          }

          .balance-section {
            text-align: center;
            margin-bottom: 24px;
          }

          .balance-label {
            font-size: 14px;
            color: #9ca3af;
            margin-bottom: 8px;
          }

          .balance-amount {
            font-size: 48px;
            font-weight: 800;
            color: #ffffff;
            margin-bottom: 12px;
            letter-spacing: -1px;
          }

          .balance-currency {
            color: #f6ad27;
            margin-right: 4px;
          }

          .look-balance {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          .look-amount {
            background: #1a1a1d;
            border: 1px solid #2f2f32;
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 600;
            color: #f6ad27;
          }

          .look-usd {
            font-size: 12px;
            color: #9ca3af;
          }

          .buy-button {
            width: 100%;
            background: #f6ad27;
            color: #1a1a1a;
            border: none;
            border-radius: 14px;
            padding: 16px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            margin-bottom: 16px;
            transition: all 0.2s;
          }

          .buy-button:hover:not(:disabled) {
            filter: brightness(1.05);
          }

          .buy-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 24px;
          }

          .action-btn {
            background: #1f1f22;
            border: none;
            border-radius: 16px;
            padding: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s;
          }

          .action-btn:hover {
            background: #2a2a2d;
          }

          .assets-section {
            margin-bottom: 20px;
          }

          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 12px;
          }

          .asset-card {
            background: #1a1a1d;
            border: 1px solid #252529;
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 12px;
          }

          .asset-card-inline {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .asset-content {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .asset-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .asset-info {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
          }

          .asset-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 18px;
            flex-shrink: 0;
          }

          .look-icon {
            /* Match the header logo styling so the orange logo
               never visually collides with the card border. */
            background: #ffffff;
            color: #1a1a1a;
            overflow: hidden;
          }

          .asset-logo-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .sol-icon {
            background: #5b4bff;
            color: #ffffff;
          }

          .asset-name {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
          }

          .asset-type {
            font-size: 11px;
            color: #9ca3af;
          }

          .asset-type-look {
            color: #f6ad27;
          }

          .asset-balance {
            text-align: right;
          }

          .balance-crypto {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
          }

          .balance-fiat {
            font-size: 11px;
            color: #9ca3af;
          }

          .sol-actions {
            display: flex;
            justify-content: space-between;
            padding-top: 8px;
            border-top: 1px solid #252529;
            gap: 8px;
          }

          .sol-action-btn {
            flex: 1;
            background: #27272a;
            border: 1px solid #3f3f46;
            border-radius: 999px;
            color: #e5e7eb;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            padding: 8px 12px;
            transition: all 0.2s;
            text-align: center;
          }

          .sol-action-btn:hover:not(:disabled) {
            background: #3f3f46;
          }

          .sol-action-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .status-message {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f1f22;
            color: #ffffff;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            max-width: 90%;
            text-align: center;
          }

          .status-message-link {
            cursor: pointer;
            background: #2a2a2d;
            border: 1px solid #3f3f46;
            color: #00b3ff;
            transition: all 0.2s;
          }

          .status-message-link:hover {
            background: #333336;
            transform: translateX(-50%) translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 179, 255, 0.2);
          }

          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal-content {
            background: #1c1c1f;
            border-radius: 24px;
            width: 100%;
            max-width: 400px;
            max-height: 90vh;
            overflow-y: auto;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #2f2f32;
          }

          .modal-header h3 {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
          }

          .close-btn {
            background: transparent;
            border: none;
            color: #9ca3af;
            font-size: 32px;
            cursor: pointer;
            line-height: 1;
            padding: 0;
          }

          .modal-body {
            padding: 20px;
          }

          .scan-qr-btn {
            width: 100%;
            background: #2a2a2d;
            border: 1px dashed #4a4a4f;
            border-radius: 12px;
            padding: 16px;
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            cursor: pointer;
            margin-bottom: 16px;
            transition: all 0.2s;
          }

          .scan-qr-btn:hover {
            background: #333336;
          }

          .qr-scanner {
            position: relative;
            margin-bottom: 16px;
          }

          .scanner-video {
            width: 100%;
            border-radius: 12px;
            height: 250px;
            object-fit: cover;
          }

          .stop-scan-btn {
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(0, 0, 0, 0.7);
            border: none;
            color: #ffffff;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 12px;
            cursor: pointer;
          }

          .modal-input {
            width: 100%;
            background: #151517;
            border: 1px solid #2b2b2e;
            border-radius: 12px;
            padding: 14px;
            font-size: 14px;
            color: #ffffff;
            margin-bottom: 12px;
          }

          .modal-input::placeholder {
            color: #6b7280;
          }

          .modal-submit-btn {
            width: 100%;
            background: #f6ad27;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 14px;
            font-weight: 600;
            color: #1a1a1a;
            cursor: pointer;
            transition: all 0.2s;
          }

          .modal-submit-btn:hover:not(:disabled) {
            transform: translateY(-1px);
          }

          .modal-submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .qr-code {
            width: 200px;
            height: 200px;
            margin: 0 auto 20px;
            display: block;
            border-radius: 12px;
          }

          .wallet-address {
            font-size: 12px;
            color: #9ca3af;
            word-break: break-all;
            text-align: center;
            margin-bottom: 16px;
            padding: 12px;
            background: #151517;
            border-radius: 8px;
          }

          .copy-btn {
            width: 100%;
            background: #2a2a2d;
            border: none;
            border-radius: 12px;
            padding: 14px;
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            cursor: pointer;
            transition: all 0.2s;
          }

          .copy-btn:hover {
            background: #333336;
          }
        `}</style>
      </main>
    </>
  );
}
