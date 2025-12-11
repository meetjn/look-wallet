import { NextResponse } from 'next/server';

/**
 * @notice MetaKeep developer signing endpoint is temporarily disabled.
 * @dev USDC delegation from the developer wallet has been removed in favour of Circle faucet.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'USDC delegation is disabled. Please use the Circle faucet instead of /api/sign-transaction.',
    },
    { status: 501 },
  );
}

