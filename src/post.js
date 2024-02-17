import * as core from '@actions/core';
import * as githubApplication from './lib/github-application.js';

async function runRevokeToken() {
  const token = core.getState('token');

  if (!token) {
    core.info(`There is no valid token stored in the action state, nothing to revoke.`);

    return;
  }

  try {
    const revokeToken = core.getBooleanInput('revoke_token');
    if (revokeToken) {
      core.info(`GitHub Application token revocation being performed...`);
      const baseUrl = core.getInput('github_api_base_url');
      const proxy = core.getInput('https_proxy');
      const revoked = await githubApplication.revokeAccessToken(token, baseUrl, proxy);
      if (revoked) {
        core.info(`  token has been revoked.`);
      } else {
        throw new Error('Failed to revoke the application token, see logs for more information.');
      }
    } else {
      core.info(
        `GitHub Application revocation in post action step was skipped. Token will expired based on time set on the token.`,
      );
    }
  } catch (error) {
    core.setFailed(`Failed to revoke GitHub Application token; ${error.message}`);
  }
}

await runRevokeToken();
