import { simpleGetPhoto } from './remote';

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
				},
			);
		const photo = await simpleGetPhoto(photoId);
		return Response.json(photo);
	},
} satisfies ExportedHandler<Env>;
