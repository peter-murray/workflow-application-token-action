const jwt = require('jsonwebtoken')
  , github = require('@actions/github')
  , PrivateKey = require('./private-key')
  ;

module.exports.create = (baseApiUrl, privateKey, applicationId, timeout) => {
  const app = new GitHubApplication(baseApiUrl, privateKey, applicationId);

  return app.connect(timeout)
    .then(() => {
      return app;
    });
}

class GitHubApplication {

  constructor(baseApiUrl, privateKey, applicationId) {
    this._config = {
      privateKey: new PrivateKey(_validateVariableValue('privateKey', privateKey)),
      id: _validateVariableValue('applicationId', applicationId),
    };

    this._githubApiUrl = baseApiUrl;
    this._client = null;
  }

  connect(validSeconds) {
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
    const options = {};
    if (this._githubApiUrl) {
      options.baseUrl = this._githubApiUrl;
    }
    this._client = new github.getOctokit(token, options);

    return this.client.request('GET /app', {
      mediaType: {
        previews: ['machine-man']
      }
    }).catch(err => {
      throw new Error(`Failed to connect as application; ${err.message}`);
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

  get metadata() {
    return this._metadata;
  }

  get client() {
    const client = this._client;
    if (client === null) {
      throw new Error('Application has not been initialized correctly, call connect() to connect to GitHub.com first.');
    }
    return client;
  }

  get privateKey() {
    return this._config.privateKey.key;
  }

  get id() {
    return this._config.id;
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

  //TODO can get other types of app installations too at org and enterprise

  getRepositoryInstallation(owner, repo) {
    return this.client.apps.getRepoInstallation({
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

  getInstallationAccessToken(installationId) {
    if (!installationId) {
      throw new Error('GitHub Application installation id must be provided');
    }

<<<<<<< HEAD
=======
    permissions = permissions || {};
    const additional = {};
    if (Object.keys(permissions).length > 0) {
      additional.permissions = permissions;
    }

>>>>>>> 0004044... Adding ability to specify the Github API base URL
    return this.client.request(`POST /app/installations/${installationId}/access_tokens`, {
      mediaType: {
        previews: ['machine-man']
      }
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