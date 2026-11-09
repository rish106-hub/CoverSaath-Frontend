# Uploading PDFs larger than 4 MB

Status: decision recorded, not built. Current limit: 4 MB (`MAX_UPLOAD_BYTES` in `src/adapters/documents-contract.ts`).

## Why 4 MB

The browser never calls the backend (host and origin guard, no CORS). The PDF goes browser to BFF route to backend. A Vercel function accepts a request body of at most 4.5 MB, so the route takes up to 4 MB and leaves room for headers. The backend itself accepts 15 MB (`MAX_DOCUMENT_BYTES`).

## Options for larger files

1. Vercel Blob client upload, then the BFF forwards. The browser uploads straight to Blob with a short-lived token issued by a BFF route (checks session and consent first). A second BFF route reads the blob server side (up to 15 MB fits function memory), sends it to the backend with the same headers as today, then deletes the blob. Needs the `@vercel/blob` dependency, a Blob store and `BLOB_READ_WRITE_TOKEN`. The PDF touches a second storage for a short time, which needs a privacy review, a short lifetime and deletion on failure. Recommended path.
2. Chunked upload through the BFF. Not workable as is: chunks land on different serverless instances and there is no shared store to assemble them, and the backend has no chunk or resume route. Would need backend work.
3. Raise the limit on the host (a self-hosted Node server has no 4.5 MB cap). Not available on Vercel.
4. Compress or split on the device. Fragile for scanned policies; not recommended.

## To build option 1

- Flag `NEXT_PUBLIC_LARGE_UPLOAD=1` (page) and `LARGE_UPLOAD_ENABLED=1` (server).
- `POST /api/app/documents/blob-token`: same-origin guard, session, consent present, content type `application/pdf`, size cap 15 MB, random path under `uploads/<household>/`.
- `POST /api/app/documents/from-blob`: takes the blob url, validates the host and path prefix, reads it, runs `checkPdfUpload`, calls `uploadDocument`, deletes the blob in `finally`.
- Tests: token refused without consent or session, wrong host or path refused, blob deleted on both success and failure.
