import { NextRequest, NextResponse } from 'next/server';

/**
 * @notice API route to get Jupiter swap quote
 * @dev Proxies request to Jupiter API for SOL ⟷ USDC swaps
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    /// @notice Extract query parameters
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps') || '50';

    /// @notice Validate required parameters
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: inputMint, outputMint, amount' },
        { status: 400 }
      );
    }

    /// @notice Request quote from Jupiter API
    const jupiterUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    
    console.log('Requesting Jupiter quote:', jupiterUrl);
    
    const response = await fetch(jupiterUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jupiter quote error:', errorText);
      return NextResponse.json(
        { error: 'Jupiter quote request failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    /// @notice Return quote data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jupiter quote exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get Jupiter quote' },
      { status: 500 }
    );
  }
}


