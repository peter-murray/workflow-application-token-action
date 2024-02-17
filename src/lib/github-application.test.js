import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as github from '@actions/github';
import * as testValues from '../../test/test-values.js';
import * as gitHubApp from './github-application.js';
import { fail } from 'node:assert';

describe('GitHubApplication', () => {
  const TEST_APPLICATION_NAME = 'test';

  describe('creation with invalid private keys', () => {
    it('should fail on an empty private key', async () => {
      await testPrivateKey('', 'privateKey must be provided');
    });

    it('should fail on a private key consisting of whitespace characters', async () => {
      await testPrivateKey(' \n \r\n ', 'privateKey must be provided');
    });

    it('should fail a null private key', async () => {
      // eslint-disable-next-line unicorn/no-null
      await testPrivateKey(null, 'privateKey must be provided');
    });

    it('should fail on an undefined private key', async () => {
      await testPrivateKey(undefined, 'privateKey must be provided');
    });
  });

  describe('creation with invalid application id', () => {
    it('should fail on an empty application id', async () => {
      await testApplicationId('', 'applicationId must be provided');
    });

    it('should fail on a application id consisting of whitespace characters', async () => {
      await testApplicationId(' \n \r\n ', 'applicationId must be provided');
    });

    it('should fail a null application id', async () => {
      // eslint-disable-next-line unicorn/no-null
      await testApplicationId(null, 'applicationId must be provided');
    });

    it('should fail on an undefined application id', async () => {
      await testApplicationId(undefined, 'applicationId must be provided');
    });
  });

  describe('Installed Application - GitHub.com', () => {
    let app;

    beforeEach(async function () {
      app = await gitHubApp.create(
        testValues.getApplicationPrivateKey(TEST_APPLICATION_NAME),
        testValues.getApplicationId(TEST_APPLICATION_NAME),
      );
    });

    it('should connect to GitHub.com', async () => {
      const appData = app.metadata;

      expect(appData).to.have.property('id').to.equal(testValues.getApplicationId(TEST_APPLICATION_NAME));
      expect(appData).to.have.property('owner');
      expect(appData).to.have.property('name');
      expect(appData).to.have.property('permissions');
      expect(appData).to.have.property('installations_count');
    });

    it('should be able to list application installations', async () => {
      const data = await app.getApplicationInstallations();

      expect(data).to.be.an.instanceOf(Array);
      expect(data).to.have.length.greaterThan(0);

      expect(data[0]).to.have.property('id');
    });

    it('should be able to get installation for a repository', async () => {
      const data = await app.getRepositoryInstallation(
        testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME),
        testValues.getTestRepository(TEST_APPLICATION_NAME),
      );

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });

    it('should be able to get installation for an organization', async () => {
      const data = await app.getOrganizationInstallation(testValues.getTestOrganization(TEST_APPLICATION_NAME));

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });

    it('should fetch the requested permissions (read)', async () => {
      const data = await app.getOrganizationInstallation(testValues.getTestOrganization(TEST_APPLICATION_NAME));

      const accessToken = await app.getInstallationAccessToken(data.id, {
        issues: 'read',
      });

      expect(accessToken).to.have.property('permissions');
      expect(accessToken.permissions).to.eql({
        issues: 'read',
        metadata: 'read',
      });
    });

    it('should fetch the requested permissions (write)', async () => {
      const data = await app.getOrganizationInstallation(testValues.getTestOrganization(TEST_APPLICATION_NAME));

      const accessToken = await app.getInstallationAccessToken(data.id, {
        issues: 'write',
      });

      expect(accessToken).to.have.property('permissions');
      expect(accessToken.permissions).to.eql({
        issues: 'write',
        metadata: 'read',
      });
    });

    it('should be able to get access token for a repository installation', async () => {
      const repoInstall = await app.getRepositoryInstallation(
        testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME),
        testValues.getTestRepository(TEST_APPLICATION_NAME),
      );
      const accessToken = await app.getInstallationAccessToken(repoInstall.id);
      expect(accessToken).to.have.property('token');

      // Use the token to access the repository
      const client = new github.getOctokit(accessToken.token);
      const repoName = testValues.getTestRepository(TEST_APPLICATION_NAME);
      const ownerName = testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME);
      const repo = await client.rest.repos.get({
        owner: ownerName,
        repo: repoName,
      });

      expect(repo).to.have.property('status').to.equal(200);
      expect(repo).to.have.property('data');
      expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(ownerName);
      expect(repo.data).to.have.property('name').to.equal(repoName);
    });

    describe('Using proxy server', () => {
      describe('Installed Application - GitHub.com', function () {
        // eslint-disable-next-line no-invalid-this
        this.timeout(10 * 1000);

        beforeEach(async function () {
          app = await gitHubApp.create(
            testValues.getApplicationPrivateKey(TEST_APPLICATION_NAME),
            testValues.getApplicationId(TEST_APPLICATION_NAME),
            undefined,
            undefined,
            `http://${process.env.SQUID_HOST}:3128`,
          );
        });

        it('should be able to get access token for a repository installation', async () => {
          const repoInstall = await app.getRepositoryInstallation(
            testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME),
            testValues.getTestRepository(TEST_APPLICATION_NAME),
          );
          const accessToken = await app.getInstallationAccessToken(repoInstall.id);
          expect(accessToken).to.have.property('token');

          // Use the token to access the repository
          // const client = new github.getOctokit(accessToken.token)
          //   , repoName = testValues.getTestRepository(TEST_APPLICATION_NAME)
          //   , ownerName = testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME)
          //   , repo = await client.rest.repos.get({
          //   owner: ownerName,
          //   repo: repoName,
          // });

          // expect(repo).to.have.property('status').to.equal(200);
          // expect(repo).to.have.property('data');
          // expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(ownerName);
          // expect(repo.data).to.have.property('name').to.equal(repoName);
          await testRepositoryToken(accessToken.token);
        });
      });
    });

    describe('Application token revocation', () => {
      let testToken;

      beforeEach(async function () {
        const repoInstall = await app.getRepositoryInstallation(
          testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME),
          testValues.getTestRepository(TEST_APPLICATION_NAME),
        );

        const accessToken = await app.getInstallationAccessToken(repoInstall.id);
        expect(accessToken).to.have.property('token');
        testToken = accessToken.token;
      });

      it('should be able to revoke a valid application token', async () => {
        await testRepositoryToken(testToken);

        const revoked = await gitHubApp.revokeAccessToken(testToken);
        expect(revoked).to.be.true;

        try {
          await testRepositoryToken(testToken);
          fail('The token should no longer be valid so should not get here.');
        } catch (error) {
          expect(error.message).to.contain('Bad credentials');
        }
      });
    });
  });

  async function testRepositoryToken(accessToken) {
    const client = new github.getOctokit(accessToken);
    const repoName = testValues.getTestRepository(TEST_APPLICATION_NAME);
    const ownerName = testValues.getTestRepositoryOwner(TEST_APPLICATION_NAME);
    const repo = await client.rest.repos.get({
      owner: ownerName,
      repo: repoName,
    });

    expect(repo).to.have.property('status').to.equal(200);
    expect(repo).to.have.property('data');
    expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(ownerName);
    expect(repo.data).to.have.property('name').to.equal(repoName);
  }

  async function testPrivateKey(value, message) {
    try {
      await gitHubApp.create(value, testValues.getApplicationId(TEST_APPLICATION_NAME));
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.contain(message);
    }
  }

  async function testApplicationId(value, message) {
    try {
      await gitHubApp.create(testValues.getApplicationPrivateKey(TEST_APPLICATION_NAME), value);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.contain(message);
    }
  }
});
