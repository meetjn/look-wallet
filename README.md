# Look Wallet - Mobile USDC Wallet

A beautiful, mobile-first wallet application for managing USDC (displayed as $LOOK) on Solana devnet. Built with Next.js 15, MetaKeep, and Jupiter.

## Features

- 🔐 **MetaKeep Integration** - Secure, non-custodial wallet management
- 💰 **Buy $LOOK** - Get free testnet USDC via delegation from developer wallet
- 📤 **Send USDC** - Transfer USDC to any Solana address with QR code scanning
- 📥 **Receive USDC** - Display QR code and copyable wallet address
- 💱 **Jupiter Swaps** - Buy SOL and swap between SOL ⟷ USDC
- 📊 **Real-time Balances** - Live USDC and SOL balances with USD conversion
- 📱 **Mobile-First Design** - Optimized for 6.1-6.9 inch screens

## Setup

### 1. Install Dependencies

```bash
cd look-wallet-app
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```env
# MetaKeep Configuration
NEXT_PUBLIC_METAKEEP_APP_ID=8bb569c5-adb9-454e-a529-07a8b1954ef0
METAKEEP_API_KEY=your_metakeep_api_key_here

# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_DEV_WALLET=76fk8Dgb8ENk55vZrTPDwgUKbDDxqvhRwogK8WgYiJAU
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your mobile browser or emulator.

## Architecture

### MetaKeep Integration

The app uses MetaKeep SDK for:
- Wallet creation and management
- Transaction signing (both user and developer wallets)
- Secure key custody

### USDC Delegation

When users click "Buy $LOOK":
1. Developer wallet creates ATAs if needed
2. Transaction is built to transfer 1 USDC
3. Developer wallet signs via MetaKeep API
4. Transaction is submitted to Solana devnet

### Jupiter Integration

For SOL ⟷ USDC swaps:
1. Get quote from Jupiter API
2. Build swap transaction
3. User signs with MetaKeep
4. Submit to Solana

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Solana Web3.js** - Blockchain interactions
- **MetaKeep** - Wallet custody and signing
- **Jupiter** - Token swaps
- **QRCode** - QR code generation for receiving

## Mobile Optimization

- Viewport optimized for 6.1-6.9 inch screens
- Touch-friendly UI elements
- Responsive typography and spacing
- Dark theme with orange ($LOOK) accents

## Testing

### Get Testnet USDC

1. Click "Buy $LOOK" to receive 1 USDC from the developer wallet
2. If delegation fails, visit [Circle Faucet](https://faucet.circle.com/)

### Send USDC

1. Click "Send"
2. Scan QR code or paste recipient address
3. Enter amount and confirm

### Swap Tokens

1. Navigate to Solana asset card
2. Click "Buy $Sol" to swap USDC → SOL
3. Click "Swap $Sol" to swap SOL → USDC

## API Routes

- `/api/sign-transaction` - Signs transactions with developer wallet
- `/api/jupiter/quote` - Gets Jupiter swap quote
- `/api/jupiter/swap` - Builds Jupiter swap transaction

## Security Notes

- All private keys are managed by MetaKeep
- Developer wallet API key must be kept secure
- App only works on Solana devnet
- For production, implement additional security measures

## License

MIT

