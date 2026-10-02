// Keep every browser upload within the deployed serverless request limit,
// including multipart overhead. Non-serverless APIs may accept larger files.
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
