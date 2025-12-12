import { NextRequest, NextResponse } from 'next/server';

const JUPITER_ULTRA_BASE_URL = 'https://api.jup.ag/ultra/v1';

/// @notice Reads Jupiter Ultra API key from environment
const getApiKey = () =>
  process.env.JUPITER_ULTRA_API_KEY ?? process.env.NEXT_PUBLIC_JUPITER_ULTRA_API_KEY;

/**
 * @notice Proxies Jupiter Ultra execute endpoint
 * @dev Expects signedTransaction (base64) and requestId in the JSON body
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const signedTransaction =
      typeof body.signedTransaction === 'string' ? body.signedTransaction : undefined;
    const requestId = typeof body.requestId === 'string' ? body.requestId : undefined;

    if (!signedTransaction || !requestId) {
      return NextResponse.json(
        {
          error:
            'signedTransaction and requestId are required in the execute payload.',
        },
        { status: 400 },
      );
    }

    const upstream = await fetch(`${JUPITER_ULTRA_BASE_URL}/execute`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ signedTransaction, requestId }),
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
    const message =
      error instanceof Error ? error.message : 'Jupiter execute request failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



