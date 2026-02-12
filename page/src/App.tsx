import './App.css';
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { PDFDocument } from 'pdf-lib';
import { useState } from 'react';
import { zipSync } from 'fflate';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

async function getPhoto(id: string) {
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

function createEmptyBitmap() {
	const canvas = new OffscreenCanvas(1, 1);
	canvas.getContext('2d');
	return canvas.transferToImageBitmap();
}

async function downloadPhoto(
	photo: Awaited<ReturnType<typeof getPhoto>>,
	onProgress?: (done: number, left: number, total: number) => void,
) {
	const total = photo.images.length;
	let done = 0;
	const images = await Promise.all(
		photo.images.map(async (imgData) => ({
			...imgData,
			data: await (async () => {
				if (imgData.name.endsWith('.gif')) return createEmptyBitmap();
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.src = imgData.url;
				await img.decode();
				done += 1;
				if (onProgress) onProgress(done, total - done, total);
				return img;
			})(),
		})),
	);
	return {
		...photo,
		images,
	};
}

const SCRAMBLE_268850 = 268850;
const SCRAMBLE_421926 = 421926;

function getSliceCount(scrambleId: number, photoId: number, filename: string): number {
	if (photoId < scrambleId) return 0;
	if (filename.endsWith('.gif')) return 0;
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

	const over = height % sliceCount;
	for (let i = 0; i < sliceCount; i++) {
		const move = Math.floor(height / sliceCount);
		const sY = height - move * (i + 1) - over;
		let dY = move * i;
		let sliceHeight = move;

		if (i === 0) {
			sliceHeight += over;
		} else {
			dY += over;
		}

		ctx.drawImage(bitmap, 0, sY, width, sliceHeight, 0, dY, width, sliceHeight);
	}
	return canvas;
}

async function generatePDF(images: ImageBitmap[]) {
	const pdfDocument = await PDFDocument.create();
	for (const image of images) {
		const page = pdfDocument.addPage([image.width, image.height]);
		const pdfImage = await pdfDocument.embedJpg(await bitmapToJpgBuffer(image));
		page.drawImage(pdfImage, { x: 0, y: 0, width: image.width, height: image.height });
	}
	return pdfDocument;
}

async function bitmapToJpgBuffer(bitmap: ImageBitmap, quality = 1): Promise<Uint8Array> {
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = canvas.getContext('2d');

	if (!ctx) throw new Error('无法创建 Canvas 上下文');

	ctx.drawImage(bitmap, 0, 0);

	const blob = await canvas.convertToBlob({
		type: 'image/jpeg',
		quality: quality,
	});

	const buffer = await blob.arrayBuffer();
	return new Uint8Array(buffer);
}

async function getDecodedImages(photo: Awaited<ReturnType<typeof downloadPhoto>>) {
	const decodedImages: ImageBitmap[] = [];
	for (const image of photo.images) {
		const sliceCount = getSliceCount(photo.scrambleId, photo.id, image.name);
		const decoded = reverseImageSlices(await createImageBitmap(image.data), sliceCount);
		decodedImages.push(decoded as ImageBitmap);
	}
	return decodedImages;
}

async function getPDFFromPhoto(photo: Awaited<ReturnType<typeof downloadPhoto>>) {
	const decodedImages = await getDecodedImages(photo);
	const pdf = await generatePDF(decodedImages);
	return pdf;
}

function downloadUint8Array(data: Uint8Array, fileName: string, mimeType: string) {
	const blob = new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

async function generateZip(images: ImageBitmap[]) {
	const zipFile = zipSync(
		Object.fromEntries(await Promise.all(images.map(async (v, idx) => [`${idx}`.padStart(3) + '.jpg', await bitmapToJpgBuffer(v, 1.0)]))),
	);
	return zipFile;
}

function App() {
	const [photoId, setPhotoId] = useState('');
	const [queryingPhotoData, setQueryingPhotoData] = useState(false);
	const [photoData, setPhotoData] = useState<Awaited<ReturnType<typeof getPhoto>> | null>(null);
	const [downloadingPhoto, setDownloadingPhoto] = useState(false);
	const [downloadingProgress, setDownloadingProgress] = useState(0);

	const [outputFormat, setOutputFormat] = useState<'zip' | 'pdf' | 'cbz'>('pdf');

	const canOperate = !downloadingPhoto && !queryingPhotoData;

	async function queryPhotoDataHandler() {
		setQueryingPhotoData(true);
		try {
			setPhotoData(await getPhoto(photoId.trim()));
		} catch (e) {
			console.error((e as Error).stack ?? (e as Error).message ?? e);
			alert('获取失败：' + ((e as Error).message ?? e));
		} finally {
			setQueryingPhotoData(false);
		}
	}

	async function downloadPhotoHandler() {
		setDownloadingPhoto(true);
		setDownloadingProgress(0);
		try {
			const downloaded = await downloadPhoto(photoData!, (done) => {
				setDownloadingProgress(done);
			});
			let data: Uint8Array;
			let mimeType: string;
			if (outputFormat === 'pdf') {
				data = await (await getPDFFromPhoto(downloaded)).save();
				mimeType = 'application/pdf';
			} else {
				data = await generateZip(await getDecodedImages(downloaded));
				mimeType = outputFormat === 'cbz' ? 'application/x-cbz' : 'application/zip';
			}

			downloadUint8Array(data, `${photoData!.name}.${outputFormat}`, mimeType);
		} catch (e) {
			console.error((e as Error).stack ?? (e as Error).message ?? e);
			alert('下载失败：' + ((e as Error).message ?? e));
		} finally {
			setDownloadingPhoto(false);
		}
	}

	return (
		<>
			<form className="card">
				查询本子
				<label>
					车牌号：
					<input name="id" type="" onChange={(ev) => setPhotoId(ev.target.value)} disabled={!canOperate} />
				</label>
				<button
					type="submit"
					onClick={(ev) => {
						ev.preventDefault();
						queryPhotoDataHandler();
					}}
					disabled={!canOperate}
				>
					查询
				</button>
			</form>
			{photoData !== null && (
				<form className="card">
					<span>车牌号： {photoData!.id}</span>
					<span>标题: {photoData!.name}</span>
					<div className="format">
						<label>格式：</label>
						<label>
							<input
								type="radio"
								name="format"
								value="pdf"
								checked={outputFormat === 'pdf'}
								onChange={(v) => v.target.checked && setOutputFormat('pdf')}
							></input>
							pdf
						</label>
						<label>
							<input
								type="radio"
								name="format"
								value="zip"
								checked={outputFormat === 'zip'}
								onChange={(v) => v.target.checked && setOutputFormat('zip')}
							></input>
							zip
						</label>
						<label>
							<input
								type="radio"
								name="format"
								value="zip"
								checked={outputFormat === 'cbz'}
								onChange={(v) => v.target.checked && setOutputFormat('cbz')}
							></input>
							cbz
						</label>
					</div>
					<button type="submit" onClick={() => downloadPhotoHandler()} disabled={!canOperate}>
						下载
					</button>
					{downloadingPhoto && (
						<div className="card progress">
							<span>
								下载进度：{downloadingProgress} / {photoData.images.length}
							</span>
							<span>{downloadingProgress >= photoData.images.length && '解密并打包中...'}</span>
						</div>
					)}
				</form>
			)}

			<div className="card">
				<span>不计划支持下载带有动图的本子，动图会被删除。</span>
				<span>本服务不做图片资源中转。图片一般不会被墙，如果出现错误建议等会重试，基本都是上游图片CDN的暂时问题。</span>
				<span>
					Github: <a href="https://github.com/TunaFish2K/jmcomic-downloader-web">前往</a>
				</span>
			</div>
		</>
	);
}

export default App;
