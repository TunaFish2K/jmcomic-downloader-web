import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';

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

const SCRAMBLE_268850 = 268850;
const SCRAMBLE_421926 = 421926;

function getSliceCount(scrambleId: number, photoId: number, filename: string): number {
	if (photoId < scrambleId) return 0;
	if (photoId < SCRAMBLE_268850) return 10;
	const hex = bytesToHex(md5(new TextEncoder().encode(`${photoId}${filename.split('.')[0]}`)));
	return (hex.charCodeAt(hex.length - 1) % (photoId < SCRAMBLE_421926 ? 10 : 8)) * 2 + 2;
}

function reverseImageSlices(bitmap: ImageBitmap, sliceCount: number) {
	if (sliceCount < 1) return bitmap;

	const { width, height } = bitmap;
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');

	if (!ctx) throw new Error('failed to get canvas context');

	const baseHeight = Math.floor(height / sliceCount);
	const remainder = height % sliceCount;

	for (let i = 0; i < sliceCount; i++) {
		let sliceHeightActual = baseHeight;
		if (i === 0) sliceHeightActual += remainder;
		const sY = height - i * baseHeight - sliceHeightActual;
		let dY = i * baseHeight;
		if (i > 0) dY += remainder;

		ctx.drawImage(bitmap, 0, sY, width, sliceHeightActual, 0, dY, width, sliceHeightActual);
	}

	return canvas;
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
