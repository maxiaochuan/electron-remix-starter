import { useLoaderData } from "@remix-run/react"
import electron from "~/electron.server"

export function loader() {
	return {
		userDataPath: electron.app.getPath("userData"),
		versions: process.versions,
	}
}

export default function Index() {
	const data = useLoaderData<typeof loader>()
	return (
		<main>
			<h1>Welcome to Remix</h1>
			<p>User data path: {data.userDataPath}</p>
			<div>
				<pre>
					{JSON.stringify(data.versions, undefined, 2)}
				</pre>
			</div>
		</main>
	)
}
