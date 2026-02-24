import { BlobServiceClient } from "@azure/storage-blob";

const CONTAINER = "files";

function getClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
  return BlobServiceClient.fromConnectionString(connStr);
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<string> {
  const client = getClient();
  const container = client.getContainerClient(CONTAINER);
  const blobName = `${folder}/${Date.now()}-${filename}`;
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer);
  return blockBlob.url;
}

export async function deleteFile(url: string): Promise<void> {
  try {
    const client = getClient();
    const container = client.getContainerClient(CONTAINER);
    const blobName = url.split(`/${CONTAINER}/`)[1];
    if (blobName) await container.deleteBlob(blobName);
  } catch {
    // ignore delete errors
  }
}
