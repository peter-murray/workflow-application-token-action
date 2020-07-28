const jwt = require('jsonwebtoken')
  , github = require('@actions/github')
  , PrivateKey = require('./private-key')
;

module.exports.create = (privateKey, applicationId, timeout) => {
  const app = new GitHubApplication(privateKey, applicationId);

  return app.connect(timeout)
    .then(() => {
      return app;
    });
}

class GitHubApplication {

  constructor(privateKey, applicationId) {
    this._config = {
      privateKey: new PrivateKey(_validateVariableValue('privateKey', privateKey)),
      id: _validateVariableValue('applicationId', applicationId),
    };

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

    const token = jwt.sign(payload, this.privateKey, {algorithm: 'RS256'});
    this._client = new github.getOctokit(token);

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
      if (err.status === 404) {
        throw new Error(`Failed to resolve installation of application on repository ${owner}/${repo}`);
      }
    }).then(resp => {
      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    });
  }

  getInstallationAccessToken(installationId) {
    return this.client.request(`POST /app/installations/${installationId}/access_tokens`, {
      mediaType: {
        previews: ['machine-man']
      }
    }).then(resp => {
      if (resp.status === 201) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    });
  }
}

function _validateVariableValue(variableName, value) {
  if (! value) {
    throw new Error(`A valid ${variableName} must be provided, was "${value}"`);
  }

  const result = `${value}`.trim();
  if (result.length === 0) {
    throw new Error(`${variableName} must be provided contained no valid characters other than whitespace`)
  }
  return result;
}