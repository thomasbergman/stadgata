import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Enable CORS
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // Get API key from environment variable
  const apiKey = process.env.VITE_STOCKHOLM_API_KEY;
  
  if (!apiKey) {
    response.status(500).json({ 
      error: 'VITE_STOCKHOLM_API_KEY is not configured' 
    });
    return;
  }

  // Get the path from the request (e.g., /all from /api/all, or /within from /api/within)
  // request.query.path will be an array for catch-all routes
  const pathArray = request.query.path as string[] || [];
  const operation = pathArray.length > 0 ? pathArray[0] : 'all';
  
  // Build query parameters
  const queryParams = new URLSearchParams();
  
  // For 'within' operation, preserve radius, lat, lng parameters
  if (operation === 'within') {
    if (request.query.radius) {
      queryParams.append('radius', request.query.radius as string);
    }
    if (request.query.lat) {
      queryParams.append('lat', request.query.lat as string);
    }
    if (request.query.lng) {
      queryParams.append('lng', request.query.lng as string);
    }
  }
  
  // Preserve outputFormat if provided
  if (request.query.outputFormat) {
    queryParams.append('outputFormat', request.query.outputFormat as string);
  }
  
  queryParams.append('apiKey', apiKey);
  
  // Build the Stockholm API URL
  const apiPath = operation === 'all' ? '/all' : `/${operation}`;
  const stockholmUrl = `https://openparking.stockholm.se/LTF-Tolken/v1/servicedagar${apiPath}?${queryParams.toString()}`;

  try {
    console.log('Proxying request to Stockholm API:', stockholmUrl);
    
    // Add timeout for the fetch (25 seconds - Vercel functions have 30s timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    let apiResponse: Response;
    try {
      apiResponse = await fetch(stockholmUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        }
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('Stockholm API request timeout');
        response.status(504).json({
          error: 'API request timeout - the Stockholm API took too long to respond'
        });
        return;
      }
      throw fetchError;
    }
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text().catch(() => 'Unknown error');
      console.error('Stockholm API error:', {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        body: errorText.substring(0, 500)
      });
      response.status(apiResponse.status).json({
        error: `API request failed: ${apiResponse.status} ${apiResponse.statusText}`
      });
      return;
    }

    const data = await apiResponse.json();
    
    console.log('Successfully proxied response from Stockholm API');
    // Return the data with CORS headers
    response.status(200).json(data);
  } catch (error) {
    console.error('Error proxying request to Stockholm API:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: stockholmUrl
    });
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

