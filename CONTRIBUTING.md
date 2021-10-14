# Contributing

Thanks for your interest in contributing!

If your idea is a substantial change to how the action works, please [raise an issue](https://github.com/peter-murray/workflow-application-token-action/issues/new) to discuss before raising a pull request.

## Running the tests

The first thing to do is ensure that your tests run successfully:

- Create an application [as described in the README](https://github.com/peter-murray/workflow-application-token-action#creating-a-github-application)
- Create a file in your home folder named `.github_application` with the following contents (replacing the values with your own application):

```json
{
  "test": {
    "applicationId": 123456,
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nk3y_g03s_her3\n-----END RSA PRIVATE KEY-----\n",
    "repo": {
      "owner": "your-org-name",
      "repo": "your-repo-name"
    },
    "org": "your-org-name"
  }
}
```

> If you need to get your private key on a single line, run `awk -v ORS='\\n' '1' /path/to/key.pem`

- Run `npm install`
- Run `npm test`

You should see something similar to `15 passing (5s)` - if you see any failures, open an issue to resolve that **before** making any code changes.
