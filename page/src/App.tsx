import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

async function getPhoto(id: number) {
	const url = new URL(`/${id}`, BACKEND_URL);
	const res = await fetch(url);
	if (!res.ok) {
		let body;
		try {
			body = await res.json();
		} catch {
			body = null;
		}
		if (typeof body.message === 'string') throw new Error(body.message);
		throw new Error(`${res.status} ${res.statusText}`);
	}
	const body = (await res.json()) as {
		id: number;
		name: string;
		images: {
			name: string;
			url: string;
		}[];
		scrambleId: number;
	};
	return body;
}

function App() {
	const [count, setCount] = useState(0);

	return (
		<>
			<div>
				<a href="https://vite.dev" target="_blank">
					<img src={viteLogo} className="logo" alt="Vite logo" />
				</a>
				<a href="https://react.dev" target="_blank">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1>Vite + React</h1>
			<div className="card">
				<button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<p className="read-the-docs">Click on the Vite and React logos to learn more</p>
		</>
	);
}

export default App;
