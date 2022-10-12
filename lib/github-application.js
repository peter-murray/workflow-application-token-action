const jwt = require('jsonwebtoken')
  , github = require('@actions/github')
  , core = require('@actions/core')
  , PrivateKey = require('./private-key')
  , HttpsProxyAgent = require('https-proxy-agent')
  , url = require('url')
  ;

module.exports.create = (privateKey, applicationId, baseApiUrl, timeout, proxy) => {
  const app = new GitHubApplication(privateKey, applicationId, baseApiUrl);

  return app.connect(timeout, proxy)
    .then(() => {
      return app;
    });
}

class GitHubApplication {

  constructor(privateKey, applicationId, baseApiUrl) {
    this._config = {
      privateKey: new PrivateKey(_validateVariableValue('privateKey', privateKey)),
      id: _validateVariableValue('applicationId', applicationId),
    };

    this._githubApiUrl = baseApiUrl;
    this._client = null;
  }

  connect(validSeconds, proxy) {
    const self = this
      , secondsNow = Math.floor(Date.now() / 1000)
      , expireInSeconds = validSeconds || 60
      ;

    const payload = {
      iat: secondsNow,
      exp: secondsNow + expireInSeconds,
      iss: this.id,
    };

    const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });

    // We need to get this here so we can potentially apply no_proxy rules
    const baseUrl = getApiBaseUrl(this.githubApiBaseUrl);

    const octokitOptions = {
      baseUrl: baseUrl
    };

    const request = {
      agent: getProxyAgent(proxy, baseUrl),
      timeout: 5000
    };
    octokitOptions.request = request;
    this._client = new github.getOctokit(token, octokitOptions);

    return this.client.request('GET /app', {
      mediaType: {
        previews: ['machine-man']
      }
    }).catch(err => {
      throw new Error(`Failed to connect as application; status code: ${err.status}\n${err.message}`);
    }).then(resp => {
      if (resp.status === 200) {
        // Store the metadata for debug purposes
        self._metadata = resp.data;

        return resp.data;
      } else {
        throw new Error(`Failed to load application with id:${this.id}; ${resp.data}`);
      }
    });
  }

  get githubApiBaseUrl() {
    return this._githubApiUrl;
  }

  get metadata() {
    return this._metadata;
  }

  get client() {
    const client = this._client;
    if (client === null) {
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

  getApplicationInstallations() {
    return this.client.request('GET /app/installations', {
      mediaType: {
        previews: ['machine-man']
      }
    }).catch(err => {
      throw new Error(`Failed to get application installations; ${err.message}`);
    }).then(resp => {
      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    });
  }

  getRepositoryInstallation(owner, repo) {
    return this.client.rest.apps.getRepoInstallation({
      owner: owner,
      repo: repo
    }).catch(err => {
      throw new Error(`Failed to resolve installation of application on repository ${owner}/${repo}; ${err.message}`);
    }).then(resp => {
      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    });
  }

  getOrganizationInstallation(org) {
    return this.client.rest.apps.getOrgInstallation({
      org: org
    }).catch(err => {
      throw new Error(`Failed to resolve installation of application on organization ${org}; ${err.message}`);
    }).then(resp => {
      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    });
  }

  getInstallationAccessToken(installationId, permissions) {
    if (!installationId) {
      throw new Error('GitHub Application installation id must be provided');
    }

    permissions = permissions || {};
    const additional = {};
    if (Object.keys(permissions).length > 0) {
      additional.permissions = permissions;
    }

    return this.client.request(`POST /app/installations/${installationId}/access_tokens`, {
      mediaType: {
        previews: ['machine-man']
      },
      ...additional
    }).catch(err => {
      throw new Error(`Failed to get access token for application installation; ${err.message}`);
    }).then(resp => {
      if (resp.status === 201) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    });
  }
}

function _validateVariableValue(variableName, value) {
  if (!value) {
    throw new Error(`A valid ${variableName} must be provided, was "${value}"`);
  }

  const result = `${value}`.trim();
  if (result.length === 0) {
    throw new Error(`${variableName} must be provided contained no valid characters other than whitespace`)
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
    const envProxy = process.env.http_proxy
      || process.env.HTTP_PROXY
      || process.env.https_proxy
      || process.env.HTTPS_PROXY
      ;

    if (envProxy) {
      core.info(`environment proxy specified as '${envProxy}'`);

      const noProxy = process.env.no_proxy || process.env.NO_PROXY;
      if (noProxy) {
        core.info(`environment no_proxy set as '${noProxy}'`);
        if (proxyExcluded(noProxy, baseUrl)) {
          core.info(`environment proxy excluded from no_proxy settings`);
        } else {
          core.info(`using proxy '${envProxy}' for GitHub API calls`)
          return new HttpsProxyAgent(envProxy);
        }
      }
    }
  }
  return null;
}

function proxyExcluded(noProxy, baseUrl) {
  if (noProxy) {
    const noProxyHosts = noProxy.split(',').map(part => part.trim());
    const baseUrlHost = url.parse(baseUrl).host;

    core.debug(`noProxyHosts = ${JSON.stringify(noProxyHosts)}`);
    core.debug(`baseUrlHost = ${baseUrlHost}`);

    return noProxyHosts.indexOf(baseUrlHost) > -1;
  }
}

function getApiBaseUrl(url) {
  return url || process.env['GITHUB_API_URL'] || 'https://api.github.com'
}