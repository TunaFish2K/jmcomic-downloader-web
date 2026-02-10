import { createDecipheriv, createHash } from 'node:crypto';
import parse, { parse as parseSetCookie } from 'set-cookie-parser';

const SECRET = '18comicAPP';
const SECRET_CONTENT = '18comicAPPContent';
const SECRET_APP_DATA = '185Hcomic3PAPP7R';
const SECRET_DOMAIN_SERVER = 'diosfjckwpqpdfjkvnqQjsik';

const DOMAIN_SERVER_URL = [
	'https://rup4a04-c01.tos-ap-southeast-1.bytepluses.com/newsvr-2025.txt',
	'https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt',
];

function getTimestampSeconds() {
	return Math.floor(Date.now() / 1000);
}

function getToken(timestampSeconds: number, secret: string) {
	return createHash('md5').update(timestampSeconds.toString()).update(secret).digest().toString('hex');
}

function getTokenParam(timestampSeconds: number, version: string) {
	return `${timestampSeconds.toString()},${version}`;
}

async function getVersionAndCookies(baseURL: string, token: string, tokenParam: string) {
	const url = new URL('/setting', baseURL);
	const res = await fetch(url, {
		headers: {
			token,
			tokenparam: tokenParam,
		},
	});
	const setCookie = res.headers.getSetCookie();
	const cookies = parseSetCookie(setCookie, {
		map: true,
	});
	const { version } = (await res.json()) as {
		version: string;
	};
	return {
		version,
		cookies,
	};
}

function getCookieHeader(cookies: parse.CookieMap) {
	const result: string[] = [];

	for (const [name, { value }] of Object.entries(cookies)) {
		result.push(`${name}=${value}`);
	}

	return result.join('; ');
}

function decodeResponseData(encodedData: string, appDataToken: string) {
	const decipher = createDecipheriv('aes-256-ecb', appDataToken, null);
	const decrypted = decipher.update(encodedData, 'base64', 'utf-8') + decipher.final('utf-8');
	return decrypted;
}

async function getDomain(domainServerURL: string, appDataToken: string) {
	const res = await fetch(domainServerURL);
	const encoded = await res.text();
	const decoded = decodeResponseData(encoded, appDataToken);
	const data = JSON.parse(decoded);
	if (typeof data.Server !== 'string') throw new Error(`domain not found, response data: ${decoded}`);
	return data.Server as string;
}

async function getPhotoData(
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
		},
	});
	const encoded = ((await res.json()) as { data: string }).data;
	const decoded = JSON.parse(decodeResponseData(encoded, appDataToken)) as {
		name: string;
		id: string;
		images: string[];
	};
	return decoded;
}

const REGEXP_SCRAMBLE_ID = /var scramble_id = (\d+);/;

async function getScrambleId(
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
		},
	});
	const text = await res.text();
	const matchResult = text.match(REGEXP_SCRAMBLE_ID);
	if (matchResult === null) throw new Error('scrambleId not found');
	return parseInt(matchResult[1]);
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response('Hello World!');
	},
} satisfies ExportedHandler<Env>;
