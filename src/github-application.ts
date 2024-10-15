import { URL } from 'node:url';
import { fetch as undiciFetch, ProxyAgent } from 'undici';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as jwt from 'jsonwebtoken';
import { PrivateKey } from './private-key.js';

export type ApplicationConfig = {
  applicationId: string,
  privateKey: string,
  baseApiUrl?: string,
  timeout?: number,
  proxy?: string,
  ignoreEnvironmentProxy?: boolean
}

export async function createApplication (config : ApplicationConfig): Promise<GitHubApplication> {
  const app = new GitHubApplication(config.privateKey, config.applicationId, config.baseApiUrl);
  await app.connect(config.timeout, config.proxy, config.ignoreEnvironmentProxy);
  return app;
}

export async function revokeAccessToken(token: string, baseUrl?: string, proxy?: string, ignoreEnvironmentProxy: boolean = false) {
  // The token being provided is the one to be invalidated
  const client = getOctokit(token, baseUrl, proxy, ignoreEnvironmentProxy);

  try {
    const resp = await client.rest.apps.revokeInstallationAccessToken();
    if (resp.status === 204) {
      return true;
    }
    throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
  } catch (err: any) {
    throw new Error(`Failed to revoke application token; ${err.message}`);
  }
}

type GitHubApplicationConfig = {
  privateKey: PrivateKey,
  id: string,
}

//TODO these are only the field that we absolutely need, there are more that might make this more useful as an object if we need to inthe future.
type GitHubApplicationMetadata = {
  name: string,
  id: number,
  client_id: string,
}

type Permissions = {
  [key: string]: string;
}

export class GitHubApplication {

  private _client: any;

  private _metadata?: GitHubApplicationMetadata;

  private _config: GitHubApplicationConfig;

  private _githubApiUrl: string;

  constructor(privateKey, applicationId, baseApiUrl) {
    this._config = {
      privateKey: new PrivateKey(_validateVariableValue('privateKey', privateKey)),
      id: _validateVariableValue('applicationId', applicationId),
    };

    this._githubApiUrl = baseApiUrl;
  }

  async connect(validSeconds: number = 60, proxy?: string, ignoreEnvironmentProxy: boolean = false): Promise<GitHubApplicationMetadata> {
    const self = this
      , secondsNow = Math.floor(Date.now() / 1000)
      , expireInSeconds = validSeconds
      ;

    const payload = {
      iat: secondsNow,
      exp: secondsNow + expireInSeconds,
      iss: this.id,
    };

    const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });
    this._client = getOctokit(token, this._githubApiUrl, proxy, ignoreEnvironmentProxy);

    core.debug(`Attempting to fetch GitHub Application for the provided credentials...`);
    try {
      const resp = await this.client.request('GET /app', {headers: {'X-GitHub-Api-Version': '2022-11-28'}});

      if (resp.status === 200) {
        // Store the metadata for debug purposes
        self._metadata = resp.data;
        core.debug(`  GitHub Application resolved: ${JSON.stringify(resp.data)}`);
        return resp.data;
      } else {
        throw new Error(`Failed to load application with id:${this.id}; ${resp.data}`);
      }
    } catch (err: any) {
      const errorMessage = `Failure connecting as the application; status code: ${err.status}\n${err.message}`
      core.error(errorMessage);
      reportErrorDetails(err);
      throw new Error(errorMessage);
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

  get name(): string | undefined {
    return this._metadata?.name;
  }

  async getApplicationInstallations() {
    try {
      const resp = await this.client.request('GET /app/installations', {headers: {'X-GitHub-Api-Version': '2022-11-28'}});

      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    } catch (err: any) {
      const message = `Failed to get application installations; ${err.message}`;
      core.error(message);
      reportErrorDetails(err);

      throw new Error(message);
    }
  }

  async getRepositoryInstallation(owner: string, repo: string) {
    try {
      const resp = await this.client.rest.apps.getRepoInstallation({
        owner: owner,
        repo: repo,
        headers: {'X-GitHub-Api-Version': '2022-11-28'},
      });

      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    } catch (err: any) {
      const message = `Failed to resolve installation of application on repository ${owner}/${repo}; ${err.message}`;
      core.error(message);
      reportErrorDetails(err);

      throw new Error(message);
    }
  }

  async getOrganizationInstallation(org) {
    try {
      const resp = await this.client.rest.apps.getOrgInstallation({
        org: org,
        headers: {'X-GitHub-Api-Version': '2022-11-28'},
      });

      if (resp.status === 200) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    } catch (err: any) {
      const message = `Failed to resolve installation of application on organization ${org}; ${err.message}`;
      core.error(message);
      reportErrorDetails(err);

      throw new Error(message);
    }
  }

  async getInstallationAccessToken(installationId: number, permissions?: Permissions) {
    if (!installationId) {
      throw new Error('GitHub Application installation id must be provided');
    }

    const payload = {permissions: {}, headers: {'X-GitHub-Api-Version': '2022-11-28'}};
    if (permissions && Object.keys(permissions).length > 0) {
      payload.permissions = permissions;
    };

    try {
      const resp = await this.client.request(`POST /app/installations/${installationId}/access_tokens`, payload);

      if (resp.status === 201) {
        return resp.data;
      }
      throw new Error(`Unexpected status code ${resp.status}; ${resp.data}`);
    } catch(err: any) {
      const message =`Failed to get access token for application installation; ${err.message}`
      core.error(message);
      reportErrorDetails(err);

      throw new Error(message);
    }
  }
}

