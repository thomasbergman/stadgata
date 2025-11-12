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

  // Get the path from the request (e.g., /all from /api/all)
  // request.query.path will be an array for catch-all routes
  const pathArray = request.query.path as string[] || [];
  const apiPath = pathArray.length > 0 ? '/' + pathArray.join('/') : '/all';
  
  // Preserve any additional query parameters from the original request
  const queryParams = new URLSearchParams();
  if (request.query.outputFormat) {
    queryParams.append('outputFormat', request.query.outputFormat as string);
  }
  queryParams.append('apiKey', apiKey);
  
  // Build the Stockholm API URL
  const stockholmUrl = `https://openparking.stockholm.se/LTF-Tolken/v1/servicedagar${apiPath}?${queryParams.toString()}`;

  try {
    // Fetch from Stockholm API
    const apiResponse = await fetch(stockholmUrl);
    
    if (!apiResponse.ok) {
      response.status(apiResponse.status).json({
        error: `API request failed: ${apiResponse.status} ${apiResponse.statusText}`
      });
      return;
    }

    const data = await apiResponse.json();
    
    // Return the data with CORS headers
    response.status(200).json(data);
  } catch (error) {
    console.error('Error proxying request to Stockholm API:', error);
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

