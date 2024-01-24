## Solution
- WASMEdge was giving me a lot of issues when trying to get it working in NodeJS
   - I think the WASM implementation for NodeJS is still rough around the edges so I decided to got with wasm-pack instead which has bindings for JS

### Approach towards WASM
- I made a simple wasm-pack rust program that calculates a fibonacci value
    - The code is located in `/fibonacci/src/lib.rs`
    - The WASM binary is located in `/fibonacci/pkg/fibonacci_bg.wasm`
    - The Rust WASM binary can be rebuilt with `npm run build`

My thought process was that, in order to have the same WASM file be useful on both the server an client side of things I thought it should replace some high intensity computation that would have to be done on either side.
I didn't feel like it was necessary to bundle any additional logic into the WASM, it may just end up overcomplicating the program. But if needed it could be done later

### Approach towards Web-server
Then on the server-side I used NodeJS and just the basic http server library built into node
   - All the code is located in `server.js`

The goal of the server is to run on both a local client and a remote 'more powerful' server. But the idea would be that the computations run on both otherwise are the same

My approach then was to have each server capable of doing work locally or sending it to a remote server, where you can technically chain the servers to each other over and over again
     ex: [] -> []
    - The final 'server' just doesn't have a remote host it points to. This way the code for each server is exactly the same

In order to configure the servers so they know who they can talk to, you pass in cli arguments while running the nodejs file
    - Ex: client: `node server.js 8000 8001` 
          server: `node server.js 8001`
      (In this case the client runs on port 8000 and points towards 8001 for remote, while the server runs on 8001 and has no remote)

To make this work I made an `offload` function, which depending on the presence of a query parameter `offload=1` flag, will either send the work to remote or do it locally. I also added the ability to determine whether to send the work to remote or do it locally using the `shouldOffload` function.

In my example code, for the `/getBiggerData` endpoint it will automatically offload the computation to the remote server in the event the fibonacci `n` is bigger than 32.

Other than that, the request that the server recieves looks identical to the request that the client would recieve with the only caveat being the defer flag being turned off. By default a server without a REMOTE_HOST will automatically do the computation locally.


### How to Test

- Both servers need to be running (the ports don't matter, the remote just has to match the second server port)
    - `node server.js 8000 8001`
    - `node server.js 8001`
    - You would make requests to the port 8000 server
    
- There are two endpoints implemented `/getData` and `/getBiggerData`
   - For `/getData` the offloading is handled by the query parameter offload
      - To see the calculation done remotely `/getData?offload=1`
      - To see it done locally `/getData?offload=0`
   - For `/getBiggerData` the offloading is done automaticaly based on the `n` query parameter
     - To see the calculation done remotely `/getData?n=34`
     - To see the calculation done locally `/getData?n=30`


## Question
- How does your client "ask" the server to run the computation? Is there a way to do this without duplicating your libary SDK as an API? For example, can it be invisible to the front-end developer as to "where" the computation is run?
    - Sends the same request to the server that the client recieved, the computation is designed to be invisible, you basically just call a function that returns the result (asynchronously) that is either locally computed or remotely computed

- How do you make the library non-blocking on the client?

    - I think asynchronous functions are non-blocking in javascript so it should be good. I can't multithread the computation in JS, I think the best that could be done may be using Workers so thats still one limitation

- What are the benefits and drawbacks of this way of separating compute between the client and server? Where is this a very good or very bad idea?

    - Good for very compute heavy operations that you'd rather not run on the users mystery hardware that could potentially be a chromebook. I think it could be a bad idea because you now have the ensure the user doesn't send any malicious workloads to your server that could potentially crash or hang the remote server

- How do you ensure consistency of your data in a scenario where the client and server are disconnected?
   - For the toy example code I wrote, I don't think that would be an issue but in the event that you'd want to do a lot more computation on the client/server that also tracks some data in between, my approach would be to create a data state that has a current version of the data sent over/calculated and then a timestamp that tracks when the calculations were last made. In the event the modifications on the local side are newer, it would prioritize those. Some computation might be lost, but otherwise resolving the differences between the two sets of data might get complicated.