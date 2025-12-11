import { NextRequest, NextResponse } from 'next/server';

/**
 * @notice API route to get Jupiter swap transaction
 * @dev Converts quote response into unsigned transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    /// @notice Extract required fields
    const { quoteResponse, userPublicKey } = body;

    /// @notice Validate required fields
    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        { error: 'Missing required fields: quoteResponse, userPublicKey' },
        { status: 400 }
      );
    }

    /// @notice Request swap transaction from Jupiter
    const response = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jupiter swap error:', errorText);
      return NextResponse.json(
        { error: 'Jupiter swap request failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    /// @notice Return swap transaction
    return NextResponse.json(data);
  } catch (error) {
    console.error('Jupiter swap exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get Jupiter swap' },
      { status: 500 }
    );
  }
}

