const { PassThrough, Readable } = require("node:stream")
import path from 'node:path';
import fs from 'node:fs';
import mime from 'mime';
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

/**
 * @param {Electron.ProtocolRequest} request
 * @param {import("@remix-run/server-runtime").RequestHandler} handleRequest
 * @param {import("@remix-run/server-runtime").AppLoadContext | undefined} context
 * @returns {Promise<Electron.ProtocolResponse>}
 */
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
	// for (const [key, value] of response.headers) {
	// 	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	// 	const values = (headers[key] ??= [])
	// 	values.push(value)
	// }

	// ts-expect-error: Argument of type 'ReadableStream<Uint8Array>' is not assignable to parameter of type 'Iterable<any> | AsyncIterable<any>'.

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