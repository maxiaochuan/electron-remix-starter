import mime from 'mime';
import fs from 'node:fs';
import path from 'node:path';

export async function serveAsset(request: Request, absPublicFolderPath: string): Promise<Response | undefined> {
	const url = new URL(request.url)

	const fullFilePath = path.join(absPublicFolderPath, url.pathname)

	const stat = await fs.promises.stat(fullFilePath).catch(() => undefined);
	if (!stat?.isFile()) return

	return new Response(fs.createReadStream(fullFilePath) as any, {
		headers: { 'Content-Type': mime.getType(fullFilePath) || 'text/html' }
	});
}
