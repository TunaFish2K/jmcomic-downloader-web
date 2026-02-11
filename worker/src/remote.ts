import { createDecipheriv, createHash } from 'node:crypto';
import parse, { parse as parseSetCookie } from 'set-cookie-parser';

export const SECRET = '18comicAPP';
export const SECRET_CONTENT = '18comicAPPContent';
export const SECRET_APP_DATA = '185Hcomic3PAPP7R';
export const SECRET_DOMAIN_SERVER = 'diosfjckwpqpdfjkvnqQjsik';

export const DOMAIN_SERVER_URL = [
	'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
	'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
];

export const HEADERS_API = {
	'Accept-Encoding': 'gzip, deflate',
	'user-agent':
		'Mozilla/5.0 (Linux; Android 9; V1938CT Build/PQ3A.190705.11211812; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36',
};

export function getTimestampSeconds() {
	return Math.floor(Date.now() / 1000);
}

export function getToken(timestampSeconds: number, secret: string) {
	return createHash('md5').update(timestampSeconds.toString()).update(secret).digest().toString('hex');
}

export function getTokenParam(timestampSeconds: number, version: string) {
	return `${timestampSeconds.toString()},${version}`;
}

export async function getClientData(baseURL: string, token: string, tokenParam: string, appDataToken: string) {
	const url = new URL('/setting', baseURL);
	const res = await fetch(url, {
		headers: {
			token,
			tokenparam: tokenParam,
			...HEADERS_API,
		},
	});
	const setCookie = res.headers.getSetCookie();
	const cookies = parseSetCookie(setCookie, {
		map: true,
	});
	const encoded = ((await res.json()) as { data: string }).data;
	const decoded = decodeResponseData(encoded, appDataToken);
	const { version, img_host: imageBaseURL } = JSON.parse(decoded) as {
		version: string;
		img_host: string;
	};
	return {
		version,
		cookies,
		imageBaseURL,
	};
}

export function getCookieHeader(cookies: parse.CookieMap) {
	const result: string[] = [];

	for (const [name, { value }] of Object.entries(cookies)) {
		result.push(`${name}=${value}`);
	}

	return result.join('; ');
}

export function decodeResponseData(encodedData: string, secret: string) {
	const decipher = createDecipheriv('aes-256-ecb', secret, Buffer.alloc(0));
	decipher.setAutoPadding(false);
	let decrypted = decipher.update(encodedData, 'base64', 'utf-8') + decipher.final('utf-8');
	const padLen = decrypted.charCodeAt(decrypted.length - 1);
	if (padLen && padLen <= 16) decrypted = decrypted.slice(0, -padLen);
	return decrypted;
}

export async function getDomains(domainServerURL: string, domainServerSecret: string) {
	const res = await fetch(domainServerURL, {
		headers: {
			...HEADERS_API,
		},
	});
	let encoded = await res.text();
	while (encoded && !encoded[0].match(/[0-9A-Za-z]/)) encoded = encoded.slice(1);
	const decoded = decodeResponseData(encoded, createHash('md5').update(domainServerSecret).digest().toString('hex'));
	const data = JSON.parse(decoded);
	return Array.isArray(data.Server) ? (data.Server as string[]) : null;
}

export async function getPhotoData(
	baseURL: string,
	id: string,
	{ token, tokenParam, cookie }: { token: string; tokenParam: string; cookie: string },
	appDataToken: string,
) {
	const url = new URL('/chapter', baseURL);
	url.searchParams.set('id', id);
	const res = await fetch(url, {
		headers: {
			cookie,
			token,
			tokenparam: tokenParam,
			...HEADERS_API,
		},
	});
	const encoded = ((await res.json()) as { data: string }).data;
	const decoded = JSON.parse(decodeResponseData(encoded, appDataToken)) as {
		name: string;
		id: string;
		images: string[];
	};
	if (decoded.name === null && decoded.images.length <= 0) return null;
	return decoded;
}

const REGEXP_SCRAMBLE_ID = /var scramble_id = (\d+);/;

export async function getScrambleId(
	baseURL: string,
	id: string,
	{
		appContentToken,
		tokenParam,
		cookie,
		timestampSeconds,
	}: {
		appContentToken: string;
		tokenParam: string;
		cookie: string;
		timestampSeconds: number;
	},
) {
	const url = new URL('/chapter_view_template', baseURL);
	url.searchParams.set('id', id);
	url.searchParams.set('mode', 'vertical');
	url.searchParams.set('page', String(0));
	url.searchParams.set('app_img_shunt', String(1));
	url.searchParams.set('express', 'off');
	url.searchParams.set('v', timestampSeconds.toString());
	const res = await fetch(url, {
		headers: {
			cookie,
			token: appContentToken,
			tokenparam: tokenParam,
			...HEADERS_API,
		},
	});
	const text = await res.text();
	const matchResult = text.match(REGEXP_SCRAMBLE_ID);
	if (matchResult === null) throw new Error('scrambleId not found');
	return parseInt(matchResult[1]);
}

export async function simpleGetPhoto(id: string) {
	const timestampSeconds = getTimestampSeconds();

	const baseURL = 'https://' + (await getDomains(DOMAIN_SERVER_URL[0], SECRET_DOMAIN_SERVER))![0];

	const clientData = await getClientData(
		baseURL,
		getToken(timestampSeconds, SECRET),
		getTokenParam(timestampSeconds, '2.0.16'),
		getToken(timestampSeconds, SECRET_APP_DATA),
	);
	const cookie = getCookieHeader(clientData.cookies);

	const photoData = await getPhotoData(
		baseURL,
		id,
		{
			token: getToken(timestampSeconds, SECRET),
			tokenParam: getTokenParam(timestampSeconds, clientData.version),
			cookie,
		},
		getToken(timestampSeconds, SECRET_APP_DATA),
	);

	if (photoData === null) return null;

	const scrambleId = await getScrambleId(baseURL, id, {
		appContentToken: getToken(timestampSeconds, SECRET_CONTENT),
		tokenParam: getTokenParam(timestampSeconds, clientData.version),
		cookie,
		timestampSeconds,
	});
	return {
		...photoData,
		images: photoData.images.map((name) => ({
			name,
			url: new URL(`/media/photos/${photoData.id}/${name}`, clientData.imageBaseURL).toString(),
		})),
		scrambleId,
	};
}
