const core = require('@actions/core')
  , githubApplication = require('./lib/github-application')
  ;

async function revokeToken() {
  try {
    const revokeToken = core.getBooleanInput('revoke_token');
    if (revokeToken) {
      core.info(`GitHub Application token revocation being performed...`);

      const baseUrl = core.getInput('github_api_base_url');
      const proxy = core.getInput('https_proxy')
      const token = core.getState('token');

      const revoked = await githubApplication.revokeAccessToken(token, baseUrl, proxy);
      if (revoked) {
        core.info(`  token has been revoked.`)
      } else {
        throw new Error('Failed to revoke the application token, see logs for more information.');
      }
    } else {
      core.info(`GitHub Application revocation in post action step was skipped. Token will expired based on time set on the token.`);
    }
  } catch (err) {
    core.setFailed(`Failed to revoke GitHub Application token; ${err.message}`);
  }
}

revokeToken();
