# Terminology

This is a list of terminology used in the API system.

- `Action`: An action is a layer of "what to do" defined in the `config.json` file. An action takes arguments and returns a result. Actions can be nested within other actions, forming a tree structure called the `Action Tree`.
- `Active Domain`: A special parameter that is passed along to the action tree. For instance, the endpoint `api.norb.space/update/neutronic`, when matched against the root-level action, has the active domain of `update/neutronic`; and when routed to the `update` sub-ruleset obtains an active domain of `neutronic`, and so on.