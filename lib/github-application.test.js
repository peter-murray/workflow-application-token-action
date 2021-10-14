const expect = require('chai').expect
  , github = require('@actions/github')
  , gitHubApp = require('./github-application')
  , testValues = require('../test/test-values')
;

const APPLICATION_NAME = 'test';

describe('GitHubApplication', () => {

  describe('creation with invalid private keys', () => {

    it('should fail on an empty private key', () => {
      testPrivateKey('', 'privateKey must be provided');
    });

    it('should fail on a private key consisting of whitespace characters', () => {
      testPrivateKey(' \n \r\n ', 'privateKey must be provided');
    });

    it('should fail a null private key', () => {
      testPrivateKey(null, 'privateKey must be provided');
    });

    it('should fail on an undefined private key', () => {
      testPrivateKey(undefined, 'privateKey must be provided');
    });

    function testPrivateKey(value, message) {
      try {
        gitHubApp.create(value, testValues.getApplicationId(APPLICATION_NAME));
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.contain(message);
      }
    }
  });

  describe('creation with invalid application id', () => {

    it('should fail on an empty application id', () => {
      testApplicationId('', 'applicationId must be provided');
    });

    it('should fail on a application id consisting of whitespace characters', () => {
      testApplicationId(' \n \r\n ', 'applicationId must be provided');
    });

    it('should fail a null application id', () => {
      testApplicationId(null, 'applicationId must be provided');
    });

    it('should fail on an undefined application id', () => {
      testApplicationId(undefined, 'applicationId must be provided');
    });

    function testApplicationId(value, message) {
      try {
        gitHubApp.create(testValues.getApplicationPrivateKey(APPLICATION_NAME), value);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.contain(message);
      }
    }
  });

  describe('Installed Application', () => {

    let app = null;

    beforeEach(async () => {
      app = await gitHubApp.create(
        testValues.getApplicationPrivateKey(APPLICATION_NAME),
        testValues.getApplicationId(APPLICATION_NAME)
      );
    });

    it('should connect to GitHub.com', async () => {
      const appData = app.metadata;

      expect(appData).to.have.property('id').to.equal(testValues.getApplicationId(APPLICATION_NAME));
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
        testValues.getTestRepositoryOwner(APPLICATION_NAME),
        testValues.getTestRepository(APPLICATION_NAME)
      );

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });

    it('should be able to get installation for an organization', async () => {
      const data = await app.getOrganizationInstallation(
        testValues.getTestOrganization(APPLICATION_NAME)
      );

      expect(data).to.have.property('id');
      expect(data).to.have.property('permissions');
    });

    it('should fetch the requested permissions (read)', async () => {
      const data = await app.getOrganizationInstallation(
        testValues.getTestOrganization(APPLICATION_NAME)
      );

      const accessToken = await app.getInstallationAccessToken(data.id,
        {issues: 'read'}
      );

      expect(accessToken).to.have.property('permissions');
      expect(accessToken.permissions).to.eql({
        issues: 'read',
        metadata: 'read'
      });
    });

    it('should fetch the requested permissions (write)', async () => {
      const data = await app.getOrganizationInstallation(
        testValues.getTestOrganization(APPLICATION_NAME)
      );

      const accessToken = await app.getInstallationAccessToken(data.id,
        {issues: 'write'}
      );

      expect(accessToken).to.have.property('permissions');
      expect(accessToken.permissions).to.eql({
        issues: 'write',
        metadata: 'read'
      });
    });


    it('should be able to get access token for a repository installation', async () => {
      const repoInstall = await app.getRepositoryInstallation(
          testValues.getTestRepositoryOwner(APPLICATION_NAME),
          testValues.getTestRepository(APPLICATION_NAME)
        )
        , accessToken = await app.getInstallationAccessToken(repoInstall.id)
      ;
      expect(accessToken).to.have.property('token');

      // Use the token to access the repository
      const client = new github.getOctokit(accessToken.token)
        , repoName = testValues.getTestRepository(APPLICATION_NAME)
        , ownerName = testValues.getTestRepositoryOwner(APPLICATION_NAME)
        , repo = await client.rest.repos.get({
            owner: ownerName,
            repo: repoName,
        });

      expect(repo).to.have.property('status').to.equal(200);
      expect(repo).to.have.property('data');
      expect(repo.data).to.have.property('owner').to.have.property('login').to.equal(ownerName);
      expect(repo.data).to.have.property('name').to.equal(repoName);
    })
  });
});