function getOctokit(token: string, baseApiUrl?: string, proxy?: string, ignoreEnvironmentProxy?: boolean) {
  const baseUrl = getApiBaseUrl(baseApiUrl);

  const proxyAgent = getProxyAgent(baseUrl, proxy, ignoreEnvironmentProxy);
  const fetchClient = (url, options) => {
    const mergedOptions = {...options};
    if (proxyAgent) {
      mergedOptions['dispatcher'] = proxyAgent
    }
    return undiciFetch(url, mergedOptions)
  }

  const octokitOptions = {
    baseUrl: baseUrl,
    request: {
      fetch: fetchClient,
      timeout: 5000
    },
  };

  const client = github.getOctokit(token, octokitOptions);
  return client;
}

function _validateVariableValue(variableName: string, value?: string) {
  if (!value) {
    throw new Error(`A valid ${variableName} must be provided, was "${value}"`);
  }

  const result = `${value}`.trim();
  if (result.length === 0) {
    throw new Error(`${variableName} must be provided contained no valid characters other than whitespace`)
  }
  return result;
}

function getProxyAgent(baseUrl: string, proxy?: string, ignoreEnvironmentProxy?: boolean): ProxyAgent | undefined {
  let proxyUri: string | undefined = undefined;

  if (proxy && proxy.trim().length > 0) {
    // User has an explict proxy set, use it
    core.info(`explicit proxy specified as '${proxy}'`);
    //TODO check for explict exclusion on no_proxy?
    proxyUri = proxy;
  } else {
    // When loading from the environment, also respect no_proxy settings
    const envProxy = process.env.http_proxy
      || process.env.HTTP_PROXY
      || process.env.https_proxy
      || process.env.HTTPS_PROXY
      ;

    if (envProxy && envProxy.trim().length > 0) {
      core.info(`environment proxy specified as '${envProxy}'`);

      if (ignoreEnvironmentProxy) {
        core.info(`Action has been configured to ignore environment proxy set. Not using the proxy from the environment and going direct for GitHub API calls...`);
      } else {
        const noProxy = process.env.no_proxy || process.env.NO_PROXY;
        if (!noProxy) {
          proxyUri = envProxy;
        } else {
          core.info(`environment no_proxy set as '${noProxy}'`);
          if (proxyExcluded(noProxy, baseUrl)) {
            core.info(`environment proxy excluded from no_proxy settings`);
          } else {
            core.info(`using proxy '${envProxy}' for GitHub API calls`)
            proxyUri = envProxy;
          }
        }
      }
    }
  }

  if (proxyUri) {
    return new ProxyAgent({uri: proxyUri});
  }
  return undefined;
}

function proxyExcluded(noProxy: string, baseUrl: string) {
  if (noProxy) {
    const noProxyHosts = noProxy.split(',').map(part => part.trim());
    core.debug(`noProxyHosts = ${JSON.stringify(noProxyHosts)}`);
    core.debug(`parsing baseURL: '${baseUrl}'`);
    try {
      const parsedBaseUrl = new URL(baseUrl);
      core.debug(`parsed = ${parsedBaseUrl}`);
      core.debug(`base url host = '${parsedBaseUrl.host}'`);

      return noProxyHosts.indexOf(parsedBaseUrl.host) > -1;
    } catch (err) {
      core.error(`Failure in parsing the URL object`);
      throw err;
    }
    // const parsedBaseUrl = url.parse(baseUrl);
    // core.debug(`parsed host: ${[parsedBaseUrl.host]}`);
    // return noProxyHosts.indexOf(parsedBaseUrl.host) > -1;
  }
}

function getApiBaseUrl(url?: string): string {
  return url || process.env['GITHUB_API_URL'] || 'https://api.github.com'
}

function reportErrorDetails(err: any) {
  if (err) {
    core.startGroup('Error Details');
    core.info(`Response\n  status: ${err.response?.status}\n  url: ${err.response?.url}\n  headers: ${JSON.stringify(err.response?.headers)}`);
    core.endGroup();
  }
}