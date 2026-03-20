const DOCUPIPE_API_URL = process.env.DOCUPIPE_API_URL || 'https://api.docupipe.com';
const DOCUPIPE_API_KEY = process.env.DOCUPIPE_API_KEY || '';

interface DocuPipeUploadResponse {
  document_id: string;
  status: string;
}

export async function uploadToDocuPipe(
  base64File: string,
  fileName: string,
  metadata?: Record<string, string>
): Promise<DocuPipeUploadResponse> {
  const response = await fetch(`${DOCUPIPE_API_URL}/v1/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DOCUPIPE_API_KEY}`,
    },
    body: JSON.stringify({
      file: base64File,
      file_name: fileName,
      metadata: metadata || {},
      webhook_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : ''}${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/docupipe/webhook`,
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
  status: 'completed' | 'failed';
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
