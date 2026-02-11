import { simpleGetPhoto } from './remote';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname.slice(1);
		const [photoId] = pathname.split('/');
		if (Number.isNaN(parseInt(photoId)))
			return Response.json(
				{
					message: 'pathname should be /${id}, where id is an integer',
				},
				{
					status: 400,
					statusText: 'Bad Request',
					headers: CORS_HEADERS,
				},
			);
		const photo = await simpleGetPhoto(photoId);
		if (photo === null)
			return Response.json(
				{
					message: 'photo not found',
				},
				{
					status: 404,
					statusText: 'Not Found',
					headers: CORS_HEADERS,
				},
			);
		return Response.json(photo, {
			headers: CORS_HEADERS,
		});
	},
} satisfies ExportedHandler<Env>;
