# Look Wallet - Implementation Details

## Project Structure

```
look-wallet-app/
├── app/
│   ├── api/
│   │   ├── sign-transaction/
│   │   │   └── route.ts          # Signs transactions with developer wallet
│   │   └── jupiter/
│   │       ├── quote/
│   │       │   └── route.ts      # Gets Jupiter swap quotes
│   │       └── swap/
│   │           └── route.ts      # Builds Jupiter swap transactions
│   ├── layout.tsx                # Root layout with MetaKeep script
│   ├── page.tsx                  # Main wallet UI component
│   ├── globals.css               # Global styles
│   └── favicon.ico
├── lib/
│   └── solana-utils.ts           # Solana helper functions
├── types/
│   ├── index.ts                  # Type definitions
│   └── metakeep.d.ts             # MetaKeep SDK types
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

## Key Components

### 1. MetaKeep Integration (`app/page.tsx`)

**Initialization:**
```typescript
const sdk = new window.MetaKeep({ appId: DEFAULT_APP_ID });
const result = await sdk.getWallet();
const solAddress = result.wallet.solAddress;
```

**Signing User Transactions:**
```typescript
const signed = await sdk.signTransaction(
  transaction,
  "Send 1.5 USDC"
);
```

### 2. USDC Delegation (`handleBuyLook`)

**Flow:**
1. Create ATAs for dev and user wallets if needed
2. Build transaction with transfer instruction
3. Serialize transaction message
4. Send to `/api/sign-transaction` (developer wallet signs)
5. Add signature to transaction
6. Submit to Solana

**Code:**
```typescript
// Build transaction
const tx = new Transaction();
if (devAtaIx) tx.add(devAtaIx);
if (userAtaIx) tx.add(userAtaIx);
tx.add(
  createTransferCheckedInstruction(
    devAta,          // Source
    USDC_MINT_ADDRESS,
    userAta,         // Destination
    dev,             // Authority
    BigInt(1 * 10 ** 6), // 1 USDC
    6                // Decimals
  )
);

// Get developer wallet signature via API
const signResponse = await fetch('/api/sign-transaction', {
  method: 'POST',
  body: JSON.stringify({
    serializedTransactionMessage: `0x${tx.serializeMessage().toString('hex')}`,
    reason: 'Delegate sends 1 USDC'
  })
});
```

### 3. Send USDC (`handleSendUSDC`)

**Flow:**
1. Validate recipient address
2. Ensure both sender and recipient have USDC ATAs
3. Build transfer transaction
4. User signs with MetaKeep
5. Submit to Solana

**QR Scanning:**
```typescript
// Request camera access
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment' }
});

// Detect QR codes
const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
const codes = await detector.detect(videoElement);
```

### 4. Balance Fetching (`refreshBalances`)

**SOL Balance:**
```typescript
const lamports = await connection.getBalance(owner);
const sol = lamports / LAMPORTS_PER_SOL;
```

**USDC Balance:**
```typescript
const usdcAta = await getAssociatedTokenAddress(
  USDC_MINT_ADDRESS,
  owner
);
const usdcInfo = await connection.getTokenAccountBalance(usdcAta);
const usdc = Number(usdcInfo.value.amount) / 10 ** 6;
```

### 5. Jupiter Swaps (`executeJupiterSwap`)

**Flow:**
1. Get quote from Jupiter API
2. Build swap transaction
3. Deserialize versioned transaction
4. User signs with MetaKeep
5. Submit to Solana

**Code:**
```typescript
// Get quote
const quoteRes = await fetch(
  `/api/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`
);
const quote = await quoteRes.json();

// Build swap transaction
const swapRes = await fetch('/api/jupiter/swap', {
  method: 'POST',
  body: JSON.stringify({
    quoteResponse: quote,
    userPublicKey: walletAddress
  })
});
const { swapTransaction } = await swapRes.json();

// Deserialize and sign
const tx = VersionedTransaction.deserialize(
  Buffer.from(swapTransaction, 'base64')
);
const signed = await sdk.signTransaction(tx, 'Swap SOL to USDC');
```

## Design System

### Colors

```css
/* Background */
--bg-primary: #0e0e0f;
--bg-card: #1c1c1f;
--bg-secondary: #1a1a1d;
--bg-tertiary: #1f1f22;

/* Text */
--text-primary: #ffffff;
--text-secondary: #9ca3af;
--text-tertiary: #6b7280;

/* Brand */
--orange-primary: #f6ad27;
--orange-light: #ffb347;
--orange-dark: #ff930f;

/* Accent */
--blue-primary: #5b4bff;
--cyan-primary: #00b3ff;

/* Border */
--border-primary: #2f2f32;
--border-secondary: #252529;
```

### Typography

```css
/* Headings */
.balance-amount { font-size: 48px; font-weight: 800; }
.brand-name { font-size: 18px; font-weight: 600; }
.section-title { font-size: 14px; font-weight: 600; }

