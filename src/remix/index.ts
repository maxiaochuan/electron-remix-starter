import { app, protocol } from 'electron';
import path from 'node:path';
import { watch } from 'node:fs/promises';
import { createRequestHandler, broadcastDevReady } from '@remix-run/server-runtime';
import { serveAsset } from './serve';

interface InitRemixOptions {
  mode: string;
  /**
   * @description The path to the server build (absolute path)
   */
  serverBuildPath: string;
  /**
   * @description  The path where static assets are served from.
   */
  publicFolderPath?: string;
}

async function initRemix(options: InitRemixOptions) {
  const {
    mode,
    serverBuildPath,
    publicFolderPath = 'public',
  } = options;

	const serverBuild = require(serverBuildPath);
	let handleRequest = createRequestHandler(serverBuild, mode);
	const absPublicFolderPath = path.join(app.getAppPath(), publicFolderPath); 

	protocol.handle('http', async (request) => {
		try {
			return await serveAsset(request, absPublicFolderPath) ?? await handleRequest(request);
		} catch (error) {
			console.warn("[remix-electron]", error)
			const { stack, message } = toError(error)
			const response = new Response(`<pre>${stack || message}</pre>`, {
				headers: { 'Content-Type': 'text/html' }
			})
			return response;
		}
	})

	if (mode === "development") {
		void (async () => {
			for await (const _event of watch(serverBuildPath)) {
				purgeRequireCache(serverBuildPath)
				await broadcastDevReady(require(serverBuildPath))
				handleRequest = createRequestHandler(require(serverBuildPath), mode)
			}
		})()
	}

	// the remix web socket reads the websocket host from the browser url,
	// so this _has_ to be localhost
	return `http://localhost/`
}

function purgeRequireCache(prefix: string) {
	for (const key in require.cache) {
		if (key.startsWith(prefix)) {
			delete require.cache[key]
		}
	}
}

function toError(value: unknown) {
	return value instanceof Error ? value : new Error(String(value))
}

export { initRemix };