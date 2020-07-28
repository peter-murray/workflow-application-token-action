const core = require('@actions/core')
  , githubApplication = require('./lib/github-application')
  ;

async function run() {
  const privateKey = getRequiredInputValue('application_private_key')
    , applicationId = getRequiredInputValue('application_id')
    ;

  try {
    const app = await githubApplication.create(privateKey, applicationId)
      , installation = getInstallation(app)
      , token = app.getInstallationAccessToken(installation.id)
    ;

    // Register the secret to mask it in the output
    core.setSecret(token);
    core.setOutput('token', token);

  } catch (err) {
    core.setFailed(err.message);
  }
}
run();

function getRequiredInputValue(key) {
  return core.getInput(key, {required: true});
}

async function getInstallation(app) {
  const repository = process.env['GITHUB_REPOSITORY']
    , repoParts = repository.split('/')
  ;

  return app.getRepositoryInstallation(repoParts[0], repoParts[1]);
}
