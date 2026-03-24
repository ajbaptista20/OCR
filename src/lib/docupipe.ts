const DOCUPIPE_API_URL = process.env.DOCUPIPE_API_URL || 'https://app.docupipe.ai';
const DOCUPIPE_API_KEY = process.env.DOCUPIPE_API_KEY || '';

function getDocuPipeWebhookUrl() {
  if (process.env.DOCUPIPE_WEBHOOK_URL) {
    return process.env.DOCUPIPE_WEBHOOK_URL;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return `${process.env.NEXT_PUBLIC_SITE_URL}/api/docupipe/webhook`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/docupipe/webhook`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing DOCUPIPE_WEBHOOK_URL or NEXT_PUBLIC_SITE_URL in production.'
    );
  }

  return 'http://localhost:3000/api/docupipe/webhook';
}

interface DocuPipeUploadResponse {
  documentId: string;
  jobId?: string;
  status: string;
}

export async function uploadToDocuPipe(
  base64File: string,
  fileName: string,
  metadata?: Record<string, string>
): Promise<DocuPipeUploadResponse> {
  const response = await fetch(`${DOCUPIPE_API_URL}/document`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': DOCUPIPE_API_KEY,
    },
    body: JSON.stringify({
      document: {
        file: {
          contents: base64File,
          filename: fileName,
        },
      },
      metadata: metadata || {},
      // Kept for backwards compatibility with setups that accept callback hints
      webhook_url: getDocuPipeWebhookUrl(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuPipe upload failed: ${error}`);
  }

  return response.json();
}

export interface DocuPipeWebhookPayload {
  document_id: string;
  status: 'completed' | 'failed' | string;
  data?: {
    supplier_name?: string;
    invoice_number?: string;
    invoice_date?: string;
    total_amount?: number;
    vat_amount?: number;
    currency?: string;
    line_items?: Array<{
      description?: string;
      quantity?: number;
      unit_price?: number;
      total?: number;
    }>;
  };
  error?: string;
}
