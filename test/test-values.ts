import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const data = loadData();

export function getApplicationId(appName) {
  return getAppTestValue(appName, 'applicationId');
}

export function getApplicationPrivateKey(appName) {
  return getAppTestValue(appName, 'privateKey');
}

export function getTestRepository(appName) {
  return getAppTestValue(appName, 'repo.repo');
}

export function getTestRepositoryOwner(appName) {
  return getAppTestValue(appName, 'repo.owner');
}

export function getTestOrganization(appName) {
  return getAppTestValue(appName, 'org');
}

function loadData() {
  const testDataFile = getTestDataFileName();

  let data = null;
  if (fs.existsSync(testDataFile)) {
    try {
      data = JSON.parse(fs.readFileSync(testDataFile).toString('utf-8'));
    } catch(err: any) {
      console.error(`Failed to parse data file ${testDataFile}: ${err.message}`);
      data = null;
    }
  }

  return data;
}

function getTestDataFileName() {
  if (os.platform() === 'win32') {
    //@ts-ignore
    return path.join(process.env.LOCALAPPDATA, '.github_application');
  } else {
    //@ts-ignore
    return path.join(process.env.HOME, '.github_application');
  }
}

function getAppTestValue(name: string, key: string) {
  if (!data) {
    console.error(`No data for tests has been loaded, please ensure you have a valid file for testing at ${getTestDataFileName()}.`);
    return undefined;
  }

  const application = data[name];
  // console.log(`DATA:: ${JSON.stringify(application)}`);

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
  return undefined;
}