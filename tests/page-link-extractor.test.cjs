'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const payload = {
  data: {
    noteSign: {
      userId: '000000000000000000000405',
      name: '推荐页机构'
    },
    liveSign: {
      userId: '000000000000000000000405',
      name: '推荐页机构'
    }
  }
};

let requestHandler;
const documentAttributes = new Map();
const document = {
  addEventListener(name, handler) {
    if (name === 'pgy-cart-resolve-link') requestHandler = handler;
  },
  getElementById() { return null; },
  documentElement: {
    setAttribute(name, value) { documentAttributes.set(name, value); },
    getAttribute(name) { return documentAttributes.get(name) || null; }
  }
};
const location = {
  href: 'https://pgy.xiaohongshu.com/solar/pre-trade/blogger-detail/000000000000000000000404',
  pathname: '/solar/pre-trade/blogger-detail/000000000000000000000404'
};
const response = {
  url: 'https://pgy.xiaohongshu.com/api/solar/cooperator/blogger/detail',
  headers: { get: () => 'application/json' },
  clone: () => ({ json: async () => payload })
};
const window = {
  fetch: async () => response
};
const context = vm.createContext({ window, document, location, URL, console });
vm.runInContext(fs.readFileSync('src/content/json-response-observer.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('src/content/page-link-extractor.js', 'utf8'), context);

function institutionFromDom(companyName, hasCompanyClass = true) {
  let domRequestHandler;
  const domDocument = {
    addEventListener(name, handler) {
      if (name === 'pgy-cart-resolve-link') domRequestHandler = handler;
    },
    getElementById() { return null; },
    documentElement: { setAttribute() {} }
  };
  const companyElement = { innerText: companyName, textContent: companyName };
  const noInstitutionElement = { innerText: '无机构', textContent: '无机构' };
  const scope = {
    innerText: `四川 成都\n${companyName}`,
    textContent: `四川 成都\n${companyName}`,
    parentElement: null,
    querySelector(selector) { return hasCompanyClass && selector.includes('.blogger-company__text') ? companyElement : null; },
    querySelectorAll(selector) { return !hasCompanyClass && selector === 'span,div,p' ? [noInstitutionElement] : []; }
  };
  const domAttributes = new Map();
  const domAnchor = {
    textContent: 'test-profile',
    parentElement: scope,
    closest(selector) { return selector === 'a' ? this : null; },
    setAttribute(name, value) { domAttributes.set(name, value); },
    getAttribute(name) { return domAttributes.get(name) || null; }
  };
  const domWindow = {};
  vm.runInContext(
    fs.readFileSync('src/content/page-link-extractor.js', 'utf8'),
    vm.createContext({ window: domWindow, document: domDocument, location, URL, console })
  );
  domRequestHandler({ target: domAnchor });
  return domAttributes.get('data-pgy-resolved-institution');
}

(async () => {
  await window.fetch(response.url);
  await Promise.resolve();
  await Promise.resolve();

  const attributes = new Map();
  const noInstitutionElement = { innerText: '无机构', textContent: '无机构' };
  const currentCreatorScope = {
    innerText: '四川 成都\n无机构',
    textContent: '四川 成都\n无机构',
    parentElement: null,
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === 'span,div,p' ? [noInstitutionElement] : []; }
  };
  const anchor = {
    textContent: 'test-profile',
    parentElement: currentCreatorScope,
    closest(selector) { return selector === 'a' ? this : null; },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) || null; }
  };
  requestHandler({ target: anchor });

  assert.equal(attributes.get('data-pgy-resolved-institution'), '无机构');
  assert.equal(attributes.get('data-pgy-resolved-homepage-url'), 'https://www.xiaohongshu.com/user/profile/000000000000000000000404');
  assert.equal(institutionFromDom('示例机构甲'), '示例机构甲');
  assert.equal(institutionFromDom('无机构', false), '无机构');
  console.log('page link extractor tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
