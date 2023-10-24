import { useLoaderData } from "@remix-run/react"
import { atom, useAtom } from 'jotai';
import { useHydrateAtoms } from "jotai/utils";
import electron from "~/electron.server"

export function loader() {
	return {
		userDataPath: electron.app.getPath("userData"),
		versions: process.versions,
		count: 10,
	}
}

const countAtom = atom(0);

export default function Index() {
	const data = useLoaderData<typeof loader>()
	useHydrateAtoms([[countAtom, data.count]]);
	const [count, setCount] = useAtom(countAtom);

	const onClick = () => setCount(prev => prev += 1);

	return (
		<main>
			<h1>Welcome to Remix</h1>
			<p>user data path: {data.userDataPath}</p>
			<p>hydrate count: {count}, <button onClick={onClick}>increment</button></p>
			<div>
				<pre>
					{JSON.stringify(data.versions, undefined, 2)}
				</pre>
			</div>
		</main>
	)
}
