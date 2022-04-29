const core = require('@actions/core')
  , githubApplication = require('./lib/github-application')
  ;

async function run() {
  let app;

  try {
    const privateKey = getRequiredInputValue('application_private_key')
      , applicationId = getRequiredInputValue('application_id')
      , githubApiBaseUrl = core.getInput('github_api_base_url') || process.env['GITHUB_API_URL'] || 'https://api.github.com'
      ;
    app = await githubApplication.create(githubApiBaseUrl, privateKey, applicationId);
  } catch(err) {
    fail(err, 'Failed to initialize GitHub Application connection using provided id and private key');
  }

  if (app) {
    try {
      const repository = process.env['GITHUB_REPOSITORY']
        , repoParts = repository.split('/')
      ;
<<<<<<< HEAD
  
      const installation = await app.getRepositoryInstallation(repoParts[0], repoParts[1]);
      if (installation && installation.id) {
        const accessToken = await app.getInstallationAccessToken(installation.id);
  
=======

      let installationId;

      if (userSpecifiedOrganization) {
        core.info(`Obtaining application installation for organization: ${userSpecifiedOrganization}`);

        // use the organization specified to get the installation
        const installation = await app.getOrganizationInstallation(userSpecifiedOrganization);
        if (installation && installation.id) {
          installationId = installation.id;
        } else {
          fail(null, `GitHub Application is not installed on the specified organization: ${userSpecifiedOrganization}`);
        }
      } else {
        core.info(`Obtaining application installation for repository: ${repository}`);

        // fallback to getting a repository installation
        const installation = await app.getRepositoryInstallation(repoParts[0], repoParts[1]);
        if (installation && installation.id) {
          installationId = installation.id;
        } else {
          fail(null, `GitHub Application is not installed on repository: ${repository}`);
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

>>>>>>> 0004044... Adding ability to specify the Github API base URL
        // Register the secret to mask it in the output
        core.setSecret(accessToken.token);
        core.setOutput('token', accessToken.token);
        core.info(JSON.stringify(accessToken));
        core.info(`Successfully generated an access token for application.`)
      } else {
        fail(null, `GitHub Application is not installed on repository: ${repository}`);
      }
    } catch (err) {
      fail(err);
    }
  }
}
run();

function fail(err, message) {
<<<<<<< HEAD
  // core.error(err);
=======
  core.error(err);

>>>>>>> 0004044... Adding ability to specify the Github API base URL
  if (message) {
    core.setFailed(message);
  } else {
    core.setFailed(err.message);
  }
}

function getRequiredInputValue(key) {
  return core.getInput(key, {required: true});
}
