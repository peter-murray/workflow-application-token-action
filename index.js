const core = require('@actions/core')
  , githubApplication = require('./lib/github-application')
  ;

async function run() {
  let app;

  try {
    const privateKey = getRequiredInputValue('application_private_key')
      , applicationId = getRequiredInputValue('application_id')
      ;
    app = await githubApplication.create(privateKey, applicationId);
  } catch(err) {
    fail(err, 'Failed to initialize GitHub Application connection using provided id and private key');
  }

  if (app) {
    try {  
      let installationId;
      const userSpecifiedOrganization = core.getInput('organization');

      if (userSpecifiedOrganization) {
        // use the organization specified to get the installation
        const installation = await app.getOrganizationInstallation(userSpecifiedOrganization);
        if (installation && installation.id) {
          installationId = installation.id;
        } else {
          fail(null, `GitHub Application is not installed on the specified organization: ${userSpecifiedOrganization}`);
        }
      } else {
        // fallback to getting a repository installation
        const repository = process.env['GITHUB_REPOSITORY']
          , repoParts = repository.split('/')
          ;
        installation = await app.getRepositoryInstallation(repoParts[0], repoParts[1]);
        if (installation && installation.id) {
          installationId = installation.id;
        } else {
          fail(null, `GitHub Application is not installed on repository: ${repository}`);
        }
      }
      
      if (installationId) {
        const accessToken = await app.getInstallationAccessToken(installationId);

        // Register the secret to mask it in the output
        core.setSecret(accessToken.token);
        core.setOutput('token', accessToken.token);
        core.info(JSON.stringify(accessToken));
        core.info(`Successfully generated an access token for application.`)
      } else {
        fail('No installation of the specified GitHub application was abel to be retrieved');
      }
    } catch (err) {
      fail(err);
    }
  }
}
run();

function fail(err, message) {
  core.error(err);
  
  if (message) {
    core.setFailed(message);
  } else {
    core.setFailed(err.message);
  }
}

function getRequiredInputValue(key) {
  return core.getInput(key, {required: true});
}
