'use strict';

const os = require('os')
  , path = require('path')
  , fs = require('fs')
  ;

const data = loadData();

module.exports = {
  getApplicationId: function(appName) {
    return getAppTestValue(appName, 'applicationId');
  },

  getApplicationPrivateKey: function(appName) {
    return getAppTestValue(appName, 'privateKey');
  },

  getTestRepository: function(appName) {
    return getAppTestValue(appName, 'repo.repo');
  },

  getTestRepositoryOwner: function(appName) {
    return getAppTestValue(appName, 'repo.owner');
  },

  getTestOrganization: function(appName) {
    return getAppTestValue(appName, 'org');
  },
}

function loadData() {
  const platform = os.platform();

  let testDataFile;
  if (platform === 'win32') {
    testDataFile = path.join(process.env.LOCALAPPDATA, '.github_application');
  }

  if (platform === 'darwin') {
    testDataFile = path.join(process.env.HOME, '.github_application');
  }

  let data = null;
  if (fs.existsSync(testDataFile)) {
    try {
      data = JSON.parse(fs.readFileSync(testDataFile));
    } catch(err) {
      console.error(`Failed to parse data file ${testDataFile}: ${err.message}`);
      data = null;
    }
  }

  return data;
}

function getAppTestValue(name, key) {
  const application = data[name];

  if (application) {
    if (key) {
      const keyPath = key.split('.');

      let target = application;
      keyPath.forEach(key => {
        if (target) {
          target = target[key];
        }
      });
      return target;
    }
  }
  return null;
}