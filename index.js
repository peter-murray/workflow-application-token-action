const core = require('@actions/core')
const githubApplication = require('./lib/github-application')
const github = require('@actions/github');
const fs = require('fs');

function fail(err, message) {
  core.error(err);

  if (message) {
    core.setFailed(message);
  } else {
    core.setFailed(err.message);
  }

  process.exit(1)
}

async function run() {
  let app;

  try {
    const privateKey = core.getInput('application_private_key', {required: true});
    const applicationId = core.getInput('application_id', {required: true});

    app = await githubApplication.create(privateKey, applicationId);
  } catch(err) {
    fail(err, 'Failed to initialize GitHub Application connection using provided id and private key');
  }

  core.info(`Found GitHub Application: ${app.name}`);
  const userSpecifiedOrganization = core.getInput('organization')
  const repository = process.env['GITHUB_REPOSITORY']
  const repoParts = repository.split('/')

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

  if (!installationId) {
    fail(null, 'No installation of the specified GitHub application was abel to be retrieved');
  }

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

  if (Object.keys(permissions).length > 0 || core.getBooleanInput('print')) {
    const accessToken = await app.getInstallationAccessToken(installationId, permissions);

    // We print what permissions are available
    if (!permissionInput) {
      fail(null, `Please specify permissions: ${accessToken.permissions}`)
    }

    // Register the secret to mask it in the output
    core.setSecret(accessToken.token);
    core.setOutput('token', accessToken.token);
    core.info(JSON.stringify(accessToken));
    core.info(`Successfully generated an access token for application.`);
  }

  // Check runs
  let cr = Object.fromEntries(
    ['check_run_id', 'head_sha', 'name', 'status', 'conclusion', 'details_url']
    .map(f => {
      value = core.getInput(f)
      return value === '' ? null : [f, value]
    }).filter(f => !!f)
  );
  cr.output = Object.fromEntries(
    ['title', 'summary', 'text']
    .map(f => {
      value = core.getInput(f)
      return value === '' ? null : [f, value]
    }).filter(f => !!f)
  );
  const file = core.getInput('file')
  if (file !== '') {
    try {
      cr.output.text = fs.readFileSync(file, 'utf8');
    } catch (err) {
      core.error(err);
    }
  }
  cr.owner = repoParts[0];
  cr.repo = repoParts[1];

  if (cr.check_run_id || cr.output.summary) {
    const crToken = await app.getInstallationAccessToken(installationId, {'checks': 'write'});
    const octokit = new github.getOctokit(crToken.token);

    const action = cr.check_run_id ? 'update' : 'create'
    check = await octokit.rest.checks[action](cr);
    core.info(`Check suite ${action}: ${check.data.id}`);
    core.setOutput('check_run_id', check.data.id);
  } else {
    core.info(`Skipped check suite.`);
  }
}
run().catch(fail)