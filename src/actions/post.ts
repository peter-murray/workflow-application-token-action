import * as core from '@actions/core';
import {revokeAccessToken} from '../github-application.js';

async function revokeToken() {
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
      const ignoreProxy = core.getBooleanInput('ignore_environment_proxy');

      const revoked = await revokeAccessToken(token, baseUrl, proxy, ignoreProxy);
      if (revoked) {
        core.info(`  token has been revoked.`);
      } else {
        throw new Error('Failed to revoke the application token, see logs for more information.');
      }
    } else {
      core.info(`GitHub Application revocation in post action step was skipped. Token will expired based on time set on the token.`);
    }
  } catch (err: any) {
    core.setFailed(`Failed to revoke GitHub Application token; ${err.message}`);
  }
}

revokeToken();
