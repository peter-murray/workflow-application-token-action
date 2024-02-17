import * as core from '@actions/core';
import * as githubApplication from './lib/github-application.js';

async function run() {
  let app;

  try {
    const privateKey = getRequiredInputValue('application_private_key');
    const applicationId = getRequiredInputValue('application_id');
    const githubApiBaseUrl = core.getInput('github_api_base_url');
    const httpsProxy = core.getInput('https_proxy');
    app = await githubApplication.create(privateKey, applicationId, githubApiBaseUrl, undefined, httpsProxy);
  } catch (error) {
    fail(error, 'Failed to initialize GitHub Application connection using provided id and private key');
  }

  if (app) {
    core.info(`Found GitHub Application: ${app.name}`);

    try {
      const userSpecifiedOrganization = core.getInput('organization');
      const repository = process.env['GITHUB_REPOSITORY'];
      const repoParts = repository.split('/');
      let installationId;

      if (userSpecifiedOrganization) {
        core.info(`Obtaining application installation for organization: ${userSpecifiedOrganization}`);

        // use the organization specified to get the installation
        const installation = await app.getOrganizationInstallation(userSpecifiedOrganization);
        installationId =
          installation?.id ??
          fail(
            undefined,
            `GitHub Application is not installed on the specified organization: ${userSpecifiedOrganization}`,
          );
      } else {
        core.info(`Obtaining application installation for repository: ${repository}`);

        // fallback to getting a repository installation
        const installation = await app.getRepositoryInstallation(repoParts[0], repoParts[1]);
        installationId =
          installation?.id ?? fail(undefined, `GitHub Application is not installed on repository: ${repository}`);
      }

      if (installationId) {
        const permissions = {};

        // Build up the list of requested permissions
        const permissionInput = core.getInput('permissions');
        if (permissionInput) {
          for (const p of permissionInput.split(',')) {
            const [pName, pLevel] = p.split(':', 2);
            permissions[pName.trim()] = pLevel.trim();
          }
          core.info(`Requesting limitation on GitHub Application permissions to only: ${JSON.stringify(permissions)}`);
        }

        const accessToken = await app.getInstallationAccessToken(installationId, permissions);

        // Register the secret to mask it in the output
        core.setSecret(accessToken.token);
        core.setOutput('token', accessToken.token);
        core.info(JSON.stringify(accessToken));
        core.info(`Successfully generated an access token for application.`);

        if (core.getBooleanInput('revoke_token')) {
          // Store the token for post state invalidation of it once the job is complete
          core.saveState('token', accessToken.token);
        }
      } else {
        fail('No installation of the specified GitHub application was able to be retrieved.');
      }
    } catch (error) {
      fail(error);
    }
  }
}

await run();

function fail(error, message) {
  core.error(error);

  if (message) {
    core.setFailed(message);
  } else {
    core.setFailed(error.message);
  }
}

function getRequiredInputValue(key) {
  return core.getInput(key, { required: true });
}
