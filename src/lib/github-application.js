import * as core from '@actions/core';
import * as github from '@actions/github';
import jwt from 'jsonwebtoken';
import { PrivateKey } from './private-key.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { URL } from 'node:url';

export const create = async (privateKey, applicationId, baseApiUrl, timeout, proxy) => {
  const app = new GitHubApplication(privateKey, applicationId, baseApiUrl);
  await app.connect(timeout, proxy);

  return app;
};

export const revokeAccessToken = async (token, baseUrl, proxy) => {
  // The token being provided is the one to be invalidated
  const client = getOctokit(token, baseUrl, proxy);

  let response;
  try {
    response = await client.rest.apps.revokeInstallationAccessToken();
  } catch (error) {
    throw new Error(`Failed to revoke application token; ${error.message}`);
  }

  if (response.status === 204) {
    return true;
  }

  throw new Error(`Unexpected status code ${response.status}; ${response.data}`);
};

class GitHubApplication {
  constructor(privateKey, applicationId, baseApiUrl) {
    this._config = {
      privateKey: new PrivateKey(_validateVariableValue('privateKey', privateKey)),
      id: _validateVariableValue('applicationId', applicationId),
    };

    this._githubApiUrl = baseApiUrl;
    this._client = undefined;
  }

  async connect(validSeconds, proxy) {
    const secondsNow = Math.floor(Date.now() / 1000);
    const expireInSeconds = validSeconds || 60;

    const payload = {
      iat: secondsNow,
      exp: secondsNow + expireInSeconds,
      iss: this.id,
    };

    const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    this._client = getOctokit(token, this._githubApiUrl, proxy);

    let response;

    try {
      response = await this.client.request('GET /app', {
        mediaType: {
          previews: ['machine-man'],
        },
      });
    } catch (error) {
      throw new Error(`Failed to connect as application; status code: ${error.status}\n${error.message}`);
    }

    if (response.status === 200) {
      // Store the metadata for debug purposes
      this._metadata = response.data;

      return response.data;
    } else {
      throw new Error(`Failed to load application with id:${this.id}; ${response.data}`);
    }
  }

  get githubApiBaseUrl() {
    return this._githubApiUrl;
  }

  get metadata() {
    return this._metadata;
  }

  get client() {
    const client = this._client;
    if (!client) {
      throw new Error('Application has not been initialized correctly, call connect() to connect to GitHub first.');
    }

    return client;
  }

  get privateKey() {
    return this._config.privateKey.key;
  }

  get id() {
    return this._config.id;
  }

  get name() {
    return this._metadata.name;
  }

  async getApplicationInstallations() {
    let response;
    try {
      response = await this.client.request('GET /app/installations', {
        mediaType: {
          previews: ['machine-man'],
        },
      });

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Unexpected status code ${response.status}; ${response.data}`);
      }
    } catch (error) {
      throw new Error(`Failed to get application installations; ${error.message}`);
    }
  }

  async getRepositoryInstallation(owner, repo) {
    let response;

    try {
      response = await this.client.rest.apps.getRepoInstallation({
        owner,
        repo,
      });
    } catch (error) {
      throw new Error(`Failed to resolve installation of application on repository ${owner}/${repo}; ${error.message}`);
    }

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Unexpected status code ${response.status}; ${response.data}`);
    }
  }

  async getOrganizationInstallation(org) {
    let response;
    try {
      response = await this.client.rest.apps.getOrgInstallation({
        org,
      });
    } catch (error) {
      throw new Error(`Failed to resolve installation of application on organization ${org}; ${error.message}`);
    }

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Unexpected status code ${response.status}; ${response.data}`);
    }
  }

  async getInstallationAccessToken(installationId, permissions) {
    if (!installationId) {
      throw new Error('GitHub Application installation id must be provided');
    }

    permissions = permissions || {};
    const additional = {};
    if (Object.keys(permissions).length > 0) {
      additional.permissions = permissions;
    }

    let response;

    try {
      response = await this.client.request(`POST /app/installations/${installationId}/access_tokens`, {
        mediaType: {
          previews: ['machine-man'],
        },
        ...additional,
      });
    } catch (error) {
      throw new Error(`Failed to get access token for application installation; ${error.message}`);
    }

    if (response.status === 201) {
      return response.data;
    }

    throw new Error(`Unexpected status code ${response.status}; ${response.data}`);
  }
}

function getOctokit(token, baseApiUrl, proxy) {
  const baseUrl = getApiBaseUrl(baseApiUrl);

  const octokitOptions = {
    baseUrl,
  };

  const request = {
    agent: getProxyAgent(proxy, baseUrl),
    timeout: 5000,
  };

  octokitOptions.request = request;
  const client = new github.getOctokit(token, octokitOptions);

  return client;
}

function _validateVariableValue(variableName, value) {
  if (!value) {
    throw new Error(`A valid ${variableName} must be provided, was "${value}"`);
  }

  const result = `${value}`.trim();
  if (result.length === 0) {
    throw new Error(`${variableName} must be provided contained no valid characters other than whitespace`);
  }

  return result;
}

function getProxyAgent(proxy, baseUrl) {
  if (proxy) {
    // User has an explict proxy set, use it
    core.info(`explicit proxy specified as '${proxy}'`);

    return new HttpsProxyAgent(proxy);
  } else {
    // When loading from the environment, also respect no_proxy settings
    const environmentProxy =
      process.env.http_proxy || process.env.HTTP_PROXY || process.env.https_proxy || process.env.HTTPS_PROXY;
    if (environmentProxy) {
      core.info(`environment proxy specified as '${environmentProxy}'`);

      const noProxy = process.env.no_proxy || process.env.NO_PROXY;
      if (noProxy) {
        core.info(`environment no_proxy set as '${noProxy}'`);
        if (proxyExcluded(noProxy, baseUrl)) {
          core.info(`environment proxy excluded from no_proxy settings`);
        } else {
          core.info(`using proxy '${environmentProxy}' for GitHub API calls`);

          return new HttpsProxyAgent(environmentProxy);
        }
      }
    }
  }
}

function proxyExcluded(noProxy, baseUrl) {
  if (noProxy) {
    const noProxyHosts = noProxy.split(',').map((part) => part.trim());
    const baseUrlHost = new URL(baseUrl).host;

    core.debug(`noProxyHosts = ${JSON.stringify(noProxyHosts)}`);
    core.debug(`baseUrlHost = ${baseUrlHost}`);

    return noProxyHosts.includes(baseUrlHost) > -1;
  }
}

function getApiBaseUrl(url) {
  return url || process.env['GITHUB_API_URL'] || 'https://api.github.com';
}