/* Body */
.asset-name { font-size: 14px; font-weight: 600; }
.asset-type { font-size: 11px; }
.balance-crypto { font-size: 14px; font-weight: 600; }
.balance-fiat { font-size: 11px; }
```

### Spacing

```css
/* Card padding */
.wallet-card { padding: 24px; }
.asset-card { padding: 16px; }
.modal-header { padding: 20px; }

/* Gaps */
.brand-section { gap: 12px; }
.action-buttons { gap: 12px; }
.asset-info { gap: 12px; }
```

### Border Radius

```css
.wallet-card { border-radius: 28px; }
.buy-button { border-radius: 14px; }
.asset-card { border-radius: 16px; }
.action-btn { border-radius: 16px; }
.modal-content { border-radius: 24px; }
```

## State Management

### React State Hooks

```typescript
// Core wallet state
const [sdk, setSdk] = useState<unknown>(null);
const [walletAddress, setWalletAddress] = useState<string | null>(null);

// Balances
const [balances, setBalances] = useState<BalanceSnapshot>({
  usdc: 0,
  sol: 0,
  usd: 0,
});

// Action states
const [buyState, setBuyState] = useState<ActionState>('idle');
const [sendState, setSendState] = useState<ActionState>('idle');
const [swapState, setSwapState] = useState<ActionState>('idle');

// UI state
const [activeModal, setActiveModal] = useState<'send' | 'receive' | null>(null);
const [isScanning, setIsScanning] = useState(false);
```

### Computed Values (useMemo)

```typescript
// Total portfolio value
const totalFiat = useMemo(
  () => balances.usdc * fiatRates.usdc + balances.sol * fiatRates.sol,
  [balances, fiatRates]
);

// Solana connection (singleton)
const connection = useMemo(
  () => new Connection(RPC_URL, 'confirmed'),
  []
);
```

## Error Handling

### Transaction Errors

```typescript
try {
  // Transaction logic
} catch (error) {
  console.error(error);
  setBuyState('error');
  setStatusMessage('Transaction failed. Please retry.');
  
  // Optional: Redirect to faucet if delegation fails
  setTimeout(() => {
    window.location.href = 'https://faucet.circle.com/';
  }, 3000);
}
```

### API Errors

```typescript
if (!response.ok) {
  const errorData = await response.json();
  return NextResponse.json(
    { 
      error: errorData.message || 'Request failed',
      details: errorData
    },
    { status: response.status }
  );
}
```

## Performance Optimizations

### 1. Memoization
- `useMemo` for computed values (totalFiat, connection)
- `useCallback` for event handlers (prevents re-renders)

### 2. Lazy Loading
- QR codes generated only when modal opens
- Balance refresh triggered by user actions

### 3. Efficient Re-renders
- State updates are batched
- Modals prevent body scroll
- Video stream stopped when QR scanning ends

### 4. Bundle Size
- Next.js automatic code splitting
- Only necessary Solana packages imported
- Styled JSX keeps CSS scoped and minimal

## Testing Checklist

- [ ] MetaKeep wallet connection
- [ ] Balance display (USDC + SOL)
- [ ] Buy $LOOK delegation
- [ ] Send USDC with manual address
- [ ] Send USDC with QR scanning
- [ ] Receive QR code display
- [ ] Copy wallet address
- [ ] Buy SOL (USDC → SOL swap)
- [ ] Swap SOL (SOL → USDC swap)
- [ ] USD price conversion
- [ ] Loading states
- [ ] Error handling
- [ ] Mobile responsiveness
- [ ] Touch interactions

## Known Limitations

1. **Testnet Only**: App only works on Solana devnet
2. **QR Scanning**: Requires HTTPS or localhost
3. **BarcodeDetector**: Not available on all browsers (Safari unsupported)
4. **MetaKeep Limits**: Developer wallet has daily transaction limits
5. **RPC Rate Limits**: Public Solana RPC may be slow
6. **Jupiter Slippage**: 0.5% slippage may cause swap failures in volatile markets

## Future Enhancements

### Short Term
- Add transaction confirmation animations
- Implement retry logic for failed transactions
- Add amount validation (min/max checks)
- Show estimated gas fees

### Medium Term
- Transaction history with filtering
- Multiple token support (beyond USDC/SOL)
- Custom RPC endpoint selection
- Price charts and analytics

### Long Term
- Multi-chain support (Ethereum, Polygon, etc.)
- DeFi integrations (lending, staking)
- NFT marketplace integration
- Social features (send to username)

## Resources

- **Solana Web3.js**: https://solana-labs.github.io/solana-web3.js/
- **SPL Token**: https://spl.solana.com/token
- **MetaKeep API**: https://docs.metakeep.xyz/reference/introduction
- **Jupiter API**: https://station.jup.ag/docs/apis/swap-api
- **Next.js App Router**: https://nextjs.org/docs/app


