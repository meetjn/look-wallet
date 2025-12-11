import { NextRequest, NextResponse } from 'next/server';

const JUPITER_ULTRA_BASE_URL = 'https://api.jup.ag/ultra/v1';

/// @notice Reads Jupiter Ultra API key from environment
const getApiKey = () =>
  process.env.JUPITER_ULTRA_API_KEY ?? process.env.NEXT_PUBLIC_JUPITER_ULTRA_API_KEY;

/**
 * @notice Proxies Jupiter Ultra order endpoint
 * @dev Keeps API key on the server and supports dynamic input/output mints
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Jupiter Ultra API key missing. Set JUPITER_ULTRA_API_KEY in your environment.',
        },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const taker = searchParams.get('taker');

    const missing = ['inputMint', 'outputMint', 'amount', 'taker'].filter((key) => {
      const value = searchParams.get(key);
      return !value;
    });

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required parameter(s): ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({
      inputMint: String(inputMint),
      outputMint: String(outputMint),
      amount: String(amount),
      taker: String(taker),
    });

    const target = `${JUPITER_ULTRA_BASE_URL}/order?${params.toString()}`;

    const upstream = await fetch(target, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    const bodyText = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? 'application/json';

    return new NextResponse(bodyText || '{}', {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jupiter order request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


