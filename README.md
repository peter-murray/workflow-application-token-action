# workflow-application-token-action

This is a GitHub Action that can be used to get scoped limited access, expiring credentials for use inside GitHub Actions
Workflows.

Why would you want to do this? Well the `GITHUB_TOKEN` whilst having an expiry, has some protections around creating
events that prevent downstream GitHub Actions workflow from triggering. This prevents recursive loops from workflows, but
there are a number of valid types of workflows that may require or desire triggering downstream GitHub Actions Workflows.

The existing way to work around this today is to use a Personal Access Token, but these tokens are tied to a user and
generally are over priviledged for the tasks at hand, increasing the risk if they get exposed and are not time limited
like the `GITHUB_TOKEN`.

This is where a GitHub Application access token can really help out. The benefits of GitHub Applications is that you can
restrict/scope the access of the token considerably more than what can be achieved using a Personal Access Token. The
access token from the GitHub Application is also time limited, expiring after an hour from being issued, providing some
more protection against any leaking of credentials from a Workflow.


## Usage
To use this action you first need a GitHub Application created so that you can request temporary credentials on behalf
of the application inside your workflows.

__Requirements:__
* A new or existing GitHub Application with the access scopes required
* A private key for the GitHub Application
* The GitHub Application installed on the repository that the GitHub Actions Workflow will execute from


### Creating a GitHub Application
You will need to have a GitHub Application that is scoped with the necessary permissions for the token that you want to
retrieve at runtime.

To create a GitHub Application you can follow the steps available at https://docs.github.com/en/developers/apps/creating-a-github-app

The important configuration details for the application are:
* `GitHub App name` a human readable application name that is unique within GitHub.com
* `Description` some details about your application and what you intend to use it for
* `Homepage URL` needs to be set to something as long as it is a URL
* `Expire user authorization tokens` should be checked so as to expire any tokens that are issued
* `Webhook` `Active` checkbox should be unchecked
* `Repository permissions`, `Organization permissions` and/or `User permissions` should be set to allow the access required for the token that will be issued
* `Where can this GitHub App be installed?` should be scoped to your desired audience (the current account, or any account)

Once the application has been created you will be taken to the `General` settings page for the new application.
The GitHub Application will be issued an `App ID` which you can see in the `About` section, take note of this for later
use in the Actions workflow.

On the `General` settings page for the application, at the bottom there is a `Private keys` section that you can use to
generate a private key that can be utilized to authenticate as the application.
Generate a new private key and store the information for later use.

_Note: the private keys can and should be rotated periodically to limit the risks of them being exposed in use._


### Install the GitHub Application
Once you have the GitHub Application defined, you will need to install the application on the target organization or repository/
repositories that you want it to have access to. These will be any repositories that you want to gather information
from or want the application to modify as per the scopes that were defined when the application was installed.

_Note: The GitHub Application will need to be installed on the organization and or repository that you are executing
the GitHub Actions workflow from, as the implementation requires this to be able to generate the access tokens_.


### Using the GitHub Action in a Workflow

To use the action in a workflow, it is recommended that you store the GitHub Application Private key in GitHub Secrets.
This can be done at a repository or organization level (provided that the actions workflow has access to the secret).

When storing the Private key, you can store the raw PEM encoded certificate contents that the GitHub Application
generates for you or Base64 encode it in the secret.

#### Parameters

* `application_id`: The GitHub Application ID that you wil be getting the access token for
* `application_private_key`: A private key generated for the GitHub Application so that you can authenticate (PEM format or base64 encoded)
* `permissions`: The optional limited permissions to request, specifying this allows you to request a subset of the permissions for the underlying GitHub Application. Defaults to all permissions available to the GitHub Application when not specified. Must be provided in a comma separated list of token permissions e.g. `issues:read, secrets:write, packages:read`
* `organization`: An optional organization name if the GitHub Application is installed at the Organization level (instead of the repository).
* `github_api_base_url`: An optional URL to the GitHub API, this will be read and loaded from the runner environment by default, but you might be bridging access to a secondary GHES instance or from GHES to GHEC, you can utilize this to make sure the Octokit library is talking to the right GitHub instance.
* `https_proxy`: An optional proxy to use for connecting with the GitHub instance. If the runner has `HTTP_PROXY` or `HTTPS_PROXY` specified as environment variables it will attempt to use those if this parameter is not specified.

#### Examples
Get a token with all the permissions of the GitHub Application:
```yaml

jobs:
  get-temp-token:
    runs-on: ubuntu-latest

    steps:
      - name: Get Token
        id: get_workflow_token
        uses: peter-murray/workflow-application-token-action@v1
        with:
          application_id: ${{ secrets.APPLICATION_ID }}
          application_private_key: ${{ secrets.APPLICATION_PRIVATE_KEY }}

      - name: Use Application Token to create a release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ steps.get_workflow_token.outputs.token }}
        with:
          ....
```

Get a token with a limited subset of the permissions of the Github Application, in this case just the `actions:write` permission:
```yaml

jobs:
  get-temp-token:
    runs-on: ubuntu-latest

    steps:
      - name: Get Token
        id: get_workflow_token
        uses: peter-murray/workflow-application-token-action@v1
        with:
          application_id: ${{ secrets.APPLICATION_ID }}
          application_private_key: ${{ secrets.APPLICATION_PRIVATE_KEY }}
          permissions: "actions:write"

      - name: Use Application Token to create a release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ steps.get_workflow_token.outputs.token }}
        with:
          ....
```

Get a token with all the permissions of the Github Application that is installed on an organization:
```yaml

jobs:
  get-temp-token:
    runs-on: ubuntu-latest

    steps:
      - name: Get Token
        id: get_workflow_token
        uses: peter-murray/workflow-application-token-action@v1
        with:
          application_id: ${{ secrets.APPLICATION_ID }}
          application_private_key: ${{ secrets.APPLICATION_PRIVATE_KEY }}
          organization: octodemo

      - name: Use Application Token to create a release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ steps.get_workflow_token.outputs.token }}
        with:
          ....
```
### Proxy

You can specify a proxy server directory using the `https_proxy` parameter in your `with` settings, or by falling back to 
using any environment variables used to provide a proxy reference; `HTTP_PROXY` or `HTTPS_PROXY` (or lowercase variants e.g. `http_proxy`).
If defined, the request will use the proxy to route the connection to the GitHub instance.  

```yaml

jobs:
  get-temp-token:
    runs-on: ubuntu-latest

    steps:
      - name: Get Token
        id: get_workflow_token
        uses: peter-murray/workflow-application-token-action@v1
        with:
          application_id: ${{ secrets.APPLICATION_ID }}
          application_private_key: ${{ secrets.APPLICATION_PRIVATE_KEY }}
          organization: octodemo
          https_proxy: http://my-squid-proxy:3128
          ....
```

### References
https://docs.github.com/en/developers/apps/authenticating-with-github-apps#authenticating-as-an-installation
