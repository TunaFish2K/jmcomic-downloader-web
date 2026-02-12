import './App.css';
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { PDFDocument } from 'pdf-lib';
import { useState } from 'react';
import pLimit from 'p-limit';
import { Zip, AsyncZipDeflate } from 'fflate';

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

async function downloadPhoto(
	photo: Awaited<ReturnType<typeof getPhoto>>,
	onProgress?: (done: number, left: number, total: number) => void,
) {
	const total = photo.images.length;
	let done = 0;

	const limit = pLimit(10);

	const tasks = photo.images.map((imgData) =>
		limit(async () => {
			try {
				const img = new Image();
				img.crossOrigin = 'anonymous';
				img.src = imgData.url;
				await img.decode();
				return { ...imgData, data: img };
			} catch (e) {
				console.error(e, imgData.name, imgData.url);
				return { ...imgData, data: null };
			} finally {
				done += 1;
				onProgress?.(done, total - done, total);
			}
		}),
	);

	const results = await Promise.all(tasks);
	const images = results.filter((v) => v.data !== null);

	return { ...photo, images };
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

async function downloadZipStream(
	photo: Awaited<ReturnType<typeof downloadPhoto>>,
	filename: string,
	onProgress?: (done: number, total: number) => void,
) {
	return new Promise<void>((resolve, reject) => {
		const chunks: Uint8Array[] = [];

		const zip = new Zip((err, data, final) => {
			if (err) {
				reject(err);
				return;
			}
			chunks.push(data);
			if (final) {
				const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
				const result = new Uint8Array(totalLength);
				let offset = 0;
				for (const chunk of chunks) {
					result.set(chunk, offset);
					offset += chunk.length;
				}

				// 根据文件扩展名设置正确的 MIME 类型
				const mimeType = filename.endsWith('.cbz') ? 'application/octet-stream' : 'application/zip';
				const blob = new Blob([result], { type: mimeType });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = filename;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);

				resolve();
			}
		});

		(async () => {
			try {
				let processed = 0;
				const total = photo.images.length;
				const filenameSize = total.toString().length;

				for (const image of photo.images) {
					const sliceCount = getSliceCount(photo.scrambleId, photo.id, image.name);
					const decoded = reverseImageSlices(await createImageBitmap(image.data!), sliceCount);
					const jpgBuffer = await bitmapToJpgBuffer(decoded as ImageBitmap, 1.0);

					const file = new AsyncZipDeflate(`${processed}`.padStart(filenameSize, '0') + '.jpg', { level: 6 });
					zip.add(file);
					file.push(jpgBuffer, true);

					processed++;
					onProgress?.(processed, total);
				}

				zip.end();
			} catch (err) {
				reject(err);
			}
		})();
	});
}

async function downloadPDF(
	photo: Awaited<ReturnType<typeof downloadPhoto>>,
	filename: string,
	onProgress?: (done: number, total: number) => void,
) {
	const pdfDocument = await PDFDocument.create();
	let processed = 0;
	const total = photo.images.length;

	for (const image of photo.images) {
		const sliceCount = getSliceCount(photo.scrambleId, photo.id, image.name);
		const decoded = reverseImageSlices(await createImageBitmap(image.data!), sliceCount);
		const bitmap = decoded as ImageBitmap;

		const page = pdfDocument.addPage([bitmap.width, bitmap.height]);
		const pdfImage = await pdfDocument.embedJpg(await bitmapToJpgBuffer(bitmap));
		page.drawImage(pdfImage, { x: 0, y: 0, width: bitmap.width, height: bitmap.height });

		processed++;
		onProgress?.(processed, total);
	}

	const pdfBytes = await pdfDocument.save();
	const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

function App() {
	const [photoId, setPhotoId] = useState('');
	const [queryingPhotoData, setQueryingPhotoData] = useState(false);
	const [photoData, setPhotoData] = useState<Awaited<ReturnType<typeof getPhoto>> | null>(null);
	const [downloadingPhoto, setDownloadingPhoto] = useState(false);
	const [downloadingProgress, setDownloadingProgress] = useState(0);
	const [packingProgress, setPackingProgress] = useState(0);

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
		setPackingProgress(0);
		try {
			const downloaded = await downloadPhoto(photoData!, (done) => {
				setDownloadingProgress(done);
			});

			setPackingProgress(0);

			if (outputFormat === 'pdf') {
				await downloadPDF(downloaded, `${photoData!.name}.pdf`, (done) => {
					setPackingProgress(done);
				});
			} else if (outputFormat === 'cbz') {
				await downloadZipStream(downloaded, `${photoData!.name}.cbz`, (done) => {
					setPackingProgress(done);
				});
			} else {
				await downloadZipStream(downloaded, `${photoData!.name}.zip`, (done) => {
					setPackingProgress(done);
				});
			}
		} catch (e) {
			console.error((e as Error).stack ?? (e as Error).message ?? e);
			alert('下载失败：' + ((e as Error).message ?? e));
		} finally {
			setDownloadingPhoto(false);
			setDownloadingProgress(0);
			setPackingProgress(0);
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
							{downloadingProgress >= photoData.images.length && (
								<span>
									打包进度：{packingProgress} / {photoData.images.length}
								</span>
							)}
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
