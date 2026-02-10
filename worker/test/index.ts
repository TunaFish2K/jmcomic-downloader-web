import {
	DOMAIN_SERVER_URL,
	getClientData,
	getCookieHeader,
	getDomains,
	getPhotoData,
	getScrambleId,
	getTimestampSeconds,
	getToken,
	getTokenParam,
	SECRET,
	SECRET_APP_DATA,
	SECRET_CONTENT,
	SECRET_DOMAIN_SERVER,
	simpleGetPhoto,
} from '../src/remote';

async function test() {
	const timestampSeconds = getTimestampSeconds();

	const baseURL = 'https://' + (await getDomains(DOMAIN_SERVER_URL[0], SECRET_DOMAIN_SERVER))![0];
	console.log(baseURL);

	const clientData = await getClientData(
		baseURL,
		getToken(timestampSeconds, SECRET),
		getTokenParam(timestampSeconds, '2.0.16'),
		getToken(timestampSeconds, SECRET_APP_DATA),
	);
	console.log(clientData);
	const cookie = getCookieHeader(clientData.cookies);

	const photoData = await getPhotoData(
		baseURL,
		'1235125',
		{
			token: getToken(timestampSeconds, SECRET),
			tokenParam: getTokenParam(timestampSeconds, clientData.version),
			cookie,
		},
		getToken(timestampSeconds, SECRET_APP_DATA),
	);
	console.log(photoData);

	const scrambleId = await getScrambleId(baseURL, '1235125', {
		appContentToken: getToken(timestampSeconds, SECRET_CONTENT),
		tokenParam: getTokenParam(timestampSeconds, clientData.version),
		cookie,
		timestampSeconds,
	});
	console.log(scrambleId);

	console.log(await simpleGetPhoto('1235125'));
	// invalid?
	console.log(await simpleGetPhoto('9090999909'));
}

test().catch((e) => console.error(e));
