import * as core from '@actions/core';
import {createApplication, GitHubApplication} from '../github-application.js';


async function run() {
  let app: GitHubApplication;

  try {
    const privateKey = getRequiredInputValue('application_private_key')
      , applicationId = getRequiredInputValue('application_id')
      , githubApiBaseUrl = core.getInput('github_api_base_url')
      , httpsProxy = core.getInput('https_proxy')
      , ignoreProxy = core.getBooleanInput('ignore_environment_proxy')
      ;
    app = await createApplication({
      privateKey,
      applicationId,
      baseApiUrl: githubApiBaseUrl,
      proxy: httpsProxy,
      ignoreEnvironmentProxy: ignoreProxy
    });
  } catch(err) {
    fail(err, 'Failed to initialize GitHub Application connection using provided id and private key');
    return;
  }

  if (app) {
    core.info(`Found GitHub Application: ${app.name}`);

    try {
      const userSpecifiedOrganization = core.getInput('organization');
      const repository = process.env['GITHUB_REPOSITORY'];

      if (!repository || repository.trim().length === 0) {
        throw new Error(`The repository value was missing from the environment as 'GITHUB_REPOSITORY'`);
      }

      const repoParts = repository.split('/');

      let installationId;

      if (userSpecifiedOrganization) {
        core.info(`Obtaining application installation for organization: ${userSpecifiedOrganization}`);

        // use the organization specified to get the installation
        const installation = await app.getOrganizationInstallation(userSpecifiedOrganization);
        if (installation && installation.id) {
          installationId = installation.id;
        } else {
          fail(undefined, `GitHub Application is not installed on the specified organization: ${userSpecifiedOrganization}`);
        }
      } else {
        core.info(`Obtaining application installation for repository: ${repository}`);

        // fallback to getting a repository installation
        const installation = await app.getRepositoryInstallation(repoParts[0], repoParts[1]);
        if (installation && installation.id) {
          installationId = installation.id;
        } else {
          fail(undefined, `GitHub Application is not installed on repository: ${repository}`);
        }
      }

      if (installationId) {
        const permissions = {};
        // Build up the list of requested permissions
        let permissionInput = core.getInput("permissions");
        if (permissionInput) {
          for (let p of permissionInput.split(",")){
            let [pName, pLevel] = p.split(":", 2);
            permissions[pName.trim()] = pLevel.trim();
          }
          core.info(`Requesting limitation on GitHub Application permissions to only: ${JSON.stringify(permissions)}`);
        }

        const accessToken = await app.getInstallationAccessToken(installationId, permissions);

        // Register the secret to mask it in the output
        core.setSecret(accessToken.token);
        core.setOutput('token', accessToken.token);
        core.info(JSON.stringify(accessToken));
        core.info(`Successfully generated an access token for application.`)

        if (core.getBooleanInput('revoke_token')) {
          // Store the token for post state invalidation of it once the job is complete
          core.saveState('token', accessToken.token);
        }
      } else {
        fail(undefined, 'No installation of the specified GitHub application was able to be retrieved.');
      }
    } catch (err) {
      fail(err);
    }
  }
}
run();

function fail(err: any, message?: string) {
  core.error(err);
  // Provide a debug controllable stack trace
  core.debug(err.stack);

  if (message) {
    core.setFailed(message);
  } else {
    core.setFailed(err.message);
  }
}

function getRequiredInputValue(key: string) {
  return core.getInput(key, {required: true});
}
