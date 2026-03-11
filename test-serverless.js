const { handler } = require('./netlify/functions/api');

async function test() {
    console.log("Starting handler test...");
    try {
        const response = await handler({
            path: '/.netlify/functions/api/api/settings',
            httpMethod: 'GET',
            headers: { host: 'localhost:8888' },
            queryStringParameters: {},
            body: ''
        }, {});
        console.log("Response:", response.statusCode);
        console.log("Body:", response.body);
    } catch (e) {
        console.error("Crash:", e);
    }
}

test();
