import { ApplicationInfoForProtocolReturnValue, app, protocol } from 'electron';
import path from 'node:path';
import {
  createRequestHandler,
  broadcastDevReady,
  type ServerBuild,
  type AppLoadContext,
  type RequestHandler,
} from '@remix-run/server-runtime';
import { watch } from 'node:fs/promises';
import {
	serveAsset,
	serveRemixResponse,
} from './serve';
// const { serveAsset } = require("./asset-files.cjs")
// const { serveRemixResponse } = require("./serve-remix-response.cjs")

function asAbsolutePath(filePath: string, workingDirectory: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(workingDirectory, filePath);
}

const DEFAULT_MODE = app.isPackaged ? "production" : process.env.NODE_ENV

interface InitRemixOptions {
  mode?: string;
  /**
   * @description The path to the server build, or the server build itself.
   */
  serverBuild: ServerBuild | string;
  /**
   * @description  The path where static assets are served from.
   */
  publicFolder?: string;
  /**
   * @description  A function to provide a `context` object to your loaders.
   */
  getLoadContext?: (request: Electron.ProtocolRequest) => AppLoadContext | undefined | Promise<AppLoadContext | undefined>
}

async function initRemix(options: InitRemixOptions) {
  const {
    mode = DEFAULT_MODE,
    serverBuild: serverBuildOption,
    publicFolder: publicFolderOption = 'public',
    getLoadContext
  } = options;

  const appRoot = app.getAppPath();
  const publicFolder = asAbsolutePath(publicFolderOption, appRoot);

	const buildPath =
		typeof serverBuildOption === "string"
			? require.resolve(serverBuildOption)
			: undefined
  
  let serverBuild =
    typeof serverBuildOption === 'string'
      ? require(serverBuildOption)
      : serverBuildOption

	await app.whenReady()

	protocol.interceptStreamProtocol("http", async (request, callback) => {
		console.log('inter', request);
		try {
			const context = await getLoadContext?.(request)
			const requestHandler = createRequestHandler(serverBuild, mode)
			callback(
				await handleRequest(request, publicFolder, requestHandler, context),
			)
		} catch (error) {
			console.warn("[remix-electron]", error)
			const { stack, message } = toError(error)
			callback({
				statusCode: 500,
				data: `<pre>${stack || message}</pre>`,
			})
		}
	})

	if (mode === "development" && typeof buildPath === "string") {
		void (async () => {
			for await (const _event of watch(buildPath)) {
				purgeRequireCache(buildPath)
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				serverBuild = require(buildPath)
				await broadcastDevReady(serverBuild)
			}
		})()
	}

	// the remix web socket reads the websocket host from the browser url,
	// so this _has_ to be localhost
	return `http://localhost/`
}

// /**
//  * @param {Electron.ProtocolRequest} request
//  * @param {string} publicFolder
//  * @param {import("@remix-run/server-runtime").RequestHandler} requestHandler
//  * @param {AppLoadContext | undefined} context
//  * @returns {Promise<Electron.ProtocolResponse>}
//  */
async function handleRequest(
  request: Electron.ProtocolRequest,
  publicFolder: string,
  requestHandler: RequestHandler,
  context: AppLoadContext | undefined
  ) {
	return (
		(await serveAsset(request, publicFolder)) ??
		(await serveRemixResponse(request, requestHandler, context))
	)
}

// /** @param {string} prefix */
function purgeRequireCache(prefix: string) {
	for (const key in require.cache) {
		if (key.startsWith(prefix)) {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete require.cache[key]
		}
	}
}

function toError(value: unknown) {
	return value instanceof Error ? value : new Error(String(value))
}

export { initRemix };