'use strict';

import fs from 'node:fs';

const data = loadData();

export const getApplicationId = (appName) => {
  return getAppTestValue(appName, 'applicationId');
};

export const getApplicationPrivateKey = (appName) => {
  return getAppTestValue(appName, 'privateKey');
};

export const getTestRepository = (appName) => {
  return getAppTestValue(appName, 'repo.repo');
};

export const getTestRepositoryOwner = (appName) => {
  return getAppTestValue(appName, 'repo.owner');
};

export const getTestOrganization = (appName) => {
  return getAppTestValue(appName, 'org');
};

function loadData() {
  const testDataFile = getTestDataFileName();

  let data = null;
  if (fs.existsSync(testDataFile)) {
    try {
      data = JSON.parse(fs.readFileSync(testDataFile));
    } catch (err) {
      console.error(`Failed to parse data file ${testDataFile}: ${err.message}`);
      data = null;
    }
  }

  return data;
}

function getTestDataFileName() {
  return '.github_application';
}

function getAppTestValue(name, key) {
  if (!data) {
    console.error(
      `No data for tests has been loaded, please ensure you have a valid file for testing at ${getTestDataFileName()}.`,
    );
    return null;
  }

  const application = data[name];

  if (application) {
    if (key) {
      const keyPath = key.split('.');

      let target = application;
      keyPath.forEach((key) => {
        if (target) {
          target = target[key];
        }
      });
      return target;
    }
  }
  return undefined;
}
