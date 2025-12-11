import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

/// @notice USDC Devnet Mint Address on Solana (underlying asset)
export const USDC_MINT_ADDRESS = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
/// @notice LOOK Meme Coin Mint Address on Solana (UI / future use)
export const LOOK_MINT_ADDRESS = new PublicKey(
  "9223LqDuoJXyhCtvi54DUQPGS8Xf29kUEQRr7Sfhmoon"
);
/// @notice USDC token has 6 decimal places
export const USDC_DECIMALS = 6;
/// @notice Solana RPC endpoint for devnet
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

/**
 * @notice Gets or creates an Associated Token Account (ATA) for a given mint and owner
 * @param connection Solana connection instance
 * @param mint Token mint address
 * @param owner Token account owner address
 * @param payer Account that will pay for ATA creation if needed
 * @return ATA address and optional creation instruction
 */
export async function getOrCreateATA(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey
): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
  /// @notice Calculate the ATA address deterministically
  const ata = await getAssociatedTokenAddress(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  /// @notice Check if the ATA already exists on-chain
  const accountInfo = await connection.getAccountInfo(ata);
  
  if (!accountInfo) {
    /// @notice Create instruction to initialize the ATA if it doesn't exist
    const instruction = createAssociatedTokenAccountInstruction(
      payer,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return { address: ata, instruction };
  }

  /// @notice ATA exists, no instruction needed
  return { address: ata, instruction: null };
}

/**
 * @notice Creates a transfer instruction for SPL tokens with decimal checking
 * @param source Source token account
 * @param mint Token mint address
 * @param destination Destination token account
 * @param authority Account authorized to transfer tokens
 * @param amount Amount to transfer in base units
 * @param decimals Token decimals for validation
 * @return Transfer instruction
 */
export function createTransferCheckedInstruction_Custom(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint,
  decimals: number
): TransactionInstruction {
  return createTransferCheckedInstruction(
    source,
    mint,
    destination,
    authority,
    amount,
    decimals,
    [],
    TOKEN_PROGRAM_ID
  );
}

/**
 * @notice Creates a Solana connection instance
 * @return Connection to Solana devnet
 */
export function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

