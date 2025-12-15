# Shell

The api system can be configured to run shell commands remotely, for use with CI/CD or other automation tasks.

Variables are provided to the shell environment for use in scripts:
- `$self`: The file path to the git repo, on the remote machine.
