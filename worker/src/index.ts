import { createHash } from 'node:crypto';

const SECRET = '18comicAPP';
const SECRET_CONTENT = '18comicAPPContent';

function getTimestampSeconds() {
	return Math.floor(Date.now() / 1000);
}

function getToken(timestampSeconds: number, secret: string) {
	return createHash('md5').update(timestampSeconds.toString()).update(secret).digest().toString('hex');
}

function getTokenParam(timestampSeconds: number, version: string) {
	return `${timestampSeconds.toString()},${version}`;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response('Hello World!');
	},
} satisfies ExportedHandler<Env>;
