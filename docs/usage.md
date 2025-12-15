# Usage

## Installation & Setup

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Create a `config.json` file in the root directory. See `actions.md` for configuration details.

## Running the Server

Start the server using node:

```bash
node src/server.js
```

The server listens on port `25820` by default.

## Configuration

The system is driven by `config.json`. This file defines an "Action Tree" that routes requests to specific actions.

Example `config.json`:

```json
{
    "action": "route",
    "routes": {
        "update": {
            "action": "route",
            "routes": {
                "@": {
                    "action": "run",
                    "command": "$self/update.sh",
                    "token": "secret-token"
                }
            }
        },
        "hello": {
            "action": "respond",
            "body": "Hello World!"
        }
    }
}
```

## Making Requests

### Update Endpoint

To trigger an update (based on the example config above):

```bash
curl -X POST http://localhost:25820/update \
     -H "Authorization: Bearer secret-token"
```

### Static Response

To get a static response:

```bash
curl http://localhost:25820/hello
```

### Delegation

If you have a `delegate` action configured:

```json
"api": {
    "action": "delegate",
    "target": "http://localhost:3000"
}
```

Requesting `http://localhost:25820/api/users` will forward the request to `http://localhost:3000/api/users`.
