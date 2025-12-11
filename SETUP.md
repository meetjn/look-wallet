# Look Wallet Setup Guide

## Quick Start

### 1. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# MetaKeep Configuration
NEXT_PUBLIC_METAKEEP_APP_ID=8bb569c5-adb9-454e-a529-07a8b1954ef0
METAKEEP_API_KEY=your_metakeep_api_key_here

# Solana Configuration  
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_DEV_WALLET=76fk8Dgb8ENk55vZrTPDwgUKbDDxqvhRwogK8WgYiJAU
```

**Important:** Replace `your_metakeep_api_key_here` with your actual MetaKeep API key from the [MetaKeep Dashboard](https://console.metakeep.xyz/).

### 2. Run the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### 3. Test on Mobile

For best experience, test on a real mobile device:

**Option A: Local Network**
1. Find your computer's IP address
2. On your mobile device, navigate to `http://YOUR_IP:3000`
3. Accept any security warnings (development only)

**Option B: Mobile Emulator**
- Use Chrome DevTools device toolbar (F12 → Toggle device toolbar)
- Or use iOS Simulator / Android Emulator

## Features Overview

### 🔐 Wallet Connection
- On page load, MetaKeep SDK initializes automatically
- User is prompted to connect via MetaKeep (email/social login)
- Solana wallet address is retrieved and stored

### 💰 Buy $LOOK
- Clicking "BUY $LOOK" delegates 1 USDC from the developer wallet
- Uses MetaKeep API to sign with developer wallet
- Creates necessary ATAs automatically
- If it fails, redirects to Circle faucet after 3 seconds

### 📤 Send USDC
1. Click "Send" button
2. Option to scan QR code (requires camera permission)
3. Enter recipient address manually
4. Enter amount
5. MetaKeep prompts user to sign transaction
6. Transaction is submitted and confirmed

### 📥 Receive USDC
1. Click "Receive" button
2. QR code is displayed (generated client-side)
3. Wallet address is shown
4. Click "Copy Address" to copy to clipboard

### 💱 Jupiter Swaps
- **Buy $Sol**: Swaps USDC → SOL (1 USDC = ~0.005 SOL)
- **Swap $Sol**: Swaps SOL → USDC (0.1 SOL = ~1 USDC)
- Both use Jupiter aggregator for best rates
- MetaKeep signs the swap transaction

### 📊 Balance Display
- Real-time USDC balance (displayed as $LOOK)
- Real-time SOL balance
- Total portfolio value in USD
- Fetches SOL price from CoinGecko

## Architecture

### Frontend (Next.js 15)
- **App Router**: Modern React Server Components
- **Client Components**: All wallet interactions use 'use client'
- **TypeScript**: Full type safety
- **Styled JSX**: Scoped CSS-in-JS for component styling

### API Routes
- `/api/sign-transaction`: Signs transactions with developer wallet
- `/api/jupiter/quote`: Proxies Jupiter quote requests
- `/api/jupiter/swap`: Proxies Jupiter swap requests

### External Services
- **MetaKeep**: Wallet custody and transaction signing
- **Solana Devnet**: Blockchain network
- **Jupiter**: DEX aggregator for swaps
- **CoinGecko**: Price data

## Security Considerations

### Environment Variables
- `NEXT_PUBLIC_*` variables are exposed to the browser
- `METAKEEP_API_KEY` is server-side only (DO NOT prefix with NEXT_PUBLIC_)
- Never commit `.env.local` to version control

### Developer Wallet
- The developer wallet private key is stored in MetaKeep
- Only the API key is needed to sign transactions
- For production, implement spending limits and monitoring

### User Wallets
- Private keys never leave MetaKeep's infrastructure
- Users authenticate via email/social (no seed phrases to manage)
- MetaKeep uses MPC (Multi-Party Computation) for key management

## Troubleshooting

### "MetaKeep SDK is not available"
- Check that the MetaKeep script tag is loading in `layout.tsx`
- Ensure you're not blocking third-party scripts
- Try refreshing the page

### "Delegate signature failed"
- Verify `METAKEEP_API_KEY` is set correctly
- Check that the developer wallet has permissions
- Ensure the API key has transaction signing enabled

### "Jupiter quote failed"
- Check internet connection
- Verify balances are sufficient
- Try a smaller amount

### QR Scanning Not Working
- Grant camera permissions
- BarcodeDetector API only works on HTTPS or localhost
- Try manual address entry instead

### Balance Shows 0
- Wait a few seconds for RPC to sync
- Check wallet has received test tokens
- Use Circle faucet to get initial USDC

## Mobile Optimization

### Screen Size Support
- Optimized for 6.1" to 6.9" mobile screens
- Max width: 430px
- Responsive typography
- Touch-friendly buttons (minimum 44px)

### Performance
- Lazy load images and QR codes
- Minimize re-renders with useMemo/useCallback
- Efficient state management

### UX Enhancements
- Loading states for all async actions
- Error messages with context
- Success confirmations
- Status message toasts

## Deployment

### Vercel (Recommended)
```bash
npm run build
vercel --prod
```

Set environment variables in Vercel dashboard.

### Other Platforms
```bash
npm run build
npm start
```

Ensure Node.js 18+ is available.

## Next Steps

1. **Add Transaction History**: Store and display past transactions
2. **Multi-Token Support**: Extend beyond USDC/SOL
3. **Price Alerts**: Notify users of price movements
4. **Biometric Auth**: Add Touch ID / Face ID support
5. **Portfolio Analytics**: Charts and insights
6. **NFT Gallery**: Display user's NFT collection

## Support

- **MetaKeep Docs**: https://docs.metakeep.xyz
- **Solana Docs**: https://docs.solana.com
- **Jupiter Docs**: https://station.jup.ag/docs
- **Next.js Docs**: https://nextjs.org/docs

## License

MIT - See LICENSE file for details

