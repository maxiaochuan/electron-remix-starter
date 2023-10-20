import mime from 'mime';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable } from "node:stream";
import { type AppLoadContext, type RequestHandler } from '@remix-run/server-runtime';

export async function serveAsset(request: Electron.ProtocolRequest, publicFolder: string): Promise<Electron.ProtocolResponse | undefined> {
	const url = new URL(request.url)

	const fullFilePath = path.join(publicFolder, url.pathname)
	if (!fullFilePath.startsWith(publicFolder)) return

	const stat = await fs.promises.stat(fullFilePath).catch(() => undefined);
	if (!stat?.isFile()) return

	return {
		data: fs.createReadStream(fullFilePath),
		mimeType: mime.getType(fullFilePath) ?? undefined,
	}
}

function createPassThroughStream(text: string | Buffer) {
	const readable = new PassThrough()
	readable.push(text)
	readable.push(null)
	return readable
}

export async function serveRemixResponse(
	request: Electron.ProtocolRequest,
	handleRequest: RequestHandler,
	context: AppLoadContext | undefined,
): Promise<Electron.ProtocolResponse> {
	const body = request.uploadData
		? Buffer.concat(request.uploadData.map((data) => data.bytes))
		: undefined

	const remixHeaders = new Headers(request.headers)
	remixHeaders.append("Referer", request.referrer)

	const remixRequest = new Request(request.url, {
		method: request.method,
		headers: remixHeaders,
		body,
	})

	const response = await handleRequest(remixRequest, context)

	const headers: Record<string, string[]> = {}
	response.headers.forEach((v, k) => {
		const values = (headers[k] ??= []);
		values.push(v);
	})

	if (response.body instanceof ReadableStream) {
		return {
			data: Readable.from(response.body),
			headers,
			statusCode: response.status,
		}
	}

	return {
		data: createPassThroughStream(Buffer.from(await response.arrayBuffer())),
		headers,
		statusCode: response.status,
	}
}