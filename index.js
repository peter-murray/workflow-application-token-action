const core = require('@actions/core')
  , githubApplication = require('./lib/github-application')
  ;

async function run() {
  const privateKey = getRequiredInputValue('application_private_key')
    , applicationId = getRequiredInputValue('application_id')
    ;

  let app;
  try {
    app = await githubApplication.create(privateKey, applicationId);
  } catch(err) {
    fail(err, 'Failed to initialize GitHub Application connection using provided id and private key');
  }

  try {
    const repository = process.env['GITHUB_REPOSITORY']
      , repoParts = repository.split('/')
    ;

    const installation = app.getRepositoryInstallation(repoParts[0], repoParts[1]);
    if (installation && installation.id) {
      const token = app.getInstallationAccessToken(installation.id);

      // Register the secret to mask it in the output
      core.setSecret(token);
      core.setOutput('token', token);
    } else {
      fail(null, `GitHub Application is not installed on repository: ${repository}`);
    }
  } catch (err) {
    fail(err);
  }
}
run();

function fail(err, message) {
  // core.error(err);
  if (message) {
    core.setFailed(message);
  } else {
    core.setFailed(err.message);
  }
}

function getRequiredInputValue(key) {
  return core.getInput(key, {required: true});
}
