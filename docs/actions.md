# Actions

Here is a list of all available actions in the config.json file.

- `run`: Executes a shell command on the server. Parameters:
    - `command` (string): The shell command to execute.
    - `args` (array, optional): An array of arguments to pass to the command. Defaults to empty array.
    - `token`: (string, optional): An authentication token to verify the request.
- `route`: Matches the active domain against multiple prefix strings, and routes to the first matching sub-action. Parameters:
    - `routes` (object): A mapping of prefix strings to sub-actions.
    - `use_regex`: (boolean, optional): If true, the object keys are treated as regular expressions instead of prefixes. Defaults to false.
    - Special route keys:
        - `@`: Matches an empty active domain (i.e. `/somePrefix` exactly).
        - `*`: Catch-all; matches any active domain and passes it through unchanged.
- `delegate`: Delegates the request to a web service. Parameters:
    - `target` (string): The URL of the web service to delegate to, for instance:
        - `localhost:8080/` (defaults to `http://`)
        - `http://localhost:8080/`
        - `https://api.example.com/endpoint`
    - `preserve_path` (boolean, optional): If true, appends the active domain to the target URL. Defaults to true.
- `respond`: Sends a static response. Parameters:
    - `status` (integer, optional): The HTTP status code to send. Defaults to 200.
    - `headers` (object, optional): A mapping of HTTP headers to include in the response.
    - `body` (string, optional): The body of the response.
