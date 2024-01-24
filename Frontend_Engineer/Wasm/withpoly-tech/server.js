const http = require('http');
const url = require('url');
const wasmModule = require('./fibonacci/pkg/fibonacci');

// Ensure host port provided
const PORT = process.argv[2];
if (PORT === undefined) {
    throw new Error("PORT is not defined");
}

// If remote port not provided then its a server
const REMOTE_PORT = process.argv[3];
let REMOTE_SERVER = undefined;
if (REMOTE_PORT !== undefined) {
    REMOTE_SERVER = `http://localhost:${REMOTE_PORT}`;
}

/**
 * Converts a query object into a query string
 */
const queryToString = (query) => {
    return `?${Object.keys(query).map((key) => `${key}=${query[key]}`).join("&")}`
}

/**
 * Offload allows you to, depending on the prescense of a query flag, defer the calculation to a remote server
 * @param {*} req The original web request, used to get path/query information
 * @param {*} calculation A function to do the actual WASM calcuation, takes in query params as an argument if needed
 * @param {Optional} shouldOffload Function that takes in query params and based on them/additional calculations, determines
 * if the calculation should be offloaded to the remote server
 * @returns 
 */
const offload = (req, calculation, shouldOffload) => {
    const urlData = url.parse(req.url, true);
    const queryParams = urlData.query;

    return new Promise((resolve, reject) => {
        const flag = parseInt(queryParams.offload);
        const isLocal = (shouldOffload && !shouldOffload(queryParams)) || flag === 0;

        const computeLocally = () => {
            resolve({ value: calculation(queryParams) });
            console.log(`computed locally: ${PORT}`);
        }

        // If the computation should be done locally or if the REMOTE_SERVER is not defined
        if (isLocal || REMOTE_SERVER === undefined) {

            computeLocally();

        } else if (REMOTE_SERVER) {

            // Make a request to the remote server for the same computation
            http.get(`${REMOTE_SERVER}${urlData.pathname}${queryToString({
                ...queryParams,
                offload: 0
            })}`, (res) => {
                const { statusCode } = res;
                if (statusCode !== 200) {
                    console.error("remote server error, using local compute instead");
                    computeLocally();
                    res.resume();
                    return;
                }

                // Handle a JSON response in the even the remote server didn't error
                let data = '';
                res.setEncoding('utf-8');
                res.on('data', (chunk) => {
                    data += chunk
                });
                res.on('end', () => {
                    console.log(`response received for ${urlData.pathname}`);
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        console.error("remote json parse error, using local compute instead");
                        computeLocally();
                    }
                })

                res.on('error', (err) => {
                    console.error("remote response parse error, using local compute instead");
                    computeLocally();
                })
            }).on('error', (err) =>{
                console.error("remote server error, using local compute instead");
                computeLocally();
            
            })
        }
    });
}

/**
 * Basic http server
 */
const server = http.createServer(async (req, res) => {
    const path = url.parse(req.url, true).pathname;
    
    switch (path) {
        case '/getData':
            console.log(`request received for ${path}`);

            const simpleCompute = (params) => {
                return wasmModule.fib(30);
            }

            // High compute calculation
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await offload(req, simpleCompute)));

            break;

        case '/getBiggerData':
            console.log(`request received for ${path}`);

            // Even higher compute calculation

            const biggerCompute = (params) => {
                const n = parseInt(params['n']);
                return wasmModule.fib(n);
            }

            // This calculation will be offloaded to remote server if the query param n is greater than 32
            const shouldOffload = (params) => {
                return parseInt(params['n']) > 32;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await offload(req, biggerCompute, shouldOffload)));
            break;
        default:
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end("{}");
            break;
    }
});

server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT);